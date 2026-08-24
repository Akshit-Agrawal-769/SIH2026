"""
xarray Scientific Data Service
Performs:
1. Secure dataset path resolution and allowlist verification
2. 3D volumetric Float32 binary buffer generation for WebGL Data3DTexture
3. Curvilinear (2D lon_rho/lat_rho) and rectilinear (1D) spatial interpolation
4. Terrain-following ROMS s-coordinate physical depth calculations
5. 4D spatio-temporal colocation across bounding forecast time steps (t0, t1)
"""

import os
import glob
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import xarray as xr
import pandas as pd
from scipy.interpolate import RegularGridInterpolator
from scipy.spatial import cKDTree
from app.core.config import settings
from ingestion.adapters.roms_adapter import ROMSModelAdapter, calculate_roms_vertical_depths


def geo_to_cartesian(lon_deg: np.ndarray, lat_deg: np.ndarray) -> np.ndarray:
    """Converts geographic degrees (lon, lat) to 3D Cartesian unit vectors for sphere KDTree."""
    lon_rad = np.radians(lon_deg)
    lat_rad = np.radians(lat_deg)
    x = np.cos(lat_rad) * np.cos(lon_rad)
    y = np.cos(lat_rad) * np.sin(lon_rad)
    z = np.sin(lat_rad)
    return np.column_stack((x.flatten(), y.flatten(), z.flatten()))


VAR_ALIASES = {
    "temp": ["temp", "to", "temperature", "TEMP", "thetao"],
    "salt": ["salt", "so", "salinity", "PSAL"],
    "u": ["u", "ugo", "uo", "u_eastward"],
    "v": ["v", "vgo", "vo", "v_northward"],
    "chl": ["chl", "chla", "chlorophyll", "CHLA"],
}


def resolve_variable_name(ds: xr.Dataset, var_name: str) -> Optional[str]:
    if var_name in ds:
        return var_name
    for alias in VAR_ALIASES.get(var_name.lower(), []):
        if alias in ds:
            return alias
    return None


class XarrayDataService:
    
    def __init__(self):
        self.datasets_dir = settings.DATASETS_DIR

    def list_available_model_datasets(self) -> List[str]:
        model_dir = os.path.join(self.datasets_dir, "model")
        if not os.path.exists(model_dir):
            return []
        files = glob.glob(os.path.join(model_dir, "*.nc")) + glob.glob(os.path.join(model_dir, "*.nc4"))
        return sorted([os.path.basename(f) for f in files])

    def get_model_dataset_path(self, filename: str) -> Optional[str]:
        """Secures file path access against directory traversal attacks."""
        safe_filename = os.path.basename(filename)
        if safe_filename != filename or ".." in filename:
            return None
        
        path = os.path.abspath(os.path.join(self.datasets_dir, "model", safe_filename))
        expected_dir = os.path.abspath(os.path.join(self.datasets_dir, "model"))
        
        if not path.startswith(expected_dir) or not os.path.exists(path):
            return None
            
        return path

    def get_metadata(self, filename: str) -> Optional[Dict[str, Any]]:
        path = self.get_model_dataset_path(filename)
        if not path:
            return None
        adapter = ROMSModelAdapter(path)
        return adapter.extract_metadata()

    def extract_3d_volume_buffer(
        self,
        filename: str,
        variable: str = "temp",
        time_idx: int = 0,
        target_shape: Tuple[int, int, int] = (64, 64, 32)
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        """
        Extracts 3D volumetric array, regularizes to target_shape (nx, ny, nz),
        normalizes data to [0.0, 1.0] for WebGL2 Data3DTexture rendering (with -1.0 for missing/NaN cells),
        and returns Float32 byte buffer along with complete physical coordinate metadata.
        """
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None

        try:
            with xr.open_dataset(filepath) as ds:
                var_key = resolve_variable_name(ds, variable)
                if not var_key:
                    return None

                da = ds[var_key]
                
                # Squeeze time dimension
                t_dim = next((k for k in ["time", "ocean_time", "time_counter"] if k in da.dims), None)
                if t_dim and t_dim in da.dims:
                    t_len = da.sizes[t_dim]
                    valid_time_idx = min(max(0, time_idx), t_len - 1)
                    da_3d = da.isel({t_dim: valid_time_idx})
                else:
                    valid_time_idx = 0
                    da_3d = da

                raw_data = da_3d.values.astype(np.float32)

                # Extract Physical Spatial Bounds
                lon_key = next((k for k in ["lon", "longitude", "lon_rho", "x", "nav_lon"] if k in ds.coords or k in ds.data_vars), None)
                lat_key = next((k for k in ["lat", "latitude", "lat_rho", "y", "nav_lat"] if k in ds.coords or k in ds.data_vars), None)
                depth_key = next((k for k in ["depth", "s_rho", "lev", "level", "z", "deptht"] if k in ds.coords or k in ds.dims), None)

                min_lon = float(np.nanmin(ds[lon_key].values)) if lon_key else 0.0
                max_lon = float(np.nanmax(ds[lon_key].values)) if lon_key else 1.0
                min_lat = float(np.nanmin(ds[lat_key].values)) if lat_key else 0.0
                max_lat = float(np.nanmax(ds[lat_key].values)) if lat_key else 1.0

                # Extract Physical Vertical Depth Bounds
                min_depth = 0.0
                max_depth = 2000.0
                is_native_s = ("s_rho" in ds.dims or "s_rho" in ds.coords or "Cs_r" in ds)
                if is_native_s and "s_rho" in ds and "Cs_r" in ds and "h" in ds and "hc" in ds and "Vtransform" in ds:
                    s_rho = ds["s_rho"].values
                    Cs_r = ds["Cs_r"].values
                    hc = float(ds["hc"].values)
                    Vtransform = int(ds["Vtransform"].values)

                    # Local bathymetry max depth across domain
                    h_max = float(np.nanmax(ds["h"].values))

                    # Check for local zeta at requested time
                    zeta_val = 0.0
                    zeta_key = next((k for k in ["zeta", "ssh", "zo"] if k in ds or k in da_3d.coords), None)
                    if zeta_key:
                        try:
                            zeta_da = ds[zeta_key]
                            z_tdim = next((k for k in ["time", "ocean_time", "time_counter"] if k in zeta_da.dims), None)
                            if z_tdim and z_tdim in zeta_da.dims:
                                z_t_idx = min(max(0, time_idx), zeta_da.sizes[z_tdim] - 1)
                                zeta_da = zeta_da.isel({z_tdim: z_t_idx})
                            zeta_val = float(np.nanmean(zeta_da.values))
                        except Exception:
                            zeta_val = 0.0

                    z_bottom = calculate_roms_vertical_depths(s_rho[0], Cs_r[0], h_max, hc, zeta=zeta_val, Vtransform=Vtransform)
                    z_surface = calculate_roms_vertical_depths(s_rho[-1], Cs_r[-1], h_max, hc, zeta=zeta_val, Vtransform=Vtransform)
                    min_depth = abs(float(z_surface))
                    max_depth = abs(float(z_bottom))
                elif depth_key and depth_key in ds:
                    depth_vals = np.abs(ds[depth_key].values.flatten())
                    min_depth = float(np.nanmin(depth_vals))
                    max_depth = float(np.nanmax(depth_vals))

                # Reshape/Interpolate to target 3D texture shape (Z, Y, X)
                nx_tgt, ny_tgt, nz_tgt = target_shape[0], target_shape[1], target_shape[2]
                
                shape = raw_data.shape
                if len(shape) == 3:
                    nz_curr, ny_curr, nx_curr = shape
                    z_in = np.linspace(0, 1, nz_curr)
                    y_in = np.linspace(0, 1, ny_curr)
                    x_in = np.linspace(0, 1, nx_curr)
                    
                    valid_raw = raw_data[~np.isnan(raw_data)]
                    if len(valid_raw) == 0:
                        return None
                    fill_val = float(np.mean(valid_raw))

                    interp = RegularGridInterpolator(
                        (z_in, y_in, x_in), raw_data, bounds_error=False, fill_value=fill_val
                    )
                    
                    z_out = np.linspace(0, 1, nz_tgt)
                    y_out = np.linspace(0, 1, ny_tgt)
                    x_out = np.linspace(0, 1, nx_tgt)
                    
                    grid_z, grid_y, grid_x = np.meshgrid(z_out, y_out, x_out, indexing="ij")
                    vol_interp = interp((grid_z, grid_y, grid_x)).astype(np.float32)
                else:
                    vol_interp = np.zeros((nz_tgt, ny_tgt, nx_tgt), dtype=np.float32)

                nan_mask = np.isnan(vol_interp)
                has_nan = bool(np.any(nan_mask))
                valid_mask = ~nan_mask

                min_val = float(np.min(vol_interp[valid_mask])) if np.any(valid_mask) else 0.0
                max_val = float(np.max(vol_interp[valid_mask])) if np.any(valid_mask) else 1.0

                if max_val == min_val:
                    max_val += 1e-5

                # Normalize valid scientific data to [0.0, 1.0] for WebGL
                vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0).astype(np.float32)
                # Encode missing/NaN ocean cells as -1.0 so GPU shader skips them
                vol_norm[nan_mask] = -1.0

                buffer = vol_norm.tobytes()

                metadata = {
                    "min_val": min_val,
                    "max_val": max_val,
                    "dim_x": nx_tgt,
                    "dim_y": ny_tgt,
                    "dim_z": nz_tgt,
                    "min_lon": min_lon,
                    "max_lon": max_lon,
                    "min_lat": min_lat,
                    "max_lat": max_lat,
                    "min_depth": min_depth,
                    "max_depth": max_depth,
                    "variable": variable,
                    "units": da.attrs.get("units", ""),
                    "long_name": da.attrs.get("long_name", variable),
                    "has_nan": has_nan,
                    "nan_value": -1.0,
                }

                return buffer, metadata

        except Exception as e:
            print(f"Error extracting 3D volume buffer: {e}")
            return None

    def extract_2d_slice_buffer(
        self,
        filename: str,
        variable: str,
        time_idx: int = 0,
        depth_idx: int = 0
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None
            
        try:
            with xr.open_dataset(filepath) as ds:
                var_key = resolve_variable_name(ds, variable)
                if not var_key:
                    return None
                    
                da = ds[var_key]
                isel_dict = {}
                if "time" in da.dims:
                    isel_dict["time"] = min(max(0, time_idx), da.sizes["time"] - 1)
                if "depth" in da.dims:
                    isel_dict["depth"] = min(max(0, depth_idx), da.sizes["depth"] - 1)
                elif "s_rho" in da.dims:
                    isel_dict["s_rho"] = min(max(0, depth_idx), da.sizes["s_rho"] - 1)

                slice_data = da.isel(**isel_dict).values
                slice_f32 = slice_data.astype(np.float32)
                min_val = float(np.nanmin(slice_data))
                max_val = float(np.nanmax(slice_data))

                meta = {
                    "shape": list(slice_f32.shape),
                    "min_val": min_val,
                    "max_val": max_val,
                    "variable": variable,
                }
                return slice_f32.tobytes(), meta
        except Exception as e:
            print(f"Error extracting 2D slice buffer: {e}")
            return None

    def _spatial_interpolate_profile(
        self,
        da_3d: xr.DataArray,
        ds: xr.Dataset,
        lat: float,
        lon: float,
        time_idx: int = 0
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Interpolates 3D DataArray (nz, ny, nx) at specific geographic point (lat, lon).
        Supports both 2D curvilinear (lon_rho, lat_rho) and 1D rectilinear (lon, lat) grids.
        Returns: (model_depths_array, model_values_array)
        """
        lon_key = next((k for k in ["lon", "longitude", "lon_rho", "x", "nav_lon"] if k in da_3d.coords or k in ds.coords), None)
        lat_key = next((k for k in ["lat", "latitude", "lat_rho", "y", "nav_lat"] if k in da_3d.coords or k in ds.coords), None)
        depth_key = next((k for k in ["depth", "s_rho", "lev", "level", "z"] if k in da_3d.coords or k in da_3d.dims), None)

        is_curvilinear = False
        if lon_key and lat_key and ds[lon_key].ndim == 2:
            is_curvilinear = True

        if is_curvilinear:
            # 2D Curvilinear grid interpolation using KDTree on sphere
            grid_lons = ds[lon_key].values
            grid_lats = ds[lat_key].values
            
            cart_grid = geo_to_cartesian(grid_lons, grid_lats)
            cart_pt = geo_to_cartesian(np.array([lon]), np.array([lat]))
            
            tree = cKDTree(cart_grid)
            dists, idxs = tree.query(cart_pt, k=4)
            
            # Inverse distance weighting for the 4 nearest neighbors
            weights = 1.0 / np.maximum(dists[0], 1e-6)
            weights /= np.sum(weights)
            
            ny, nx = grid_lons.shape
            unraveled_ij = [np.unravel_index(idx, (ny, nx)) for idx in idxs[0]]
            
            # Extract vertical profiles at nearest neighbor cells
            nz = da_3d.shape[0]
            val_profile = np.zeros(nz, dtype=np.float64)
            
            for w, (j, i) in zip(weights, unraveled_ij):
                val_profile += w * da_3d.values[:, j, i]
        else:
            # 1D Rectilinear interpolation
            interp_dict = {}
            if lat_key: interp_dict[lat_key] = lat
            if lon_key: interp_dict[lon_key] = lon
            point_da = da_3d.interp(interp_dict, method="linear")
            val_profile = point_da.values.flatten()

        # Compute physical depth levels (Standard vs Native ROMS s_rho)
        is_native_s = ("s_rho" in ds.dims or "s_rho" in ds.coords or "Cs_r" in ds)
        if is_native_s:
            if "s_rho" not in ds:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Missing s_rho coordinate in model dataset.")
            if "Cs_r" not in ds:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Missing Cs_r coordinate in model dataset.")
            if "hc" not in ds:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Missing hc parameter in model dataset.")
            if "Vtransform" not in ds:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Missing Vtransform parameter in model dataset.")
            if "h" not in ds:
                raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Missing bathymetry h in model dataset.")

            s_rho = ds["s_rho"].values
            Cs_r = ds["Cs_r"].values
            hc = float(ds["hc"].values)
            Vtransform = int(ds["Vtransform"].values)

            # Retrieve LOCAL bathymetry h(i, j) at requested (lat, lon)
            if is_curvilinear:
                h_arr = ds["h"].values
                h_val = 0.0
                for w, (j, i) in zip(weights, unraveled_ij):
                    h_val += w * float(h_arr[j, i])
            else:
                h_val = float(ds["h"].interp({lat_key: lat, lon_key: lon}, method="linear").values)

            # Retrieve LOCAL sea surface height zeta(i, j, time_idx) if available in dataset
            zeta_val = 0.0
            zeta_key = next((k for k in ["zeta", "ssh", "zo"] if k in ds or k in da_3d.coords), None)
            if zeta_key:
                try:
                    zeta_da = ds[zeta_key]
                    t_dim = next((k for k in ["time", "ocean_time", "time_counter"] if k in zeta_da.dims), None)
                    if t_dim and t_dim in zeta_da.dims:
                        valid_t_idx = min(max(0, time_idx), zeta_da.sizes[t_dim] - 1)
                        zeta_da = zeta_da.isel({t_dim: valid_t_idx})

                    if is_curvilinear:
                        z_arr = zeta_da.values
                        if z_arr.ndim == 3:
                            z_arr = z_arr[0]
                        zeta_val = 0.0
                        for w, (j, i) in zip(weights, unraveled_ij):
                            zeta_val += w * float(z_arr[j, i])
                    else:
                        zeta_val = float(zeta_da.interp({lat_key: lat, lon_key: lon}, method="linear").values)
                except Exception as e:
                    raise ValueError(f"MODEL_ZETA_INTERPOLATION_FAILED: Failed to extract sea surface height '{zeta_key}' at time index {time_idx} and location ({lat}, {lon}): {e}")

            z_levels = calculate_roms_vertical_depths(s_rho, Cs_r, h_val, hc, zeta=zeta_val, Vtransform=Vtransform)
            depth_levels = np.abs(z_levels.flatten())
        elif depth_key and depth_key in ds:
            depth_levels = np.abs(ds[depth_key].values.flatten())
        else:
            raise ValueError("MODEL_VERTICAL_COORDINATE_MISSING: Model dataset lacks vertical depth coordinates.")

        return depth_levels, val_profile

    def interpolate_profile_at_point(
        self,
        filename: str,
        variable: str,
        lat: float,
        lon: float,
        target_timestamp: Optional[str] = None,
        time_idx: int = 0,
        query_depths: Optional[List[float]] = None
    ) -> Optional[Tuple[List[float], List[Any]]]:
        """
        Performs genuine 4D spatio-temporal interpolation:
        1. Identifies surrounding model forecast timestamps (t0, t1) around target_timestamp
        2. Spatially interpolates across horizontal coordinates (curvilinear or rectilinear)
        3. Linearly blends across time with weighting factor alpha = (t_target - t0)/(t1 - t0)
        4. Vertically interpolates onto query_depths (meters positive downward)
        """
        filepath = self.get_model_dataset_path(filename)
        if not filepath:
            return None

        try:
            with xr.open_dataset(filepath) as ds:
                var_key = resolve_variable_name(ds, variable)
                if not var_key:
                    return None

                da = ds[var_key]
                time_key = next((k for k in ["time", "ocean_time", "time_counter"] if k in da.coords or k in da.dims), None)

                # 1. 4D Temporal Interpolation Handling
                if time_key and time_key in ds and target_timestamp is not None:
                    time_vals = pd.to_datetime(ds[time_key].values, utc=True)
                    target_dt = pd.to_datetime(target_timestamp, utc=True)

                    if target_dt <= time_vals[0]:
                        da_3d = da.isel({time_key: 0})
                        depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon, time_idx=0)
                    elif target_dt >= time_vals[-1]:
                        t_last = len(time_vals) - 1
                        da_3d = da.isel({time_key: t_last})
                        depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon, time_idx=t_last)
                    else:
                        # Find bounding indices t0, t1
                        t1_idx = int(np.searchsorted(time_vals, target_dt))
                        t0_idx = max(0, t1_idx - 1)
                        
                        t0 = time_vals[t0_idx]
                        t1 = time_vals[t1_idx]
                        
                        total_secs = (t1 - t0).total_seconds()
                        alpha = (target_dt - t0).total_seconds() / total_secs if total_secs > 0 else 0.0
                        alpha = float(np.clip(alpha, 0.0, 1.0))

                        # Extract profiles and depths at t0 and t1 using respective time_idx
                        d_0, v_0 = self._spatial_interpolate_profile(da.isel({time_key: t0_idx}), ds, lat, lon, time_idx=t0_idx)
                        d_1, v_1 = self._spatial_interpolate_profile(da.isel({time_key: t1_idx}), ds, lat, lon, time_idx=t1_idx)
                        
                        # 4D Linear temporal blending of both depths and values
                        depth_levels = (1.0 - alpha) * d_0 + alpha * d_1
                        model_values = (1.0 - alpha) * v_0 + alpha * v_1
                else:
                    # Fallback to integer time index
                    t_idx = min(max(0, time_idx), da.sizes["time"] - 1) if "time" in da.dims else 0
                    da_3d = da.isel(time=t_idx) if "time" in da.dims else da
                    depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon, time_idx=t_idx)

                # 2. Vertical Interpolation onto Argo Query Depths
                if query_depths is not None:
                    valid_idx = [i for i, v in enumerate(model_values) if not np.isnan(v)]
                    if len(valid_idx) == 0:
                        return None
                    clean_d = np.array([depth_levels[i] for i in valid_idx])
                    clean_v = np.array([model_values[i] for i in valid_idx])
                    
                    if len(clean_d) == 1:
                        # Single vertical level available in model (e.g. surface layer)
                        # Match depths within 15m tolerance of surface level, otherwise evaluate to NaN
                        interp_v = np.array([clean_v[0] if abs(qd - clean_d[0]) <= 15.0 else np.nan for qd in query_depths])
                    else:
                        # Multi-level vertical interpolation without out-of-bounds extrapolation
                        sort_order = np.argsort(clean_d)
                        clean_d = clean_d[sort_order]
                        clean_v = clean_v[sort_order]
                        interp_v = np.interp(query_depths, clean_d, clean_v, left=np.nan, right=np.nan)

                    return query_depths, [float(round(v, 3)) if not np.isnan(v) else None for v in interp_v]

                return depth_levels.tolist(), [float(round(v, 3)) if not np.isnan(v) else None for v in model_values]

        except Exception as e:
            print(f"Error in 4D spatio-temporal profile interpolation: {e}")
            return None

xarray_service = XarrayDataService()

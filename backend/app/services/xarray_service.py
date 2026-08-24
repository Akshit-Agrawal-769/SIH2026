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
        normalizes data to [0.0, 1.0] for WebGL2 Data3DTexture rendering,
        and returns the raw Float32 byte buffer along with scaling metadata.
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
                if "time" in da.dims:
                    t_len = da.sizes["time"]
                    da_3d = da.isel(time=min(max(0, time_idx), t_len - 1))
                else:
                    da_3d = da

                raw_data = da_3d.values.astype(np.float32)
                raw_data = np.nan_to_num(raw_data, nan=np.nan)

                # Reshape/Interpolate to target 3D texture shape (Z, Y, X)
                nx_tgt, ny_tgt, nz_tgt = target_shape[0], target_shape[1], target_shape[2]
                
                shape = raw_data.shape
                if len(shape) == 3:
                    nz_curr, ny_curr, nx_curr = shape
                    z_in = np.linspace(0, 1, nz_curr)
                    y_in = np.linspace(0, 1, ny_curr)
                    x_in = np.linspace(0, 1, nx_curr)
                    
                    if np.isnan(np.nanmean(raw_data)):
                        return None
                    mean_val = float(np.nanmean(raw_data))
                    interp = RegularGridInterpolator(
                        (z_in, y_in, x_in), raw_data, bounds_error=False, fill_value=mean_val
                    )
                    
                    z_out = np.linspace(0, 1, nz_tgt)
                    y_out = np.linspace(0, 1, ny_tgt)
                    x_out = np.linspace(0, 1, nx_tgt)
                    
                    grid_z, grid_y, grid_x = np.meshgrid(z_out, y_out, x_out, indexing="ij")
                    vol_interp = interp((grid_z, grid_y, grid_x)).astype(np.float32)
                else:
                    vol_interp = np.zeros((nz_tgt, ny_tgt, nx_tgt), dtype=np.float32)

                valid_mask = ~np.isnan(vol_interp)
                min_val = float(np.min(vol_interp[valid_mask])) if np.any(valid_mask) else 0.0
                max_val = float(np.max(vol_interp[valid_mask])) if np.any(valid_mask) else 1.0

                if max_val == min_val:
                    max_val += 1e-5

                # Normalize to [0.0, 1.0] for WebGL 3D texture rendering
                vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0).astype(np.float32)
                vol_norm = np.nan_to_num(vol_norm, nan=0.0)

                buffer = vol_norm.tobytes()

                metadata = {
                    "min_val": min_val,
                    "max_val": max_val,
                    "dim_x": nx_tgt,
                    "dim_y": ny_tgt,
                    "dim_z": nz_tgt,
                    "variable": variable,
                    "units": da.attrs.get("units", ""),
                    "long_name": da.attrs.get("long_name", variable),
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
        lon: float
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
        if depth_key and "s_rho" in depth_key and "Cs_r" in ds and "h" in ds:
            s_rho = ds["s_rho"].values if "s_rho" in ds else np.linspace(-1, 0, len(ds["Cs_r"]))
            Cs_r = ds["Cs_r"].values
            hc = float(ds["hc"].values) if "hc" in ds else 10.0
            
            # Retrieve LOCAL bathymetry h(i, j) at requested (lat, lon)
            if is_curvilinear:
                h_arr = ds["h"].values
                h_val = 0.0
                for w, (j, i) in zip(weights, unraveled_ij):
                    h_val += w * float(h_arr[j, i])
            else:
                h_val = float(ds["h"].interp({lat_key: lat, lon_key: lon}, method="linear").values)

            # Retrieve LOCAL sea surface height zeta(i, j, t) if available in dataset
            zeta_val = 0.0
            zeta_key = next((k for k in ["zeta", "ssh", "zo"] if k in ds or k in da_3d.coords), None)
            if zeta_key:
                try:
                    if is_curvilinear:
                        z_arr = ds[zeta_key].values
                        if z_arr.ndim == 3:
                            z_arr = z_arr[0]
                        zeta_val = 0.0
                        for w, (j, i) in zip(weights, unraveled_ij):
                            zeta_val += w * float(z_arr[j, i])
                    else:
                        zeta_da = ds[zeta_key]
                        if "time" in zeta_da.dims:
                            zeta_da = zeta_da.isel(time=0)
                        zeta_val = float(zeta_da.interp({lat_key: lat, lon_key: lon}, method="linear").values)
                except Exception:
                    zeta_val = 0.0

            Vtransform = int(ds["Vtransform"].values) if "Vtransform" in ds else 2
            
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
                        depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon)
                    elif target_dt >= time_vals[-1]:
                        da_3d = da.isel({time_key: len(time_vals) - 1})
                        depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon)
                    else:
                        # Find bounding indices t0, t1
                        t1_idx = int(np.searchsorted(time_vals, target_dt))
                        t0_idx = max(0, t1_idx - 1)
                        
                        t0 = time_vals[t0_idx]
                        t1 = time_vals[t1_idx]
                        
                        total_secs = (t1 - t0).total_seconds()
                        alpha = (target_dt - t0).total_seconds() / total_secs if total_secs > 0 else 0.0
                        alpha = float(np.clip(alpha, 0.0, 1.0))

                        # Extract profiles at t0 and t1
                        d_0, v_0 = self._spatial_interpolate_profile(da.isel({time_key: t0_idx}), ds, lat, lon)
                        d_1, v_1 = self._spatial_interpolate_profile(da.isel({time_key: t1_idx}), ds, lat, lon)
                        
                        depth_levels = d_0
                        # 4D Linear temporal blending
                        model_values = (1.0 - alpha) * v_0 + alpha * v_1
                else:
                    # Fallback to integer time index
                    t_idx = min(max(0, time_idx), da.sizes["time"] - 1) if "time" in da.dims else 0
                    da_3d = da.isel(time=t_idx) if "time" in da.dims else da
                    depth_levels, model_values = self._spatial_interpolate_profile(da_3d, ds, lat, lon)

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

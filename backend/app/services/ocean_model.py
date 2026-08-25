"""
Ocean Model Deep Module & In-Process Registry
Consolidates:
1. NetCDF dataset lifecycle, case-insensitive coordinate resolution, and dynamic variable aliasing.
2. Curvilinear (2D lon_rho/lat_rho) and rectilinear (1D lon/lat) spatial projection via spherical KD-Tree.
3. Terrain-following ROMS s-coordinate physical depth calculations with local bathymetry and time-aware zeta.
4. 4D spatio-temporal colocation across bounding forecast time steps (t0, t1).
5. 3D volumetric Float32 binary buffer generation with NaN sentinels for WebGL2 Data3DTexture rendering.
6. 2D depth slice buffer extraction.
7. Bounded in-memory LRU cache for memory safety and sub-millisecond response on repeated requests.
"""

import os
import glob
from collections import OrderedDict
from typing import List, Dict, Any, Optional, Tuple, Union
import numpy as np
import xarray as xr
import pandas as pd
from scipy.interpolate import RegularGridInterpolator
from scipy.spatial import cKDTree
from app.core.config import settings


class ModelVerticalCoordinateMissing(ValueError):
    """Raised when required terrain-following s-coordinate attributes are missing."""
    pass


class ModelZetaInterpolationFailed(ValueError):
    """Raised when time-aware sea surface height zeta cannot be interpolated."""
    pass


def geo_to_cartesian(lon_deg: np.ndarray, lat_deg: np.ndarray) -> np.ndarray:
    """Converts geographic degrees (lon, lat) to 3D Cartesian unit vectors for sphere KDTree."""
    lon_rad = np.radians(lon_deg)
    lat_rad = np.radians(lat_deg)
    x = np.cos(lat_rad) * np.cos(lon_rad)
    y = np.cos(lat_rad) * np.sin(lon_rad)
    z = np.sin(lat_rad)
    return np.column_stack((x.flatten(), y.flatten(), z.flatten()))


VAR_ALIASES = {
    "temp": ["temp", "to", "temperature", "TEMP", "thetao", "sst", "SST", "Sea_surface_temperature"],
    "salt": ["salt", "so", "salinity", "PSAL", "sss", "SSS", "Sea_surface_salinity"],
    "u": ["u", "ugo", "uo", "u_eastward"],
    "v": ["v", "vgo", "vo", "v_northward"],
    "w": ["w", "w_velocity"],
    "chl": ["chl", "chla", "chlorophyll", "CHLA", "CHL", "Sea_surface_chlorophyll_concentration"],
    "mld": ["mld", "mlotst", "MLD", "mixed_layer_depth", "Mixed_layer_depth"],
    "dic": ["dic", "DIC", "dissolved_inorganic_carbon", "Sea_surface_dissolved_inorganic_carbon"],
    "no3": ["no3", "NO3", "nitrate", "Sea_surface_nitrate_concentration"],
    "pco2": ["pco2", "pCO2", "pCO2_Original", "pCO2_Int", "pCO2_Clim", "Surface_partial_pressure_of_CO2"],
    "pco2_int": ["pCO2_Int"],
    "pco2_clim": ["pCO2_Clim"],
    "pco2_orig": ["pCO2_Original"],
    "deviant_uncertainty": ["Deviant_uncertainty", "uncertaintes_of_deviants"],
}


def calculate_roms_vertical_depths(
    s_rho: np.ndarray,
    Cs_r: np.ndarray,
    h: Union[float, np.ndarray],
    hc: float,
    zeta: Optional[Union[float, np.ndarray]] = None,
    Vtransform: int = 2
) -> np.ndarray:
    """
    Computes true physical vertical depths z (meters, negative below surface)
    for ROMS terrain-following vertical s-coordinates based on local bathymetry h
    and optional local sea surface height zeta.
    
    Vtransform = 1 (ROMS original):
        S(x,y,s) = hc * s + (h(x,y) - hc) * C(s)
        z(x,y,s,t) = S(x,y,s) + zeta(x,y,t) * (1 + S(x,y,s) / h(x,y))
        
    Vtransform = 2 (ROMS modern default):
        S(x,y,s) = (hc * s + h(x,y) * C(s)) / (hc + h(x,y))
        z(x,y,s,t) = zeta(x,y,t) + (zeta(x,y,t) + h(x,y)) * S(x,y,s)
    """
    h_arr = np.asarray(h, dtype=np.float64)
    s_arr = np.asarray(s_rho, dtype=np.float64)
    Cs_arr = np.asarray(Cs_r, dtype=np.float64)
    
    if zeta is None:
        zeta_arr = np.zeros_like(h_arr, dtype=np.float64)
    else:
        zeta_arr = np.asarray(zeta, dtype=np.float64)

    if h_arr.ndim == 0:
        s_3d, Cs_3d, h_3d, zeta_3d = s_arr, Cs_arr, h_arr, zeta_arr
    elif h_arr.ndim == 1:
        s_3d, Cs_3d, h_3d, zeta_3d = s_arr[:, None], Cs_arr[:, None], h_arr[None, :], zeta_arr[None, :]
    elif h_arr.ndim == 2:
        s_3d, Cs_3d, h_3d, zeta_3d = s_arr[:, None, None], Cs_arr[:, None, None], h_arr[None, :, :], zeta_arr[None, :, :]
    else:
        s_3d, Cs_3d, h_3d, zeta_3d = s_arr, Cs_arr, h_arr, zeta_arr

    if Vtransform == 1:
        S = hc * s_3d + (h_3d - hc) * Cs_3d
        z = S + zeta_3d * (1.0 + S / np.maximum(h_3d, 1e-4))
    else:  # Vtransform = 2
        S = (hc * s_3d + h_3d * Cs_3d) / (hc + h_3d)
        z = zeta_3d + (zeta_3d + h_3d) * S

    return z.astype(np.float32)


class OceanModel:
    """Deep module representing an ocean numerical model dataset with encapsulated spatial and vertical projection."""

    def __init__(self, dataset_or_path: Union[str, xr.Dataset]):
        if isinstance(dataset_or_path, str):
            self.file_path = dataset_or_path
            # Open lazily without decoding all variables into memory
            self._ds = xr.open_dataset(dataset_or_path, decode_times=True)
            self._owns_dataset = True
        else:
            self.file_path = None
            self._ds = dataset_or_path
            self._owns_dataset = False

        self._kd_tree = None
        self._kd_shape = None
        self._volume_cache: OrderedDict[Tuple, Tuple[bytes, Dict[str, Any]]] = OrderedDict()
        self._max_cache_size = 32
        self._init_coordinates()

    def _init_coordinates(self):
        ds = self._ds
        # Search coords, data_vars, and sizes with case-insensitive matching
        all_keys = list(ds.coords.keys()) + list(ds.data_vars.keys()) + list(ds.sizes.keys())

        def find_coord(candidates: List[str]) -> Optional[str]:
            for c in candidates:
                for k in all_keys:
                    if str(k).lower() == c.lower():
                        return str(k)
            return None

        self.lon_key = find_coord(["lon", "longitude", "lon_rho", "x", "nav_lon"])
        self.lat_key = find_coord(["lat", "latitude", "lat_rho", "y", "nav_lat"])
        self.depth_key = find_coord(["depth", "s_rho", "lev", "level", "z", "deptht"])
        self.time_key = find_coord(["time", "ocean_time", "time_counter", "date"])

        self.is_curvilinear = False
        if self.lon_key and self.lat_key and self.lon_key in ds and ds[self.lon_key].ndim == 2:
            self.is_curvilinear = True

        self.is_native_s = ("s_rho" in ds.dims or "s_rho" in ds.coords or "Cs_r" in ds)

    def _get_or_build_kdtree(self) -> Tuple[cKDTree, Tuple[int, int]]:
        if self._kd_tree is None:
            if not self.is_curvilinear:
                raise ValueError("KDTree only applicable for 2D curvilinear grids.")
            grid_lons = self._ds[self.lon_key].values
            grid_lats = self._ds[self.lat_key].values
            cart_grid = geo_to_cartesian(grid_lons, grid_lats)
            self._kd_tree = cKDTree(cart_grid)
            self._kd_shape = grid_lons.shape
        return self._kd_tree, self._kd_shape

    def resolve_variable_name(self, var_name: str) -> Optional[str]:
        if var_name in self._ds:
            return var_name
        for alias in VAR_ALIASES.get(var_name.lower(), []):
            if alias in self._ds:
                return alias
        for ds_var in self._ds.data_vars:
            if str(ds_var).lower() == var_name.lower():
                return str(ds_var)
        return None

    def get_metadata(self) -> Dict[str, Any]:
        ds = self._ds
        if not self.lon_key or not self.lat_key:
            raise ValueError("MODEL_SPATIAL_COORDINATE_MISSING: Model NetCDF lacks spatial coordinates (longitude/latitude).")

        lon_vals = ds[self.lon_key].values if self.lon_key in ds else np.array([0.0, 1.0])
        lat_vals = ds[self.lat_key].values if self.lat_key in ds else np.array([0.0, 1.0])

        bounds = {
            "min_lon": float(np.nanmin(lon_vals)),
            "max_lon": float(np.nanmax(lon_vals)),
            "min_lat": float(np.nanmin(lat_vals)),
            "max_lat": float(np.nanmax(lat_vals)),
        }

        depth_levels: List[float] = []
        if self.is_native_s:
            if "s_rho" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing s_rho coordinate in model dataset.")
            if "Cs_r" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing Cs_r coordinate in model dataset.")
            if "hc" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing hc parameter in model dataset.")
            if "Vtransform" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing Vtransform parameter in model dataset.")
            if "h" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing bathymetry h in model dataset.")

            s_rho = ds["s_rho"].values
            Cs_r = ds["Cs_r"].values
            hc = float(ds["hc"].values)
            Vtransform = int(ds["Vtransform"].values)
            h_ref = float(np.nanmean(ds["h"].values))
            z_levels = calculate_roms_vertical_depths(s_rho, Cs_r, h_ref, hc, zeta=0.0, Vtransform=Vtransform)
            depth_levels = sorted([abs(float(round(z, 2))) for z in z_levels.flatten()])
        elif self.depth_key and self.depth_key in ds:
            raw_depths = ds[self.depth_key].values.flatten()
            depth_levels = sorted([abs(float(round(d, 2))) for d in raw_depths if not np.isnan(d)])
        else:
            # 2D surface ocean models default to 0.0m surface level
            depth_levels = [0.0]

        times_iso: List[str] = []
        if self.time_key and self.time_key in ds:
            time_vals = pd.to_datetime(ds[self.time_key].values, utc=True)
            times_iso = [t.strftime("%Y-%m-%dT%H:%M:%SZ") for t in time_vals]

        # Dynamically discover all variables without dropping any
        variables_found = []
        seen = set()
        for canonical in VAR_ALIASES:
            resolved = self.resolve_variable_name(canonical)
            if resolved and resolved not in seen:
                variables_found.append(canonical)
                seen.add(resolved)

        for var_name in ds.data_vars:
            str_name = str(var_name)
            if str_name not in seen and str_name not in [self.lon_key, self.lat_key, self.depth_key, self.time_key]:
                variables_found.append(str_name)
                seen.add(str_name)

        dim_dict = {str(k): int(v) for k, v in ds.sizes.items()}

        var_info = {}
        for var in variables_found:
            actual_key = self.resolve_variable_name(var) or var
            if actual_key in ds:
                da = ds[actual_key]
                var_info[var] = {
                    "raw_name": actual_key,
                    "units": str(da.attrs.get("units", "")),
                    "long_name": str(da.attrs.get("long_name", var)),
                    "standard_name": str(da.attrs.get("standard_name", var)),
                    "shape": list(da.shape),
                    "dtype": str(da.dtype),
                }

        filename = os.path.basename(self.file_path) if self.file_path else "in_memory_dataset"

        return {
            "id": filename.replace(".nc", ""),
            "filename": filename,
            "title": str(ds.attrs.get("title", f"Ocean Model ({filename})")),
            "source": str(ds.attrs.get("source", ds.attrs.get("institute", "Ocean Numerical Model"))),
            "dimensions": dim_dict,
            "bounds": bounds,
            "depth_levels": depth_levels,
            "time_steps": times_iso,
            "time_range": times_iso,
            "variables": variables_found,
            "variable_info": var_info,
            "grid_type": "curvilinear_2d" if self.is_curvilinear else "rectilinear_1d",
            "is_native_s_coord": self.is_native_s,
        }

    def _spatial_interpolate_profile_at_point(
        self,
        da_3d: xr.DataArray,
        lat: float,
        lon: float,
        time_idx: int = 0
    ) -> Tuple[np.ndarray, np.ndarray]:
        ds = self._ds

        if not self.lon_key or not self.lat_key:
            raise ValueError("MODEL_SPATIAL_COORDINATE_MISSING: Model NetCDF lacks spatial coordinates (longitude/latitude).")

        if self.is_curvilinear:
            tree, shape = self._get_or_build_kdtree()
            cart_pt = geo_to_cartesian(np.array([lon]), np.array([lat]))
            dists, idxs = tree.query(cart_pt, k=4)

            weights = 1.0 / np.maximum(dists[0], 1e-6)
            weights /= np.sum(weights)

            ny, nx = shape
            unraveled_ij = [np.unravel_index(idx, (ny, nx)) for idx in idxs[0]]

            nz = da_3d.shape[0] if da_3d.ndim == 3 else 1
            val_profile = np.zeros(nz, dtype=np.float64)

            for w, (j, i) in zip(weights, unraveled_ij):
                if da_3d.ndim == 3:
                    val_profile += w * da_3d.values[:, j, i]
                else:
                    val_profile += w * da_3d.values[j, i]
        else:
            interp_dict = {}
            if self.lat_key: interp_dict[self.lat_key] = lat
            if self.lon_key: interp_dict[self.lon_key] = lon
            point_da = da_3d.interp(interp_dict, method="linear")
            val_profile = point_da.values.flatten()

        # Compute physical depth levels (Standard vs Native ROMS s_rho vs Surface 2D)
        if self.is_native_s:
            if "s_rho" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing s_rho coordinate in model dataset.")
            if "Cs_r" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing Cs_r coordinate in model dataset.")
            if "hc" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing hc parameter in model dataset.")
            if "Vtransform" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing Vtransform parameter in model dataset.")
            if "h" not in ds:
                raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Missing bathymetry h in model dataset.")

            s_rho = ds["s_rho"].values
            Cs_r = ds["Cs_r"].values
            hc = float(ds["hc"].values)
            Vtransform = int(ds["Vtransform"].values)

            # Retrieve LOCAL bathymetry h(i, j)
            if self.is_curvilinear:
                h_arr = ds["h"].values
                h_val = 0.0
                for w, (j, i) in zip(weights, unraveled_ij):
                    h_val += w * float(h_arr[j, i])
            else:
                h_val = float(ds["h"].interp({self.lat_key: lat, self.lon_key: lon}, method="linear").values)

            # Retrieve LOCAL sea surface height zeta(i, j, time_idx) if available
            zeta_val = 0.0
            zeta_key = next((k for k in ["zeta", "ssh", "zo"] if k in ds or k in da_3d.coords), None)
            if zeta_key:
                try:
                    zeta_da = ds[zeta_key]
                    t_dim = next((k for k in ["time", "ocean_time", "time_counter", "TIME", "Time"] if k in zeta_da.dims), None)
                    if t_dim and t_dim in zeta_da.dims:
                        valid_t_idx = min(max(0, time_idx), zeta_da.sizes[t_dim] - 1)
                        zeta_da = zeta_da.isel({t_dim: valid_t_idx})

                    if self.is_curvilinear:
                        z_arr = zeta_da.values
                        if z_arr.ndim == 3:
                            z_arr = z_arr[0]
                        zeta_val = 0.0
                        for w, (j, i) in zip(weights, unraveled_ij):
                            zeta_val += w * float(z_arr[j, i])
                    else:
                        zeta_val = float(zeta_da.interp({self.lat_key: lat, self.lon_key: lon}, method="linear").values)
                except Exception as e:
                    raise ModelZetaInterpolationFailed(f"MODEL_ZETA_INTERPOLATION_FAILED: Failed to extract sea surface height '{zeta_key}' at time index {time_idx} and location ({lat}, {lon}): {e}")

            z_levels = calculate_roms_vertical_depths(s_rho, Cs_r, h_val, hc, zeta=zeta_val, Vtransform=Vtransform)
            depth_levels = np.abs(z_levels.flatten())
        elif self.depth_key and self.depth_key in ds:
            depth_levels = np.abs(ds[self.depth_key].values.flatten())
        elif "depth" in da_3d.dims or "depth" in da_3d.coords:
            depth_levels = np.abs(da_3d["depth"].values.flatten())
        elif "MLD" in ds or "mld" in ds or "mlotst" in ds:
            depth_levels = np.array([0.0])
        else:
            raise ModelVerticalCoordinateMissing("MODEL_VERTICAL_COORDINATE_MISSING: Model dataset lacks vertical depth coordinates.")

        return depth_levels, val_profile

    def sample_profile(
        self,
        variable: str,
        lat: float,
        lon: float,
        target_timestamp: Optional[str] = None,
        time_idx: int = 0,
        query_depths: Optional[List[float]] = None
    ) -> Optional[Tuple[List[float], List[Any]]]:
        """
        Performs 4D spatio-temporal profile interpolation at geographic point (lat, lon).
        Returns (depths, values).
        """
        var_key = self.resolve_variable_name(variable)
        if not var_key:
            return None

        ds = self._ds
        da = ds[var_key]
        time_key = next((k for k in ["time", "ocean_time", "time_counter", "TIME", "Time"] if k in da.coords or k in da.dims), None)

        # 1. Temporal Interpolation Handling
        if time_key and time_key in ds and target_timestamp is not None:
            time_vals = pd.to_datetime(ds[time_key].values, utc=True)
            target_dt = pd.to_datetime(target_timestamp, utc=True)

            if target_dt <= time_vals[0]:
                da_3d = da.isel({time_key: 0})
                depth_levels, model_values = self._spatial_interpolate_profile_at_point(da_3d, lat, lon, time_idx=0)
            elif target_dt >= time_vals[-1]:
                t_last = len(time_vals) - 1
                da_3d = da.isel({time_key: t_last})
                depth_levels, model_values = self._spatial_interpolate_profile_at_point(da_3d, lat, lon, time_idx=t_last)
            else:
                t1_idx = int(np.searchsorted(time_vals, target_dt))
                t0_idx = max(0, t1_idx - 1)

                t0 = time_vals[t0_idx]
                t1 = time_vals[t1_idx]

                total_secs = (t1 - t0).total_seconds()
                alpha = (target_dt - t0).total_seconds() / total_secs if total_secs > 0 else 0.0
                alpha = float(np.clip(alpha, 0.0, 1.0))

                d_0, v_0 = self._spatial_interpolate_profile_at_point(da.isel({time_key: t0_idx}), lat, lon, time_idx=t0_idx)
                d_1, v_1 = self._spatial_interpolate_profile_at_point(da.isel({time_key: t1_idx}), lat, lon, time_idx=t1_idx)

                depth_levels = (1.0 - alpha) * d_0 + alpha * d_1
                model_values = (1.0 - alpha) * v_0 + alpha * v_1
        else:
            t_dim = time_key or "time"
            t_idx = min(max(0, time_idx), da.sizes[t_dim] - 1) if t_dim in da.dims else 0
            da_3d = da.isel({t_dim: t_idx}) if t_dim in da.dims else da
            depth_levels, model_values = self._spatial_interpolate_profile_at_point(da_3d, lat, lon, time_idx=t_idx)

        # 2. Vertical Interpolation onto Query Depths
        if query_depths is not None:
            valid_idx = [i for i, v in enumerate(model_values) if not np.isnan(v)]
            if len(valid_idx) == 0:
                return None
            clean_d = np.array([depth_levels[i] for i in valid_idx])
            clean_v = np.array([model_values[i] for i in valid_idx])

            if len(clean_d) == 1:
                # Surface point - return for upper queries or within tolerance
                interp_v = np.array([clean_v[0] if qd <= 50.0 else np.nan for qd in query_depths])
            else:
                sort_order = np.argsort(clean_d)
                clean_d = clean_d[sort_order]
                clean_v = clean_v[sort_order]
                interp_v = np.interp(query_depths, clean_d, clean_v, left=np.nan, right=np.nan)

            return query_depths, [float(round(v, 3)) if not np.isnan(v) else None for v in interp_v]

        return depth_levels.tolist(), [float(round(v, 3)) if not np.isnan(v) else None for v in model_values]

    def extract_volume_buffer(
        self,
        variable: str = "temp",
        time_idx: int = 0,
        target_shape: Tuple[int, int, int] = (64, 64, 32),
        spatial_bounds: Optional[Dict[str, float]] = None,
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        """
        Extracts 3D volumetric array lazily without loading the full dataset into memory.
        Regularizes to target_shape (dim_x, dim_y, dim_z), normalizes data to [0.0, 1.0]
        for WebGL2 Data3DTexture (with -1.0 for NaN cells), and returns Float32 byte buffer
        along with physical coordinate metadata.
        """
        cache_key = (variable, time_idx, target_shape, tuple(sorted(spatial_bounds.items())) if spatial_bounds else None)
        if cache_key in self._volume_cache:
            self._volume_cache.move_to_end(cache_key)
            return self._volume_cache[cache_key]

        ds = self._ds
        var_key = self.resolve_variable_name(variable)
        if not var_key:
            return None

        da = ds[var_key]

        # 1. Lazy time dimension selection (avoids decompressing all time chunks)
        t_dim = next((k for k in ["time", "ocean_time", "time_counter", "TIME", "Time"] if k in da.dims), None)
        if t_dim and t_dim in da.dims:
            t_len = da.sizes[t_dim]
            valid_time_idx = min(max(0, time_idx), t_len - 1)
            da_sub = da.isel({t_dim: valid_time_idx})
        else:
            valid_time_idx = 0
            da_sub = da

        # 2. Optional Spatial Subsetting before materialization
        if spatial_bounds and self.lat_key in da_sub.dims and self.lon_key in da_sub.dims:
            min_lon = spatial_bounds.get("min_lon")
            max_lon = spatial_bounds.get("max_lon")
            min_lat = spatial_bounds.get("min_lat")
            max_lat = spatial_bounds.get("max_lat")
            
            lats = ds[self.lat_key].values
            lons = ds[self.lon_key].values
            lat_slice = slice(min_lat, max_lat) if lats[0] < lats[-1] else slice(max_lat, min_lat)
            lon_slice = slice(min_lon, max_lon) if lons[0] < lons[-1] else slice(max_lon, min_lon)
            da_sub = da_sub.sel({self.lat_key: lat_slice, self.lon_key: lon_slice})

        raw_data = da_sub.values.astype(np.float32)

        # Spatial Bounds
        min_lon = float(np.nanmin(ds[self.lon_key].values)) if self.lon_key else 0.0
        max_lon = float(np.nanmax(ds[self.lon_key].values)) if self.lon_key else 1.0
        min_lat = float(np.nanmin(ds[self.lat_key].values)) if self.lat_key else 0.0
        max_lat = float(np.nanmax(ds[self.lat_key].values)) if self.lat_key else 1.0

        # Physical Vertical Depth Bounds
        min_depth = 0.0
        max_depth = 2000.0
        if self.is_native_s and "s_rho" in ds and "Cs_r" in ds and "h" in ds and "hc" in ds and "Vtransform" in ds:
            s_rho = ds["s_rho"].values
            Cs_r = ds["Cs_r"].values
            hc = float(ds["hc"].values)
            Vtransform = int(ds["Vtransform"].values)
            h_max = float(np.nanmax(ds["h"].values))

            zeta_val = 0.0
            zeta_key = next((k for k in ["zeta", "ssh", "zo"] if k in ds or k in da_sub.coords), None)
            if zeta_key:
                try:
                    zeta_da = ds[zeta_key]
                    z_tdim = next((k for k in ["time", "ocean_time", "time_counter", "TIME", "Time"] if k in zeta_da.dims), None)
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
        elif self.depth_key and self.depth_key in ds:
            depth_vals = np.abs(ds[self.depth_key].values.flatten())
            min_depth = float(np.nanmin(depth_vals))
            max_depth = float(np.nanmax(depth_vals))
        elif "MLD" in ds:
            # For 2D surface datasets with MLD variable, use physical MLD scale
            try:
                mld_vals = ds["MLD"].isel(TIME=valid_time_idx).values
                max_depth = float(np.nanmax(mld_vals)) if np.any(~np.isnan(mld_vals)) else 200.0
            except Exception:
                max_depth = 200.0

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

            # Preserve NaNs accurately from the source grid
            nan_interp = RegularGridInterpolator(
                (z_in, y_in, x_in), np.isnan(raw_data).astype(np.float32), bounds_error=False, fill_value=1.0
            )
            nan_grid = nan_interp((grid_z, grid_y, grid_x)) > 0.5
            vol_interp[nan_grid] = np.nan

        elif len(shape) == 2:
            # 2D Surface fields (e.g. SST, SSS, CHL, MLD, pCO2)
            ny_curr, nx_curr = shape
            y_in = np.linspace(0, 1, ny_curr)
            x_in = np.linspace(0, 1, nx_curr)

            valid_raw = raw_data[~np.isnan(raw_data)]
            if len(valid_raw) == 0:
                return None
            fill_val = float(np.mean(valid_raw))

            interp_2d = RegularGridInterpolator(
                (y_in, x_in), raw_data, bounds_error=False, fill_value=fill_val
            )

            y_out = np.linspace(0, 1, ny_tgt)
            x_out = np.linspace(0, 1, nx_tgt)
            grid_y, grid_x = np.meshgrid(y_out, x_out, indexing="ij")
            slice_2d = interp_2d((grid_y, grid_x)).astype(np.float32)

            nan_interp_2d = RegularGridInterpolator(
                (y_in, x_in), np.isnan(raw_data).astype(np.float32), bounds_error=False, fill_value=1.0
            )
            nan_mask_2d = nan_interp_2d((grid_y, grid_x)) > 0.5
            slice_2d[nan_mask_2d] = np.nan

            # Extrude 2D surface field along vertical dimension (Z, Y, X)
            vol_interp = np.repeat(slice_2d[np.newaxis, :, :], nz_tgt, axis=0)

        else:
            vol_interp = np.zeros((nz_tgt, ny_tgt, nx_tgt), dtype=np.float32)

        nan_mask = np.isnan(vol_interp)
        has_nan = bool(np.any(nan_mask))
        valid_mask = ~nan_mask

        min_val = float(np.min(vol_interp[valid_mask])) if np.any(valid_mask) else 0.0
        max_val = float(np.max(vol_interp[valid_mask])) if np.any(valid_mask) else 1.0

        if max_val == min_val:
            max_val += 1e-5

        vol_norm = np.clip((vol_interp - min_val) / (max_val - min_val), 0.0, 1.0).astype(np.float32)
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

        result = (buffer, metadata)

        # Update bounded LRU cache
        if len(self._volume_cache) >= self._max_cache_size:
            self._volume_cache.popitem(last=False)
        self._volume_cache[cache_key] = result

        return result

    def extract_slice_buffer(
        self,
        variable: str,
        time_idx: int = 0,
        depth_idx: int = 0
    ) -> Optional[Tuple[bytes, Dict[str, Any]]]:
        ds = self._ds
        var_key = self.resolve_variable_name(variable)
        if not var_key:
            return None

        da = ds[var_key]
        isel_dict = {}
        t_dim = next((k for k in ["time", "ocean_time", "time_counter", "TIME", "Time"] if k in da.dims), None)
        if t_dim:
            isel_dict[t_dim] = min(max(0, time_idx), da.sizes[t_dim] - 1)
        if "depth" in da.dims:
            isel_dict["depth"] = min(max(0, depth_idx), da.sizes["depth"] - 1)
        elif "s_rho" in da.dims:
            isel_dict["s_rho"] = min(max(0, depth_idx), da.sizes["s_rho"] - 1)

        slice_data = da.isel(**isel_dict).values
        slice_f32 = slice_data.astype(np.float32)
        valid = slice_data[~np.isnan(slice_data)]
        min_val = float(np.min(valid)) if len(valid) > 0 else 0.0
        max_val = float(np.max(valid)) if len(valid) > 0 else 1.0

        meta = {
            "shape": list(slice_f32.shape),
            "min_val": min_val,
            "max_val": max_val,
            "variable": variable,
            "units": da.attrs.get("units", ""),
        }
        return slice_f32.tobytes(), meta


class OceanModelRegistry:
    """In-process registry managing access, path validation, and cached OceanModel instances."""

    def __init__(self, datasets_dir: Optional[str] = None):
        self.datasets_dir = datasets_dir or settings.DATASETS_DIR
        self._cache: Dict[str, OceanModel] = {}

    def list_available_models(self) -> List[str]:
        models = set()
        model_dir = os.path.join(self.datasets_dir, "model")
        if os.path.exists(model_dir):
            files = glob.glob(os.path.join(model_dir, "*.nc")) + glob.glob(os.path.join(model_dir, "*.nc4"))
            for f in files:
                models.add(os.path.basename(f))

        # Check configurable OCEAN_DATASET_PATH
        if settings.OCEAN_DATASET_PATH and os.path.exists(settings.OCEAN_DATASET_PATH):
            models.add(os.path.basename(settings.OCEAN_DATASET_PATH))

        # Check parent workspace / root dataset directory
        root_bio_nc = os.path.abspath(os.path.join(self.datasets_dir, "..", "INCOIS-BIO-ROMS.nc"))
        if os.path.exists(root_bio_nc):
            models.add(os.path.basename(root_bio_nc))

        return sorted(list(models))

    def get_model_path(self, filename: str) -> Optional[str]:
        safe_filename = os.path.basename(filename)
        if safe_filename != filename or ".." in filename:
            return None

        # 1. Check datasets/model/
        path1 = os.path.abspath(os.path.join(self.datasets_dir, "model", safe_filename))
        if os.path.exists(path1):
            return path1

        # 2. Check OCEAN_DATASET_PATH
        if settings.OCEAN_DATASET_PATH and os.path.basename(settings.OCEAN_DATASET_PATH) == safe_filename:
            if os.path.exists(settings.OCEAN_DATASET_PATH):
                return os.path.abspath(settings.OCEAN_DATASET_PATH)

        # 3. Check workspace root
        path3 = os.path.abspath(os.path.join(self.datasets_dir, "..", safe_filename))
        if os.path.exists(path3):
            return path3

        return None

    def get_model(self, filename: str) -> Optional[OceanModel]:
        path = self.get_model_path(filename)
        if not path:
            return None

        if path not in self._cache:
            self._cache[path] = OceanModel(path)

        return self._cache[path]


ocean_model_registry = OceanModelRegistry()

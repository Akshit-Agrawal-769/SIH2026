import pytest
import os
import struct
import numpy as np
import netCDF4 as nc
from datetime import datetime

@pytest.fixture(autouse=True)
def generate_synthetic_fixtures(monkeypatch):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fixtures_dir = os.path.join(base_dir, 'fixtures')
    
    tiles_dir = os.path.join(fixtures_dir, 'tiles')
    datasets_dir = os.path.join(fixtures_dir, 'datasets')
    
    os.makedirs(os.path.join(tiles_dir, 'temperature', '2024-06-01'), exist_ok=True)
    os.makedirs(os.path.join(datasets_dir, 'argo'), exist_ok=True)
    
    # 1. Generate Binary Tile
    tile_path = os.path.join(tiles_dir, 'temperature', '2024-06-01', '0.5.bin')
    if not os.path.exists(tile_path):
        width = 520
        height = 280
        # 32 byte header: 24 bytes packed + 8 bytes padding
        header = struct.pack('<4sHHHHHHff', b'INCO', 1, 1, width, height, 1, 1, 17.0, 32.0)
        header += b'\0' * 8
        
        cells = np.full(width * height, np.nan, dtype=np.float32)
        cells[:101278] = 26.0
        cells[0] = 17.0
        cells[1] = 32.0
        cells[103720] = 30.5
        
        with open(tile_path, 'wb') as f:
            f.write(header)
            f.write(cells.tobytes())

    # 2. Generate Argo NetCDF
    nc_path = os.path.join(datasets_dir, 'argo', 'incois_2902084_prof.nc')
    if not os.path.exists(nc_path):
        with nc.Dataset(nc_path, 'w', format='NETCDF4') as ds:
            ds.createDimension('N_PROF', 1)
            ds.createDimension('N_LEVELS', 1)
            ds.createDimension('STRING8', 8)
            
            juld = ds.createVariable('JULD', 'f8', ('N_PROF',))
            lat = ds.createVariable('LATITUDE', 'f4', ('N_PROF',))
            lon = ds.createVariable('LONGITUDE', 'f4', ('N_PROF',))
            cycle = ds.createVariable('CYCLE_NUMBER', 'i4', ('N_PROF',))
            
            pres = ds.createVariable('PRES', 'f4', ('N_PROF', 'N_LEVELS'))
            temp = ds.createVariable('TEMP', 'f4', ('N_PROF', 'N_LEVELS'))
            psal = ds.createVariable('PSAL', 'f4', ('N_PROF', 'N_LEVELS'))
            temp_qc = ds.createVariable('TEMP_QC', 'S1', ('N_PROF', 'N_LEVELS'))
            psal_qc = ds.createVariable('PSAL_QC', 'S1', ('N_PROF', 'N_LEVELS'))
            
            platform = ds.createVariable('PLATFORM_NUMBER', 'S1', ('N_PROF', 'STRING8'))
            
            juld[0] = (datetime(2024, 6, 1) - datetime(1950, 1, 1)).days
            lat[0] = 15.0
            lon[0] = 65.0
            cycle[0] = 1
            
            # fill platform number '2902084 '
            plat_str = b'2902084 '
            for i in range(8):
                platform[0, i] = plat_str[i:i+1]
            
            pres[0, 0] = 10.07
            temp[0, 0] = 28.5
            psal[0, 0] = 35.2
            
            temp_qc[0, 0] = b'1'
            psal_qc[0, 0] = b'1'

    monkeypatch.setenv('TILES_DIR', tiles_dir)
    monkeypatch.setenv('DATASETS_DIR', datasets_dir)
    monkeypatch.chdir(fixtures_dir)

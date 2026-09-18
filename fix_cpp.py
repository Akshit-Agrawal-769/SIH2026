import os
files = [
  '/home/hasney12/SIH2026/cpp_visualizer/src/query/query_interface.cpp',
  '/home/hasney12/SIH2026/cpp_visualizer/tests/test_data_integrity.cpp'
]
for f in files:
    if os.path.exists(f):
        with open(f, 'r') as file:
            c = file.read()
        new_c = c.replace('ROMSLoader', 'SurfaceBGCLoader').replace('roms_loader', 'surface_bgc_loader')
        with open(f, 'w') as file:
            file.write(new_c)
print("Done")

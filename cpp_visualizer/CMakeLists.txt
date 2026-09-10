cmake_minimum_required(VERSION 3.20)
project(OceanVisualizer 
    VERSION 1.0.0 
    DESCRIPTION "High-Performance NetCDF Ocean Data Pipeline & Graph Engine"
    LANGUAGES C CXX
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Setup module path
list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
include(CompilerWarnings)

# Find Dependencies
find_package(NetCDF REQUIRED)
find_package(Threads REQUIRED)

# Core Ocean Library
add_library(ocean_core STATIC
    src/common/audit_logger.cpp
    src/geo/teos10.cpp
    src/geo/enu_transform.cpp
    src/geo/spatial_filter.cpp
    src/io/netcdf_wrapper.cpp
    src/io/cmems_loader.cpp
    src/io/roms_loader.cpp
    src/io/argo_loader.cpp
    src/io/coriolis_loader.cpp
    src/data/volume_buffer.cpp
    src/data/point_cloud.cpp
    src/data/lod_decimator.cpp
    src/query/query_interface.cpp
    src/query/spatial_index.cpp
)

target_include_directories(ocean_core PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
    ${NetCDF_INCLUDE_DIRS}
)

target_link_libraries(ocean_core PUBLIC
    NetCDF::NetCDF
    Threads::Threads
)

set_target_compiler_warnings(ocean_core)

# Main Application Runner
add_executable(ocean_visualizer_pipeline
    apps/main_visualizer_pipeline.cpp
)
target_link_libraries(ocean_visualizer_pipeline PRIVATE ocean_core)
set_target_compiler_warnings(ocean_visualizer_pipeline)

# Diagnostic Inspection CLI
add_executable(inspect_datasets_cli
    tools/inspect_datasets.cpp
)
target_link_libraries(inspect_datasets_cli PRIVATE ocean_core)
set_target_compiler_warnings(inspect_datasets_cli)

# Coriolis Reconciliation Tool
add_executable(reconcile_coriolis
    tools/reconcile_coriolis.cpp
)
target_link_libraries(reconcile_coriolis PRIVATE ocean_core)
set_target_compiler_warnings(reconcile_coriolis)

# Test Suite Enablement
enable_testing()

set(TEST_NAMES
    TestTEOS10
    TestENUTransform
    TestQCFilter
    TestDuplicateResolver
    TestStrideLOD
    TestDataIntegrity
)

add_executable(test_teos10 tests/test_teos10.cpp)
target_link_libraries(test_teos10 PRIVATE ocean_core)
add_test(NAME TestTEOS10 COMMAND test_teos10)

add_executable(test_enu_transform tests/test_enu_transform.cpp)
target_link_libraries(test_enu_transform PRIVATE ocean_core)
add_test(NAME TestENUTransform COMMAND test_enu_transform)

add_executable(test_qc_filter tests/test_qc_filter.cpp)
target_link_libraries(test_qc_filter PRIVATE ocean_core)
add_test(NAME TestQCFilter COMMAND test_qc_filter)

add_executable(test_duplicate_resolver tests/test_duplicate_resolver.cpp)
target_link_libraries(test_duplicate_resolver PRIVATE ocean_core)
add_test(NAME TestDuplicateResolver COMMAND test_duplicate_resolver)

add_executable(test_stride_lod tests/test_stride_lod.cpp)
target_link_libraries(test_stride_lod PRIVATE ocean_core)
add_test(NAME TestStrideLOD COMMAND test_stride_lod)

add_executable(test_data_integrity tests/test_data_integrity.cpp)
target_link_libraries(test_data_integrity PRIVATE ocean_core)
add_test(NAME TestDataIntegrity COMMAND test_data_integrity)

foreach(t ${TEST_NAMES})
    set_tests_properties(${t} PROPERTIES
        WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/.."
        ENVIRONMENT "PATH=C:/msys64/ucrt64/bin;$ENV{PATH}"
    )
endforeach()

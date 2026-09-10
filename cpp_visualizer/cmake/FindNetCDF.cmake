# FindNetCDF.cmake - Modern CMake module for NetCDF C library
#[=======================================================================[.rst:
FindNetCDF
----------

Finds the NetCDF C library and include directories.

Result Variables
^^^^^^^^^^^^^^^^
``NetCDF_FOUND``
  True if NetCDF was found on the host machine.
``NetCDF_INCLUDE_DIRS``
  The include directory containing netcdf.h.
``NetCDF_LIBRARIES``
  The libraries needed to link against NetCDF.
``NetCDF_VERSION``
  The version of the NetCDF library found.

Imported Targets
^^^^^^^^^^^^^^^^
``NetCDF::NetCDF``
  Imported target linking the NetCDF C library.
#]=======================================================================]

find_path(NetCDF_INCLUDE_DIR
    NAMES netcdf.h
    PATHS
        "C:/msys64/ucrt64/include"
        "C:/msys64/mingw64/include"
        "/usr/include"
        "/usr/local/include"
        "/opt/homebrew/include"
    PATH_SUFFIXES netcdf
)

find_library(NetCDF_LIBRARY
    NAMES netcdf libnetcdf
    PATHS
        "C:/msys64/ucrt64/lib"
        "C:/msys64/mingw64/lib"
        "/usr/lib"
        "/usr/local/lib"
        "/opt/homebrew/lib"
)

if(NetCDF_INCLUDE_DIR AND EXISTS "${NetCDF_INCLUDE_DIR}/netcdf_meta.h")
    file(STRINGS "${NetCDF_INCLUDE_DIR}/netcdf_meta.h" _version_lines REGEX "#define[ \t]+NC_VERSION_(MAJOR|MINOR|PATCH|NOTE)")
    string(REGEX MATCH "NC_VERSION_MAJOR[ \t]+([0-9]+)" _ "${_version_lines}")
    set(_major "${CMAKE_MATCH_1}")
    string(REGEX MATCH "NC_VERSION_MINOR[ \t]+([0-9]+)" _ "${_version_lines}")
    set(_minor "${CMAKE_MATCH_1}")
    string(REGEX MATCH "NC_VERSION_PATCH[ \t]+([0-9]+)" _ "${_version_lines}")
    set(_patch "${CMAKE_MATCH_1}")
    set(NetCDF_VERSION "${_major}.${_minor}.${_patch}")
endif()

include(FindPackageHandleStandardArgs)
find_package_handle_standard_args(NetCDF
    REQUIRED_VARS NetCDF_LIBRARY NetCDF_INCLUDE_DIR
    VERSION_VAR NetCDF_VERSION
)

if(NetCDF_FOUND)
    set(NetCDF_INCLUDE_DIRS "${NetCDF_INCLUDE_DIR}")
    set(NetCDF_LIBRARIES "${NetCDF_LIBRARY}")
    if(NOT TARGET NetCDF::NetCDF)
        add_library(NetCDF::NetCDF UNKNOWN IMPORTED)
        set_target_properties(NetCDF::NetCDF PROPERTIES
            IMPORTED_LOCATION "${NetCDF_LIBRARY}"
            INTERFACE_INCLUDE_DIRECTORIES "${NetCDF_INCLUDE_DIR}"
        )
    endif()
endif()

mark_as_advanced(NetCDF_INCLUDE_DIR NetCDF_LIBRARY)

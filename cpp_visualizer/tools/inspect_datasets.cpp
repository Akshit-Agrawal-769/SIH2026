#include "ocean/io/netcdf_wrapper.hpp"
#include <iostream>
#include <vector>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "Usage: inspect_datasets_cli <path_to_netcdf_file>\n";
        return 1;
    }

    std::string path = argv[1];
    std::cout << "Inspecting NetCDF dataset: " << path << "\n";

    try {
        ocean::NetCDFFile file(path);

        std::vector<std::string> dims = {"time", "TIME", "depth", "latitude", "LAT", "longitude", "LON", "N_PROF", "N_LEVELS"};
        std::cout << "--- Dimensions Detected ---\n";
        for (const auto& d : dims) {
            if (file.has_dim(d)) {
                std::cout << "  " << d << ": " << file.get_dim_len(d) << "\n";
            }
        }

        std::vector<std::string> vars = {
            "to", "so", "zo", "ugo", "vgo", "mlotst",
            "SST", "SSS", "MLD", "CHL", "NO3", "DIC",
            "pCO2_Original", "pCO2_Int", "pCO2_Clim", "Deviant_uncertainty",
            "TEMP", "PSAL", "PRES", "LATITUDE", "LONGITUDE"
        };

        std::cout << "\n--- Variables Detected ---\n";
        for (const auto& v : vars) {
            if (file.has_var(v)) {
                std::cout << "  " << v << " (present)\n";
            }
        }

    } catch (const std::exception& ex) {
        std::cerr << "Error inspecting file: " << ex.what() << "\n";
        return 1;
    }

    return 0;
}

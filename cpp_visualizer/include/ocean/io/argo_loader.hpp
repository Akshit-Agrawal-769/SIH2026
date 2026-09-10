#pragma once

#include "ocean/common/types.hpp"
#include "ocean/geo/enu_transform.hpp"
#include "ocean/io/netcdf_wrapper.hpp"
#include <string>
#include <vector>
#include <unordered_set>

namespace ocean {

/**
 * @brief Profile identity key for duplicate resolution and tracking.
 */
struct ProfileKey {
    std::string platform_wmo;
    int32_t cycle_number{0};
    char direction{'A'};

    bool operator==(const ProfileKey& other) const noexcept {
        return (cycle_number == other.cycle_number &&
                direction == other.direction &&
                platform_wmo == other.platform_wmo);
    }
};

struct ProfileKeyHash {
    size_t operator()(const ProfileKey& k) const noexcept {
        size_t h1 = std::hash<std::string>{}(k.platform_wmo);
        size_t h2 = std::hash<int32_t>{}(k.cycle_number);
        size_t h3 = std::hash<char>{}(k.direction);
        return h1 ^ (h2 << 1) ^ (h3 << 2);
    }
};

/**
 * @brief Streaming loader for Argo multi-profile NetCDF files.
 */
class ArgoLoader {
public:
    explicit ArgoLoader(const ENUTransformer& transformer);

    /**
     * @brief Stream profiles from an Argo NetCDF file.
     * @param filepath Path to Argo NetCDF file
     * @param target_var Variable to extract (TEMP or PSAL)
     * @param existing_keys Profile keys already ingested (e.g. from Coriolis) to avoid duplicates
     * @param[out] out_points Ingested points in local ENU frame
     * @param stride_level Integer stride decimation along the vertical column (>= 1)
     */
    size_t stream_file(
        const std::string& filepath,
        CanonicalVar target_var,
        const std::unordered_set<ProfileKey, ProfileKeyHash>& existing_keys,
        std::vector<ObservationPoint>& out_points,
        uint32_t stride_level = 1
    );

private:
    const ENUTransformer& transformer_;
};

} // namespace ocean

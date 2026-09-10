#pragma once

#include "ocean/common/types.hpp"
#include "ocean/geo/enu_transform.hpp"
#include "ocean/io/argo_loader.hpp"
#include <string>
#include <vector>
#include <unordered_set>

namespace ocean {

struct CoriolisStats {
    size_t files_attempted{0};
    size_t files_failed_open{0};
    size_t files_zero_accepted_points{0};
    size_t files_successfully_ingested{0};
    size_t points_ingested{0};
};

/**
 * @brief Streaming loader for Coriolis profile files with duplicate registration.
 */
class CoriolisLoader {
public:
    explicit CoriolisLoader(const ENUTransformer& transformer);

    /**
     * @brief Stream a Coriolis profile file.
     * Registers the profile key in ingested_keys to ensure Coriolis preference.
     */
    size_t stream_file(
        const std::string& filepath,
        CanonicalVar target_var,
        std::unordered_set<ProfileKey, ProfileKeyHash>& ingested_keys,
        std::vector<ObservationPoint>& out_points,
        uint32_t stride_level = 1
    );

    /**
     * @brief Walk datasets/coriolis platform directories and stream matching profiles.
     * Matches the path pattern datasets/coriolis/{platform}/profiles/{file}.nc
     * @param coriolis_root Path to Coriolis root (e.g., "datasets/coriolis")
     * @param target_var Canonical variable to extract (e.g., CanonicalVar::TEMP)
     * @param ingested_keys Set of registered keys (populated with Coriolis profiles)
     * @param out_points Output point cloud buffer
     * @param max_files Maximum number of files to process (0 = all matching files)
     * @param stride_level Vertical decimation stride (default: 1)
     */
    size_t stream_directory(
        const std::string& coriolis_root,
        CanonicalVar target_var,
        std::unordered_set<ProfileKey, ProfileKeyHash>& ingested_keys,
        std::vector<ObservationPoint>& out_points,
        size_t max_files = 0,
        uint32_t stride_level = 1
    );

    const CoriolisStats& stats() const noexcept { return stats_; }
    void reset_stats() noexcept { stats_ = CoriolisStats{}; }

private:
    const ENUTransformer& transformer_;
    CoriolisStats stats_;
};

} // namespace ocean

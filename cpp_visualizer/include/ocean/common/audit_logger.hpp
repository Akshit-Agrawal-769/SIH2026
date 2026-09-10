#pragma once

#include "ocean/common/types.hpp"
#include <string>
#include <fstream>
#include <mutex>
#include <memory>

namespace ocean {

/**
 * @brief Thread-safe audit logger recording every exclusion, QC rejection, and duplicate decision.
 */
class AuditLogger {
public:
    static AuditLogger& instance();

    void initialize(const std::string& log_filepath);
    void init(const std::string& log_filepath) { initialize(log_filepath); }
    void flush();
    void close();

    void log_exclusion(
        const std::string& file_path,
        CanonicalVar var,
        size_t profile_index,
        size_t level_index,
        ExclusionReason reason,
        const std::string& details
    );

    void log_duplicate(
        const std::string& argo_file,
        const std::string& coriolis_file,
        const std::string& platform_id,
        int32_t cycle,
        char direction,
        double juld
    );

    void log_decimation(
        const std::string& component,
        size_t raw_count,
        size_t decimated_count,
        uint32_t stride
    );

    size_t get_total_exclusions() const noexcept { return total_exclusions_; }
    size_t get_total_duplicates() const noexcept { return total_duplicates_; }

private:
    AuditLogger() = default;
    ~AuditLogger();

    std::ofstream out_;
    mutable std::mutex mutex_;
    size_t total_exclusions_{0};
    size_t total_duplicates_{0};
};

} // namespace ocean

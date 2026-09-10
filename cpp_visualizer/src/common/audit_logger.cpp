#include "ocean/common/audit_logger.hpp"
#include <iostream>
#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace ocean {

namespace {

std::string get_iso_timestamp() {
    auto now = std::chrono::system_clock::now();
    std::time_t tt = std::chrono::system_clock::to_time_t(now);
    std::tm tm_buf{};
#if defined(_WIN32)
    gmtime_s(&tm_buf, &tt);
#else
    gmtime_r(&tt, &tm_buf);
#endif
    std::ostringstream ss;
    ss << std::put_time(&tm_buf, "%Y-%m-%dT%H:%M:%SZ");
    return ss.str();
}

const char* reason_to_string(ExclusionReason r) noexcept {
    switch (r) {
        case ExclusionReason::OUT_OF_REGION_BOUNDS: return "OUT_OF_REGION_BOUNDS";
        case ExclusionReason::QC_FLAG_REJECTED: return "QC_FLAG_REJECTED";
        case ExclusionReason::DUPLICATE_SUPERSEDED: return "DUPLICATE_SUPERSEDED";
        case ExclusionReason::FILL_VALUE_MISSING: return "FILL_VALUE_MISSING";
        case ExclusionReason::CORRUPT_RECORD: return "CORRUPT_RECORD";
        default: return "NONE";
    }
}

const char* var_to_string(CanonicalVar v) noexcept {
    switch (v) {
        case CanonicalVar::TEMP: return "TEMP";
        case CanonicalVar::PSAL: return "PSAL";
        case CanonicalVar::MLD: return "MLD";
        case CanonicalVar::SSH: return "SSH";
        case CanonicalVar::UVEL: return "UVEL";
        case CanonicalVar::VVEL: return "VVEL";
        case CanonicalVar::CHL: return "CHL";
        case CanonicalVar::NO3: return "NO3";
        case CanonicalVar::DIC: return "DIC";
        case CanonicalVar::PCO2_ORIG: return "PCO2_ORIG";
        case CanonicalVar::PCO2_INT: return "PCO2_INT";
        case CanonicalVar::PCO2_CLIM: return "PCO2_CLIM";
        case CanonicalVar::PCO2_UNCERT: return "PCO2_UNCERT";
        case CanonicalVar::PRES: return "PRES";
    }
    return "UNKNOWN";
}

} // anonymous namespace

AuditLogger& AuditLogger::instance() {
    static AuditLogger inst;
    return inst;
}

AuditLogger::~AuditLogger() {
    close();
}

void AuditLogger::initialize(const std::string& log_filepath) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (out_.is_open()) {
        out_.close();
    }
    out_.open(log_filepath, std::ios::out | std::ios::app);
    if (!out_.is_open()) {
        std::cerr << "[AuditLogger] WARNING: Failed to open log file: " << log_filepath << std::endl;
    }
}

void AuditLogger::flush() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (out_.is_open()) {
        out_.flush();
    }
}

void AuditLogger::close() {
    std::lock_guard<std::mutex> lock(mutex_);
    if (out_.is_open()) {
        out_.flush();
        out_.close();
    }
}

void AuditLogger::log_exclusion(
    const std::string& file_path,
    CanonicalVar var,
    size_t profile_index,
    size_t level_index,
    ExclusionReason reason,
    const std::string& details
) {
    std::lock_guard<std::mutex> lock(mutex_);
    ++total_exclusions_;

    if (!out_.is_open()) return;

    out_ << "{\"timestamp\":\"" << get_iso_timestamp() << "\""
         << ",\"event\":\"EXCLUSION\""
         << ",\"file\":\"" << file_path << "\""
         << ",\"var\":\"" << var_to_string(var) << "\""
         << ",\"profile_idx\":" << profile_index
         << ",\"level_idx\":" << level_index
         << ",\"reason\":\"" << reason_to_string(reason) << "\""
         << ",\"details\":\"" << details << "\"}\n";
}

void AuditLogger::log_duplicate(
    const std::string& argo_file,
    const std::string& coriolis_file,
    const std::string& platform_id,
    int32_t cycle,
    char direction,
    double juld
) {
    std::lock_guard<std::mutex> lock(mutex_);
    ++total_duplicates_;
    ++total_exclusions_;

    if (!out_.is_open()) return;

    out_ << "{\"timestamp\":\"" << get_iso_timestamp() << "\""
         << ",\"event\":\"DUPLICATE_RESOLUTION\""
         << ",\"decision\":\"DUPLICATE_SUPERSEDED\""
         << ",\"reason\":\"DUPLICATE_SUPERSEDED\""
         << ",\"argo_file\":\"" << argo_file << "\""
         << ",\"coriolis_file\":\"" << coriolis_file << "\""
         << ",\"platform\":\"" << platform_id << "\""
         << ",\"cycle\":" << cycle
         << ",\"direction\":\"" << direction << "\""
         << ",\"juld\":" << std::setprecision(6) << std::fixed << juld << "}\n";
}

void AuditLogger::log_decimation(
    const std::string& component,
    size_t raw_count,
    size_t decimated_count,
    uint32_t stride
) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (!out_.is_open()) return;

    out_ << "{\"timestamp\":\"" << get_iso_timestamp() << "\""
         << ",\"event\":\"STRIDE_DECIMATION\""
         << ",\"component\":\"" << component << "\""
         << ",\"raw_samples\":" << raw_count
         << ",\"decimated_samples\":" << decimated_count
         << ",\"stride\":" << stride << "}\n";
}

} // namespace ocean

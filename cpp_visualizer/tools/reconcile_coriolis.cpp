#include "ocean/io/netcdf_wrapper.hpp"
#include "ocean/geo/spatial_filter.hpp"
#include "ocean/common/missing.hpp"
#include <iostream>
#include <iomanip>
#include <vector>
#include <string>
#include <unordered_set>
#include <unordered_map>
#include <filesystem>
#include <algorithm>
#if defined(_WIN32)
#include <windows.h>
#endif

namespace fs = std::filesystem;

inline bool is_qc_accepted(char qc) noexcept {
    return (qc == '1' || qc == '2');
}

std::string clean_string(const char* buf, size_t max_len) {
    size_t len = 0;
    while (len < max_len && buf[len] != '\0' && buf[len] != ' ') {
        ++len;
    }
    return std::string(buf, len);
}

struct ProfileKey {
    std::string wmo;
    int32_t cycle_number{0};
    char direction{'A'};

    bool operator==(const ProfileKey& o) const noexcept {
        return cycle_number == o.cycle_number && direction == o.direction && wmo == o.wmo;
    }
};

struct ProfileKeyHash {
    size_t operator()(const ProfileKey& k) const noexcept {
        size_t h1 = std::hash<std::string>{}(k.wmo);
        size_t h2 = std::hash<int32_t>{}(k.cycle_number);
        size_t h3 = std::hash<char>{}(k.direction);
        return h1 ^ (h2 << 1) ^ (h3 << 2);
    }
};

int main() {
    std::cout << "====================================================================\n";
    std::cout << "  CORIOLIS PROFILE INGESTION RECONCILIATION & AUDIT TOOL\n";
    std::cout << "====================================================================\n\n";

    std::string root_dir = "datasets/coriolis";
    if (!fs::exists(root_dir)) {
        std::cerr << "Directory not found: " << root_dir << "\n";
        return 1;
    }

    std::vector<std::string> files;
    for (const auto& plat_entry : fs::directory_iterator(root_dir)) {
        if (!plat_entry.is_directory()) continue;
        auto prof_dir = plat_entry.path() / "profiles";
        if (fs::exists(prof_dir) && fs::is_directory(prof_dir)) {
            for (const auto& fe : fs::directory_iterator(prof_dir)) {
                if (fe.is_regular_file() && fe.path().extension() == ".nc") {
                    files.push_back(fe.path().string());
                }
            }
        }
    }
    std::sort(files.begin(), files.end());
    std::cout << "Matched Coriolis files: " << files.size() << "\n\n";

    size_t total_profiles_evaluated = 0;
    size_t profiles_in_12904_ingested_files = 0;
    size_t profiles_in_6661_zero_files = 0;

    // Reconciliation categories across ALL files
    size_t all_out_of_region = 0;
    size_t all_bad_pos_or_juld_qc = 0;
    size_t all_dup_same_file = 0;
    size_t all_dup_earlier_file = 0;
    size_t all_no_valid_levels = 0;
    size_t all_accepted_registered = 0;

    // Breakdown specifically within the 12,904 files that had >= 1 point ingested:
    size_t ing_out_of_region = 0;
    size_t ing_bad_pos_or_juld_qc = 0;
    size_t ing_dup_same_file = 0;
    size_t ing_dup_earlier_file = 0;
    size_t ing_no_valid_levels = 0;
    size_t ing_accepted_registered = 0;

    // Breakdown specifically within the 6,661 zero-accepted files:
    size_t zero_out_of_region = 0;
    size_t zero_bad_pos_or_juld_qc = 0;
    size_t zero_dup_same_file = 0;
    size_t zero_dup_earlier_file = 0;
    size_t zero_no_valid_levels = 0;

    size_t count_files_ingested = 0;
    size_t count_files_zero = 0;
    size_t count_files_failed_open = 0;

    std::unordered_set<ProfileKey, ProfileKeyHash> ingested_keys;
    std::unordered_map<char, size_t> direction_counts;

    // Also inspect DIRECTION variable dimensions
    std::unordered_map<int, size_t> nprof_distribution;

    for (size_t idx = 0; idx < files.size(); ++idx) {
        const auto& filepath = files[idx];
        try {
            ocean::NetCDFFile file(filepath);
            if (!file.has_dim("N_PROF") || !file.has_dim("N_LEVELS")) {
                ++count_files_failed_open;
                continue;
            }

            const size_t n_prof = file.get_dim_len("N_PROF");
            const size_t n_levels = file.get_dim_len("N_LEVELS");
            nprof_distribution[static_cast<int>(n_prof)]++;

            if (n_prof == 0 || n_levels == 0) {
                ++count_files_zero;
                continue;
            }

            total_profiles_evaluated += n_prof;

            if (!file.has_var("PLATFORM_NUMBER") || !file.has_var("CYCLE_NUMBER") ||
                !file.has_var("JULD") || !file.has_var("JULD_QC") ||
                !file.has_var("LATITUDE") || !file.has_var("LONGITUDE") ||
                !file.has_var("POSITION_QC")) {
                ++count_files_failed_open;
                continue;
            }

            const int varid_pnum = file.get_var_id("PLATFORM_NUMBER");
            const int varid_cycle = file.get_var_id("CYCLE_NUMBER");
            const int varid_dir = file.has_var("DIRECTION") ? file.get_var_id("DIRECTION") : -1;
            const int varid_juld = file.get_var_id("JULD");
            const int varid_juld_qc = file.get_var_id("JULD_QC");
            const int varid_lat = file.get_var_id("LATITUDE");
            const int varid_lon = file.get_var_id("LONGITUDE");
            const int varid_pos_qc = file.get_var_id("POSITION_QC");

            std::vector<char> platform_chars(n_prof * 8);
            std::vector<int32_t> cycle_numbers(n_prof);
            std::vector<char> directions(n_prof, 'A');
            std::vector<double> juld_times(n_prof);
            std::vector<char> juld_qcs(n_prof);
            std::vector<double> latitudes(n_prof);
            std::vector<double> longitudes(n_prof);
            std::vector<char> pos_qcs(n_prof);

            nc_get_var_text(file.ncid(), varid_pnum, platform_chars.data());
            nc_get_var_int(file.ncid(), varid_cycle, cycle_numbers.data());
            if (varid_dir >= 0) {
                nc_get_var_text(file.ncid(), varid_dir, directions.data());
            }
            nc_get_var_double(file.ncid(), varid_juld, juld_times.data());
            nc_get_var_text(file.ncid(), varid_juld_qc, juld_qcs.data());
            nc_get_var_double(file.ncid(), varid_lat, latitudes.data());
            nc_get_var_double(file.ncid(), varid_lon, longitudes.data());
            nc_get_var_text(file.ncid(), varid_pos_qc, pos_qcs.data());

            // Check if ANY profile in file is in region
            bool any_in_region = false;
            for (size_t p = 0; p < n_prof; ++p) {
                if (ocean::SpatialFilter::is_in_region(latitudes[p], longitudes[p])) {
                    any_in_region = true;
                    break;
                }
            }

            if (!any_in_region) {
                // Entire file is out of region
                ++count_files_zero;
                profiles_in_6661_zero_files += n_prof;
                zero_out_of_region += n_prof;
                all_out_of_region += n_prof;
                continue;
            }

            // Variable identification
            const bool has_pres_adj = file.has_var("PRES_ADJUSTED") && file.has_var("PRES_ADJUSTED_QC");
            const bool has_pres_raw = file.has_var("PRES") && file.has_var("PRES_QC");
            const bool has_val_adj = file.has_var("TEMP_ADJUSTED") && file.has_var("TEMP_ADJUSTED_QC");
            const bool has_val_raw = file.has_var("TEMP") && file.has_var("TEMP_QC");

            const int varid_pres_adj = has_pres_adj ? file.get_var_id("PRES_ADJUSTED") : -1;
            const int varid_pres_adj_qc = has_pres_adj ? file.get_var_id("PRES_ADJUSTED_QC") : -1;
            const int varid_pres_raw = has_pres_raw ? file.get_var_id("PRES") : -1;
            const int varid_pres_raw_qc = has_pres_raw ? file.get_var_id("PRES_QC") : -1;

            const int varid_val_adj = has_val_adj ? file.get_var_id("TEMP_ADJUSTED") : -1;
            const int varid_val_adj_qc = has_val_adj ? file.get_var_id("TEMP_ADJUSTED_QC") : -1;
            const int varid_val_raw = has_val_raw ? file.get_var_id("TEMP") : -1;
            const int varid_val_raw_qc = has_val_raw ? file.get_var_id("TEMP_QC") : -1;

            std::vector<float> pres_buf(n_levels);
            std::vector<char> pres_qc_buf(n_levels);
            std::vector<float> val_buf(n_levels);
            std::vector<char> val_qc_buf(n_levels);

            size_t file_accepted_points = 0;
            std::unordered_set<ProfileKey, ProfileKeyHash> file_keys;

            // First pass: evaluate profiles for this file
            struct ProfileOutcome {
                enum Status { ACCEPTED, OUT_OF_REGION, BAD_QC, DUP_SAME_FILE, DUP_EARLIER, NO_VALID_LEVELS };
                Status status;
            };
            std::vector<ProfileOutcome> outcomes(n_prof);

            for (size_t p = 0; p < n_prof; ++p) {
                const std::string wmo = clean_string(&platform_chars[p * 8], 8);
                const int32_t cycle = cycle_numbers[p];
                const char dir = directions[p];
                direction_counts[dir]++;
                const double lat = latitudes[p];
                const double lon = longitudes[p];

                if (!is_qc_accepted(pos_qcs[p]) || !is_qc_accepted(juld_qcs[p])) {
                    outcomes[p].status = ProfileOutcome::BAD_QC;
                    continue;
                }

                if (!ocean::SpatialFilter::is_in_region(lat, lon)) {
                    outcomes[p].status = ProfileOutcome::OUT_OF_REGION;
                    continue;
                }

                ProfileKey key{wmo, cycle, dir};
                if (file_keys.find(key) != file_keys.end()) {
                    outcomes[p].status = ProfileOutcome::DUP_SAME_FILE;
                    continue;
                }
                if (ingested_keys.find(key) != ingested_keys.end()) {
                    outcomes[p].status = ProfileOutcome::DUP_EARLIER;
                    static int dup_earlier_print_count = 0;
                    if (dup_earlier_print_count++ < 10) {
                        std::cout << "DUP_EARLIER example: file=" << filepath << " p=" << p << " wmo=" << wmo << " cyc=" << cycle << " dir=" << dir << "\n";
                    }
                    continue;
                }

                // Check pressure and temp validity
                size_t start[2] = {p, 0};
                size_t count[2] = {1, n_levels};
                bool pres_ok = false;
                if (has_pres_adj) {
                    nc_get_vara_float(file.ncid(), varid_pres_adj, start, count, pres_buf.data());
                    nc_get_vara_text(file.ncid(), varid_pres_adj_qc, start, count, pres_qc_buf.data());
                    for (size_t i = 0; i < n_levels; ++i) {
                        if (!ocean::Missing::is_missing(pres_buf[i]) && is_qc_accepted(pres_qc_buf[i])) {
                            pres_ok = true; break;
                        }
                    }
                }
                if (!pres_ok && has_pres_raw) {
                    nc_get_vara_float(file.ncid(), varid_pres_raw, start, count, pres_buf.data());
                    nc_get_vara_text(file.ncid(), varid_pres_raw_qc, start, count, pres_qc_buf.data());
                    for (size_t i = 0; i < n_levels; ++i) {
                        if (!ocean::Missing::is_missing(pres_buf[i]) && is_qc_accepted(pres_qc_buf[i])) {
                            pres_ok = true; break;
                        }
                    }
                }

                bool val_ok = false;
                if (has_val_adj) {
                    nc_get_vara_float(file.ncid(), varid_val_adj, start, count, val_buf.data());
                    nc_get_vara_text(file.ncid(), varid_val_adj_qc, start, count, val_qc_buf.data());
                    for (size_t i = 0; i < n_levels; ++i) {
                        if (!ocean::Missing::is_missing(val_buf[i]) && is_qc_accepted(val_qc_buf[i])) {
                            val_ok = true; break;
                        }
                    }
                }
                if (!val_ok && has_val_raw) {
                    nc_get_vara_float(file.ncid(), varid_val_raw, start, count, val_buf.data());
                    nc_get_vara_text(file.ncid(), varid_val_raw_qc, start, count, val_qc_buf.data());
                    for (size_t i = 0; i < n_levels; ++i) {
                        if (!ocean::Missing::is_missing(val_buf[i]) && is_qc_accepted(val_qc_buf[i])) {
                            val_ok = true; break;
                        }
                    }
                }

                if (!pres_ok || !val_ok) {
                    outcomes[p].status = ProfileOutcome::NO_VALID_LEVELS;
                    continue;
                }

                // Accepted!
                outcomes[p].status = ProfileOutcome::ACCEPTED;
                file_keys.insert(key);
                ingested_keys.insert(key);
                file_accepted_points += 1; // mark that points were accepted
            }

            if (file_accepted_points > 0) {
                ++count_files_ingested;
                profiles_in_12904_ingested_files += n_prof;
                for (size_t p = 0; p < n_prof; ++p) {
                    switch (outcomes[p].status) {
                        case ProfileOutcome::ACCEPTED:
                            ++ing_accepted_registered;
                            ++all_accepted_registered;
                            break;
                        case ProfileOutcome::OUT_OF_REGION:
                            ++ing_out_of_region;
                            ++all_out_of_region;
                            break;
                        case ProfileOutcome::BAD_QC:
                            ++ing_bad_pos_or_juld_qc;
                            ++all_bad_pos_or_juld_qc;
                            break;
                        case ProfileOutcome::DUP_SAME_FILE:
                            ++ing_dup_same_file;
                            ++all_dup_same_file;
                            break;
                        case ProfileOutcome::DUP_EARLIER:
                            ++ing_dup_earlier_file;
                            ++all_dup_earlier_file;
                            break;
                        case ProfileOutcome::NO_VALID_LEVELS:
                            ++ing_no_valid_levels;
                            ++all_no_valid_levels;
                            break;
                    }
                }
            } else {
                ++count_files_zero;
                profiles_in_6661_zero_files += n_prof;
                for (size_t p = 0; p < n_prof; ++p) {
                    switch (outcomes[p].status) {
                        case ProfileOutcome::ACCEPTED:
                            break; // not reached
                        case ProfileOutcome::OUT_OF_REGION:
                            ++zero_out_of_region;
                            ++all_out_of_region;
                            break;
                        case ProfileOutcome::BAD_QC:
                            ++zero_bad_pos_or_juld_qc;
                            ++all_bad_pos_or_juld_qc;
                            break;
                        case ProfileOutcome::DUP_SAME_FILE:
                            ++zero_dup_same_file;
                            ++all_dup_same_file;
                            break;
                        case ProfileOutcome::DUP_EARLIER:
                            ++zero_dup_earlier_file;
                            ++all_dup_earlier_file;
                            break;
                        case ProfileOutcome::NO_VALID_LEVELS:
                            ++zero_no_valid_levels;
                            ++all_no_valid_levels;
                            break;
                    }
                }
            }

        } catch (const std::exception& ex) {
            ++count_files_failed_open;
        }
    }

    std::cout << "====================================================================\n";
    std::cout << "  RECONCILIATION SUMMARY REPORT\n";
    std::cout << "====================================================================\n\n";

    std::cout << "1. FILE LEVEL ACCOUNTING:\n";
    std::cout << "   Files attempted:                   " << files.size() << "\n";
    std::cout << "   Files failed open:                 " << count_files_failed_open << "\n";
    std::cout << "   Files zero accepted points:        " << count_files_zero << "\n";
    std::cout << "   Files successfully ingested:       " << count_files_ingested << "\n";
    std::cout << "   Sum (failed + zero + ingested):    " << count_files_failed_open + count_files_zero + count_files_ingested << "\n\n";

    std::cout << "2. TOTAL PROFILE COUNT ACROSS ENTIRE DATASET:\n";
    std::cout << "   Total profiles evaluated:          " << total_profiles_evaluated << "\n";
    std::cout << "   (Phase 1 baseline reference:       42,317 profiles)\n";
    std::cout << "   Profiles in ingested files:        " << profiles_in_12904_ingested_files << "\n";
    std::cout << "   Profiles in zero-accepted files:   " << profiles_in_6661_zero_files << "\n";
    std::cout << "   Sum of profiles (ing + zero):      " << profiles_in_12904_ingested_files + profiles_in_6661_zero_files << "\n\n";

    std::cout << "3. BREAKDOWN ACROSS THE 12,904 INGESTED FILES (" << profiles_in_12904_ingested_files << " profiles evaluated):\n";
    std::cout << "   - Profile keys accepted/registered: " << ing_accepted_registered << "\n";
    std::cout << "   - Rejected OUT_OF_REGION_BOUNDS:    " << ing_out_of_region << "\n";
    std::cout << "   - Rejected POSITION/JULD QC != 1,2: " << ing_bad_pos_or_juld_qc << "\n";
    std::cout << "   - Rejected DUPLICATE (same file):   " << ing_dup_same_file << "\n";
    std::cout << "   - Rejected DUPLICATE (earlier file):" << ing_dup_earlier_file << "\n";
    std::cout << "   - Rejected NO_VALID_LEVELS (fill):  " << ing_no_valid_levels << "\n";
    size_t ing_sum = ing_accepted_registered + ing_out_of_region + ing_bad_pos_or_juld_qc +
                     ing_dup_same_file + ing_dup_earlier_file + ing_no_valid_levels;
    std::cout << "   Sum across categories:              " << ing_sum 
              << " (match: " << (ing_sum == profiles_in_12904_ingested_files ? "EXACT" : "MISMATCH") << ")\n\n";

    std::cout << "4. BREAKDOWN ACROSS THE 6,661 ZERO-ACCEPTED FILES (" << profiles_in_6661_zero_files << " profiles evaluated):\n";
    std::cout << "   - Rejected OUT_OF_REGION_BOUNDS:    " << zero_out_of_region << "\n";
    std::cout << "   - Rejected POSITION/JULD QC != 1,2: " << zero_bad_pos_or_juld_qc << "\n";
    std::cout << "   - Rejected DUPLICATE (same file):   " << zero_dup_same_file << "\n";
    std::cout << "   - Rejected DUPLICATE (earlier file):" << zero_dup_earlier_file << "\n";
    std::cout << "   - Rejected NO_VALID_LEVELS (fill):  " << zero_no_valid_levels << "\n";
    size_t zero_sum = zero_out_of_region + zero_bad_pos_or_juld_qc + zero_dup_same_file + zero_dup_earlier_file + zero_no_valid_levels;
    std::cout << "   Sum across categories:              " << zero_sum
              << " (match: " << (zero_sum == profiles_in_6661_zero_files ? "EXACT" : "MISMATCH") << ")\n\n";

    std::cout << "5. COMPLETE DATASET RECONCILIATION:\n";
    std::cout << "   Accepted profile keys registered:  " << all_accepted_registered << "\n";
    std::cout << "   Total OUT_OF_REGION_BOUNDS:        " << all_out_of_region << "\n";
    std::cout << "   Total POSITION/JULD QC rejected:   " << all_bad_pos_or_juld_qc << "\n";
    std::cout << "   Total DUPLICATE (same file):       " << all_dup_same_file << "\n";
    std::cout << "   Total DUPLICATE (earlier file):    " << all_dup_earlier_file << "\n";
    std::cout << "   Total NO_VALID_LEVELS (all-fill):  " << all_no_valid_levels << "\n";
    size_t all_sum = all_accepted_registered + all_out_of_region + all_bad_pos_or_juld_qc +
                     all_dup_same_file + all_dup_earlier_file + all_no_valid_levels;
    std::cout << "   Grand Total Reconciled Profiles:   " << all_sum << " / " << total_profiles_evaluated
              << " (difference = " << static_cast<long long>(all_sum) - static_cast<long long>(total_profiles_evaluated) << ")\n\n";

    std::cout << "6. DIRECTION PARSING DIAGNOSTIC:\n";
    for (const auto& [d, count] : direction_counts) {
        std::cout << "   Direction '" << d << "': " << count << " profiles\n";
    }

    std::cout << "\n7. N_PROF DISTRIBUTION:\n";
    for (const auto& [np, count] : nprof_distribution) {
        std::cout << "   N_PROF = " << np << ": " << count << " files (" << np * count << " profiles)\n";
    }

    std::cout << "\n====================================================================\n";
    std::cout << "  RECONCILIATION RUN COMPLETE\n";
    std::cout << "====================================================================\n" << std::flush;

#if defined(_WIN32)
    TerminateProcess(GetCurrentProcess(), 0);
#else
    _Exit(0);
#endif
}

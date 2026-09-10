#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <optional>
#include <vector>

namespace ocean {

/**
 * @brief Canonical variables across gridded and in-situ observation streams.
 */
enum class CanonicalVar : uint8_t {
    TEMP = 0,       ///< Sea Water Temperature [°C] (SST in ROMS, to in CMEMS, TEMP in Argo)
    PSAL,           ///< Practical Salinity [PSU, PSS-78] (SSS in ROMS, so in CMEMS, PSAL in Argo)
    MLD,            ///< Ocean Mixed Layer Depth [m]
    SSH,            ///< Sea Surface Height above geoid [m] (zo in CMEMS)
    UVEL,           ///< Eastward Geostrophic Sea Water Velocity [m/s]
    VVEL,           ///< Northward Geostrophic Sea Water Velocity [m/s]
    CHL,            ///< Chlorophyll-a Concentration [kg/m³] (INCOIS-BIO-ROMS)
    NO3,            ///< Nitrate Concentration [mmol/m³] (INCOIS-BIO-ROMS)
    DIC,            ///< Dissolved Inorganic Carbon [mmol/m³] (INCOIS-BIO-ROMS)
    PCO2_ORIG,      ///< Surface Partial Pressure of CO2 [µatm] (Prognostic model simulation)
    PCO2_INT,       ///< Surface Partial Pressure of CO2 [µatm] (Interannual deviant assimilation)
    PCO2_CLIM,      ///< Surface Partial Pressure of CO2 [µatm] (Climatological deviant assimilation)
    PCO2_UNCERT,    ///< 1-sigma Uncertainty of Deviants [µatm] (Pairs with PCO2_INT and PCO2_CLIM)
    PRES            ///< Sea Water Pressure [dbar] (Raw vertical coordinate before TEOS-10 depth conversion)
};

/**
 * @brief QC flag schema according to UNESCO/Argo User's Manual 3.1.
 */
enum class QCFlag : char {
    NO_QC           = '0', ///< No quality control performed
    GOOD            = '1', ///< Good data (Accepted)
    PROBABLY_GOOD   = '2', ///< Probably good data (Accepted)
    PROBABLY_BAD    = '3', ///< Probably bad data (Rejected & Logged)
    BAD             = '4', ///< Bad data (Rejected & Logged)
    VALUE_CHANGED   = '5', ///< Value changed
    INTERPOLATED    = '8', ///< Synthesized/Interpolated (Strictly Rejected)
    MISSING         = '9', ///< Missing value (Rejected)
    FILL_PAD        = ' '  ///< Blank/Padding in ragged 2D profile array
};

/**
 * @brief Source dataset catalog identification.
 */
enum class DatasetSource : uint8_t {
    CMEMS_GRIDDED = 0,
    INCOIS_BIO_ROMS_SURFACE,
    ARGO_FLOAT_PROFILE,
    CORIOLIS_FLOAT_PROFILE
};

/**
 * @brief Audit logger exclusion/skip rationale.
 */
enum class ExclusionReason : uint8_t {
    NONE = 0,
    OUT_OF_REGION_BOUNDS,
    QC_FLAG_REJECTED,
    DUPLICATE_CORIOLIS_PREFERRED,
    DUPLICATE_SUPERSEDED = DUPLICATE_CORIOLIS_PREFERRED,
    FILL_VALUE_MISSING,
    CORRUPT_RECORD
};

/**
 * @brief 3D East-North-Up coordinate in local Cartesian tangent frame.
 */
struct ENUCoord {
    double east_m{0.0};
    double north_m{0.0};
    double up_m{0.0}; // Negative for depths below sea level
};

/**
 * @brief Geodetic coordinate on WGS84 ellipsoid.
 */
struct GeodeticCoord {
    double latitude_deg{0.0};
    double longitude_deg{0.0};
    double depth_m{0.0}; // Positive downwards or depth in meters
};

/**
 * @brief In-situ observation point in the local Cartesian frame.
 */
struct ObservationPoint {
    ENUCoord position;
    double timestamp_epoch_sec{0.0};
    float value{0.0f};
    float depth_m{0.0f}; // TEOS-10 physical depth below sea surface [m]
    CanonicalVar variable{CanonicalVar::TEMP};
    DatasetSource source{DatasetSource::ARGO_FLOAT_PROFILE};
    QCFlag qc{QCFlag::GOOD};
    std::string platform_id;
    int32_t cycle_number{0};
    size_t profile_index{0};
    size_t level_index{0};
};

/**
 * @brief Explicit pairing container for pCO2 queries.
 * 
 * IMPORTANT SCIENTIFIC DEFINITION:
 * - PCO2_ORIG is a direct numerical model calculation. It has NO deviant adjustment and
 *   therefore paired_uncertainty is always std::nullopt.
 * - PCO2_INT and PCO2_CLIM are reconstructed via deviant assimilation. Their uncertainty
 *   is defined by Deviant_uncertainty (PCO2_UNCERT). Therefore, paired_uncertainty
 *   is populated with the real 1-sigma uncertainty value read directly from Deviant_uncertainty.
 */
struct PCO2Measurement {
    float value{0.0f};
    CanonicalVar flavor{CanonicalVar::PCO2_ORIG};
    std::optional<float> deviant_uncertainty_1sigma{std::nullopt};
    double timestamp_epoch_sec{0.0};
};

} // namespace ocean

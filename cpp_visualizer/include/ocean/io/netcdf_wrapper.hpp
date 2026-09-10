#pragma once

#include <string>
#include <vector>
#include <stdexcept>
#include <netcdf.h>

namespace ocean {

class NetCDFException : public std::runtime_error {
public:
    NetCDFException(int status, const std::string& msg);
    int status() const noexcept { return status_; }
private:
    int status_;
};

/**
 * @brief RAII wrapper for NetCDF dataset handle (ncid).
 */
class NetCDFFile {
public:
    explicit NetCDFFile(const std::string& filepath, int omode = NC_NOWRITE);
    ~NetCDFFile();

    NetCDFFile(const NetCDFFile&) = delete;
    NetCDFFile& operator=(const NetCDFFile&) = delete;
    NetCDFFile(NetCDFFile&& other) noexcept;
    NetCDFFile& operator=(NetCDFFile&& other) noexcept;

    int ncid() const noexcept { return ncid_; }
    const std::string& filepath() const noexcept { return filepath_; }

    int get_var_id(const std::string& var_name) const;
    bool has_var(const std::string& var_name) const noexcept;
    int get_dim_id(const std::string& dim_name) const;
    bool has_dim(const std::string& dim_name) const noexcept;
    size_t get_dim_len(const std::string& dim_name) const;

    std::vector<float> read_var_1d_float(const std::string& var_name) const;
    std::vector<double> read_var_1d_double(const std::string& var_name) const;

    void read_hyperslab_float(
        int var_id,
        const size_t* start,
        const size_t* count,
        const ptrdiff_t* stride,
        float* out_buffer
    ) const;

    void read_hyperslab_double(
        int var_id,
        const size_t* start,
        const size_t* count,
        const ptrdiff_t* stride,
        double* out_buffer
    ) const;

private:
    std::string filepath_;
    int ncid_{-1};
};

} // namespace ocean

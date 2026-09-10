#include "ocean/io/netcdf_wrapper.hpp"
#include <sstream>

namespace ocean {

NetCDFException::NetCDFException(int status, const std::string& msg)
    : std::runtime_error(msg + ": " + nc_strerror(status)), status_(status) {}

NetCDFFile::NetCDFFile(const std::string& filepath, int omode)
    : filepath_(filepath) {
    int status = nc_open(filepath.c_str(), omode, &ncid_);
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed to open NetCDF file: " + filepath);
    }
}

NetCDFFile::~NetCDFFile() {
    if (ncid_ >= 0) {
        nc_close(ncid_);
        ncid_ = -1;
    }
}

NetCDFFile::NetCDFFile(NetCDFFile&& other) noexcept
    : filepath_(std::move(other.filepath_)), ncid_(other.ncid_) {
    other.ncid_ = -1;
}

NetCDFFile& NetCDFFile::operator=(NetCDFFile&& other) noexcept {
    if (this != &other) {
        if (ncid_ >= 0) {
            nc_close(ncid_);
        }
        filepath_ = std::move(other.filepath_);
        ncid_ = other.ncid_;
        other.ncid_ = -1;
    }
    return *this;
}

int NetCDFFile::get_var_id(const std::string& var_name) const {
    int varid = -1;
    int status = nc_inq_varid(ncid_, var_name.c_str(), &varid);
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Variable not found: " + var_name + " in " + filepath_);
    }
    return varid;
}

bool NetCDFFile::has_var(const std::string& var_name) const noexcept {
    int varid = -1;
    return (nc_inq_varid(ncid_, var_name.c_str(), &varid) == NC_NOERR);
}

int NetCDFFile::get_dim_id(const std::string& dim_name) const {
    int dimid = -1;
    int status = nc_inq_dimid(ncid_, dim_name.c_str(), &dimid);
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Dimension not found: " + dim_name + " in " + filepath_);
    }
    return dimid;
}

bool NetCDFFile::has_dim(const std::string& dim_name) const noexcept {
    int dimid = -1;
    return (nc_inq_dimid(ncid_, dim_name.c_str(), &dimid) == NC_NOERR);
}

size_t NetCDFFile::get_dim_len(const std::string& dim_name) const {
    int dimid = get_dim_id(dim_name);
    size_t len = 0;
    int status = nc_inq_dimlen(ncid_, dimid, &len);
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed to get dimension length: " + dim_name);
    }
    return len;
}

std::vector<float> NetCDFFile::read_var_1d_float(const std::string& var_name) const {
    int varid = get_var_id(var_name);
    int dimids[NC_MAX_VAR_DIMS];
    int ndims = 0;
    int status = nc_inq_varndims(ncid_, varid, &ndims);
    if (status != NC_NOERR || ndims != 1) {
        throw NetCDFException(status, "Expected 1D variable for: " + var_name);
    }
    nc_inq_vardimid(ncid_, varid, dimids);
    size_t len = 0;
    nc_inq_dimlen(ncid_, dimids[0], &len);

    std::vector<float> buffer(len);
    status = nc_get_var_float(ncid_, varid, buffer.data());
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed to read 1D float variable: " + var_name);
    }
    return buffer;
}

std::vector<double> NetCDFFile::read_var_1d_double(const std::string& var_name) const {
    int varid = get_var_id(var_name);
    int dimids[NC_MAX_VAR_DIMS];
    int ndims = 0;
    int status = nc_inq_varndims(ncid_, varid, &ndims);
    if (status != NC_NOERR || ndims != 1) {
        throw NetCDFException(status, "Expected 1D variable for: " + var_name);
    }
    nc_inq_vardimid(ncid_, varid, dimids);
    size_t len = 0;
    nc_inq_dimlen(ncid_, dimids[0], &len);

    std::vector<double> buffer(len);
    status = nc_get_var_double(ncid_, varid, buffer.data());
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed to read 1D double variable: " + var_name);
    }
    return buffer;
}

void NetCDFFile::read_hyperslab_float(
    int var_id,
    const size_t* start,
    const size_t* count,
    const ptrdiff_t* stride,
    float* out_buffer
) const {
    int status = 0;
    if (stride == nullptr) {
        status = nc_get_vara_float(ncid_, var_id, start, count, out_buffer);
    } else {
        status = nc_get_vars_float(ncid_, var_id, start, count, stride, out_buffer);
    }
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed hyperslab float read on file: " + filepath_);
    }
}

void NetCDFFile::read_hyperslab_double(
    int var_id,
    const size_t* start,
    const size_t* count,
    const ptrdiff_t* stride,
    double* out_buffer
) const {
    int status = 0;
    if (stride == nullptr) {
        status = nc_get_vara_double(ncid_, var_id, start, count, out_buffer);
    } else {
        status = nc_get_vars_double(ncid_, var_id, start, count, stride, out_buffer);
    }
    if (status != NC_NOERR) {
        throw NetCDFException(status, "Failed hyperslab double read on file: " + filepath_);
    }
}

} // namespace ocean

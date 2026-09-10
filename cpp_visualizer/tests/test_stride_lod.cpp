#include "ocean/data/lod_decimator.hpp"
#include <iostream>
#include <cassert>
#include <vector>

void test_point_cloud_stride() {
    std::vector<ocean::ObservationPoint> pts;
    pts.reserve(100);

    for (int i = 0; i < 100; ++i) {
        ocean::ObservationPoint p;
        p.value = static_cast<float>(i * 1.5);
        p.level_index = i;
        pts.push_back(p);
    }

    // Stride 1: Identity
    auto dec1 = ocean::LODDecimator::decimate_points_stride(pts, 1);
    assert(dec1.size() == 100);
    for (size_t i = 0; i < 100; ++i) {
        assert(dec1[i].value == pts[i].value);
        assert(dec1[i].level_index == pts[i].level_index);
    }

    // Stride 4: 25 points
    auto dec4 = ocean::LODDecimator::decimate_points_stride(pts, 4);
    assert(dec4.size() == 25);
    for (size_t i = 0; i < 25; ++i) {
        // Assert value is authentic and exactly equal to input[i*4]
        assert(dec4[i].value == pts[i * 4].value);
        assert(dec4[i].level_index == pts[i * 4].level_index);
    }

    std::cout << "[PASS] Point cloud stride decimation retains authentic raw points without interpolation\n";
}

void test_grid_stride() {
    const size_t width = 10;
    const size_t height = 8;
    std::vector<float> grid(width * height);

    for (size_t y = 0; y < height; ++y) {
        for (size_t x = 0; x < width; ++x) {
            grid[y * width + x] = static_cast<float>(y * 100 + x);
        }
    }

    size_t out_w = 0;
    size_t out_h = 0;
    auto dec_grid = ocean::LODDecimator::decimate_grid_stride(grid, width, height, 2, 2, out_w, out_h);

    assert(out_w == 5);
    assert(out_h == 4);
    assert(dec_grid.size() == 20);

    for (size_t y = 0; y < out_h; ++y) {
        for (size_t x = 0; x < out_w; ++x) {
            float original_val = grid[(y * 2) * width + (x * 2)];
            float decimated_val = dec_grid[y * out_w + x];
            // Assert exact value equivalence
            assert(decimated_val == original_val);
        }
    }

    std::cout << "[PASS] 2D grid stride decimation retains authentic raw cell values without smoothing\n";
}

int main() {
    std::cout << "--- Running LOD Decimator Test Suite ---\n";
    test_point_cloud_stride();
    test_grid_stride();
    std::cout << "All LOD Decimator tests PASSED successfully.\n";
    return 0;
}

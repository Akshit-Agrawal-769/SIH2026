"""
Natural Earth 10m Shapefile to GeoJSON Processor for Indian Ocean Domain.
Extracts authentic Natural Earth geometry without external dependencies.
"""
import struct
import json
import os
import shutil

def parse_shp_records(shp_path, target_bbox=None, is_polygon=False):
    """
    target_bbox: (min_lon, min_lat, max_lon, max_lat)
    """
    features = []
    with open(shp_path, 'rb') as f:
        # Read header (100 bytes)
        header = f.read(100)
        file_length_bytes = struct.unpack('>i', header[24:28])[0] * 2
        file_shape_type = struct.unpack('<i', header[32:36])[0]
        
        while f.tell() < file_length_bytes:
            rec_hdr = f.read(8)
            if not rec_hdr or len(rec_hdr) < 8:
                break
            rec_num, content_len_16 = struct.unpack('>ii', rec_hdr)
            content_bytes = f.read(content_len_16 * 2)
            if len(content_bytes) < 4:
                continue
            shape_type = struct.unpack('<i', content_bytes[0:4])[0]
            if shape_type == 0:  # Null shape
                continue
            
            if shape_type in (3, 5):  # PolyLine or Polygon
                xmin, ymin, xmax, ymax = struct.unpack('<dddd', content_bytes[4:36])
                
                # Check bounding box overlap with target_bbox
                if target_bbox:
                    b_minx, b_miny, b_maxx, b_maxy = target_bbox
                    if xmax < b_minx or xmin > b_maxx or ymax < b_miny or ymin > b_maxy:
                        continue
                
                num_parts, num_points = struct.unpack('<ii', content_bytes[36:44])
                parts = struct.unpack(f'<{num_parts}i', content_bytes[44:44 + num_parts*4])
                
                pts_offset = 44 + num_parts*4
                pts_raw = struct.unpack(f'<{num_points*2}d', content_bytes[pts_offset:pts_offset + num_points*16])
                
                # Extract individual rings/parts
                part_lines = []
                for p_idx in range(num_parts):
                    start = parts[p_idx]
                    end = parts[p_idx+1] if p_idx + 1 < num_parts else num_points
                    line_pts = []
                    for pt_i in range(start, end):
                        x = round(pts_raw[pt_i*2], 5)
                        y = round(pts_raw[pt_i*2 + 1], 5)
                        line_pts.append([x, y])
                    
                    if len(line_pts) >= 2:
                        # Check if this part itself is inside/near target_bbox
                        p_xs = [pt[0] for pt in line_pts]
                        p_ys = [pt[1] for pt in line_pts]
                        if target_bbox:
                            if max(p_xs) < b_minx or min(p_xs) > b_maxx or max(p_ys) < b_miny or min(p_ys) > b_maxy:
                                continue
                        part_lines.append(line_pts)
                
                if not part_lines:
                    continue
                
                if shape_type == 3:  # PolyLine
                    if len(part_lines) == 1:
                        geom = {'type': 'LineString', 'coordinates': part_lines[0]}
                    else:
                        geom = {'type': 'MultiLineString', 'coordinates': part_lines}
                    features.append({
                        'type': 'Feature',
                        'properties': {'id': rec_num},
                        'geometry': geom
                    })
                elif shape_type == 5:  # Polygon
                    poly_groups = []
                    for ring in part_lines:
                        # Ensure closed ring
                        if ring[0] != ring[-1]:
                            ring.append(ring[0])
                        poly_groups.append([ring])
                    
                    if len(poly_groups) == 1:
                        geom = {'type': 'Polygon', 'coordinates': poly_groups[0]}
                    else:
                        geom = {'type': 'MultiPolygon', 'coordinates': poly_groups}
                    features.append({
                        'type': 'Feature',
                        'properties': {'id': rec_num},
                        'geometry': geom
                    })

    return {'type': 'FeatureCollection', 'features': features}

def main():
    os.makedirs('datasets/geography/natural-earth/10m/processed', exist_ok=True)
    os.makedirs('frontend/public/geography', exist_ok=True)
    
    # Domain clipping bounds for Indian Ocean basin with full regional context
    # 20°E to 130°E, -40°S to 40°N
    io_bbox = (20.0, -40.0, 130.0, 40.0)
    
    print('Processing Natural Earth 10m coastline shapefile...')
    coast_shp = 'datasets/geography/natural-earth/10m/source/coastline/ne_10m_coastline.shp'
    coast_fc = parse_shp_records(coast_shp, target_bbox=io_bbox)
    print(f'Coastline features extracted: {len(coast_fc["features"])}')
    
    coast_out = 'datasets/geography/natural-earth/10m/processed/coastline.geojson'
    with open(coast_out, 'w', encoding='utf-8') as f:
        json.dump(coast_fc, f)
    print(f'Wrote {coast_out} ({os.path.getsize(coast_out)/1024:.1f} KB)')
    
    print('Processing Natural Earth 10m land shapefile...')
    land_shp = 'datasets/geography/natural-earth/10m/source/land/ne_10m_land.shp'
    land_fc = parse_shp_records(land_shp, target_bbox=io_bbox, is_polygon=True)
    print(f'Land features extracted: {len(land_fc["features"])}')
    
    land_out = 'datasets/geography/natural-earth/10m/processed/land.geojson'
    with open(land_out, 'w', encoding='utf-8') as f:
        json.dump(land_fc, f)
    print(f'Wrote {land_out} ({os.path.getsize(land_out)/1024:.1f} KB)')
    
    # Copy to frontend/public/geography/
    shutil.copyfile(coast_out, 'frontend/public/geography/coastline.geojson')
    shutil.copyfile(land_out, 'frontend/public/geography/land.geojson')
    print('Copied GeoJSON assets to frontend/public/geography/ successfully!')

if __name__ == '__main__':
    main()

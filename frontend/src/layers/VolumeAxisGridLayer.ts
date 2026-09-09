import * as Cesium from 'cesium';

export interface VolumeAxisGridManager {
  updateBox: (box: { north: number; south: number; east: number; west: number } | null, verticalExaggeration: number) => void;
  destroy: () => void;
}

export function createVolumeAxisGrid(viewer: Cesium.Viewer): VolumeAxisGridManager {
  const entities: Cesium.Entity[] = [];

  function drawGrid(box: { north: number; south: number; east: number; west: number }, exagg: number) {
    // Clear previous
    entities.forEach(e => viewer.entities.remove(e));
    entities.length = 0;

    const { north, south, east, west } = box;
    const maxDepth = -2000; // e.g. -2000m depth scale
    const depthLevels = [0, -500, -1000, -1500, -2000];

    // Grid Material
    const lineMaterial = new Cesium.PolylineDashMaterialProperty({
      color: Cesium.Color.CYAN.withAlpha(0.6),
      dashLength: 16.0
    });

    const fontStyle = 'bold 12px monospace';
    const labelColor = Cesium.Color.WHITE;

    // 1. Draw Surface Rectangle
    entities.push(viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          west, north,
          east, north,
          east, south,
          west, south,
          west, north
        ]),
        width: 2,
        material: Cesium.Color.CYAN.withAlpha(0.8)
      }
    }));

    // 2. Draw Bottom Rectangle
    entities.push(viewer.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          west, north, maxDepth * exagg,
          east, north, maxDepth * exagg,
          east, south, maxDepth * exagg,
          west, south, maxDepth * exagg,
          west, north, maxDepth * exagg
        ]),
        width: 1,
        material: lineMaterial
      }
    }));

    // 3. Draw Vertical Pillars at the 4 corners
    const corners = [
      [west, north], [east, north], [east, south], [west, south]
    ];
    
    corners.forEach(c => {
      entities.push(viewer.entities.add({
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArrayHeights([
            c[0], c[1], 0,
            c[0], c[1], maxDepth * exagg
          ]),
          width: 1,
          material: lineMaterial
        }
      }));
    });

    // 4. Depth Labels (Y-axis) on the North-West pillar
    depthLevels.forEach(d => {
      entities.push(viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(west, north, d * exagg),
        label: {
          text: `${d}m`,
          font: fontStyle,
          fillColor: labelColor,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(-30, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      }));
    });

    // 5. Lat/Lon Labels (X/Z-axes) along North and West edges (Surface)
    const lonStep = (east - west) / 4;
    for (let i = 0; i <= 4; i++) {
      const lon = west + i * lonStep;
      entities.push(viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, north, 0),
        label: {
          text: `${lon.toFixed(2)}°E`,
          font: fontStyle,
          fillColor: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      }));
    }

    const latStep = (north - south) / 4;
    for (let i = 0; i <= 4; i++) {
      const lat = south + i * latStep;
      entities.push(viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(west, lat, 0),
        label: {
          text: `${lat.toFixed(2)}°N`,
          font: fontStyle,
          fillColor: Cesium.Color.YELLOW,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(-20, 0),
          horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        }
      }));
    }
  }

  return {
    updateBox: (box, exagg) => {
      if (!box) {
        entities.forEach(e => viewer.entities.remove(e));
        entities.length = 0;
        return;
      }
      drawGrid(box, exagg);
    },
    destroy: () => {
      entities.forEach(e => viewer.entities.remove(e));
      entities.length = 0;
    }
  };
}

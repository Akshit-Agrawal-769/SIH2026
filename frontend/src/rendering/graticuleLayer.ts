import * as Cesium from 'cesium';

export interface GraticuleLayerManager {
  setVisible: (visible: boolean) => void;
  destroy: () => void;
}

/**
 * Creates and manages NOAA-style cartographic graticules draped over the Indian Ocean domain.
 * Renders calibrated 10° parallels (20°N, 10°N, Equator 0°, 2°S, 10°S) and meridians (50°E - 100°E)
 * with typographic coordinates matching NOAA operational satellite reference imagery.
 */
export function createGraticuleLayer(viewer: Cesium.Viewer): GraticuleLayerManager {
  const dataSource = new Cesium.CustomDataSource('noaa_graticules');

  // Calibrated parallels matching NOAA Reference Image 2
  const parallels = [
    { lat: 20.0, label: '20° N', major: false },
    { lat: 10.0, label: '10° N', major: true },
    { lat: 0.0, label: '0° [Equator]', major: true },
    { lat: -2.0, label: '2° S', major: true },
    { lat: -10.0, label: '10° S', major: false }
  ];

  // Calibrated meridians
  const meridians = [
    { lon: 50.0, label: '50° E' },
    { lon: 60.0, label: '60° E' },
    { lon: 70.0, label: '70° E' },
    { lon: 80.0, label: '80° E' },
    { lon: 90.0, label: '90° E' },
    { lon: 100.0, label: '100° E' }
  ];

  for (const p of parallels) {
    const coords: number[] = [];
    for (let lon = 45.0; lon <= 100.0; lon += 0.5) {
      coords.push(lon, p.lat);
    }

    dataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(coords),
        width: p.major ? 2.2 : 1.2,
        material: new Cesium.ColorMaterialProperty(
          p.major ? Cesium.Color.WHITE.withAlpha(0.70) : Cesium.Color.WHITE.withAlpha(0.35)
        ),
        clampToGround: true
      }
    });

    // West label
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(46.2, p.lat, 1000),
      label: {
        text: p.label,
        font: p.major ? 'bold 12px monospace' : '11px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(3, 10, 24, 0.80)'),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });

    // East label
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(98.8, p.lat, 1000),
      label: {
        text: p.label,
        font: p.major ? 'bold 12px monospace' : '11px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(3, 10, 24, 0.80)'),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
  }

  for (const m of meridians) {
    const coords: number[] = [];
    for (let lat = -15.0; lat <= 30.0; lat += 0.5) {
      coords.push(m.lon, lat);
    }

    dataSource.entities.add({
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray(coords),
        width: 1.2,
        material: new Cesium.ColorMaterialProperty(Cesium.Color.WHITE.withAlpha(0.35)),
        clampToGround: true
      }
    });

    // South meridian label
    dataSource.entities.add({
      position: Cesium.Cartesian3.fromDegrees(m.lon, -14.2, 1000),
      label: {
        text: m.label,
        font: '11px monospace',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(3, 10, 24, 0.80)'),
        backgroundPadding: new Cesium.Cartesian2(4, 2),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
  }

  viewer.dataSources.add(dataSource);

  return {
    setVisible: (visible: boolean) => {
      dataSource.show = visible;
    },
    destroy: () => {
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(dataSource, true);
      }
    }
  };
}

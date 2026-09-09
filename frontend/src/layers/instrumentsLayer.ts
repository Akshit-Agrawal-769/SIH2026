import * as Cesium from 'cesium';
import { fetchInstruments } from '../api/client';
import { flyToCoordinates } from '../globe/cameraUtils';
import { getPlatformMarkerIconUrl } from './markerIcons';

export interface InstrumentsLayerManager {
  updateVisibility: (activeLayers: string[]) => void;
  destroy: () => void;
}

/**
 * Initializes and manages high-aesthetic in-situ observation markers
 * (Argo floats and gliders) on the Cesium viewer.
 */
export async function createInstrumentsLayer(
  viewer: Cesium.Viewer,
  onSelectInstrument: (instrumentId: string) => void
): Promise<InstrumentsLayerManager> {
  const entityMap = new Map<string, Cesium.Entity>();
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let hoveredEntity: Cesium.Entity | null = null;

  try {
    const data = await fetchInstruments();
    console.log(`[InstrumentsLayer] Fetched ${data.features.length} platforms from backend.`);

    for (const feature of data.features) {
      const [lon, lat] = feature.geometry.coordinates;
      const type = (feature.properties.platform_type || 'argo').toLowerCase();
      const extId = feature.properties.external_id;
      const meta = feature.properties.metadata || {};

      const isArgo = type === 'argo';
      const isGlider = type === 'glider';
      const isMoored = type === 'moored_buoy';

      let labelBadge = '';
      let labelColor = '#00E5FF';
      if (isArgo) {
        labelBadge = `ARGO • #${meta.wmo || extId.replace('INCOIS_ARGO_', '')}`;
        labelColor = '#FFD54F';
      } else if (isGlider) {
        labelBadge = `GLIDER • ${meta.glider_model || 'SLOCUM'}`;
        labelColor = '#FF80DF';
      } else if (isMoored) {
        labelBadge = `OMNI BUOY • #${meta.wmo || extId.replace('INCOIS_OMNI_', '')}`;
        labelColor = '#69F0AE';
      } else {
        labelBadge = `${type.toUpperCase()} • ${extId}`;
        labelColor = '#00E5FF';
      }

      const iconUrl = getPlatformMarkerIconUrl(type, false);

      const entity = viewer.entities.add({
        id: `instrument-${extId}`,
        name: labelBadge,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 200),
        billboard: {
          image: iconUrl,
          width: 40,
          height: 40,
          scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.15, 1.8e7, 0.62),
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        label: {
          text: ` ${labelBadge} `,
          font: 'bold 10.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
          style: Cesium.LabelStyle.FILL,
          fillColor: Cesium.Color.fromCssColorString(labelColor),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('rgba(2, 11, 24, 0.90)'),
          backgroundPadding: new Cesium.Cartesian2(7, 4),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -26),
          // Show label when user zooms closer than 9,000 km
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 9000000),
          disableDepthTestDistance: Number.POSITIVE_INFINITY
        },
        properties: new Cesium.PropertyBag({
          instrumentId: feature.id,
          externalId: extId,
          platformType: type,
          coordinates: [lon, lat],
          metadata: meta
        })
      });

      entityMap.set(extId, entity);
    }
  } catch (err) {
    console.error('[InstrumentsLayer] Error loading instruments:', err);
  }

  // Handle hover effect: pointer cursor and icon glowing state
  handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
    const pickedObject = viewer.scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties?.hasProperty('externalId')) {
      viewer.canvas.style.cursor = 'pointer';
      const entity = pickedObject.id as Cesium.Entity;
      if (hoveredEntity !== entity) {
        // Reset previous entity
        if (hoveredEntity && hoveredEntity.billboard) {
          const prevType = hoveredEntity.properties?.platformType?.getValue();
          hoveredEntity.billboard.image = new Cesium.ConstantProperty(getPlatformMarkerIconUrl(prevType, false));
        }
        hoveredEntity = entity;
        if (entity.billboard) {
          const currType = entity.properties?.platformType?.getValue();
          entity.billboard.image = new Cesium.ConstantProperty(getPlatformMarkerIconUrl(currType, true));
        }
      }
    } else {
      viewer.canvas.style.cursor = 'default';
      if (hoveredEntity && hoveredEntity.billboard) {
        const prevType = hoveredEntity.properties?.platformType?.getValue();
        hoveredEntity.billboard.image = new Cesium.ConstantProperty(getPlatformMarkerIconUrl(prevType, false));
        hoveredEntity = null;
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Handle click on instrument marker
  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    const pickedObject = viewer.scene.pick(click.position);
    if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
      const props = pickedObject.id.properties;
      if (props.hasProperty('externalId')) {
        const extId = props.externalId.getValue();
        const coords = props.coordinates.getValue();
        console.log(`[InstrumentsLayer] Clicked platform: ${extId}`, coords);

        onSelectInstrument(extId);

        // Smoothly fly camera to center over selected instrument at close inspection altitude
        if (coords && coords.length === 2) {
          flyToCoordinates(viewer, {
            lon: coords[0],
            lat: coords[1],
            height: 450000,
            pitch: -65.0,
            duration: 1.8
          });
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  return {
    updateVisibility: (activeLayers: string[]) => {
      entityMap.forEach((entity) => {
        const type = entity.properties?.platformType?.getValue();
        entity.show = activeLayers.includes(type);
      });
    },
    destroy: () => {
      handler.destroy();
      viewer.canvas.style.cursor = 'default';
      entityMap.forEach((entity) => {
        viewer.entities.remove(entity);
      });
      entityMap.clear();
    }
  };
}

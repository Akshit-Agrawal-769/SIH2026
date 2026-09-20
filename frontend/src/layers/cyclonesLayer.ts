import * as Cesium from 'cesium';
import { CYCLONES_DATA, CycloneRecord } from '../data/cyclones';
import { getCycloneMarkerIconUrl } from './cycloneIcon';

export interface HoveredCyclonePayload extends CycloneRecord {
  screenX: number;
  screenY: number;
}

export interface CyclonesLayerManager {
  destroy: () => void;
}

/**
 * Initializes and manages subtle historical cyclone point-of-interest markers
 * on the Cesium 3D ocean globe with raycasting hover interaction.
 */
export function createCyclonesLayer(
  viewer: Cesium.Viewer,
  onHoverCyclone: (info: HoveredCyclonePayload | null) => void
): CyclonesLayerManager {
  const entityMap = new Map<string, Cesium.Entity>();
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let hoveredEntity: Cesium.Entity | null = null;

  const normalIconUrl = getCycloneMarkerIconUrl(false);
  const hoverIconUrl = getCycloneMarkerIconUrl(true);

  // Add small marker constructs for each of the 9 static cyclones
  for (const cyclone of CYCLONES_DATA) {
    const entityId = `cyclone-${cyclone.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const entity = viewer.entities.add({
      id: entityId,
      name: cyclone.name,
      position: Cesium.Cartesian3.fromDegrees(cyclone.lon, cyclone.lat, 100),
      billboard: {
        image: normalIconUrl,
        width: 24,
        height: 24,
        scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.05, 1.8e7, 0.45),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      },
      properties: new Cesium.PropertyBag({
        isCycloneMarker: true,
        cycloneData: cyclone
      })
    });

    entityMap.set(entityId, entity);
  }

  // Handle raycast picking on mouse move
  handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
    if (!movement.endPosition) return;

    const pickedObject = viewer.scene.pick(movement.endPosition);

    if (
      Cesium.defined(pickedObject) &&
      pickedObject.id &&
      pickedObject.id.properties &&
      pickedObject.id.properties.hasProperty('isCycloneMarker')
    ) {
      viewer.canvas.style.cursor = 'pointer';
      const entity = pickedObject.id as Cesium.Entity;

      if (hoveredEntity !== entity) {
        if (hoveredEntity && hoveredEntity.billboard) {
          hoveredEntity.billboard.image = new Cesium.ConstantProperty(normalIconUrl);
        }
        hoveredEntity = entity;
        if (entity.billboard) {
          entity.billboard.image = new Cesium.ConstantProperty(hoverIconUrl);
        }
      }

      const cycloneData = entity.properties?.cycloneData?.getValue() as CycloneRecord;
      if (cycloneData) {
        onHoverCyclone({
          ...cycloneData,
          screenX: movement.endPosition.x,
          screenY: movement.endPosition.y
        });
      }
    } else {
      if (hoveredEntity) {
        if (hoveredEntity.billboard) {
          hoveredEntity.billboard.image = new Cesium.ConstantProperty(normalIconUrl);
        }
        hoveredEntity = null;
        onHoverCyclone(null);

        // Only restore default cursor if not hovering an instrument
        if (!Cesium.defined(pickedObject) || !pickedObject.id?.properties?.hasProperty('externalId')) {
          viewer.canvas.style.cursor = 'default';
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  return {
    destroy: () => {
      handler.destroy();
      if (hoveredEntity) {
        hoveredEntity = null;
        onHoverCyclone(null);
      }
      entityMap.forEach((entity) => {
        viewer.entities.remove(entity);
      });
      entityMap.clear();
    }
  };
}

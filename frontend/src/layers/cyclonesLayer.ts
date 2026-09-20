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
 * Initializes and manages animated historical cyclone point-of-interest markers
 * on the Cesium 3D ocean globe with continuous in-place spiral rotation and raycast hover interaction.
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

  // 1. Continuous In-Place Cyclonic Swirl Animation (via Cesium scene preRender loop)
  let lastTime = performance.now();
  let baseRotation = 0;
  // Slow subtle rotation rate: ~0.45 rad/s (~14 seconds per full 360-deg rotation)
  const rotationSpeed = 0.45;

  const onPreRender = () => {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 1000.0, 0.1);
    lastTime = now;
    baseRotation += dt * rotationSpeed;
  };

  const removePreRenderListener = viewer.scene.preRender.addEventListener(onPreRender);

  // 2. Add marker constructs for each of the 9 static cyclones
  // Size increased to 64px (~1.6x larger than previous 40px) with NearFarScalar distance scaling
  CYCLONES_DATA.forEach((cyclone, idx) => {
    const entityId = `cyclone-${cyclone.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    // Phase offset per cyclone so the cluster does not swirl in lockstep
    const phaseOffset = idx * (Math.PI / 4.5);

    const entity = viewer.entities.add({
      id: entityId,
      name: cyclone.name,
      position: Cesium.Cartesian3.fromDegrees(cyclone.lon, cyclone.lat, 100),
      billboard: {
        image: normalIconUrl,
        width: 64,
        height: 64,
        scaleByDistance: new Cesium.NearFarScalar(2.0e5, 1.15, 1.8e7, 0.40),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        rotation: new Cesium.CallbackProperty(() => {
          return baseRotation + phaseOffset;
        }, false)
      },
      properties: new Cesium.PropertyBag({
        isCycloneMarker: true,
        cycloneData: cyclone
      })
    });

    entityMap.set(entityId, entity);
  });

  // 3. Handle raycast picking on mouse move
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
      removePreRenderListener();
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

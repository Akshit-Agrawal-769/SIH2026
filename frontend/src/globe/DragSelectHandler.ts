import * as Cesium from 'cesium';
import { useOceanStore } from '../store/useOceanStore';

export function createDragSelectHandler(viewer: Cesium.Viewer) {
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  
  let isDragging = false;
  let startCartesian: Cesium.Cartesian3 | null = null;
  let selectionRectangle: Cesium.Entity | null = null;

  handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
    // Only activate on SHIFT + LEFT_CLICK
    const ray = viewer.camera.getPickRay(click.position);
    if (!ray) return;
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (cartesian) {
      isDragging = true;
      startCartesian = cartesian;
      viewer.scene.screenSpaceCameraController.enableInputs = false; // Disable camera movement

      // Create visual rectangle
      if (!selectionRectangle) {
        selectionRectangle = viewer.entities.add({
          rectangle: {
            coordinates: new Cesium.CallbackProperty(() => {
              // We'll update this in mouse move, but just return empty if none
              return new Cesium.Rectangle();
            }, false),
            material: Cesium.Color.fromCssColorString('rgba(255, 0, 0, 0.2)'),
            outline: true,
            outlineColor: Cesium.Color.RED,
            outlineWidth: 2,
          }
        });
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.KeyboardEventModifier.SHIFT);

  handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
    if (!isDragging || !startCartesian || !selectionRectangle) return;

    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (!ray) return;
    const endCartesian = viewer.scene.globe.pick(ray, viewer.scene);
    
    if (endCartesian) {
      const startCartographic = Cesium.Cartographic.fromCartesian(startCartesian);
      const endCartographic = Cesium.Cartographic.fromCartesian(endCartesian);

      const minLon = Math.min(startCartographic.longitude, endCartographic.longitude);
      const maxLon = Math.max(startCartographic.longitude, endCartographic.longitude);
      const minLat = Math.min(startCartographic.latitude, endCartographic.latitude);
      const maxLat = Math.max(startCartographic.latitude, endCartographic.latitude);

      selectionRectangle.rectangle!.coordinates = new Cesium.ConstantProperty(
        new Cesium.Rectangle(minLon, minLat, maxLon, maxLat)
      );
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE, Cesium.KeyboardEventModifier.SHIFT);

  handler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
    if (!isDragging || !startCartesian || !selectionRectangle) return;
    
    isDragging = false;
    viewer.scene.screenSpaceCameraController.enableInputs = true; // Re-enable camera

    const ray = viewer.camera.getPickRay(movement.position);
    if (!ray) return;
    const endCartesian = viewer.scene.globe.pick(ray, viewer.scene);
    
    if (endCartesian) {
      const startCartographic = Cesium.Cartographic.fromCartesian(startCartesian);
      const endCartographic = Cesium.Cartographic.fromCartesian(endCartesian);

      const west = Cesium.Math.toDegrees(Math.min(startCartographic.longitude, endCartographic.longitude));
      const east = Cesium.Math.toDegrees(Math.max(startCartographic.longitude, endCartographic.longitude));
      const south = Cesium.Math.toDegrees(Math.min(startCartographic.latitude, endCartographic.latitude));
      const north = Cesium.Math.toDegrees(Math.max(startCartographic.latitude, endCartographic.latitude));

      useOceanStore.getState().setActiveBoundingBox({ north, south, east, west });
      
      // Keep the rectangle visual active or remove it? The AxisGrid will draw a better one.
      viewer.entities.remove(selectionRectangle);
      selectionRectangle = null;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.KeyboardEventModifier.SHIFT);

  return {
    destroy: () => {
      handler.destroy();
      if (selectionRectangle) viewer.entities.remove(selectionRectangle);
    }
  };
}

import * as Cesium from 'cesium';

export interface VolumetricBlockOptions {
  variable: string;
  depthLevel: number;
  verticalExaggeration: number;
  colorPalette: string;
  colorRange: [number, number];
  opacity: number;
  isVisible: boolean;
}

export interface VolumetricBlockManager {
  update: (options: Partial<VolumetricBlockOptions>) => void;
  flyToBlock: () => void;
  destroy: () => void;
}

/**
 * 3D Ocean Volumetric Block Layer Manager.
 * 
 * Draws a geometric 0-2000 m reference frame (walls, depth planes, ruler) over the
 * Arabian Sea / Bay of Bengal. It is a spatial reference only: no values are painted on
 * the walls because the gridded products in this release have no subsurface levels.
 */
export function createVolumetricBlockLayer(viewer: Cesium.Viewer): VolumetricBlockManager {
  const entities: Cesium.Entity[] = [];

  // Bounding Box coordinates for the 3D Ocean Block (Arabian Sea to Bay of Bengal)
  const WEST = 52.0;
  const EAST = 92.0;
  const SOUTH = 2.0;
  const NORTH = 22.0;

  // Current state
  let currentVar = 'temperature';
  let currentDepth = 0.5;
  let currentExagg = 250.0;
  let currentPalette = 'turbo';
  let currentRange: [number, number] = [20.0, 32.0];
  let currentOpacity = 0.85;
  let isVisible = true;

  // Cache for generated wall canvas textures
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 256;

  // Neutral wall texture: depth ruler only. The gridded products in this release are
  // surface-only, so the walls carry no colour-coded values (nothing is implied below 0 m).
  function renderWallTexture(_variable: string, _palette: string, _range: [number, number]) {
    const ctx = wallCanvas.getContext('2d');
    if (!ctx) return;
    const w = wallCanvas.width;
    const h = wallCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = `rgba(23, 23, 23, ${Math.max(0.2, currentOpacity * 0.45)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(229, 229, 229, 0.85)';
    ctx.font = '12px monospace';
    for (const d of [0, 100, 500, 1000, 2000]) {
      const y = Math.min(h - 2, (d / 2000) * h + 1);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(`${d} m`, 10, Math.max(14, y - 4));
    }
    ctx.strokeStyle = 'rgba(20, 184, 166, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  }

  // Reference to dynamic entities
  let wallEntity: Cesium.Entity | null = null;
  let activeDepthPlaneEntity: Cesium.Entity | null = null;
  let activeWireframeEntity: Cesium.Entity | null = null;
  let activePlaneLabelEntity: Cesium.Entity | null = null;
  const staticPlaneEntities: Cesium.Entity[] = [];
  const pillarEntities: Cesium.Entity[] = [];

  function rebuildBlock() {
    // 1. Clean up existing entities
    for (const ent of entities) {
      viewer.entities.remove(ent);
    }
    entities.length = 0;
    staticPlaneEntities.length = 0;
    pillarEntities.length = 0;

    if (!isVisible) return;

    renderWallTexture(currentVar, currentPalette, currentRange);

    const maxDepthMeters = 2000.0;
    const maxVisualHeight = maxDepthMeters * currentExagg;

    // 2. Add 4 Vertical Cross-Section Curtain Walls
    // Wall perimeter: SW -> SE -> NE -> NW -> SW
    const wallPositions = Cesium.Cartesian3.fromDegreesArray([
      WEST, SOUTH,
      EAST, SOUTH,
      EAST, NORTH,
      WEST, NORTH,
      WEST, SOUTH
    ]);

    const minHeights = [
      -maxVisualHeight,
      -maxVisualHeight,
      -maxVisualHeight,
      -maxVisualHeight,
      -maxVisualHeight
    ];

    const maxHeights = [0, 0, 0, 0, 0];

    wallEntity = viewer.entities.add({
      id: 'ocean-volume-curtain-walls',
      name: '3D Ocean Volumetric Depth Walls',
      wall: {
        positions: wallPositions,
        minimumHeights: minHeights,
        maximumHeights: maxHeights,
        material: new Cesium.ImageMaterialProperty({
          image: wallCanvas.toDataURL(),
          transparent: true,
          repeat: new Cesium.Cartesian2(4.0, 1.0)
        }),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('rgba(20, 184, 166, 0.85)'),
        outlineWidth: 2
      }
    });
    entities.push(wallEntity);

    // 2b. Add Bottom Floor of Volumetric Slab (-2000m Abyssal Basin)
    const floorEntity = viewer.entities.add({
      id: 'ocean-volume-bottom-floor',
      name: '2000 m frame floor',
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(WEST, SOUTH, EAST, NORTH),
        height: -maxVisualHeight,
        material: Cesium.Color.fromCssColorString('rgba(23, 23, 23, 0.6)'),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('rgba(20, 184, 166, 0.9)'),
        outlineWidth: 2
      }
    });
    entities.push(floorEntity);

    // 3. Add 5 Static Suspended 3D Stratification Planes
    // Neutral depth reference planes (geometry only, no data or water-mass claims).
    const stratificationDepths = [
      { depth: 500.0, label: '500 m reference plane', color: 'rgba(163, 163, 163, 0.06)' },
      { depth: 1000.0, label: '1000 m reference plane', color: 'rgba(163, 163, 163, 0.06)' },
      { depth: 2000.0, label: '2000 m reference plane', color: 'rgba(38, 38, 38, 0.35)' }
    ];

    for (const plane of stratificationDepths) {
      const planeVisualZ = -plane.depth * currentExagg;
      const planeEntity = viewer.entities.add({
        id: `ocean-strata-plane-${plane.depth}`,
        name: plane.label,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(WEST, SOUTH, EAST, NORTH),
          height: planeVisualZ,
          material: Cesium.Color.fromCssColorString(plane.color),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString('rgba(20, 184, 166, 0.4)'),
          outlineWidth: 1.5
        }
      });
      staticPlaneEntities.push(planeEntity);
      entities.push(planeEntity);
    }

    // 4. Dynamic Active Laser Scanning Depth Plane (Moves with depth slider!)
    const activeVisualZ = -currentDepth * currentExagg;
    activeDepthPlaneEntity = viewer.entities.add({
      id: 'ocean-active-scanning-plane',
      name: `Active Depth Plane (${currentDepth}m)`,
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(WEST, SOUTH, EAST, NORTH),
        height: activeVisualZ,
        material: Cesium.Color.fromCssColorString('rgba(20, 184, 166, 0.35)'),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#14b8a6'),
        outlineWidth: 3
      }
    });
    entities.push(activeDepthPlaneEntity);

    // Dynamic 3D Neon Laser Border Wireframe around active plane
    activeWireframeEntity = viewer.entities.add({
      id: 'ocean-active-scanning-wireframe',
      name: 'Active Scanning Wireframe',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          WEST, SOUTH, activeVisualZ,
          EAST, SOUTH, activeVisualZ,
          EAST, NORTH, activeVisualZ,
          WEST, NORTH, activeVisualZ,
          WEST, SOUTH, activeVisualZ
        ]),
        width: 3,
        material: Cesium.Color.fromCssColorString('#14b8a6')
      }
    });
    entities.push(activeWireframeEntity);

    // 3D Floating Laser Badge on Active Plane
    activePlaneLabelEntity = viewer.entities.add({
      id: 'ocean-active-plane-badge',
      position: Cesium.Cartesian3.fromDegrees(EAST, NORTH, activeVisualZ + 8000),
      label: {
        text: ` DEPTH PLANE: ${currentDepth} m `,
        font: 'bold 12px monospace',
        style: Cesium.LabelStyle.FILL,
        fillColor: Cesium.Color.fromCssColorString('#14b8a6'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(10, 10, 10, 0.9)'),
        backgroundPadding: new Cesium.Cartesian2(8, 5),
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
    });
    entities.push(activePlaneLabelEntity);

    // 5. 4 Corner 3D Depth Axis Pillars with Depth Measurement Ticks
    const corners = [
      { lon: WEST, lat: SOUTH, name: 'SW Corner Pillar (Equatorial / Somali Basin)' },
      { lon: EAST, lat: SOUTH, name: 'SE Corner Pillar (Eastern Indian Ocean)' },
      { lon: EAST, lat: NORTH, name: 'NE Corner Pillar (Northern Bay of Bengal)' },
      { lon: WEST, lat: NORTH, name: 'NW Corner Pillar (Northern Arabian Sea)' }
    ];

    for (const corner of corners) {
      // Vertical line from 0m down to -2000m
      const pillarLine = viewer.entities.add({
        id: `ocean-pillar-line-${corner.lon}-${corner.lat}`,
        name: corner.name,
        polyline: {
          positions: [
            Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, 1000),
            Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, -maxVisualHeight)
          ],
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.fromCssColorString('#14b8a6'),
            dashLength: 16.0
          })
        }
      });
      pillarEntities.push(pillarLine);
      entities.push(pillarLine);

      // Depth ticks at NW corner
      if (corner.lon === WEST && corner.lat === NORTH) {
        const rulerMarks = [0, 100, 500, 1000, 2000].map((d) => ({ depth: d, text: `${d} m` }));

        for (const mark of rulerMarks) {
          const tickZ = -mark.depth * currentExagg;
          const tickLabel = viewer.entities.add({
            id: `ocean-depth-ruler-${mark.depth}`,
            position: Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, tickZ),
            label: {
              text: ` ${mark.text} `,
              font: 'bold 11px monospace',
              fillColor: Cesium.Color.fromCssColorString('#e5e5e5'),
              showBackground: true,
              backgroundColor: Cesium.Color.fromCssColorString('rgba(0, 0, 0, 0.85)'),
              backgroundPadding: new Cesium.Cartesian2(6, 4),
              pixelOffset: new Cesium.Cartesian2(-20, 0),
              horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
              disableDepthTestDistance: Number.POSITIVE_INFINITY
            }
          });
          entities.push(tickLabel);
        }
      }
    }
  }

  // Initial build
  rebuildBlock();

  return {
    update: (options) => {
      let needsRebuild = false;

      if (options.variable !== undefined && options.variable !== currentVar) {
        currentVar = options.variable;
        needsRebuild = true;
      }
      if (options.verticalExaggeration !== undefined && options.verticalExaggeration !== currentExagg) {
        currentExagg = options.verticalExaggeration;
        needsRebuild = true;
      }
      if (options.colorPalette !== undefined && options.colorPalette !== currentPalette) {
        currentPalette = options.colorPalette;
        needsRebuild = true;
      }
      if (options.colorRange !== undefined && (options.colorRange[0] !== currentRange[0] || options.colorRange[1] !== currentRange[1])) {
        currentRange = options.colorRange;
        needsRebuild = true;
      }
      if (options.opacity !== undefined && options.opacity !== currentOpacity) {
        currentOpacity = options.opacity;
        needsRebuild = true;
      }
      if (options.isVisible !== undefined && options.isVisible !== isVisible) {
        isVisible = options.isVisible;
        needsRebuild = true;
      }

      // Fast update for depthLevel (smooth gliding without rebuilding all entities)
      if (options.depthLevel !== undefined && options.depthLevel !== currentDepth) {
        currentDepth = options.depthLevel;
        if (!needsRebuild && activeDepthPlaneEntity && activePlaneLabelEntity) {
          const activeVisualZ = -currentDepth * currentExagg;
          if (activeDepthPlaneEntity.rectangle) {
            activeDepthPlaneEntity.rectangle.height = new Cesium.ConstantProperty(activeVisualZ);
          }
          if (activeWireframeEntity && activeWireframeEntity.polyline) {
            activeWireframeEntity.polyline.positions = new Cesium.ConstantProperty(
              Cesium.Cartesian3.fromDegreesArrayHeights([
                WEST, SOUTH, activeVisualZ,
                EAST, SOUTH, activeVisualZ,
                EAST, NORTH, activeVisualZ,
                WEST, NORTH, activeVisualZ,
                WEST, SOUTH, activeVisualZ
              ])
            );
          }
          activePlaneLabelEntity.position = new Cesium.ConstantPositionProperty(
            Cesium.Cartesian3.fromDegrees(EAST, NORTH, activeVisualZ + 8000)
          );
          if (activePlaneLabelEntity.label) {
            activePlaneLabelEntity.label.text = new Cesium.ConstantProperty(
              ` DEPTH PLANE: ${currentDepth} m `
            );
          }
        }
      }

      if (needsRebuild) {
        rebuildBlock();
      }
    },

    flyToBlock: () => {
      // Fly to a dramatic perspective angle showing the 3D volume slab from the side!
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(72.0, -8.0, 4800000),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-28.0), // Tilted oblique angle
          roll: 0.0
        },
        duration: 2.2
      });
    },

    destroy: () => {
      for (const ent of entities) {
        viewer.entities.remove(ent);
      }
      entities.length = 0;
    }
  };
}

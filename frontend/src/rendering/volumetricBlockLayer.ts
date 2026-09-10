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
 * Renders a true 3D volumetric "piece of the ocean" over the Indian Ocean / Arabian Sea / Bay of Bengal basin:
 * 1. 4 Vertical Cross-Section Curtain Walls descending from sea surface (0m) to 2000m depth with dynamic thermal/haline gradients.
 * 2. Stacked translucent 3D depth slice planes showing water column stratification.
 * 3. Dynamic active 3D scanning laser plane that physically travels vertically as depthLevel slider is adjusted.
 * 4. 4 Vertical 3D Depth Axis Pillars with depth tick markers (0m, 100m, 500m, 1000m, 2000m).
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

  function renderWallTexture(variable: string, _palette: string, range: [number, number]) {
    const ctx = wallCanvas.getContext('2d');
    if (!ctx) return;

    const w = wallCanvas.width;
    const h = wallCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0.25, currentOpacity);

    // Create vertical gradient representing ocean depth column:
    // Top (row 0) = surface (0m)
    // Row 20% = 100m (thermocline onset)
    // Row 35% = 200m (thermocline base)
    // Row 60% = 800m (intermediate water)
    // Row 100% = 2000m (abyssal cold deep water)
    const grad = ctx.createLinearGradient(0, 0, 0, h);

    if (variable === 'salinity') {
      // Viridis-style salinity halocline: high surface salinity -> transition -> deep uniform 34.7 PSU
      grad.addColorStop(0.0, 'rgba(253, 231, 37, 0.92)');   // Surface high salinity (36.5+ PSU)
      grad.addColorStop(0.2, 'rgba(94, 201, 98, 0.88)');    // Upper halocline
      grad.addColorStop(0.4, 'rgba(33, 145, 140, 0.82)');   // Mid halocline
      grad.addColorStop(0.7, 'rgba(59, 82, 139, 0.75)');    // Deep salinity
      grad.addColorStop(1.0, 'rgba(68, 1, 84, 0.85)');      // Abyssal uniform salinity
    } else if (variable === 'chlorophyll') {
      // Photic zone biological concentration (top 50m) rapidly decaying
      grad.addColorStop(0.0, 'rgba(250, 204, 21, 0.95)');   // Surface bloom
      grad.addColorStop(0.15, 'rgba(16, 185, 129, 0.90)');  // Deep chlorophyll maximum (30-50m)
      grad.addColorStop(0.35, 'rgba(14, 116, 144, 0.60)');  // Aphotic twilight zone
      grad.addColorStop(0.7, 'rgba(15, 23, 42, 0.35)');     // Dark ocean
      grad.addColorStop(1.0, 'rgba(2, 6, 23, 0.20)');       // Abyss
    } else if (variable === 'currents') {
      // Velocity attenuation from energetic surface jet down to deep drift
      grad.addColorStop(0.0, 'rgba(244, 63, 94, 0.95)');    // High surface velocity
      grad.addColorStop(0.2, 'rgba(234, 179, 8, 0.85)');    // Strong subsurface current
      grad.addColorStop(0.4, 'rgba(16, 185, 129, 0.70)');   // Weakening flow
      grad.addColorStop(0.7, 'rgba(6, 182, 212, 0.50)');    // Abyssal calm drift
      grad.addColorStop(1.0, 'rgba(30, 27, 75, 0.40)');     // Sluggish deep bottom flow
    } else {
      // Temperature (Turbo palette): warm tropical surface (28-30°C) -> Thermocline -> Cold abyss (3°C)
      grad.addColorStop(0.0, 'rgba(217, 56, 6, 0.95)');     // Warm surface (30°C)
      grad.addColorStop(0.15, 'rgba(243, 198, 58, 0.90)');  // Upper mixed layer (28°C)
      grad.addColorStop(0.35, 'rgba(36, 236, 166, 0.82)');  // Thermocline rapid drop (20°C - 15°C)
      grad.addColorStop(0.65, 'rgba(70, 117, 237, 0.75)');  // Intermediate water (8°C)
      grad.addColorStop(1.0, 'rgba(48, 18, 59, 0.85)');     // Cold abyss floor (3°C)
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Overlay technical depth grid lines and numerical labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = 'bold 12px monospace';

    const depthTicks = [
      { pct: 0.02, label: '0m [SURFACE]' },
      { pct: 0.20, label: '-100m [THERMOCLINE ONSET]' },
      { pct: 0.35, label: '-200m [BARRIER LAYER BASE]' },
      { pct: 0.60, label: '-800m [OXYGEN MINIMUM]' },
      { pct: 0.95, label: '-2000m [ABYSSAL FLOOR]' }
    ];

    for (const tick of depthTicks) {
      const y = tick.pct * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
      ctx.fillText(tick.label, 12, Math.max(14, y - 4));
    }

    // Outer cyber border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, w, h);

    // Variable & range indicator in top-right corner
    ctx.fillStyle = 'rgba(0, 229, 255, 0.95)';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`${variable.toUpperCase()} [${range[0].toFixed(1)} - ${range[1].toFixed(1)}]`, w - 210, 16);
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
        outlineColor: Cesium.Color.fromCssColorString('rgba(0, 229, 255, 0.85)'),
        outlineWidth: 2
      }
    });
    entities.push(wallEntity);

    // 2b. Add Bottom Floor of Volumetric Slab (-2000m Abyssal Basin)
    const floorEntity = viewer.entities.add({
      id: 'ocean-volume-bottom-floor',
      name: 'Ocean Abyssal Floor (2000m Depth)',
      rectangle: {
        coordinates: Cesium.Rectangle.fromDegrees(WEST, SOUTH, EAST, NORTH),
        height: -maxVisualHeight,
        material: Cesium.Color.fromCssColorString('rgba(6, 12, 26, 0.88)'),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('rgba(0, 229, 255, 0.9)'),
        outlineWidth: 2
      }
    });
    entities.push(floorEntity);

    // 3. Add 5 Static Suspended 3D Stratification Planes
    const stratificationDepths = [
      { depth: 50.0, label: '-50m Euphotic Zone', color: 'rgba(0, 229, 255, 0.12)' },
      { depth: 150.0, label: '-150m Thermocline Core', color: 'rgba(57, 255, 20, 0.14)' },
      { depth: 500.0, label: '-500m Intermediate Water', color: 'rgba(147, 51, 234, 0.15)' },
      { depth: 1000.0, label: '-1000m Deep Ocean', color: 'rgba(59, 130, 246, 0.18)' },
      { depth: 2000.0, label: '-2000m Abyssal Basin Floor', color: 'rgba(15, 23, 42, 0.45)' }
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
          outlineColor: Cesium.Color.fromCssColorString('rgba(0, 229, 255, 0.4)'),
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
        material: Cesium.Color.fromCssColorString('rgba(0, 229, 255, 0.35)'),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('#00e5ff'),
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
        material: Cesium.Color.fromCssColorString('#00e5ff')
      }
    });
    entities.push(activeWireframeEntity);

    // 3D Floating Laser Badge on Active Plane
    activePlaneLabelEntity = viewer.entities.add({
      id: 'ocean-active-plane-badge',
      position: Cesium.Cartesian3.fromDegrees(EAST, NORTH, activeVisualZ + 8000),
      label: {
        text: ` ACTIVE SCAN DEPTH: ${currentDepth === 0.5 ? 'Surface (0m)' : `${currentDepth}m`} `,
        font: 'bold 12px monospace',
        style: Cesium.LabelStyle.FILL,
        fillColor: Cesium.Color.fromCssColorString('#00E5FF'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(2, 11, 24, 0.92)'),
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
            color: Cesium.Color.fromCssColorString('#00e5ff'),
            dashLength: 16.0
          })
        }
      });
      pillarEntities.push(pillarLine);
      entities.push(pillarLine);

      // Depth ticks at NW corner
      if (corner.lon === WEST && corner.lat === NORTH) {
        const rulerMarks = [
          { depth: 0.0, text: '◄ 0m Sea Surface' },
          { depth: 100.0, text: '◄ -100m Thermocline' },
          { depth: 500.0, text: '◄ -500m Intermediate' },
          { depth: 1000.0, text: '◄ -1000m Deep Water' },
          { depth: 2000.0, text: '◄ -2000m Abyssal Floor' }
        ];

        for (const mark of rulerMarks) {
          const tickZ = -mark.depth * currentExagg;
          const tickLabel = viewer.entities.add({
            id: `ocean-depth-ruler-${mark.depth}`,
            position: Cesium.Cartesian3.fromDegrees(corner.lon, corner.lat, tickZ),
            label: {
              text: ` ${mark.text} `,
              font: 'bold 11px monospace',
              fillColor: Cesium.Color.fromCssColorString('#FFD54F'),
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
              ` ACTIVE SCAN DEPTH: ${currentDepth === 0.5 ? 'Surface (0m)' : `${currentDepth}m`} `
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

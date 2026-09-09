/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.145.0
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import {
  Cesium3DTilesTerrainGeometryProcessor_default
} from "./chunk-HDPNFEPP.js";
import "./chunk-JL4NWWQY.js";
import "./chunk-4DMAXPKB.js";
import {
  createTaskProcessorWorker_default
} from "./chunk-EDETO6NY.js";
import "./chunk-XBY3354M.js";
import "./chunk-A7SMPV6B.js";
import "./chunk-NZQUP52G.js";
import "./chunk-L73K5UPP.js";
import "./chunk-N5YK44FS.js";
import "./chunk-75BC2IHI.js";
import "./chunk-LL2SGJYH.js";
import "./chunk-JKTWW7IO.js";
import "./chunk-BNDSDQ7D.js";
import "./chunk-UZY5XRL2.js";
import "./chunk-XRZCS3HE.js";
import "./chunk-6R6SGKYN.js";
import "./chunk-JBJ6BRIM.js";
import "./chunk-E7G32DWL.js";
import "./chunk-GLHDTTTO.js";
import "./chunk-6BSNYZZG.js";
import "./chunk-Z2DW5NM2.js";
import "./chunk-HDD3RFLT.js";
import "./chunk-XSIUYAT6.js";
import "./chunk-B4AVL7VI.js";

// packages/engine/Source/Workers/upsampleVerticesFromCesium3DTilesTerrain.js
function upsampleVerticesFromCesium3DTilesTerrain(options, transferableObjects) {
  const mesh = Cesium3DTilesTerrainGeometryProcessor_default.upsampleMesh(options);
  const verticesBuffer = mesh.vertices.buffer;
  const indicesBuffer = mesh.indices.buffer;
  const westIndicesBuffer = mesh.westIndicesSouthToNorth.buffer;
  const southIndicesBuffer = mesh.southIndicesEastToWest.buffer;
  const eastIndicesBuffer = mesh.eastIndicesNorthToSouth.buffer;
  const northIndicesBuffer = mesh.northIndicesWestToEast.buffer;
  transferableObjects.push(
    verticesBuffer,
    indicesBuffer,
    westIndicesBuffer,
    southIndicesBuffer,
    eastIndicesBuffer,
    northIndicesBuffer
  );
  const result = {
    verticesBuffer,
    indicesBuffer,
    vertexCountWithoutSkirts: mesh.vertexCountWithoutSkirts,
    indexCountWithoutSkirts: mesh.indexCountWithoutSkirts,
    encoding: mesh.encoding,
    westIndicesBuffer,
    southIndicesBuffer,
    eastIndicesBuffer,
    northIndicesBuffer,
    minimumHeight: mesh.minimumHeight,
    maximumHeight: mesh.maximumHeight,
    boundingSphere: mesh.boundingSphere3D,
    orientedBoundingBox: mesh.orientedBoundingBox,
    horizonOcclusionPoint: mesh.horizonOcclusionPoint
  };
  return result;
}
var upsampleVerticesFromCesium3DTilesTerrain_default = createTaskProcessorWorker_default(
  upsampleVerticesFromCesium3DTilesTerrain
);
export {
  upsampleVerticesFromCesium3DTilesTerrain_default as default
};

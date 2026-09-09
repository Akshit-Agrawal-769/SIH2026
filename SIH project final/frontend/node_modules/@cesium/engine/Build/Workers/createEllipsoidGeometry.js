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
  EllipsoidGeometry_default
} from "./chunk-5JCZHJUU.js";
import "./chunk-KBGAHN5R.js";
import "./chunk-B7Q2WF6Q.js";
import "./chunk-JKTWW7IO.js";
import "./chunk-4LRFYRBX.js";
import "./chunk-2YY724ZX.js";
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
import {
  defined_default
} from "./chunk-B4AVL7VI.js";

// packages/engine/Source/Workers/createEllipsoidGeometry.js
function createEllipsoidGeometry(ellipsoidGeometry, offset) {
  if (defined_default(offset)) {
    ellipsoidGeometry = EllipsoidGeometry_default.unpack(ellipsoidGeometry, offset);
  }
  return EllipsoidGeometry_default.createGeometry(ellipsoidGeometry);
}
var createEllipsoidGeometry_default = createEllipsoidGeometry;
export {
  createEllipsoidGeometry_default as default
};

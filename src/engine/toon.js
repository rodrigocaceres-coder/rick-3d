import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Cartoon look: flat colors with one shadow tone, plus a dark outline around every prop.
// The outline is a second, slightly bigger copy of the shape drawn inside out in near-black.
export const INK = 0x15101c;

const steps = new Uint8Array([105, 105, 255, 255]); // two tones: shadow and lit
const gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

// Characters use smooth shading on flat faces (each face a slightly different tone) plus a little light
// of their own, so faces stay readable in a dark room and never break into hard dark patches.
const skinCache = new Map();
export function charMat(color) {
  if (!skinCache.has(color)) skinCache.set(color, new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.28 }));
  return skinCache.get(color);
}

// Floors and walls: smooth light, no hard-edged pools
const softCache = new Map();
export function soft(color) {
  if (!softCache.has(color)) softCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return softCache.get(color);
}

const toonCache = new Map();
export function toon(color) {
  if (!toonCache.has(color)) toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap }));
  return toonCache.get(color);
}

// A color brighter than white. The glow effect in core.js picks these up.
export function glow(color, strength = 1.8) {
  const m = new THREE.MeshBasicMaterial({ color });
  m.color.multiplyScalar(strength);
  m.toneMapped = false;
  return m;
}

const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

function finish(mesh, outlineGeo, o) {
  mesh.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.ry) mesh.rotation.y = o.ry;
  if (o.rx) mesh.rotation.x = o.rx;
  if (o.rz) mesh.rotation.z = o.rz;
  mesh.castShadow = o.cast ?? true;
  mesh.receiveShadow = o.receive ?? true;
  if (outlineGeo) mesh.add(new THREE.Mesh(outlineGeo, inkMat));
  if (o.parent) o.parent.add(mesh);
  return mesh;
}

const asMat = (c) => (c.isMaterial ? c : toon(c));

// box(width, height, depth, color, { x, y, z, line, parent }): y is the center of the box
export function box(w, h, d, color, o = {}) {
  const t = o.line ?? 0.045;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), asMat(color));
  return finish(mesh, t ? new THREE.BoxGeometry(w + 2 * t, h + 2 * t, d + 2 * t) : null, o);
}

// ---- Low-poly shapes ----
// Every round shape is drawn with few, flat faces. The outline is a smooth copy of the shape pushed outward
// along its surface by a fixed amount, so the line is the same thickness on every shape.
const hullCache = new Map();
function hullMat(t) {
  if (!hullCache.has(t)) {
    const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  transformed += normalize(normal) * ${t.toFixed(4)};`);
    };
    m.customProgramCacheKey = () => `hull${t}`;
    hullCache.set(t, m);
  }
  return hullCache.get(t);
}

// shape(geometry, color, { x, y, z, rx, ry, rz, sx, sy, sz, line, parent })
export function shape(geo, color, o = {}) {
  const t = o.line ?? 0.04;
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals(); // one normal per face = the faceted low-poly look
  const mesh = new THREE.Mesh(flat, asMat(color));
  if (t) {
    const smooth = geo.clone();
    smooth.deleteAttribute('normal'); smooth.deleteAttribute('uv');
    const merged = mergeVertices(smooth);
    merged.computeVertexNormals();
    mesh.add(new THREE.Mesh(merged, hullMat(t)));
  }
  finish(mesh, null, o);
  mesh.scale.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  return mesh;
}

// cyl(radius, height, color, { radiusTop, sides, ... })
export function cyl(r, h, color, o = {}) {
  return shape(new THREE.CylinderGeometry(o.radiusTop ?? r, r, h, o.sides ?? 8), color, o);
}

export function ball(r, color, o = {}) {
  return shape(new THREE.IcosahedronGeometry(r, o.detail ?? 1), color, o);
}

export function cone(r, h, color, o = {}) {
  return shape(new THREE.ConeGeometry(r, h, o.sides ?? 5), color, o);
}

// Flat sticker on the floor (stains, mats, scorch marks)
export function decal(radius, color, opacity, o = {}) {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(o.x ?? 0, o.y ?? 0.02, o.z ?? 0);
  mesh.scale.set(o.sx ?? 1, o.sz ?? 1, 1);
  if (o.parent) o.parent.add(mesh);
  return mesh;
}

import * as THREE from 'three';

// Cartoon look: flat colors with one shadow tone, plus a dark outline around every prop.
// The outline is a second, slightly bigger copy of the shape drawn inside out in near-black.
export const INK = 0x15101c;

const steps = new Uint8Array([105, 105, 255, 255]); // two tones: shadow and lit
const gradientMap = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
gradientMap.minFilter = gradientMap.magFilter = THREE.NearestFilter;
gradientMap.needsUpdate = true;

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

// cyl(radius, height, color, { radiusTop, ... })
export function cyl(r, h, color, o = {}) {
  const t = o.line ?? 0.045;
  const rt = o.radiusTop ?? r;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, r, h, o.sides ?? 16), asMat(color));
  return finish(mesh, t ? new THREE.CylinderGeometry(rt + t, r + t, h + 2 * t, o.sides ?? 16) : null, o);
}

export function ball(r, color, o = {}) {
  const t = o.line ?? 0.045;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), asMat(color));
  return finish(mesh, t ? new THREE.SphereGeometry(r + t, 16, 12) : null, o);
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

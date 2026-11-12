import * as THREE from 'three';
import { box, cyl, decal, toon, glow, INK } from '../engine/toon.js';

// The Smith garage at night, built from boxes and cylinders to match the painted 2D background:
// shelf and red tool cabinet on the left of the back wall, pegboard, garage door, jar shelves,
// Rick's workbench on the right wall, cardboard boxes and paint cans along the front.
// Room is 18 wide (x from -9 to 9) and 12 deep (z from -6 at the back wall to 6 at the front).
const W = 18, D = 12, H = 5;

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = W * 64; c.height = D * 64;
  const g = c.getContext('2d');
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    const v = 205 + Math.floor(Math.random() * 14);
    g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
    g.fillRect(x * 64, z * 64, 64, 64);
  }
  g.strokeStyle = '#8d8894'; g.lineWidth = 4;
  for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * 64, 0); g.lineTo(x * 64, c.height); g.stroke(); }
  for (let z = 0; z <= D; z++) { g.beginPath(); g.moveTo(0, z * 64); g.lineTo(c.width, z * 64); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildGarage() {
  const g = new THREE.Group();
  const add = (o) => ({ parent: g, ...o });

  // Floor and walls
  const floorMat = toon(0xffffff).clone();
  floorMat.map = tileTexture();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  box(W + 0.6, 0.5, 0.5, 0x2a2633, add({ y: -0.25, z: D / 2 + 0.25, cast: false })); // front lip of the floor slab
  const WALL = 0xcbbfa8;
  box(W + 0.6, H, 0.3, WALL, add({ y: H / 2, z: -D / 2 - 0.15, line: 0 }));
  box(0.3, H, D, WALL, add({ x: -W / 2 - 0.15, y: H / 2, line: 0 }));
  box(0.3, H, D, WALL, add({ x: W / 2 + 0.15, y: H / 2, line: 0 }));
  box(W, 0.22, 0.08, 0x6d6456, add({ y: 0.11, z: -5.96, line: 0.02 })); // baseboard

  // Left of back wall: metal shelf with cardboard boxes
  const sx = -6.6, sz = -5.25;
  for (const dx of [-1.25, 1.25]) for (const dz of [-0.5, 0.5]) box(0.12, 3, 0.12, 0x6f8196, add({ x: sx + dx, y: 1.5, z: sz + dz }));
  for (const y of [0.35, 1.5, 2.65]) box(2.7, 0.1, 1.15, 0x8fa3b8, add({ x: sx, y, z: sz }));
  const CARD = 0xc49a62;
  box(1.0, 0.7, 0.8, CARD, add({ x: sx - 0.6, y: 0.75, z: sz })); box(0.9, 0.55, 0.8, CARD, add({ x: sx + 0.6, y: 0.68, z: sz }));
  box(0.9, 0.7, 0.8, CARD, add({ x: sx - 0.65, y: 1.9, z: sz })); cyl(0.26, 0.5, 0x9a9aa6, add({ x: sx + 0.1, y: 1.8, z: sz })); box(0.6, 0.6, 0.7, CARD, add({ x: sx + 0.8, y: 1.85, z: sz }));
  box(0.95, 0.75, 0.8, CARD, add({ x: sx - 0.55, y: 3.08, z: sz, ry: 0.15 })); box(0.6, 0.6, 0.6, CARD, add({ x: sx + 0.5, y: 3.0, z: sz, ry: -0.2 }));

  // Red tool cabinet on wheels
  const cx = -4.05;
  box(1.6, 1.25, 0.9, 0xd8423c, add({ x: cx, y: 0.9, z: -5.35 }));
  for (const y of [0.55, 0.9, 1.25]) { box(1.4, 0.05, 0.05, 0x8f2622, add({ x: cx, y, z: -4.89, line: 0 })); box(0.5, 0.06, 0.08, 0xe8e2d4, add({ x: cx, y: y + 0.12, z: -4.87, line: 0.015 })); }
  for (const dx of [-0.6, 0.6]) cyl(0.13, 0.12, 0x2b2733, add({ x: cx + dx, y: 0.13, z: -5.1, rz: Math.PI / 2 }));

  // Pegboard with tools
  box(1.9, 1.5, 0.08, 0xd9b77e, add({ x: -1.95, y: 2.75, z: -5.95 }));
  const TOOL = 0x8c93a1;
  [[-0.6, 0.3, 0.12, 0.7], [-0.25, 0.25, 0.1, 0.6], [0.1, 0.3, 0.08, 0.7], [0.55, 0.3, 0.3, 0.3], [-0.5, -0.4, 0.5, 0.1], [0.15, -0.4, 0.12, 0.5], [0.6, -0.35, 0.3, 0.12]]
    .forEach(([x, y, w, h], i) => box(w, h, 0.06, i % 3 === 2 ? 0xc0504a : TOOL, add({ x: -1.95 + x, y: 2.75 + y, z: -5.88, line: 0.02, rz: (i % 2 ? 0.2 : -0.15) })));

  // Garage door
  box(4.3, 3.75, 0.16, 0x5c6170, add({ x: 1.1, y: 1.875, z: -5.95 }));
  for (let i = 0; i < 10; i++) box(3.9, 0.3, 0.1, 0xb4b8c2, add({ x: 1.1, y: 0.2 + i * 0.345, z: -5.84, line: 0.02 }));
  box(0.5, 0.08, 0.1, 0x3a3d48, add({ x: 1.1, y: 0.3, z: -5.76, line: 0.015 })); // handle
  box(0.16, 0.26, 0.06, 0xe9e4d6, add({ x: 3.6, y: 1.6, z: -5.95, line: 0.02 })); // light switch

  // Wall shelves with jars: some of them glow (do not touch anything that hums)
  const jars = [];
  const JAR = [0xe86a4a, 0x4aa3e8, 0x62d66a, 0xb45ae0, 0xe8c84a, 0x4ae0c8];
  for (const [x0, y] of [[4.3, 2.3], [4.3, 3.1], [7.0, 2.3], [7.0, 3.1]]) {
    box(2.2, 0.1, 0.5, 0xa9713f, add({ x: x0, y, z: -5.72 }));
    if (x0 < 5) {
      for (let i = 0; i < 5; i++) {
        const h = 0.3 + ((i * 7 + y * 10) % 3) * 0.08;
        const col = JAR[(i + Math.round(y * 3)) % JAR.length];
        const glows = (i + Math.round(y)) % 3 === 0;
        const jar = cyl(0.14, h, glows ? glow(col, 1.7) : col, add({ x: x0 - 0.8 + i * 0.4, y: y + 0.05 + h / 2, z: -5.7, line: 0.03 }));
        cyl(0.11, 0.06, 0x3a3540, add({ x: jar.position.x, y: y + 0.08 + h, z: -5.7, line: 0.02 }));
        if (glows) jars.push(jar);
      }
    } else {
      // Electronics: boxy devices with little lights
      box(0.5, 0.3, 0.3, 0x59606e, add({ x: x0 - 0.7, y: y + 0.2, z: -5.7 })); box(0.08, 0.08, 0.04, glow(0xff5a4a, 2), add({ x: x0 - 0.8, y: y + 0.22, z: -5.53, line: 0 }));
      box(0.6, 0.22, 0.3, 0x3f7a55, add({ x: x0 + 0.05, y: y + 0.16, z: -5.7 })); box(0.2, 0.08, 0.04, glow(0x6dff4a, 2), add({ x: x0 + 0.05, y: y + 0.17, z: -5.53, line: 0 }));
      box(0.4, 0.36, 0.3, 0x6b6470, add({ x: x0 + 0.75, y: y + 0.23, z: -5.7 })); cyl(0.015, 0.3, 0x2b2733, add({ x: x0 + 0.85, y: y + 0.55, z: -5.7, line: 0, rz: -0.3 }));
    }
  }

  // Ceiling strip lights (the bright boxes), one real light under each
  for (const x of [-4.6, 5.4]) {
    box(3, 0.16, 0.4, 0x8a8f9c, add({ x, y: 4.62, z: -5.7 }));
    box(2.8, 0.08, 0.3, glow(0xfff4d6, 1.5), add({ x, y: 4.5, z: -5.7, line: 0 }));
    const l = new THREE.PointLight(0xffe9bf, 5, 11, 1.5);
    l.position.set(x, 4.1, -4.6);
    g.add(l);
  }

  // Left wall: door to the house, and a mat
  box(0.12, 3.1, 1.7, 0xb98a55, add({ x: -8.95, y: 1.55, z: 0 }));
  box(0.1, 3.3, 1.95, 0x7a5a36, add({ x: -8.99, y: 1.65, z: 0, line: 0.02 }));
  ballKnob(g, -8.85, 1.45, 0.6);
  box(1.3, 0.05, 1.9, 0xb3936a, add({ x: -7.9, y: 0.03, z: 0, line: 0.03, cast: false }));

  // Right wall: Rick's workbench with humming tubes
  const bx = 8.0, bz = 0.6;
  box(1.5, 0.14, 4.6, 0x7d8a9e, add({ x: bx, y: 1.3, z: bz }));
  for (const dz of [-2.1, 2.1]) for (const dx of [-0.6, 0.6]) box(0.14, 1.25, 0.14, 0x4f586a, add({ x: bx + dx, y: 0.63, z: bz + dz }));
  box(1.3, 0.08, 4.3, 0x5c6678, add({ x: bx, y: 0.4, z: bz }));
  box(0.5, 0.35, 0.5, 0xc0504a, add({ x: bx, y: 0.62, z: bz + 1.3 }));
  const tubes = [];
  [[-1.5, 0x4affd0, 0.75], [-0.6, 0xc45aff, 0.95], [0.2, 0x6dff4a, 0.6], [0.9, 0xff5ad0, 0.5]].forEach(([dz, col, h]) => {
    cyl(0.2, 0.12, 0x2b2733, add({ x: bx + 0.1, y: 1.43, z: bz + dz }));
    tubes.push(cyl(0.14, h, glow(col, 1.6), add({ x: bx + 0.1, y: 1.49 + h / 2, z: bz + dz, line: 0.03 })));
    cyl(0.17, 0.07, 0x2b2733, add({ x: bx + 0.1, y: 1.52 + h, z: bz + dz, line: 0.02 }));
  });
  box(0.55, 0.5, 0.6, 0x59606e, add({ x: bx + 0.25, y: 1.62, z: bz - 2.0 }));
  box(0.5, 0.12, 0.7, 0x3f7a55, add({ x: bx - 0.25, y: 1.43, z: bz - 0.2, ry: 0.2 }));
  box(0.45, 0.3, 0.6, 0xb9a36a, add({ x: bx + 0.2, y: 1.52, z: bz + 1.75, ry: -0.15 }));
  const purple = new THREE.PointLight(0xb060ff, 6, 9, 1.5);
  purple.position.set(bx - 0.6, 2.4, bz - 0.4);
  g.add(purple);

  // Front: cardboard boxes and paint cans
  [[-2.9, 0.9, 0.85], [-1.85, 0.8, 0.9], [-0.75, 1.0, 1.0], [2.55, 0.95, 0.9], [3.6, 1.05, 0.95], [4.6, 0.8, 0.85]]
    .forEach(([x, w, h], i) => box(w, h, 0.9, CARD, add({ x, y: h / 2, z: 5.3, ry: (i % 2 ? 0.08 : -0.06) })));
  [[0.2, 0xd8d8de], [0.75, 0x62d66a], [1.3, 0xd8423c], [1.75, 0x8c93a1]].forEach(([x, col], i) => {
    cyl(0.22, 0.45, 0x9a9aa6, add({ x, y: 0.23, z: 5.25 + (i % 2) * 0.25 }));
    cyl(0.19, 0.03, col, add({ x, y: 0.47, z: 5.25 + (i % 2) * 0.25, line: 0 }));
  });

  // Floor stains, and the green scorch mark where the gun lands
  decal(0.6, 0x6b6450, 0.35, add({ x: -5.2, z: -2.4, sx: 1.4 }));
  decal(0.45, 0x6b6450, 0.3, add({ x: -5.4, z: 3.4, sx: 1.3, sz: 0.7 }));
  decal(0.4, 0x6b6450, 0.3, add({ x: 4.6, z: 3.2 }));
  decal(0.95, 0x3f9a2a, 0.5, add({ x: 4.4, z: -3.1, sx: 1.3, sz: 0.8 }));
  decal(0.5, 0x1c4a12, 0.55, add({ x: 4.4, z: -3.1, sx: 1.5, sz: 0.5 }));

  // Lighting: dim blue night fill, one warm key light that casts the shadows
  g.add(new THREE.HemisphereLight(0x7f8cff, 0x2e2440, 0.85));
  const key = new THREE.DirectionalLight(0xffe6c8, 1.0);
  key.position.set(-5, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 12, bottom: -12, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  g.add(key);

  return {
    group: g,
    bounds: { x0: -8.45, x1: 8.55, z0: -5.55, z1: 5.6 },
    colliders: [
      { x0: -8.3, x1: -3.1, z0: -6, z1: -4.75 },   // shelf and tool cabinet
      { x0: 7.2, x1: 9, z0: -1.8, z1: 3.0 },       // workbench
      { x0: -3.5, x1: 5.15, z0: 4.75, z1: 6 },     // boxes and paint cans
      { x0: 5.75, x1: 7.2, z0: 0.7, z1: 1.75 },      // Rick, passed out
      { x0: 4.25, x1: 4.55, z0: -3.2, z1: -3.0 },   // the gun
    ],
    spots: {
      door: new THREE.Vector3(-8.1, 0, 0),
      rick: new THREE.Vector3(6.55, 0, 1.0),
      gun: new THREE.Vector3(4.4, 0, -3.1),
    },
    update(time) {
      jars.forEach((j, i) => j.scale.setScalar(1 + 0.03 * Math.sin(time * 5 + i * 2)));
      tubes.forEach((t, i) => { t.scale.x = t.scale.z = 1 + 0.06 * Math.sin(time * 7 + i * 1.7); });
      purple.intensity = 6 + Math.sin(time * 7) * 1;
    },
  };
}

function ballKnob(g, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), toon(0xe8c84a));
  m.position.set(x, y, z);
  m.add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })));
  g.add(m);
}

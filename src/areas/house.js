import * as THREE from 'three';
import { box, cyl, ball, cone, soft, glow } from '../engine/toon.js';

// The Smith house at night: kitchen on the left (tile floor), living room on the right (wood floor),
// Jerry's "office" at the dining table in the front left corner. The TV sits at the front with its back
// to the camera, like a sitcom set. The door on the right wall leads to the garage.
// Room is 20 wide (x from -10 to 10) and 12 deep (z from -6 at the back wall to 6 at the front).
const W = 20, D = 12, H = 5;
const TILE_COLS = 7; // kitchen tiles cover the left 7 units of the floor

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = W * 64; c.height = D * 64;
  const g = c.getContext('2d');
  g.lineWidth = 2;
  // Wood planks, half a unit wide, running left to right
  for (let row = 0; row < D * 2; row++) {
    let x = -((row * 37) % 90);
    while (x < c.width) {
      const len = 150 + (Math.abs(row * 53 + x) % 110);
      const v = Math.floor(Math.random() * 16);
      g.fillStyle = `rgb(${150 + v},${106 + Math.round(v * 0.7)},${70 + Math.round(v * 0.5)})`;
      g.fillRect(x, row * 32, len, 32);
      g.strokeStyle = '#6b4a30';
      g.strokeRect(x, row * 32, len, 32);
      x += len;
    }
  }
  // Kitchen: checkered tiles
  for (let x = 0; x < TILE_COLS; x++) for (let z = 0; z < D; z++) {
    g.fillStyle = (x + z) % 2 ? '#c9c3ae' : '#93aea3';
    g.fillRect(x * 64, z * 64, 64, 64);
  }
  g.strokeStyle = '#5c5648'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(TILE_COLS * 64, 0); g.lineTo(TILE_COLS * 64, c.height); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Jerry's pitch board, drawn in code
function boardTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 352;
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 512, 352);
  g.fillStyle = '#15101c'; g.textAlign = 'center';
  g.font = '900 84px Trebuchet MS'; g.fillText('CHAIR', 226, 92);
  g.fillStyle = '#d8423c'; g.font = '900 70px Trebuchet MS'; g.fillText('2', 392, 62);
  g.strokeStyle = '#15101c'; g.lineWidth = 9; g.lineJoin = 'round';
  g.strokeRect(70, 150, 150, 26); g.strokeRect(70, 150, 150, -70);                 // big chair
  g.beginPath(); g.moveTo(80, 176); g.lineTo(64, 250); g.moveTo(210, 176); g.lineTo(226, 250); g.stroke();
  g.lineWidth = 6;
  g.strokeRect(290, 208, 56, 10); g.strokeRect(290, 208, 56, -28);                 // small chair
  g.beginPath(); g.moveTo(294, 218); g.lineTo(288, 250); g.moveTo(342, 218); g.lineTo(348, 250); g.stroke();
  g.fillStyle = '#d8423c'; g.fillRect(306, 176, 24, 30);                           // its drink
  g.fillStyle = '#1c6b12'; g.font = '900 64px Trebuchet MS'; g.fillText('= $$$', 420, 190);
  g.fillStyle = '#15101c'; g.font = 'bold 30px Trebuchet MS'; g.fillText('a chair for your drink', 256, 318);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildHouse() {
  const g = new THREE.Group();
  const add = (o) => ({ parent: g, ...o });

  // Floor and walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: floorTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  box(W + 0.6, 0.5, 0.5, 0x2a2633, add({ y: -0.25, z: D / 2 + 0.25, cast: false }));
  const WALL = soft(0xb7c9a6);
  box(W + 0.6, H, 0.3, WALL, add({ y: H / 2, z: -D / 2 - 0.15, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: -W / 2 - 0.15, y: H / 2, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: W / 2 + 0.15, y: H / 2, line: 0, cast: false }));
  box(W, 0.22, 0.08, 0xe9e4d6, add({ y: 0.11, z: -5.96, line: 0.02 }));

  // ---- Kitchen along the back wall ----
  const CAB = 0xe3d6b4, TOP = 0x4f586a;
  box(1.3, 2.7, 1.0, 0xe4e6ec, add({ x: -9.2, y: 1.35, z: -5.45 }));                 // fridge
  box(1.3, 0.04, 0.04, 0x8d8894, add({ x: -9.2, y: 1.85, z: -4.93, line: 0 }));
  for (const y of [1.55, 2.15]) box(0.06, 0.4, 0.06, 0x8d8894, add({ x: -8.72, y, z: -4.9, line: 0.015 }));
  box(5.0, 1.0, 0.95, CAB, add({ x: -5.9, y: 0.5, z: -5.47 }));                       // counter
  box(5.1, 0.1, 1.05, TOP, add({ x: -5.9, y: 1.05, z: -5.45 }));
  for (let i = 0; i < 5; i++) {
    if (i === 0) continue; // the oven goes here
    box(0.8, 0.7, 0.04, 0xd3c49c, add({ x: -7.9 + i, y: 0.5, z: -4.98, line: 0.015 }));
    ball(0.035, 0x8d8894, add({ x: -7.62 + i, y: 0.7, z: -4.95, line: 0, detail: 0 }));
  }
  box(0.9, 0.75, 0.05, 0x2b2733, add({ x: -7.9, y: 0.5, z: -4.98, line: 0.015 }));    // oven door
  box(0.7, 0.05, 0.06, 0xb4b8c2, add({ x: -7.9, y: 0.82, z: -4.93, line: 0.012 }));
  box(0.95, 0.05, 0.8, 0x2b2733, add({ x: -7.9, y: 1.12, z: -5.45, line: 0.015 }));   // stove top
  for (const [dx, dz] of [[-0.22, -0.18], [0.22, -0.18], [-0.22, 0.18], [0.22, 0.18]]) cyl(0.13, 0.02, 0x59606e, add({ x: -7.9 + dx, y: 1.155, z: -5.45 + dz, line: 0 }));
  cyl(0.2, 0.2, 0xc0504a, add({ x: -7.68, y: 1.26, z: -5.63, line: 0.025 }));         // a pot
  box(0.9, 0.04, 0.6, 0xb4b8c2, add({ x: -4.4, y: 1.11, z: -5.45, line: 0.015 }));    // sink
  cyl(0.03, 0.3, 0xb4b8c2, add({ x: -4.4, y: 1.26, z: -5.8, line: 0.015 }));
  box(0.06, 0.05, 0.22, 0xb4b8c2, add({ x: -4.4, y: 1.4, z: -5.7, line: 0.015 }));
  box(0.7, 0.05, 0.45, 0xa9713f, add({ x: -6.5, y: 1.13, z: -5.35, line: 0.02 }));    // cutting board
  box(0.42, 0.2, 0.2, 0xd9a860, add({ x: -6.95, y: 1.21, z: -5.6, ry: 0.3, line: 0.02 })); // bread
  cyl(0.2, 0.03, 0xf3f0ea, add({ x: -5.6, y: 1.115, z: -5.25, sides: 10, line: 0.015 })); // the sandwich plate
  // Window over the counter, cabinets on both sides
  box(2.0, 1.4, 0.06, 0xe9e4d6, add({ x: -5.4, y: 2.75, z: -5.97, line: 0.03 }));
  const NIGHT = new THREE.MeshBasicMaterial({ color: 0x1d2550 });
  for (const dx of [-0.47, 0.47]) box(0.86, 1.2, 0.04, NIGHT, add({ x: -5.4 + dx, y: 2.75, z: -5.93, line: 0 }));
  ball(0.13, glow(0xf4f0d8, 1.2), add({ x: -4.95, y: 3.05, z: -5.93, line: 0, detail: 1, sz: 0.2 })); // the moon
  box(1.7, 1.0, 0.5, CAB, add({ x: -7.6, y: 2.95, z: -5.72 }));
  box(1.0, 1.0, 0.5, CAB, add({ x: -3.75, y: 2.95, z: -5.72 }));
  for (const x of [-8.0, -7.2, -3.75]) box(0.04, 0.8, 0.03, 0xb9a878, add({ x: x + 0.38, y: 2.95, z: -5.46, line: 0 }));
  // Kitchen ceiling light
  box(1.6, 0.1, 0.5, glow(0xfff4d6, 1.3), add({ x: -6, y: 4.7, z: -4.6, line: 0 }));
  const kitchenLight = new THREE.PointLight(0xfff0d0, 3, 10, 1.5);
  kitchenLight.position.set(-6, 4.0, -3.8);
  g.add(kitchenLight);

  // ---- Hallway opening in the back wall (Morty comes in here) ----
  box(1.7, 3.2, 0.06, new THREE.MeshBasicMaterial({ color: 0x14101c }), add({ x: -1.5, y: 1.6, z: -5.96, line: 0 }));
  const TRIM = 0x8a6a45;
  for (const dx of [-0.95, 0.95]) box(0.2, 3.3, 0.12, TRIM, add({ x: -1.5 + dx, y: 1.65, z: -5.93, line: 0.02 }));
  box(2.1, 0.2, 0.12, TRIM, add({ x: -1.5, y: 3.35, z: -5.93, line: 0.02 }));
  // Family photos between the hallway and the couch
  [[0.3, 2.9, 0.7, 0.9, 0x4aa3e8], [1.25, 2.6, 0.9, 0.6, 0xe8c84a], [0.4, 1.9, 0.6, 0.6, 0xb45ae0]].forEach(([x, y, w, h, col]) => {
    box(w, h, 0.05, 0xe9e4d6, add({ x, y, z: -5.96, line: 0.025 }));
    box(w - 0.18, h - 0.18, 0.02, col, add({ x, y, z: -5.93, line: 0 }));
  });
  // Plant
  cyl(0.3, 0.5, 0xc0704a, add({ x: 0.9, y: 0.25, z: -5.2, radiusTop: 0.36 }));
  for (const [dx, dz, h] of [[0, 0, 1.3], [-0.2, 0.1, 0.9], [0.22, -0.05, 1.0]]) cone(0.26, h, 0x3f9a4a, add({ x: 0.9 + dx, y: 0.5 + h / 2, z: -5.2 + dz, sides: 5, rz: dx * -1.2 }));

  // ---- Living room: couch on the back wall, rug, coffee table, lamp, TV at the front ----
  const cx = 4.2, COUCH = 0x3f8a8f, CUSH = 0x58aab0;
  box(6.4, 0.03, 3.6, soft(0x7a5a9a), add({ x: cx, y: 0.02, z: -2.9, line: 0, cast: false }));   // rug
  box(5.8, 0.035, 3.0, soft(0x9a7ab8), add({ x: cx, y: 0.03, z: -2.9, line: 0, cast: false }));
  box(4.4, 0.5, 1.3, COUCH, add({ x: cx, y: 0.33, z: -4.75 }));
  box(4.4, 1.05, 0.35, COUCH, add({ x: cx, y: 0.95, z: -5.3 }));
  for (const s of [-1, 1]) {
    box(0.42, 0.85, 1.3, COUCH, add({ x: cx + s * 2.2, y: 0.5, z: -4.75 }));
    box(1.86, 0.16, 0.95, CUSH, add({ x: cx + s * 0.97, y: 0.66, z: -4.62, line: 0.025 }));
  }
  box(1.9, 0.1, 0.95, 0xa9713f, add({ x: cx, y: 0.45, z: -2.7 }));                   // coffee table
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.1, 0.42, 0.1, 0x7a5230, add({ x: cx + sx * 0.82, y: 0.21, z: -2.7 + sz * 0.36, line: 0.02 }));
  box(0.34, 0.03, 0.24, 0xd8423c, add({ x: cx - 0.45, y: 0.52, z: -2.65, ry: 0.3, line: 0.015 })); // magazine
  box(0.1, 0.03, 0.24, 0x2b2733, add({ x: cx + 0.2, y: 0.52, z: -2.8, ry: -0.4, line: 0.012 }));   // remote
  cyl(0.14, 0.1, 0x4aa3e8, add({ x: cx + 0.6, y: 0.55, z: -2.6, radiusTop: 0.18, line: 0.02 }));   // bowl
  cyl(0.24, 0.06, 0x59606e, add({ x: 7.4, y: 0.03, z: -5.05 }));                      // floor lamp
  cyl(0.03, 2.3, 0x59606e, add({ x: 7.4, y: 1.2, z: -5.05, line: 0.015 }));
  cyl(0.36, 0.5, glow(0xffdf9a, 1.25), add({ x: 7.4, y: 2.55, z: -5.05, radiusTop: 0.22, line: 0.03 }));
  const lamp = new THREE.PointLight(0xffd9a0, 3, 9, 1.5);
  lamp.position.set(7.2, 2.5, -4.3);
  g.add(lamp);
  box(2.8, 0.42, 0.7, 0x5a4636, add({ x: cx, y: 0.21, z: 5.2 }));                     // TV stand
  box(2.3, 1.0, 0.14, 0x1c1826, add({ x: cx, y: 0.95, z: 5.25 }));                    // TV, seen from behind
  const screen = box(2.1, 0.84, 0.02, glow(0x7ab8ff, 1.2), add({ x: cx, y: 0.95, z: 5.17, line: 0 }));
  const tv = new THREE.PointLight(0x7ab8ff, 2, 9, 1.5);
  tv.position.set(cx, 1.1, 3.9);
  g.add(tv);

  // ---- Right wall: the door to the garage. Something green glows under it. ----
  box(0.12, 3.1, 1.7, 0xb98a55, add({ x: 9.95, y: 1.55, z: 0 }));
  box(0.1, 3.3, 1.95, 0x7a5a36, add({ x: 9.99, y: 1.65, z: 0, line: 0.02 }));
  ball(0.08, 0xe8c84a, add({ x: 9.85, y: 1.45, z: -0.6, line: 0.025 }));
  box(0.05, 0.05, 1.6, glow(0x7dff4a, 1.6), add({ x: 9.9, y: 0.04, z: 0, line: 0 }));
  box(1.3, 0.05, 1.9, 0xb3936a, add({ x: 8.9, y: 0.03, z: 0, line: 0.03, cast: false }));
  const doorGlow = new THREE.PointLight(0x7dff4a, 1.5, 4, 1.5);
  doorGlow.position.set(9.3, 0.4, 0);
  const boom = new THREE.PointLight(0xb060ff, 0, 16, 1.2); // lit only when the garage explodes in the cold open
  boom.position.set(8.8, 1.6, 0);
  g.add(doorGlow, boom);
  box(0.5, 0.12, 1.2, 0x8a6a45, add({ x: 9.6, y: 0.5, z: 2.4, line: 0.02 }));         // shoe shelf
  for (const dz of [-0.5, 0.5]) box(0.5, 0.5, 0.1, 0x8a6a45, add({ x: 9.6, y: 0.25, z: 2.4 + dz, line: 0.02 }));
  box(0.3, 0.14, 0.3, 0xf7f5ee, add({ x: 9.55, y: 0.63, z: 2.2, line: 0.02 }));

  // ---- Front left: Jerry's "office" at the dining table, and his pitch board on an easel ----
  const tx = -6.2, tz = 2.6;
  box(2.6, 0.1, 1.4, 0xa9713f, add({ x: tx, y: 0.95, z: tz }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.12, 0.92, 0.12, 0x7a5230, add({ x: tx + sx * 1.15, y: 0.46, z: tz + sz * 0.55, line: 0.025 }));
  box(0.6, 0.04, 0.42, 0x59606e, add({ x: tx + 0.3, y: 1.02, z: tz, ry: 0.2, line: 0.02 }));        // laptop
  box(0.6, 0.4, 0.03, 0x59606e, add({ x: tx + 0.26, y: 1.22, z: tz - 0.22, ry: 0.2, rx: -0.2, line: 0.02 }));
  box(0.5, 0.3, 0.01, glow(0xbfe0ff, 1.15), add({ x: tx + 0.265, y: 1.22, z: tz - 0.2, ry: 0.2, rx: -0.2, line: 0 }));
  box(0.5, 0.1, 0.4, 0xf3f0ea, add({ x: tx - 0.6, y: 1.05, z: tz + 0.1, ry: -0.2, line: 0.02 }));   // rejection letters
  cyl(0.08, 0.16, 0xe8c84a, add({ x: tx - 0.1, y: 1.08, z: tz + 0.4, line: 0.02 }));
  const ex = -4.6, ez = 0.65;
  const easel = new THREE.Group();
  easel.position.set(ex, 0, ez);
  easel.rotation.y = 0.35;
  g.add(easel);
  for (const s of [-1, 1]) box(0.07, 2.3, 0.07, 0x8a6a45, { parent: easel, x: s * 0.5, y: 1.12, rz: s * 0.14, line: 0.02 });
  box(0.07, 2.2, 0.07, 0x8a6a45, { parent: easel, y: 1.08, z: -0.4, rx: -0.33, line: 0.02 });
  box(1.5, 1.05, 0.06, 0xf4efe2, { parent: easel, y: 1.5, z: 0.06 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.99), new THREE.MeshLambertMaterial({ map: boardTexture() }));
  sign.position.set(0, 1.5, 0.095);
  easel.add(sign);

  // Lighting: warm and low. One key light casts the shadows.
  g.add(new THREE.HemisphereLight(0xffe6c8, 0x45384f, 1.35));
  const key = new THREE.DirectionalLight(0xffe6c8, 1.15);
  key.position.set(2.5, 14, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  g.add(key);

  return {
    group: g,
    boom,
    bounds: { x0: -9.5, x1: 9.5, z0: -5.5, z1: 5.6 },
    colliders: [
      { x0: -10, x1: -3.3, z0: -6, z1: -4.9 },       // fridge and counter
      { x0: -6.75, x1: -6.05, z0: -4.9, z1: -4.1 },  // Beth
      { x0: 1.8, x1: 6.6, z0: -6, z1: -4.05 },       // couch (and Summer)
      { x0: 3.3, x1: 5.1, z0: -3.15, z1: -2.25 },    // coffee table
      { x0: 7.1, x1: 7.7, z0: -5.5, z1: -4.75 },     // lamp
      { x0: 0.5, x1: 1.3, z0: -5.6, z1: -4.85 },     // plant
      { x0: -7.5, x1: -4.9, z0: 1.9, z1: 3.3 },      // dining table
      { x0: -5.2, x1: -4.0, z0: 0.3, z1: 0.95 },     // easel
      { x0: -3.35, x1: -0.75, z0: 2.3, z1: 3.0 },    // Jerry and his chairs
      { x0: 2.8, x1: 5.6, z0: 4.8, z1: 6 },          // TV
      { x0: 9.3, x1: 10, z0: 1.7, z1: 3.1 },         // shoe shelf
    ],
    spots: {
      door: new THREE.Vector3(9.1, 0, 0),          // to the garage
      hall: new THREE.Vector3(-1.5, 0, -5.1),      // where Morty comes in
      beth: new THREE.Vector3(-6.4, 0, -4.4),
      plate: new THREE.Vector3(-5.6, 1.2, -5.25),  // the sandwich waits here
      summer: new THREE.Vector3(3.05, 0, -4.55),
      jerry: new THREE.Vector3(-3.0, 0, 2.65),
      chair: new THREE.Vector3(-1.75, 0, 2.65),
      tinyChair: new THREE.Vector3(-1.05, 0, 2.75),
    },
    update(time) {
      // The TV flickers on the couch
      const f = 1.6 + Math.sin(time * 9) * 0.25 + (Math.sin(time * 2.3) > 0.6 ? 0.7 : 0);
      tv.intensity = f;
      screen.material.color.setRGB(0.48, 0.72, 1).multiplyScalar(0.9 + f * 0.2);
      doorGlow.intensity = 1.5 + Math.sin(time * 11) * 0.4;
    },
  };
}

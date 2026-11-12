import * as THREE from 'three';
import { box, cyl, decal, soft, glow, shape } from '../engine/toon.js';

// Shrimp Rick's lab: three rooms in a row along x, each 16 wide (x 0-16, 16-32, 32-48) and 10 deep (z -5 to 5).
// Room 1: one goo channel to cross. Room 2: a glass wall and a patrol. Room 3: two channels, a patrol and a slot to shoot through.
// A door between rooms opens when Morty picks up that room's gun part.
const LEN = 48, D = 10, H = 5;

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = LEN * 32; c.height = D * 32;
  const g = c.getContext('2d');
  for (let x = 0; x < LEN; x++) for (let z = 0; z < D; z++) {
    const v = 52 + Math.floor(Math.random() * 10);
    g.fillStyle = `rgb(${v - 14},${v + 34},${v + 44})`;
    g.fillRect(x * 32, z * 32, 32, 32);
  }
  g.strokeStyle = '#17323a'; g.lineWidth = 2;
  for (let x = 0; x <= LEN; x++) { g.beginPath(); g.moveTo(x * 32, 0); g.lineTo(x * 32, c.height); g.stroke(); }
  for (let z = 0; z <= D; z++) { g.beginPath(); g.moveTo(0, z * 32); g.lineTo(c.width, z * 32); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const rect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });

export function buildLab() {
  const g = new THREE.Group();
  const add = (o) => ({ parent: g, ...o });
  const solids = [], hazards = [], glass = [];

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(LEN, D), new THREE.MeshLambertMaterial({ map: tileTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.x = LEN / 2;
  floor.receiveShadow = true;
  g.add(floor);
  box(LEN + 0.6, 0.5, 0.5, 0x101c24, add({ x: LEN / 2, y: -0.25, z: D / 2 + 0.25, cast: false }));
  const WALL = soft(0x8a3d58);
  box(LEN + 0.6, H, 0.3, WALL, add({ x: LEN / 2, y: H / 2, z: -D / 2 - 0.15, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: -0.15, y: H / 2, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: LEN + 0.15, y: H / 2, line: 0, cast: false }));
  box(LEN, 0.25, 0.1, 0x4a1f30, add({ x: LEN / 2, y: 0.125, z: -4.95, line: 0.02 }));

  // Low walls between rooms, with a doorway in the middle
  const doors = [];
  [[16, 'hasCrystal'], [32, 'hasCanister']].forEach(([x, flag]) => {
    for (const z of [-3.1, 3.1]) {
      box(0.5, 2.3, 3.8, 0x5d2c44, add({ x, y: 1.15, z }));
      solids.push(rect(x - 0.25, x + 0.25, z - 1.9, z + 1.9));
    }
    const mesh = box(0.3, 2.2, 2.4, 0xffb7a3, add({ x, y: 1.1 }));
    box(0.34, 0.25, 2.44, glow(0xff5a4a, 1.4), { parent: mesh, y: 0.5, line: 0 });
    doors.push({ x, flag, mesh, open: false, rect: rect(x - 0.25, x + 0.25, -1.2, 1.2) });
  });

  // Goo channels: glowing strips Morty cannot walk on. Shots fly over them.
  const goo = [];
  [[7, 10], [35.5, 38], [41, 43.5]].forEach(([x0, x1]) => {
    const w = x1 - x0;
    goo.push(box(w, 0.06, D, glow(0x38ffb0, 1.05), add({ x: x0 + w / 2, y: 0.02, line: 0, cast: false, receive: false })));
    for (const x of [x0, x1]) box(0.14, 0.12, D, 0x14323a, add({ x, y: 0.06, line: 0.02, cast: false }));
    hazards.push(rect(x0, x1, -5, 5));
  });

  // Room 2: glass wall in front of the canister
  const glassMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.22, depthWrite: false });
  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.5, D), glassMat);
  pane.position.set(27, 1.25, 0);
  g.add(pane);
  for (const z of [-4.9, -2.45, 0, 2.45, 4.9]) box(0.18, 2.6, 0.18, 0x2c4a55, add({ x: 27, y: 1.3, z, line: 0.025 }));
  box(0.2, 0.12, D, 0x2c4a55, add({ x: 27, y: 2.56, line: 0.025 }));
  glass.push(rect(26.9, 27.1, -5, 5));

  // Room 3: a barrier with one slot in the middle. The shot has to go through the slot.
  for (const z of [-3, 3]) {
    box(0.5, 2.3, 4, 0x5d2c44, add({ x: 44, y: 1.15, z }));
    solids.push(rect(43.75, 44.25, z - 2, z + 2));
  }
  box(0.52, 0.3, 2, glow(0xffb03a, 1.1), add({ x: 44, y: 2.3, line: 0, cast: false }));

  // Back wall dressing in every room: propaganda banners, pipes, glowing tanks, a console
  const BANNER = 0xff8fa0;
  for (let r = 0; r < 3; r++) {
    const x0 = r * 16;
    for (const dx of [3.2, 12.8]) {
      const bx = x0 + dx;
      box(1.7, 2.9, 0.08, BANNER, add({ x: bx, y: 3.0, z: -4.95 }));
      cyl(0.55, 0.06, 0xfff2ea, add({ x: bx, y: 3.25, z: -4.88, rx: Math.PI / 2, sides: 12, line: 0.02 }));
      shape(new THREE.TorusGeometry(0.27, 0.085, 4, 8, Math.PI * 1.35), 0xd9503f, add({ x: bx, y: 3.25, z: -4.82, rz: 1.2, line: 0 }));
      box(1.1, 0.14, 0.05, 0xd9503f, add({ x: bx, y: 2.05, z: -4.9, line: 0 }));
    }
    cyl(0.12, 15.6, 0x3d6e7a, add({ x: x0 + 8, y: 4.5, z: -4.75, rz: Math.PI / 2, line: 0.03 }));
    const tx = x0 + 8;
    cyl(0.75, 0.3, 0x2c4a55, add({ x: tx, y: 0.15, z: -4.1 }));
    cyl(0.62, 2.4, glow([0x38ffb0, 0xff7a9a, 0xc45aff][r], 1.15), add({ x: tx, y: 1.5, z: -4.1, sides: 10, line: 0.03 }));
    cyl(0.75, 0.25, 0x2c4a55, add({ x: tx, y: 2.8, z: -4.1 }));
    solids.push(rect(tx - 0.8, tx + 0.8, -5, -3.35));
    box(1.4, 0.9, 0.6, 0x3d6e7a, add({ x: x0 + 5.4, y: 0.45, z: -4.6 }));
    box(1.2, 0.5, 0.1, glow(0x9fe8ff, 1.1), add({ x: x0 + 5.4, y: 1.1, z: -4.75, rx: -0.3, line: 0.02 }));
    solids.push(rect(x0 + 4.6, x0 + 6.2, -5, -4.2));
    const lamp = new THREE.PointLight([0x5dffc8, 0xff8fb0, 0xc890ff][r], 5, 13, 1.4);
    lamp.position.set(tx, 3.4, -2.6);
    g.add(lamp);
  }

  // Where each gun part floats, with a glowing ring on the floor under it
  const partSpots = [new THREE.Vector3(13, 0, -1.5), new THREE.Vector3(29.6, 0, 0), new THREE.Vector3(46.4, 0, 2.6)];
  partSpots.forEach((p, i) => decal(0.55, [0x4affe0, 0xc45aff, 0xffb03a][i], 0.35, add({ x: p.x, z: p.z })));

  // Lighting: cool fill, one overhead key light that follows Morty so its shadow stays sharp
  g.add(new THREE.HemisphereLight(0xa8f0ff, 0x4a2a44, 1.35));
  const key = new THREE.DirectionalLight(0xfff0e6, 1.25);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  g.add(key, key.target);
  const alarm = new THREE.PointLight(0xff2a2a, 0, 30, 1.2);
  alarm.position.set(46, 3.5, 0);
  g.add(alarm);

  return {
    group: g,
    bounds: { x0: 0.45, x1: 47.55, z0: -4.55, z1: 4.6 },
    solids, hazards, glass, doors, partSpots, alarm,
    starts: [new THREE.Vector3(2, 0, 0), new THREE.Vector3(17.6, 0, 0), new THREE.Vector3(34, 0, 0)], // each start is out of every guard's sight
    update(time, focusX) {
      key.position.set(focusX - 2.5, 14, 4.5);
      key.target.position.set(focusX, 0, 0);
      goo.forEach((m, i) => { m.position.y = 0.02 + Math.sin(time * 2 + i) * 0.012; });
    },
  };
}

import * as THREE from 'three';
import { box, cyl, ball, cone, decal, soft, glow } from '../engine/toon.js';
import { PARTS } from '../objects/models.js';

// The Citadel of Ricks, Rick ID Services and Lost and Found. Clean white-blue panels, a tiled floor, a round window
// onto space. Left to right it is one long trip through bureaucracy:
//   the public hall (number machine, the line of Ricks, Desk Rick's counter in the first railing),
//   the waiting pen (vending machine, Bored Rick's bench, Guard Rick at a force field in the second railing),
//   the back office (Cop Rick in front of the lost and found cage; the chip glows in a bin inside).
// Room is 24 wide (x from -12 to 12) and 12 deep (z from -6 at the back wall to 6 at the front).
const W = 24, D = 12, H = 5;
export const RAIL1 = 2;   // x of the first railing (Desk Rick's counter and the swing gate)
export const RAIL2 = 7;   // x of the second railing (Guard Rick's force field)

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = W * 40; c.height = D * 40;
  const g = c.getContext('2d');
  g.fillStyle = '#c9d6e6'; g.fillRect(0, 0, c.width, c.height);
  // Big square tiles with thin grout and a slightly different shade every few tiles
  for (let x = 0; x < W; x++) for (let z = 0; z < D; z++) {
    g.fillStyle = (x * 7 + z * 3) % 5 === 0 ? '#bccbdd' : '#c9d6e6';
    g.fillRect(x * 40 + 2, z * 40 + 2, 36, 36);
  }
  g.strokeStyle = '#9fb0c6'; g.lineWidth = 2;
  for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * 40, 0); g.lineTo(x * 40, c.height); g.stroke(); }
  for (let z = 0; z <= D; z++) { g.beginPath(); g.moveTo(0, z * 40); g.lineTo(c.width, z * 40); g.stroke(); }
  // The painted "WAIT HERE" path along the line
  g.fillStyle = '#ffd84c'; g.globalAlpha = 0.7;
  for (let x = 1.2; x < 13.6; x += 0.9) g.fillRect(x * 40, 5.0 * 40, 18, 4);
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A sign drawn on a canvas. Returns the mesh; mesh.userData.draw(text) redraws it (the NOW SERVING board).
function sign(text, w, h, o) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * h / w);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (t) => {
    const g = c.getContext('2d');
    g.fillStyle = o.bg ?? '#15101c'; g.fillRect(0, 0, c.width, c.height);
    const lines = t.split('\n');
    const size = Math.round((c.height / lines.length) * (o.size ?? 0.62));
    g.font = `900 ${size}px ${o.font ?? 'Trebuchet MS'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((ln, i) => {
      const y = (c.height / lines.length) * (i + 0.5) + 2;
      g.lineWidth = size * 0.12; g.strokeStyle = '#000'; g.strokeText(ln, c.width / 2, y);
      g.fillStyle = o.color; g.fillText(ln, c.width / 2, y);
    });
    tex.needsUpdate = true;
  };
  draw(text);
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  mat.color.setScalar(o.bright ?? 1.2); mat.toneMapped = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(o.x, o.y, o.z);
  if (o.ry) m.rotation.y = o.ry;
  m.userData.draw = draw;
  o.parent.add(m);
  return m;
}

// The view out of the round window: black space, stars, a ringed planet
function spaceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 40, 256, 256, 300);
  grad.addColorStop(0, '#1a1650'); grad.addColorStop(1, '#05030f');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) {
    g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
    const s = Math.random() < 0.1 ? 3 : 1.6;
    g.fillRect(Math.random() * 512, Math.random() * 512, s, s);
  }
  g.fillStyle = '#ff8a5a'; g.beginPath(); g.arc(340, 300, 70, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#d4603a'; g.beginPath(); g.arc(360, 320, 52, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffd8a0'; g.lineWidth = 8; g.beginPath(); g.ellipse(340, 300, 130, 26, -0.3, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A brass post with a velvet rope to the next one
function stanchions(parent, points) {
  points.forEach((p, i) => {
    cyl(0.06, 0.95, 0xd4a83a, { parent, x: p[0], y: 0.48, z: p[1], line: 0.015 });
    ball(0.08, 0xd4a83a, { parent, x: p[0], y: 0.98, z: p[1], line: 0.015, detail: 0 });
    cyl(0.16, 0.04, 0x8a6a2a, { parent, x: p[0], y: 0.02, z: p[1], line: 0.012, cast: false });
    const q = points[i + 1];
    if (!q) return;
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    const rope = cyl(0.035, len, 0xb02a3a, { parent, x: (p[0] + q[0]) / 2, y: 0.82, z: (p[1] + q[1]) / 2, line: 0.01, sides: 5 });
    rope.rotation.order = 'YXZ';
    rope.rotation.set(Math.PI / 2, Math.atan2(q[0] - p[0], q[1] - p[1]), 0);
  });
}

export function buildCitadel() {
  const g = new THREE.Group();
  const add = (o) => ({ parent: g, ...o });

  // ---- Floor, walls, ceiling strips ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: floorTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  box(W + 0.6, 0.5, 0.5, 0x2a3348, add({ y: -0.25, z: D / 2 + 0.25, cast: false }));
  const WALL = soft(0xa9bcd4), PANEL = soft(0x8ea4c0);
  box(W + 0.6, H, 0.3, WALL, add({ y: H / 2, z: -D / 2 - 0.15, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: -W / 2 - 0.15, y: H / 2, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: W / 2 + 0.15, y: H / 2, line: 0, cast: false }));
  // Panel seams and a cyan light strip along the back wall
  for (let x = -11; x <= 11; x += 2.2) box(0.08, H, 0.05, PANEL, add({ x, y: H / 2, z: -5.98, line: 0, cast: false }));
  box(W, 0.08, 0.08, glow(0x6fe6ff, 1.5), add({ y: 4.4, z: -5.92, line: 0, cast: false }));
  box(W, 0.3, 0.06, soft(0x6f86a4), add({ y: 0.15, z: -5.95, line: 0, cast: false }));
  for (const x of [-11.95, 11.95]) box(0.08, 0.08, D, glow(0x6fe6ff, 1.5), add({ x, y: 4.4, line: 0, cast: false }));

  // Round window onto space, top left of the back wall
  const win = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), new THREE.MeshBasicMaterial({ map: spaceTexture() }));
  win.position.set(-8.6, 2.8, -5.96);
  g.add(win);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.12, 6, 24), soft(0xdfe8f2));
  rim.position.copy(win.position);
  g.add(rim);

  // Signs
  sign('RICK ID SERVICES', 5.0, 0.7, add({ x: -3.5, y: 4.0, z: -5.95, color: '#6fe6ff' }));
  sign('LOST & FOUND', 3.2, 0.6, add({ x: 9.6, y: 4.0, z: -5.95, color: '#ffd84c' }));
  const board = sign('NOW SERVING\n4,000,112', 2.6, 1.0, add({ x: RAIL1, y: 3.3, z: -5.95, color: '#ff4a3a', font: 'Courier New', size: 0.78, bright: 1.5 }));

  // ---- Public hall: the number machine and the line ----
  const mx = -9.4, mz = 1.2;
  cyl(0.38, 1.4, 0xd03a3a, add({ x: mx, y: 0.7, z: mz, sides: 8 }));
  ball(0.4, 0xd03a3a, add({ x: mx, y: 1.45, z: mz, sy: 0.5, detail: 1 }));
  box(0.5, 0.3, 0.06, 0x15101c, add({ x: mx + 0.36, y: 1.15, z: mz, ry: Math.PI / 2, line: 0.012 }));
  const machineScreen = sign('TAKE A\nNUMBER', 0.44, 0.24, add({ x: mx + 0.4, y: 1.15, z: mz, ry: Math.PI / 2, color: '#ff4a3a', font: 'Courier New', size: 0.75, bright: 1.4 }));
  const ticketSlot = box(0.2, 0.04, 0.1, 0xf4efe2, add({ x: mx + 0.42, y: 0.85, z: mz, line: 0.01 }));

  // The line: a lane of velvet ropes from the back of the hall to Desk Rick's counter
  const LANE = { z0: -1.6, z1: 0.2 };
  stanchions(g, [[-7.2, LANE.z0], [-4.6, LANE.z0], [-2, LANE.z0], [0.6, LANE.z0], [1.6, LANE.z0]]);
  stanchions(g, [[-7.2, LANE.z1], [-4.6, LANE.z1], [-2, LANE.z1], [0.4, LANE.z1]]);

  // Waiting chairs nobody sits in, along the front
  for (let i = 0; i < 4; i++) {
    const x = -6.4 + i * 0.75;
    box(0.6, 0.08, 0.55, 0x6f86a4, add({ x, y: 0.48, z: 4.4 }));
    box(0.6, 0.55, 0.08, 0x6f86a4, add({ x, y: 0.78, z: 4.7 }));
    cyl(0.03, 0.46, 0xc8c8d0, add({ x, y: 0.23, z: 4.4, line: 0.01 }));
  }
  // A potted plant that has given up
  cyl(0.3, 0.5, 0xd4a83a, add({ x: -11.2, y: 0.25, z: -4.8, radiusTop: 0.36 }));
  for (let i = 0; i < 5; i++) cone(0.12, 0.7, 0x6a8a4a, add({ x: -11.2 + Math.sin(i * 1.3) * 0.15, y: 0.75, z: -4.8 + Math.cos(i * 1.3) * 0.15, rz: Math.sin(i * 1.3) * 0.5, rx: Math.cos(i * 1.3) * 0.5, sides: 4 }));

  // ---- First railing: Desk Rick's counter in the middle, a swing gate beside it ----
  const RAIL = 0xdfe8f2, GLASS = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.22, depthWrite: false });
  const railing = (x, z0, z1) => {
    box(0.12, 1.0, z1 - z0, GLASS, add({ x, y: 0.55, z: (z0 + z1) / 2, line: 0, cast: false, receive: false }));
    box(0.18, 0.08, z1 - z0, RAIL, add({ x, y: 1.08, z: (z0 + z1) / 2, line: 0.015 }));
    for (let z = z0; z <= z1 + 0.01; z += Math.max(0.5, (z1 - z0) / Math.ceil((z1 - z0) / 1.5))) cyl(0.05, 1.1, RAIL, add({ x, y: 0.55, z, line: 0.012 }));
  };
  railing(RAIL1, -6, -2.0);
  // The counter: z from -2 to 0.6, Desk Rick stands behind it on the right
  box(0.9, 1.1, 2.6, 0x6f86a4, add({ x: RAIL1, y: 0.55, z: -0.7 }));
  box(1.05, 0.08, 2.75, 0xf4efe2, add({ x: RAIL1, y: 1.14, z: -0.7, line: 0.02 }));
  box(0.05, 0.08, 2.4, glow(0x6fe6ff, 1.3), add({ x: RAIL1 - 0.46, y: 0.9, z: -0.7, line: 0 }));
  // Paperwork: stacks of forms, a stamp, an IN tray
  for (let i = 0; i < 3; i++) box(0.3, 0.06 + i * 0.07, 0.4, 0xf4efe2, add({ x: RAIL1 + 0.1, y: 1.2 + i * 0.035, z: -1.6 + i * 0.45, ry: i * 0.2, line: 0.01 }));
  cyl(0.06, 0.14, 0x8a2c3a, add({ x: RAIL1 - 0.15, y: 1.25, z: 0.1, line: 0.012 }));
  railing(RAIL1, 0.6, 1.9);
  // Swing gate between z 1.9 and 3.3, hinged at z 1.9
  const gate = new THREE.Group();
  gate.position.set(RAIL1, 0, 1.9);
  g.add(gate);
  box(0.1, 0.9, 1.35, 0xd4a83a, { parent: gate, y: 0.6, z: 0.68, line: 0.02 });
  box(0.12, 0.3, 0.6, glow(0xff4a3a, 1.2), { parent: gate, y: 0.65, z: 0.7, line: 0 });
  railing(RAIL1, 3.3, 6);

  // ---- Waiting pen: vending machine, Bored Rick's bench ----
  const vx = 3.4, vz = -5.2;
  box(1.2, 2.2, 0.8, 0x2c4a8a, add({ x: vx, y: 1.1, z: vz }));
  box(0.8, 1.4, 0.05, glow(0x6fe6ff, 0.8), add({ x: vx - 0.12, y: 1.3, z: vz + 0.41, line: 0 }));
  sign('SOLD OUT', 0.75, 0.2, add({ x: vx - 0.12, y: 1.5, z: vz + 0.44, color: '#ff4a3a', size: 0.7 }));
  box(0.2, 0.5, 0.05, 0x15101c, add({ x: vx + 0.42, y: 1.3, z: vz + 0.42, line: 0.01 }));
  box(0.6, 0.3, 0.05, 0xb8c0cc, add({ x: vx - 0.4, y: 2.0, z: vz + 0.42, rz: 0.3, line: 0.01 })); // the dent he kicked into it
  box(2.4, 0.12, 0.6, 0xa9713f, add({ x: 4.8, y: 0.5, z: 4.6 }));
  for (const x of [3.8, 5.8]) box(0.1, 0.45, 0.5, 0x5a3a2a, add({ x, y: 0.23, z: 4.6 }));

  // ---- Second railing: Guard Rick's force field, z from 0.4 to 2.2 ----
  railing(RAIL2, -6, 0.4);
    railing(RAIL2, 2.2, 6);
  for (const z of [0.4, 2.2]) box(0.3, 2.4, 0.3, 0x6f86a4, add({ x: RAIL2, y: 1.2, z }));
  box(0.3, 0.2, 2.1, 0x6f86a4, add({ x: RAIL2, y: 2.4, z: 1.3 }));
  const fieldMat = new THREE.MeshBasicMaterial({ color: 0xff4a6a, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  fieldMat.color.multiplyScalar(1.4); fieldMat.toneMapped = false;
  const field = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.2), fieldMat);
  field.position.set(RAIL2, 1.15, 1.3);
  field.rotation.y = Math.PI / 2;
  g.add(field);

  // ---- Back office: the lost and found cage with the chip in a bin ----
  const cx0 = 8.2, cx1 = 11.8, cz0 = -6, cz1 = -2.6;
  const BAR = 0x9aa0ac;
  for (let x = cx0; x <= cx1; x += 0.3) if (x < 9.4 || x > 10.6) cyl(0.025, 2.4, BAR, add({ x, y: 1.2, z: cz1, line: 0.01, sides: 5 }));
  for (let z = cz0; z <= cz1; z += 0.3) cyl(0.025, 2.4, BAR, add({ x: cx0, y: 1.2, z, line: 0.01, sides: 5 }));
  box(cx1 - cx0, 0.08, 0.08, BAR, add({ x: (cx0 + cx1) / 2, y: 2.4, z: cz1, line: 0.012 }));
  box(0.08, 0.08, cz1 - cz0, BAR, add({ x: cx0, y: 2.4, z: (cz0 + cz1) / 2, line: 0.012 }));
  // Cage door (slides up when Cop Rick lets Morty in)
  const cageDoor = new THREE.Group();
  cageDoor.position.set(10, 0, cz1);
  g.add(cageDoor);
  for (let x = -0.55; x <= 0.56; x += 0.22) cyl(0.025, 2.3, BAR, { parent: cageDoor, x, y: 1.15, line: 0.01, sides: 5 });
  box(1.2, 0.06, 0.06, BAR, { parent: cageDoor, y: 1.2, line: 0.01 });
  // Inside: shelves of forty identical lab coats, and the bin
  for (let i = 0; i < 8; i++) box(0.4, 1.0, 0.1, 0xf3f3ee, add({ x: 8.7 + i * 0.4, y: 1.6, z: -5.7, rz: 0.05 * Math.sin(i * 3), line: 0.012 }));
  cyl(0.02, 3.4, 0xc8c8d0, add({ x: 10.1, y: 2.12, z: -5.7, rz: Math.PI / 2, line: 0.01 }));
  const bx = 10.6, bz = -4.2;
  box(1.1, 0.7, 0.8, 0x4a6a9a, add({ x: bx, y: 0.35, z: bz }));
  box(1.15, 0.06, 0.85, 0x3a5a8a, add({ x: bx, y: 0.72, z: bz, line: 0.015 }));
  for (let i = 0; i < 6; i++) ball(0.12, [0xff8fb0, 0x6dd6ff, 0xffd84c, 0xf3f3ee, 0x9a6bff, 0xf3f3ee][i], add({ x: bx - 0.35 + (i % 3) * 0.35, y: 0.78, z: bz - 0.2 + Math.floor(i / 3) * 0.35, line: 0.015, detail: 0 }));
  sign('LOST\nFOUND', 0.7, 0.4, add({ x: bx, y: 0.4, z: bz + 0.41, color: '#ffd84c', size: 0.7 }));
  const chip = PARTS[2].make({ parent: g });
  chip.position.set(bx, 1.15, bz);
  const chipLight = new THREE.PointLight(0xffb03a, 3, 4, 1.5);
  chipLight.position.set(bx, 1.6, bz + 0.3);
  g.add(chipLight);
  decal(0.7, 0x000000, 0.22, add({ x: -9.6, z: 3.4, sx: 1.3 })); // where the portal lands

  // Lighting: cool and even like an office, with warm light only on the chip. Keep it low: the floor is pale.
  g.add(new THREE.HemisphereLight(0xdfeaff, 0x3a4058, 1.0));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(2, 14, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -15, right: 15, top: 12, bottom: -12, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  g.add(key);
  const fills = [[-6, 1], [4.5, 1], [9.8, -3]].map(([x, z]) => {
    const l = new THREE.PointLight(0x9fd8ff, 1.6, 10, 1.5);
    l.position.set(x, 3.8, z);
    g.add(l);
    return l;
  });

  const rect = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
  return {
    group: g,
    bounds: { x0: -11.6, x1: 11.6, z0: -5.6, z1: 5.6 },
    colliders: [
      rect(mx - 0.45, mx + 0.45, mz - 0.45, mz + 0.45),          // number machine
      rect(-7.3, 1.7, LANE.z0 - 0.08, LANE.z0 + 0.08),            // the line's ropes
      rect(-7.3, 0.5, LANE.z1 - 0.08, LANE.z1 + 0.08),
      rect(RAIL1 - 0.15, RAIL1 + 0.15, -6, -2.0),                  // first railing
      rect(RAIL1 - 0.5, RAIL1 + 0.5, -2.0, 0.6),                   // Desk Rick's counter
      rect(RAIL1 - 0.15, RAIL1 + 0.15, 0.6, 1.9),
      rect(RAIL1 - 0.15, RAIL1 + 0.15, 3.3, 6),
      rect(vx - 0.65, vx + 0.65, -6, vz + 0.45),                   // vending machine
      rect(3.5, 6.1, 4.25, 4.95),                                  // bench
      rect(RAIL2 - 0.15, RAIL2 + 0.15, -6, 0.55),                  // second railing and the field's posts
      rect(RAIL2 - 0.15, RAIL2 + 0.15, 2.05, 6),
      rect(cx0 - 0.1, cx0 + 0.1, cz0, cz1 + 0.1),                  // cage side
      rect(cx0, 9.45, cz1 - 0.1, cz1 + 0.1),                       // cage front, left of the door
      rect(10.55, cx1, cz1 - 0.1, cz1 + 0.1),                      // cage front, right of the door
      rect(bx - 0.6, bx + 0.6, bz - 0.45, bz + 0.45),              // the bin
      rect(-11.6, -10.8, -5.6, -4.2),                              // plant
      rect(-6.8, -3.9, 4.1, 4.9),                                  // chairs
    ],
    // Doors that close the way until the puzzle opens them
    doors: {
      gate: rect(RAIL1 - 0.15, RAIL1 + 0.15, 1.9, 3.3),
      field: rect(RAIL2 - 0.15, RAIL2 + 0.15, 0.4, 2.2),
      cage: rect(9.4, 10.6, cz1 - 0.1, cz1 + 0.1),
    },
    spots: {
      portal: new THREE.Vector3(-9.6, 0, 3.4),
      arrive: new THREE.Vector3(-8.2, 0, 3.6),
      machine: new THREE.Vector3(mx, 0, mz),
      backOfLine: new THREE.Vector3(-7.9, 0, -0.7),
      queue: [-5.8, -4.6, -3.4, -2.2, -1.0].map((x) => new THREE.Vector3(x, 0, -0.7)),
      jerry: new THREE.Vector3(0.3, 0, -0.7),       // at the very front: number 4,000,113
      desk: new THREE.Vector3(RAIL1 + 0.85, 0, -0.5),
      deskTalk: new THREE.Vector3(RAIL1 - 0.4, 0, -0.5),
      clerk: new THREE.Vector3(RAIL1 + 0.9, 0, 1.4),
      janitor: new THREE.Vector3(-3.0, 0, 2.8),
      vending: new THREE.Vector3(vx, 0, vz + 0.5),
      gossip: new THREE.Vector3(4.6, 0, -4.4),
      bored: new THREE.Vector3(4.4, 0, 4.55),
      guard: new THREE.Vector3(RAIL2 - 0.7, 0, 2.9),
      cop: new THREE.Vector3(10, 0, -1.9),
      copAside: new THREE.Vector3(11.1, 0, -1.6),
      bin: new THREE.Vector3(bx, 0, bz),
      binTalk: new THREE.Vector3(bx, 0, bz + 0.5),
      chip: new THREE.Vector3(bx, 1.15, bz),
      shrimp: new THREE.Vector3(-1.5, 0, 3.2),       // where Shrimp Rick's portal rips open at the end
    },
    gate, field, cageDoor, chip, chipLight, board, machineScreen, ticketSlot,
    update(time) {
      field.material.opacity = field.visible ? 0.35 + Math.sin(time * 9) * 0.08 : 0;
      chip.rotation.y = time * 1.5;
      if (chip.visible) chip.position.y = 1.15 + Math.sin(time * 2.5) * 0.06;
      chipLight.intensity = chip.visible ? 2.6 + Math.sin(time * 4) * 0.5 : 0;
      fills.forEach((l, i) => { l.intensity = 1.6 + Math.sin(time * 0.7 + i) * 0.05; });
    },
  };
}

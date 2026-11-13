import * as THREE from 'three';
import { box, cyl, ball, cone, decal, soft, glow } from '../engine/toon.js';
import { buildSoda } from '../objects/aliens.js';
import { PARTS } from '../objects/models.js';

// Blips and Chitz at two in the morning: dark carpet with neon squiggles, rows of cabinets with glowing screens,
// Gorbi's prize counter on the left of the back wall (the soda on the top shelf, in a spotlight), a claw machine,
// Glorp's machine on the left wall, and the Ticket Tumble floor on the right: a big grid of light-up tiles.
// Room is 20 wide (x from -10 to 10) and 12 deep (z from -6 at the back wall to 6 at the front).
const W = 20, D = 12, H = 5;
export const PAD = { x0: 1, x1: 9, z0: -3.2, z1: 2.8 }; // the Ticket Tumble floor
const NEON = [0xff5fa2, 0x5dfff0, 0xffd84c, 0xa86bff, 0x6dff4a];

function carpetTexture() {
  const c = document.createElement('canvas');
  c.width = W * 48; c.height = D * 48;
  const g = c.getContext('2d');
  g.fillStyle = '#1d1838'; g.fillRect(0, 0, c.width, c.height);
  // Neon squiggles, triangles and rings, like every arcade carpet ever
  const cols = ['#ff5fa2', '#5dfff0', '#ffd84c', '#a86bff'];
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height, s = 8 + Math.random() * 14;
    g.strokeStyle = g.fillStyle = cols[i % cols.length];
    g.globalAlpha = 0.55; g.lineWidth = 4;
    const k = i % 3;
    g.beginPath();
    if (k === 0) { g.moveTo(x, y); for (let j = 1; j < 5; j++) g.lineTo(x + j * s * 0.6, y + (j % 2 ? s : 0)); g.stroke(); }
    else if (k === 1) { g.arc(x, y, s * 0.6, 0, Math.PI * 2); g.stroke(); }
    else { g.moveTo(x, y - s * 0.6); g.lineTo(x + s * 0.55, y + s * 0.4); g.lineTo(x - s * 0.55, y + s * 0.4); g.closePath(); g.fill(); }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A sign drawn on a canvas: big letters with a dark outline
function signTexture(text, w, h, color, size = 0.62) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#15101c'; g.fillRect(0, 0, w, h);
  g.font = `900 ${Math.round(h * size)}px Trebuchet MS`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = h * 0.08; g.strokeStyle = '#000'; g.strokeText(text, w / 2, h / 2 + 2);
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sign(text, w, h, color, o) {
  const mat = new THREE.MeshBasicMaterial({ map: signTexture(text, 512, Math.round(512 * h / w), color) });
  mat.color.setScalar(1.25); mat.toneMapped = false; // a touch brighter than white, so the glow picks it up
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(o.x, o.y, o.z);
  if (o.ry) m.rotation.y = o.ry;
  o.parent.add(m);
  return m;
}

// An arcade cabinet facing +z: body, screen, marquee and two buttons
function cabinet(parent, color, screen) {
  const g = new THREE.Group();
  parent.add(g);
  box(1.0, 1.9, 0.9, color, { parent: g, y: 0.95 });
  box(0.86, 0.68, 0.06, 0x15101c, { parent: g, y: 1.38, z: 0.42, rx: -0.12, line: 0.015 });
  const scr = box(0.74, 0.56, 0.02, glow(screen, 1.1), { parent: g, y: 1.38, z: 0.46, rx: -0.12, line: 0 });
  box(1.0, 0.3, 0.12, glow(screen, 1.35), { parent: g, y: 2.0, z: 0.4, line: 0.02 });
  box(0.96, 0.12, 0.42, 0x2b2733, { parent: g, y: 0.98, z: 0.6, rx: 0.2, line: 0.02 });
  for (const s of [-0.18, 0.18]) ball(0.05, glow(NEON[(s > 0) + 1], 1.5), { parent: g, x: s, y: 1.06, z: 0.66, line: 0.01, detail: 0 });
  return { group: g, screen: scr };
}

export function buildArcade() {
  const g = new THREE.Group();
  const add = (o) => ({ parent: g, ...o });

  // Floor and walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshLambertMaterial({ map: carpetTexture() }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  box(W + 0.6, 0.5, 0.5, 0x15101c, add({ y: -0.25, z: D / 2 + 0.25, cast: false }));
  const WALL = soft(0x3b2a5c);
  box(W + 0.6, H, 0.3, WALL, add({ y: H / 2, z: -D / 2 - 0.15, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: -W / 2 - 0.15, y: H / 2, line: 0, cast: false }));
  box(0.3, H, D, WALL, add({ x: W / 2 + 0.15, y: H / 2, line: 0, cast: false }));
  // Neon strips along the top of the walls
  box(W, 0.08, 0.08, glow(0xff5fa2, 1.5), add({ y: 4.3, z: -5.95, line: 0, cast: false }));
  box(0.08, 0.08, D, glow(0x5dfff0, 1.5), add({ x: -9.95, y: 4.3, line: 0, cast: false }));
  box(0.08, 0.08, D, glow(0x5dfff0, 1.5), add({ x: 9.95, y: 4.3, line: 0, cast: false }));
  sign('BLIPS AND CHITZ', 5.6, 0.9, '#ffd84c', add({ x: -1.2, y: 3.75, z: -5.97 }));

  // ---- Back wall, left: Gorbi's prize counter and the prize shelves ----
  const px = -6.1;
  box(5.0, 1.1, 0.9, 0x5a3d8a, add({ x: px, y: 0.55, z: -4.55 }));
  box(5.1, 0.1, 1.0, 0xe9e2cf, add({ x: px, y: 1.15, z: -4.55, line: 0.025 }));
  box(4.8, 0.09, 0.05, glow(0x5dfff0, 1.4), add({ x: px, y: 0.9, z: -4.08, line: 0 }));
  sign('PRIZES', 2.2, 0.6, '#5dfff0', add({ x: px, y: 4.15, z: -5.95 }));
  for (const y of [1.55, 2.35]) box(4.6, 0.08, 0.5, 0xa9713f, add({ x: px, y, z: -5.7 }));
  // Junk prizes: plush balls, rubber ducks (cones), tiny boxes
  const JUNK = [0xff8fb0, 0x6dd6ff, 0xffd84c, 0x9a6bff, 0x7dff9a, 0xff9a4a];
  for (const [y, n] of [[1.59, 8], [2.39, 7]]) for (let i = 0; i < n; i++) {
    const x = px - 2.0 + i * (4.0 / (n - 1)), col = JUNK[(i + n) % JUNK.length];
    if (i % 3 === 0) ball(0.16, col, add({ x, y: y + 0.16, z: -5.65, line: 0.02 }));
    else if (i % 3 === 1) cone(0.13, 0.3, col, add({ x, y: y + 0.15, z: -5.65, line: 0.02 }));
    else box(0.24, 0.24, 0.24, col, add({ x, y: y + 0.12, z: -5.65, ry: 0.4, line: 0.02 }));
  }
  // Top shelf, in a spotlight: the grand prize. Rick's Focus Crystal (traded for nachos last night), and a soda next to it.
  box(1.6, 0.08, 0.5, 0xa9713f, add({ x: px, y: 3.1, z: -5.7 }));
  cyl(0.3, 0.14, 0xffd84c, add({ x: px - 0.3, y: 3.21, z: -5.65 }));
  const crystal = PARTS[0].make({ parent: g });
  crystal.position.set(px - 0.3, 3.62, -5.6);
  const soda = buildSoda(1.3);
  soda.position.set(px + 0.42, 3.14, -5.6);
  g.add(soda);
  const spot = new THREE.SpotLight(0xfff2c0, 9, 5, 0.45, 0.5, 1.2);
  spot.position.set(px, 4.6, -4.4);
  spot.target.position.set(px, 3.4, -5.6);
  g.add(spot, spot.target);
  sign('2500', 0.8, 0.26, '#ffd84c', add({ x: px, y: 2.88, z: -5.44 }));

  // ---- Back wall, middle: the claw machine ----
  const cx = -1.4;
  box(1.3, 1.0, 1.3, 0xff5fa2, add({ x: cx, y: 0.5, z: -5.0 }));
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.18, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.2, 1.24), glassMat);
  glass.position.set(cx, 1.6, -5.0);
  g.add(glass);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.08, 1.2, 0.08, 0x2b2733, add({ x: cx + sx * 0.62, y: 1.6, z: -5.0 + sz * 0.62, line: 0.015 }));
  box(1.36, 0.35, 1.36, 0xff5fa2, add({ x: cx, y: 2.38, z: -5.0 }));
  box(1.2, 0.18, 0.05, glow(0xffd84c, 1.4), add({ x: cx, y: 2.38, z: -4.3, line: 0 }));
  for (let i = 0; i < 6; i++) ball(0.15, JUNK[i], add({ x: cx - 0.35 + (i % 3) * 0.35, y: 1.17 + Math.floor(i / 3) * 0.12, z: -5.15 + Math.floor(i / 3) * 0.3, line: 0.02 }));
  const claw = new THREE.Group();
  claw.position.set(cx, 2.05, -5.0);
  g.add(claw);
  cyl(0.015, 0.3, 0xc8c8d0, { parent: claw, y: 0.05, line: 0 });
  for (let i = 0; i < 3; i++) box(0.03, 0.18, 0.03, 0xc8c8d0, { parent: claw, x: Math.sin(i * 2.1) * 0.06, y: -0.15, z: Math.cos(i * 2.1) * 0.06, rz: Math.sin(i * 2.1) * 0.4, rx: -Math.cos(i * 2.1) * 0.4, line: 0.01 });

  // ---- Back wall, right: a row of cabinets behind the Ticket Tumble floor ----
  const screens = [];
  for (let i = 0; i < 6; i++) {
    const cab = cabinet(g, [0x2c4a8a, 0x8a2c5c, 0x2c7a5a, 0x6a2c8a, 0x8a5a2c, 0x2c6a8a][i], NEON[i % NEON.length]);
    cab.group.position.set(1.8 + i * 1.3, 0, -5.4);
    screens.push(cab.screen);
  }

  // ---- Left wall: three cabinets facing into the room. Glorp plays the middle one. ----
  for (let i = 0; i < 3; i++) {
    const cab = cabinet(g, [0x8a2c5c, 0x2c4a8a, 0x2c7a5a][i], NEON[(i + 2) % NEON.length]);
    cab.group.position.set(-9.4, 0, -2.4 + i * 1.4);
    cab.group.rotation.y = Math.PI / 2;
    screens.push(cab.screen);
  }

  // ---- Right side: the Ticket Tumble floor. 8 by 6 light-up tiles with a rail around them. ----
  const tiles = [];
  const tileGeo = new THREE.BoxGeometry(0.94, 0.05, 0.94);
  for (let ix = 0; ix < 8; ix++) for (let iz = 0; iz < 6; iz++) {
    const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: 0x2a2048 }));
    m.position.set(PAD.x0 + 0.5 + ix, 0.025, PAD.z0 + 0.5 + iz);
    m.receiveShadow = true;
    g.add(m);
    tiles.push({ m, ix, iz });
  }
  const RAIL = 0xffd84c;
  box(8.2, 0.12, 0.1, RAIL, add({ x: 5, y: 0.06, z: PAD.z1 + 0.05, line: 0.02, cast: false }));
  box(8.2, 0.12, 0.1, RAIL, add({ x: 5, y: 0.06, z: PAD.z0 - 0.05, line: 0.02, cast: false }));
  for (const x of [PAD.x0 - 0.05, PAD.x1 + 0.05]) box(0.1, 0.12, 6.2, RAIL, add({ x, y: 0.06, z: -0.2, line: 0.02, cast: false }));
  // The ticket chute hangs over the back of the floor, with the marquee on it
  box(8.4, 0.6, 0.4, 0x5a3d8a, add({ x: 5, y: 4.2, z: -3.6, cast: false }));
  sign('TICKET TUMBLE', 5.0, 0.5, '#ff5fa2', add({ x: 5, y: 4.2, z: -3.39 }));
  for (const x of [1.2, 8.8]) cyl(0.06, 4.0, 0x2b2733, add({ x, y: 2.0, z: -3.6, line: 0.02 }));

  // The start podium at the front left corner of the floor
  box(0.8, 1.0, 0.6, 0x5a3d8a, add({ x: 0.2, y: 0.5, z: 3.6 }));
  box(0.7, 0.05, 0.5, 0x2b2733, add({ x: 0.2, y: 1.03, z: 3.6, rx: 0.25, line: 0.015 }));
  const button = cyl(0.13, 0.08, glow(0xff5fa2, 1.6), add({ x: 0.2, y: 1.08, z: 3.62, line: 0.015 }));

  // ---- Front: the portal home lands here; a couple of stools ----
  for (const [x, z] of [[-3.6, 3.8], [3.0, 4.6]]) {
    cyl(0.25, 0.08, 0xff5fa2, add({ x, y: 0.62, z }));
    cyl(0.05, 0.6, 0xc8c8d0, add({ x, y: 0.3, z, line: 0.015 }));
    cyl(0.2, 0.03, 0xc8c8d0, add({ x, y: 0.02, z, line: 0.015, cast: false }));
  }
  decal(0.7, 0x000000, 0.25, add({ x: -5.4, z: 1.2, sx: 1.3 })); // where the portal home stands

  // Lighting: dim purple fill, a few colored lamps, one key light for the shadows. Keep it low: the carpet is busy.
  g.add(new THREE.HemisphereLight(0xb8a0ff, 0x2a1f40, 1.25));
  const key = new THREE.DirectionalLight(0xffe6f2, 1.0);
  key.position.set(1.5, 14, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03;
  g.add(key);
  const lamps = [[0xff5fa2, 5, 1.5, -1], [0x5dfff0, -6, -2.6, 1], [0xa86bff, -6, 2.5, 1.5]].map(([col, x, z, i]) => {
    const l = new THREE.PointLight(col, 3.5, 12, 1.5);
    l.position.set(x, 3.4, z);
    g.add(l);
    return l;
  });

  return {
    group: g,
    bounds: { x0: -9.5, x1: 9.5, z0: -5.5, z1: 5.6 },
    colliders: [
      { x0: -8.7, x1: -3.5, z0: -6, z1: -4.05 },   // prize counter
      { x0: -2.15, x1: -0.65, z0: -6, z1: -4.3 },  // claw machine
      { x0: 1.2, x1: 9.5, z0: -6, z1: -4.75 },     // cabinets behind the floor
      { x0: -10, x1: -8.75, z0: -3.0, z1: 0.95 },  // cabinets on the left wall
      { x0: -0.25, x1: 0.65, z0: 3.25, z1: 3.95 }, // start podium
      { x0: -3.9, x1: -3.3, z0: 3.5, z1: 4.1 },    // stools
      { x0: 2.7, x1: 3.3, z0: 4.3, z1: 4.9 },
    ],
    spots: {
      portal: new THREE.Vector3(-5.4, 0, 1.2),
      arrive: new THREE.Vector3(-5.4, 0, 2.6),
      gorbi: new THREE.Vector3(px, 0, -5.35),
      glorp: new THREE.Vector3(-8.3, 0, -1.0),
      jerry: new THREE.Vector3(-2.6, 0, -3.9),
      podium: new THREE.Vector3(0.2, 0, 3.6),
      padCenter: new THREE.Vector3(5, 0, -0.2),
      soda: new THREE.Vector3(px + 0.42, 3.3, -5.6),
      crystal: new THREE.Vector3(px - 0.3, 3.62, -5.6),
    },
    soda, crystal, tiles, button, claw,
    // mode: 'idle' (slow chase lights), 'play' (fast), 'win' (everything flashes)
    update(time, mode = 'idle') {
      soda.rotation.y = time * 0.8;
      crystal.rotation.y = time * 1.5; crystal.position.y = 3.62 + Math.sin(time * 2.5) * 0.05;
      claw.position.x = cx + Math.sin(time * 0.7) * 0.35;
      claw.position.z = -5.0 + Math.sin(time * 0.53) * 0.3;
      button.scale.setScalar(1 + 0.08 * Math.sin(time * 6));
      screens.forEach((s, i) => s.material.color.setRGB(...NEON_RGB[i % NEON_RGB.length]).multiplyScalar(0.9 + 0.25 * Math.sin(time * (3 + i) + i)));
      lamps.forEach((l, i) => { l.intensity = 3.2 + Math.sin(time * 2 + i * 2) * 0.5; });
      const speed = mode === 'play' ? 5 : 1.6;
      for (const t of tiles) {
        const wave = Math.sin(t.ix * 0.9 + t.iz * 0.6 - time * speed);
        const on = mode === 'win' ? (Math.floor(time * 8) + t.ix + t.iz) % 2 === 0 : wave > 0.55;
        const col = NEON_RGB[(t.ix + t.iz) % NEON_RGB.length];
        const k = on ? (mode === 'idle' ? 0.45 : 0.6) : 0.14;
        t.m.material.color.setRGB(col[0] * k + 0.04, col[1] * k + 0.03, col[2] * k + 0.08);
      }
    },
  };
}

const NEON_RGB = NEON.map((c) => new THREE.Color(c).toArray());

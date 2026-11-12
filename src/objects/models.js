import * as THREE from 'three';
import { box, cyl, ball, cone, shape, glow, charMat as C } from '../engine/toon.js';

// Low-poly characters built in code from faceted shapes. No model files, no image AI.
// Every model faces +z (toward the camera) and stands with its feet at y = 0.
// Limbs hang from pivot groups so the walk cycle can swing them.

const EYE_WHITE = new THREE.MeshBasicMaterial({ color: 0xf6f4ee }); // unlit, so eyes always read
const INK = new THREE.MeshBasicMaterial({ color: 0x15101c });

function limb(parent, x, y, z = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  return pivot;
}

// Two eyes with pupils. lid (a material) adds a heavy upper eyelid for a tired look.
function eyes(parent, x, y, z, r, lid = null) {
  for (const s of [-1, 1]) {
    ball(r, EYE_WHITE, { parent, x: s * x, y, z, line: 0.016, detail: 2 });
    ball(r * 0.2, INK, { parent, x: s * x * 0.9, y: y - (lid ? r * 0.15 : 0), z: z + r * 0.95, line: 0, detail: 0 });
    if (lid) shape(new THREE.SphereGeometry(r * 1.07, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.42), lid, { parent, x: s * x, y, z, rx: 0.25, line: 0.012 });
  }
}

export function buildMorty() {
  const root = new THREE.Group();
  const SKIN = C(0xf5cba4), SHIRT = C(0xf6e455), JEANS = C(0x3f62b0), HAIR = C(0x86542a), SHOE = C(0xf7f5ee);
  const parts = { root };

  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.105, 0.46);
    cyl(0.085, 0.38, JEANS, { parent: leg, y: -0.19, radiusTop: 0.095, line: 0.028 });
    box(0.16, 0.09, 0.27, SHOE, { parent: leg, y: -0.415, z: 0.05, line: 0.028 });
    return leg;
  });
  // Body: shirt and neck
  cyl(0.235, 0.44, SHIRT, { parent: root, y: 0.67, radiusTop: 0.17, sides: 10 });
  cyl(0.07, 0.1, SKIN, { parent: root, y: 0.92, line: 0.02 });
  // Arms: short sleeve, bare forearm, hand
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * 0.235, 0.84);
    arm.rotation.z = s * 0.16;
    cyl(0.07, 0.17, SHIRT, { parent: arm, y: -0.06, radiusTop: 0.08, line: 0.028 });
    cyl(0.048, 0.22, SKIN, { parent: arm, y: -0.24, line: 0.026 });
    ball(0.065, SKIN, { parent: arm, y: -0.38, line: 0.026 });
    return arm;
  });
  // Head: big and round, hair cap tipped back, ears, wide eyes, worried eyebrows
  const head = limb(root, 0, 1.24);
  parts.head = head;
  ball(0.355, SKIN, { parent: head, detail: 2, sz: 0.97 });
  shape(new THREE.SphereGeometry(0.385, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.43), HAIR, { parent: head, y: 0.01, z: -0.02, rx: -0.6 });
  for (const s of [-1, 1]) ball(0.07, SKIN, { parent: head, x: s * 0.35, y: -0.05, sz: 0.6, line: 0.022 });
  eyes(head, 0.14, 0.04, 0.255, 0.125);
  for (const s of [-1, 1]) box(0.11, 0.022, 0.03, C(0x5e3a1c), { parent: head, x: s * 0.14, y: 0.215, z: 0.3, rz: s * -0.28, line: 0 });
  ball(0.042, SKIN, { parent: head, y: -0.075, z: 0.35, line: 0.018, detail: 0 });
  box(0.1, 0.02, 0.03, C(0x7a3a34), { parent: head, y: -0.2, z: 0.3, line: 0 });

  return { root, parts, height: 1.6, blob: 0.34 };
}

export function buildRick() {
  const root = new THREE.Group();
  const SKIN = C(0xdcd3c6), COAT = C(0xf3f3ee), SHIRT = C(0x9fd8e8), PANTS = C(0x8a6a4a), HAIR = C(0xaedff0), SHOE = C(0x2b2733);
  const parts = { root };

  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.105, 0.66);
    cyl(0.07, 0.58, PANTS, { parent: leg, y: -0.29, radiusTop: 0.08, line: 0.028 });
    box(0.15, 0.09, 0.28, SHOE, { parent: leg, y: -0.615, z: 0.05, line: 0.028 });
    return leg;
  });
  // Lab coat, blue shirt down the front, two lapels, neck
  cyl(0.29, 0.9, COAT, { parent: root, y: 0.95, radiusTop: 0.185, sides: 10 });
  box(0.13, 0.62, 0.04, SHIRT, { parent: root, y: 1.04, z: 0.2, rx: -0.115, line: 0 });
  for (const s of [-1, 1]) box(0.09, 0.3, 0.035, COAT, { parent: root, x: s * 0.085, y: 1.25, z: 0.2, rz: s * 0.35, rx: -0.1, line: 0.014 });
  cyl(0.065, 0.12, SKIN, { parent: root, y: 1.43, line: 0.02 });
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * 0.245, 1.33);
    arm.rotation.z = s * 0.14;
    cyl(0.062, 0.56, COAT, { parent: arm, y: -0.27, radiusTop: 0.075, line: 0.028 });
    ball(0.065, SKIN, { parent: arm, y: -0.59, line: 0.026 });
    return arm;
  });
  // Head: long face, a fan of blue hair spikes, one long eyebrow, heavy eyelids, drool
  const head = limb(root, 0, 1.68);
  parts.head = head;
  ball(0.27, SKIN, { parent: head, detail: 2, sy: 1.28, sx: 0.96, sz: 0.95 });
  for (let i = 0; i < 11; i++) {
    const a = THREE.MathUtils.degToRad(-135 + i * 27);
    cone(0.135, 0.42, HAIR, { parent: head, x: Math.sin(a) * 0.27, y: 0.03 + Math.cos(a) * 0.35, z: -0.07, rz: -a, sides: 4, sz: 0.6 });
  }
  for (let i = 0; i < 7; i++) {
    const a = THREE.MathUtils.degToRad(-108 + i * 36);
    cone(0.13, 0.32, HAIR, { parent: head, x: Math.sin(a) * 0.2, y: 0.08 + Math.cos(a) * 0.29, z: -0.22, rz: -a, rx: -0.55, sides: 4 });
  }
  eyes(head, 0.1, 0.05, 0.19, 0.095, SKIN);
  box(0.4, 0.05, 0.05, C(0x86bfd4), { parent: head, y: 0.175, z: 0.235, line: 0.012 });
  for (const s of [-1, 1]) box(0.11, 0.014, 0.02, C(0x9a8f86), { parent: head, x: s * 0.1, y: -0.065, z: 0.25, rz: s * -0.15, line: 0 });
  box(0.055, 0.17, 0.09, SKIN, { parent: head, y: -0.07, z: 0.27, line: 0.018 });
  box(0.17, 0.02, 0.03, C(0x5b3a35), { parent: head, y: -0.225, z: 0.235, line: 0 });
  ball(0.022, C(0xb7e86a), { parent: head, x: 0.06, y: -0.26, z: 0.24, line: 0, detail: 0 });

  return { root, parts, height: 1.98, blob: 0.4 };
}

// Shrimp people of the shrimp dimension (original designs). They stand upright on two legs.
// kind: 'guard' (cap), 'rebel' (bandana), 'rick' (Shrimp Rick: lab coat, blue hair spikes, one eyebrow)
export function buildShrimp(kind = 'guard') {
  const root = new THREE.Group();
  const big = kind === 'rick' ? 1.15 : kind === 'rebel' ? 0.85 : 1;
  const body = new THREE.Group();
  body.scale.setScalar(big);
  root.add(body);
  const SHELL = C(kind === 'rebel' ? 0xffa27a : 0xff7a66), BELLY = C(0xffd9c2), DARK = C(0xd9503f);
  const parts = { root };

  parts.legs = [-1, 1].map((s) => {
    const leg = limb(body, s * 0.12, 0.34);
    cyl(0.04, 0.3, DARK, { parent: leg, y: -0.15, line: 0.024 });
    box(0.1, 0.06, 0.2, DARK, { parent: leg, y: -0.31, z: 0.04, line: 0.024 });
    return leg;
  });
  // Tail fan curling out behind, then three shell segments stacked into a curved back
  for (const s of [-1, 0, 1]) cone(0.1, 0.34, DARK, { parent: body, x: s * 0.13, y: 0.3, z: -0.42, rx: -1.9, rz: s * -0.5, sides: 4, sz: 0.4 });
  ball(0.2, SHELL, { parent: body, y: 0.36, z: -0.2, sz: 1.3 });
  ball(0.27, SHELL, { parent: body, y: 0.55, z: -0.04, sy: 1.1 });
  ball(0.29, SHELL, { parent: body, y: 0.86, z: 0.02, sy: 1.1 });
  ball(0.2, BELLY, { parent: body, y: 0.72, z: 0.14, sy: 1.5, line: 0 });
  // Claws
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(body, s * 0.29, 0.95);
    arm.rotation.z = s * 0.3;
    cyl(0.04, 0.3, DARK, { parent: arm, y: -0.15, line: 0.024 });
    ball(0.085, SHELL, { parent: arm, y: -0.34, sy: 1.4, line: 0.024 });
    return arm;
  });
  // Head: pointed nose spike, eyes on stalks, long feelers
  const head = limb(body, 0, 1.22);
  parts.head = head;
  ball(0.25, SHELL, { parent: head, detail: 2, sz: 1.2 });
  cone(0.07, 0.34, DARK, { parent: head, y: 0.1, z: 0.36, rx: 1.25, sides: 4 });
  for (const s of [-1, 1]) {
    cyl(0.025, 0.2, DARK, { parent: head, x: s * 0.13, y: 0.27, z: 0.1, rz: s * -0.25, line: 0.018 });
    ball(0.085, EYE_WHITE, { parent: head, x: s * 0.16, y: 0.4, z: 0.11, line: 0.016, detail: 2 });
    ball(0.022, INK, { parent: head, x: s * 0.155, y: 0.4, z: 0.192, line: 0, detail: 0 });
    cyl(0.012, 0.6, DARK, { parent: head, x: s * 0.07, y: 0.32, z: -0.12, rx: -0.9, rz: s * -0.2, line: 0.012, sides: 4 });
  }
  box(0.12, 0.02, 0.03, INK, { parent: head, y: -0.1, z: 0.28, line: 0 });

  if (kind === 'guard') {
    cyl(0.25, 0.09, C(0x3c4a3a), { parent: head, y: 0.2, z: -0.02, line: 0.02 });
    box(0.3, 0.03, 0.16, C(0x2a3329), { parent: head, y: 0.17, z: 0.22, line: 0.015 });
    box(0.5, 0.07, 0.05, C(0x3c4a3a), { parent: body, y: 0.62, z: 0.2, line: 0.015 }); // belt
  } else if (kind === 'rebel') {
    cyl(0.255, 0.07, C(0x7a4ad0), { parent: head, y: 0.12, z: 0, rx: 0.15, line: 0.02 });
  } else {
    const HAIR = C(0xaedff0);
    for (let i = 0; i < 7; i++) {
      const a = THREE.MathUtils.degToRad(-120 + i * 40);
      cone(0.12, 0.36, HAIR, { parent: head, x: Math.sin(a) * 0.24, y: 0.02 + Math.cos(a) * 0.26, z: -0.12, rz: -a, sides: 4, sz: 0.6 });
    }
    box(0.36, 0.05, 0.05, C(0x86bfd4), { parent: head, y: 0.15, z: 0.27, line: 0.012 });
    cyl(0.36, 0.62, C(0xf3f3ee), { parent: body, y: 0.72, radiusTop: 0.26, sides: 10, line: 0.03 });
    box(0.14, 0.5, 0.04, C(0x9fd8e8), { parent: body, y: 0.76, z: 0.3, rx: -0.14, line: 0 });
  }
  return { root, parts, height: 1.75 * big, blob: 0.42 * big };
}

// The portal gun, standing on its handle. About three times real size so it reads from the follow camera.
export function buildGun() {
  const root = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.set(0, 0.45, 0.3);
  g.position.y = 0.6;
  g.scale.setScalar(1.45);
  root.add(g);
  const METAL = 0x9aa0ac;
  box(0.6, 0.2, 0.2, METAL, { parent: g, line: 0.03 });
  cyl(0.07, 0.16, 0x59606e, { parent: g, x: 0.37, rz: Math.PI / 2, sides: 6, line: 0.03 });
  box(0.15, 0.32, 0.15, 0x6f7684, { parent: g, x: -0.16, y: -0.23, rz: -0.25, line: 0.03 });
  box(0.22, 0.03, 0.14, 0x2b2733, { parent: g, x: -0.12, y: 0.105, line: 0 }); // screen
  cyl(0.1, 0.05, 0x59606e, { parent: g, x: 0.12, y: 0.12, sides: 6, line: 0.02 });
  const dome = ball(0.1, glow(0x6dff4a, 1.25), { parent: g, x: 0.12, y: 0.2, sy: 1.3, line: 0.02 });
  box(0.03, 0.02, 0.21, 0x15101c, { parent: g, x: 0.2, y: 0.02, rz: 0.6, line: 0 }); // the crack
  return { root, parts: { root, dome }, height: 0.4 };
}

// Shrimp Rick's walking lab tank (original design): a glass fishbowl full of glowing water on four robot legs,
// with two big claws. Shrimp Rick rides in parts.seat. Faces +z, feet at y = 0, about 3.1 tall.
export function buildTank() {
  const root = new THREE.Group();
  const body = new THREE.Group(); // everything above the legs: tips and bobs as one piece
  root.add(body);
  const METAL = 0x59606e, DARK = 0x3a3d48, SHELL = 0xff7a66, RED = 0xd9503f;
  const parts = { root, body };

  // Legs: a thigh reaching out and a shin reaching down, with a wide foot
  parts.legs = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => {
    const leg = limb(root, sx * 0.75, 1.2, sz * 0.55);
    cyl(0.1, 0.95, METAL, { parent: leg, x: sx * 0.33, y: 0.12, z: sz * 0.14, rz: sx * -1.15, rx: sz * 0.3, sides: 6, line: 0.03 });
    ball(0.15, DARK, { parent: leg, x: sx * 0.72, y: 0.3, z: sz * 0.28, detail: 0, line: 0.03 });
    cyl(0.085, 1.3, METAL, { parent: leg, x: sx * 0.8, y: -0.4, z: sz * 0.3, rz: sx * -0.08, sides: 6, line: 0.03 });
    box(0.42, 0.14, 0.5, DARK, { parent: leg, x: sx * 0.86, y: -1.12, z: sz * 0.32, line: 0.03 });
    return leg;
  });

  // Base plate with two yellow lamps and a red propaganda stripe
  cyl(1.12, 0.36, METAL, { parent: body, y: 1.25, sides: 10, radiusTop: 1.02 });
  box(0.9, 0.16, 0.06, glow(0xff5a4a, 1.3), { parent: body, y: 1.25, z: 1.06, line: 0 });
  for (const s of [-1, 1]) ball(0.11, glow(0xffd24a, 1.6), { parent: body, x: s * 0.72, y: 1.27, z: 0.8, line: 0.02, detail: 0 });

  // Glass bowl (no outline: the outline shell would show through the glass as a black blob) and the water in it
  const GLASS = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const WATER = new THREE.MeshBasicMaterial({ color: 0x2ad0ff, transparent: true, opacity: 0.42, depthWrite: false });
  WATER.toneMapped = false;
  parts.water = cyl(0.9, 0.75, WATER, { parent: body, y: 1.8, sides: 10, line: 0, cast: false, receive: false });
  cyl(0.98, 1.55, GLASS, { parent: body, y: 2.2, sides: 10, radiusTop: 0.9, line: 0, cast: false, receive: false });
  cyl(0.96, 0.1, DARK, { parent: body, y: 2.99, sides: 10, radiusTop: 0.93, line: 0.03 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    box(0.07, 1.55, 0.07, DARK, { parent: body, x: Math.sin(a) * 0.96, y: 2.2, z: Math.cos(a) * 0.96, line: 0.02 });
  }
  parts.seat = limb(body, 0, 1.38, 0);

  // Claws on thick arms
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(body, s * 1.08, 1.75, 0.2);
    ball(0.2, DARK, { parent: arm, detail: 0, line: 0.03 });
    cyl(0.1, 0.9, METAL, { parent: arm, x: s * 0.18, z: 0.4, rx: Math.PI / 2, rz: s * -0.4, sides: 6, line: 0.03 });
    const claw = limb(arm, s * 0.36, 0, 0.85);
    ball(0.24, SHELL, { parent: claw, sz: 1.3, line: 0.03 });
    cone(0.17, 0.62, SHELL, { parent: claw, y: 0.14, z: 0.45, rx: 1.35, sides: 4, line: 0.03 });
    cone(0.14, 0.5, RED, { parent: claw, y: -0.14, z: 0.4, rx: 1.8, sides: 4, line: 0.03 });
    return arm;
  });

  return { root, parts, height: 3.1, blob: 1.5 };
}

// The three gun parts, as small glowing props
export const PARTS = [
  { id: 'crystal', name: 'Focus Crystal', color: 0x4affe0, make: (o) => shape(new THREE.OctahedronGeometry(0.22), glow(0x4affe0, 1.5), { line: 0.03, sy: 1.5, ...o }) },
  { id: 'canister', name: 'Fluid Canister', color: 0xc45aff, make: (o) => cyl(0.14, 0.42, glow(0xc45aff, 1.5), { line: 0.03, ...o }) },
  { id: 'chip', name: 'Coordinate Chip', color: 0xffb03a, make: (o) => box(0.36, 0.07, 0.28, glow(0xffb03a, 1.5), { line: 0.03, ...o }) },
];

const blobGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0.3, depthWrite: false });

// A model in the world. `group` is where it stands and which way it faces, `mesh` is its pose
// (cutscenes lift, tip and spin it), squash and scale stretch it like a cartoon.
export class Model {
  constructor(built) {
    this.parts = built.parts;
    this.height = built.height;
    this.squash = 1;   // below 1 = squashed flat, above 1 = stretched tall
    this.scale = 1;
    this.group = new THREE.Group();
    this.mesh = new THREE.Group();
    this.mesh.add(built.root);
    this.group.add(this.mesh);
    if (built.blob) {
      // Soft dark patch under the feet. It grounds the character where the real shadow is faint.
      this.blob = new THREE.Mesh(blobGeo, blobMat);
      this.blob.position.y = 0.03;
      this.blobSize = built.blob;
      this.group.add(this.blob);
    }
  }

  get position() { return this.group.position; }

  // Turn to look at a point on the floor
  faceToward(point) { this.group.rotation.y = Math.atan2(point.x - this.position.x, point.z - this.position.z); }

  update() {
    const wide = this.scale * (2 - this.squash);
    this.mesh.scale.set(wide, this.scale * this.squash, wide);
    if (this.blob) this.blob.scale.setScalar(this.blobSize * this.scale * Math.max(0.2, 1 - this.mesh.position.y * 0.4));
  }
}

const TURN = 12; // how fast a character turns to face where it is walking

export class Character extends Model {
  constructor(built) {
    super(built);
    this.phase = 0;
    this.idle = Math.random() * 10;
    this.wasMoving = false;
    this.squashT = 0;
    this.headY = this.parts.head.position.y;
  }

  // Walk cycle and idle breathing. speed is in units per second, vx and vz say which way it is going.
  animate(dt, speed, vx = 0, vz = 0, topSpeed = 5.2) {
    const moving = speed > 0.6;
    const { legs, arms, head, root } = this.parts;
    if (moving) {
      this.phase += dt * speed * 2.3;
      const want = Math.atan2(vx, vz);
      let diff = want - this.group.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest way round
      this.group.rotation.y += diff * (1 - Math.exp(-dt * TURN));
    } else if (this.wasMoving) {
      this.squashT = 1; // just stopped: quick squash
    }
    this.wasMoving = moving;
    this.squashT = Math.max(0, this.squashT - dt * 6);
    this.idle += dt;

    const walk = moving ? Math.min(speed / topSpeed, 1) : 0;
    const swing = Math.sin(this.phase) * 0.85 * walk;
    legs[0].rotation.x = swing; legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.8; arms[1].rotation.x = swing * 0.8;
    root.position.y = Math.abs(Math.sin(this.phase)) * 0.07 * walk;
    root.rotation.x = 0.14 * walk; // lean into the run
    head.rotation.z = Math.sin(this.phase) * 0.05 * walk;
    // Standing still: slow breathing
    const breath = Math.sin(this.idle * 2.2) * (1 - walk);
    head.position.y = this.headY + breath * 0.012;
    arms[0].rotation.z = -0.16 - breath * 0.03; arms[1].rotation.z = 0.16 + breath * 0.03;
    this.squash = 1 - 0.13 * Math.sin(this.squashT * Math.PI);
  }
}

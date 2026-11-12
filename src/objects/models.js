import * as THREE from 'three';
import { box, cyl, ball, cone, shape, glow, charMat as C } from '../engine/toon.js';

const EYE_WHITE = new THREE.MeshBasicMaterial({ color: 0xf6f4ee }); // unlit, so eyes always read

// Low-poly characters built in code from a few faceted shapes. No model files, no image AI.
// Every model faces +z (toward the camera) and stands with its feet at y = 0.
// Limbs hang from pivot groups so the walk cycle can swing them.

function limb(parent, x, y, z = 0) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  parent.add(pivot);
  return pivot;
}

function eyes(parent, x, y, z, r) {
  for (const s of [-1, 1]) {
    ball(r, EYE_WHITE, { parent, x: s * x, y, z, line: 0.018 });
    ball(r * 0.24, 0x15101c, { parent, x: s * x * 0.92, y, z: z + r * 0.93, line: 0, detail: 0 });
  }
}

export function buildMorty() {
  const root = new THREE.Group();
  const SKIN = C(0xf3c9a2), SHIRT = C(0xf4e45c), JEANS = C(0x3f5ea8), HAIR = C(0x7b4a22);
  const parts = { root };

  // Legs and shoes
  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.11, 0.46);
    box(0.15, 0.4, 0.17, JEANS, { parent: leg, y: -0.2, line: 0.03 });
    box(0.17, 0.1, 0.27, C(0xf7f5ee), { parent: leg, y: -0.41, z: 0.05, line: 0.03 });
    return leg;
  });
  // Body
  cyl(0.24, 0.42, SHIRT, { parent: root, y: 0.66, radiusTop: 0.19, sides: 6 });
  // Arms: short sleeve, bare forearm, hand
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * 0.27, 0.82);
    arm.rotation.z = s * 0.16;
    cyl(0.075, 0.16, SHIRT, { parent: arm, y: -0.07, sides: 6, line: 0.03 });
    cyl(0.055, 0.22, SKIN, { parent: arm, y: -0.25, sides: 6, line: 0.03 });
    ball(0.07, SKIN, { parent: arm, y: -0.39, line: 0.03, detail: 0 });
    return arm;
  });
  // Head: big and round, hair cap tipped back, ears, wide eyes
  const head = limb(root, 0, 1.2);
  parts.head = head;
  ball(0.36, SKIN, { parent: head, sy: 1.04, sz: 0.96 });
  shape(new THREE.SphereGeometry(0.4, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.42), HAIR, { parent: head, y: 0.02, z: -0.03, rx: -0.5 });
  for (const s of [-1, 1]) ball(0.075, SKIN, { parent: head, x: s * 0.35, y: -0.04, line: 0.025, detail: 0 });
  eyes(head, 0.135, 0.05, 0.27, 0.115);
  ball(0.045, SKIN, { parent: head, y: -0.06, z: 0.35, line: 0.02, detail: 0 });
  box(0.11, 0.022, 0.03, 0x6b2f2a, { parent: head, y: -0.19, z: 0.315, line: 0, rx: -0.2 });

  return { root, parts, height: 1.56 };
}

export function buildRick() {
  const root = new THREE.Group();
  const SKIN = C(0xd9cfc2), COAT = C(0xf1f1ec), SHIRT = C(0x9fd8e8), PANTS = C(0x8a6a4a), HAIR = C(0xa9dcee);
  const parts = { root };

  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.11, 0.66);
    box(0.14, 0.58, 0.15, PANTS, { parent: leg, y: -0.29, line: 0.03 });
    box(0.16, 0.1, 0.28, 0x2b2733, { parent: leg, y: -0.61, z: 0.05, line: 0.03 });
    return leg;
  });
  // Lab coat with the blue shirt showing down the front
  cyl(0.3, 0.84, COAT, { parent: root, y: 0.97, radiusTop: 0.2, sides: 6, ry: Math.PI / 6 });
  box(0.15, 0.6, 0.04, SHIRT, { parent: root, y: 1.02, z: 0.215, rx: -0.12, line: 0 });
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * 0.27, 1.32);
    arm.rotation.z = s * 0.14;
    cyl(0.07, 0.56, COAT, { parent: arm, y: -0.27, sides: 6, line: 0.03 });
    ball(0.07, SKIN, { parent: arm, y: -0.6, line: 0.03, detail: 0 });
    return arm;
  });
  // Head: long face, spiky blue hair, one long eyebrow
  const head = limb(root, 0, 1.62);
  parts.head = head;
  ball(0.29, SKIN, { parent: head, sy: 1.22, sz: 0.95 });
  for (let i = 0; i < 9; i++) {
    const a = THREE.MathUtils.degToRad(-128 + i * 32);
    cone(0.13, 0.36, HAIR, { parent: head, x: Math.sin(a) * 0.3, y: 0.04 + Math.cos(a) * 0.36, z: -0.06, rz: -a, sides: 4 });
  }
  for (let i = 0; i < 6; i++) {
    const a = THREE.MathUtils.degToRad(-100 + i * 40);
    cone(0.13, 0.3, HAIR, { parent: head, x: Math.sin(a) * 0.22, y: 0.1 + Math.cos(a) * 0.3, z: -0.24, rz: -a, rx: -0.5, sides: 4 });
  }
  eyes(head, 0.105, 0.03, 0.215, 0.09);
  box(0.36, 0.05, 0.05, C(0x7fb4c9), { parent: head, y: 0.15, z: 0.25, line: 0.012 });
  box(0.06, 0.16, 0.08, SKIN, { parent: head, y: -0.08, z: 0.28, line: 0.02 });
  box(0.16, 0.022, 0.03, 0x5b3a35, { parent: head, y: -0.24, z: 0.245, line: 0 });

  return { root, parts, height: 1.95 };
}

// The portal gun, lying on its side. About three times real size so it reads from the follow camera.
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
  }

  get position() { return this.group.position; }

  // Turn to look at a point on the floor
  faceToward(point) { this.group.rotation.y = Math.atan2(point.x - this.position.x, point.z - this.position.z); }

  update() {
    const wide = this.scale * (2 - this.squash);
    this.mesh.scale.set(wide, this.scale * this.squash, wide);
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
    // Standing still: slow breathing and a small head bob
    const breath = Math.sin(this.idle * 2.2) * (1 - walk);
    head.position.y = head.userData.y0 ??= head.position.y;
    head.position.y = head.userData.y0 + breath * 0.012;
    arms[0].rotation.z = -0.16 - breath * 0.03; arms[1].rotation.z = 0.16 + breath * 0.03;
    this.squash = 1 - 0.13 * Math.sin(this.squashT * Math.PI);
  }
}

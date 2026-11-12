import * as THREE from 'three';
import { box, cyl, ball, cone, shape, glow, charMat as C } from '../engine/toon.js';
import { limb, eyes } from './models.js';
import { person } from './family.js';

// The Blips and Chitz regulars, low poly like everyone else. Both are original characters from STORY.md.
// Every model faces +z and stands with its feet at y = 0.

const INK = new THREE.MeshBasicMaterial({ color: 0x15101c });

// Gorbi: bored alien teen at the prize counter. Tall and thin, green, antennae, heavy eyelids, purple work polo.
export function buildGorbi() {
  const p = person({ skin: 0x8fd88a, top: 0x7a4ab0, pants: 0x3a3550, shoe: 0x2b2733, hip: 0.78, legR: 0.06, shoulder: 1.34, waist: 0.17, chest: 0.16, sleeve: 0.22, arm: 0.6, headY: 1.74, headR: 0.24, headSy: 1.35 });
  const { head, SKIN } = p;
  // Antennae with a ball on each tip
  for (const s of [-1, 1]) {
    cyl(0.022, 0.34, SKIN, { parent: head, x: s * 0.11, y: 0.42, z: -0.02, rz: s * -0.35, sides: 5, line: 0.016 });
    ball(0.05, SKIN, { parent: head, x: s * 0.17, y: 0.58, z: -0.02, line: 0.018 });
  }
  // Big half-closed eyes: he has seen everything and liked none of it
  eyes(head, 0.105, 0.06, 0.17, 0.095, C(0x6fb86a));
  ball(0.035, SKIN, { parent: head, y: -0.08, z: 0.24, line: 0.014, detail: 0 });
  box(0.06, 0.016, 0.03, INK, { parent: head, x: 0.02, y: -0.2, z: 0.2, rz: -0.15, line: 0 }); // flat mouth, a little crooked
  // Polo collar and the name tag
  box(0.26, 0.05, 0.2, C(0x5e3690), { parent: p.root, y: 1.36, z: 0.02, line: 0.016 });
  box(0.11, 0.05, 0.015, C(0xf4efe2), { parent: p.root, x: 0.08, y: 1.18, z: 0.16, line: 0.01 });
  return { root: p.root, parts: p.parts, height: 2.15, blob: 0.34 };
}

// Glorp: arcade regular, round and orange, has played the same machine for twelve years. Huge eyes that never blink,
// cap on backwards, stained tank top, stubby legs.
export function buildGlorp() {
  const root = new THREE.Group();
  const parts = { root };
  const SKIN = C(0xf2862e), TANK = C(0xe9e2cf), STAIN = C(0xb5a27a), CAP = C(0x8f8a80);
  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.16, 0.24);
    cyl(0.07, 0.2, SKIN, { parent: leg, y: -0.1, line: 0.024 });
    box(0.16, 0.07, 0.22, C(0x3a3550), { parent: leg, y: -0.21, z: 0.04, line: 0.024 });
    return leg;
  });
  // The body is one big ball; the tank top covers the bottom half
  ball(0.5, SKIN, { parent: root, y: 0.72, detail: 2, sy: 0.95 });
  cyl(0.48, 0.44, TANK, { parent: root, y: 0.5, radiusTop: 0.5, sides: 12, line: 0.03 });
  for (const [x, y, r] of [[0.2, 0.55, 0.06], [-0.15, 0.42, 0.05], [0.05, 0.36, 0.035]]) ball(r, STAIN, { parent: root, x, y, z: 0.43, sz: 0.3, line: 0 });
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * 0.46, 0.72);
    arm.rotation.z = s * 0.16;
    cyl(0.055, 0.3, SKIN, { parent: arm, y: -0.15, line: 0.024 });
    ball(0.07, SKIN, { parent: arm, y: -0.32, line: 0.024 });
    return arm;
  });
  // "Head": the top of the ball, with the eyes and the cap, so it can turn on its own
  const head = limb(root, 0, 0.9);
  parts.head = head;
  eyes(head, 0.17, 0.08, 0.36, 0.15);
  // Red veins on the whites: twelve years without blinking
  for (const s of [-1, 1]) for (const a of [0.5, 2.4, 3.9]) {
    box(0.07, 0.012, 0.01, C(0xd83a3a), { parent: head, x: s * 0.17 + Math.cos(a) * 0.09, y: 0.08 + Math.sin(a) * 0.09, z: 0.49, rz: a, line: 0 });
  }
  box(0.12, 0.018, 0.03, INK, { parent: head, y: -0.12, z: 0.42, line: 0 });
  // Cap on backwards: dome plus a brim pointing back
  shape(new THREE.SphereGeometry(0.4, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.42), CAP, { parent: head, y: 0.1, z: -0.04, rx: -0.2 });
  box(0.36, 0.035, 0.26, CAP, { parent: head, y: 0.17, z: -0.44, rx: 0.25, line: 0.02 });
  box(0.12, 0.08, 0.02, C(0xd8423c), { parent: head, y: 0.32, z: -0.2, rx: -0.9, line: 0.012 });
  return { root, parts, height: 1.4, blob: 0.5 };
}

// The prize: one can of arcade soda. Glows a little, because it is mostly sugar and light.
export function buildSoda(size = 1) {
  const root = new THREE.Group();
  root.scale.setScalar(size);
  cyl(0.11, 0.3, 0xff3fa4, { parent: root, y: 0.15, sides: 10, line: 0.02 });
  cyl(0.112, 0.08, glow(0x5dfff0, 1.4), { parent: root, y: 0.17, sides: 10, line: 0 });
  cyl(0.09, 0.03, 0xc8c8d0, { parent: root, y: 0.315, sides: 10, line: 0.015 });
  cone(0.03, 0.06, 0xc8c8d0, { parent: root, x: 0.03, y: 0.34, sides: 4, line: 0 });
  return root;
}

// A ticket and a bomb for Ticket Tumble
export function buildTicket(gold = false) {
  const root = new THREE.Group();
  box(0.42, 0.04, 0.22, gold ? glow(0xffd84c, 1.6) : glow(0xff5fa2, 1.25), { parent: root, line: 0.02 });
  box(0.1, 0.045, 0.16, gold ? 0xfff2b0 : 0xffd0e6, { parent: root, x: -0.12, line: 0 });
  if (gold) root.scale.setScalar(1.7);
  return root;
}

export function buildBomb() {
  const root = new THREE.Group();
  ball(0.24, 0x2b2733, { parent: root, line: 0.03 });
  cyl(0.08, 0.1, 0x59606e, { parent: root, y: 0.25, line: 0.02 });
  const spark = ball(0.07, glow(0xffb03a, 2.2), { parent: root, y: 0.36, line: 0, detail: 0 });
  return { root, spark };
}

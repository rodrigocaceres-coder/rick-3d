import * as THREE from 'three';
import { box, cyl, ball, cone, shape, glow, charMat as C } from '../engine/toon.js';
import { buildRick, buildMorty } from './models.js';

// The Citadel's Ricks: the same low-poly Rick with a different coat, hair and one prop each, so the hall reads
// as a crowd of the same guy. Desk Rick, Guard Rick and Cop Rick (STORY.md) get a uniform piece you can spot
// from across the room. Every model faces +z and stands with its feet at y = 0.

// Desk Rick: green visor, sleeve garters, a tie. Lives for forms.
export function buildDeskRick() {
  const r = buildRick({ coat: 0xe8e4d4, shirt: 0xf4efe2, pants: 0x4a4a5a, drool: false });
  const { head, root } = r.parts;
  const VISOR = glow(0x5dff9a, 0.9);
  cyl(0.29, 0.05, C(0x2a6a3a), { parent: head, y: 0.17, sides: 10, line: 0.016 });
  shape(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10, 1, false, -Math.PI / 2, Math.PI), VISOR, { parent: head, y: 0.15, z: 0.08, rx: 0.25, line: 0.012 });
  box(0.07, 0.42, 0.03, C(0x2a6a3a), { parent: root, y: 1.12, z: 0.22, rx: -0.12, line: 0.01 }); // tie
  r.parts.arms.forEach((arm) => cyl(0.078, 0.05, C(0x2a6a3a), { parent: arm, y: -0.2, line: 0.012 }));
  return r;
}

// Guard Rick: grey armor vest and a round helmet. Hates every other Rick.
export function buildGuardRick() {
  const r = buildRick({ coat: 0x6f7a8a, shirt: 0x3a3d48, pants: 0x3a3d48, hair: 0xc8eef8, drool: false });
  const { head, root } = r.parts;
  cyl(0.33, 0.5, C(0x4a5260), { parent: root, y: 1.12, radiusTop: 0.27, sides: 8, line: 0.025 }); // vest
  box(0.16, 0.08, 0.03, glow(0xff5a4a, 1.3), { parent: root, x: 0.12, y: 1.25, z: 0.29, line: 0.01 });
  shape(new THREE.SphereGeometry(0.34, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), C(0x4a5260), { parent: head, y: 0.1, z: -0.03, line: 0.02 });
  box(0.5, 0.05, 0.1, C(0x3a3d48), { parent: head, y: 0.12, z: 0.27, line: 0.015 });
  // Baton in the right hand
  cyl(0.035, 0.55, C(0x2b2733), { parent: r.parts.arms[1], y: -0.62, z: 0.18, rx: 1.2, line: 0.015 });
  return r;
}

// Cop Rick: navy coat, police cap, mirror shades, a gold badge. Confiscates anything shiny.
export function buildCopRick() {
  const r = buildRick({ coat: 0x2c3a6a, shirt: 0x9fb8e8, pants: 0x232b4a, drool: false });
  const { head, root } = r.parts;
  cyl(0.3, 0.13, C(0x232b4a), { parent: head, y: 0.25, radiusTop: 0.34, sides: 10, line: 0.02 });
  box(0.4, 0.03, 0.2, C(0x15101c), { parent: head, y: 0.19, z: 0.26, rx: 0.15, line: 0.012 });
  ball(0.05, glow(0xffd84c, 1.3), { parent: head, y: 0.27, z: 0.3, line: 0.012, detail: 0 });
  box(0.36, 0.08, 0.05, glow(0x8fb8ff, 0.8), { parent: head, y: 0.05, z: 0.28, line: 0.012 }); // shades
  shape(new THREE.OctahedronGeometry(0.06), glow(0xffd84c, 1.4), { parent: root, x: -0.13, y: 1.2, z: 0.26, sy: 1.3, line: 0.012 });
  return r;
}

// Janitor Rick: grey overalls and a mop.
export function buildJanitorRick() {
  const r = buildRick({ coat: 0x8a9a8a, shirt: 0x6a7a6a, pants: 0x5a6a5a, hair: 0xd0d8e0 });
  const mop = new THREE.Group();
  mop.position.set(0, -0.6, 0.12);
  r.parts.arms[1].add(mop);
  cyl(0.03, 1.6, C(0xa9713f), { parent: mop, y: -0.1, line: 0.014 });
  for (let i = 0; i < 7; i++) cyl(0.025, 0.32, C(0xe9e2cf), { parent: mop, x: Math.sin(i) * 0.08, y: -1.0, z: Math.cos(i) * 0.08, rz: Math.sin(i) * 0.3, line: 0.01, sides: 4 });
  r.parts.mop = mop;
  return r;
}

// Bored Rick: purple coat, paper coffee cup. He sits (pose is set where he is placed).
export function buildBoredRick() {
  const r = buildRick({ coat: 0x7a6aa0, hair: 0xb8c8ff, brow: 0x8a9ad4 });
  cyl(0.07, 0.18, C(0xf4efe2), { parent: r.parts.arms[0], y: -0.66, z: 0.06, radiusTop: 0.085, line: 0.014 });
  return r;
}

// Gossip Rick: pink shirt, gold chain, leans in to whisper.
export function buildGossipRick() {
  const r = buildRick({ coat: 0xf3e8f0, shirt: 0xff8fb0, hair: 0xf0d0ff, brow: 0xc8a0e0 });
  cyl(0.17, 0.03, glow(0xffd84c, 1.0), { parent: r.parts.root, y: 1.38, z: 0.03, rx: 0.5, sides: 10, line: 0.008 });
  return r;
}

// Queue Ricks: five variations on the default. i picks the look.
const QUEUE = [
  { coat: 0xf3f3ee, hair: 0xaedff0 },
  { coat: 0xd8c8a8, hair: 0xe8e8e8, brow: 0xc8c8c8, pants: 0x5a4a3a },
  { coat: 0xf3f3ee, hair: 0x9affc0, brow: 0x6ad49a, shirt: 0xffd84c },
  { coat: 0xc8d8f0, hair: 0xffc08a, brow: 0xd4905a, pants: 0x3a4a6a },
  { coat: 0xf3f3ee, hair: 0xd0b0ff, brow: 0xa080d4, shirt: 0xff9a4a },
];
export function buildQueueRick(i) {
  const r = buildRick(QUEUE[i % QUEUE.length]);
  const { head } = r.parts;
  if (i === 1) cone(0.14, 0.34, C(0xe8e8e8), { parent: head, y: -0.36, z: 0.2, rx: Math.PI, sides: 5 }); // beard
  if (i === 3) { cyl(0.24, 0.22, C(0x3a3550), { parent: head, y: 0.36, sides: 8, line: 0.018 }); cyl(0.36, 0.03, C(0x3a3550), { parent: head, y: 0.26, sides: 10, line: 0.015 }); } // a hat
  if (i === 4) box(0.36, 0.09, 0.05, C(0x15101c), { parent: head, y: 0.05, z: 0.27, line: 0.01 }); // sunglasses
  return r;
}

// Clerk Morty: a Morty who works here, arms out, lab coats hung on them. The Ricks think he is a coat rack.
export function buildClerkMorty() {
  const m = buildMorty();
  m.parts.arms.forEach((arm, k) => {
    const s = k ? 1 : -1;
    arm.rotation.z = s * 1.45;
    for (let i = 0; i < 2; i++) box(0.26, 0.5, 0.06, C(i ? 0xf3f3ee : 0xe8e4d4), { parent: arm, x: 0.02 * s, y: -0.22 - i * 0.12, z: 0.06 + i * 0.03, rz: -s * 1.45, line: 0.014 });
  });
  return m;
}

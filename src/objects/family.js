import * as THREE from 'three';
import { box, cyl, ball, cone, shape, glow, charMat as C } from '../engine/toon.js';
import { limb, eyes } from './models.js';

// The Smith family as low-poly models built in code, in the same style as Morty and Rick in models.js.
// Every model faces +z and stands with its feet at y = 0.

// A standing person: two legs, a body, two arms, a neck and a head. o gives sizes and colors.
function person(o) {
  const root = new THREE.Group();
  const parts = { root };
  const SKIN = C(o.skin), TOP = C(o.top);
  const legLen = o.hip - 0.08;
  parts.legs = [-1, 1].map((s) => {
    const leg = limb(root, s * 0.1, o.hip);
    cyl(o.legR, legLen, C(o.pants), { parent: leg, y: -legLen / 2, radiusTop: o.legR + 0.012, line: 0.028 });
    box(0.15, 0.09, 0.27, C(o.shoe), { parent: leg, y: -o.hip + 0.045, z: 0.05, line: 0.028 });
    return leg;
  });
  const bodyH = o.shoulder - o.hip + 0.07;
  cyl(o.waist, bodyH, TOP, { parent: root, y: o.hip - 0.02 + bodyH / 2, radiusTop: o.chest, sides: 10 });
  cyl(0.058, 0.14, SKIN, { parent: root, y: o.shoulder + 0.09, line: 0.02 });
  parts.arms = [-1, 1].map((s) => {
    const arm = limb(root, s * (o.chest + 0.05), o.shoulder);
    arm.rotation.z = s * 0.16;
    if (o.sleeve) cyl(0.06, o.sleeve, TOP, { parent: arm, y: 0.03 - o.sleeve / 2, radiusTop: 0.07, line: 0.028 });
    const bare = o.arm - o.sleeve;
    if (bare > 0.02) cyl(0.045, bare, SKIN, { parent: arm, y: 0.03 - o.sleeve - bare / 2, line: 0.026 });
    ball(0.062, SKIN, { parent: arm, y: -o.arm, line: 0.026 });
    return arm;
  });
  const head = limb(root, 0, o.headY);
  parts.head = head;
  ball(o.headR, SKIN, { parent: head, detail: 2, sy: o.headSy, sz: 0.96 });
  return { root, parts, head, SKIN };
}

// Hair cap: the top part of a ball, tipped back
function hairCap(head, r, color, how = 0.5, tip = -0.35, y = 0.03) {
  shape(new THREE.SphereGeometry(r, 12, 5, 0, Math.PI * 2, 0, Math.PI * how), color, { parent: head, y, z: -0.03, rx: tip });
}

function face(head, o) {
  eyes(head, o.eyeX, 0.03, o.eyeZ, o.eyeR);
  for (const s of [-1, 1]) box(0.09, 0.018, 0.03, C(o.brow), { parent: head, x: s * o.eyeX, y: o.browY, z: o.eyeZ + 0.05, rz: s * o.browTilt, line: 0 });
  ball(0.032, o.skin, { parent: head, y: -0.05, z: o.eyeZ + 0.07, line: 0.016, detail: 0 });
  box(o.mouthW, 0.018, 0.03, C(o.mouth), { parent: head, y: o.mouthY, z: o.eyeZ + 0.035, line: 0 });
}

// Beth: blonde ponytail, red top, jeans. Tired and sharp: flat eyebrows.
export function buildBeth() {
  const p = person({ skin: 0xf5cba4, top: 0xd8423c, pants: 0x4a78c2, shoe: 0x2b2733, hip: 0.7, legR: 0.07, shoulder: 1.26, waist: 0.185, chest: 0.16, sleeve: 0.3, arm: 0.56, headY: 1.58, headR: 0.26, headSy: 1.12 });
  const HAIR = C(0xf2d15c);
  hairCap(p.head, 0.29, HAIR);
  ball(0.11, HAIR, { parent: p.head, y: 0.12, z: -0.3, line: 0.03 });
  cone(0.1, 0.44, HAIR, { parent: p.head, y: -0.13, z: -0.39, rx: Math.PI + 0.3, sides: 5, line: 0.03 });
  face(p.head, { skin: p.SKIN, eyeX: 0.1, eyeZ: 0.185, eyeR: 0.085, brow: 0xb89a3a, browY: 0.15, browTilt: 0.14, mouth: 0x9a3a3a, mouthW: 0.09, mouthY: -0.14 });
  return { root: p.root, parts: p.parts, height: 1.92, blob: 0.36 };
}

// Summer: orange high ponytail, pink tank top, white pants, phone in her hand (parts.phone).
export function buildSummer() {
  const p = person({ skin: 0xf5cba4, top: 0xf08ab8, pants: 0xf3f0ea, shoe: 0xf7f5ee, hip: 0.66, legR: 0.065, shoulder: 1.16, waist: 0.165, chest: 0.145, sleeve: 0, arm: 0.5, headY: 1.46, headR: 0.255, headSy: 1.08 });
  const HAIR = C(0xf07a2a);
  hairCap(p.head, 0.285, HAIR);
  ball(0.1, HAIR, { parent: p.head, y: 0.27, z: -0.17, line: 0.03 });
  cone(0.11, 0.52, HAIR, { parent: p.head, y: 0.08, z: -0.4, rx: Math.PI + 0.55, sides: 5, line: 0.03 });
  face(p.head, { skin: p.SKIN, eyeX: 0.1, eyeZ: 0.18, eyeR: 0.085, brow: 0xb85a1c, browY: 0.145, browTilt: 0.2, mouth: 0x9a3a3a, mouthW: 0.07, mouthY: -0.135 });
  const phone = new THREE.Group();
  phone.position.set(0, -0.58, 0.05);
  box(0.11, 0.2, 0.025, 0x2b2733, { parent: phone, line: 0.018 });
  box(0.09, 0.17, 0.01, glow(0x9fd8ff, 1.3), { parent: phone, z: 0.016, line: 0 });
  p.parts.arms[0].add(phone);
  p.parts.phone = phone;
  return { root: p.root, parts: p.parts, height: 1.78, blob: 0.34 };
}

// Jerry: brown hair, green shirt, brown pants, long hopeful face.
export function buildJerry() {
  const p = person({ skin: 0xf5cba4, top: 0x6fae5a, pants: 0x7a5a3c, shoe: 0x3a2e28, hip: 0.74, legR: 0.075, shoulder: 1.3, waist: 0.23, chest: 0.19, sleeve: 0.5, arm: 0.56, headY: 1.64, headR: 0.25, headSy: 1.25 });
  hairCap(p.head, 0.275, C(0x6b4423), 0.4, -0.25, 0.07);
  for (const s of [-1, 1]) ball(0.06, p.SKIN, { parent: p.head, x: s * 0.245, y: -0.03, sz: 0.6, line: 0.02 });
  face(p.head, { skin: p.SKIN, eyeX: 0.095, eyeZ: 0.18, eyeR: 0.085, brow: 0x4e3018, browY: 0.17, browTilt: -0.25, mouth: 0x7a3a34, mouthW: 0.12, mouthY: -0.17 });
  return { root: p.root, parts: p.parts, height: 1.98, blob: 0.4 };
}

// Jerry's invention: a folding lawn chair. withDrink makes the small one, which holds a drink.
// parts.frame is everything that folds flat when the big one gives up.
export function buildLawnChair(size = 1, withDrink = false) {
  const root = new THREE.Group();
  root.scale.setScalar(size);
  const frame = new THREE.Group();
  root.add(frame);
  const METAL = 0xb4b8c2, WEB = [0x3fb8a8, 0xf3f0ea];
  const line = 0.02 / size;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.025, 0.46, METAL, { parent: frame, x: sx * 0.33, y: 0.22, z: sz * 0.26, rx: sz * -0.18, sides: 5, line });
  for (let i = 0; i < 5; i++) box(0.62, 0.035, 0.11, WEB[i % 2], { parent: frame, y: 0.43, z: -0.24 + i * 0.12, line });
  const back = limb(frame, 0, 0.44, -0.3);
  back.rotation.x = -0.22;
  for (let i = 0; i < 5; i++) box(0.62, 0.11, 0.035, WEB[(i + 1) % 2], { parent: back, y: 0.1 + i * 0.13, line });
  for (const s of [-1, 1]) {
    cyl(0.025, 0.74, METAL, { parent: back, x: s * 0.33, y: 0.36, sides: 5, line });
    box(0.06, 0.035, 0.6, METAL, { parent: frame, x: s * 0.35, y: 0.66, z: 0, line });
    cyl(0.02, 0.24, METAL, { parent: frame, x: s * 0.35, y: 0.55, z: 0.26, sides: 5, line });
  }
  if (withDrink) {
    cyl(0.14, 0.34, 0xd8423c, { parent: root, y: 0.63, radiusTop: 0.17, line });
    cyl(0.02, 0.36, 0xf3f0ea, { parent: root, x: 0.05, y: 0.9, rz: -0.25, sides: 5, line: 0 });
  }
  return { root, parts: { root, frame, back } };
}

// Mom's sandwich
export function buildSandwich() {
  const root = new THREE.Group();
  const BREAD = 0xe8c98a;
  box(0.26, 0.045, 0.26, BREAD, { parent: root, y: -0.05, line: 0.02 });
  box(0.29, 0.025, 0.29, 0x62d66a, { parent: root, y: -0.012, line: 0 });
  box(0.25, 0.025, 0.25, 0xd8423c, { parent: root, y: 0.012, line: 0 });
  box(0.26, 0.045, 0.26, BREAD, { parent: root, y: 0.05, line: 0.02 });
  return root;
}

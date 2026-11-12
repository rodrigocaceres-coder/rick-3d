import * as THREE from 'three';
import { scene, camera } from '../engine/core.js';

const ray = new THREE.Raycaster();
const tmp = new THREE.Vector3();

// True when a wall or prop sits between the camera spot and what it looks at.
// Characters (Model groups mark themselves with userData.actor) never count as blocking.
function blocked(from, to) {
  const dir = tmp.subVectors(from, to);
  const far = dir.length();
  ray.set(to, dir.normalize());
  ray.far = far;
  ray.camera = camera; // needed for sprites (the snore Z's)
  for (const hit of ray.intersectObject(scene, true)) {
    let o = hit.object, actor = false, shown = true;
    for (; o; o = o.parent) { if (o.userData.actor) actor = true; if (!o.visible) shown = false; }
    if (!actor && shown && hit.object.isMesh && !hit.object.material.transparent) return true;
  }
  return false;
}

// Camera shot for a line of dialogue: look at the speaker from in front of their face, a little behind the
// listener, like an over-the-shoulder shot on TV. Tries the open front of the room first, then other angles
// and closer distances, and takes the first one with a clear view (no wall or shelf in the way).
export function shotOn(speaker, listener, lookY = 0.95) {
  const d = listener.clone().sub(speaker).setY(0);
  if (d.lengthSq() < 0.01) d.set(1, 0, 0);
  d.normalize();
  const look = speaker.clone().setY(lookY);
  const side = new THREE.Vector3(-d.z, 0, d.x);
  if (side.z < 0) side.negate(); // the side toward the open front of the room
  const front = new THREE.Vector3(0, 0, 1);
  const tries = [];
  for (const k of [1, 0.75, 0.55, 0.4]) {
    for (const [fw, sw] of [[4.2, 4.8], [6.0, 2.0], [2.0, 6.0]]) {
      tries.push(speaker.clone().addScaledVector(d, fw * k).addScaledVector(side, sw * k));
    }
    tries.push(speaker.clone().addScaledVector(front, 6.4 * k).addScaledVector(d, 1.5 * k)); // straight from the front
    tries.push(speaker.clone().addScaledVector(d, 4.2 * k).addScaledVector(side, -4.8 * k)); // the other side
  }
  // Check feet, chest and head, so a box in front of his legs counts too
  const checks = [0.25, lookY, lookY + 0.6].map((y) => speaker.clone().setY(y));
  let pos = tries[0];
  for (const p of tries) {
    p.y = 1.75;
    if (!checks.some((c) => blocked(p, c))) { pos = p; break; }
  }
  return { pos, look, fov: 30 };
}

export const SLUMP_Y = -0.46; // how far the slumped body sinks so the hips sit on the floor

// Slump a character on the floor, sitting with legs out and head down (Rick, passed out against the workbench)
export function slump(model) {
  model.group.rotation.y = -1.05;            // back to the workbench, turned a little toward the camera
  model.mesh.rotation.set(-0.08, 0, 0.08);   // leaning back a little (more tips the coat through the floor)
  model.mesh.position.set(0, SLUMP_Y, 0);    // hips on the floor
  const { legs, arms, head } = model.parts;
  legs[0].rotation.set(-1.45, 0, -0.18); legs[1].rotation.set(-1.4, 0, 0.22);
  arms[0].rotation.set(-0.25, 0, -0.5); arms[1].rotation.set(-0.15, 0, 0.6);
  head.rotation.set(0.5, 0, 0.18);
}

import * as THREE from 'three';

// Camera shot for a line of dialogue: look at the speaker from the open front of the room,
// a little behind the listener, like an over-the-shoulder shot on TV.
export function shotOn(speaker, listener, lookY = 0.95) {
  const d = listener.clone().sub(speaker).setY(0);
  if (d.lengthSq() < 0.01) d.set(1, 0, 0);
  d.normalize();
  const side = new THREE.Vector3(-d.z, 0, d.x);
  if (side.z < 0) side.negate();
  side.z = Math.max(side.z, 0.45); // always lean toward the front, where there is no wall
  side.normalize();
  const pos = speaker.clone().lerp(listener, 0.35).addScaledVector(side, 6.8).addScaledVector(d, 1.5);
  pos.y = 1.9;
  pos.x = THREE.MathUtils.clamp(pos.x, -8.2, 8.2);
  return { pos, look: speaker.clone().setY(lookY), fov: 30 };
}

// Slump a character on the floor, sitting with legs out and head down (Rick, passed out against the workbench)
export function slump(model) {
  model.group.rotation.y = -1.05;            // back to the workbench, turned a little toward the camera
  model.mesh.rotation.set(-0.2, 0, 0.08);    // leaning back
  model.mesh.position.set(0, -0.56, 0);      // hips on the floor
  const { legs, arms, head } = model.parts;
  legs[0].rotation.set(-1.45, 0, -0.18); legs[1].rotation.set(-1.4, 0, 0.22);
  arms[0].rotation.set(-0.25, 0, -0.5); arms[1].rotation.set(-0.15, 0, 0.6);
  head.rotation.set(0.5, 0, 0.18);
}

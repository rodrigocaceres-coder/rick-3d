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
  const pos = speaker.clone().lerp(listener, 0.35).addScaledVector(side, 9).addScaledVector(d, 1.6);
  pos.y = 2.1;
  pos.x = THREE.MathUtils.clamp(pos.x, -8.2, 8.2);
  return { pos, look: speaker.clone().setY(lookY), fov: 30 };
}

// Put a cutout flat on its side (Rick, passed out)
export function layDown(cut) {
  cut.mesh.rotation.z = -Math.PI / 2;
  cut.mesh.position.set(-cut.height / 2, cut.width / 2, 0);
  cut.lying = true;
}

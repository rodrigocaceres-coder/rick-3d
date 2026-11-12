import * as THREE from 'three';
import { camera } from './core.js';
import { tween, ease, lerp } from './tween.js';

// The camera has two jobs. In play it follows Morty from above and behind.
// In cutscenes and dialogue it is a film camera: cut() jumps to a shot, move() glides to one.
const pos = new THREE.Vector3(0, 9, 12);
const look = new THREE.Vector3(0, 1, 0);
let fov = 35;
let mode = 'shot';
let target = null;
let trauma = 0; // screen shake amount, fades on its own
let shotId = 0;

const FOLLOW = { offset: new THREE.Vector3(0, 10, 12), lookUp: 0.9, fov: 35, snap: 3.2 };
const tmp = new THREE.Vector3();

const rig = {
  follow(obj) { target = obj; mode = 'follow'; shotId++; },

  // Jump straight to a shot, like a cut in a TV show
  cut({ pos: p, look: l, fov: f = 35 }) {
    mode = 'shot'; shotId++;
    pos.copy(p); look.copy(l); fov = f;
  },

  // Glide from the current view to a new one
  move({ pos: p, look: l, fov: f = fov }, seconds, easing = ease.inOut) {
    mode = 'shot';
    const id = ++shotId;
    const p0 = pos.clone(), l0 = look.clone(), f0 = fov;
    return tween(seconds, (t) => {
      if (id !== shotId) return; // a newer shot took over
      pos.lerpVectors(p0, p, t); look.lerpVectors(l0, l, t); fov = lerp(f0, f, t);
    }, easing);
  },

  // Slow push toward what we are looking at. Keeps still shots alive.
  pushIn(amount = 0.12, seconds = 8) {
    const p = pos.clone().lerp(look, amount);
    return rig.move({ pos: p, look: look.clone(), fov }, seconds, ease.out);
  },

  shake(amount = 0.5) { trauma = Math.min(1, trauma + amount); },

  update(dt, time) {
    if (mode === 'follow' && target) {
      const k = 1 - Math.exp(-dt * FOLLOW.snap);
      // Clamp so the camera never drifts far outside the room
      tmp.copy(target.position);
      tmp.x = THREE.MathUtils.clamp(tmp.x, -3.2, 3.2);
      tmp.z = THREE.MathUtils.clamp(tmp.z, -3, 2.5);
      pos.lerp(tmp.clone().add(FOLLOW.offset), k);
      tmp.y += FOLLOW.lookUp;
      look.lerp(tmp, k);
      fov = lerp(fov, FOLLOW.fov, k);
    }
    trauma = Math.max(0, trauma - dt * 1.6);
    const s = trauma * trauma * 0.45;
    camera.position.set(
      pos.x + Math.sin(time * 71) * s,
      pos.y + Math.sin(time * 93 + 1) * s,
      pos.z + Math.sin(time * 57 + 2) * s * 0.5,
    );
    camera.lookAt(look);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
  },
};

export default rig;

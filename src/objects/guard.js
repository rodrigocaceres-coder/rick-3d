import * as THREE from 'three';
import { Character, buildShrimp } from './models.js';

// A shrimp guard that walks a loop of points and looks where it walks.
// The red wedge on the floor is what it can see. Step into it and you are caught.
const RANGE = 4.6;                         // how far the guard sees
const HALF = THREE.MathUtils.degToRad(30); // half the width of its view
const coneGeo = new THREE.CircleGeometry(RANGE, 14, -Math.PI / 2 - HALF, HALF * 2).rotateX(-Math.PI / 2);

export class Guard {
  // path: list of Vector3 points walked in a loop. zone: { x0, x1 } the stretch of the lab it can see into.
  constructor(path, zone, speed = 2.3) {
    this.path = path; this.zone = zone; this.speed = speed;
    this.model = new Character(buildShrimp('guard'));
    this.cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.3, depthWrite: false }));
    this.cone.position.y = 0.05;
    this.model.group.add(this.cone);
    this.reset();
  }

  get position() { return this.model.position; }

  reset() {
    this.i = 1; this.pause = 0;
    this.model.position.copy(this.path[0]);
    this.model.faceToward(this.path[1]);
  }

  update(dt, time) {
    const p = this.position, to = this.path[this.i];
    const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz);
    if (this.pause > 0) {
      this.pause -= dt;
      this.model.animate(dt, 0);
    } else if (d < 0.08) {
      this.i = (this.i + 1) % this.path.length;
      this.pause = 0.5; // stop and turn at each corner
    } else {
      const step = Math.min(d, this.speed * dt);
      p.x += (dx / d) * step; p.z += (dz / d) * step;
      this.model.animate(dt, this.speed, dx, dz, this.speed);
    }
    this.cone.material.opacity = 0.26 + Math.sin(time * 6) * 0.06;
    this.model.update();
  }

  sees(point) {
    if (point.x < this.zone.x0 || point.x > this.zone.x1) return false; // walls and glass block the view
    const dx = point.x - this.position.x, dz = point.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d > RANGE) return false;
    if (d < 0.7) return true;
    let diff = Math.atan2(dx, dz) - this.model.group.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    return Math.abs(diff) < HALF;
  }
}

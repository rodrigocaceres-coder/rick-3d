import { Cutout } from './cutout.js';
import input from '../engine/input.js';

// Morty. 8-direction movement with smooth speed-up and slow-down, and code-driven cutout animation.
const SPEED = 5.2;      // units per second at full speed
const ACCEL = 11;       // higher = snappier starts and stops
const RADIUS = 0.34;    // Morty's footprint for bumping into things

export class Player extends Cutout {
  constructor() {
    super('sprites/morty.png', 1.55);
    this.vx = 0; this.vz = 0;
    this.phase = 0;
    this.wasMoving = false;
    this.squashT = 0;
  }

  // world: { bounds: {x0, x1, z0, z1}, colliders: [{x0, x1, z0, z1}] }
  move(dt, world, canMove) {
    const a = canMove ? input.axis() : { x: 0, z: 0 };
    const len = Math.hypot(a.x, a.z) || 1;
    const k = 1 - Math.exp(-dt * ACCEL);
    this.vx += ((a.x / len) * SPEED - this.vx) * k;
    this.vz += ((a.z / len) * SPEED - this.vz) * k;

    const p = this.position;
    const nx = p.x + this.vx * dt;
    if (!blocked(nx, p.z, world)) p.x = nx; else this.vx = 0;
    const nz = p.z + this.vz * dt;
    if (!blocked(p.x, nz, world)) p.z = nz; else this.vz = 0;

    this.animate(dt, Math.hypot(this.vx, this.vz), this.vx);
  }

  // Also used by cutscenes that move Morty by hand
  animate(dt, speed, vx = 0) {
    const moving = speed > 0.6;
    if (moving) {
      this.phase += dt * speed * 2.4;
      if (Math.abs(vx) > 0.5) this.flip = vx < 0 ? -1 : 1;
    } else if (this.wasMoving) {
      this.squashT = 1; // just stopped: quick squash
    }
    this.wasMoving = moving;
    this.squashT = Math.max(0, this.squashT - dt * 6);
    const walk = moving ? Math.min(speed / SPEED, 1) : 0;
    this.mesh.position.y = Math.abs(Math.sin(this.phase)) * 0.11 * walk;
    this.mesh.rotation.z = Math.sin(this.phase) * 0.07 * walk - (vx / SPEED) * 0.1;
    this.squash = 1 - 0.13 * Math.sin(this.squashT * Math.PI);
  }
}

function blocked(x, z, { bounds, colliders }) {
  if (x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1) return true;
  for (const c of colliders) {
    const cx = Math.max(c.x0, Math.min(x, c.x1));
    const cz = Math.max(c.z0, Math.min(z, c.z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < RADIUS * RADIUS) return true;
  }
  return false;
}

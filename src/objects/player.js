import { Character, buildMorty } from './models.js';
import input from '../engine/input.js';

// Morty. 8-direction movement with smooth speed-up and slow-down. The walk animation lives in models.js.
const SPEED = 5.2;      // units per second at full speed
const ACCEL = 11;       // higher = snappier starts and stops
const RADIUS = 0.34;    // Morty's footprint for bumping into things

export class Player extends Character {
  constructor() {
    super(buildMorty());
    this.vx = 0; this.vz = 0;
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

    this.animate(dt, Math.hypot(this.vx, this.vz), this.vx, this.vz, SPEED);
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

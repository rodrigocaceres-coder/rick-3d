import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease } from '../engine/tween.js';
import { say, closeDialogue, converse } from '../ui/dialogue.js';
import { ball, box, cyl, glow, toon } from '../engine/toon.js';
import { buildLab } from '../areas/lab.js';
import { Guard } from '../objects/guard.js';
import { Portal } from '../objects/portal.js';
import { Character, buildShrimp, buildGun, PARTS } from '../objects/models.js';
import { shotOn } from './shots.js';
import { blocked } from '../objects/player.js';
import text from '../data/dialogue/lab.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
// What sits on each room's ring: the crystal (already won at the arcade), the canister, and Shrimp Rick's portal jammer.
// The jammer is why nobody portals out of this lab. Switching it off is the way out, to the Citadel.
const FLAGS = ['hasCrystal', 'hasCanister', 'jammerOff'];
const PART_FLAGS = ['hasCrystal', 'hasCanister', 'hasChip'];
const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
const CRATE = 0.45;     // half the width of a crate
const PUSH = 2.4;       // how fast Morty pushes one, units per second
const MORTY_R = 0.34;   // Morty's footprint (same as player.js)
const BEAM_Y = 1.1;

// Everything that happens in Shrimp Rick's lab: the portal gun, guards, gun parts, doors, and the ending.
// api (from main.js): { setState(name), startPlay(), toBoss() }
export function createLab({ scene, morty, api }) {
  const lab = buildLab();
  lab.group.visible = false;
  scene.add(lab.group);

  // ---- People ----
  const guards = [
    new Guard([V(21.6, 0, -3), V(25.6, 0, -3), V(25.6, 0, 3), V(21.6, 0, 3)], { x0: 16.3, x1: 26.9 }),
    new Guard([V(39.5, 0, -3.7), V(39.5, 0, 3.7)], { x0: 38, x1: 41 }, 2.6),
  ];
  const prawn = new Character(buildShrimp('rebel'));
  // Back corner by the door: the guard never faces this way, and it is out of talking range of the beam emitter
  prawn.position.set(16.9, 0, -3.9);
  prawn.group.rotation.y = 0.8;
  const shrimpRick = new Character(buildShrimp('rick'));
  shrimpRick.group.visible = false;
  lab.group.add(prawn.group, shrimpRick.group, ...guards.map((g) => g.model.group));

  // ---- Gun parts floating over their rings ----
  const makeJammer = () => {
    const g = new THREE.Group();
    box(0.5, 0.5, 0.36, 0x3a3d48, { parent: g, y: -0.1, line: 0.03 });
    cyl(0.14, 0.1, glow(0xff3a2a, 1.6), { parent: g, y: 0.2, line: 0.02 });
    box(0.36, 0.12, 0.04, glow(0xffb03a, 1.2), { parent: g, y: -0.05, z: 0.19, line: 0 });
    lab.group.add(g);
    return g;
  };
  const parts = PARTS.map((p, i) => {
    const mesh = i === 2 ? makeJammer() : p.make({ parent: lab.group });
    mesh.position.copy(lab.partSpots[i]).setY(1);
    return mesh;
  });

  // ---- Portal gun: a pair of portals and the shot that places them ----
  const portals = [new Portal({ radius: 0.95, y: 1.25 }), new Portal({ radius: 0.95, y: 1.25 })];
  portals.forEach((p) => lab.group.add(p.group));
  const bossPortal = new Portal({ radius: 1.2, y: 1.5 });
  lab.group.add(bossPortal.group);
  const shot = ball(0.16, glow(0x8dff5a, 1.8), { parent: lab.group, line: 0 });
  shot.visible = false;
  let next = 0, firing = false, hop = 0, cooldown = 0, alarmOn = false, clampToast = 0;

  // The gun in Morty's hand
  const held = buildGun().root;
  held.scale.setScalar(0.3);
  held.position.set(0, -0.47, 0.08);
  held.rotation.y = -Math.PI / 2 - 0.45;
  held.visible = false;
  morty.parts.arms[1].add(held);

  // ---- Crates: Morty pushes them (no pulling). They go through portals, sink in goo, and block beams and shots. ----
  const makeCrate = () => {
    const c = new THREE.Group();
    box(0.9, 0.9, 0.9, 0x4f7f8a, { parent: c, line: 0.035 });
    for (const y of [-0.3, 0.3]) box(0.94, 0.1, 0.94, 0xffb03a, { parent: c, y, line: 0 });
    box(0.5, 0.3, 0.02, 0x2c4a55, { parent: c, z: 0.47, line: 0 });
    lab.group.add(c);
    return c;
  };
  const crates = lab.crateHomes.map((home) => ({ mesh: makeCrate(), home, rect: { x0: 0, x1: 0, z0: 0, z1: 0 }, busy: false, hop: 0 }));
  function placeCrate(c, x, z) {
    c.mesh.position.set(x, CRATE, z);
    Object.assign(c.rect, { x0: x - CRATE, x1: x + CRATE, z0: z - CRATE, z1: z + CRATE });
  }
  const liveCrates = () => crates.filter((c) => c.mesh.visible && !c.busy);
  const boxesOverlap = (a, b) => a.x0 < b.x1 - 0.01 && a.x1 > b.x0 + 0.01 && a.z0 < b.z1 - 0.01 && a.z1 > b.z0 + 0.01;
  // Can a crate stand here? avoidGoo: also refuse goo (used when picking where a crate leaves a portal)
  function crateFree(x, z, self, avoidGoo = false) {
    if (x < 0.5 || x > 47.5 || z < -4.5 || z > 4.5) return false;
    const r = { x0: x - CRATE, x1: x + CRATE, z0: z - CRATE, z1: z + CRATE };
    if ([...lab.solids, ...lab.glass, ...lab.doors.map((d) => d.rect)].some((o) => boxesOverlap(r, o))) return false;
    // Keep a step of floor between it and the goo, or Morty could never get behind it to push it away
    if (avoidGoo && lab.hazards.some((o) => boxesOverlap({ x0: r.x0 - 0.8, x1: r.x1 + 0.8, z0: r.z0, z1: r.z1 }, o))) return false;
    if (liveCrates().some((o) => o !== self && boxesOverlap(r, o.rect))) return false;
    const m = morty.position;
    const cx = Math.max(r.x0, Math.min(m.x, r.x1)), cz = Math.max(r.z0, Math.min(m.z, r.z1));
    return Math.hypot(m.x - cx, m.z - cz) >= MORTY_R - 0.02;
  }
  // Nothing solid between two points (so a crate never pops out of a portal on the far side of a wall or the glass)
  function clearPath(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.15);
    for (let k = 1; k <= n; k++) {
      const x = ax + (bx - ax) * k / n, z = az + (bz - az) * k / n;
      if ([...lab.solids, ...lab.glass, ...lab.doors.map((d) => d.rect)].some((o) => inRect(x, z, o))) return false;
    }
    return true;
  }
  const crateForRoom = (room) => crates.find((c) => roomOf(c.home.x) === room);

  // A crate in the goo sinks, and a fresh one drops in at its spot. R does the same on purpose (for a crate stuck in a corner).
  async function respawnCrate(c, sank) {
    if (c.busy) return;
    c.busy = true;
    refreshColliders();
    if (sank) {
      audio.sfx('menu_move.mp3');
      hud.toast('The crate sank in the goo. A fresh one drops in.');
      const y0 = c.mesh.position.y;
      await tween(0.7, (t) => { c.mesh.position.y = y0 - t * 1.0; c.mesh.rotation.z = t * 0.4; }, ease.in);
    } else {
      await tween(0.2, (t) => c.mesh.scale.setScalar(Math.max(1 - t, 0.001)), ease.in);
    }
    c.mesh.visible = false;
    await wait(0.4);
    while (Math.hypot(morty.position.x - c.home.x, morty.position.z - c.home.z) < 1.0) await wait(0.1); // never drop it on Morty
    c.mesh.rotation.set(0, 0, 0);
    c.mesh.scale.setScalar(1);
    placeCrate(c, c.home.x, c.home.z);
    c.mesh.position.y = 2.5;
    c.mesh.visible = true;
    await tween(0.35, (t) => { c.mesh.position.y = 2.5 - (2.5 - CRATE) * t; }, ease.in);
    audio.sfx('blip.mp3', 0.5);
    c.busy = false;
    refreshColliders();
  }

  function crateThroughPortal(c) {
    if (c.hop > 0 || !portals[0].isOpen || !portals[1].isOpen) return;
    const p = c.mesh.position;
    for (let i = 0; i < 2; i++) {
      const pt = portals[i], out = portals[1 - i];
      if (Math.hypot(p.x - pt.position.x, p.z - pt.position.z) > 0.7) continue;
      // Out on the side the shot came from, a bit further than Morty steps, so he never lands on it. Else the other side.
      const o = out.position;
      const k = [1.9, -1.9].find((k) => {
        const x = o.x + out.exit.x * k, z = o.z + out.exit.z * k;
        return roomOf(x) === roomOf(o.x) && clearPath(o.x, o.z, x, z) && crateFree(x, z, c, true);
      });
      if (k === undefined) return;
      placeCrate(c, o.x + out.exit.x * k, o.z + out.exit.z * k);
      c.hop = 0.8;
      audio.sfx('portal.mp3', 0.7);
      tween(0.3, (t) => c.mesh.scale.setScalar(0.3 + 0.7 * t), ease.outBack);
      return;
    }
  }

  // ---- Beams: straight lines of light that go through glass and through linked portals.
  // They stop at walls, doors, crates, guards and Morty. The cyan one powers the clamp plug in room 2;
  // the red one in room 3 is a tripwire. ----
  const segGeo = new THREE.BoxGeometry(1, 1, 1);
  const beams = [
    { def: lab.beam2, color: 0x5affff, trip: false, on: () => true },
    { def: lab.trip, color: 0xff3030, trip: true, on: () => !flags.get('jammerOff') },
  ].map((b) => {
    const mat = glow(b.color, 2.2);
    b.meshes = Array.from({ length: 6 }, () => { const m = new THREE.Mesh(segGeo, mat); m.visible = false; lab.group.add(m); return m; });
    b.flare = ball(0.1, mat, { parent: lab.group, line: 0 });
    b.segs = []; b.hitPlug = false; b.hitMorty = false;
    return b;
  });

  function trace(b) {
    const segs = [];
    let [dx, dz] = b.def.dir;
    let x = b.def.from.x, z = b.def.from.z, sx = x, sz = z, ignore = -1, since = 0, jumps = 0;
    b.hitPlug = false; b.hitMorty = false;
    const linked = portals[0].isOpen && portals[1].isOpen;
    for (let n = 0; n < 800; n++) {
      x += dx * 0.08; z += dz * 0.08; since += 0.08;
      if (since > 0.6) ignore = -1;
      const enter = linked ? portals.findIndex((p, i) => i !== ignore && Math.hypot(x - p.position.x, z - p.position.z) < 0.5) : -1;
      if (enter >= 0 && jumps < 4) {
        const into = portals[enter].position, out = portals[1 - enter];
        segs.push([sx, sz, into.x, into.z]);
        x = sx = out.position.x; z = sz = out.position.z;
        const len = Math.hypot(out.exit.x, out.exit.z) || 1;
        dx = out.exit.x / len; dz = out.exit.z / len;
        ignore = 1 - enter; since = 0; jumps++;
        continue;
      }
      if (x < 0.05 || x > 47.95 || z < -4.95 || z > 4.95) break;
      if (lab.solids.some((r) => inRect(x, z, r)) || lab.doors.some((d) => inRect(x, z, d.rect))) break;
      if (liveCrates().some((c) => inRect(x, z, c.rect))) break;
      if (guards.some((g) => Math.hypot(g.position.x - x, g.position.z - z) < 0.4)) break;
      if (lab.group.visible && Math.hypot(morty.position.x - x, morty.position.z - z) < MORTY_R - 0.04) { b.hitMorty = true; break; }
      if (b.def.plug && Math.hypot(b.def.plug.x - x, b.def.plug.z - z) < 0.6) { b.hitPlug = true; break; }
    }
    segs.push([sx, sz, x, z]);
    return segs;
  }

  function drawBeam(b, time) {
    const on = lab.group.visible && b.on();
    b.segs = on ? trace(b) : [];
    b.meshes.forEach((m, i) => {
      const s = b.segs[i];
      m.visible = Boolean(s);
      if (!s) return;
      const len = Math.hypot(s[2] - s[0], s[3] - s[1]);
      const w = 0.06 + Math.sin(time * 30 + i) * 0.01;
      m.position.set((s[0] + s[2]) / 2, BEAM_Y, (s[1] + s[3]) / 2);
      m.scale.set(w, w, Math.max(len, 0.01));
      m.rotation.set(0, Math.atan2(s[2] - s[0], s[3] - s[1]), 0);
    });
    const last = b.segs[b.segs.length - 1];
    b.flare.visible = Boolean(last);
    if (last) { b.flare.position.set(last[2], BEAM_Y, last[3]); b.flare.scale.setScalar(1 + Math.sin(time * 20) * 0.3); }
  }

  // Is this point on the red tripwire? Shots fizzle in it.
  const onTripwire = (x, z) => beams[1].segs.some(([ax, az, bx, bz]) => {
    const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
    return Math.hypot(x - (ax + vx * t), z - (az + vz * t)) < 0.25;
  });

  const range = () => (flags.get('hasCanister') ? 14 : flags.get('hasCrystal') ? 7 : 6);

  // What Morty bumps into right now: walls, goo, glass, closed doors
  const world = { bounds: lab.bounds, colliders: [] };
  function refreshColliders() {
    world.colliders = [...lab.solids, ...lab.hazards, ...lab.glass, ...lab.doors.filter((d) => !d.open).map((d) => d.rect), ...liveCrates().map((c) => c.rect)];
  }
  const blocksShot = (x, z) => {
    const b = lab.bounds;
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true;
    if (lab.solids.some((r) => inRect(x, z, r))) return true;
    if (lab.doors.some((d) => inRect(x, z, d.rect))) return true; // doorways have a field that stops the beam, open or not
    if (liveCrates().some((c) => inRect(x, z, c.rect))) return true;
    return !flags.get('hasCrystal') && lab.glass.some((r) => inRect(x, z, r)); // the crystal lets the beam through glass
  };

  const roomOf = (x) => (x < 16 ? 0 : x < 32 ? 1 : 2);

  // Where a shot fired right now would go: the same rules fire() uses, with no side effects.
  // Used by fire() and by the aim guide on the floor.
  function planShot() {
    const a = Math.round(morty.group.rotation.y / (Math.PI / 4)) * (Math.PI / 4); // nearest of 8 directions
    const dx = Math.sin(a), dz = Math.cos(a);
    const from = morty.position;
    let d = 0.6, hitGuard = null, inLaser = false;
    for (; d < range(); d += 0.15) {
      const x = from.x + dx * d, z = from.z + dz * d;
      hitGuard = guards.find((g) => Math.hypot(g.position.x - x, g.position.z - z) < 0.55);
      inLaser = onTripwire(x, z);
      if (hitGuard || inLaser || blocksShot(x, z)) break;
    }
    if (!hitGuard && d < range()) d -= 0.55; // hit a wall: step back so the portal stands in front of it
    const end = V(from.x + dx * d, 0, from.z + dz * d);
    const inGoo = lab.hazards.some((r) => inRect(end.x, end.z, r, 0.3));
    const onGlass = lab.glass.some((r) => inRect(end.x, end.z, r, 0.4));
    const fizzle = inLaser ? 'The shot fizzles in the laser.' : d < 1.1 ? 'Too close. Back up and fire again.' : inGoo ? 'The shot fizzles in the goo.' : onGlass ? 'The shot fizzles on the glass.' : '';
    return { a, dx, dz, d, end, hitGuard, fizzle };
  }

  async function fire() {
    firing = true;
    const { a, dx, dz, d, end, hitGuard, fizzle } = planShot();
    morty.group.rotation.y = a; // snap, so aiming with the keyboard is predictable
    const from = morty.position;

    audio.sfx('blip.mp3', 0.9);
    shot.visible = true;
    const start = V(from.x + dx * 0.5, 0.95, from.z + dz * 0.5);
    await tween(Math.max(0.08, d / 30), (t) => shot.position.lerpVectors(start, V(end.x, 1.1, end.z), t), ease.linear);
    shot.visible = false;

    if (hitGuard) { firing = false; return caught(hitGuard, text.shotGuard[0]); }
    if (fizzle) {
      hud.toast(fizzle);
      audio.sfx('menu_move.mp3');
    } else {
      const p = portals[next];
      next = 1 - next;
      p.position.copy(end);
      p.group.rotation.y = -dx * 0.55;  // mostly face the camera, turned a little toward Morty
      p.exit = V(-dx, 0, -dz);          // which way you step out of it
      p.center.scale.setScalar(0.0001);
      p.open(0.3);
    }
    firing = false;
  }

  // ---- Aim guide: a dotted line on the floor to where the next shot lands. Green: a portal opens there.
  // Grey: it fizzles. Red: it hits a guard. Aiming in 8 directions on a projector is hard to judge by eye. ----
  const AIM_DOTS = 40;
  const aimMats = { ok: new THREE.MeshBasicMaterial({ color: 0x8dff5a, transparent: true, opacity: 0.45, depthWrite: false }),
    off: new THREE.MeshBasicMaterial({ color: 0xb8c4c8, transparent: true, opacity: 0.3, depthWrite: false }),
    guard: new THREE.MeshBasicMaterial({ color: 0xff3a3a, transparent: true, opacity: 0.55, depthWrite: false }) };
  const dotGeo = new THREE.CircleGeometry(0.06, 8).rotateX(-Math.PI / 2);
  const aimDots = Array.from({ length: AIM_DOTS }, () => { const m = new THREE.Mesh(dotGeo, aimMats.ok); m.visible = false; lab.group.add(m); return m; });
  const aimRing = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 20).rotateX(-Math.PI / 2), aimMats.ok);
  aimRing.visible = false;
  lab.group.add(aimRing);
  function showAim(on, time = 0) {
    if (!on) { aimDots.forEach((m) => { m.visible = false; }); aimRing.visible = false; return; }
    const { dx, dz, d, end, hitGuard, fizzle } = planShot();
    const mat = hitGuard ? aimMats.guard : fizzle ? aimMats.off : aimMats.ok;
    const from = morty.position, scroll = (time * 1.2) % 0.35;
    aimDots.forEach((m, i) => {
      const k = 0.6 + scroll + i * 0.35;
      m.visible = k < d;
      if (!m.visible) return;
      m.material = mat;
      m.position.set(from.x + dx * k, 0.035, from.z + dz * k);
    });
    aimRing.visible = true;
    aimRing.material = mat;
    aimRing.position.set(end.x, 0.04, end.z);
  }

  function closePortals() { portals.forEach((p) => { if (p.isOpen) p.close(0.15); }); next = 0; }

  function tryHop() {
    if (hop > 0 || !portals[0].isOpen || !portals[1].isOpen) return;
    const m = morty.position;
    portals.forEach((p, i) => {
      if (hop > 0 || Math.hypot(m.x - p.position.x, m.z - p.position.z) > 0.75) return;
      const out = portals[1 - i];
      // Step out on the side the shot came from. If that spot is blocked (glass, a wall), step out the other side.
      const side = [1.05, -1.05, 0].find((k) => !blocked(out.position.x + out.exit.x * k, out.position.z + out.exit.z * k, world));
      m.copy(out.position).addScaledVector(out.exit, side ?? 0);
      morty.group.rotation.y = Math.atan2(out.exit.x * (side || 1), out.exit.z * (side || 1));
      morty.vx = morty.vz = 0;
      hop = 0.9;
      audio.sfx('portal.mp3', 0.8);
      hud.flash(0.3, 0.2);
      tween(0.3, (t) => { morty.squash = 1 + 0.35 * Math.sin(t * Math.PI); });
    });
  }

  // ---- Caught by a guard: one loud line, then back to the start of the room ----
  async function caught(guard, line) {
    api.setState('cutscene');
    hud.cinema(true); hud.prompt('');
    audio.sfx('caught.mp3');
    rig.shake(0.5);
    if (guard) {
      guard.model.faceToward(morty.position);
      rig.cut(shotOn(guard.position, morty.position, 1.1));
    } else {
      // The tripwire: no guard in sight, Krillson yells over the speakers
      const p = morty.position;
      alarmOn = true;
      rig.cut({ pos: V(p.x - 1.2, 2.3, p.z + 3.6), look: V(p.x, 1, p.z), fov: 38 });
    }
    rig.pushIn(0.1, 5);
    await say(line ?? text.caught[Math.floor(Math.random() * text.caught.length)]);
    closeDialogue();
    await hud.fade(1, 0.35);
    alarmOn = false;
    const start = lab.starts[roomOf(morty.position.x)];
    morty.position.copy(start);
    morty.group.rotation.y = Math.PI / 2;
    crates.forEach((c) => { if (!c.busy && Math.hypot(c.mesh.position.x - start.x, c.mesh.position.z - start.z) < 1.0) respawnCrate(c); });
    closePortals();
    guards.forEach((g) => g.reset());
    api.startPlay();
    await hud.fade(0, 0.35);
  }

  // ---- Picking up a gun part ----
  async function collect(i) {
    api.setState('cutscene');
    hud.cinema(true); hud.prompt('');
    flags.set(FLAGS[i]);
    morty.animate(0.016, 0);
    const mesh = parts[i], from = mesh.position.clone();
    rig.cut(shotOn(morty.position, from));
    rig.pushIn(0.12, 5);
    audio.sfx('pickup.mp3');
    hud.flash(0.4, 0.3);
    await tween(0.7, (t) => {
      mesh.position.lerpVectors(from, V(morty.position.x, 1.9 + Math.sin(t * Math.PI) * 0.6, morty.position.z), t);
      mesh.rotation.y = t * 12;
      mesh.scale.setScalar(1 - t * 0.6);
    }, ease.out);
    mesh.visible = false;
    closePortals(); // fresh pair for the next room
    for (const line of text.pickups[['crystal', 'canister', 'jammer'][i]]) await say(line);
    closeDialogue();
    hud.parts(PART_FLAGS.map((f) => flags.get(f)));

    if (i === 1) await openDoor(lab.doors[1]);
    else await finale();
  }

  // Show the door to the next room sliding open
  async function openDoor(door) {
    rig.cut({ pos: V(door.x - 5, 3.2, 6.5), look: V(door.x, 1, 0), fov: 34 });
    audio.sfx('door.mp3');
    await tween(0.8, (t) => { door.mesh.position.y = 1.1 - t * 2.4; }, ease.inOut);
    door.open = true;
    refreshColliders();
    await wait(0.3);
    api.startPlay();
  }

  // Room 1: a crate on the pressure plate. The plate goes green and the door to room 2 opens for good.
  async function pressPlate() {
    api.setState('cutscene');
    hud.cinema(true); hud.prompt('');
    flags.set('labPlate');
    showPlate(true);
    audio.sfx('pickup.mp3', 0.7);
    rig.cut({ pos: V(10.5, 3.0, 7.5), look: V(13.4, 0.6, 2.2), fov: 36 });
    await wait(0.6);
    await openDoor(lab.doors[0]);
  }
  function showPlate(on) {
    lab.plate.top.material = toon(on ? 0x5aff8a : 0xff5a4a);
    lab.plate.top.position.y = on ? 0.07 : 0.11;
    lab.plate.ring.material.color.set(on ? 0x5aff8a : 0xff5a4a);
  }

  // Room 2: the beam hits the plug. The clamp around the canister sinks into the floor.
  async function powerOn() {
    api.setState('cutscene');
    hud.cinema(true); hud.prompt('');
    flags.set('labPower');
    showPower(true);
    audio.sfx('pickup.mp3', 0.7);
    hud.flash(0.3, 0.2);
    rig.cut({ pos: V(26.2, 2.5, 5.2), look: V(29.9, 1.0, -1.0), fov: 40 });
    await wait(0.3);
    audio.sfx('door.mp3');
    await tween(0.9, (t) => { lab.beam2.clamp.position.y = -2.1 * t; }, ease.inOut);
    for (const line of text.rooms.power) await say(line);
    closeDialogue();
    api.startPlay();
  }
  function showPower(on) {
    lab.beam2.lens.material = glow(on ? 0x5aff8a : 0xff5a4a, on ? 1.8 : 1.4);
    lab.beam2.cable.material = on ? glow(0x5affff, 1.1) : toon(0x24404a);
    lab.beam2.clamp.position.y = on ? -2.1 : 0;
  }

  // The first time Morty walks into room 2 or 3: a wide look at the new puzzle, and one or two lines
  async function firstLook(key, shot) {
    flags.set(key);
    api.setState('dialogue');
    hud.cinema(true); hud.prompt('');
    morty.animate(0.016, 0);
    rig.cut(shot);
    for (const line of text.rooms[key]) await say(line);
    closeDialogue();
    api.startPlay();
  }

  // ---- All three parts: the alarm goes off and Shrimp Rick steps out of a portal ----
  async function finale() {
    closePortals();
    crates.forEach((c) => { c.mesh.visible = false; });
    refreshColliders();
    guards.forEach((g) => { g.cone.visible = false; });
    hud.caption('ALARM. ALARM. GLORY TO THE TANK.');
    alarmOn = true;
    rig.shake(0.6);
    audio.sfx('caught.mp3');
    // Fixed cameras here: this corner is boxed in by the barrier, so the usual dialogue shots would look through a wall
    morty.position.set(46, 0, 1.8);
    morty.faceToward(V(45.4, 0, -1.2));
    bossPortal.position.set(45.4, 0, -3.3);
    rig.cut({ pos: V(47.3, 2.7, 4.5), look: V(45.9, 1.3, -2.4), fov: 40 });
    await wait(0.8);
    hud.caption('');
    hud.flash(0.8);
    await bossPortal.open();
    shrimpRick.position.set(45.4, 0, -3.1);
    shrimpRick.group.rotation.y = 0;
    shrimpRick.group.visible = true;
    let last = 0;
    await tween(0.9, (t) => {
      shrimpRick.position.z = -3.1 + t * 1.9;
      shrimpRick.animate((t - last) * 0.9, t < 0.95 ? 2.4 : 0, 0, 1, 2.4);
      last = t;
    }, ease.linear);
    rig.shake(0.3);
    for (const line of text.shrimpRick) {
      const boss = line.speaker === 'Shrimp Rick';
      rig.cut(boss ? { pos: V(47.7, 1.8, 2.9), look: V(45.4, 1.35, -1.2), fov: 34 } : { pos: V(47.0, 1.7, -1.7), look: V(46, 1.0, 1.8), fov: 32 });
      rig.pushIn(0.1, 6);
      await say(line);
    }
    closeDialogue();

    // With the jammer off and the canister in, the gun can reach the Citadel, where the chip fell. Morty jumps.
    const out = portals[0];
    out.position.set(47.4, 0, 0.6);
    out.group.rotation.y = -0.4;
    morty.faceToward(out.position);
    morty.animate(0.016, 0);
    rig.cut({ pos: V(45.6, 1.9, 4.6), look: V(46.8, 1.1, 0.6), fov: 38 });
    hud.flash(0.5);
    await out.open();
    const from = morty.position.clone();
    audio.sfx('portal.mp3');
    await tween(0.6, (t) => {
      morty.position.lerpVectors(from, out.position, t);
      morty.mesh.position.y = t * 0.5;
      morty.mesh.rotation.z = t * 5;
      morty.scale = 1 - t * 0.85;
    }, ease.in);
    hud.flash(1, 0.5);
    await hud.fade(1, 0.5);
    alarmOn = false;
    leave();
    api.toCitadel();
  }

  function leave() {
    lab.group.visible = false;
    alarmOn = false;
    held.visible = false;
    hud.parts(null); hud.hint('');
    closePortals();
    Object.assign(morty, { scale: 1, squash: 1 });
    morty.mesh.rotation.z = 0; morty.mesh.position.y = 0;
    bossPortal.group.visible = false;
    shrimpRick.group.visible = false;
  }

  return {
    world,
    goal() {
      if (flags.get('jammerOff')) return 'Get out.';
      if (flags.get('hasCanister')) return "Sneak past the patrol. Block the laser with a crate. Switch off Shrimp Rick's portal jammer.";
      if (flags.get('labPower')) return 'Get the Fluid Canister from behind the glass.';
      if (flags.get('labPlate')) return 'Bend the beam into the plug behind the glass. That frees the canister.';
      return 'Get the crate across the goo and onto the pressure plate.';
    },

    // Arrive in the lab with the Focus Crystal already in the gun. room: 0, 1 or 2 (rooms after 0 are for testing with ?lab=2 or ?lab=3).
    async enter(room = 0) {
      flags.set('hasCrystal'); // Morty won it at Blips and Chitz: it is what powers the gun here
      if (room > 0) flags.set('labPlate');
      if (room > 1) flags.setMany({ labPower: true, hasCanister: true });
      parts.forEach((m, i) => { m.visible = !flags.get(FLAGS[i]); m.scale.setScalar(1); m.position.copy(lab.partSpots[i]).setY(1); });
      lab.doors.forEach((d) => { d.open = Boolean(flags.get(d.flag)); d.mesh.position.y = d.open ? -1.3 : 1.1; });
      crates.forEach((c) => { c.busy = false; c.hop = 0; c.mesh.visible = true; c.mesh.scale.setScalar(1); c.mesh.rotation.set(0, 0, 0); placeCrate(c, c.home.x, c.home.z); });
      if (flags.get('labPlate')) placeCrate(crates[0], lab.plate.at.x, lab.plate.at.z); // it is still sitting on the plate
      showPlate(Boolean(flags.get('labPlate')));
      showPower(Boolean(flags.get('labPower')));
      refreshColliders();
      guards.forEach((g) => { g.reset(); g.cone.visible = true; });
      alarmOn = false;
      lab.group.visible = true;
      held.visible = true;
      morty.position.copy(lab.starts[room]);
      morty.group.rotation.y = Math.PI / 2;
      rig.setLimits({ x0: 6, x1: 45, z0: -1.2, z1: 0.6 }); // x1 45: the camera can look past the barrier at the tripwire
      audio.music('shrimp_dimension.m4a');
      hud.parts(PART_FLAGS.map((f) => flags.get(f)));
      hud.hint('SPACE: fire a portal the way Morty faces. Two portals link. Crates and beams go through too. Walk into a crate to push it. R: fresh crate.');

      // Arrival: wide shot gliding along the lab, then Morty's first reaction
      hud.cinema(true);
      const x = morty.position.x;
      rig.cut({ pos: V(x + 9, 3.2, 9), look: V(x + 5, 1.4, -3), fov: 40 });
      rig.move({ pos: V(x + 2.5, 2.4, 7.5), look: V(x, 1.2, -1), fov: 36 }, 5, ease.out);
      hud.caption("INT. SHRIMP RICK'S LAB. DIMENSION SHRIMP.");
      await hud.fade(0, 0.8);
      await wait(1.4);
      hud.caption('');
      if (room === 0) {
        for (const line of text.intro) await say(line);
        rig.cut({ pos: V(9.0, 3.4, 8.0), look: V(10.5, 0.6, 1.2), fov: 44 }); // the crate, the goo, the plate
        for (const line of text.rooms.plate) await say(line);
        closeDialogue();
      }
      api.startPlay();
    },

    // Runs every frame while Morty is free to move in the lab
    tick(dt) {
      cooldown -= dt; hop -= dt; clampToast -= dt;
      const m = morty.position;

      // Prawnsworth is the only one to talk to; otherwise SPACE fires the gun
      const nearPrawn = prawn.position.distanceTo(m) < 2.1;
      if (nearPrawn) {
        const p = V(prawn.position.x, 1.9, prawn.position.z).project(api.camera);
        hud.prompt('Talk', (p.x * 0.5 + 0.5) * innerWidth, (-p.y * 0.5 + 0.5) * innerHeight);
      } else hud.prompt('');
      if (cooldown <= 0 && !firing && input.pressed('Space', 'Enter', 'KeyE')) {
        if (nearPrawn) return talkToPrawn();
        fire();
      }

      tryHop();
      if (input.pressed('KeyR')) { const c = crateForRoom(roomOf(m.x)); if (c) respawnCrate(c); }
      for (const c of liveCrates()) {
        c.hop -= dt;
        if (lab.hazards.some((r) => inRect(c.mesh.position.x, c.mesh.position.z, r))) respawnCrate(c, true);
        else crateThroughPortal(c);
      }
      refreshColliders();
      parts.forEach((mesh, i) => {
        if (!mesh.visible || Math.hypot(mesh.position.x - m.x, mesh.position.z - m.z) > 0.95) return;
        if (i === 1 && !flags.get('labPower')) {
          if (clampToast <= 0) { hud.toast("It's locked in a clamp. The clamp has a plug on the far wall."); clampToast = 2; }
          return;
        }
        collect(i);
      });
      if (api.state() !== 'play') return;

      // The puzzle triggers: plate, plug, tripwire, and the first look at rooms 2 and 3
      if (!flags.get('labPlate') && crates.some((c) => !c.busy && c.mesh.visible && Math.abs(c.mesh.position.x - lab.plate.at.x) < 0.6 && Math.abs(c.mesh.position.z - lab.plate.at.z) < 0.6)) return pressPlate();
      trace(beams[0]); trace(beams[1]);
      if (!flags.get('labPower') && beams[0].hitPlug) return powerOn();
      if (beams[1].on() && beams[1].hitMorty) return caught(null, text.tripwire[0]);
      const room = roomOf(m.x);
      if (room === 1 && m.x > 17.2 && !flags.get('labSaw2')) return firstLook('labSaw2', { pos: V(25.5, 5.0, 10.5), look: V(25.0, 0.8, -1.5), fov: 48 });
      if (room === 2 && m.x > 33.4 && !flags.get('labSaw3')) return firstLook('labSaw3', { pos: V(44.0, 3.4, 7.5), look: V(46.0, 0.9, 1.0), fov: 42 });

      const seenBy = guards.find((g) => g.cone.visible && g.sees(m));
      if (seenBy) caught(seenBy);
    },

    // Runs before Morty moves: if he walks straight into a crate face, the crate slides ahead of him.
    // His speed that way is capped at the crate's, so he walks right behind it instead of bumping.
    push(dt) {
      const a = input.axis();
      if (!a.x && !a.z) return;
      const horiz = Math.abs(a.x) >= Math.abs(a.z) && a.x !== 0;
      const sx = horiz ? Math.sign(a.x) : 0, sz = horiz ? 0 : Math.sign(a.z);
      const m = morty.position;
      for (const c of liveCrates()) {
        const p = c.mesh.position;
        const along = sx ? (p.x - m.x) * sx : (p.z - m.z) * sz;
        const side = sx ? Math.abs(p.z - m.z) : Math.abs(p.x - m.x);
        if (along <= 0 || along > CRATE + MORTY_R + 0.1 || side > CRATE + 0.12) continue;
        const nx = p.x + sx * PUSH * dt, nz = p.z + sz * PUSH * dt;
        if (!crateFree(nx, nz, c)) continue;
        placeCrate(c, nx, nz);
        if (sx) morty.vx = sx * Math.min(Math.abs(morty.vx), PUSH); else morty.vz = sz * Math.min(Math.abs(morty.vz), PUSH);
        if (sx) morty.vz = 0; else morty.vx = 0;
      }
    },

    // Which room Continue should start in
    savedRoom() { return flags.get('hasCanister') ? 2 : flags.get('labPlate') ? 1 : 0; },

    // Runs every frame while the lab is on screen, even in cutscenes
    update(dt, time) {
      if (!lab.group.visible) return;
      lab.alarm.intensity = alarmOn ? 6 + Math.sin(time * 12) * 5 : 0;
      lab.update(time, morty.position.x);
      if (api.state() === 'play') guards.forEach((g) => g.update(dt, time));
      else guards.forEach((g) => g.model.update());
      prawn.animate(dt, 0); prawn.update();
      shrimpRick.update();
      parts.forEach((mesh, i) => { if (mesh.visible && api.state() === 'play') { mesh.position.y = 1 + Math.sin(time * 2.5 + i) * 0.12; mesh.rotation.y = time * 1.5; } });
      [...portals, bossPortal].forEach((p) => p.update(time));
      beams.forEach((b) => drawBeam(b, time));
      showAim(api.state() === 'play' && !firing, time);
    },

    setCooldown(s) { cooldown = s; },
    held, // the gun in Morty's hand, so the boss fight can show and aim it
    debug: { guards, portals, crates, beams, placeCrate },
  };

  async function talkToPrawn() {
    api.setState('dialogue');
    hud.prompt(''); hud.cinema(true);
    morty.faceToward(prawn.position);
    prawn.faceToward(m());
    morty.animate(0.016, 0);
    await converse(text.prawnsworth, {
      onLine(line) {
        rig.cut(line.speaker === 'Morty' ? shotOn(morty.position, prawn.position) : shotOn(prawn.position, morty.position, 1.0));
        rig.pushIn(0.1, 7);
      },
    });
    api.startPlay();
  }
  function m() { return morty.position; }
}

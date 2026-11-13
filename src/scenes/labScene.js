import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease } from '../engine/tween.js';
import { say, closeDialogue, converse } from '../ui/dialogue.js';
import { ball, glow } from '../engine/toon.js';
import { buildLab } from '../areas/lab.js';
import { Guard } from '../objects/guard.js';
import { Portal } from '../objects/portal.js';
import { Character, buildShrimp, buildGun, PARTS } from '../objects/models.js';
import { shotOn } from './shots.js';
import { blocked } from '../objects/player.js';
import text from '../data/dialogue/lab.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const FLAGS = ['hasCrystal', 'hasCanister', 'hasChip'];
const inRect = (x, z, r, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

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
  prawn.position.set(18.2, 0, -3.3);
  prawn.group.rotation.y = 0.5;
  const shrimpRick = new Character(buildShrimp('rick'));
  shrimpRick.group.visible = false;
  lab.group.add(prawn.group, shrimpRick.group, ...guards.map((g) => g.model.group));

  // ---- Gun parts floating over their rings ----
  const parts = PARTS.map((p, i) => {
    const mesh = p.make({ parent: lab.group });
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
  let next = 0, firing = false, hop = 0, cooldown = 0, alarmOn = false;

  // The gun in Morty's hand
  const held = buildGun().root;
  held.scale.setScalar(0.3);
  held.position.set(0, -0.47, 0.08);
  held.rotation.y = -Math.PI / 2 - 0.45;
  held.visible = false;
  morty.parts.arms[1].add(held);

  const range = () => (flags.get('hasCanister') ? 14 : flags.get('hasCrystal') ? 7 : 6);

  // What Morty bumps into right now: walls, goo, glass, closed doors
  const world = { bounds: lab.bounds, colliders: [] };
  function refreshColliders() {
    world.colliders = [...lab.solids, ...lab.hazards, ...lab.glass, ...lab.doors.filter((d) => !d.open).map((d) => d.rect)];
  }
  const blocksShot = (x, z) => {
    const b = lab.bounds;
    if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true;
    if (lab.solids.some((r) => inRect(x, z, r))) return true;
    if (lab.doors.some((d) => inRect(x, z, d.rect))) return true; // doorways have a field that stops the beam, open or not
    return !flags.get('hasCrystal') && lab.glass.some((r) => inRect(x, z, r)); // the crystal lets the beam through glass
  };

  const roomOf = (x) => (x < 16 ? 0 : x < 32 ? 1 : 2);

  async function fire() {
    firing = true;
    // Snap to the nearest of 8 directions, so aiming with the keyboard is predictable
    const a = Math.round(morty.group.rotation.y / (Math.PI / 4)) * (Math.PI / 4);
    morty.group.rotation.y = a;
    const dx = Math.sin(a), dz = Math.cos(a);
    const from = morty.position;
    let d = 0.6, hitGuard = null;
    for (; d < range(); d += 0.15) {
      const x = from.x + dx * d, z = from.z + dz * d;
      hitGuard = guards.find((g) => Math.hypot(g.position.x - x, g.position.z - z) < 0.55);
      if (hitGuard || blocksShot(x, z)) break;
    }
    if (!hitGuard && d < range()) d -= 0.55; // hit a wall: step back so the portal stands in front of it
    const end = V(from.x + dx * d, 0, from.z + dz * d);

    audio.sfx('blip.mp3', 0.9);
    shot.visible = true;
    const start = V(from.x + dx * 0.5, 0.95, from.z + dz * 0.5);
    await tween(Math.max(0.08, d / 30), (t) => shot.position.lerpVectors(start, V(end.x, 1.1, end.z), t), ease.linear);
    shot.visible = false;

    if (hitGuard) { firing = false; return caught(hitGuard, text.shotGuard[0]); }
    const inGoo = lab.hazards.some((r) => inRect(end.x, end.z, r, 0.3));
    const onGlass = lab.glass.some((r) => inRect(end.x, end.z, r, 0.4));
    if (d < 1.1 || inGoo || onGlass) {
      hud.toast(d < 1.1 ? 'Too close. Back up and fire again.' : inGoo ? 'The shot fizzles in the goo.' : 'The shot fizzles on the glass.');
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
    guard.model.faceToward(morty.position);
    audio.sfx('caught.mp3');
    rig.shake(0.5);
    rig.cut(shotOn(guard.position, morty.position, 1.1));
    rig.pushIn(0.1, 5);
    await say(line ?? text.caught[Math.floor(Math.random() * text.caught.length)]);
    closeDialogue();
    await hud.fade(1, 0.35);
    morty.position.copy(lab.starts[roomOf(morty.position.x)]);
    morty.group.rotation.y = Math.PI / 2;
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
    for (const line of text.pickups[PARTS[i].id]) await say(line);
    closeDialogue();
    hud.parts(FLAGS.map((f) => flags.get(f)));

    const door = lab.doors[i];
    if (door) {
      // Show the door to the next room sliding open
      rig.cut({ pos: V(door.x - 5, 3.2, 6.5), look: V(door.x, 1, 0), fov: 34 });
      audio.sfx('door.mp3');
      await tween(0.8, (t) => { door.mesh.position.y = 1.1 - t * 2.4; }, ease.inOut);
      door.open = true;
      refreshColliders();
      await wait(0.3);
      api.startPlay();
    } else {
      await finale();
    }
  }

  // ---- All three parts: the alarm goes off and Shrimp Rick steps out of a portal ----
  async function finale() {
    closePortals();
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
    await hud.fade(1, 0.6);
    alarmOn = false;
    leave();
    api.toBoss(); // Morty runs home through a portal and Shrimp Rick follows: the boss fight, in the garage
  }

  function leave() {
    lab.group.visible = false;
    alarmOn = false;
    held.visible = false;
    hud.parts(null); hud.hint('');
    closePortals();
    bossPortal.group.visible = false;
    shrimpRick.group.visible = false;
  }

  return {
    world,
    goal() {
      const n = FLAGS.filter((f) => flags.get(f)).length;
      return ['Cross the goo. Get the Focus Crystal.', 'Cross the goo. Get the Fluid Canister from behind the glass.', 'Get the Coordinate Chip past the last patrol.', 'Get out.'][n];
    },

    // Arrive in the lab with the Focus Crystal already in the gun. room: 0, 1 or 2 (rooms after 0 are for testing with ?lab=2 or ?lab=3).
    async enter(room = 0) {
      flags.set('hasCrystal'); // Morty won it at Blips and Chitz: it is what powers the gun here
      FLAGS.forEach((f, i) => { if (i < room) flags.set(f); });
      parts.forEach((m, i) => { m.visible = !flags.get(FLAGS[i]); m.scale.setScalar(1); m.position.copy(lab.partSpots[i]).setY(1); });
      lab.doors.forEach((d) => { d.open = Boolean(flags.get(d.flag)); d.mesh.position.y = d.open ? -1.3 : 1.1; });
      refreshColliders();
      guards.forEach((g) => { g.reset(); g.cone.visible = true; });
      alarmOn = false;
      lab.group.visible = true;
      held.visible = true;
      morty.position.copy(lab.starts[room]);
      morty.group.rotation.y = Math.PI / 2;
      rig.setLimits({ x0: 6, x1: 42, z0: -1.2, z1: 0.6 });
      audio.music('shrimp_dimension.m4a');
      hud.parts(FLAGS.map((f) => flags.get(f)));
      hud.hint('SPACE: fire a portal the way Morty faces. Two portals link.');

      // Arrival: wide shot gliding along the lab, then Morty's first reaction
      hud.cinema(true);
      const x = morty.position.x;
      rig.cut({ pos: V(x + 9, 3.2, 9), look: V(x + 5, 1.4, -3), fov: 40 });
      rig.move({ pos: V(x + 2.5, 2.4, 7.5), look: V(x, 1.2, -1), fov: 36 }, 5, ease.out);
      hud.caption("INT. SHRIMP RICK'S LAB. DIMENSION SHRIMP.");
      await hud.fade(0, 0.8);
      await wait(1.4);
      hud.caption('');
      if (room === 0) { for (const line of text.intro) await say(line); closeDialogue(); }
      api.startPlay();
    },

    // Runs every frame while Morty is free to move in the lab
    tick(dt) {
      cooldown -= dt; hop -= dt;
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
      parts.forEach((mesh, i) => {
        if (mesh.visible && Math.hypot(mesh.position.x - m.x, mesh.position.z - m.z) < 0.95) collect(i);
      });
      const seenBy = guards.find((g) => g.cone.visible && g.sees(m));
      if (seenBy && api.state() === 'play') caught(seenBy);
    },

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
    },

    setCooldown(s) { cooldown = s; },
    held, // the gun in Morty's hand, so the boss fight can show and aim it
    debug: { guards, portals },
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

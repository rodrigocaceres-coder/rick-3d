import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease } from '../engine/tween.js';
import { say, closeDialogue, converse } from '../ui/dialogue.js';
import { buildCitadel } from '../areas/citadel.js';
import { Model, Character, buildShrimp } from '../objects/models.js';
import { buildJerry } from '../objects/family.js';
import { buildDeskRick, buildGuardRick, buildCopRick, buildJanitorRick, buildBoredRick, buildGossipRick, buildQueueRick, buildClerkMorty } from '../objects/ricks.js';
import { Portal } from '../objects/portal.js';
import { shotOn } from './shots.js';
import text from '../data/dialogue/citadel.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LIMITS = { x0: -7.5, x1: 7.5, z0: -3, z1: 2.5 };
const FIRST_NUMBER = 9999999998;
const PART_FLAGS = ['hasCrystal', 'hasCanister', 'hasChip'];

function turnTo(now, want, k) {
  const d = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  return now + d * Math.min(1, k);
}

// Everything that happens at the Citadel: the Take a Number puzzle, the chip, and Shrimp Rick cutting the line.
// api (from main.js): { camera, state(), setState(name), startPlay(), toBoss() }. held = the gun in Morty's hand.
export function createCitadel({ scene, morty, held, api }) {
  const set = buildCitadel();
  set.group.visible = false;
  scene.add(set.group);
  const { spots } = set;

  // ---- People ----
  const place = (built, at, ry, Kind = Character) => {
    const c = new Kind(built);
    c.position.copy(at);
    c.group.rotation.y = ry;
    set.group.add(c.group);
    c.homeRy = ry;
    return c;
  };
  const desk = place(buildDeskRick(), spots.desk, -Math.PI / 2);
  const guard = place(buildGuardRick(), spots.guard, -Math.PI / 2 + 0.4);
  const cop = place(buildCopRick(), spots.cop, 0);
  const janitor = place(buildJanitorRick(), spots.janitor, 0.6);
  const gossip = place(buildGossipRick(), spots.gossip, 0.5);
  const queue = spots.queue.map((p, i) => place(buildQueueRick(i), p, Math.PI / 2));
  const jerry = place(buildJerry(), spots.jerry, Math.PI / 2);
  const clerk = place(buildClerkMorty(), spots.clerk, -Math.PI / 2, Model);
  // Bored Rick sits on the bench: legs forward, no walk cycle
  const bored = place(buildBoredRick(), spots.bored, Math.PI, Model);
  bored.parts.legs.forEach((l) => { l.rotation.x = -1.45; });
  bored.parts.arms[0].rotation.x = -0.9;
  bored.mesh.position.y = -0.18;
  const shrimpRick = place(buildShrimp('rick'), spots.shrimp, 0);
  shrimpRick.group.visible = false;
  const talkers = [desk, guard, cop, janitor, gossip, jerry, ...queue];

  const arrivePortal = new Portal({ radius: 1.05, y: 1.3 });
  arrivePortal.position.copy(spots.portal);
  const shrimpPortal = new Portal({ radius: 1.2, y: 1.5 });
  const homePortal = new Portal({ radius: 1.1, y: 1.35 });
  set.group.add(arrivePortal.group, shrimpPortal.group, homePortal.group);
  const flyChip = set.chip;

  const stage = { stare: 0, stamp: 0, ending: false };
  let cooldown = 0;

  // What Morty bumps into: the set, closed doors, and everyone standing around
  const world = { bounds: set.bounds, colliders: [] };
  const around = (p, r = 0.32) => ({ x0: p.x - r, x1: p.x + r, z0: p.z - r, z1: p.z + r });
  function refreshColliders() {
    const doors = [];
    if (!flags.get('passedDesk')) doors.push(set.doors.gate);
    if (!flags.get('passedGuard')) doors.push(set.doors.field);
    if (!flags.get('passedCop')) doors.push(set.doors.cage);
    world.colliders = [...set.colliders, ...doors, ...[guard, cop, janitor, gossip].map((c) => around(c.position)), around(clerk.position, 0.4)];
  }

  // Doors, people and props put the way the flags say (on arrival, and when continuing a save)
  function refresh() {
    set.gate.rotation.y = flags.get('passedDesk') ? Math.PI / 2 : 0;
    set.field.visible = !flags.get('passedGuard');
    set.cageDoor.position.y = flags.get('passedCop') ? 2.3 : 0;
    cop.position.copy(flags.get('passedCop') ? spots.copAside : spots.cop);
    cop.group.rotation.y = flags.get('passedCop') ? -0.6 : 0;
    set.chip.visible = !flags.get('hasChip');
    set.chip.position.copy(spots.chip);
    set.chip.scale.setScalar(1);
    shrimpRick.group.visible = false;
    [shrimpPortal, homePortal].forEach((p) => { if (p.isOpen) p.close(0.05); });
    refreshColliders();
  }

  const number = () => (FIRST_NUMBER + (flags.get('numberTries') ?? 0)).toLocaleString('en-US');
  const fill = (convo) => JSON.parse(JSON.stringify(convo).replaceAll('{number}', number()));

  function goal() {
    const g = text.goals;
    if (flags.get('hasChip')) return '';
    if (flags.get('passedCop')) return g.chip;
    if (flags.get('passedGuard')) return g.cop;
    if (flags.get('passedDesk')) return g.guard;
    return flags.get('hasNumber') ? g.desk : g.number;
  }

  // ---- Talking ----
  // at(): where the speaker stands. lookY: how high their face is.
  function talk(convo, at, lookY = 1.7, onDo) {
    return converse(fill(convo), {
      onLine(line) {
        rig.cut(line.speaker === 'Morty' ? shotOn(morty.position, at()) : shotOn(at(), morty.position, lookY));
        rig.pushIn(0.1, 7);
      },
      onDo,
    });
  }

  async function puzzle(convo, at, lookY = 1.7) {
    const todo = await talk(convo, at, lookY);
    for (const d of todo) {
      if (d.back) { await backOfLine(); return; }
      if (d.open) await open(d.open);
      if (d.take) { await takeChip(); return true; }
    }
  }

  // ---- Wrong answer: back of the line, number void ----
  async function backOfLine() {
    api.setState('cutscene');
    hud.cinema(true);
    await hud.fade(1, 0.4);
    flags.set('hasNumber', false);
    flags.set('numberTries', (flags.get('numberTries') ?? 0) + 1);
    morty.position.copy(spots.backOfLine);
    morty.group.rotation.y = Math.PI / 2;
    morty.vx = morty.vz = 0;
    morty.animate(0.016, 0);
    // Looking down the whole line from behind Morty: it goes on forever and nobody moves
    rig.cut({ pos: V(-10.6, 1.7, -3.0), look: V(1.5, 1.2, -0.3), fov: 34 });
    rig.pushIn(0.08, 4);
    stage.stare = 2.6;
    await hud.fade(0, 0.4);
    audio.sfx('caught.mp3', 0.5);
    hud.caption(text.backCaption);
    await wait(2.0);
    hud.caption('');
    hud.toast(text.backToast);
  }

  // ---- A door opens: the gate swings, the field shuts off, Cop Rick steps aside ----
  async function open(which) {
    hud.cinema(true);
    if (which === 'gate') {
      desk.parts.arms[1].rotation.x = -1.4;
      audio.sfx('menu_select.mp3');
      stage.stamp = 0.25;
      await wait(0.3);
      rig.cut({ pos: V(-0.4, 2.2, 5.4), look: V(2.4, 0.8, 2.4), fov: 36 });
      audio.sfx('door.mp3');
      await tween(0.7, (t) => { set.gate.rotation.y = t * Math.PI / 2; }, ease.out);
    } else if (which === 'field') {
      rig.cut({ pos: V(4.0, 1.8, 4.8), look: V(7, 1.1, 1.3), fov: 36 });
      audio.sfx('portal.mp3', 0.5);
      await tween(0.5, (t) => { set.field.scale.set(1, 1 - t, 1); }, ease.in);
      set.field.visible = false;
      set.field.scale.set(1, 1, 1);
    } else if (which === 'cage') {
      rig.cut({ pos: V(7.6, 2.4, 2.8), look: V(10.3, 1.2, -2.6), fov: 38 });
      const from = cop.position.clone();
      let last = 0;
      await tween(0.8, (t) => {
        cop.position.lerpVectors(from, spots.copAside, t);
        cop.animate((t - last) * 0.8, t < 0.95 ? 2 : 0, spots.copAside.x - from.x, spots.copAside.z - from.z, 2);
        last = t;
      }, ease.linear);
      cop.group.rotation.y = -0.6;
      audio.sfx('door.mp3');
      await tween(0.8, (t) => { set.cageDoor.position.y = t * 2.3; }, ease.inOut);
    }
    await wait(0.4);
    refreshColliders();
  }

  // ---- The chip: flies into the gun. Then Shrimp Rick cuts the line. ----
  async function takeChip() {
    api.setState('cutscene');
    hud.cinema(true);
    const from = flyChip.position.clone();
    rig.cut(shotOn(morty.position, from, 1.2));
    rig.pushIn(0.12, 5);
    audio.sfx('pickup.mp3');
    hud.flash(0.5, 0.3);
    await tween(0.7, (t) => {
      flyChip.position.lerpVectors(from, V(morty.position.x, 1.9 + Math.sin(t * Math.PI) * 0.6, morty.position.z), t);
      flyChip.rotation.y = t * 12;
      flyChip.scale.setScalar(1 - t * 0.6);
    }, ease.out);
    flyChip.visible = false;
    hud.parts(PART_FLAGS.map((f) => flags.get(f)));
    hud.caption(text.got);
    await wait(1.8);
    hud.caption('');
    await ending();
  }

  async function ending() {
    stage.ending = true;
    // Morty steps out of the cage, the gun at full power
    morty.position.set(10.0, 0, -1.3);
    morty.group.rotation.y = Math.PI * 0.85;
    morty.animate(0.016, 0);
    const sp = V(8.6, 0, 2.4);
    shrimpPortal.position.copy(sp);
    shrimpPortal.group.rotation.y = -0.5;
    rig.cut({ pos: V(5.2, 2.2, 4.8), look: V(9.4, 1.3, 0.2), fov: 40 });
    await wait(0.5);
    rig.shake(0.6);
    hud.flash(0.7);
    audio.sfx('portal.mp3');
    await shrimpPortal.open();
    shrimpRick.position.copy(sp);
    shrimpRick.group.rotation.y = Math.PI * 0.8;
    shrimpRick.group.visible = true;
    const to = V(9.0, 0, 1.2);
    let last = 0;
    await tween(0.9, (t) => {
      shrimpRick.position.lerpVectors(sp, to, t);
      shrimpRick.animate((t - last) * 0.9, t < 0.95 ? 2.4 : 0, to.x - sp.x, to.z - sp.z, 2.4);
      last = t;
    }, ease.linear);
    shrimpRick.faceToward(morty.position);
    morty.faceToward(shrimpRick.position);
    shrimpPortal.close(0.4);
    stage.stare = 99; // the whole hall turns to look
    rig.shake(0.3);

    const shots = {
      // Fixed spots: this corner has railings, bars and the side wall close by, so automatic shots end up behind something
      'Shrimp Rick': () => ({ pos: V(10.9, 1.7, -2.1), look: V(9.0, 1.35, 1.2), fov: 36 }),
      'Number Machine': () => ({ pos: V(-6.6, 1.5, 2.6), look: V(-9.4, 1.1, 1.2), fov: 34 }),
      'Desk Rick': () => ({ pos: V(0.6, 1.9, 1.6), look: V(2.85, 1.65, -0.5), fov: 34 }),
      'Cop Rick': () => ({ pos: V(7.4, 1.8, 0.6), look: V(9.7, 1.6, 0.1), fov: 36 }),
      Morty: () => ({ pos: V(11.6, 1.5, 0.7), look: V(10.0, 1.05, -1.3), fov: 34 }),
    };
    for (const line of text.ending) {
      if (line.speaker === 'Number Machine') {
        tween(0.3, (t) => { set.ticketSlot.position.x = -9.0 + t * 0.25; }); // it prints him a ticket
        audio.sfx('menu_move.mp3');
      }
      if (line.speaker === 'Cop Rick') {
        // Cop Rick steps between them
        const a = cop.position.clone(), b = V(9.7, 0, 0.1);
        await tween(0.5, (t) => { cop.position.lerpVectors(a, b, t); }, ease.out);
        cop.faceToward(shrimpRick.position);
      }
      rig.cut(shots[line.speaker]());
      rig.pushIn(0.1, 6);
      await say(line);
    }
    closeDialogue();

    // Morty fires the gun at full power and jumps home
    const hp = V(11.0, 0, 0.6);
    homePortal.position.copy(hp);
    homePortal.group.rotation.y = -0.9;
    morty.faceToward(hp);
    morty.animate(0.016, 0);
    rig.cut({ pos: V(8.4, 1.7, -2.1), look: V(10.6, 1.1, -0.2), fov: 42 });
    hud.flash(0.6);
    await homePortal.open();
    const from = morty.position.clone();
    audio.sfx('portal.mp3');
    await tween(0.7, (t) => {
      morty.position.lerpVectors(from, hp, t);
      morty.mesh.position.y = t * 0.5;
      morty.mesh.rotation.z = t * 5;
      morty.scale = 1 - t * 0.85;
    }, ease.in);
    hud.flash(1, 0.5);
    await hud.fade(1, 0.5);
    leave();
    api.toBoss(); // home to the garage, and Shrimp Rick does not stay in line for long
  }

  function leave() {
    set.group.visible = false;
    stage.ending = false;
    stage.stare = 0;
    shrimpRick.group.visible = false;
    [arrivePortal, shrimpPortal, homePortal].forEach((p) => { if (p.isOpen) p.close(0.05); });
    hud.parts(null);
    hud.hint('');
  }

  const usable = [
    { label: 'Take a number', at: () => spots.machine, radius: 1.7, hintY: 1.9, run: () => talk(text.machine, () => spots.machine, 1.2) },
    { label: 'Talk', at: () => spots.deskTalk, radius: 1.5, hintY: 2.3, run: () => puzzle(text.desk, () => desk.position) },
    { label: 'Talk', at: () => guard.position, radius: 1.8, hintY: 2.4, run: () => puzzle(text.guard, () => guard.position) },
    { label: 'Talk', at: () => cop.position, radius: 1.8, hintY: 2.4, when: () => !flags.get('passedCop') || !flags.get('hasChip'), run: () => puzzle(text.cop, () => cop.position) },
    { label: 'Take', at: () => spots.binTalk, radius: 1.3, hintY: 1.5, when: () => flags.get('passedCop') && !flags.get('hasChip'), run: () => puzzle(text.bin, () => spots.bin, 1.0) },
    ...queue.map((q, i) => ({ label: 'Talk', at: () => q.position, radius: 1.5, hintY: 2.4, run: () => talk(text.queue[i], () => q.position) })),
    { label: 'Talk', at: () => jerry.position, radius: 1.6, hintY: 2.2, run: () => talk(text.jerry, () => jerry.position, 1.4) },
    { label: 'Talk', at: () => clerk.position, radius: 1.6, hintY: 1.9, run: () => talk(text.clerk, () => clerk.position, 1.2) },
    { label: 'Talk', at: () => janitor.position, radius: 1.7, hintY: 2.4, run: () => talk(text.janitor, () => janitor.position) },
    { label: 'Talk', at: () => gossip.position, radius: 1.7, hintY: 2.4, run: () => talk(text.gossip, () => gossip.position) },
    { label: 'Talk', at: () => bored.position, radius: 1.8, hintY: 2.0, run: () => talk(text.bored, () => bored.position, 1.4) },
    { label: 'Look', at: () => spots.vending, radius: 1.5, hintY: 2.4, run: () => talk(text.vending, () => spots.vending, 1.4) },
  ];

  async function use(thing) {
    api.setState('dialogue');
    hud.prompt('');
    hud.cinema(true);
    morty.faceToward(thing.at());
    morty.animate(0.016, 0);
    if (await thing.run() !== true) api.startPlay();
  }

  const tmp = new THREE.Vector3();
  return {
    world,
    goal,
    hint: () => text.hint,
    debug: { desk, guard, cop, queue, jerry, shrimpRick, set, number, usable },

    async enter() {
      refresh();
      set.group.visible = true;
      morty.group.visible = true;
      held.visible = true;
      rig.setLimits(LIMITS);
      audio.music('citadel.m4a');
      hud.parts(PART_FLAGS.map((f) => flags.get(f)));
      // Morty pops out of the portal from the lab
      hud.cinema(true);
      const a = spots.arrive;
      arrivePortal.open(0.3);
      morty.position.copy(spots.portal);
      morty.group.rotation.y = Math.PI / 2;
      morty.scale = 0.2;
      rig.cut({ pos: V(a.x + 7.5, 3.4, a.z + 5.5), look: V(a.x + 4, 1.4, -1.5), fov: 44 });
      rig.move({ pos: V(a.x + 5, 2.6, a.z + 4.6), look: V(a.x + 3, 1.3, -0.8), fov: 40 }, 4, ease.out);
      hud.caption('INT. CITADEL OF RICKS. LOST AND FOUND.');
      hud.fade(0, 0.6);
      await wait(0.3);
      audio.sfx('portal.mp3', 0.6);
      await tween(0.45, (t) => { morty.position.lerpVectors(spots.portal, a, t); morty.scale = 0.2 + 0.8 * t; morty.mesh.position.y = Math.sin(t * Math.PI) * 0.5; }, ease.out);
      morty.mesh.position.y = 0; morty.scale = 1;
      rig.shake(0.15);
      arrivePortal.close(0.5); // the canister's charge got him here and no further
      await wait(1.2);
      hud.caption('');
      if (!flags.get('sawCitadel')) {
        flags.set('sawCitadel');
        rig.cut(shotOn(morty.position, V(0, 0, -1)));
        for (const line of text.arrive) await say(line);
        closeDialogue();
      }
      api.startPlay();
    },
    leave,

    // Runs every frame while Morty is free to move in the Citadel
    tick(dt) {
      cooldown -= dt;
      const m = morty.position;
      let best = null, bestD = Infinity;
      for (const u of usable) {
        if (u.when && !u.when()) continue;
        const d = u.at().distanceTo(m);
        if (d < u.radius && d < bestD) { best = u; bestD = d; }
      }
      if (!best) { hud.prompt(''); return; }
      tmp.copy(best.at()); tmp.y = best.hintY; tmp.project(api.camera);
      hud.prompt(best.label, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight);
      if (cooldown <= 0 && input.pressed('Space', 'Enter', 'KeyE')) use(best);
    },
    setCooldown(s) { cooldown = s; },

    // Runs every frame while the Citadel is on screen, even in cutscenes
    update(dt, time) {
      if (!set.group.visible) return;
      set.update(time);
      [arrivePortal, shrimpPortal, homePortal].forEach((p) => p.update(time));
      const m = morty.position, k = dt * 6;
      stage.stare -= dt;
      const look = stage.ending ? shrimpRick.position : m;
      for (const c of talkers) {
        if (c === cop && stage.ending) { c.animate(dt, 0); c.update(); continue; }
        c.animate(dt, 0);
        // Heads turn to whoever is interesting: Morty when he is close, everyone when he gets sent back or Shrimp Rick shows up
        const near = stage.stare > 0 || m.distanceTo(c.position) < 3;
        const want = near ? Math.atan2(look.x - c.position.x, look.z - c.position.z) - c.group.rotation.y : 0;
        c.parts.head.rotation.y = turnTo(c.parts.head.rotation.y, THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -1.2, 1.2), k);
        c.update();
      }
      // Desk Rick stamps forms forever
      stage.stamp -= dt;
      if (stage.stamp <= 0) desk.parts.arms[1].rotation.x = -0.6 - Math.max(0, Math.sin(time * 2.2)) * 0.7;
      // Janitor Rick mops the same tile
      janitor.parts.mop.rotation.z = Math.sin(time * 2.4) * 0.35;
      janitor.parts.arms[1].rotation.x = -0.5;
      // Guard Rick taps his baton, Bored Rick's head droops
      guard.parts.arms[1].rotation.x = -0.4 + Math.sin(time * 3) * 0.15;
      bored.parts.head.rotation.x = 0.35 + Math.sin(time * 0.5) * 0.08;
      bored.update(); clerk.update();
      clerk.parts.head.rotation.y = Math.sin(time * 0.3) * 0.15;
      if (shrimpRick.group.visible) { if (!stage.ending) shrimpRick.animate(dt, 0); shrimpRick.update(); }
    },
  };
}

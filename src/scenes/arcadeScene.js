import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease, lerp } from '../engine/tween.js';
import { say, closeDialogue, converse } from '../ui/dialogue.js';
import { buildArcade, PAD } from '../areas/arcade.js';
import { Character, PARTS } from '../objects/models.js';
import { buildJerry } from '../objects/family.js';
import { buildGorbi, buildGlorp, buildSoda, buildTicket, buildBomb } from '../objects/aliens.js';
import { Portal } from '../objects/portal.js';
import { shotOn } from './shots.js';
import text from '../data/dialogue/arcade.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LIMITS = { x0: -5, x1: 5, z0: -3, z1: 2.5 };
const $ = (id) => document.getElementById(id);

// Ticket Tumble, the 3D version: Morty runs around a light-up floor. Tickets rain down (their shadow shows where),
// lie on the floor for a moment, and he grabs them by running over them. Bombs land on a red ring and blow after
// a short fuse. After Glorp's tip, one golden ticket per round lands and runs away from him.
// Tickets carry over between rounds, like a real arcade: the goal is 5000 in total, banked in the 'tickets' flag.
// All tuning lives here. Change one value at a time.
export const TUMBLE = {
  GOAL: 5000,
  TIME: 45,              // seconds per round
  TICKET: 100,
  GOLD: 1000,
  BOMB: -200,       // was -300
  TICKET_EVERY: [0.6, 0.38], // seconds between tickets, start and end of the round (was 0.8 to 0.45: too hard for people)
  BOMB_EVERY: [2.8, 1.7],
  BOMB_AIMED: 0.35,      // share of bombs dropped where Morty is standing
  BURST_EVERY: 8,        // a cluster of tickets every this many seconds
  BURST: 6,
  TOP: 7,                // height things drop from
  FALL: 1.15,            // seconds from the top to the floor
  LINGER: 2.2,           // seconds a ticket lies on the floor before it vanishes
  FUSE: 0.95,            // seconds a bomb sits on its ring before it blows
  BLAST: 1.25,           // bomb radius
  STUN: 0.6,             // seconds Morty can't steer after a blast
  GRAB: 0.8,            // how close Morty has to be to grab a ticket
  GOLD_AT: 12,           // seconds into the round when the golden ticket drops
  GOLD_RUN: 8,           // seconds it runs around before it gives up
  GOLD_SPEED: 3.0,       // Morty runs 5.2
};

// Turn an angle toward another the short way round
function turnTo(now, want, k) {
  const d = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  return now + d * Math.min(1, k);
}

// Everything that happens at Blips and Chitz. api (from main.js): { camera, state(), setState(name), startPlay(), toLab() }
export function createArcade({ scene, morty, api }) {
  const set = buildArcade();
  set.group.visible = false;
  scene.add(set.group);
  const { spots } = set;

  // ---- People ----
  const gorbi = new Character(buildGorbi());
  gorbi.position.copy(spots.gorbi);
  const glorp = new Character(buildGlorp());
  glorp.position.copy(spots.glorp);
  glorp.group.rotation.y = -Math.PI / 2; // facing his machine, forever
  const jerry = new Character(buildJerry());
  jerry.position.copy(spots.jerry);
  jerry.group.rotation.y = 1.9;
  const portal = new Portal({ radius: 1.05, y: 1.3 });
  portal.position.copy(spots.portal);
  const flySoda = buildSoda(1);
  flySoda.visible = false;
  const flyCrystal = PARTS[0].make({ parent: set.group });
  flyCrystal.visible = false;
  set.group.add(gorbi.group, glorp.group, jerry.group, portal.group, flySoda);

  const world = {
    bounds: set.bounds,
    colliders: [...set.colliders, { x0: -8.75, x1: -7.85, z0: -1.45, z1: -0.55 }, { x0: -2.95, x1: -2.25, z0: -4.25, z1: -3.55 }],
  };
  const padWorld = { bounds: { x0: PAD.x0 + 0.3, x1: PAD.x1 - 0.3, z0: PAD.z0 + 0.3, z1: PAD.z1 - 0.3 }, colliders: [] };
  const stage = { glorpLook: false, gorbiShelf: false };
  let cooldown = 0, lights = 'idle', leaving = false;

  function refresh() {
    set.soda.visible = !flags.get('hasSoda');
    set.crystal.visible = !flags.get('hasCrystal');
  }

  function goal() {
    if (flags.get('hasCrystal')) return text.goals.done;
    if (flags.get('wonTickets')) return text.goals.prize;
    return flags.get('metGorbi') ? text.goals.play : text.goals.start;
  }

  // ---- Talking ----
  function talk(convo, at, lookY, onDo) {
    return converse(convo, {
      onLine(line) {
        rig.cut(line.speaker === 'Morty' ? shotOn(morty.position, at()) : shotOn(at(), morty.position, lookY));
        rig.pushIn(0.1, 7);
      },
      onDo,
    });
  }

  // Something flies off the top shelf, over the counter, into Morty's hands
  async function toss(prop, shelfProp, from, caption) {
    shelfProp.visible = false;
    const to = morty.position.clone().setY(0.95);
    prop.visible = true;
    await tween(0.75, (t) => {
      prop.position.lerpVectors(from, to, t);
      prop.position.y += Math.sin(t * Math.PI) * 0.9;
      prop.rotation.z = t * Math.PI * 4;
    }, ease.linear);
    prop.visible = false;
    tween(0.3, (t) => { morty.squash = 1 - 0.18 * Math.sin(t * Math.PI); });
    audio.sfx('pickup.mp3');
    hud.caption(caption);
    await wait(1.5);
    hud.caption('');
  }

  // Gorbi reaches up and throws the prizes over the counter: first the crystal, then the soda
  async function givePrize(what) {
    const mid = gorbi.position.clone().lerp(morty.position, 0.5);
    rig.cut({ pos: V(mid.x + 4.6, 2.2, mid.z + 4.4), look: V(mid.x - 0.3, 1.6, mid.z - 0.4), fov: 36 });
    stage.gorbiShelf = true;
    await wait(0.5);
    if (what === 'crystal') await toss(flyCrystal, set.crystal, spots.crystal.clone(), text.got.crystal);
    else await toss(flySoda, set.soda, spots.soda.clone(), text.got.soda);
    stage.gorbiShelf = false;
  }

  // The crystal clicks into the gun and it fires once more: a portal to Shrimp Rick's lab
  async function openLabPortal() {
    const p = portal.position;
    rig.cut({ pos: V(p.x + 3.2, 2.0, p.z + 5.2), look: V(p.x, 1.3, p.z), fov: 36 });
    morty.faceToward(p);
    morty.animate(0.016, 0);
    await wait(0.4);
    hud.flash(0.8);
    rig.shake(0.5);
    await portal.open();
    rig.pushIn(0.1, 3);
    await wait(0.9);
  }

  const usable = [
    { label: 'Talk', at: () => spots.gorbi, radius: 2.4, hintY: 2.5, run: async () => {
      const todo = await talk(text.gorbi, () => spots.gorbi, 1.75, (d) => (d.give ? givePrize(d.give) : null));
      if (todo.some((d) => d.portal)) await openLabPortal();
    } },
    { label: 'Talk', at: () => glorp.position, radius: 2.0, hintY: 1.8, run: talkGlorp },
    { label: 'Talk', at: () => jerry.position, radius: 2.0, hintY: 2.3, run: () => talk(text.jerry, () => jerry.position, 1.4) },
    { label: 'Play', at: () => spots.podium, radius: 1.6, hintY: 1.5, run: podium },
  ];

  async function talkGlorp() {
    stage.glorpLook = true;
    await talk(text.glorp, () => glorp.position, 0.95);
    stage.glorpLook = false;
  }

  async function podium() {
    const todo = await talk(text.machine, () => spots.podium, 1.0);
    if (todo.some((d) => d.play)) { await playRound(); return true; }
    return false;
  }

  async function use(thing) {
    api.setState('dialogue');
    hud.prompt('');
    hud.cinema(true);
    morty.faceToward(thing.at());
    morty.animate(0.016, 0);
    if (await thing.run() !== true) api.startPlay();
  }

  // ---- Ticket Tumble ----
  const ui = { root: $('tumble'), score: $('tumble-score'), time: $('tumble-time'), fill: $('tumble-fill'), big: $('tumble-big'), pops: $('tumble-pops') };
  const ringGeo = new THREE.RingGeometry(0.72, 1, 28).rotateX(-Math.PI / 2);
  const dotGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
  let g = null; // the round being played

  function bigText(s) { ui.big.textContent = s; ui.big.classList.remove('on'); void ui.big.offsetWidth; if (s) ui.big.classList.add('on'); }

  function pop(amount, at) {
    const p = at.clone().setY(1.6).project(api.camera);
    const el = document.createElement('div');
    el.className = `tpop ${amount < 0 ? 'bad' : amount >= TUMBLE.GOLD ? 'gold' : ''}`;
    el.textContent = amount > 0 ? `+${amount}` : `${amount}`;
    el.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
    el.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
    ui.pops.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function drawUi() {
    const left = Math.max(0, TUMBLE.TIME - g.time);
    ui.score.textContent = `${g.score} / ${TUMBLE.GOAL}`;
    ui.time.textContent = `0:${String(Math.ceil(left)).padStart(2, '0')}`;
    ui.time.classList.toggle('low', left < 10);
    ui.fill.style.width = `${Math.min(100, (g.score / TUMBLE.GOAL) * 100)}%`;
  }

  const randomSpot = () => V(lerp(PAD.x0 + 0.5, PAD.x1 - 0.5, Math.random()), 0, lerp(PAD.z0 + 0.5, PAD.z1 - 0.5, Math.random()));
  const clampPad = (p) => { p.x = THREE.MathUtils.clamp(p.x, PAD.x0 + 0.5, PAD.x1 - 0.5); p.z = THREE.MathUtils.clamp(p.z, PAD.z0 + 0.5, PAD.z1 - 0.5); return p; };

  function spawn(kind, at = randomSpot()) {
    let mesh, spark = null;
    if (kind === 'bomb') ({ root: mesh, spark } = buildBomb());
    else mesh = buildTicket(kind === 'gold');
    mesh.position.set(at.x, TUMBLE.TOP, at.z);
    mesh.rotation.y = Math.random() * 6;
    const shadowMat = new THREE.MeshBasicMaterial({ color: kind === 'bomb' ? 0xff3030 : kind === 'gold' ? 0xffd84c : 0x05020a, transparent: true, opacity: 0, depthWrite: false });
    if (kind === 'bomb') shadowMat.color.multiplyScalar(1.6);
    const shadow = new THREE.Mesh(kind === 'bomb' ? ringGeo : dotGeo, shadowMat);
    shadow.position.set(at.x, 0.07, at.z);
    set.group.add(mesh, shadow);
    g.items.push({ kind, mesh, spark, shadow, x: at.x, z: at.z, t: 0, fall: TUMBLE.FALL * (kind === 'gold' ? 1.6 : 1), landed: false, lt: 0, hop: 0, vx: 0, vz: 0 });
  }

  function removeItem(it) {
    set.group.remove(it.mesh, it.shadow);
    it.mesh.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    it.shadow.material.dispose();
    it.dead = true;
  }

  function score(amount, at) {
    g.score = Math.max(0, g.score + amount);
    pop(amount, at);
  }

  function explode(b) {
    hud.flash(0.35, 0.25);
    rig.shake(0.35);
    audio.sfx('hit_enemy.mp3', 0.8);
    // A quick orange flash on the floor where it blew
    const boom = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.8, depthWrite: false }));
    boom.material.color.multiplyScalar(1.8);
    boom.position.set(b.x, 0.09, b.z);
    set.group.add(boom);
    tween(0.35, (t) => { boom.scale.setScalar(TUMBLE.BLAST * (0.5 + t)); boom.material.opacity = 0.8 * (1 - t); }, ease.out).then(() => { set.group.remove(boom); boom.material.dispose(); });
    // Tickets lying in the blast are gone too
    for (const it of g.items) if (it.kind === 'ticket' && it.landed && !it.dead && Math.hypot(it.x - b.x, it.z - b.z) < TUMBLE.BLAST) removeItem(it);
    const dx = morty.position.x - b.x, dz = morty.position.z - b.z, d = Math.hypot(dx, dz);
    if (d < TUMBLE.BLAST) {
      score(TUMBLE.BOMB, morty.position);
      audio.sfx('hit_morty.mp3');
      g.stun = TUMBLE.STUN;
      const k = 8 / (d || 1);
      morty.vx = (d ? dx : 1) * k; morty.vz = (d ? dz : 0) * k; // knocked away from the blast
      tween(0.4, (t) => { morty.squash = 1 - 0.3 * Math.sin(t * Math.PI); });
    }
  }

  // The golden ticket hops away from Morty, toward open floor
  function goldHop(it) {
    const away = V(it.x - morty.position.x, 0, it.z - morty.position.z);
    if (away.lengthSq() < 0.01) away.set(1, 0, 0);
    away.normalize().applyAxisAngle(V(0, 1, 0), (Math.random() - 0.5) * 1.6);
    const target = clampPad(V(it.x, 0, it.z).addScaledVector(away, 1.8));
    if (Math.hypot(target.x - it.x, target.z - it.z) < 0.6) clampPad(target.copy(randomSpot())); // cornered: jump somewhere else
    const len = Math.hypot(target.x - it.x, target.z - it.z);
    const dur = Math.max(0.3, len / TUMBLE.GOLD_SPEED);
    it.vx = (target.x - it.x) / dur; it.vz = (target.z - it.z) / dur;
    it.hop = dur; it.hopLen = dur;
  }

  function stepGame(dt) {
    g.time += dt;
    const prog = Math.min(1, g.time / TUMBLE.TIME);
    g.nextTicket -= dt; g.nextBomb -= dt; g.nextBurst -= dt;
    if (g.nextTicket <= 0) { spawn('ticket'); g.nextTicket += lerp(TUMBLE.TICKET_EVERY[0], TUMBLE.TICKET_EVERY[1], prog); }
    if (g.nextBomb <= 0) {
      const aimed = Math.random() < TUMBLE.BOMB_AIMED;
      spawn('bomb', aimed ? clampPad(V(morty.position.x + morty.vx * 0.3, 0, morty.position.z + morty.vz * 0.3)) : randomSpot());
      g.nextBomb += lerp(TUMBLE.BOMB_EVERY[0], TUMBLE.BOMB_EVERY[1], prog);
    }
    if (g.nextBurst <= 0) {
      const c = randomSpot();
      for (let i = 0; i < TUMBLE.BURST; i++) spawn('ticket', clampPad(V(c.x + Math.cos(i * 1.05) * 1.1, 0, c.z + Math.sin(i * 1.05) * 0.9)));
      audio.sfx('menu_select.mp3', 0.6);
      g.nextBurst += TUMBLE.BURST_EVERY;
    }
    if (!g.goldDone && flags.get('glorpTip') && g.time >= TUMBLE.GOLD_AT) { g.goldDone = true; spawn('gold'); }

    // Morty
    g.stun -= dt;
    morty.move(dt, padWorld, g.stun <= 0);
    const m = morty.position;

    for (const it of g.items) {
      if (it.dead) continue;
      it.t += dt;
      if (!it.landed) {
        const f = Math.min(1, it.t / it.fall);
        it.mesh.position.y = lerp(TUMBLE.TOP, it.kind === 'bomb' ? 0.24 : 0.1, f * f);
        it.mesh.rotation.y += dt * 4; it.mesh.rotation.z = Math.sin(it.t * 9) * 0.5;
        const s = 0.25 + 0.75 * f;
        it.shadow.scale.setScalar((it.kind === 'bomb' ? TUMBLE.BLAST : it.kind === 'gold' ? 0.55 : 0.32) * (it.kind === 'bomb' ? 1 : s));
        it.shadow.material.opacity = (it.kind === 'bomb' ? 0.45 : 0.35) * Math.min(1, f * 2.5);
        if (f >= 1) {
          it.landed = true;
          it.mesh.rotation.z = 0;
          if (it.kind === 'bomb') audio.sfx('menu_move.mp3', 0.7);
          if (it.kind === 'gold') goldHop(it);
        }
      } else {
        it.lt += dt;
        if (it.kind === 'ticket') {
          it.mesh.visible = it.lt < TUMBLE.LINGER - 0.5 || Math.floor(it.lt * 12) % 2 === 0; // blinks before it goes
          if (it.lt > TUMBLE.LINGER) { removeItem(it); continue; }
        } else if (it.kind === 'bomb') {
          const pulse = 0.5 + 0.5 * Math.sin(it.lt * (14 + it.lt * 30));
          it.shadow.material.opacity = 0.35 + 0.45 * pulse;
          it.spark.scale.setScalar(0.7 + pulse);
          it.mesh.scale.setScalar(1 + it.lt * 0.35);
          if (it.lt > TUMBLE.FUSE) { explode(it); removeItem(it); continue; }
        } else {
          // Gold: hop, land, look around, hop again
          it.hop -= dt;
          if (it.hop > 0) {
            it.x += it.vx * dt; it.z += it.vz * dt;
            it.mesh.position.y = 0.1 + Math.sin((1 - it.hop / it.hopLen) * Math.PI) * 0.7;
          } else {
            it.mesh.position.y = 0.1;
            if (it.hop < -0.18) goldHop(it);
          }
          it.mesh.position.x = it.shadow.position.x = it.x;
          it.mesh.position.z = it.shadow.position.z = it.z;
          it.mesh.rotation.y += dt * 6;
          it.shadow.scale.setScalar(0.55); it.shadow.material.opacity = 0.5;
          if (it.lt > TUMBLE.GOLD_RUN) { removeItem(it); audio.sfx('menu_move.mp3'); continue; }
        }
      }
      // Grabbing: tickets near the floor, gold any time it is low
      if (it.kind !== 'bomb' && it.mesh.position.y < 1.3 && Math.hypot(it.x - m.x, it.z - m.z) < TUMBLE.GRAB * (it.kind === 'gold' ? 1.3 : 1)) {
        score(it.kind === 'gold' ? TUMBLE.GOLD : TUMBLE.TICKET, V(it.x, 0, it.z));
        audio.sfx(it.kind === 'gold' ? 'portal.mp3' : 'pickup.mp3', it.kind === 'gold' ? 0.8 : 0.45);
        if (it.kind === 'gold') { hud.flash(0.4, 0.3); rig.shake(0.2); }
        removeItem(it);
      }
    }
    g.items = g.items.filter((it) => !it.dead);

    if (input.pressed('Escape')) g.time = TUMBLE.TIME; // give up
    if (g.score >= TUMBLE.GOAL) finishRound(true);
    else if (g.time >= TUMBLE.TIME) finishRound(false);
    else drawUi();
  }

  function finishRound(won) {
    drawUi();
    g.on = false;
    g.items.forEach(removeItem);
    g.items = [];
    g.resolve(won);
  }

  const padShot = () => ({ pos: V(5, 9.6, 9.6), look: V(5, 0, -0.35), fov: 40 });

  async function playRound() {
    api.setState('minigame');
    flags.set('tumblePlayed');
    hud.prompt('');
    await hud.fade(1, 0.3);
    hud.cinema(false);
    hud.goal(''); hud.hint(text.tumbleHint);
    morty.position.copy(spots.padCenter).setZ(1.4);
    morty.group.rotation.y = Math.PI;
    morty.vx = morty.vz = 0;
    morty.animate(0.016, 0);
    rig.cut(padShot());
    g = { on: false, time: 0, score: flags.get('wonTickets') ? 0 : flags.get('tickets') ?? 0, items: [], nextTicket: 0.3, nextBomb: 2.5, nextBurst: TUMBLE.BURST_EVERY - 2, goldDone: false, stun: 0 };
    drawUi();
    ui.root.classList.add('on');
    lights = 'play';
    await hud.fade(0, 0.3);
    for (const n of ['3', '2', '1']) { bigText(n); audio.sfx('menu_move.mp3'); await wait(0.6); }
    bigText('GO!'); audio.sfx('menu_select.mp3');
    const done = new Promise((resolve) => { g.resolve = resolve; });
    g.on = true;
    setTimeout(() => { if (ui.big.textContent === 'GO!') bigText(''); }, 700);
    const won = await done;

    hud.hint('');
    if (won) {
      const first = !flags.get('wonTickets');
      flags.set('wonTickets');
      lights = 'win';
      bigText(`${g.score}!`);
      audio.sfx('pickup.mp3'); rig.shake(0.3); hud.flash(0.5, 0.4);
      rig.move({ pos: V(5, 3.2, 6.2), look: V(morty.position.x, 1.0, morty.position.z), fov: 34 }, 1.6, ease.out);
      morty.animate(0.016, 0);
      tween(0.9, (t) => { morty.mesh.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.5; }, ease.linear); // jumps for joy, twice
      await wait(1.4);
      if (first) hud.caption(text.win);
      await wait(1.6);
      hud.caption('');
    } else {
      lights = 'idle';
      bigText('TIME!');
      audio.sfx('caught.mp3', 0.6);
      await wait(1.4);
    }
    bigText('');
    ui.root.classList.remove('on');
    await hud.fade(1, 0.35);
    lights = 'idle';
    morty.mesh.position.y = 0;
    morty.position.set(1.0, 0, 4.4);
    morty.faceToward(spots.podium);
    morty.vx = morty.vz = 0;
    morty.animate(0.016, 0);
    if (!won) {
      // The machine offers another go
      hud.cinema(true);
      rig.cut(shotOn(spots.podium, morty.position, 1.0));
      api.setState('dialogue');
      await hud.fade(0, 0.3);
      flags.set('tickets', g.score); // banked for the next round
      const lost = JSON.parse(JSON.stringify(text.lost).replace('{score}', g.score));
      const todo = await converse(lost);
      if (todo.some((d) => d.play)) return playRound();
      api.startPlay();
      return;
    }
    api.startPlay();
    await hud.fade(0, 0.35);
  }

  // ---- Leaving: walk into the portal to the lab ----
  async function jumpToLab() {
    leaving = true;
    api.setState('cutscene');
    hud.cinema(true); hud.prompt('');
    const from = morty.position.clone(), to = portal.position.clone();
    rig.move({ pos: V(to.x + 2.4, 1.4, to.z + 5), look: V(to.x, 1.3, to.z), fov: 32 }, 0.8);
    audio.sfx('portal.mp3');
    await tween(0.7, (t) => {
      morty.position.lerpVectors(from, to, t);
      morty.mesh.position.y = t * 0.5;
      morty.mesh.rotation.z = t * 5;
      morty.scale = 1 - t * 0.85;
    }, ease.in);
    hud.flash(1, 0.5);
    await hud.fade(1, 0.5);
    leaving = false;
    api.toLab();
  }

  const tmp = new THREE.Vector3();
  return {
    world,
    goal,
    hint: () => text.hint,
    debug: { gorbi, glorp, jerry, portal, TUMBLE, get round() { return g; } },

    async enter() {
      refresh();
      set.group.visible = true;
      morty.group.visible = true;
      portal.open(0.3);
      rig.setLimits(LIMITS);
      audio.music('blips_and_chitz.m4a');
      // Morty pops out of the portal
      hud.cinema(true);
      const a = spots.arrive;
      morty.position.copy(spots.portal);
      morty.group.rotation.y = 0;
      morty.scale = 0.2;
      rig.cut({ pos: V(a.x + 8.5, 3.4, a.z + 6.5), look: V(a.x + 4, 1.3, -2.5), fov: 42 });
      rig.move({ pos: V(a.x + 5.5, 2.6, a.z + 5.5), look: V(a.x + 2.5, 1.2, -1.5), fov: 38 }, 4, ease.out);
      hud.caption('INT. BLIPS AND CHITZ. 2 A.M.');
      hud.fade(0, 0.6);
      await wait(0.3);
      await tween(0.45, (t) => { morty.position.lerpVectors(spots.portal, a, t); morty.scale = 0.2 + 0.8 * t; morty.mesh.position.y = Math.sin(t * Math.PI) * 0.5; }, ease.out);
      morty.mesh.position.y = 0; morty.scale = 1;
      rig.shake(0.15);
      if (!flags.get('hasCrystal')) portal.close(0.4); // the gun's last charge: no way back until Morty has the crystal
      await wait(1.2);
      hud.caption('');
      if (!flags.get('sawArcade')) {
        flags.set('sawArcade');
        rig.cut(shotOn(morty.position, V(0, 0, -2)));
        for (const line of text.arrive) await say(line);
        closeDialogue();
      }
      morty.group.rotation.y = Math.PI / 2;
      api.startPlay();
    },
    leave() { set.group.visible = false; portal.close(0.1); ui.root.classList.remove('on'); },

    // Runs every frame while Morty is free to move in the arcade
    tick(dt) {
      cooldown -= dt;
      const m = morty.position;
      if (!leaving && portal.isOpen && Math.hypot(m.x - portal.position.x, m.z - portal.position.z) < 0.85) { jumpToLab(); return; }
      let best = null, bestD = Infinity;
      for (const u of usable) {
        const d = u.at().distanceTo(m);
        if (d < u.radius && d < bestD) { best = u; bestD = d; }
      }
      if (!best) { hud.prompt(''); return; }
      tmp.copy(best.at()); tmp.y = best.hintY; tmp.project(api.camera);
      hud.prompt(best.label, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight);
      if (cooldown <= 0 && input.pressed('Space', 'Enter', 'KeyE')) use(best);
    },
    setCooldown(s) { cooldown = s; },

    // Runs every frame while the arcade is on screen, even in cutscenes
    update(dt, time) {
      if (!set.group.visible) return;
      if (g?.on && api.state() === 'minigame') stepGame(dt);
      set.update(time, lights);
      portal.update(time);
      const m = morty.position, k = dt * 7;

      // Gorbi: slumped behind the counter, eyes follow Morty only when he gets close. Reaches up for the soda.
      gorbi.animate(dt, 0);
      const near = m.distanceTo(gorbi.position) < 4;
      gorbi.group.rotation.y = turnTo(gorbi.group.rotation.y, stage.gorbiShelf ? Math.PI : near ? Math.atan2(m.x - gorbi.position.x, m.z - gorbi.position.z) : 0.15, k);
      gorbi.parts.head.rotation.x = near ? 0 : 0.25 + Math.sin(time * 0.6) * 0.04;
      gorbi.parts.arms[1].rotation.x = stage.gorbiShelf ? -2.8 : 0;
      gorbi.update();

      // Glorp: hammering buttons, never looks away from the screen (except his head turns to talk)
      glorp.animate(dt, 0);
      glorp.parts.arms[0].rotation.x = -1.3 + Math.sin(time * 31) * 0.12;
      glorp.parts.arms[1].rotation.x = -1.3 + Math.sin(time * 27 + 1) * 0.15;
      const want = stage.glorpLook ? Math.atan2(m.x - glorp.position.x, m.z - glorp.position.z) - glorp.group.rotation.y : 0;
      glorp.parts.head.rotation.y = turnTo(glorp.parts.head.rotation.y, THREE.MathUtils.clamp(Math.atan2(Math.sin(want), Math.cos(want)), -1.3, 1.3), k);
      glorp.mesh.position.y = Math.abs(Math.sin(time * 9)) * 0.02;
      glorp.update();

      // Jerry pitches to the claw machine until Morty comes close
      jerry.animate(dt, 0);
      const jNear = morty.group.visible && m.distanceTo(jerry.position) < 3.2;
      jerry.group.rotation.y = turnTo(jerry.group.rotation.y, jNear ? Math.atan2(m.x - jerry.position.x, m.z - jerry.position.z) : 1.9, k);
      if (!jNear) jerry.parts.arms[1].rotation.x = -1.0 - Math.sin(time * 2.6) * 0.45;
      jerry.update();
    },
  };
}

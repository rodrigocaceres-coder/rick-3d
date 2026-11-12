import * as THREE from 'three';
import { camera } from '../engine/core.js';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import ui from '../ui/battleUi.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease, clock, lerp } from '../engine/tween.js';
import { say, closeDialogue } from '../ui/dialogue.js';
import { ball, cone, glow } from '../engine/toon.js';
import { Portal } from '../objects/portal.js';
import { Model, Character, buildShrimp, buildTank } from '../objects/models.js';
import { shotOn } from './shots.js';
import { RULES, newFight, shootDamage, canBanish, startMortyTurn, shoot, defend, talk, useItem, checkPhase2, bossChoose, hitMorty, endBossTurn } from '../systems/battleRules.js';
import text from '../data/dialogue/boss.json';
import itemData from '../data/items.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const M = V(-2.6, 0, 1.0);          // where Morty stands
const B1 = V(2.4, 0, 0.6);          // Shrimp Rick on foot
const B2 = V(3.0, 0, -0.2);         // Shrimp Rick in the tank
const MORTY_TURN = 1.2, BOSS_TURN = -1.05; // facing each other, turned a little toward the camera

// The boss fight in the Smith garage: a turn-based battle staged like a TV fight scene.
// Rules are in systems/battleRules.js, every line of text is in data/dialogue/boss.json.
// G is the shared garage state from main.js. api: { setState(name), toGarage() }
export function createBoss({ G, held, api }) {
  const { garage, morty, portal } = G;
  const room = garage.group;

  // ---- Cast and props ----
  const boss = new Character(buildShrimp('rick'));
  const tank = new Model(buildTank());
  boss.group.visible = tank.group.visible = false;
  room.add(boss.group, tank.group);

  const bolt = ball(0.17, glow(0x8dff5a, 1.9), { parent: room, line: 0 });
  const krill = [0, 1, 2].map(() => cone(0.13, 0.5, glow(0xff8a9a, 1.5), { parent: room, line: 0.02, sides: 4 }));
  const blobs = [0, 1, 2, 3, 4, 5].map(() => ball(0.16, glow(0xff3a2a, 1.2), { parent: room, line: 0.02, detail: 0 }));
  const shell = ball(1.25, new THREE.MeshBasicMaterial({ color: 0xffb37a, transparent: true, opacity: 0.38, depthWrite: false }), { parent: room, line: 0, cast: false, receive: false });
  const waveMat = new THREE.MeshBasicMaterial({ color: 0x6fe6ff, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  waveMat.toneMapped = false;
  const wave = new THREE.Mesh(new THREE.RingGeometry(0.78, 1, 28).rotateX(-Math.PI / 2), waveMat);
  room.add(wave);
  [bolt, shell, wave, ...krill, ...blobs].forEach((m) => { m.visible = false; });

  const sky = new Portal({ radius: 1.7, y: 0 });      // in the ceiling: the tank drops out of it
  sky.group.rotation.x = Math.PI / 2;
  const guard = new Portal({ radius: 0.85, y: 1.0 }); // Morty's shield against Tidal Slam
  guard.group.rotation.y = -0.45; // turned toward the slam camera. Side-on, a portal is a thin sliver.
  const exit = new Portal({ radius: 2.1, y: 2.2 });   // Portal Banish
  room.add(sky.group, guard.group, exit.group);

  // ---- State ----
  let s = null;                 // the fight's numbers (battleRules.js)
  let active = false, tankOn = false, bossWalk = false;
  const hints = { shoot: 2, block: 2 };                       // show each timing hint twice, then trust the player
  const pose = { aim: 0, guard: 0, down: 0, mSq: 1, bSq: 1, tSq: 1, tilt: 0, droop: 0 };

  const foe = () => (tankOn ? tank : boss);
  const bossName = () => (tankOn ? 'TANK SHRIMP RICK' : 'SHRIMP RICK');
  const bossCenter = () => V(foe().position.x, tankOn ? 2.15 : 1.1, foe().position.z);
  const mortyCenter = () => V(morty.position.x, 0.95, morty.position.z);
  const muzzle = () => V(morty.position.x + 0.75, 1.05, morty.position.z + 0.25);
  const refresh = () => { ui.refresh(s, bossName()); ui.sauce(s.sauced); };
  const fill = (t, vars) => t.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  // ---- Camera shots. Each is a function so it follows the fighters and the tank's size. ----
  const shot = {
    // The wide shot sits high so it looks over the cardboard boxes along the front of the garage
    wide: () => (tankOn ? { pos: V(0.1, 3.9, 10.8), look: V(0.2, 1.3, 0.3), fov: 34 } : { pos: V(-0.1, 3.4, 9.6), look: V(-0.1, 0.9, 0.7), fov: 33 }),
    aim: () => ({ pos: V(M.x - 2.3, 1.75, M.z + 2.6), look: bossCenter(), fov: 38 }),                      // over Morty's shoulder
    bossClose: () => (tankOn ? { pos: V(B2.x - 3.0, 1.5, 4.4), look: V(B2.x, 2.1, B2.z), fov: 36 } : { pos: V(B1.x - 2.0, 1.3, B1.z + 3.9), look: V(B1.x, 1.2, B1.z), fov: 32 }),
    bossLow: () => (tankOn ? { pos: V(B2.x - 3.2, 0.4, B2.z + 4.2), look: V(B2.x, 2.3, B2.z), fov: 44 } : { pos: V(B1.x - 2.2, 0.45, B1.z + 2.6), look: V(B1.x, 1.5, B1.z), fov: 40 }),
    mortyClose: () => ({ pos: V(M.x + 1.5, 1.2, M.z + 3.3), look: V(M.x, 0.95, M.z), fov: 30 }),
    mortyHero: () => ({ pos: V(M.x + 1.5, 0.4, M.z + 2.3), look: V(M.x + 0.1, 1.15, M.z), fov: 38 }),
    // He attacks. On foot: over his shoulder at Morty. In the tank: from behind Morty, so the krill fly at the camera.
    threat: () => (tankOn ? { pos: V(M.x - 1.3, 2.5, M.z + 3.6), look: V(0.7, 1.3, 0), fov: 44 } : { pos: V(B1.x + 2.4, 2.2, B1.z + 3.2), look: V(M.x, 0.9, M.z), fov: 40 }),
  };

  async function narrate(line, seconds = 1.5) {
    hud.caption(line);
    await wait(seconds);
    hud.caption('');
  }

  // Jump a model from one spot to another in an arc
  function hop(model, to, height, seconds, spin = 0) {
    const from = model.position.clone();
    return tween(seconds, (t) => {
      model.position.lerpVectors(from, to, t);
      model.mesh.position.y = Math.sin(t * Math.PI) * height;
      model.mesh.rotation.x = spin * t;
    }, ease.linear).then(() => { model.mesh.position.y = 0; model.mesh.rotation.x = 0; });
  }
  const squash = (key, amount, seconds = 0.3) => tween(seconds, (t) => { pose[key] = 1 - amount * Math.sin(t * Math.PI); });
  const set = (key, to, seconds = 0.2) => { const from = pose[key]; return tween(seconds, (t) => { pose[key] = lerp(from, to, t); }, ease.out); };

  function mortyHurt() {
    audio.sfx('hit_morty.mp3');
    rig.shake(0.5);
    squash('mSq', 0.25);
    return tween(0.35, (t) => {
      morty.mesh.rotation.z = Math.sin(t * Math.PI) * 0.4;
      morty.position.x = M.x - Math.sin(t * Math.PI) * 0.35;
    });
  }

  // Put everything in place for a fresh fight. phase 2 is used when retrying after losing to the tank.
  function setup(phase) {
    const items = itemData.items.filter((it) => flags.check(it.flag)); // the sandwich has to be earned from Beth
    s = newFight({ parts: ['hasCrystal', 'hasCanister', 'hasChip'].filter((f) => flags.get(f)).length, helpedResistance: Boolean(flags.get('helpedResistance')), rudeToMom: Boolean(flags.get('rudeToMom')), items, phase });
    Object.assign(pose, { aim: 0, guard: 0, down: 0, mSq: 1, bSq: 1, tSq: 1, tilt: 0, droop: 0 });
    morty.group.visible = true; held.visible = true;
    morty.position.copy(M);
    morty.group.rotation.y = MORTY_TURN;
    morty.mesh.rotation.set(0, 0, 0); morty.mesh.position.set(0, 0, 0); morty.scale = 1;
    [bolt, shell, wave, ...krill, ...blobs].forEach((m) => { m.visible = false; });
    [sky, guard, exit].forEach((p) => { if (p.isOpen) p.close(0.05); });
    boss.group.visible = true;
    boss.mesh.rotation.set(0, 0, 0); boss.mesh.position.set(0, 0, 0);
    tank.mesh.rotation.set(0, 0, 0); tank.mesh.position.set(0, 0, 0); tank.scale = 1;
    if (phase === 2) {
      seatBoss();
      audio.music('boss_phase2.m4a');
    } else {
      tankOn = false;
      tank.group.visible = false;
      room.add(boss.group);
      boss.position.copy(B1);
      boss.group.rotation.y = BOSS_TURN;
      boss.scale = 1; boss.blob.visible = true;
      audio.music('boss_phase1.m4a');
    }
    refresh();
  }

  function seatBoss() {
    tankOn = true;
    tank.group.visible = true;
    tank.position.copy(B2);
    tank.group.rotation.y = BOSS_TURN;
    tank.parts.seat.add(boss.group);
    boss.position.set(0, 0, 0);
    boss.group.rotation.y = 0;
    boss.mesh.position.set(0, 0, 0); boss.mesh.rotation.set(0, 0, 0);
    boss.scale = 0.78; boss.blob.visible = false;
  }

  // ---- Opening: Morty tumbles home through the portal, Shrimp Rick walks out after him ----
  async function intro() {
    let done = false;
    input.nextPress('Escape').then(() => { if (!done) clock.timeScale = 40; });
    audio.music(null);
    const door = portal.position.clone();
    morty.group.visible = boss.group.visible = false;
    rig.cut({ pos: V(-5.6, 1.5, 6.4), look: V(0.6, 1.4, -4.2), fov: 38 });
    rig.move({ pos: V(-4.6, 1.7, 6.0), look: V(0.6, 1.4, -4.2), fov: 38 }, 6, ease.out);
    hud.caption('INT. SMITH GARAGE. STILL NIGHT.');
    await hud.fade(0, 0.8);
    await wait(1.0);
    hud.caption('');
    hud.flash(0.7);
    await portal.open();

    morty.group.visible = true;
    morty.position.copy(door);
    await hop(morty, M, 1.6, 0.8, Math.PI * 2);
    morty.group.rotation.y = MORTY_TURN;
    audio.sfx('hit_morty.mp3', 0.6);
    rig.shake(0.3);
    squash('mSq', 0.3);
    rig.cut(shot.mortyClose()); rig.pushIn(0.1, 6);
    for (const line of text.intro.arrive) await say(line);
    closeDialogue();

    rig.cut({ pos: V(-3.4, 0.8, 3.6), look: V(1.2, 1.5, -3.6), fov: 36 });
    rig.shake(0.5); hud.flash(0.5);
    audio.sfx('caught.mp3');
    boss.position.set(door.x, 0, door.z + 0.3);
    boss.group.visible = true;
    bossWalk = true;
    const from = boss.position.clone();
    let last = 0;
    await tween(1.5, (t) => {
      boss.position.lerpVectors(from, B1, t);
      boss.animate((t - last) * 1.5, t < 0.96 ? 2.6 : 0, B1.x - from.x, B1.z - from.z, 2.6);
      last = t;
    }, ease.linear);
    bossWalk = false;
    boss.group.rotation.y = BOSS_TURN;
    portal.close();

    for (const line of text.intro.faceOff) {
      rig.cut(line.speaker === 'Shrimp Rick' ? shot.bossLow() : line.speaker === 'Rick' ? shotOn(garage.spots.rick, M, 0.8) : shot.mortyClose());
      rig.pushIn(0.1, 6);
      await say(line);
    }
    closeDialogue();
    set('aim', 1, 0.25);

    rig.cut(shot.wide());
    audio.music('boss_phase1.m4a');
    audio.sfx('menu_select.mp3');
    rig.shake(0.4);
    hud.card({ small: 'Final boss', big: 'SHRIMP RICK' });
    await wait(1.9);
    hud.hideCard();
    set('aim', 0, 0.3);
    done = true;
    clock.timeScale = 1;
  }

  // ---- Morty's turn ----
  async function mortyTurn() {
    startMortyTurn(s);
    set('guard', 0);
    refresh();
    rig.cut(shot.wide());
    rig.pushIn(0.05, 12);
    for (;;) {
      const banish = canBanish(s);
      const m = text.menu;
      const shootOpt = banish ? m.banish : s.charged ? m.shootCharged : m.shoot;
      const itemOpt = s.items.length ? m.item : m.itemEmpty;
      const pick = await ui.menu([
        { id: 'shoot', label: shootOpt.label, desc: fill(shootOpt.desc, { dmg: shootDamage(s) }), hot: banish },
        { id: 'item', label: itemOpt.label, desc: fill(itemOpt.desc, { n: s.items.length }), off: !s.items.length },
        { id: 'talk', ...m.talk },
        { id: 'defend', ...m.defend },
      ]);
      if (pick === 'item') {
        const sub = await ui.menu([...s.items.map((it, i) => ({ id: String(i), label: it.name, desc: it.desc })), { id: 'back', ...m.back }]);
        if (sub === 'back') continue;
        return doItem(Number(sub));
      }
      if (pick === 'shoot') return banish ? doBanish() : doShoot();
      if (pick === 'talk') return doTalk();
      return doDefend();
    }
  }

  async function doShoot() {
    const sauced = s.sauced;
    rig.cut(shot.aim());
    rig.pushIn(0.06, 3);
    await set('aim', 1, 0.2);
    const q = await ui.timing({ at: bossCenter, lead: sauced ? 0.6 : 0.9, wobble: sauced ? 0.035 : 0, hint: hints.shoot-- > 0 ? text.hints.shoot : '' });
    const r = shoot(s, q);

    // The shot. Cut to the boss on impact.
    audio.sfx('blip.mp3', 1.2);
    hud.flash(0.25, 0.15);
    const from = muzzle(), to = bossCenter();
    if (r.missed) to.add(V(1.5, 2.2, -3));
    bolt.visible = true;
    bolt.scale.setScalar(q === 'perfect' ? 1.6 : 1);
    await tween(0.16, (t) => bolt.position.lerpVectors(from, to, t), ease.linear);
    bolt.visible = false;
    if (r.missed) {
      refresh();
      await narrate(text.captions.sauceMiss);
    } else if (r.blocked) {
      rig.cut(shot.bossClose());
      audio.sfx('door.mp3');
      rig.shake(0.25);
      ui.pop('BLOCKED', bossCenter(), 'small');
      await tween(0.3, (t) => { shell.scale.setScalar(1 + t * 0.6); shell.material.opacity = 0.38 * (1 - t); }, ease.out);
      shell.visible = false; shell.material.opacity = 0.38;
      refresh();
      await narrate(text.captions.shellBlocked, 1.2);
    } else {
      rig.cut(shot.bossClose());
      audio.sfx('hit_enemy.mp3');
      rig.shake(r.crit ? 0.8 : 0.45);
      hud.flash(r.crit ? 0.7 : 0.35, 0.25);
      ui.pop(r.crit ? `${r.dmg}!` : `${r.dmg}`, bossCenter(), r.crit ? 'crit' : r.weak ? 'small' : '');
      refresh();
      squash(tankOn ? 'tSq' : 'bSq', r.crit ? 0.3 : 0.18);
      const f = foe(), x0 = f.position.x;
      await tween(0.4, (t) => { f.position.x = x0 + Math.sin(t * Math.PI) * (r.crit ? 0.5 : 0.25); f.mesh.rotation.z = -Math.sin(t * Math.PI) * 0.22; });
      await wait(0.35);
    }
    set('aim', 0, 0.25);
  }

  async function doDefend() {
    defend(s);
    refresh();
    rig.cut(shot.mortyClose());
    rig.pushIn(0.08, 3);
    audio.sfx('pickup.mp3', 0.6);
    await set('guard', 1, 0.25);
    ui.pop('GUARD UP', mortyCenter().setY(1.9), 'small heal');
    await narrate(text.captions.defend, 1.2);
  }

  async function doItem(index) {
    const { item, healed } = useItem(s, index);
    rig.cut(shot.mortyClose());
    rig.pushIn(0.08, 3);
    audio.sfx('pickup.mp3');
    squash('mSq', -0.15, 0.4);
    ui.pop(`+${healed}`, mortyCenter().setY(1.9), 'heal');
    refresh();
    await say({ speaker: 'Morty', mood: 'happy', text: item.line });
    closeDialogue();
    if (s.extraTurn) await narrate(text.captions.extraTurn, 1.1);
  }

  async function doTalk() {
    const result = talk(s);
    ui.show(false);
    for (const line of text.talk[result]) {
      rig.cut(line.speaker === 'Morty' ? shot.mortyClose() : shot.bossClose());
      rig.pushIn(0.1, 6);
      await say(line);
    }
    closeDialogue();
    ui.show(true);
    refresh();
    if (result === 'rebels' || result === 'plea') {
      audio.sfx('pickup.mp3');
      set('droop', 1, 0.4);
      await narrate(text.captions[result], 1.6);
    }
  }

  // ---- Shrimp Rick's turn ----
  async function bossTurn() {
    const move = bossChoose(s);
    refresh();
    await ({ skip: doSkip, claw: doClaw, shell: doShell, sauce: doSauce, windup: doWindup, slam: doSlam, krill: doKrill })[move]();
    endBossTurn(s);
    set('droop', 0, 0.3);
    refresh();
  }

  async function doSkip() {
    rig.cut(shot.bossClose());
    rig.pushIn(0.08, 3);
    set('tilt', 0, 0.3);
    await narrate(text.captions.skip, 1.5);
  }

  // One hit on Morty with a timed block. travel(t) moves whatever is flying at him, 0 to 1.
  async function strike(base, lead, travel, { isSlam = false, easing = ease.linear } = {}) {
    const [q] = await Promise.all([
      ui.timing({ at: mortyCenter, lead, hint: hints.block-- > 0 ? text.hints.block : '' }),
      tween(lead, travel, easing),
    ]);
    const blocked = q !== 'miss';
    const d = hitMorty(s, base, blocked, isSlam);
    if (d > 0) { ui.pop(`-${d}`, mortyCenter().setY(1.8), blocked ? 'hurt small' : 'hurt'); mortyHurt(); }
    if (blocked && d > 0) ui.pop('BLOCK', mortyCenter().setY(2.5), 'small heal');
    if (blocked) audio.sfx('door.mp3', 0.7);
    refresh();
    return d;
  }

  async function doClaw() {
    ui.banner(text.banners.claw);
    rig.cut(shot.threat());
    const to = V(M.x + 1.0, 0, M.z + 0.1), from = boss.position.clone();
    bossWalk = true;
    let last = 0;
    await strike(RULES.CLAW_SNAP, 0.7, (t) => {
      boss.position.lerpVectors(from, to, t);
      boss.animate((t - last) * 0.7, 5, -1, 0, 5);
      boss.parts.arms[0].rotation.x = boss.parts.arms[1].rotation.x = -1.6 * t; // claws up
      last = t;
    }, { easing: ease.in });
    rig.cut(shot.wide());
    await wait(0.25);
    await hop(boss, B1, 0.7, 0.4);
    bossWalk = false;
    boss.group.rotation.y = BOSS_TURN;
  }

  async function doShell() {
    ui.banner(text.banners.shell);
    rig.cut(shot.bossClose());
    rig.pushIn(0.08, 3);
    audio.sfx('door.mp3');
    squash('bSq', 0.3, 0.35);
    shell.visible = true;
    shell.material.opacity = 0.38;
    await tween(0.35, (t) => shell.scale.setScalar(t), ease.outBack);
    await narrate(text.captions.shell, 1.3);
  }

  async function doSauce() {
    ui.banner(text.banners.sauce);
    rig.cut(shot.bossClose());
    squash('bSq', 0.2, 0.3);
    await wait(0.25);
    audio.sfx('caught.mp3', 0.5);
    const from = V(boss.position.x, 1.5, boss.position.z + 0.3), lens = camera.position.clone();
    await Promise.all(blobs.map(async (b, i) => {
      await wait(i * 0.04);
      b.visible = true;
      const to = lens.clone().add(V((i % 3 - 1) * 0.5, ((i * 7) % 4 - 1.5) * 0.3, -0.6));
      await tween(0.3, (t) => { b.position.lerpVectors(from, to, t); b.scale.setScalar(1 + t * 2); }, ease.in);
      b.visible = false;
    }));
    rig.shake(0.3);
    ui.sauce(true);
    refresh();
    await narrate(text.captions.sauce, 1.7);
  }

  async function doWindup() {
    rig.cut(shot.bossLow());
    rig.pushIn(0.12, 2);
    audio.sfx('caught.mp3', 0.8);
    rig.shake(0.35);
    refresh();
    await set('tilt', 1, 0.6);
    await narrate(text.captions.windup, 1.4);
  }

  async function doKrill() {
    ui.banner(text.banners.krill);
    rig.cut(shot.threat());
    const from = V(B2.x, 3.3, B2.z);
    for (const k of krill) {
      if (s.morty.hp <= 0) break;
      audio.sfx('blip.mp3', 0.8);
      k.visible = true;
      const to = mortyCenter();
      await strike(RULES.KRILL_HIT, 0.62, (t) => {
        k.position.lerpVectors(from, to, t);
        k.position.y += Math.sin(t * Math.PI) * 1.3;
        k.rotation.z = t * 14;
      });
      k.visible = false;
      await wait(0.12);
    }
    await wait(0.3);
  }

  async function doSlam() {
    ui.banner(text.banners.slam, 1.2);
    const soak = s.defending && s.parts >= 2;
    rig.cut({ pos: V(M.x - 1.7, 0.6, M.z + 2.6), look: V(0.9, 2.1, 0), fov: 52 }); // low behind Morty: the tank leaps at the camera
    if (soak) { guard.position.set(M.x + 1.0, 0, M.z + 0.1); guard.open(0.25); }
    const land = V(0.9, 0, 0.3), from = tank.position.clone();
    pose.tilt = 0;
    let landed = false;
    const d = await strike(RULES.TIDAL_SLAM, 1.0, (t) => {
      // 0 to 0.7: the tank leaps and comes down in the middle of the garage. 0.7 to 1: the wave runs at Morty.
      const j = Math.min(t / 0.7, 1);
      tank.position.lerpVectors(from, land, j);
      tank.mesh.position.y = Math.sin(j * Math.PI) * 3.0;
      if (j >= 1 && !landed) {
        landed = true;
        audio.sfx('hit_enemy.mp3', 1.4);
        rig.shake(1); hud.flash(0.6, 0.3);
        squash('tSq', 0.3);
        wave.visible = true;
        wave.position.set(land.x, 0.08, land.z);
      }
      if (landed) {
        const w = (t - 0.7) / 0.3;
        wave.scale.setScalar(0.6 + w * (soak ? 2.2 : 3.4));
        wave.material.opacity = 0.9;
      }
    }, { isSlam: true });
    if (soak) {
      // The wave gets pulled into Morty's portal instead of hitting him
      ui.pop('SOAKED UP', mortyCenter().setY(2.0), 'heal');
      await tween(0.3, (t) => { wave.scale.setScalar(2.8 * (1 - t) + 0.1); wave.position.x = lerp(land.x, guard.position.x, t); wave.position.y = 0.08 + t; }, ease.in);
      wave.visible = false;
      guard.close(0.25);
      audio.sfx('portal.mp3', 0.6);
      await narrate(text.captions.soaked, 1.4);
    } else {
      await tween(0.3, (t) => { wave.scale.setScalar(4 + t * 3); wave.material.opacity = 0.9 * (1 - t); }, ease.out);
      wave.visible = false;
      if (d === 0) await wait(0.2);
    }
    rig.cut(shot.wide());
    await hop(tank, B2, 1.2, 0.5);
    squash('tSq', 0.15);
  }

  // ---- Phase 2: he calls his walking tank down through a portal in the ceiling ----
  async function tankEntrance() {
    ui.show(false);
    shell.visible = false;
    for (const line of text.phase2.before) { rig.cut(shot.bossClose()); rig.pushIn(0.1, 5); await say(line); }
    closeDialogue();
    audio.music(null);
    hud.caption(text.captions.whistle);
    audio.sfx('menu_select.mp3', 1.4);
    await hop(boss, V(5.2, 0, -2.2), 0.6, 0.45);
    boss.group.rotation.y = BOSS_TURN;

    rig.cut({ pos: V(-1.6, 0.5, 4.4), look: V(B2.x, 3.3, B2.z), fov: 46 });
    sky.position.set(B2.x, 4.7, B2.z);
    rig.shake(0.5); hud.flash(0.6);
    await sky.open();
    await wait(0.5);
    hud.caption('');
    tank.group.visible = true;
    tank.position.copy(B2);
    tank.group.rotation.y = BOSS_TURN;
    await tween(0.5, (t) => { tank.mesh.position.y = (1 - t) * 4.6; tank.mesh.rotation.z = (1 - t) * 0.5; }, ease.in);
    audio.sfx('hit_enemy.mp3', 1.4);
    rig.shake(1); hud.flash(0.5, 0.25);
    squash('tSq', 0.35, 0.4);
    sky.close(0.4);
    await wait(0.5);

    // He jumps in
    rig.cut(shot.wide());
    await hop(boss, V(B2.x, 1.38, B2.z), 2.6, 0.7, Math.PI * 2);
    seatBoss();
    audio.sfx('pickup.mp3');
    squash('tSq', 0.12, 0.3);
    audio.music('boss_phase2.m4a');
    rig.cut(shot.bossLow()); rig.pushIn(0.12, 4);
    rig.shake(0.4);
    hud.card({ small: 'Phase 2', big: 'TANK<br>SHRIMP RICK' });
    await wait(1.9);
    hud.hideCard();
    for (const line of text.phase2.after) { rig.cut(line.speaker === 'Morty' ? shot.mortyClose() : shot.bossLow()); rig.pushIn(0.1, 6); await say(line); }
    closeDialogue();
    ui.show(true);
    refresh();
  }

  // ---- Portal Banish: the finisher. Returns true when it lands. ----
  async function doBanish() {
    ui.banner(text.banners.banish, 1.3, true);
    rig.cut(shot.mortyHero());
    rig.pushIn(0.1, 3);
    await set('aim', 1, 0.2);
    await wait(0.5);
    // Over Morty's shoulder for the timed press: the ring sits on the tank, so the tank has to be in shot
    rig.cut(shot.aim());
    const q = await ui.timing({ at: bossCenter, lead: 1.1, hint: text.hints.banish });
    s.sauced = false;
    if (q === 'miss') {
      audio.sfx('menu_move.mp3');
      set('aim', 0, 0.25);
      refresh();
      await narrate(text.captions.banishMiss, 1.4);
      return false;
    }
    ui.show(false);
    // The shot goes past him and opens a portal at his back
    audio.sfx('blip.mp3', 1.4);
    hud.flash(0.8, 0.3);
    rig.cut(shot.wide());
    const spot = V(B2.x + 0.4, 0, B2.z - 2.1);
    bolt.visible = true; bolt.scale.setScalar(2.2);
    const from = muzzle(), to = V(spot.x, 2.2, spot.z);
    await tween(0.3, (t) => bolt.position.lerpVectors(from, to, t), ease.linear);
    bolt.visible = false;
    exit.position.copy(spot);
    rig.shake(0.8);
    await exit.open(0.5);
    set('aim', 0, 0.3);
    // The tank digs its feet in and slides anyway
    rig.cut(shot.bossLow());
    await tween(0.9, (t) => { tank.mesh.rotation.z = Math.sin(t * 40) * 0.07; tank.position.z = B2.z - t * 0.5; rig.shake(0.08); }, ease.linear);
    for (const line of text.banish) { rig.cut(shot.bossClose()); rig.pushIn(0.15, 3); await say(line); }
    closeDialogue();
    rig.cut(shot.wide());
    const start = tank.position.clone();
    // Sucked in: spins around the middle of the tank (around its feet it swung through the floor and walls)
    // while it shrinks and its middle travels into the middle of the portal
    const MID = 1.8, mouth = exit.centerPoint();
    await tween(1.0, (t) => {
      tank.position.lerpVectors(start, spot, t);
      const a = t * t * 10, sc = 1 - t * 0.93, mid = lerp(MID, mouth.y, t);
      tank.scale = sc;
      tank.mesh.rotation.z = a;
      tank.mesh.position.set(MID * sc * Math.sin(a), mid - MID * sc * Math.cos(a), 0);
      rig.shake(0.1);
    }, ease.in);
    tank.group.visible = false;
    hud.flash(1, 0.5);
    rig.shake(0.7);
    audio.music(null);
    await exit.close(0.35);
    await wait(1.1);
    return true;
  }

  async function ending() {
    const rickPos = garage.spots.rick;
    audio.music('ending.m4a');
    const cuts = [
      () => shot.mortyClose(),
      () => { G.rickAwake = true; return shotOn(rickPos, M, 0.9); },
      () => { G.rickAwake = false; audio.sfx('blip.mp3'); rig.shake(0.15); return shot.mortyHero(); },
      () => shot.mortyClose(),
    ];
    for (const [i, line] of text.ending.entries()) { rig.cut(cuts[i]()); rig.pushIn(0.1, 6); await say(line); }
    closeDialogue();
    G.rickAwake = false;
    await hud.fade(1, 0.9);
    hud.card({ small: 'The end', big: 'TOTAL RICKALL<br>OF PARTS', hint: 'Press SPACE', solid: true });
    await input.nextPress('Space', 'Enter');
    hud.hideCard();
    // After the credits
    await wait(0.5);
    hud.caption(text.postCredits.caption);
    await wait(1.4);
    for (const line of text.postCredits.lines) await say(line);
    closeDialogue();
    hud.caption('');
  }

  async function lose() {
    ui.show(false);
    audio.music(null);
    rig.cut(shot.mortyClose());
    await tween(0.5, (t) => { pose.down = t; }, ease.outBounce);
    await wait(0.6);
    for (const line of text.lose) { rig.cut(shot.bossLow()); rig.pushIn(0.1, 5); await say(line); }
    closeDialogue();
    await hud.fade(1, 0.5);
    hud.card({ small: 'Morty is down', big: 'TRY AGAIN', hint: 'Press SPACE. Your items come back.', solid: true });
    await input.nextPress('Space', 'Enter');
    hud.hideCard();
  }

  // One whole fight. Resolves true when Shrimp Rick is banished, false when Morty is knocked out.
  async function fight() {
    ui.show(true);
    let banishTold = false;
    for (;;) {
      if (await mortyTurn() === true) return true;
      if (checkPhase2(s)) await tankEntrance();
      if (s.extraTurn) { s.extraTurn = false; continue; }
      await bossTurn();
      if (s.morty.hp <= 0) return false;
      if (canBanish(s) && !banishTold) {
        banishTold = true;
        rig.cut(shot.mortyHero());
        audio.sfx('pickup.mp3');
        await narrate(text.captions.banishReady, 1.8);
      }
    }
  }

  return {
    get active() { return active; },
    debug: { state: () => s, pose, tank, boss },

    // Run the boss fight from start to finish. phase: 2 jumps straight to the tank (for testing with ?boss=2).
    async start({ phase = 1, skipIntro = false } = {}) {
      active = true;
      api.setState('battle');
      hud.cinema(true); hud.prompt(''); hud.hint('');
      setup(phase);
      if (skipIntro) { rig.cut(shot.wide()); await hud.fade(0, 0.5); } else await intro();
      while (!(await fight())) {
        await lose();
        setup(s.phase);
        rig.cut(shot.wide());
        await hud.fade(0, 0.4);
      }
      await ending();
      flags.set('bossBeaten');
      active = false;
      ui.show(false);
      boss.group.visible = false;
      room.add(boss.group);
      morty.group.rotation.y = 0;
      api.toGarage();
    },

    // Every frame while the fight is on: idle motion and poses on top of the staged moves
    update(dt, time) {
      if (!active) return;
      // Morty: breathing, then the aim, guard and knocked-out poses on top
      morty.animate(dt, 0);
      const [left, right] = morty.parts.arms;
      right.rotation.x = lerp(right.rotation.x, -1.5, Math.max(pose.aim, pose.guard));
      left.rotation.x = lerp(left.rotation.x, -1.2, pose.guard);
      held.rotation.x = 1.5 * Math.max(pose.aim, pose.guard); // keep the barrel level when the arm comes up
      morty.squash = pose.mSq * (1 - 0.14 * pose.guard);
      if (pose.down > 0) { morty.mesh.rotation.x = -1.45 * pose.down; morty.mesh.position.y = 0.3 * pose.down; }

      // Shrimp Rick: breathing, claws out, head hangs when Morty's words land
      if (!bossWalk) boss.animate(dt, 0);
      boss.squash = pose.bSq;
      boss.parts.head.rotation.x = 0.45 * pose.droop;
      if (tankOn) { boss.parts.arms[0].rotation.x = boss.parts.arms[1].rotation.x = -1.2 + Math.sin(time * 3) * 0.1; }
      boss.update();

      // Tank: bobs on its legs, claws snap, rears back and glows while winding up
      const body = tank.parts.body;
      body.position.y = Math.sin(time * 2.2) * 0.05 + pose.tilt * 0.25;
      body.rotation.x = -0.28 * pose.tilt;
      tank.parts.arms.forEach((a, i) => { a.rotation.x = Math.sin(time * 2.6 + i * 2) * 0.12 - pose.tilt * 0.9; });
      tank.parts.water.material.color.setRGB(0.16, 0.82, 1).multiplyScalar(1 + pose.tilt * (1.2 + Math.sin(time * 14) * 0.5));
      tank.squash = pose.tSq;
      tank.update();

      if (shell.visible) {
        shell.position.set(boss.position.x, 1.0, boss.position.z);
        if (s?.shelled) shell.scale.setScalar(1 + Math.sin(time * 5) * 0.04);
      }
      [sky, guard, exit].forEach((p) => p.update(time));
    },
  };
}

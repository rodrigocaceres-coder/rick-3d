import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import flags from '../systems/flags.js';
import { tween, wait, ease, lerp } from '../engine/tween.js';
import { say, closeDialogue, converse } from '../ui/dialogue.js';
import { box, glow } from '../engine/toon.js';
import { buildHouse } from '../areas/house.js';
import { Character } from '../objects/models.js';
import { buildBeth, buildSummer, buildJerry, buildLawnChair, buildSandwich } from '../objects/family.js';
import { shotOn } from './shots.js';
import text from '../data/dialogue/house.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const LIMITS = { x0: -5, x1: 5, z0: -3, z1: 2.5 };
const LEAN = 0.6, LOUNGE_Y = 0.3;             // Summer on the couch: how far she leans back, and how high she sits
const SEAT = { sit: -0.26, crushed: -0.56 }; // how far Jerry's body drops in the chair, and in what is left of it

// Turn an angle toward another the short way round
function turnTo(now, want, k) {
  const d = Math.atan2(Math.sin(want - now), Math.cos(want - now));
  return now + d * Math.min(1, k);
}

// Everything that happens in the Smith house: Beth and the sandwich, Summer and her phone, Jerry and his chair.
// api (from main.js): { camera, setState(name), startPlay(), toGarage() }
export function createHouse({ scene, morty, api }) {
  const house = buildHouse();
  house.group.visible = false;
  scene.add(house.group);
  const { spots } = house;

  // ---- The family ----
  const beth = new Character(buildBeth());
  beth.position.copy(spots.beth);
  beth.group.rotation.y = Math.PI; // at the counter, back to the room
  const summer = new Character(buildSummer());
  summer.position.copy(spots.summer);
  const jerry = new Character(buildJerry());
  jerry.position.copy(spots.jerry);
  const chair = buildLawnChair();
  chair.root.position.copy(spots.chair);
  const tiny = buildLawnChair(0.4, true);
  tiny.root.position.copy(spots.tinyChair);
  tiny.root.rotation.y = -0.3;
  const sandwich = buildSandwich();
  const flyPhone = box(0.11, 0.2, 0.025, glow(0x9fd8ff, 1.3), { line: 0.02 }); // the phone in the air when Summer throws it
  flyPhone.visible = false;
  house.group.add(beth.group, summer.group, jerry.group, chair.root, tiny.root, sandwich, flyPhone);

  // What the scenes are forcing right now, on top of the idle behavior in update()
  const stage = { bethLook: null, give: 0, jerryBusy: false, everyoneLook: null };
  let cooldown = 0;
  let jerryDown = false; // true once the chair has folded with him in it

  // Summer lies along the couch with her feet up
  function lounge() {
    summer.group.rotation.y = Math.PI / 2;
    summer.mesh.position.set(0, LOUNGE_Y, 0);
    summer.mesh.rotation.x = -LEAN; // leaning back on the armrest
    const { legs } = summer.parts;
    legs[0].rotation.x = -Math.PI / 2 + LEAN; legs[1].rotation.x = -Math.PI / 2 + LEAN + 0.14;
  }
  lounge();

  // Jerry, folded into what is left of his lawn chair
  function crushJerry() {
    jerryDown = true;
    jerry.position.copy(spots.chair);
    jerry.group.rotation.y = 0;
    jerry.mesh.position.y = SEAT.crushed;
    const { legs, arms, head } = jerry.parts;
    legs[0].rotation.set(-1.75, 0, -0.25); legs[1].rotation.set(-1.7, 0, 0.3);
    arms[0].rotation.set(-0.5, 0, -1.1); arms[1].rotation.set(-0.4, 0, 1.15);
    head.rotation.set(0.1, 0, 0);
    chair.root.scale.y = 0.42;
    chair.parts.back.rotation.x = -1.2;
  }

  // Put props where the story flags say they are (also right after a saved game loads)
  function refresh() {
    sandwich.visible = !flags.get('hasSandwich');
    sandwich.position.copy(spots.plate);
    sandwich.rotation.set(0, 0.4, 0);
    summer.parts.phone.visible = !flags.get('hasPhone');
    if (flags.get('jerrySat')) crushJerry();
  }

  function goal() {
    if (flags.get('bossBeaten')) return text.goals.done;
    return flags.get('askedToCheckGarage') ? text.goals.garage : text.goals.start;
  }

  // ---- Talking ----
  // Summer's close-up comes from the side Morty is not standing on, so his head never covers her
  let cold = false; // true during the cold open, when Morty is not in the room yet
  const summerShot = () => ({ pos: V(cold ? 5.3 : morty.position.x + (morty.position.x > 3.2 ? -2.8 : 2.8), 1.8, -0.7), look: V(2.4, 1.4, -4.55), fov: 30 });
  const jerryLook = () => (jerryDown ? 0.75 : 1.4);

  function talk(convo, at, lookY, { onDo, npcShot } = {}) {
    return converse(convo, {
      onLine(line) {
        rig.cut(line.speaker === 'Morty' ? shotOn(morty.position, at()) : npcShot ? npcShot() : shotOn(at(), morty.position, lookY()));
        rig.pushIn(0.1, 7);
      },
      onDo,
    });
  }

  // Side view of two people, so neither one stands in front of the other
  function twoShot(a, b) {
    const mid = a.clone().lerp(b, 0.5);
    const d = b.clone().sub(a).setY(0).normalize();
    const side = V(-d.z, 0, d.x);
    if (side.x + side.z < 0) side.negate(); // the side toward the open room
    const pos = mid.clone().addScaledVector(side, 5);
    pos.set(THREE.MathUtils.clamp(pos.x, -8.5, 8.5), 1.6, Math.max(pos.z, mid.z + 1.2)); // never behind the back wall
    return { pos, look: mid.setY(1.15), fov: 32 };
  }

  // A prop flies from one of the family to Morty in an arc, and he catches it
  async function toss(prop, from, caption, seconds = 0.7) {
    const to = morty.position.clone().setY(0.95);
    prop.visible = true;
    await tween(seconds, (t) => {
      prop.position.lerpVectors(from, to, t);
      prop.position.y += Math.sin(t * Math.PI) * 0.6;
      prop.rotation.x = t * Math.PI * 4;
    }, ease.linear);
    prop.visible = false;
    tween(0.3, (t) => { morty.squash = 1 - 0.18 * Math.sin(t * Math.PI); });
    audio.sfx('pickup.mp3');
    hud.caption(caption);
    await wait(1.3);
    hud.caption('');
  }

  // Beth hands over the sandwich
  async function giveSandwich() {
    rig.cut(twoShot(beth.position, morty.position));
    rig.pushIn(0.08, 4);
    // She picks it up off the plate first
    const hand = V(beth.position.x + Math.sin(beth.group.rotation.y) * 0.5, 1.2, beth.position.z + Math.cos(beth.group.rotation.y) * 0.5);
    const plate = sandwich.position.clone();
    await tween(0.35, (t) => { stage.give = t; sandwich.position.lerpVectors(plate, hand, t); });
    await wait(0.25);
    await toss(sandwich, hand, text.got.sandwich, 0.55);
    stage.give = 0;
  }

  // Summer throws her phone without looking
  async function givePhone() {
    rig.cut(twoShot(spots.summer, morty.position));
    const from = summer.parts.phone.getWorldPosition(new THREE.Vector3());
    summer.parts.phone.visible = false;
    await toss(flyPhone, from, text.got.phone, 0.6);
    hud.hint(text.hints.phone);
  }

  // Jerry demonstrates the chair. The chair has other plans.
  async function jerrySits() {
    stage.jerryBusy = true;
    const c = spots.chair;
    rig.cut({ pos: V(c.x + 1.4, 1.5, c.z + 6.2), look: V(c.x - 0.1, 0.8, c.z), fov: 30 });
    const from = jerry.position.clone(), front = V(c.x, 0, c.z + 0.12);
    // Morty steps to the side to watch, so he is never between the camera and the chair
    const mFrom = morty.position.clone(), mark = V(c.x - 2.1, 0, c.z + 0.5);
    let last = 0;
    await tween(0.7, (t) => {
      jerry.position.lerpVectors(from, front, t);
      jerry.animate((t - last) * 0.7, t < 0.95 ? 3 : 0, front.x - from.x, front.z - from.z);
      morty.position.lerpVectors(mFrom, mark, t);
      morty.animate((t - last) * 0.7, t < 0.95 ? 3 : 0, mark.x - mFrom.x, mark.z - mFrom.z);
      last = t;
    }, ease.linear);
    jerry.animate(0.016, 0);
    morty.faceToward(c);
    morty.animate(0.016, 0);
    await tween(0.25, (t) => { jerry.group.rotation.y = turnTo(jerry.group.rotation.y, 0, t); });
    // He sits down, pleased with himself
    const { legs, arms } = jerry.parts;
    await tween(0.4, (t) => {
      jerry.mesh.position.y = lerp(0, SEAT.sit, t);
      legs.forEach((l) => { l.rotation.x = -1.5 * t; });
      arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.16 + 0.2 * t); a.rotation.x = -0.55 * t; }); // hands on the armrests
    }, ease.out);
    rig.pushIn(0.12, 3);
    await wait(0.9);
    audio.sfx('blip.mp3'); rig.shake(0.12);   // creak
    chair.parts.back.rotation.x = -0.4;
    await wait(0.45);
    audio.sfx('blip.mp3'); rig.shake(0.18);   // creak
    chair.root.scale.y = 0.9;
    await wait(0.5);
    // The chair folds flat with him in it. The small chair does not spill a drop.
    await tween(0.16, (t) => {
      chair.root.scale.y = lerp(0.9, 0.42, t);
      chair.parts.back.rotation.x = lerp(-0.4, -1.2, t);
      jerry.mesh.position.y = lerp(SEAT.sit, SEAT.crushed, t);
    }, ease.in);
    crushJerry();
    audio.sfx('hit_enemy.mp3');
    rig.shake(0.7);
    tween(0.4, (t) => { jerry.squash = 1 - 0.25 * Math.sin(t * Math.PI); tiny.root.position.y = Math.sin(t * Math.PI) * 0.18; });
    await wait(1.0);
    stage.jerryBusy = false;
  }

  const onDo = (act) => (act.give === 'sandwich' ? giveSandwich() : act.give === 'phone' ? givePhone() : act.sit ? jerrySits() : null);

  // The garage door. Beth has to send Morty first.
  async function door() {
    if (flags.get('askedToCheckGarage')) { api.toGarage(); return true; }
    rig.cut(shotOn(morty.position, V(4, 0, 2)));
    for (const line of text.doorNotYet) await say(line);
    closeDialogue();
    return false;
  }

  const usable = [
    { label: 'Talk', at: () => beth.position, radius: 2.0, hintY: 2.15, run: () => talk(text.beth, () => beth.position, () => 1.5, { onDo }) },
    { label: 'Talk', at: () => spots.summer, radius: 2.2, hintY: 2.0, run: () => talk(text.summer, () => spots.summer, () => 1.45, { onDo, npcShot: summerShot }) },
    { label: 'Talk', at: () => jerry.position, radius: 2.0, hintY: 2.2, run: () => talk(text.jerry, () => jerry.position, jerryLook, { onDo }) },
    { label: 'Garage', at: () => spots.door, radius: 1.5, hintY: 1.7, run: door },
  ];

  async function use(thing) {
    api.setState('dialogue');
    hud.prompt('');
    hud.cinema(true);
    morty.faceToward(thing.at());
    morty.animate(0.016, 0);
    if (await thing.run() !== true) api.startPlay(); // true: the scene moved on by itself (through the door)
  }

  const tmp = new THREE.Vector3();
  return {
    world: house,
    goal,
    debug: { beth, summer, jerry, chair, stage },

    // Walk in. from: 'door' (back from the garage) or 'hall' (start of the episode)
    enter(from = 'door') {
      refresh();
      house.group.visible = true;
      morty.group.visible = true;
      if (from === 'door') { morty.position.set(8.5, 0, 0); morty.group.rotation.y = -Math.PI / 2; }
      else { morty.position.set(-1.5, 0, -2.7); morty.group.rotation.y = 0; }
      rig.setLimits(LIMITS);
      rig.follow(morty, true);
    },
    leave() { house.group.visible = false; },

    // Second half of the cold open: the family hears the garage explode, and nobody wants to deal with it
    async intro() {
      refresh();
      cold = true;
      house.group.visible = true;
      morty.group.visible = false;
      morty.position.copy(spots.hall);
      rig.cut({ pos: V(1.6, 2.2, 10.2), look: V(-0.6, 1.4, -3), fov: 44 }); // wide enough for Beth in the kitchen
      rig.move({ pos: V(3.4, 2.4, 10.6), look: V(-0.6, 1.4, -3), fov: 44 }, 7, ease.out);
      hud.caption(text.coldOpen.caption);
      await hud.fade(0, 0.8);
      await wait(1.5);
      hud.caption('');
      // Boom. Purple light under the garage door, and everybody looks at it.
      audio.sfx('hit_enemy.mp3');
      rig.shake(0.8);
      tween(1.4, (t) => { house.boom.intensity = 26 * (1 - t) * (1 - t); }, ease.linear);
      stage.everyoneLook = spots.door;
      [beth, jerry].forEach((p) => { p.squashT = 1; });
      await wait(1.2);
      stage.everyoneLook = null;
      const shots = {
        Jerry: () => ({ pos: V(-1.2, 1.65, 6.6), look: V(jerry.position.x, 1.45, jerry.position.z), fov: 30 }),
        Summer: summerShot,
        Beth: () => ({ pos: V(-4.4, 1.7, 0.2), look: V(beth.position.x, 1.5, beth.position.z), fov: 30 }),
      };
      for (const line of text.coldOpen.lines) {
        if (line.speaker === 'Beth') { stage.bethLook = V(-4.4, 0, 0.2); await wait(0.35); rig.shake(0.35); }
        rig.cut(shots[line.speaker]());
        rig.pushIn(0.1, 6);
        await say(line);
      }
      closeDialogue();
      cold = false;
      // Morty stumbles in from the hallway
      const from = spots.hall, stop = V(-1.5, 0, -2.7);
      rig.cut({ pos: V(1.6, 1.5, 2.6), look: V(-1.5, 1.0, -4), fov: 32 });
      rig.pushIn(0.08, 6);
      morty.group.visible = true;
      morty.group.rotation.y = 0;
      let last = 0;
      await tween(1.1, (t) => {
        morty.position.lerpVectors(from, stop, t);
        morty.animate((t - last) * 1.1, t < 0.97 ? 3 : 0, 0, 1);
        last = t;
      }, ease.linear);
      morty.animate(0.016, 0);
      for (const line of text.coldOpen.morty) await say(line);
      closeDialogue();
      stage.bethLook = null;
      rig.setLimits(LIMITS);
    },

    // Runs every frame while Morty is free to move in the house
    tick(dt) {
      cooldown -= dt;
      let best = null, bestD = Infinity;
      for (const u of usable) {
        const d = u.at().distanceTo(morty.position);
        if (d < u.radius && d < bestD) { best = u; bestD = d; }
      }
      if (!best) { hud.prompt(''); return; }
      tmp.copy(best.at()); tmp.y = best.hintY; tmp.project(api.camera);
      hud.prompt(best.label, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight);
      if (cooldown <= 0 && input.pressed('Space', 'Enter', 'KeyE')) use(best);
    },
    setCooldown(s) { cooldown = s; },

    // Runs every frame while the house is on screen, even in cutscenes
    update(dt, time) {
      if (!house.group.visible) return;
      house.update(time);
      const m = morty.position, seen = morty.group.visible;
      const k = dt * 7;

      // Beth makes sandwiches at the counter and turns around when Morty comes close
      beth.animate(dt, 0);
      const bLook = stage.everyoneLook ?? stage.bethLook ?? (seen && beth.position.distanceTo(m) < 3.2 ? m : null);
      beth.group.rotation.y = turnTo(beth.group.rotation.y, bLook ? Math.atan2(bLook.x - beth.position.x, bLook.z - beth.position.z) : Math.PI, k);
      const work = Math.max(0, -Math.cos(beth.group.rotation.y)); // 1 while she faces the counter
      beth.parts.arms[0].rotation.x = work * (-1.3 + Math.sin(time * 9) * 0.14);
      beth.parts.arms[1].rotation.x = Math.min(work * -1.3, stage.give * -1.25);
      beth.update();

      // Summer: eyes on her phone, thumb going. A glance at Morty when he is close.
      const hasPhone = summer.parts.phone.visible;
      const sLook = stage.everyoneLook ? -0.5 : seen && spots.summer.distanceTo(m) < 2.6 ? -0.95 : hasPhone ? 0 : -1.15;
      const head = summer.parts.head;
      head.rotation.y += (sLook - head.rotation.y) * Math.min(1, k);
      head.rotation.x = hasPhone && sLook === 0 ? -0.2 : 0.05;
      summer.parts.arms[0].rotation.x = hasPhone ? -1.75 + Math.sin(time * 13) * 0.025 : -0.35; // phone held up over her face
      summer.parts.arms[1].rotation.x = -0.3;
      summer.mesh.position.y = LOUNGE_Y + Math.sin(time * 1.8) * 0.006;
      summer.update();

      // Jerry practices his pitch on nobody, until he sits down
      if (jerryDown) {
        if (!stage.jerryBusy) jerry.parts.head.rotation.z = Math.sin(time * 1.3) * 0.06;
      } else if (!stage.jerryBusy) {
        jerry.animate(dt, 0);
        const jLook = stage.everyoneLook ?? (seen && jerry.position.distanceTo(m) < 3.2 ? m : null);
        jerry.group.rotation.y = turnTo(jerry.group.rotation.y, jLook ? Math.atan2(jLook.x - jerry.position.x, jLook.z - jerry.position.z) : 0.25, k);
        if (!jLook) jerry.parts.arms[1].rotation.x = -1.0 - Math.sin(time * 2.6) * 0.45; // waving at the pitch board
      }
      jerry.update();
    },
  };
}

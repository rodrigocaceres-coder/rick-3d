import * as THREE from 'three';
import { scene, camera, render } from './engine/core.js';
import rig from './engine/cameraRig.js';
import input from './engine/input.js';
import audio from './engine/audio.js';
import { updateTweens, tween, wait, ease, clock } from './engine/tween.js';
import hud from './ui/hud.js';
import { converse } from './ui/dialogue.js';
import flags from './systems/flags.js';
import { buildGarage } from './areas/garage.js';
import { Model, Character, buildRick, buildGun } from './objects/models.js';
import { Player } from './objects/player.js';
import { Portal } from './objects/portal.js';
import { coldOpen, afterColdOpen, garageArrival } from './scenes/coldOpen.js';
import { createHouse } from './scenes/houseScene.js';
import phone from './ui/phone.js';
import houseText from './data/dialogue/house.json';
import { createLab } from './scenes/labScene.js';
import { createBoss } from './scenes/bossScene.js';
import { shotOn } from './scenes/shots.js';
import dialogue from './data/dialogue/garage.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);
const GARAGE_LIMITS = { x0: -4, x1: 4, z0: -3, z1: 2.5 };

// ---- Garage world ----
const garage = buildGarage();
scene.add(garage.group);

const morty = new Player();
const rick = new Character(buildRick());
const gun = new Model(buildGun());
const portal = new Portal();                       // the one Morty opens and walks into
const introPortal = new Portal({ y: 3.0 });        // the one Rick falls out of, high in the air
portal.position.set(0.9, 0, -4.4);
const gunLight = new THREE.PointLight(0x5dff2e, 0, 6, 1.5);
gunLight.position.set(garage.spots.gun.x, 1.7, garage.spots.gun.z + 0.6);
scene.add(morty.group);
garage.group.add(rick.group, gun.group, portal.group, introPortal.group, gunLight);

// Floating Z's over sleeping Rick
const zzz = [0, 1, 2].map(() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '900 54px Trebuchet MS'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 9; g.strokeStyle = '#15101c'; g.strokeText('Z', 32, 34);
  g.fillStyle = '#f4efe2'; g.fillText('Z', 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  garage.group.add(s);
  return s;
});

// G is the shared game state that cutscenes read and change
const G = { scene: garage.group, garage, morty, rick, gun, portal, introPortal, gunLight, rickAsleep: false, rickAwake: false };
let state = 'boot';     // boot, cutscene, play, dialogue, battle, phone
let area = 'garage';    // house, garage or lab
let cooldown = 0;       // short pause after dialogue so the same key press does not start it again

// ---- Shrimp Rick's lab ----
const lab = createLab({
  scene, morty,
  api: { camera, state: () => state, setState(s) { state = s; }, startPlay, toBoss },
});

// ---- The Smith house: where the episode starts ----
const house = createHouse({
  scene, morty,
  api: { camera, setState(s) { state = s; }, startPlay, toGarage: houseToGarage },
});

// ---- Boss fight vs Shrimp Rick, staged in the garage ----
const boss = createBoss({ G, held: lab.held, api: { setState(s) { state = s; }, toGarage } });

// ---- Things Morty can use in the garage ----
const usable = [
  {
    label: 'Talk', at: () => garage.spots.rick, radius: 2.3, hintY: 1.7, when: () => true,
    async run() {
      const rickPos = garage.spots.rick;
      await converse(dialogue.rick, {
        onLine(line) {
          G.rickAwake = line.speaker === 'Rick'; // he lifts his head only for his own lines
          rig.cut(G.rickAwake ? shotOn(rickPos, morty.position, 0.9) : shotOn(morty.position, rickPos));
          rig.pushIn(0.1, 7);
        },
      });
      G.rickAwake = false;
    },
  },
  {
    label: 'Look', at: () => garage.spots.gun, radius: 1.9, hintY: 1.4, when: () => gun.group.visible,
    async run() {
      const spot = garage.spots.gun;
      const todo = await converse(dialogue.gun, {
        onLine() { rig.cut(shotOn(morty.position, spot)); rig.pushIn(0.1, 7); },
      });
      if (todo.some((d) => d.portal)) await firePortal();
    },
  },
  { label: 'House', at: () => garage.spots.door, radius: 1.5, hintY: 1.7, when: () => true, run: garageToHouse },
];

function garageGoal() {
  if (flags.get('bossBeaten')) return 'Episode over. Nobody touch the gun.';
  return flags.get('portalOpen') ? 'Step into the portal.' : flags.get('rickExplained') ? 'Check the humming portal gun.' : 'Find out what broke. Talk to Rick.';
}

// The gun fires its last charge on its own
async function firePortal() {
  const spot = garage.spots.gun;
  rig.cut({ pos: V(spot.x + 3.2, 0.7, spot.z + 3.4), look: V(2.2, 1.3, -4), fov: 36 });
  await tween(0.7, (t) => { gun.mesh.rotation.y = Math.sin(t * 60) * 0.4 * t; gunLight.intensity = 3 + t * 9; }, ease.in);
  gun.mesh.rotation.y = 0;
  hud.flash(0.9);
  rig.shake(0.7);
  gunLight.intensity = 0;
  await portal.open();
  await rig.move({ pos: V(0.9, 2.2, 5.2), look: V(0.9, 1.5, -4.4), fov: 34 }, 1.6);
  await wait(0.4);
}

// Morty grabs the gun and jumps into the portal: on to the lab
async function enterPortal() {
  state = 'cutscene';
  hud.cinema(true);
  hud.prompt('');
  const from = morty.position.clone(), to = portal.position.clone();
  rig.move({ pos: V(to.x + 2.5, 1.4, to.z + 5.5), look: V(to.x, 1.4, to.z), fov: 30 }, 0.9);
  audio.sfx('portal.mp3');
  gun.group.visible = false; // he takes it with him
  await tween(0.7, (t) => {
    morty.position.lerpVectors(from, to, t);
    morty.squash = 1 + t * 0.5;
    morty.mesh.position.y = t * 0.6;
    morty.mesh.rotation.z = t * 5;
    morty.scale = 1 - t * 0.85;
  }, ease.in);
  hud.flash(1, 0.5);
  await hud.fade(1, 0.5);
  portal.close(0.1);
  await toLab(0);
}

// ---- The door between the house and the garage ----
async function garageToHouse() {
  state = 'cutscene';
  audio.sfx('door.mp3');
  await hud.fade(1, 0.35);
  garage.group.visible = false;
  area = 'house';
  resetMortyPose();
  house.enter('door');
  startPlay();
  await hud.fade(0, 0.35);
  return true; // tells use() that this scene already handed control back
}

async function houseToGarage() {
  state = 'cutscene';
  audio.sfx('door.mp3');
  await hud.fade(1, 0.35);
  house.leave();
  area = 'garage';
  garage.group.visible = true;
  resetMortyPose();
  rig.setLimits(GARAGE_LIMITS);
  if (!flags.get('sawGarage')) {
    // First time in: Morty finds Rick and the gun
    flags.set('sawGarage');
    await garageArrival(G, dialogue.arrival);
    startPlay();
    return;
  }
  morty.position.set(-7.4, 0, 0);
  morty.group.rotation.y = Math.PI / 2;
  rig.follow(morty, true);
  startPlay();
  await hud.fade(0, 0.35);
}

// Q: Summer's phone, the quest log
function togglePhone() {
  if (state === 'phone') { phone.close(); cooldown = 0.2; state = 'play'; return; }
  if (state !== 'play') return;
  if (!flags.get('hasPhone')) { hud.toast(houseText.hints.noPhone); return; }
  hud.prompt('');
  phone.open();
  state = 'phone';
}

function resetMortyPose() {
  Object.assign(morty, { scale: 1, squash: 1, vx: 0, vz: 0 });
  morty.mesh.rotation.z = 0; morty.mesh.position.y = 0;
}

async function toLab(room) {
  resetMortyPose();
  garage.group.visible = false;
  area = 'lab';
  await lab.enter(room);
}

// Out of the lab with all three parts: the boss fight starts in the garage
function toBoss(opts) {
  resetMortyPose();
  area = 'garage';
  garage.group.visible = true;
  gun.group.visible = false; // Morty is holding it
  return boss.start(opts);
}

// Back to walking around the garage (after the boss fight)
async function toGarage() {
  resetMortyPose();
  area = 'garage';
  garage.group.visible = true;
  rig.setLimits(GARAGE_LIMITS);
  morty.position.set(0.9, 0, -1.6);
  morty.group.rotation.y = 0;
  audio.music('smith_house.m4a');
  startPlay();
  await hud.fade(0, 0.6);
}

function startPlay() {
  hud.cinema(false);
  rig.follow(morty);
  hud.goal(area === 'garage' ? garageGoal() : area === 'house' ? house.goal() : lab.goal());
  if (area !== 'lab') hud.hint(flags.get('hasPhone') ? houseText.hints.phone : '');
  cooldown = 0.3;
  lab.setCooldown(0.3);
  house.setCooldown(0.3);
  state = 'play';
}

async function use(thing) {
  state = 'dialogue';
  hud.prompt('');
  hud.cinema(true);
  morty.faceToward(thing.at());
  morty.animate(0.016, 0);
  if (await thing.run() !== true) startPlay();
}

function garageTick() {
  // Nearest usable thing in reach gets the key hint
  let best = null, bestD = Infinity;
  for (const u of usable) {
    const d = u.at().distanceTo(morty.position);
    if (u.when() && d < u.radius && d < bestD) { best = u; bestD = d; }
  }
  if (best) {
    tmp.copy(best.at()); tmp.y = best.hintY; tmp.project(camera);
    hud.prompt(best.label, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight);
    if (cooldown <= 0 && input.pressed('Space', 'Enter', 'KeyE')) use(best);
  } else hud.prompt('');

  if (portal.isOpen && state === 'play' && Math.hypot(morty.position.x - portal.position.x, morty.position.z - portal.position.z) < 0.85) enterPortal();
}

// ---- Main loop ----
const tmp = new THREE.Vector3();
const worlds = { garage, house: house.world, lab: lab.world };
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  tick(dt);
}

function tick(dt) {
  updateTweens(dt);
  const time = clock.time;

  if (state === 'play') {
    morty.move(dt, worlds[area], true);
    cooldown -= dt;
    if (area === 'garage') garageTick(); else if (area === 'house') house.tick(dt); else lab.tick(dt);
  } else if (state === 'phone') {
    morty.move(dt, worlds[area], false); // he slows to a stop while he reads
    if (input.pressed('Escape')) togglePhone();
  }
  if (input.pressed('KeyQ')) togglePhone();

  if (input.pressed('KeyM')) hud.toast(audio.toggleMute() ? 'Sound off' : 'Sound on');

  if (area === 'garage') {
    // Idle life: the gun hums, Rick snores
    if (state !== 'boot' && gunLight.intensity > 0 && gunLight.intensity < 4.5) {
      gunLight.intensity = 3 + Math.sin(time * 11) * 1;
      gun.mesh.position.y = Math.abs(Math.sin(time * 23)) * 0.025;
    }
    zzz.forEach((s, i) => {
      const t = (time * 0.45 + i / 3) % 1;
      s.visible = G.rickAsleep && !G.rickAwake;
      s.position.set(rick.position.x - 0.1 + t * 0.5 + Math.sin(t * 7) * 0.08, 1.45 + t * 1.5, rick.position.z + 0.2);
      s.scale.setScalar(0.22 + t * 0.3);
      s.material.opacity = Math.sin(t * Math.PI);
    });
    // Rick's head hangs and bobs while he snores, and lifts when he talks
    if (G.rickAsleep) {
      const want = G.rickAwake ? -0.05 : 0.5 + Math.sin(time * 1.6) * 0.07;
      rick.parts.head.rotation.x += (want - rick.parts.head.rotation.x) * Math.min(1, dt * 10);
    }
    rick.update(); gun.update();
    garage.update(time);
    portal.update(time);
    introPortal.update(time);
  }
  boss.update(dt, time);
  house.update(dt, time);
  morty.update();
  lab.update(dt, time);
  rig.update(dt, time);
  render();
  input.endFrame();
}
requestAnimationFrame(frame);

// Dev builds only: lets a test script run the game forward by hand, for example __game.step(120) = 2 seconds
if (import.meta.env.DEV) window.__game = { G, flags, lab, boss, house, state: () => state, area: () => area, step(frames = 60) { for (let i = 0; i < frames; i++) tick(1 / 60); } };

// ---- Boot: start card, cold open (garage, then the house), then play in the house. ?skip jumps past the cold open,
// ?garage starts in the garage with Beth's errand done, ?lab=1, 2 or 3 starts in that lab room,
// ?boss starts at the boss fight (?boss=2 at the tank phase, ?boss=fight skips the fight's opening scene, &nosandwich
// plays it without Beth's sandwich). ----
async function boot() {
  rig.cut({ pos: V(-7.2, 1.5, 5.6), look: V(1.5, 1.7, -3), fov: 38 });
  if (params.has('lab')) {
    afterColdOpen(G);
    gun.group.visible = false;
    return toLab(Math.max(0, Math.min(2, Number(params.get('lab') || 1) - 1)));
  }
  if (params.has('boss')) {
    afterColdOpen(G);
    flags.setMany({ hasCrystal: true, hasCanister: true, hasChip: true, helpedResistance: !params.has('norebels'), hasSandwich: !params.has('nosandwich'), askedToCheckGarage: true, sawGarage: true });
    const v = params.get('boss');
    return toBoss({ phase: v === '2' ? 2 : 1, skipIntro: v === '2' || v === 'fight' });
  }
  if (params.has('garage')) {
    afterColdOpen(G);
    flags.setMany({ askedToCheckGarage: true, sawGarage: true });
    audio.music('smith_house.m4a');
    startPlay();
    return hud.fade(0, 0.5);
  }
  const toHouse = () => { garage.group.visible = false; area = 'house'; };
  if (params.has('skip')) {
    afterColdOpen(G);
    toHouse();
    house.enter('hall');
  } else {
    hud.card({ small: 'A playable episode', big: 'TOTAL RICKALL<br>OF PARTS', hint: 'Press SPACE to start', solid: true });
    await input.nextPress('Space', 'Enter');
    hud.hideCard();
    await wait(0.6);
    state = 'cutscene';
    await coldOpen(G, () => { toHouse(); return house.intro(); });
  }
  audio.music('smith_house.m4a');
  startPlay();
  await hud.fade(0, 0.5);
}
boot();

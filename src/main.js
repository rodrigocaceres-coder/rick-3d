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
import { Cutout } from './objects/cutout.js';
import { Player } from './objects/player.js';
import { Portal } from './objects/portal.js';
import { coldOpen, afterColdOpen } from './scenes/coldOpen.js';
import { shotOn } from './scenes/shots.js';
import dialogue from './data/dialogue/garage.json';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const params = new URLSearchParams(location.search);

// ---- World ----
const garage = buildGarage();
scene.add(garage.group);

const morty = new Player();
const rick = new Cutout('sprites/rick.png', 1.95);
const gun = new Cutout('sprites/item_gun.png', 0.6, { tint: 0xffffff });
const portal = new Portal();                       // the one Morty opens and walks into
const introPortal = new Portal({ y: 3.0 });        // the one Rick falls out of, high in the air
portal.position.set(0.9, 0, -4.4);
const gunLight = new THREE.PointLight(0x5dff2e, 0, 6, 1.5);
gunLight.position.set(garage.spots.gun.x, 0.8, garage.spots.gun.z + 0.3);
scene.add(morty.group, rick.group, gun.group, portal.group, introPortal.group, gunLight);
const cutouts = [morty, rick, gun];

// Floating Z's over sleeping Rick
const zzz = [0, 1, 2].map(() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.font = '900 54px Trebuchet MS'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 9; g.strokeStyle = '#15101c'; g.strokeText('Z', 32, 34);
  g.fillStyle = '#f4efe2'; g.fillText('Z', 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  scene.add(s);
  return s;
});

// G is the shared game state that cutscenes read and change
const G = { scene, garage, morty, rick, gun, portal, introPortal, gunLight, rickAsleep: false };
let state = 'boot';   // boot, cutscene, play, dialogue
let cooldown = 0;     // short pause after dialogue so the same key press does not start it again

// ---- Things Morty can use ----
const usable = [
  {
    label: 'Talk', at: () => garage.spots.rick, radius: 2.3, hintY: 1.5,
    async run() {
      const rickPos = garage.spots.rick;
      await converse(dialogue.rick, {
        onLine(line) {
          rig.cut(line.speaker === 'Rick' ? shotOn(rickPos, morty.position, 0.5) : shotOn(morty.position, rickPos));
          rig.pushIn(0.1, 7);
        },
      });
      setGoal();
    },
  },
  {
    label: 'Look', at: () => garage.spots.gun, radius: 1.9, hintY: 1.2,
    async run() {
      const spot = garage.spots.gun;
      const todo = await converse(dialogue.gun, {
        onLine() { rig.cut(shotOn(morty.position, spot)); rig.pushIn(0.1, 7); },
      });
      if (todo.some((d) => d.portal)) await firePortal();
      setGoal();
    },
  },
];

function setGoal() {
  hud.goal(flags.get('portalOpen') ? 'Step into the portal.' : flags.get('rickExplained') ? 'Check the humming portal gun.' : 'Find out what broke. Talk to Rick.');
}

// The gun fires its last charge on its own
async function firePortal() {
  const spot = garage.spots.gun;
  rig.cut({ pos: V(spot.x + 3.2, 0.7, spot.z + 3.4), look: V(2.2, 1.3, -4), fov: 36 });
  await tween(0.7, (t) => { gun.mesh.rotation.z = Math.sin(t * 60) * 0.25 * t; gunLight.intensity = 3 + t * 9; }, ease.in);
  gun.mesh.rotation.z = 0;
  hud.flash(0.9);
  rig.shake(0.7);
  gunLight.intensity = 0;
  await portal.open();
  await rig.move({ pos: V(0.9, 2.2, 5.2), look: V(0.9, 1.5, -4.4), fov: 34 }, 1.6);
  await wait(0.4);
}

// Morty walks into the portal. This is where Session 2 (Shrimp Rick's lab) will start.
async function enterPortal() {
  state = 'cutscene';
  hud.cinema(true);
  hud.prompt('');
  const from = morty.position.clone(), to = portal.position.clone();
  rig.move({ pos: V(to.x + 2.5, 1.4, to.z + 5.5), look: V(to.x, 1.4, to.z), fov: 30 }, 0.9);
  audio.sfx('portal.mp3');
  await tween(0.7, (t) => {
    morty.position.lerpVectors(from, to, t);
    morty.squash = 1 + t * 0.5;
    morty.mesh.position.y = t * 0.6;
    morty.mesh.rotation.z = t * 5;
    morty.height = 1.55 * (1 - t * 0.85);
  }, ease.in);
  morty.group.visible = false;
  hud.flash(1, 0.5);
  await hud.fade(1, 0.5);
  hud.card({ small: 'To be continued', big: "NEXT:<br>SHRIMP RICK'S LAB", hint: 'Press SPACE to go back to the garage', solid: true });
  await input.nextPress('Space', 'Enter');
  hud.hideCard();
  Object.assign(morty, { height: 1.55, squash: 1 });
  morty.mesh.rotation.z = 0; morty.mesh.position.y = 0;
  morty.position.set(0.9, 0, -1.6);
  morty.group.visible = true;
  startPlay();
  await hud.fade(0, 0.6);
}

function startPlay() {
  hud.cinema(false);
  rig.follow(morty);
  setGoal();
  cooldown = 0.3;
  state = 'play';
}

async function use(thing) {
  state = 'dialogue';
  hud.prompt('');
  hud.cinema(true);
  morty.animate(0.016, 0);
  await thing.run();
  startPlay();
}

// ---- Main loop ----
const tmp = new THREE.Vector3();
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
    morty.move(dt, garage, true);
    cooldown -= dt;

    // Nearest usable thing in reach gets the key hint
    let best = null, bestD = Infinity;
    for (const u of usable) {
      const d = u.at().distanceTo(morty.position);
      if (d < u.radius && d < bestD) { best = u; bestD = d; }
    }
    if (best) {
      tmp.copy(best.at()); tmp.y = best.hintY; tmp.project(camera);
      hud.prompt(best.label, (tmp.x * 0.5 + 0.5) * innerWidth, (-tmp.y * 0.5 + 0.5) * innerHeight);
      if (cooldown <= 0 && input.pressed('Space', 'Enter', 'KeyE')) use(best);
    } else hud.prompt('');

    if (portal.isOpen && state === 'play' && Math.hypot(morty.position.x - portal.position.x, morty.position.z - portal.position.z) < 0.85) enterPortal();
  }

  if (input.pressed('KeyM')) hud.toast(audio.toggleMute() ? 'Sound off' : 'Sound on');

  // Idle life: the gun hums, Rick snores
  if (state !== 'boot' && gunLight.intensity > 0 && gunLight.intensity < 4.5) {
    gunLight.intensity = 3 + Math.sin(time * 11) * 1;
    gun.mesh.position.y = 0.05 + Math.abs(Math.sin(time * 23)) * 0.02;
  }
  zzz.forEach((s, i) => {
    const t = (time * 0.45 + i / 3) % 1;
    s.visible = G.rickAsleep;
    s.position.set(rick.position.x + rick.height / 2 + 0.15 + t * 0.5 + Math.sin(t * 7) * 0.08, 0.7 + t * 1.5, rick.position.z);
    s.scale.setScalar(0.22 + t * 0.3);
    s.material.opacity = Math.sin(t * Math.PI);
  });

  cutouts.forEach((c) => c.update(camera));
  garage.update(time);
  portal.update(time);
  introPortal.update(time);
  rig.update(dt, time);
  render();
  input.endFrame();
}
requestAnimationFrame(frame);

// Dev builds only: lets a test script run the game forward by hand, for example __game.step(120) = 2 seconds
if (import.meta.env.DEV) window.__game = { G, flags, state: () => state, step(frames = 60) { for (let i = 0; i < frames; i++) tick(1 / 60); } };

// ---- Boot: start card, cold open, then play ----
async function boot() {
  rig.cut({ pos: V(-7.2, 1.5, 5.6), look: V(1.5, 1.7, -3), fov: 38 });
  if (params.has('skip')) {
    afterColdOpen(G);
  } else {
    hud.card({ small: 'A playable episode', big: 'TOTAL RICKALL<br>OF PARTS', hint: 'Press SPACE to start', solid: true });
    await input.nextPress('Space', 'Enter');
    hud.hideCard();
    await wait(0.6);
    state = 'cutscene';
    await coldOpen(G);
  }
  audio.music('smith_house.m4a');
  startPlay();
  await hud.fade(0, 0.5);
}
boot();

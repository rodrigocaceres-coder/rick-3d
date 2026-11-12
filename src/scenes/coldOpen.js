import * as THREE from 'three';
import rig from '../engine/cameraRig.js';
import hud from '../ui/hud.js';
import input from '../engine/input.js';
import audio from '../engine/audio.js';
import { tween, wait, ease, clock, lerp } from '../engine/tween.js';
import { say, closeDialogue } from '../ui/dialogue.js';
import { ball, box, cyl, glow } from '../engine/toon.js';
import { shotOn, slump } from './shots.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The cold open, like the first minute of an episode: a portal rips open, Rick falls out, the gun cracks,
// three parts fly back into the portal, Morty walks in, title card. Escape fast-forwards it.
export async function coldOpen(G) {
  const { morty, rick, gun, garage, introPortal, scene } = G;
  let done = false;
  input.nextPress('Escape').then(() => { if (!done) clock.timeScale = 40; });

  hud.cinema(true);
  morty.group.visible = rick.group.visible = gun.group.visible = false;
  G.gunLight.intensity = 0;
  introPortal.position.set(2.4, 0, -2.6);
  const mouth = introPortal.centerPoint();

  // 1. Quiet garage, slow dolly
  rig.cut({ pos: V(-7.2, 1.5, 5.6), look: V(1.5, 1.7, -3), fov: 38 });
  rig.move({ pos: V(-4.6, 1.9, 6.6), look: V(2, 1.7, -3), fov: 38 }, 9, ease.out);
  hud.caption('INT. SMITH GARAGE. NIGHT.');
  await hud.fade(0, 1.6);
  await wait(1.6);
  hud.caption('');

  // 2. Portal rips open
  hud.flash(0.8);
  rig.shake(0.5);
  await introPortal.open();
  await wait(0.6);

  // 3. Rick falls out, spinning, and lands next to the workbench
  rig.cut({ pos: V(-1.5, 0.8, 4.6), look: V(3.6, 1.5, -1), fov: 36 });
  rick.group.visible = true;
  const land = garage.spots.rick;
  rick.group.rotation.y = -1.05;
  await tween(0.85, (t) => {
    rick.position.set(lerp(mouth.x, land.x, t), 0, lerp(mouth.z, land.z, t));
    rick.mesh.position.y = lerp(mouth.y - 0.9, -0.56, t * t) + Math.sin(t * Math.PI) * 0.8;
    rick.mesh.rotation.x = lerp(0, -Math.PI * 4, t); // two backflips, lands sitting
  }, ease.linear);
  slump(rick);
  rig.shake(0.9);
  audio.sfx('hit_enemy.mp3');
  tween(0.35, (t) => { rick.squash = 1 - 0.3 * Math.sin(t * Math.PI); });

  // 4. The gun follows, bounces, and cracks
  gun.group.visible = true;
  const spot = garage.spots.gun;
  await tween(0.9, (t) => {
    gun.position.set(lerp(mouth.x, spot.x, t), 0, lerp(mouth.z, spot.z, t));
    gun.mesh.position.y = (mouth.y - 0.3) * (1 - ease.outBounce(t));
    gun.mesh.rotation.x = (1 - t) * 9;
  }, ease.linear);
  audio.sfx('hit_morty.mp3');
  hud.flash(0.5, 0.25);
  rig.shake(0.4);
  G.gunLight.intensity = 3;
  await wait(0.5);

  // 5. Three glowing parts pop out and get sucked back through the portal
  rig.cut({ pos: V(spot.x - 3.4, 0.7, spot.z + 3.6), look: V(spot.x + 0.2, 1.3, spot.z), fov: 34 });
  rig.pushIn(0.1, 4);
  const parts = [
    ball(0.16, glow(0x4affe0, 1.8), { line: 0.03 }),            // Focus Crystal
    cyl(0.11, 0.34, glow(0xc45aff, 1.8), { line: 0.03 }),       // Fluid Canister
    box(0.26, 0.06, 0.2, glow(0xffb03a, 1.8), { line: 0.03 }),  // Coordinate Chip
  ];
  await Promise.all(parts.map(async (p, i) => {
    scene.add(p);
    const from = V(spot.x, 0.3, spot.z);
    const hover = V(spot.x - 0.9 + i * 0.9, 1.5 + (i % 2) * 0.5, spot.z + 0.2);
    await wait(i * 0.18);
    audio.sfx('pickup.mp3', 0.7);
    await tween(0.45, (t) => { p.position.lerpVectors(from, hover, t); p.rotation.z = t * 6; }, ease.outBack);
    await tween(0.9 - i * 0.18, (t) => { p.position.y = hover.y + Math.sin(t * 9) * 0.06; p.rotation.y = t * 5; }, ease.linear);
  }));
  rig.cut({ pos: V(7.4, 1.2, 3.8), look: V(mouth.x, mouth.y - 0.4, mouth.z), fov: 36 });
  await Promise.all(parts.map(async (p, i) => {
    const from = p.position.clone();
    await wait(i * 0.14);
    await tween(0.4, (t) => { p.position.lerpVectors(from, mouth, t); p.scale.setScalar(1 - t * 0.8); }, ease.in);
    audio.sfx('blip.mp3');
    scene.remove(p);
  }));
  await introPortal.close();
  rig.shake(0.25);
  await wait(0.6);

  // 6. Rick, face down
  G.rickAsleep = true;
  rig.cut(shotOn(land, V(land.x - 3, 0, land.z + 1), 0.8));
  rig.pushIn(0.1, 6);
  await say({ speaker: 'Rick', mood: 'happy', text: 'Nailed it. Zzzz.' });
  closeDialogue();

  // 7. Morty comes in from the house
  const door = garage.spots.door, stop = V(-5.4, 0, 0.7);
  rig.cut({ pos: V(-0.8, 1.7, 6.2), look: V(-6.6, 1.0, 0.2), fov: 32 });
  rig.pushIn(0.08, 6);
  audio.sfx('door.mp3');
  morty.position.copy(door);
  morty.group.rotation.y = Math.PI / 2;
  morty.group.visible = true;
  let last = 0;
  await tween(1.5, (t) => {
    morty.position.lerpVectors(door, stop, t);
    morty.animate((t - last) * 1.5, t < 0.97 ? 3 : 0, stop.x - door.x, stop.z - door.z);
    last = t;
  }, ease.linear);
  morty.animate(0.016, 0);
  await say({ speaker: 'Morty', mood: 'neutral', text: 'Rick? What was that noise?' });
  await say({ speaker: 'Morty', mood: 'angry', text: "Rick, if you're faking being asleep, I swear..." });
  closeDialogue();

  // 8. Title card
  rig.cut({ pos: V(0, 6.5, 13.5), look: V(0, 1.2, -1.5), fov: 38 });
  rig.pushIn(0.06, 4);
  audio.sfx('menu_select.mp3');
  rig.shake(0.3);
  hud.card({ small: 'Rick and Morty 3D', big: 'TOTAL RICKALL<br>OF PARTS' });
  await wait(2.8);
  hud.hideCard();

  done = true;
  clock.timeScale = 1;
}

// Where everything ends up after the cold open. Used when the cold open is skipped with ?skip.
export function afterColdOpen(G) {
  const { morty, rick, gun, garage } = G;
  rick.position.copy(garage.spots.rick);
  slump(rick);
  gun.position.copy(garage.spots.gun);
  morty.position.set(-5.4, 0, 0.7);
  morty.group.rotation.y = Math.PI / 2;
  G.gunLight.intensity = 3;
  G.rickAsleep = true;
}

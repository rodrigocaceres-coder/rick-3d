import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Renderer, scene, camera and the glow (bloom) effect.
// Add ?low to the address to turn the glow off on a slow laptop.
export const LOW = new URLSearchParams(location.search).has('low');

const canvas = document.getElementById('game');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW ? 1 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07060d);

export const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.1, 200);

let composer = null;
export let bloom = null;
if (!LOW) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Only colors brighter than white glow, so the portal and the lab tubes glow and nothing else does
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.6, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  if (composer) composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// Demo-day safety net: if the game runs under ~25 frames a second for two seconds with the glow on,
// turn the glow off by itself (the same as ?low). A 30 Hz projector (33 ms a frame) does not set it off.
// Off in dev builds, where the preview pane throttles frames on purpose; ?speedtest turns it on there.
const watchOn = !import.meta.env.DEV || new URLSearchParams(location.search).has('speedtest');
const recent = [];
let watched = 0;
export function watchSpeed(ms) {
  if (!watchOn || !composer || ms > 250) return false; // over 250 ms: a hidden tab or a hitch, not slowness
  if (++watched < 180) return false;                    // skip the loading hitches of the first few seconds
  recent.push(ms);
  if (recent.length > 120) recent.shift();
  if (recent.length < 120) return false;
  const median = [...recent].sort((x, y) => x - y)[60];
  if (median < 40) return false;
  composer = null; bloom = null;
  renderer.setPixelRatio(1);
  resize();
  return true;
}

export function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

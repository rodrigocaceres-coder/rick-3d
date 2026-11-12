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

export function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

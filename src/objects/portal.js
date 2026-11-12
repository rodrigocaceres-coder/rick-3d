import * as THREE from 'three';
import { tween, ease } from '../engine/tween.js';
import audio from '../engine/audio.js';

// The green portal: a swirling disc drawn by a small shader, a wobbly rim, orbiting sparks and a green light.
const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p), a = atan(p.y, p.x);
    float edge = 0.88 + 0.06 * sin(a * 5.0 + uTime * 2.5) + 0.03 * sin(a * 11.0 - uTime * 4.0);
    if (r > edge) discard;
    float spiral = sin(a * 3.0 - log(r + 0.05) * 6.0 - uTime * 3.5) * 0.5 + 0.5;
    float n = noise(vec2(cos(a), sin(a)) * 2.5 * r + uTime * 0.6);
    float v = spiral * 0.7 + n * 0.5 + smoothstep(0.35, 0.0, r) * 0.6;
    // Three flat color bands, like the cartoon
    vec3 col = v < 0.45 ? vec3(0.04, 0.32, 0.03) : (v < 0.9 ? vec3(0.3, 0.95, 0.1) : vec3(0.85, 1.0, 0.5));
    col = mix(col, vec3(0.55, 1.0, 0.2), smoothstep(edge - 0.1, edge, r));
    gl_FragColor = vec4(col * 1.2, 1.0);
  }
`;

const SPARKS = 36;

export class Portal {
  constructor({ radius = 1.25, y = 1.5 } = {}) {
    this.group = new THREE.Group();
    this.center = new THREE.Group();
    this.center.position.y = y;
    this.group.add(this.center);
    this.isOpen = false;

    this.material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { uTime: { value: 0 } }, side: THREE.DoubleSide });
    this.material.toneMapped = false;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), this.material);
    disc.scale.set(0.82, 1.12, 1);
    const rim = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.97, 48), new THREE.MeshBasicMaterial({ color: 0x082b06, side: THREE.DoubleSide }));
    rim.scale.set(0.82, 1.12, 1);
    rim.position.z = -0.02;
    this.center.add(rim, disc);

    // Sparks that orbit the rim
    this.seeds = Array.from({ length: SPARKS }, () => ({ a: Math.random() * 6.28, r: radius * (0.85 + Math.random() * 0.5), s: 0.6 + Math.random() * 1.6, z: Math.random() * 0.5 }));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    const mat = new THREE.PointsMaterial({ color: 0x9dff5a, size: 0.09 });
    mat.color.multiplyScalar(1.5);
    this.sparks = new THREE.Points(geo, mat);
    this.center.add(this.sparks);

    this.light = new THREE.PointLight(0x5dff2e, 0, 14, 1.4);
    this.light.position.z = 0.8;
    this.center.add(this.light);

    this.center.scale.setScalar(0.0001);
    this.group.visible = false;
  }

  get position() { return this.group.position; }

  // World position of the middle of the disc
  centerPoint(out = new THREE.Vector3()) { return this.center.getWorldPosition(out); }

  open(seconds = 0.45) {
    this.group.visible = true;
    this.isOpen = true;
    audio.sfx('portal.mp3');
    return tween(seconds, (t) => { this.center.scale.setScalar(Math.max(t, 0.0001)); this.light.intensity = 5 * t; }, ease.outBack);
  }

  async close(seconds = 0.3) {
    this.isOpen = false;
    await tween(seconds, (t) => { this.center.scale.setScalar(Math.max(1 - t, 0.0001)); this.light.intensity = 5 * (1 - t); }, ease.in);
    this.group.visible = false;
  }

  update(time) {
    if (!this.group.visible) return;
    this.material.uniforms.uTime.value = time;
    const pos = this.sparks.geometry.attributes.position;
    this.seeds.forEach((s, i) => {
      const a = s.a + time * s.s;
      const pulse = 1 + 0.08 * Math.sin(time * 3 + i);
      pos.setXYZ(i, Math.cos(a) * s.r * 0.82 * pulse, Math.sin(a) * s.r * 1.12 * pulse, s.z);
    });
    pos.needsUpdate = true;
    if (this.isOpen) this.light.intensity = 4.5 + Math.sin(time * 9) * 1;
  }
}

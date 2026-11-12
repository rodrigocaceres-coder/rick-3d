import * as THREE from 'three';

// A character or item drawn as a flat paper cutout that always turns to face the camera.
// The art is the Gemini art from the 2D game. Animation is done in code: bob, lean, flip, squash.
const loader = new THREE.TextureLoader();
const base = `${import.meta.env.BASE_URL}assets/`;
const planeGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0); // origin at the feet
const blobGeo = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);

export class Cutout {
  constructor(file, height, { tint = 0xd6d0e4, shadow = true } = {}) {
    this.height = height;
    this.aspect = 0.5;
    this.flip = 1;      // 1 or -1: mirror the art when walking left
    this.squash = 1;    // 1 = normal, below 1 = squashed flat, above 1 = stretched tall
    this.group = new THREE.Group();   // moves around the world
    this.pivot = new THREE.Group();   // turns to face the camera
    this.group.add(this.pivot);

    const map = loader.load(base + file, (t) => { this.aspect = t.image.width / t.image.height; });
    map.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.MeshBasicMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, color: tint });
    this.mesh = new THREE.Mesh(planeGeo, this.material);
    this.pivot.add(this.mesh);

    if (shadow) {
      this.blob = new THREE.Mesh(blobGeo, new THREE.MeshBasicMaterial({ color: 0x05020a, transparent: true, opacity: 0.38, depthWrite: false }));
      this.blob.position.y = 0.025;
      this.pivot.add(this.blob);
    }
  }

  get position() { return this.group.position; }
  get width() { return this.height * this.aspect; }

  update(camera) {
    const p = this.group.position;
    this.pivot.rotation.y = Math.atan2(camera.position.x - p.x, camera.position.z - p.z);
    const w = this.width;
    this.mesh.scale.set(w * this.flip * (2 - this.squash), this.height * this.squash, 1);
    if (this.blob) {
      const lift = Math.max(0, 1 - this.mesh.position.y * 0.35); // shadow shrinks when the cutout is in the air
      if (this.lying) this.blob.scale.set(this.height, 1, w * 0.8); // long shadow for a cutout lying down
      else this.blob.scale.set(w * 0.95 * lift, 1, w * 0.5 * lift);
    }
  }
}

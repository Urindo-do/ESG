import * as THREE from 'three';
import { group, sphere, box, mesh, colors as C } from '../world/materials.js';

export class Danbi {
  constructor(scene) {
    this.root = group(scene, [0, 0.54, 0.3]);
    this.body = group(this.root);
    sphere(this.body, [0.31, 0.41, 0.25], [0, 0.55, 0], C.cream);
    sphere(this.body, [0.325, 0.29, 0.26], [0, 0.58, 0], C.blue);
    // Cream inset and crossed collar make the vest read as everyday hanbok.
    sphere(this.body, [0.19, 0.23, 0.03], [0, 0.62, 0.248], '#edf0dd');
    const collar = box(this.body, [0.07, 0.30, 0.03], [-0.055, 0.68, 0.283], '#d7e5df'); collar.rotation.z = 0.43;
    box(this.body, [0.14, 0.035, 0.04], [0.12, 0.59, 0.275], '#729fae');
    this.head = group(this.body, [0, 1.13, 0.035]);
    sphere(this.head, [0.48, 0.44, 0.385], [0, 0, 0], C.cream);
    for (const side of [-1, 1]) {
      sphere(this.head, [0.17, 0.18, 0.25], [side * 0.34, -0.13, 0.08], C.cream);
      for (let i = 0; i < 3; i++) sphere(this.head, [0.075, 0.09, 0.09], [side * (0.4 + i * 0.014), -0.04 - i * 0.08, 0.04], C.cream);
    }
    this.ears = [-1, 1].map(side => {
      const ear = group(this.head, [side * 0.30, 0.30, 0]);
      const shape = new THREE.Shape(); shape.moveTo(-0.17, 0); shape.quadraticCurveTo(-0.15, 0.18, -0.035, 0.39); shape.quadraticCurveTo(0.01, 0.45, 0.06, 0.36); shape.lineTo(0.18, 0.02); shape.closePath();
      mesh(ear, new THREE.ExtrudeGeometry(shape, { depth: 0.10, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.045, bevelThickness: 0.04 }), C.cream, [0, 0, -0.06]);
      const inner = mesh(ear, new THREE.ShapeGeometry(shape), '#dcb6a2', [0, 0.055, 0.09]); inner.scale.set(0.57, 0.65, 1);
      ear.rotation.z = -side * 0.13;
      return ear;
    });
    sphere(this.head, [0.27, 0.17, 0.16], [0, -0.16, 0.33], C.muzzle);
    sphere(this.head, [0.10, 0.069, 0.064], [0, -0.095, 0.481], '#302d29');
    sphere(this.head, [0.025, 0.013, 0.012], [-0.024, -0.07, 0.539], '#79736a');
    this.eyes = [-1, 1].map(side => {
      const eye = group(this.head, [side * 0.19, 0.038, 0.344]);
      sphere(eye, [0.052, 0.068, 0.027], [0, 0, 0], '#332b25');
      sphere(eye, [0.015, 0.019, 0.009], [-0.014, 0.023, 0.024], '#fffaf1');
      sphere(this.head, [0.075, 0.033, 0.01], [side * 0.29, -0.08, 0.343], '#e9c1ad');
      return eye;
    });
    this.mouth = sphere(this.head, [0.035, 0.024, 0.013], [0, -0.225, 0.477], '#66503d');
    const scarf = mesh(this.body, new THREE.TorusGeometry(0.205, 0.055, 10, 28), C.yellow, [0, 0.85, 0.02]); scarf.rotation.x = Math.PI / 2;
    const triangle = new THREE.Shape(); triangle.moveTo(-0.15, 0); triangle.lineTo(0.15, 0); triangle.lineTo(0.035, -0.22); triangle.closePath();
    mesh(this.body, new THREE.ExtrudeGeometry(triangle, { depth: 0.025, bevelEnabled: false }), C.yellow, [0, 0.86, 0.26]);
    sphere(this.body, [0.067, 0.065, 0.055], [0.20, 0.86, 0.12], '#e5bd62');
    this.arms = [-1, 1].map(side => {
      const arm = group(this.body, [side * 0.30, 0.68, 0]);
      sphere(arm, [0.105, 0.21, 0.11], [side * 0.038, -0.12, 0.025], C.cream);
      return arm;
    });
    this.legs = [-1, 1].map(side => {
      const leg = group(this.body, [side * 0.15, 0.23, 0]);
      sphere(leg, [0.12, 0.19, 0.14], [0, -0.08, 0.055], C.cream);
      sphere(leg, [0.13, 0.085, 0.17], [0, -0.16, 0.11], C.muzzle);
      return leg;
    });
    this.tail = group(this.body, [0, 0.47, -0.23]);
    const points = Array.from({ length: 20 }, (_, i) => {
      const a = i / 19 * Math.PI * 1.65;
      return new THREE.Vector3(Math.sin(a) * 0.18, 0.04 + (1 - Math.cos(a)) * 0.19, -0.13 - i / 19 * 0.06);
    });
    mesh(this.tail, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, 0.087, 10, false), C.cream);
  }

  animate(time, mode = 'idle', walking = false) {
    const t = time, sleeping = mode === 'sleep' && !walking;
    const eating = ['eat', 'drink', 'sniff'].includes(mode) && !walking;
    const shaking = mode === 'shake' && !walking;
    this.body.position.y = sleeping ? -0.26 : walking ? Math.abs(Math.sin(t * 9)) * 0.055 : Math.sin(t * 2.7) * 0.012;
    this.body.rotation.set(sleeping ? -0.12 : 0, shaking ? Math.sin(t * 36) * 0.20 : 0, sleeping ? 0.12 : 0);
    this.head.rotation.set(eating ? 0.55 + Math.sin(t * 8) * 0.09 : sleeping ? 0.14 : Math.sin(t * 1.8) * 0.035, shaking ? Math.sin(t * 36 - 0.5) * 0.14 : 0, mode === 'read' || mode === 'look' ? Math.sin(t * 1.3) * 0.15 : sleeping ? 0.1 : Math.sin(t * 0.7) * 0.035);
    const blink = Math.pow(Math.max(0, Math.sin(t * 1.13)), 48);
    for (const eye of this.eyes) eye.scale.y = sleeping ? 0.09 : 1 - blink * 0.94;
    this.ears.forEach((ear, i) => {
      ear.rotation.z = (i ? -0.13 : 0.13) + Math.sin(t * 2.2 + i * 2) * (sleeping ? 0.025 : 0.07) + (shaking ? Math.sin(t * 36) * 0.17 : 0);
      ear.rotation.x = Math.pow(Math.max(0, Math.sin(t * 1.4 + i)), 12) * -0.19;
    });
    this.tail.rotation.z = Math.sin(t * (mode === 'play' ? 13 : 6)) * (sleeping ? 0.07 : 0.42);
    this.arms.forEach((arm, i) => {
      arm.rotation.x = walking ? Math.sin(t * 9 + i * Math.PI) * 0.5 : !sleeping && ['play', 'tidy'].includes(mode) ? -0.8 + Math.sin(t * 5 + i) * 0.4 : sleeping ? -0.45 : 0;
      arm.rotation.z = sleeping ? (i ? -0.35 : 0.35) : 0;
    });
    this.legs.forEach((leg, i) => { leg.rotation.x = walking ? Math.sin(t * 9 + i * Math.PI + Math.PI) * 0.55 : sleeping ? -1.0 : 0; });
    // A small yawn as Danbi settles down; otherwise the mouth gently bobs while eating.
    this.mouth.scale.y = sleeping && t % 9 < 1.7 ? 1 + Math.sin((t % 9) / 1.7 * Math.PI) * 4 : eating ? 1 + Math.abs(Math.sin(t * 8)) : 1;
  }
}

import * as THREE from 'three';
import { box, cylinder, sphere, group, label, colors as C } from './materials.js';

export const FLOOR = 0.54;
export const YARD = 0.12;

function paperPanel(parent, x, y, z, w, h, materials) {
  box(parent, [w, h, 0.055], [x, y, z], materials.paper);
  for (let i = 0; i <= 4; i++) box(parent, [0.035, h, 0.065], [x - w / 2 + i * w / 4, y, z + 0.04], C.darkWood, 0.006);
  for (let i = 0; i <= 5; i++) box(parent, [w, 0.03, 0.07], [x, y - h / 2 + i * h / 5, z + 0.04], C.darkWood, 0.006);
}

export function createHanok(scene, materials) {
  const root = group(scene);
  box(root, [10.3, 0.45, 8.2], [0, -0.16, 0.2], '#b9af8d', 0.2);
  box(root, [10.15, 0.15, 8.05], [0, 0.03, 0.2], '#d9cdab', 0.13);
  box(root, [7.35, 0.38, 4.5], [0, 0.30, -1.15], '#b8b5a5', 0.07);
  box(root, [7.15, 0.13, 4.35], [0, 0.48, -1.15], materials.wood);
  // Warm ondol room and individually separated porch planks.
  box(root, [6.75, 0.04, 2.95], [0, 0.565, -1.65], '#e5ce9d');
  for (let x = -3.4; x < 3.5; x += 0.34) box(root, [0.325, 0.08, 1.15], [x, 0.55, 0.47], materials.wood, 0.012);
  box(root, [2.5, 0.21, 0.45], [0, 0.22, 1.24], '#bcb6a0');
  box(root, [2.8, 0.12, 0.4], [0, 0.12, 1.55], '#c7c0aa');
  // A deliberate cutaway: back wall and short side returns leave the room visible.
  box(root, [7.05, 2.15, 0.16], [0, 1.65, -3.18], C.plaster);
  for (const x of [-3.45, -1.16, 1.16, 3.45]) {
    box(root, [0.18, 2.8, 0.18], [x, 1.91, -3.10], materials.wood);
    box(root, [0.19, 2.8, 0.19], [x, 1.91, 0.95], materials.wood);
  }
  for (const z of [-3.1, 0.95]) {
    box(root, [7.45, 0.2, 0.23], [0, 3.20, z], C.darkWood);
    box(root, [7.55, 0.13, 0.25], [0, 3.40, z], materials.wood);
  }
  for (const x of [-3.45, 3.45]) box(root, [0.18, 0.2, 4.35], [x, 3.20, -1.05], C.darkWood);
  for (const x of [-2.32, 0, 2.32]) paperPanel(root, x, 1.91, -3.06, 2.03, 1.5, materials);
  box(root, [7.03, 0.13, 0.2], [0, 1.04, -3.02], C.darkWood);
  // Half-roof at the rear gives readable Korean eaves without hiding the character.
  for (let x = -3.8; x <= 3.8; x += 0.22) {
    const rafter = cylinder(root, 0.065, 0.065, 1.6, [x, 3.47, -2.80], materials.wood, 12);
    rafter.rotation.x = Math.PI / 2 - 0.26;
    for (let j = 0; j < 5; j++) {
      const tile = box(root, [0.235, 0.09, 0.32], [x, 3.45 + j * 0.095 + Math.pow(Math.abs(x) / 3.8, 6) * 0.1, -3.49 + j * 0.30], C.roof, 0.044);
      tile.rotation.x = -0.30;
    }
  }
  for (let x = -3.5; x <= 3.5; x += 0.44) {
    const shortRafter = cylinder(root, 0.065, 0.065, 0.55, [x, 3.37, 1.01], materials.wood, 12);
    shortRafter.rotation.x = Math.PI / 2;
  }
  label(root, '단비네', [0, 3.15, 1.085], 0.84);
  // Low stone boundary, with uneven courses and darker capstones.
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 12; i++) box(root, [0.64, 0.18, 0.32], [-4.73, 0.23 + layer * 0.18, -3.3 + i * 0.62], i % 2 ? '#a7a89a' : '#b3b2a2', 0.06).rotation.y = Math.PI / 2;
    for (let i = 0; i < 7; i++) box(root, [0.65, 0.18, 0.32], [0.65 + i * 0.65, 0.23 + layer * 0.18, 3.89], i % 2 ? '#abae9f' : '#b8b5a6', 0.06);
  }
  box(root, [0.45, 0.12, 7.7], [-4.73, 0.81, 0.17], '#858e83');
  box(root, [4.75, 0.12, 0.43], [2.50, 0.81, 3.89], '#858e83');
  for (let i = 0; i < 5; i++) {
    const stone = cylinder(root, 0.36, 0.38, 0.085, [Math.sin(i * 0.7) * 0.17, 0.15, 1.8 + i * 0.41], '#b6b8a6', 7);
    stone.scale.x = 1.5; stone.rotation.y = i;
  }
  // Grass tufts around the edges keep the main paths clear.
  for (let i = 0; i < 32; i++) {
    const x = i < 16 ? -4.20 + (i % 3) * 0.18 : 4.1 + (i % 3) * 0.19;
    const z = -3 + (i % 16) * 0.44;
    for (let j = 0; j < 3; j++) {
      const blade = sphere(root, [0.035, 0.13 + j * 0.025, 0.026], [x + j * 0.045, 0.18, z], j % 2 ? '#82905b' : '#a3ad70');
      blade.rotation.z = (j - 1) * 0.35;
    }
  }
  const lamp = group(root, [2.35, 2.57, -2.65]);
  cylinder(lamp, 0.19, 0.21, 0.34, [0, 0, 0], materials.paper);
  cylinder(lamp, 0.21, 0.21, 0.045, [0, 0.18, 0], C.darkWood);
  cylinder(lamp, 0.21, 0.21, 0.045, [0, -0.18, 0], C.darkWood);
  const light = new THREE.PointLight('#ffcb7c', 4, 5, 2); light.position.copy(lamp.position); root.add(light);
  return root;
}

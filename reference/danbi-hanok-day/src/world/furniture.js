import * as THREE from 'three';
import { box, sphere, cylinder, mesh, group, material, colors as C } from './materials.js';
import { FLOOR, YARD } from './hanok.js';

export function createFurniture(scene, materials) {
  const root = group(scene), interactables = [], obstacles = [];
  const register = (object, action, name) => { object.userData = { action, name }; interactables.push(object); return object; };
  const obstacle = (x, z, w, d) => obstacles.push({ x, z, w, d });
  function cushion(x, z, w, d, color) {
    const g = group(root, [x, FLOOR, z]);
    box(g, [w, 0.16, d], [0, 0.09, 0], color, 0.12);
    box(g, [w * 0.84, 0.025, d * 0.84], [0, 0.18, 0], color, 0.07);
    return g;
  }
  register(cushion(-2.3, 0.33, 1.35, 0.94, '#a8bdac'), 'sleep', '단비의 낮잠 방석');
  register(cushion(-2.3, -2.35, 1.2, 0.78, '#d6b79a'), 'sleep', '포근한 보료');
  cylinder(root, 0.18, 0.18, 0.72, [-2.3, 0.85, -2.65], '#e6ceb0').rotation.z = Math.PI / 2;
  cushion(-3.0, -1.3, 0.48, 0.5, '#d9aa97');
  const table = group(root, [-0.25, FLOOR, -1.7]);
  box(table, [1.45, 0.13, 0.82], [0, 0.48, 0], materials.wood, 0.08);
  for (const x of [-0.55, 0.55]) for (const z of [-0.25, 0.25]) box(table, [0.10, 0.44, 0.10], [x, 0.22, z], C.darkWood);
  cylinder(table, 0.16, 0.13, 0.18, [0.3, 0.64, 0], '#e6e1cb');
  cylinder(table, 0.12, 0.12, 0.008, [0.3, 0.738, 0], '#879677');
  box(table, [0.40, 0.045, 0.30], [-0.3, 0.58, 0], '#9db5b4');
  register(table, 'read', '낮은 밥상 위 그림책'); obstacle(-0.25, -1.7, 1.5, 0.85);

  function bowl(x, action, color) {
    const g = group(root, [x, FLOOR, -0.63]);
    const points = [[0.14, 0], [0.25, 0.04], [0.31, 0.21], [0.27, 0.24], [0.23, 0.09], [0, 0.09]].map(([r, y]) => new THREE.Vector2(r, y));
    mesh(g, new THREE.LatheGeometry(points, 32), material(color, 0.3));
    if (action === 'drink') {
      cylinder(g, 0.24, 0.24, 0.01, [0, 0.16, 0], '#9ecad4');
    } else {
      for (let i = 0; i < 16; i++) sphere(g, [0.045, 0.025, 0.04], [Math.sin(i * 2.4) * (0.06 + i * 0.009), 0.14, Math.cos(i * 2.4) * (0.06 + i * 0.009)], '#916544');
    }
    return register(g, action, action === 'eat' ? '도자기 밥그릇' : '시원한 물그릇');
  }
  bowl(1.75, 'eat', '#e5bca5'); bowl(2.63, 'drink', '#accbd0');
  const shelf = group(root, [2.48, FLOOR, -2.66]);
  for (const x of [-0.63, 0.63]) box(shelf, [0.1, 1.16, 0.48], [x, 0.58, 0], materials.wood);
  for (const y of [0.08, 0.6, 1.15]) box(shelf, [1.35, 0.09, 0.5], [0, y, 0], materials.wood);
  const bookColors = ['#88aaa8', '#d7af75', '#c78d7a', '#b7c79d', '#dbcb9b'];
  for (let i = 0; i < 9; i++) {
    const b = box(shelf, [0.10, 0.31 + (i % 3) * 0.035, 0.29], [-0.49 + i * 0.12, 0.81, 0.02], bookColors[i % 5]);
    b.rotation.z = i === 8 ? -0.15 : 0;
    box(shelf, [0.078, 0.018, 0.01], [-0.49 + i * 0.12, 0.78, 0.17], '#efe6cc');
  }
  register(shelf, 'read', '작은 책장'); obstacle(2.48, -2.66, 1.45, 0.55);
  const toybox = group(root, [3.02, FLOOR, -1.55]);
  box(toybox, [0.68, 0.09, 0.59], [0, 0.04, 0], materials.wood);
  for (const z of [-0.26, 0.26]) box(toybox, [0.68, 0.36, 0.065], [0, 0.19, z], materials.wood);
  for (const x of [-0.31, 0.31]) box(toybox, [0.065, 0.36, 0.59], [x, 0.19, 0], materials.wood);
  const toy = box(toybox, [0.20, 0.20, 0.20], [0, 0.38, 0], '#b6c8a0'); toy.rotation.y = 0.4;
  sphere(toybox, [0.13, 0.13, 0.13], [-0.17, 0.23, 0.1], '#e5b18c');
  register(toybox, 'tidy', '나무 장난감 상자'); obstacle(3.02, -1.55, 0.8, 0.7);
  const broom = group(root, [-3.18, FLOOR, -2.35]);
  cylinder(broom, 0.025, 0.025, 0.88, [0, 0.64, 0], C.darkWood, 10);
  for (let i = 0; i < 9; i++) cylinder(broom, 0.018, 0.031, 0.3, [(i - 4) * 0.032, 0.15, 0], '#d6b36c', 7);
  broom.rotation.z = -0.18; register(broom, 'tidy', '작은 빗자루');
  box(broom, [0.28, 0.04, 0.28], [0.34, 0.025, 0.1], '#7799a0');
  box(broom, [0.03, 0.38, 0.03], [0.34, 0.19, -0.035], C.darkWood);
  const radio = group(root, [-1.36, FLOOR, -2.71]);
  box(radio, [0.56, 0.36, 0.24], [0, 0.20, 0], '#bc8660');
  for (let i = 0; i < 6; i++) box(radio, [0.025, 0.2, 0.015], [-0.20 + i * 0.036, 0.20, 0.13], '#6e5141');
  sphere(radio, [0.05, 0.05, 0.025], [0.18, 0.2, 0.14], '#ead8aa');
  const antenna = cylinder(radio, 0.008, 0.008, 0.4, [0.15, 0.55, 0], '#a0a79f', 8); antenna.rotation.z = -0.35;
  register(radio, 'look', '라디오 곁 창가');

  function plant(x, z, y, flowers = false) {
    const g = group(root, [x, y, z]);
    cylinder(g, 0.19, 0.13, 0.28, [0, 0.14, 0], '#c28b6a');
    cylinder(g, 0.18, 0.18, 0.018, [0, 0.28, 0], '#77624a');
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5;
      const leaf = sphere(g, [0.09, 0.21, 0.06], [Math.sin(a) * 0.12, 0.45, Math.cos(a) * 0.12], i % 2 ? '#7f9d66' : '#9db477');
      leaf.rotation.z = Math.sin(a) * 0.65;
      if (flowers) for (let j = 0; j < 5; j++) sphere(g, [0.05, 0.025, 0.05], [Math.sin(a) * 0.13 + Math.sin(j * 1.256) * 0.065, 0.63, Math.cos(a) * 0.13 + Math.cos(j * 1.256) * 0.065], '#ead59b');
    }
    register(g, 'look', '햇살 받는 화분');
  }
  plant(0.9, -2.81, FLOOR); plant(-3.95, 1.8, YARD, true); plant(3.95, 2.5, YARD, true); plant(-3.9, 2.8, YARD);
  const window = group(root, [0.85, 1.9, -3.01]);
  box(window, [1.0, 1.15, 0.035], [0, 0, 0], new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  register(window, 'look', '한지 창문');
  const basket = group(root, [3.1, FLOOR, 0.5]);
  cylinder(basket, 0.27, 0.21, 0.25, [0, 0.14, 0], '#b99562');
  for (let i = 0; i < 4; i++) {
    const chew = cylinder(basket, 0.035, 0.035, 0.24, [(i - 1.5) * 0.095, 0.29, 0], '#e8d2a9', 10); chew.rotation.x = 0.5;
  }
  register(basket, 'eat', '개껌 바구니');
  const ball = group(root, [-1.65, YARD + 0.22, 2.42]);
  sphere(ball, [0.22, 0.22, 0.22], [0, 0, 0], '#cf927c');
  const stripe = mesh(ball, new THREE.TorusGeometry(0.218, 0.014, 8, 32), '#f4deac'); stripe.rotation.x = 0.65;
  register(ball, 'play', '통통 공 장난감');
  const jars = group(root, [-3.50, YARD, 0.40]);
  box(jars, [1.15, 0.13, 1.06], [0, 0.08, 0], '#ada891');
  for (let i = 0; i < 3; i++) {
    const x = i === 0 ? -0.26 : 0.25, z = i === 2 ? 0.30 : -0.25, size = i === 0 ? 0.30 : 0.23;
    sphere(jars, [size, size * 1.2, size], [x, 0.16 + size, z], material('#74523e', 0.32));
    cylinder(jars, size * 0.79, size * 0.9, 0.07, [x, 0.18 + size * 2, z], '#5c4437');
  }
  register(jars, 'sniff', '옹기종기 장독대'); obstacle(-3.50, 0.4, 1.2, 1.1);
  const bench = group(root, [2.6, YARD, 2.5]);
  for (let i = 0; i < 6; i++) box(bench, [0.24, 0.09, 1.08], [-0.65 + i * 0.26, 0.41, 0], materials.wood);
  for (const x of [-0.58, 0.58]) for (const z of [-0.4, 0.4]) box(bench, [0.12, 0.4, 0.12], [x, 0.20, z], C.darkWood);
  register(bench, 'run', '마당의 작은 평상'); obstacle(2.6, 2.5, 1.65, 1.18);
  return { root, interactables, obstacles, ball, toy, ballHome: ball.position.clone() };
}

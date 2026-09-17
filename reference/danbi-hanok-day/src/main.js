import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeMaterials, mesh } from './world/materials.js';
import { createHanok } from './world/hanok.js';
import { createFurniture } from './world/furniture.js';
import { batchStatic } from './world/batchStatic.js';
import { Danbi } from './character/Danbi.js';
import { BehaviorController } from './behaviors/BehaviorController.js';
import { createUI } from './ui/UI.js';
import './styles.css';

const container = document.querySelector('#scene');
const loading = document.querySelector('#loading');

function start() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3edde');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', '단비의 한옥. 드래그로 회전하고 두 손가락으로 확대하거나 축소하세요. 행동은 아래 버튼으로도 선택할 수 있습니다.');
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 7; controls.maxDistance = 27;
  controls.minPolarAngle = 0.32; controls.maxPolarAngle = Math.PI / 2.1;
  controls.enablePan = false;
  let width, height;
  const resetCamera = () => {
    controls.target.set(0, 0.55, 0.15);
    const mobile = width < 650;
    camera.position.set(mobile ? 11.8 : 10.4, mobile ? 11.8 : 10.5, mobile ? 16.8 : 14.8);
    controls.update();
  };
  const resize = () => {
    width = container.clientWidth; height = container.clientHeight;
    renderer.setSize(width, height); camera.aspect = width / height;
    // Move the projected scene above the action panel without distorting orbit controls.
    camera.setViewOffset(width, height, 0, height * 0.09, width, height);
    camera.fov = width < 650 ? 49 : 36;
    camera.updateProjectionMatrix();
  };
  resize(); resetCamera();
  const observer = new ResizeObserver(resize); observer.observe(container);
  scene.add(new THREE.HemisphereLight('#fff4d8', '#9ea687', 2.7));
  const sun = new THREE.DirectionalLight('#ffe3b2', 3.4);
  sun.position.set(-5, 11, 7); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 28 });
  sun.shadow.normalBias = 0.035; sun.shadow.bias = -0.0002; sun.shadow.radius = 4;
  scene.add(sun);
  const ground = mesh(scene, new THREE.PlaneGeometry(200, 200), '#f3edde', [0, -0.40, 0]);
  ground.rotation.x = -Math.PI / 2; ground.castShadow = false;
  const materials = makeMaterials();
  batchStatic(createHanok(scene, materials));
  const furniture = createFurniture(scene, materials);
  const danbi = new Danbi(scene);
  let behavior;
  const ui = createUI(document.querySelector('#ui'), {
    onAction: id => behavior.select(id), onAuto: value => behavior.setAutomatic(value),
    onPause: () => behavior.togglePause(), onReset: resetCamera,
    onZoom: factor => {
      const offset = camera.position.clone().sub(controls.target);
      offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
      camera.position.copy(controls.target).add(offset); controls.update();
    },
  });
  behavior = new BehaviorController(danbi, furniture, state => ui.update(state));
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) behavior.togglePause();
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  function pick(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(furniture.interactables, true)[0];
    let object = hit?.object;
    while (object && !object.userData.action) object = object.parent;
    return object;
  }
  let pressed = null, activePointers = new Set(), gesture = false;
  const down = event => { activePointers.add(event.pointerId); if (activePointers.size > 1) gesture = true; pressed = { x: event.clientX, y: event.clientY }; };
  const up = event => {
    activePointers.delete(event.pointerId);
    if (!gesture && pressed && Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < 7) {
      const object = pick(event); if (object) behavior.select(object.userData.action);
    }
    pressed = null; if (!activePointers.size) gesture = false;
  };
  const cancel = event => { activePointers.delete(event.pointerId); pressed = null; if (!activePointers.size) gesture = false; };
  const move = event => {
    if (event.pointerType === 'touch' || activePointers.size) return;
    const object = pick(event);
    renderer.domElement.style.cursor = object ? 'pointer' : 'grab';
    ui.tooltip(object?.userData.name, event.clientX, event.clientY);
  };
  const leave = () => ui.tooltip(null, 0, 0);
  renderer.domElement.addEventListener('pointerdown', down);
  renderer.domElement.addEventListener('pointerup', up);
  renderer.domElement.addEventListener('pointercancel', cancel);
  renderer.domElement.addEventListener('pointermove', move);
  renderer.domElement.addEventListener('pointerleave', leave);
  const clock = new THREE.Clock(); const bubblePosition = new THREE.Vector3();
  let disposed = false;
  function frame() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!document.hidden) {
      behavior.update(dt); controls.update();
      bubblePosition.copy(danbi.root.position).add(new THREE.Vector3(0, 2.05, 0)).project(camera);
      ui.positionBubble((bubblePosition.x * 0.5 + 0.5) * width, (-bubblePosition.y * 0.5 + 0.5) * height, bubblePosition.z > -1 && bubblePosition.z < 1);
      renderer.render(scene, camera);
    }
  }
  renderer.setAnimationLoop(frame);
  loading.classList.add('hidden');
  const contextLost = event => {
    event.preventDefault(); renderer.setAnimationLoop(null);
    loading.classList.remove('hidden');
    loading.innerHTML = '<strong>화면이 잠시 쉬고 있어요</strong><span>다시 불러오면 단비를 만날 수 있어요.</span><button class="error-button" onclick="location.reload()">다시 불러오기</button>';
  };
  renderer.domElement.addEventListener('webglcontextlost', contextLost);
  return () => {
    disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); controls.dispose();
    const geometries = new Set(), materialsSet = new Set(), textures = new Set();
    scene.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      for (const mat of object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []) {
        materialsSet.add(mat); if (mat.map) textures.add(mat.map);
      }
    });
    geometries.forEach(g => g.dispose()); materialsSet.forEach(m => m.dispose()); textures.forEach(t => t.dispose());
    sun.shadow.dispose(); renderer.dispose(); renderer.domElement.remove();
  };
}

try {
  const dispose = start();
  if (import.meta.hot) import.meta.hot.dispose(dispose);
} catch (error) {
  console.error('단비의 하루 초기화 실패:', error);
  loading.classList.remove('hidden');
  loading.innerHTML = '<strong>3D 공간을 열지 못했어요</strong><span>브라우저의 하드웨어 가속을 켜고 최신 Chrome 또는 Edge에서 다시 열어 주세요.</span><button class="error-button" onclick="location.reload()">다시 시도</button>';
}

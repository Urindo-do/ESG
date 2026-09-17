import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSET_URLS, RENDER, MISSIONS } from './config.js';
import { MoodState, clampScore } from './states/mood.js';
import { createSky, mixColor, mixNumber } from './scene/Sky.js';
import { createGround, createWater, createPuddles } from './scene/Ground.js';
import { createEffects } from './scene/Effects.js';
import { World } from './world/World.js';
import { Hwangyeongi } from './character/Hwangyeongi.js';
import { BehaviorController } from './behaviors/BehaviorController.js';
import { CLICK_ACTIONS, actionById } from './behaviors/actions.js';
import { createUI } from './ui/UI.js';

const MISSION_IDS = new Set(MISSIONS.map(m => m.id));
const CHARACTER_REACTION = { default: 'wave', happy: 'jump', sad: 'shake' };

/**
 * 환경이 마을 3D 홈 화면을 만든다.
 * 로그인·카메라·AI·저장은 바깥에서 처리하고, 아래 함수와 이벤트로만 주고받는다.
 *
 * @param {HTMLElement} container
 * @param {{initialScore?: number, remaining?: {meal:number, product:number, phrase:number}, dev?: boolean,
 *          onDevScore?: (score:number)=>void, baseUrl?: string}} options
 */
export function createVillage(container, options = {}) {
  const base = options.baseUrl ?? import.meta.env?.BASE_URL ?? '/';
  const url = p => `${base.replace(/\/$/, '')}/${p}`;
  const listeners = new Set();
  const mood = new MoodState(options.initialScore ?? 60);
  let remaining = { meal: 0, product: 0, phrase: 0, ...(options.remaining || {}) };
  let disposed = false;
  let pendingCelebrations = [];

  // ── DOM ──────────────────────────────────────────────────
  const rootEl = document.createElement('div');
  rootEl.className = 'hv-root';
  const canvasHost = document.createElement('div');
  canvasHost.className = 'hv-canvas';
  const uiHost = document.createElement('div');
  rootEl.append(canvasHost, uiHost);
  container.append(rootEl);

  let behavior = null;
  let character = null;
  const ui = createUI(uiHost, {
    onMission: id => listeners.forEach(fn => fn(id)),
    onAuto: v => behavior?.setAutomatic(v),
    onPause: () => { if (behavior && !behavior.paused) behavior.togglePause(); },
    onResume: () => behavior?.resume(),
    onReset: () => resetCamera(),
    onZoom: f => zoom(f),
    onDevScore: s => { api.setCleanliness(s); options.onDevScore?.(clampScore(s)); },
    onDevDecay: () => { const s = clampScore(mood.score - 10); api.setCleanliness(s); options.onDevScore?.(s); },
    onDevGain: () => { const s = clampScore(mood.score + 10); api.setCleanliness(s); api.celebrate(10); options.onDevScore?.(s); },
    onDevAction: id => behavior?.select(id, { manual: true }),
  }, { dev: !!options.dev });
  ui.setScore(mood.score, mood.mood);
  ui.setRemaining(remaining);

  // ── 렌더러·장면 ──────────────────────────────────────────
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (err) {
    ui.error('브라우저에서 3D(WebGL)를 쓸 수 없어요. 하드웨어 가속을 켜고 최신 Chrome·Safari에서 열어 주세요.');
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  canvasHost.append(renderer.domElement);
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '환경이 마을 3D 화면. 드래그로 돌려 보고, 두 손가락이나 휠로 확대·축소할 수 있어요.');

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#dcefe9', 26, 70);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 30;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.36;
  controls.target.set(0, 0.8, 1);

  const hemi = new THREE.HemisphereLight('#fff6e0', '#8fae76', 2.1);
  const sun = new THREE.DirectionalLight('#fff1d6', 3.1);
  sun.position.set(-7, 13, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(RENDER.shadowMapSize * (window.innerWidth > 900 ? 2 : 1), RENDER.shadowMapSize * (window.innerWidth > 900 ? 2 : 1));
  Object.assign(sun.shadow.camera, { left: -10.5, right: 10.5, top: 10.5, bottom: -10.5, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight('#dfefff', 0.6);
  rim.position.set(6, 5, -8);
  scene.add(hemi, sun, sun.target, rim);

  const sky = createSky();
  scene.add(sky.mesh);
  const ground = createGround();
  scene.add(ground.group);
  const water = createWater();
  scene.add(water.mesh);
  const puddles = createPuddles();
  scene.add(puddles.group);
  const effects = createEffects();
  scene.add(effects.group);

  let width = 1;
  let height = 1;
  let mobile = false;
  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    mobile = width < 700;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.fov = width / height < 0.8 ? 50 : 40;
    // 하단 버튼 영역만큼 장면을 위로 올린다
    camera.setViewOffset(width, height, 0, height * 0.06, width, height);
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const CAMERA_OFFSET_DESKTOP = new THREE.Vector3(0, 3.0, 7.3);
  const CAMERA_OFFSET_MOBILE = new THREE.Vector3(0, 4.4, 10.4);
  function resetCamera() {
    const focus = character ? character.root.position : new THREE.Vector3(0, 0, 1);
    controls.target.set(focus.x * 0.7, 0.8, focus.z * 0.7 + 0.4);
    camera.position.copy(controls.target).add(mobile ? CAMERA_OFFSET_MOBILE : CAMERA_OFFSET_DESKTOP);
    controls.update();
  }
  resetCamera();

  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset);
    controls.update();
  }

  // ── 불러오기 ─────────────────────────────────────────────
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_, loaded, total) => ui.progress(loaded / total);
  const gltfLoader = new GLTFLoader(manager);
  gltfLoader.setMeshoptDecoder(MeshoptDecoder); // 압축된 GLB(meshopt) 해제
  const texLoader = new THREE.TextureLoader(manager);
  let world = null;

  const loadTexture = path => new Promise((resolve, reject) => {
    texLoader.load(url(path), tex => {
      tex.flipY = false; // glTF UV 규칙
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      resolve(tex);
    }, undefined, reject);
  });

  const ready = Promise.all([
    gltfLoader.loadAsync(url(ASSET_URLS.character)),
    gltfLoader.loadAsync(url(ASSET_URLS.village)),
    Promise.all(Object.entries(ASSET_URLS.faces).map(async ([k, p]) => [k, await loadTexture(p)])),
  ]).then(([charGltf, villageGltf, faceList]) => {
    if (disposed) return;
    world = new World(villageGltf);
    scene.add(world.group);

    character = new Hwangyeongi(charGltf, Object.fromEntries(faceList));
    character.attachTools(world.handTools);
    character.onToolChange = tool => world.setHeldTool(tool);
    character.root.position.set(0.3, 0, 1.6);
    character.setMood(mood.mood);
    character.setGrime(mood.dirt, mood.wither);
    scene.add(character.root);

    let lastActionKey = '';
    behavior = new BehaviorController(character, {
      mood: mood.mood,
      onChange: state => {
        ui.setBehavior(state);
        const key = `${state.action?.id}:${state.phase}`;
        if (state.phase === 'act' && key !== lastActionKey && state.action) {
          ui.say(state.action.thought?.[mood.mood] || state.action.label);
        }
        lastActionKey = key;
      },
    });
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) behavior.setAutomatic(false);
    behavior.select('wave');
    resetCamera();
    ui.loaded();
    const queued = pendingCelebrations;
    pendingCelebrations = [];
    queued.forEach(p => api.celebrate(p));
  }).catch(err => {
    console.error('환경이 마을 불러오기 실패:', err);
    ui.error('모델 파일을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.');
    throw err;
  });

  mood.onChange(next => {
    ui.setScore(mood.score, next);
    if (character) character.setMood(next);
    if (behavior) behavior.setMood(next);
  });

  // ── 클릭·터치 ────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  function pick(event) {
    if (!world || !character) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = [...world.clickables.filter(o => o.visible), water.mesh, character.model];
    const hit = raycaster.intersectObjects(targets, true).find(h => h.object.visible && h.object.userData.click);
    return hit ? hit.object.userData : null;
  }

  function handleClick(data) {
    if (!data || !behavior) return;
    if (data.click === 'character') {
      const id = CHARACTER_REACTION[mood.mood];
      behavior.select(id, { manual: true });
      return;
    }
    const actionId = CLICK_ACTIONS[data.click];
    if (actionId === 'pickup' && mood.mood !== 'sad') return;
    if (actionId && actionById[actionId]) behavior.select(actionId, { manual: true });
  }

  const activePointers = new Set();
  let pressed = null;
  let gesture = false;
  const onDown = e => {
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) gesture = true;
    pressed = { x: e.clientX, y: e.clientY };
  };
  const onUp = e => {
    activePointers.delete(e.pointerId);
    if (!gesture && pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) < 8) handleClick(pick(e));
    pressed = null;
    if (!activePointers.size) gesture = false;
  };
  const onCancel = e => {
    activePointers.delete(e.pointerId);
    pressed = null;
    if (!activePointers.size) gesture = false;
  };
  const onMove = e => {
    if (e.pointerType === 'touch' || activePointers.size) return;
    const data = pick(e);
    renderer.domElement.style.cursor = data ? 'pointer' : '';
    const label = data ? (data.click === 'character' ? '환경이' : data.click === 'stream' ? (data.label || '개울') : data.label) : null;
    const rect = renderer.domElement.getBoundingClientRect();
    ui.tooltip(label, e.clientX - rect.left, e.clientY - rect.top);
  };
  const onLeave = () => ui.tooltip(null);
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onCancel);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerleave', onLeave);

  // ── 매 프레임 ────────────────────────────────────────────
  const clock = new THREE.Clock();
  let time = 0;
  const tmpColor = new THREE.Color();
  const headPos = new THREE.Vector3();
  const handPos = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const delta = new THREE.Vector3();

  function applyMood() {
    const w = mood.weights;
    mixColor(sky.uniforms.uTop.value, 'top', w);
    mixColor(sky.uniforms.uHorizon.value, 'horizon', w);
    mixColor(sky.uniforms.uSun.value, 'sun', w);
    sky.uniforms.uSmog.value = w.sad;
    sky.uniforms.uTime.value = time;
    mixColor(scene.fog.color, 'fog', w);
    scene.fog.near = mixNumber('fogNear', w);
    scene.fog.far = mixNumber('fogFar', w);
    mixColor(hemi.color, 'hemiSky', w);
    mixColor(hemi.groundColor, 'hemiGround', w);
    hemi.intensity = mixNumber('hemi', w);
    mixColor(sun.color, 'sunColor', w);
    sun.intensity = mixNumber('sunI', w);
    ground.applyMood(w);
    water.applyMood(w, time);
    puddles.applyMood(w);
    tmpColor.copy(scene.fog.color);
    renderer.setClearColor(tmpColor);
  }

  function frame() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    if (document.hidden) return;
    time += dt;
    mood.update(dt);
    applyMood();

    if (character && behavior) {
      behavior.update(dt);
      character.setGrime(mood.dirt, mood.wither);
      character.update(dt);
      character.root.updateMatrixWorld(true);
      character.getSocketWorldPosition(handPos);
      world.update(dt, time, mood.weights, { carrying: behavior.carrying, handPos });

      // 카메라가 캐릭터를 부드럽게 따라간다
      const p = character.root.position;
      focus.set(p.x * 0.7, 0.8, p.z * 0.7 + 0.4);
      delta.subVectors(focus, controls.target).multiplyScalar(1 - Math.exp(-dt * 1.6));
      controls.target.add(delta);
      camera.position.add(delta);

      character.getHeadWorldPosition(headPos);
      headPos.project(camera);
      const visible = headPos.z > -1 && headPos.z < 1;
      ui.positionHead((headPos.x * 0.5 + 0.5) * width, (-headPos.y * 0.5 + 0.5) * height, visible);
    }
    const drawH = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    effects.update(dt, time, mood.weights, camera, (drawH * 0.5) / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
    ui.tick(dt);
    controls.update();
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  const onContextLost = e => {
    e.preventDefault();
    renderer.setAnimationLoop(null);
    ui.error('화면이 잠시 멈췄어요. 다시 불러오면 환경이를 만날 수 있어요.');
  };
  dom.addEventListener('webglcontextlost', onContextLost);

  // ── 연결 약속(API) ───────────────────────────────────────
  const api = {
    ready,
    /** 0~100 청결 점수. 상태 전환 연출 포함 */
    setCleanliness(score) {
      mood.setScore(score);
      ui.setScore(mood.score, mood.mood);
    },
    /** 오늘 남은 인증 횟수 */
    setRemaining(next = {}) {
      remaining = { ...remaining, ...next };
      ui.setRemaining(remaining);
    },
    /** 점수 획득 연출: +points 표시, 정화 효과, 폴짝 */
    celebrate(points = 10) {
      if (!character || !behavior) {
        pendingCelebrations.push(points);
        return;
      }
      ui.pop(points);
      behavior.celebrate();
      effects.startBurst(character.root.position);
      ui.say(mood.mood === 'sad' ? '고마워! 조금 깨끗해졌어!' : '고마워! 반짝반짝!', 2.4);
    },
    /** 미션 버튼 클릭: 'meal' | 'product' | 'phrase'. 해제 함수를 돌려준다 */
    onMissionSelect(callback) {
      const fn = id => { if (MISSION_IDS.has(id)) callback(id); };
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** 개발용: 내부 객체 (dev 옵션일 때만) */
    get debug() {
      return options.dev ? { behavior, character, world, camera, controls, mood } : undefined;
    },
    getState() {
      return { score: mood.score, mood: mood.mood, remaining: { ...remaining }, action: behavior?.action?.id ?? null };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      dom.removeEventListener('pointerdown', onDown);
      dom.removeEventListener('pointerup', onUp);
      dom.removeEventListener('pointercancel', onCancel);
      dom.removeEventListener('pointermove', onMove);
      dom.removeEventListener('pointerleave', onLeave);
      dom.removeEventListener('webglcontextlost', onContextLost);
      listeners.clear();
      character?.dispose();
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      scene.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          materials.add(m);
          for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v);
          if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u?.value?.isTexture) textures.add(u.value);
        }
      });
      if (character) Object.values(character.faces).forEach(t => textures.add(t));
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      textures.forEach(t => t.dispose());
      sun.shadow.map?.dispose();
      renderer.dispose();
      ui.dispose();
      rootEl.remove();
    },
  };
  return api;
}

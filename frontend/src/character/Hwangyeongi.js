import * as THREE from 'three';
import { patchGrime, grimeUniforms } from './grime.js';

// 손에 드는 소품의 위치 보정 (socket_R 뼈 기준)
const TOOL_GRIP = {
  can: { pos: [0.0, 0.02, 0.0], rot: [0, Math.PI, 0], scale: 1.0 },
  broom: { pos: [0.0, 0.0, 0.0], rot: [0.0, 0, 0], scale: 1.0 },
  trowel: { pos: [0.0, 0.02, 0.0], rot: [0.0, 0, 0], scale: 1.0 },
};

const MOOD_FACE = { default: 'default', happy: 'happy', sad: 'sad' };
const BLINK_FACE = { default: 'blink', sad: 'sadBlink' };
const FADE = 0.28;

/**
 * GLB 캐릭터를 감싸는 클래스.
 * BehaviorController 가 쓰는 root / play / setTool / setFaceOverride 를 제공한다.
 */
export class Hwangyeongi {
  constructor(gltf, faceTextures) {
    this.root = new THREE.Group();
    this.root.name = 'Hwangyeongi';
    this.model = gltf.scene;
    this.root.add(this.model);
    this.faces = faceTextures;
    this.uniforms = grimeUniforms();
    this.mood = 'default';
    this.paused = false;
    this.faceOverride = null;
    this.faceOverrideTimer = 0;
    this.blinkTimer = 2.5;
    this.blinking = 0;
    this.currentFace = null;
    this.tools = {};
    this.tool = null;

    const patched = new Set();
    this.model.traverse(obj => {
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = false;
      obj.frustumCulled = false; // 스킨 메시는 휴지 자세 경계로 잘릴 수 있다
      obj.userData.click = 'character';
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (patched.has(m)) continue;
        patched.add(m);
        const name = m.name || '';
        if (name === 'face') {
          this.faceMaterial = m;
          m.transparent = true;
          m.depthWrite = false;
          m.polygonOffset = true;
          m.polygonOffsetFactor = -2;
          m.polygonOffsetUnits = -2;
          obj.renderOrder = 2;
          obj.castShadow = false;
        } else if (name.startsWith('leaf')) {
          patchGrime(m, this.uniforms, { leaf: true });
        } else if (['skin', 'leather', 'wood', 'clay', 'acorn_nut', 'acorn_cap', 'badge'].some(k => name.startsWith(k))) {
          patchGrime(m, this.uniforms, { leaf: name.startsWith('clay') });
        }
      }
    });

    this.pot = this.model.getObjectByName('prop_pot');
    this.twig = this.model.getObjectByName('prop_twig');
    this.socket = this.model.getObjectByName('socket_R');
    this.head = this.model.getObjectByName('head');

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const action = this.mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      this.actions[clip.name] = action;
    }
    this.current = null;
    this.play('idle', 0);
    this.applyFace();
    this.updateProps();
  }

  get clipNames() {
    return Object.keys(this.actions);
  }

  /** village.glb 에서 복제한 소품을 손 소켓에 붙여 둔다 */
  attachTools(tools) {
    for (const [key, obj] of Object.entries(tools)) {
      const grip = TOOL_GRIP[key];
      obj.position.fromArray(grip.pos);
      obj.rotation.set(...grip.rot);
      obj.scale.setScalar(grip.scale);
      obj.visible = false;
      obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.socket?.add(obj);
      this.tools[key] = obj;
    }
  }

  play(name, fade = FADE) {
    const next = this.actions[name] || this.actions.idle;
    if (!next || next === this.current) return;
    next.reset();
    next.enabled = true;
    next.setEffectiveWeight(1);
    if (this.current && fade > 0) {
      next.crossFadeFrom(this.current, fade, false);
    }
    next.play();
    this.current = next;
  }

  setPaused(paused) {
    this.paused = paused;
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this.applyFace();
    this.updateProps();
  }

  setGrime(dirt, wither) {
    this.uniforms.uDirt.value = dirt;
    this.uniforms.uWither.value = wither;
  }

  setTool(tool) {
    if (tool === this.tool) return;
    this.tool = tool;
    for (const [key, obj] of Object.entries(this.tools)) obj.visible = key === tool;
    this.updateProps();
    this.onToolChange?.(tool);
  }

  updateProps() {
    const free = !this.tool;
    if (this.pot) this.pot.visible = free && this.mood !== 'sad';
    if (this.twig) this.twig.visible = free && this.mood === 'sad';
  }

  /** name: 'sleep' | 'happy' | null, seconds: 지정하면 그 시간 뒤 해제 */
  setFaceOverride(name, seconds = 0) {
    if (name === null && this.faceOverrideTimer > 0) return; // 시간제 표정은 끝까지 유지
    this.faceOverride = name;
    this.faceOverrideTimer = seconds;
    this.applyFace();
  }

  applyFace() {
    if (!this.faceMaterial) return;
    let key = this.faceOverride || MOOD_FACE[this.mood] || 'default';
    if (this.blinking > 0 && !this.faceOverride && BLINK_FACE[this.mood]) key = BLINK_FACE[this.mood];
    if (key === this.currentFace) return;
    const tex = this.faces[key];
    if (!tex) return;
    this.faceMaterial.map = tex;
    this.faceMaterial.needsUpdate = true;
    this.currentFace = key;
  }

  /** 머리 위 말풍선 위치 계산용 */
  getHeadWorldPosition(target) {
    return target.set(0, 1.45, 0).applyMatrix4(this.root.matrixWorld);
  }

  getSocketWorldPosition(target) {
    return this.socket ? this.socket.getWorldPosition(target) : target.copy(this.root.position);
  }

  update(dt) {
    if (!this.paused) this.mixer.update(dt);
    if (this.faceOverrideTimer > 0) {
      this.faceOverrideTimer -= dt;
      if (this.faceOverrideTimer <= 0) {
        this.faceOverrideTimer = 0;
        this.faceOverride = null;
      }
    }
    this.blinkTimer -= dt;
    if (this.blinking > 0) this.blinking -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = 0.14;
      this.blinkTimer = 2.2 + Math.random() * 3.2;
    }
    this.applyFace();
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.model);
  }
}

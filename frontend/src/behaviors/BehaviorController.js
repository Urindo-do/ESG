import { actionById, actionsForMood, nearestTrash } from './actions.js';
import { findPath, isWalkable } from './navigation.js';
import { PLACEMENTS, inStream } from '../world/layout.js';

const IDLE_CLIP = { default: 'idle', happy: 'happy_idle', sad: 'sad_idle' };
const WALK_SPEED = { default: 1.15, happy: 1.35, sad: 0.72 };
const bins = PLACEMENTS.find(p => p.id === 'bins');

export function groundHeight(x, z) {
  return inStream(x, z) ? 0.05 : 0;
}

/**
 * 캐릭터 행동 상태기계.
 * character 에 필요한 것: root(position, rotation), play(clip), setTool(tool|null), setFaceOverride(name|null)
 */
export class BehaviorController {
  constructor(character, { onChange, random = Math.random, mood = 'default' } = {}) {
    this.character = character;
    this.onChange = onChange;
    this.random = random;
    this.mood = mood;
    this.automatic = true;
    this.paused = false;
    this.action = null;
    this.path = [];
    this.phase = 'rest';
    this.elapsed = 0;
    this.restTimer = 0.6;
    this.time = 0;
    this.override = null;
    this.carrying = null;
    this.seat = null;
    this.face = null;
  }

  get state() {
    return {
      action: this.action,
      phase: this.phase,
      walking: this.phase === 'walk',
      automatic: this.automatic,
      paused: this.paused,
      mood: this.mood,
    };
  }

  emit() {
    this.onChange?.(this.state);
  }

  get root() {
    return this.character.root;
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    const a = this.action;
    if (this.automatic && (!a || !a.moods.includes(mood)) && this.phase !== 'rest' && !(a && a.id === 'hesitate' && mood === 'sad')) {
      this.chooseNext();
    } else {
      this.emit();
    }
  }

  setAutomatic(value) {
    this.automatic = value;
    if (value && this.phase === 'rest') this.restTimer = Math.min(this.restTimer, 0.4);
    this.emit();
  }

  togglePause() {
    this.paused = !this.paused;
    this.character.setPaused?.(this.paused);
    this.emit();
  }

  resume() {
    if (this.paused) this.togglePause();
    else if (this.phase === 'rest') this.chooseNext();
  }

  celebrate(seconds = 1.1) {
    this.override = { clip: 'jump', t: seconds };
    this.character.setFaceOverride('happy', 1.8);
  }

  select(id, { manual = false } = {}) {
    const a = actionById[id];
    if (!a) return false;
    this.leaveSeat();
    this.carrying = null;
    this.character.setTool(null);
    this.action = a;
    this.manual = manual;
    this.elapsed = 0;
    const p = this.root.position;
    let target = a.target;
    let face = a.face;
    if (a.dynamicTarget === 'trash') {
      const t = nearestTrash(p.x, p.z);
      const dx = p.x - t.pos[0];
      const dz = p.z - t.pos[1];
      const d = Math.hypot(dx, dz) || 1;
      target = [t.pos[0] + (dx / d) * 0.42, t.pos[1] + (dz / d) * 0.42];
      if (!isWalkable(target[0], target[1])) target = [t.pos[0], t.pos[1] + 0.45];
      face = t.pos;
      this.trashTarget = t;
    } else if (a.dynamicTarget === 'towardBins') {
      const bx = bins.pos[0] - 0.4;
      const bz = bins.pos[1] + 0.9;
      target = [p.x + (bx - p.x) * 0.45, p.z + (bz - p.z) * 0.45];
      if (!isWalkable(target[0], target[1])) target = [p.x, p.z];
    }
    this.face = face;
    const stops = [...(a.via || []), target];
    this.path = [];
    let from = [p.x, p.z];
    for (const stop of stops) {
      const seg = findPath(from, stop);
      this.path.push(...seg);
      from = stop;
    }
    if (this.path.length && Math.hypot(this.path.at(-1)[0] - p.x, this.path.at(-1)[1] - p.z) < 0.05) this.path = [];
    this.phase = this.path.length ? 'walk' : (a.seat ? 'seat' : 'act');
    this.seatT = 0;
    if (this.paused) {
      this.paused = false;
      this.character.setPaused?.(false);
    }
    this.emit();
    return true;
  }

  chooseNext() {
    const options = actionsForMood(this.mood).filter(a => a.id !== this.action?.id);
    if (!options.length) return;
    const pick = options[Math.floor(this.random() * options.length)];
    this.select(pick.id);
  }

  leaveSeat() {
    if (!this.seat) return;
    const r = this.root;
    r.position.x = this.seat.from[0];
    r.position.z = this.seat.from[1];
    r.position.y = groundHeight(r.position.x, r.position.z);
    this.seat = null;
  }

  finish() {
    const a = this.action;
    this.character.setTool(null);
    this.character.setFaceOverride(null);
    if (a?.id !== 'pickup') this.carrying = null;
    this.leaveSeat();
    if (a?.next) {
      this.select(a.next, { manual: this.manual });
      return;
    }
    this.phase = 'rest';
    this.restTimer = this.automatic ? 0.8 + this.random() * 1.4 : Infinity;
    this.emit();
  }

  turnToward(x, z, dt, rate = 9) {
    const r = this.root;
    const target = Math.atan2(x - r.position.x, z - r.position.z);
    const diff = Math.atan2(Math.sin(target - r.rotation.y), Math.cos(target - r.rotation.y));
    r.rotation.y += diff * Math.min(1, dt * rate);
  }

  clipFor(kind) {
    if (kind === 'walk') return this.mood === 'sad' ? 'sad_walk' : 'walk';
    if (kind === 'idle') return IDLE_CLIP[this.mood] || 'idle';
    return kind;
  }

  update(dt) {
    if (this.paused) return;
    this.time += dt;
    const r = this.root;
    let clip = this.clipFor('idle');

    if (this.phase === 'walk') {
      const [x, z] = this.path[0];
      const dx = x - r.position.x;
      const dz = z - r.position.z;
      const dist = Math.hypot(dx, dz);
      const step = dt * (WALK_SPEED[this.mood] || 1);
      this.turnToward(x, z, dt, 10);
      if (dist <= step) {
        r.position.x = x;
        r.position.z = z;
        this.path.shift();
      } else {
        r.position.x += (dx / dist) * step;
        r.position.z += (dz / dist) * step;
      }
      r.position.y = groundHeight(r.position.x, r.position.z);
      clip = this.clipFor('walk');
      if (!this.path.length) {
        this.phase = this.action.seat ? 'seat' : 'act';
        this.emit();
      }
    } else if (this.phase === 'seat') {
      const s = this.action.seat;
      if (!this.seat) this.seat = { from: [r.position.x, r.position.z], t: 0 };
      this.seat.t = Math.min(1, this.seat.t + dt / 0.5);
      const k = this.seat.t * this.seat.t * (3 - 2 * this.seat.t);
      r.position.x = this.seat.from[0] + (s.pos[0] - this.seat.from[0]) * k;
      r.position.z = this.seat.from[1] + (s.pos[1] - this.seat.from[1]) * k;
      r.position.y = s.y * Math.sin(k * Math.PI * 0.5) + 0.12 * Math.sin(k * Math.PI);
      this.turnToward(this.face[0], this.face[1], dt, 12);
      clip = this.clipFor('idle');
      if (this.seat.t >= 1) {
        this.phase = 'act';
        this.emit();
      }
    } else if (this.phase === 'act') {
      const a = this.action;
      this.elapsed += dt;
      if (!this.seat) this.turnToward(this.face[0], this.face[1], dt);
      else this.turnToward(this.face[0], this.face[1], dt, 4);
      clip = a.clip === 'idle' ? this.clipFor('idle') : a.clip;
      if (a.tool) this.character.setTool(a.tool);
      if (a.faceOverride) this.character.setFaceOverride(a.faceOverride);
      if (a.id === 'pickup' && this.elapsed > a.duration * 0.45) this.carrying = this.trashTarget;
      if (this.elapsed >= a.duration) this.finish();
    } else {
      this.restTimer -= dt;
      if (this.restTimer <= 0 && this.automatic) this.chooseNext();
    }

    if (this.override) {
      this.override.t -= dt;
      clip = this.override.clip;
      if (this.override.t <= 0) this.override = null;
    }
    this.character.play(clip);
  }
}

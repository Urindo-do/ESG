import {
  MOOD_THRESHOLDS, TRANSITION_SECONDS, DIRT_START, DIRT_FULL, WITHER_START, WITHER_FULL,
} from '../config.js';

export const MOODS = ['default', 'happy', 'sad'];

export function clampScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function moodForScore(score) {
  const s = clampScore(score);
  if (s >= MOOD_THRESHOLDS.happy) return 'happy';
  if (s < MOOD_THRESHOLDS.sad) return 'sad';
  return 'default';
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 점수 → 먼지·시듦 목표값 (0~1). 점수가 낮을수록 커진다. */
export function grimeForScore(score) {
  const s = clampScore(score);
  return {
    dirt: smoothstep(DIRT_START, DIRT_FULL, s),
    wither: smoothstep(WITHER_START, WITHER_FULL, s),
  };
}

/**
 * 점수 변화를 부드러운 가중치로 바꾼다.
 * weights.happy / weights.sad 는 0~1, weights.default = 1 - happy - sad.
 */
export class MoodState {
  constructor(score = 60, seconds = TRANSITION_SECONDS) {
    this.seconds = seconds;
    this.score = clampScore(score);
    this.mood = moodForScore(this.score);
    const g = grimeForScore(this.score);
    this.weights = { happy: this.mood === 'happy' ? 1 : 0, sad: this.mood === 'sad' ? 1 : 0, default: 0 };
    this.weights.default = 1 - this.weights.happy - this.weights.sad;
    this.dirt = g.dirt;
    this.wither = g.wither;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  setScore(score) {
    const prev = this.mood;
    this.score = clampScore(score);
    this.mood = moodForScore(this.score);
    if (prev !== this.mood) this.listeners.forEach(fn => fn(this.mood, prev));
    return this.mood;
  }

  /** dt초 만큼 목표로 이동. 반환값: 아직 움직이는 중이면 true */
  update(dt) {
    const rate = dt / Math.max(0.01, this.seconds);
    const target = { happy: this.mood === 'happy' ? 1 : 0, sad: this.mood === 'sad' ? 1 : 0 };
    let moving = false;
    for (const key of ['happy', 'sad']) {
      const d = target[key] - this.weights[key];
      if (Math.abs(d) > 1e-4) {
        moving = true;
        this.weights[key] += Math.sign(d) * Math.min(Math.abs(d), rate);
      } else {
        this.weights[key] = target[key];
      }
    }
    // 두 가중치의 합이 1을 넘지 않게 (happy↔sad 직행 시)
    const sum = this.weights.happy + this.weights.sad;
    if (sum > 1) {
      const k = 1 / sum;
      this.weights.happy *= k;
      this.weights.sad *= k;
    }
    this.weights.default = Math.max(0, 1 - this.weights.happy - this.weights.sad);
    const g = grimeForScore(this.score);
    for (const key of ['dirt', 'wither']) {
      const d = g[key] - this[key];
      if (Math.abs(d) > 1e-4) {
        moving = true;
        this[key] += Math.sign(d) * Math.min(Math.abs(d), rate);
      } else {
        this[key] = g[key];
      }
    }
    return moving;
  }

  /** 세 상태 값을 가중치로 섞는다: pick({default, happy, sad}) */
  mix(values) {
    const w = this.weights;
    return values.default * w.default + values.happy * w.happy + values.sad * w.sad;
  }
}

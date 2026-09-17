import test from 'node:test';
import assert from 'node:assert/strict';
import { moodForScore, MoodState, grimeForScore, clampScore } from '../src/states/mood.js';
import { MOOD_THRESHOLDS } from '../src/config.js';
import { findPath, isWalkable } from '../src/behaviors/navigation.js';
import { ACTIONS, actionById, actionsForMood } from '../src/behaviors/actions.js';
import { BehaviorController } from '../src/behaviors/BehaviorController.js';
import { walkable, TRASH, TREES, PLACEMENTS } from '../src/world/layout.js';

function stubCharacter(x = 0.3, z = 1.6) {
  const calls = { play: [], tool: [], face: [] };
  return {
    calls,
    root: { position: { x, y: 0, z }, rotation: { y: 0 } },
    play(name) { calls.play.push(name); },
    setTool(tool) { calls.tool.push(tool); },
    setFaceOverride(name) { calls.face.push(name); },
    setPaused() {},
  };
}

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

test('점수 구간이 설정값과 맞는다', () => {
  assert.equal(moodForScore(MOOD_THRESHOLDS.happy), 'happy');
  assert.equal(moodForScore(MOOD_THRESHOLDS.happy - 0.1), 'default');
  assert.equal(moodForScore(MOOD_THRESHOLDS.sad), 'default');
  assert.equal(moodForScore(MOOD_THRESHOLDS.sad - 0.1), 'sad');
  assert.equal(moodForScore(150), 'happy');
  assert.equal(moodForScore(-20), 'sad');
  assert.equal(clampScore('abc'), 0);
});

test('상태 전환은 부드럽고 가중치 합이 1이다', () => {
  const m = new MoodState(90);
  assert.equal(m.weights.happy, 1);
  m.setScore(5);
  let maxSum = 0;
  for (let i = 0; i < 200; i++) {
    m.update(1 / 60);
    const w = m.weights;
    maxSum = Math.max(maxSum, w.happy + w.sad + w.default);
    assert.ok(w.happy >= 0 && w.sad >= 0 && w.default >= -1e-9);
  }
  assert.ok(Math.abs(maxSum - 1) < 1e-6);
  assert.equal(m.weights.sad, 1);
  assert.equal(m.weights.happy, 0);
});

test('점수가 낮을수록 먼지·시듦이 커진다', () => {
  let prev = -1;
  for (let s = 100; s >= 0; s -= 5) {
    const g = grimeForScore(s);
    assert.ok(g.dirt >= prev - 1e-9);
    prev = g.dirt;
  }
  assert.equal(grimeForScore(80).dirt, 0);
  assert.equal(grimeForScore(0).dirt, 1);
});

test('모든 행동 목적지에 걸어갈 수 있다', () => {
  for (const a of ACTIONS) {
    if (a.dynamicTarget) continue;
    assert.ok(isWalkable(...a.target), `${a.id} 목적지가 막혀 있음`);
    const path = findPath([0.3, 1.6], a.target);
    const end = path.at(-1);
    assert.ok(Math.hypot(end[0] - a.target[0], end[1] - a.target[1]) < 0.3, `${a.id} 경로가 목적지에 닿지 않음`);
    for (const [x, z] of path) assert.ok(walkable(x, z), `${a.id} 경로에 막힌 점`);
  }
});

test('땅 위 쓰레기는 주울 수 있는 곳에 있다', () => {
  for (const t of TRASH) {
    if (t.y !== undefined) continue;
    const near = [[0.42, 0], [-0.42, 0], [0, 0.45], [0, -0.45]].some(([dx, dz]) => walkable(t.pos[0] + dx, t.pos[1] + dz));
    assert.ok(near, `쓰레기 ${t.asset} (${t.pos}) 주변에 설 곳이 없음`);
  }
});

test('나무·소품이 섬 밖으로 나가지 않는다', () => {
  for (const p of [...PLACEMENTS, ...TREES]) assert.ok(Math.hypot(...p.pos) < 8.9, `${p.id || p.full} 위치`);
});

test('상태별 자동 행동이 끊기지 않고 이어진다', () => {
  for (const mood of ['default', 'happy', 'sad']) {
    const c = stubCharacter();
    const seen = new Set();
    const b = new BehaviorController(c, { mood, random: seeded(7) });
    b.select(actionsForMood(mood)[0].id);
    for (let i = 0; i < 60 * 240; i++) {
      b.update(1 / 30);
      if (b.action) seen.add(b.action.id);
    }
    const allowed = new Set([...actionsForMood(mood).map(a => a.id), 'hesitate']);
    for (const id of seen) assert.ok(allowed.has(id), `${mood}에서 허용되지 않은 행동 ${id}`);
    assert.ok(seen.size >= Math.min(4, allowed.size), `${mood}: 행동 종류가 너무 적음 (${[...seen]})`);
    assert.ok(Number.isFinite(c.root.position.x) && Number.isFinite(c.root.position.z));
  }
});

test('쓰레기 줍기 다음에는 멈칫 행동이 이어진다', () => {
  const c = stubCharacter();
  const b = new BehaviorController(c, { mood: 'sad', random: seeded(3) });
  b.select('pickup');
  let sawCarry = false;
  let sawHesitate = false;
  for (let i = 0; i < 30 * 60; i++) {
    b.update(1 / 30);
    if (b.carrying) sawCarry = true;
    if (b.action?.id === 'hesitate') sawHesitate = true;
    if (sawHesitate && b.phase === 'rest') break;
  }
  assert.ok(sawCarry, '쓰레기를 들지 않음');
  assert.ok(sawHesitate, '멈칫 행동이 없음');
  assert.equal(b.carrying, null);
});

test('벤치 낮잠: 앉았다가 끝나면 땅으로 내려온다', () => {
  const c = stubCharacter();
  const b = new BehaviorController(c, { mood: 'default', random: seeded(5) });
  b.setAutomatic(false);
  b.select('nap', { manual: true });
  let maxY = 0;
  for (let i = 0; i < 30 * 60 && b.phase !== 'rest'; i++) {
    b.update(1 / 30);
    maxY = Math.max(maxY, c.root.position.y);
  }
  assert.ok(maxY > 0.3, '벤치에 앉지 않음');
  assert.equal(b.phase, 'rest');
  assert.equal(c.root.position.y, 0);
  assert.ok(c.calls.face.includes('sleep'));
});

test('잠시 멈춤 중에는 움직이지 않고, 다시 시작하면 이어진다', () => {
  const c = stubCharacter();
  const b = new BehaviorController(c, { mood: 'default' });
  b.select('stroll');
  b.togglePause();
  const { x, z } = c.root.position;
  for (let i = 0; i < 90; i++) b.update(1 / 30);
  assert.equal(c.root.position.x, x);
  assert.equal(c.root.position.z, z);
  b.resume();
  for (let i = 0; i < 30; i++) b.update(1 / 30);
  assert.ok(c.root.position.x !== x || c.root.position.z !== z);
});

test('상태가 바뀌면 맞지 않는 행동을 바로 바꾼다', () => {
  const c = stubCharacter();
  const b = new BehaviorController(c, { mood: 'happy', random: seeded(9) });
  b.select('dance');
  b.setMood('sad');
  assert.ok(actionById[b.action.id].moods.includes('sad'));
});

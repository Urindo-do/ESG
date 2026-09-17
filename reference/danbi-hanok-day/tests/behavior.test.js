import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { ACTIONS } from '../src/behaviors/actions.js';
import { findPath, groundHeight, isWalkable } from '../src/behaviors/navigation.js';
import { BehaviorController } from '../src/behaviors/BehaviorController.js';

const obstacles = [
  { x: -0.25, z: -1.7, w: 1.5, d: 0.85 },
  { x: 2.48, z: -2.66, w: 1.45, d: 0.55 },
  { x: 3.02, z: -1.55, w: 0.8, d: 0.7 },
  { x: -3.5, z: 0.4, w: 1.2, d: 1.1 },
  { x: 2.6, z: 2.5, w: 1.65, d: 1.18 },
];

test('every action is reachable from every other action without crossing furniture or the porch edge', () => {
  for (const from of ACTIONS) for (const to of ACTIONS) {
    if (from.id === to.id) continue;
    const path = findPath(from.target, to.target, obstacles);
    assert.ok(path.length, `${from.id} → ${to.id}: missing path`);
    for (const [x, z] of path) assert.ok(isWalkable(x, z, obstacles), `${from.id} → ${to.id}: blocked at ${x}, ${z}`);
    const last = path.at(-1);
    assert.ok(Math.hypot(last[0] - to.target[0], last[1] - to.target[1]) < 0.5, `${to.id}: too far from destination`);
  }
});

test('the porch transition interpolates between the two floor heights', () => {
  assert.equal(groundHeight(0), 0.58);
  assert.equal(groundHeight(2), 0.12);
  assert.ok(Math.abs(groundHeight(1.3) - 0.35) < 1e-9);
  assert.equal(isWalkable(2, 1.3, []), false);
  assert.equal(isWalkable(0, 1.3, []), true);
});

function controller() {
  const root = new Group(); root.position.set(0, 0.58, 0.3);
  const furniture = { ball: new Group(), toy: new Group(), ballHome: new Vector3(-1.65, 0.34, 2.42), obstacles };
  return new BehaviorController({ root, animate() {} }, furniture, () => {});
}

test('pause freezes movement, action time, and prop motion; selecting an action resumes', () => {
  const behavior = controller(); behavior.select('play'); behavior.update(0.05); behavior.togglePause();
  const position = behavior.danbi.root.position.clone(), time = behavior.time;
  for (let i = 0; i < 50; i++) behavior.update(0.05);
  assert.ok(position.equals(behavior.danbi.root.position)); assert.equal(behavior.time, time);
  behavior.select('eat'); assert.equal(behavior.paused, false); assert.equal(behavior.action.id, 'eat');
});

test('manual actions finish and stop; automatic mode advances', () => {
  const manual = controller(); manual.setAutomatic(false); manual.select('eat');
  for (let i = 0; i < 1500; i++) manual.update(0.05);
  assert.equal(manual.paused, true); assert.equal(manual.action.id, 'eat');
  const auto = controller();
  for (let i = 0; i < 100; i++) auto.update(0.05);
  assert.notEqual(auto.action.id, 'shake'); assert.equal(auto.paused, false);
});

test('all ten manual activities reach their destination and finish', () => {
  for (const action of ACTIONS) {
    const behavior = controller(); behavior.setAutomatic(false); behavior.select(action.id);
    for (let i = 0; i < 2400; i++) behavior.update(0.05);
    assert.equal(behavior.paused, true, `${action.id} never finished`);
    assert.equal(behavior.path.length, 0, `${action.id} still moving`);
  }
});

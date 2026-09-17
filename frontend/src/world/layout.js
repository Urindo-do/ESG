// 마을 배치 데이터 (three.js 좌표: X 오른쪽, Y 위, Z 화면 쪽)
// 코드 없이 숫자만 바꿔 배치를 조정할 수 있게 모아 둔다.

export const ISLAND_RADIUS = 9.2;
export const WALK_RADIUS = 8.2;

// ── 개울: 뒤에서 앞으로 흐르는 물길 ──────────────────────────
export const STREAM = {
  halfWidth: 0.85,
  bank: 0.45,
  depth: 0.38,
  waterY: -0.13,
  zMin: -12,
  zMax: 12,
};

export function streamX(z) {
  return 4.35 + 0.55 * Math.sin(z * 0.38 + 0.6);
}

export const STEPPING_Z = 1.9;
export const STEPPING_STONES = [-0.55, 0, 0.55].map((dx, i) => ({
  x: streamX(STEPPING_Z) + dx,
  z: STEPPING_Z + (i === 1 ? 0.08 : -0.05),
}));

// ── 흙길 ────────────────────────────────────────────────────
export const PATH = {
  width: 0.95,
  points: [[0.6, 10.0], [0.35, 6.2], [-0.5, 3.8], [-1.8, 1.8], [-2.8, 0.1], [-3.2, -1.2]],
};

// ── 에셋 배치 ────────────────────────────────────────────────
// asset: village.glb 안의 이름, moods: 보이는 상태(없으면 항상)
export const PLACEMENTS = [
  { id: 'house', asset: 'house_stump', pos: [-3.3, -2.6], rotY: 0.18, scale: 1.0 },
  { id: 'garden', asset: 'garden_bed', pos: [-0.2, -1.75], rotY: -0.05, scale: 1.0 },
  { id: 'bench', asset: 'bench', pos: [-4.7, 1.5], rotY: 0.55, scale: 1.0 },
  { id: 'sign', asset: 'sign', pos: [-1.35, 4.35], rotY: 0.12, scale: 1.0 },
  { id: 'bins', asset: 'recycle_bins', pos: [1.35, 0.55], rotY: -0.5, scale: 1.0 },
  { id: 'mailbox', asset: 'mailbox', pos: [-1.95, -0.05], rotY: 0.6, scale: 1.0 },
  { id: 'log', asset: 'log', pos: [2.0, 4.6], rotY: 0.7, scale: 1.0 },
  { id: 'mushrooms1', asset: 'mushrooms', pos: [-5.6, -3.4], rotY: 0.3, scale: 1.2 },
  { id: 'mushrooms2', asset: 'mushrooms', pos: [1.9, -4.3], rotY: 1.2, scale: 1.0 },
  { id: 'rock1', asset: 'rock_a', pos: [3.05, -1.6], rotY: 0.4, scale: 1.0 },
  { id: 'rock2', asset: 'rock_b', pos: [5.55, 0.2], rotY: 1.1, scale: 0.9 },
  { id: 'rock3', asset: 'rock_a', pos: [3.25, 3.9], rotY: 2.0, scale: 0.8 },
  { id: 'rock4', asset: 'rock_b', pos: [5.4, -4.4], rotY: 0.2, scale: 1.1 },
  { id: 'rock5', asset: 'rock_a', pos: [-6.9, -0.8], rotY: 0.9, scale: 1.2 },
  ...STEPPING_STONES.map((s, i) => ({ id: `stone${i}`, asset: 'stone_flat', pos: [s.x, s.z], rotY: i * 0.9, scale: 0.9, y: -0.1 })),
];

// 나무: 풍성한 나무와 마른 나무를 같은 자리에 두고 상태에 따라 교체
export const TREES = [
  { pos: [-5.9, -4.4], full: 'tree_b', bare: 'tree_bare_a', rotY: 0.3, scale: 1.05 },
  { pos: [0.9, -5.6], full: 'tree_a', bare: 'tree_bare_b', rotY: 1.4, scale: 1.0 },
  { pos: [-7.3, 1.3], full: 'tree_c', bare: 'tree_bare_b', rotY: 2.2, scale: 1.0 },
  { pos: [6.9, -2.8], full: 'tree_a', bare: 'tree_bare_a', rotY: 0.8, scale: 0.95 },
  { pos: [7.1, 2.4], full: 'tree_c', bare: 'tree_bare_b', rotY: 2.9, scale: 0.9 },
  { pos: [3.6, -6.8], full: 'tree_b', bare: 'tree_bare_a', rotY: 1.9, scale: 0.9 },
  { pos: [-3.3, -6.6], full: 'tree_c', bare: 'tree_bare_b', rotY: 0.5, scale: 0.95 },
];

export const BUSHES = [
  { pos: [-5.3, -1.2], asset: 'bush_a', scale: 1.0 },
  { pos: [-1.8, -4.6], asset: 'bush_b', scale: 1.0 },
  { pos: [2.5, -3.6], asset: 'bush_a', scale: 0.8 },
  { pos: [6.2, 0.9], asset: 'bush_b', scale: 1.0 },
  { pos: [-6.2, 4.0], asset: 'bush_a', scale: 0.9 },
  { pos: [2.6, 6.9], asset: 'bush_b', scale: 1.1 },
  { pos: [-4.0, 6.6], asset: 'bush_b', scale: 0.9 },
];

// 상호작용 소품의 놓인 자리 (캐릭터가 들면 사라진다)
export const TOOL_SPOTS = {
  can: { pos: [0.95, -1.05], rotY: -0.6, y: 0.18 },
  broom: { pos: [-1.95, -1.55], rotY: 0.3, lean: 0.35, y: 0.62 },
  trowel: { pos: [-0.75, -1.8], rotY: 0.4, lean: 0.25, y: 0.33 },
};

// 쓰레기 (sad 단계에서만)
export const TRASH = [
  { asset: 'trash_can', pos: [0.4, 2.6], rotY: 0.5 },
  { asset: 'trash_bottle', pos: [-2.5, 2.4], rotY: 1.7 },
  { asset: 'trash_mask', pos: [1.6, 3.3], rotY: 0.2 },
  { asset: 'trash_bag', pos: [-3.9, -0.2], rotY: 0.0 },
  { asset: 'trash_can', pos: [2.4, -0.9], rotY: 2.1 },
  { asset: 'trash_box', pos: [-5.9, 2.6], rotY: 0.8 },
  { asset: 'trash_bottle', pos: [0.9, 5.4], rotY: 0.9 },
  { asset: 'trash_mask', pos: [-4.7, 4.3], rotY: 2.4 },
  { asset: 'trash_barrel', pos: [6.1, -1.6], rotY: 0.6 },
  { asset: 'trash_can', pos: [-0.9, -3.3], rotY: 1.2 },
  { asset: 'trash_bag', pos: [3.3, 1.2], rotY: 0.4 },
  { asset: 'trash_mask', pos: [-2.2, 5.8], rotY: 1.1 },
  { asset: 'trash_bottle', pos: [streamX(-2.4), -2.4], rotY: 0.3, y: -0.12 },
  { asset: 'trash_can', pos: [streamX(4.6) - 0.2, 4.6], rotY: 1.9, y: -0.12 },
  { asset: 'trash_box', pos: [3.1, 5.9], rotY: 0.2 },
];

export const OIL_PUDDLES = [
  { pos: [-0.6, 1.1], r: 0.55 },
  { pos: [2.9, 2.5], r: 0.4 },
  { pos: [-4.6, -2.0], r: 0.45 },
];

export const FACTORIES = [
  { pos: [-9.0, -15.5], scale: 2.2, rotY: 0.25 },
  { pos: [-1.5, -17.5], scale: 2.6, rotY: -0.1 },
  { pos: [7.5, -15.0], scale: 2.0, rotY: -0.35 },
];

export const CLOUDS = [
  { pos: [-9, 10.5, -18], scale: 2.2 },
  { pos: [3, 12, -22], scale: 2.8 },
  { pos: [12, 9.5, -16], scale: 1.8 },
  { pos: [-15, 13, -24], scale: 2.4 },
];

// ── 이동 장애물 (원) ─────────────────────────────────────────
export const OBSTACLES = [
  { x: -3.3, z: -2.6, r: 1.55 },   // 집
  { x: -0.2, z: -1.75, r: 0.95, sx: 1.0, sz: 0.55 }, // 텃밭 (타원)
  { x: -4.7, z: 1.5, r: 0.7 },
  { x: -1.35, z: 4.35, r: 0.5, sx: 1.4, sz: 0.4 },
  { x: 1.35, z: 0.55, r: 0.75, sx: 1.0, sz: 0.5 },
  { x: -1.95, z: -0.05, r: 0.25 },
  { x: 2.0, z: 4.6, r: 0.75, sx: 1.0, sz: 0.4 },
  ...TREES.map(t => ({ x: t.pos[0], z: t.pos[1], r: 0.45 })),
  ...BUSHES.map(b => ({ x: b.pos[0], z: b.pos[1], r: 0.6 * b.scale })),
  { x: 3.05, z: -1.6, r: 0.4 },
  { x: 5.55, z: 0.2, r: 0.4 },
  { x: 3.25, z: 3.9, r: 0.35 },
  { x: -6.9, z: -0.8, r: 0.45 },
];

export function inStream(x, z, margin = 0) {
  return Math.abs(x - streamX(z)) < STREAM.halfWidth + margin;
}

/** 걸을 수 있는 곳인가 (섬 안, 장애물 밖, 개울은 징검다리 줄만) */
export function walkable(x, z) {
  if (Math.hypot(x, z) > WALK_RADIUS) return false;
  for (const o of OBSTACLES) {
    const sx = o.sx ?? 1;
    const sz = o.sz ?? 1;
    const dx = (x - o.x) / sx;
    const dz = (z - o.z) / sz;
    if (Math.hypot(dx, dz) < o.r) return false;
  }
  if (inStream(x, z, 0.15) && Math.abs(z - STEPPING_Z) > 0.32) return false;
  return true;
}

// 흙길과의 거리 (바닥 셰이더·풀 배치에 사용)
export function distanceToPath(x, z) {
  let best = Infinity;
  const pts = PATH.points;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const vx = bx - ax;
    const vz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - (ax + vx * t), z - (az + vz * t)));
  }
  return best;
}

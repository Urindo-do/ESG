import { walkable } from '../world/layout.js';

// 격자 A* 이동 경로. 단비 레퍼런스의 방식을 넓은 마을에 맞게 키웠다.
const CELL = 0.25;
const MIN = -9;
const SIZE = Math.round((-MIN * 2) / CELL);

let grid = null;

function buildGrid() {
  grid = new Uint8Array(SIZE * SIZE);
  for (let j = 0; j < SIZE; j++) {
    for (let i = 0; i < SIZE; i++) {
      grid[j * SIZE + i] = walkable(MIN + (i + 0.5) * CELL, MIN + (j + 0.5) * CELL) ? 1 : 0;
    }
  }
  return grid;
}

export function resetNavigation() {
  grid = null;
}

const toCell = v => Math.max(0, Math.min(SIZE - 1, Math.floor((v - MIN) / CELL)));
const toWorld = i => MIN + (i + 0.5) * CELL;

function nearestOpen(ci, cj) {
  const g = grid || buildGrid();
  if (g[cj * SIZE + ci]) return [ci, cj];
  for (let r = 1; r < 20; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di;
        const j = cj + dj;
        if (i >= 0 && j >= 0 && i < SIZE && j < SIZE && g[j * SIZE + i]) return [i, j];
      }
    }
  }
  return [ci, cj];
}

class Heap {
  constructor() { this.items = []; }
  push(node, f) {
    const a = this.items;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
  get size() { return this.items.length; }
}

function lineClear(ax, az, bx, bz) {
  const d = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(d / (CELL * 0.5));
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    if (!walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

/** from, to: [x, z]. 반환: 지나갈 점 목록 [[x, z], ...] (출발점 제외) */
export function findPath(from, to) {
  const g = grid || buildGrid();
  const [si, sj] = nearestOpen(toCell(from[0]), toCell(from[1]));
  const [ti, tj] = nearestOpen(toCell(to[0]), toCell(to[1]));
  const start = sj * SIZE + si;
  const goal = tj * SIZE + ti;
  const came = new Int32Array(SIZE * SIZE).fill(-1);
  const cost = new Float32Array(SIZE * SIZE).fill(Infinity);
  const heap = new Heap();
  cost[start] = 0;
  heap.push(start, 0);
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
  let found = start === goal;
  while (heap.size && !found) {
    const cur = heap.pop();
    if (cur === goal) { found = true; break; }
    const ci = cur % SIZE;
    const cj = (cur - ci) / SIZE;
    for (const [di, dj, w] of dirs) {
      const ni = ci + di;
      const nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= SIZE || nj >= SIZE) continue;
      const n = nj * SIZE + ni;
      if (!g[n]) continue;
      if (di && dj && (!g[cj * SIZE + ni] || !g[nj * SIZE + ci])) continue;
      const c = cost[cur] + w;
      if (c < cost[n]) {
        cost[n] = c;
        came[n] = cur;
        heap.push(n, c + Math.hypot(ti - ni, tj - nj));
      }
    }
  }
  if (!found) return [[to[0], to[1]]];
  const cells = [];
  for (let n = goal; n !== start && n !== -1; n = came[n]) cells.push(n);
  cells.reverse();
  const pts = cells.map(n => [toWorld(n % SIZE), toWorld(Math.floor(n / SIZE))]);
  if (walkable(to[0], to[1])) pts.push([to[0], to[1]]);
  // 시야가 트인 점은 건너뛰어 부드럽게
  const out = [];
  let ax = from[0];
  let az = from[1];
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !lineClear(ax, az, pts[j][0], pts[j][1])) j--;
    out.push(pts[j]);
    [ax, az] = pts[j];
    i = j + 1;
  }
  return out;
}

export function isWalkable(x, z) {
  return walkable(x, z);
}

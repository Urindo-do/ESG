const STEP = 0.2;
const key = (x, z) => `${x},${z}`;
export function groundHeight(z) {
  if (z <= 1.05) return 0.58;
  if (z >= 1.55) return 0.12;
  return 0.58 - (z - 1.05) / 0.5 * 0.46;
}

export function isWalkable(x, z, obstacles) {
  if (x < -4.0 || x > 4.0 || z < -2.8 || z > 3.45) return false;
  if (z < 1.3 && Math.abs(x) > 3.15) return false;
  // Cross the raised porch only at the front steps.
  if (z > 0.90 && z < 1.70 && Math.abs(x) > 0.94) return false;
  return !obstacles.some(o => Math.abs(x - o.x) < o.w / 2 + 0.27 && Math.abs(z - o.z) < o.d / 2 + 0.27);
}

export function findPath(start, destination, obstacles) {
  const sx = Math.round(start[0] / STEP), sz = Math.round(start[1] / STEP);
  let gx = Math.round(destination[0] / STEP), gz = Math.round(destination[1] / STEP);
  if (!isWalkable(gx * STEP, gz * STEP, obstacles)) {
    let best = Infinity, nearest = null;
    for (let dx = -5; dx <= 5; dx++) for (let dz = -5; dz <= 5; dz++) {
      const distance = dx * dx + dz * dz;
      if (distance < best && isWalkable((gx + dx) * STEP, (gz + dz) * STEP, obstacles)) { best = distance; nearest = [gx + dx, gz + dz]; }
    }
    if (!nearest) return [];
    [gx, gz] = nearest;
  }
  const open = [{ x: sx, z: sz, g: 0, f: 0 }], visited = new Set(), parents = new Map(), costs = new Map([[key(sx, sz), 0]]);
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift(), id = key(current.x, current.z);
    if (visited.has(id)) continue;
    visited.add(id);
    if (current.x === gx && current.z === gz) {
      const path = []; let cursor = id;
      while (parents.has(cursor)) { const [x, z] = cursor.split(',').map(Number); path.unshift([x * STEP, z * STEP]); cursor = parents.get(cursor); }
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const x = current.x + dx, z = current.z + dz, next = key(x, z);
      if (!isWalkable(x * STEP, z * STEP, obstacles) || visited.has(next)) continue;
      if (dx && dz && (!isWalkable(x * STEP, current.z * STEP, obstacles) || !isWalkable(current.x * STEP, z * STEP, obstacles))) continue;
      const cost = current.g + Math.hypot(dx, dz);
      if (cost >= (costs.get(next) ?? Infinity)) continue;
      costs.set(next, cost); parents.set(next, id);
      open.push({ x, z, g: cost, f: cost + Math.hypot(gx - x, gz - z) });
    }
  }
  return [];
}

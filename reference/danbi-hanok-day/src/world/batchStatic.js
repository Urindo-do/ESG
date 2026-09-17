import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Architecture never moves and has no click handlers. Merge it by material to
// avoid one draw call per roof tile, lattice strip, stone, and blade of grass.
// Interactive furniture and Danbi deliberately keep their individual meshes.
export function batchStatic(root) {
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse(object => {
    if (!object.isMesh || Array.isArray(object.material)) return;
    if (!buckets.has(object.material)) buckets.set(object.material, []);
    buckets.get(object.material).push(object);
  });
  const inverseRoot = root.matrixWorld.clone().invert();
  for (const [material, objects] of buckets) {
    if (objects.length < 2) continue;
    const geometries = objects.map(object => {
      const geometry = object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
      const result = geometry.index ? geometry.toNonIndexed() : geometry;
      if (result !== geometry) geometry.dispose();
      return result;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    objects.forEach(object => { object.removeFromParent(); object.geometry.dispose(); });
    root.add(mesh);
  }
}

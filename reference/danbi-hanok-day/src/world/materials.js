import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const colors = {
  wood: '#a66d42', darkWood: '#72472e', paleWood: '#c99861', plaster: '#eee2c7',
  cream: '#f4e7cc', muzzle: '#fff3dc', blue: '#9fc9d5', yellow: '#efd27c',
  roof: '#586b6c', stone: '#a5a59b', grass: '#8eaa6e', pink: '#e5ad9a',
};
const cache = new Map();
export function material(color, roughness = 0.85) {
  const key = `${color}:${roughness}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness }));
  return cache.get(key);
}

// Seeded procedural textures keep the project self-contained and reproducible.
function texture(kind) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = kind === 'wood' ? '#c29162' : '#f2e8cc';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 39;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < (kind === 'wood' ? 150 : 3000); i++) {
    ctx.strokeStyle = kind === 'wood' ? `rgba(90,49,22,${rand() * 0.15})` : `rgba(134,107,63,${rand() * 0.1})`;
    const x = rand() * 256, y = rand() * 256;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(kind === 'wood' ? x + rand() * 6 : x + rand() * 4, kind === 'wood' ? y + 180 : y + 3);
    ctx.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return map;
}

export function makeMaterials() {
  return {
    wood: new THREE.MeshStandardMaterial({ map: texture('wood'), roughness: 0.82 }),
    paper: new THREE.MeshStandardMaterial({ map: texture('paper'), roughness: 1, transparent: true, opacity: 0.87, side: THREE.DoubleSide }),
  };
}

export function mesh(parent, geometry, mat, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, typeof mat === 'string' ? material(mat) : mat);
  object.position.set(...position);
  object.castShadow = object.receiveShadow = true;
  parent.add(object);
  return object;
}

export function box(parent, size, position, mat, radius = 0.035) {
  return mesh(parent, new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map(v => v / 3))), mat, position);
}
export function sphere(parent, size, position, mat) {
  const object = mesh(parent, new THREE.SphereGeometry(1, 20, 14), mat, position);
  object.scale.set(...size);
  return object;
}
export function cylinder(parent, top, bottom, height, position, mat, segments = 24) {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), mat, position);
}
export function group(parent, position = [0, 0, 0]) {
  const result = new THREE.Group(); result.position.set(...position); parent.add(result); return result;
}
export function label(parent, text, position, width = 0.9) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f6e9cc'; ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#94623e'; ctx.lineWidth = 12; ctx.strokeRect(10, 10, 492, 172);
  ctx.fillStyle = '#68472f'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 88px "Malgun Gothic", sans-serif'; ctx.fillText(text, 256, 99);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
  return mesh(parent, new THREE.PlaneGeometry(width, width * 192 / 512), new THREE.MeshBasicMaterial({ map }), position);
}

import * as THREE from 'three';
import { ISLAND_RADIUS, STREAM, streamX, distanceToPath, PATH, OIL_PUDDLES } from '../world/layout.js';

// 상태별 땅 색 (sRGB)
const GROUND_COLORS = {
  grassA: { default: '#86c05a', happy: '#74c64a', sad: '#9b9068' },
  grassB: { default: '#5f9f40', happy: '#4faa3a', sad: '#7d7358' },
  path: { default: '#e2c79a', happy: '#ebd3a6', sad: '#b8a888' },
  bank: { default: '#c9b98f', happy: '#cdbf95', sad: '#7c6b52' },
  soil: { default: '#8a603f', happy: '#8a603f', sad: '#6d5039' },
};

function heightAt(x, z) {
  const r = Math.hypot(x, z);
  let y = 0.05 * Math.sin(x * 0.7) * Math.cos(z * 0.6) + 0.04 * Math.sin(x * 1.9 + z * 1.3);
  // 흙길은 살짝 낮게
  const dp = distanceToPath(x, z);
  y -= 0.025 * (1 - Math.min(1, dp / (PATH.width * 0.7)));
  // 개울 물길
  const d = Math.abs(x - streamX(z));
  const outer = STREAM.halfWidth + STREAM.bank;
  if (d < outer) {
    const t = 1 - Math.max(0, Math.min(1, (d - STREAM.halfWidth * 0.35) / (outer - STREAM.halfWidth * 0.35)));
    y -= STREAM.depth * t * t * (3 - 2 * t);
  }
  // 섬 가장자리는 둥글게 떨어진다
  const edge = ISLAND_RADIUS - 0.9;
  if (r > edge) {
    const k = (r - edge) / 0.9;
    y = y * (1 - Math.min(1, k)) - 0.9 * k * k;
  }
  return y;
}

export function groundHeightAt(x, z) {
  return heightAt(x, z);
}

export function createGround() {
  const size = ISLAND_RADIUS * 2 + 0.2;
  const seg = 170;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const masks = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r > ISLAND_RADIUS) {
      x *= ISLAND_RADIUS / r;
      z *= ISLAND_RADIUS / r;
    }
    const y = heightAt(x, z);
    pos.setXYZ(i, x, y, z);
    const dp = distanceToPath(x, z);
    const d = Math.abs(x - streamX(z));
    masks[i * 3] = 1 - Math.min(1, Math.max(0, (dp - PATH.width * 0.35) / (PATH.width * 0.35)));
    masks[i * 3 + 1] = 1 - Math.min(1, Math.max(0, (d - STREAM.halfWidth) / STREAM.bank));
    masks[i * 3 + 2] = Math.min(1, Math.max(0, (r - (ISLAND_RADIUS - 0.75)) / 0.5));
  }
  geo.setAttribute('aMask', new THREE.BufferAttribute(masks, 3));
  geo.computeVertexNormals();

  const uniforms = {
    uGrassA: { value: new THREE.Color() },
    uGrassB: { value: new THREE.Color() },
    uPath: { value: new THREE.Color() },
    uBank: { value: new THREE.Color() },
    uSoil: { value: new THREE.Color() },
    uSad: { value: 0 },
    uHappy: { value: 0 },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aMask;\nvarying vec3 vMask;\nvarying vec2 vXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMask = aMask;\nvXZ = position.xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
        uniform vec3 uGrassA; uniform vec3 uGrassB; uniform vec3 uPath; uniform vec3 uBank; uniform vec3 uSoil;
        uniform float uSad; uniform float uHappy;
        varying vec3 vMask; varying vec2 vXZ;
        float gh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }
        float cells(vec2 p){
          vec2 i = floor(p); vec2 f = fract(p);
          float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(x, y);
            vec2 o = vec2(gh(i + g), gh(i + g + 7.3));
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
          }
          return d2 - d1;
        }`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
        {
          float n = gn(vXZ * 0.9) * 0.6 + gn(vXZ * 3.1) * 0.4;
          vec3 grass = mix(uGrassB, uGrassA, smoothstep(0.3, 0.7, n));
          grass *= 0.94 + 0.12 * gn(vXZ * 11.0);
          float pathM = smoothstep(0.25, 0.75, vMask.x + (gn(vXZ * 6.0) - 0.5) * 0.35);
          vec3 c = mix(grass, uPath * (0.95 + 0.08 * gn(vXZ * 9.0)), pathM);
          float bankM = smoothstep(0.15, 0.85, vMask.y + (gn(vXZ * 5.0) - 0.5) * 0.3);
          c = mix(c, uBank, bankM);
          // sad: 갈라진 땅
          float crack = 1.0 - smoothstep(0.0, 0.05, cells(vXZ * 1.6));
          float crack2 = 1.0 - smoothstep(0.0, 0.035, cells(vXZ * 4.3 + 3.0));
          float crackM = max(crack, crack2 * 0.6) * uSad * (1.0 - bankM) * smoothstep(0.35, 0.6, gn(vXZ * 0.45) + 0.2);
          c = mix(c, c * 0.45, crackM);
          c = mix(c, uSoil, vMask.z);
          diffuseColor.rgb = c;
        }`);
  };
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.name = 'ground';

  // 섬 옆면 흙층
  const skirtGeo = new THREE.CylinderGeometry(ISLAND_RADIUS - 0.05, ISLAND_RADIUS - 0.9, 1.9, 96, 3, true);
  skirtGeo.translate(0, -1.83, 0);
  const sPos = skirtGeo.attributes.position;
  const colors = new Float32Array(sPos.count * 3);
  const cTop = new THREE.Color('#7a5236');
  const cMid = new THREE.Color('#9b6d45');
  const cLow = new THREE.Color('#6b4a33');
  const tmp = new THREE.Color();
  for (let i = 0; i < sPos.count; i++) {
    const y = sPos.getY(i);
    const a = Math.atan2(sPos.getZ(i), sPos.getX(i));
    const band = 0.5 + 0.5 * Math.sin(y * 9 + Math.sin(a * 7) * 0.8);
    tmp.copy(y > -1.4 ? cTop : cLow).lerp(cMid, band * 0.6);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  skirtGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const skirt = new THREE.Mesh(skirtGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  skirt.name = 'island_skirt';
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_RADIUS - 0.9, 64), new THREE.MeshStandardMaterial({ color: '#5a3d29', roughness: 1 }));
  bottom.rotation.x = Math.PI / 2;
  bottom.position.y = -2.78;
  skirt.add(bottom);

  const group = new THREE.Group();
  group.add(mesh, skirt);

  const colorCache = {};
  for (const k of Object.keys(GROUND_COLORS)) {
    colorCache[k] = Object.fromEntries(Object.entries(GROUND_COLORS[k]).map(([m, v]) => [m, new THREE.Color(v)]));
  }
  const uniformKey = { grassA: 'uGrassA', grassB: 'uGrassB', path: 'uPath', bank: 'uBank', soil: 'uSoil' };
  function applyMood(w) {
    for (const k of Object.keys(colorCache)) {
      const u = uniforms[uniformKey[k]].value;
      u.setRGB(0, 0, 0);
      u.r = colorCache[k].default.r * w.default + colorCache[k].happy.r * w.happy + colorCache[k].sad.r * w.sad;
      u.g = colorCache[k].default.g * w.default + colorCache[k].happy.g * w.happy + colorCache[k].sad.g * w.sad;
      u.b = colorCache[k].default.b * w.default + colorCache[k].happy.b * w.happy + colorCache[k].sad.b * w.sad;
    }
    uniforms.uSad.value = w.sad;
    uniforms.uHappy.value = w.happy;
  }
  return { group, ground: mesh, applyMood };
}

// ── 개울 물 ──────────────────────────────────────────────────
export function createWater() {
  const segZ = 90;
  const segX = 6;
  const zMin = -ISLAND_RADIUS - 0.2;
  const zMax = ISLAND_RADIUS + 0.2;
  const verts = [];
  const uvs = [];
  const idx = [];
  const w = STREAM.halfWidth + 0.12;
  for (let j = 0; j <= segZ; j++) {
    const z = zMin + (zMax - zMin) * (j / segZ);
    const cx = streamX(z);
    for (let i = 0; i <= segX; i++) {
      const u = i / segX;
      const x = cx - w + 2 * w * u;
      const r = Math.hypot(x, z);
      let y = STREAM.waterY;
      if (r > ISLAND_RADIUS - 0.9) y = Math.min(y, heightAt(x, z) + 0.05);
      verts.push(x, y, z);
      uvs.push(u, z);
    }
  }
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * (segX + 1) + i;
      const b = a + segX + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#8fd6ee') },
      uDeep: { value: new THREE.Color('#3f9fcf') },
      uSad: { value: 0 },
      uHappy: { value: 0 },
    },
  ]);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    fog: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vPos;
      void main() {
        vUv = uv; vPos = position;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uSad; uniform float uHappy;
      varying vec2 vUv; varying vec3 vPos;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main() {
        float edge = abs(vUv.x - 0.5) * 2.0;
        vec2 flow = vec2(vPos.x * 1.3, vPos.z * 0.9 - uTime * 0.55);
        float r = n(flow * 2.2) * 0.6 + n(flow * 5.3 + 3.1) * 0.4;
        vec3 clean = mix(uDeep, uShallow, smoothstep(0.2, 1.0, edge) * 0.8 + r * 0.25);
        float glint = smoothstep(0.78, 0.9, n(flow * 7.0 + uTime * 0.3)) * (0.35 + 0.65 * uHappy);
        clean += vec3(glint);
        vec3 murky = mix(vec3(0.07, 0.055, 0.03), vec3(0.16, 0.12, 0.06), r);
        // 기름막 무지개
        float sheen = smoothstep(0.55, 0.75, n(vPos.xz * 0.9 + uTime * 0.05));
        vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * (r + vec3(0.0, 0.33, 0.67)));
        murky = mix(murky, murky + rainbow * 0.05, sheen * 0.7);
        vec3 col = mix(clean, murky, uSad);
        float foam = smoothstep(0.82, 1.0, edge) * (0.25 + 0.2 * r) * (1.0 - uSad);
        col += foam;
        float alpha = mix(0.82, 0.94, uSad) * smoothstep(1.0, 0.9, edge);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'stream';
  mesh.renderOrder = 1;
  mesh.userData.click = 'stream';
  const cShallow = { default: new THREE.Color('#8fd6ee'), happy: new THREE.Color('#9fe6f5') };
  const cDeep = { default: new THREE.Color('#3f9fcf'), happy: new THREE.Color('#2fa9d8') };
  function applyMood(w, time) {
    uniforms.uTime.value = time;
    uniforms.uSad.value = w.sad;
    uniforms.uHappy.value = w.happy;
    const k = w.happy / Math.max(1e-3, w.happy + w.default);
    uniforms.uShallow.value.copy(cShallow.default).lerp(cShallow.happy, k);
    uniforms.uDeep.value.copy(cDeep.default).lerp(cDeep.happy, k);
  }
  return { mesh, applyMood };
}

// ── 기름 웅덩이 (sad) ─────────────────────────────────────────
export function createPuddles() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#1c1712', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0 });
  for (const p of OIL_PUDDLES) {
    const shape = new THREE.Shape();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = p.r * (0.8 + 0.25 * Math.sin(a * 3 + p.pos[0]));
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr * 0.75;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.pos[0], heightAt(p.pos[0], p.pos[1]) + 0.02, p.pos[1]);
    m.receiveShadow = true;
    group.add(m);
  }
  function applyMood(w) {
    mat.opacity = w.sad * 0.92;
    group.visible = w.sad > 0.01;
  }
  return { group, applyMood };
}

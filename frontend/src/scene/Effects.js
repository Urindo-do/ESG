import * as THREE from 'three';
import { ISLAND_RADIUS, FACTORIES } from '../world/layout.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const POINT_VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  uniform float uScale;
  uniform float uMode;
  uniform vec3 uDrift;
  uniform float uHeight;
  varying float vSeed;
  varying float vTw;
  void main() {
    vec3 p = position;
    float t = uTime + aSeed * 50.0;
    if (uMode < 0.5) {            // 떠다님 (반딧불, 먼지)
      p += vec3(sin(t * 0.37 + aSeed * 9.0), sin(t * 0.53 + aSeed * 3.0) * 0.6, cos(t * 0.31 + aSeed * 5.0)) * 0.45;
    } else if (uMode < 1.5) {     // 떨어짐 (나뭇잎)
      float fall = mod(t * 0.35 + aSeed * uHeight, uHeight);
      p.y = uHeight + 0.3 - fall;
      p.x += sin(t * 1.3 + aSeed * 7.0) * 0.35;
      p.z += cos(t * 0.9 + aSeed * 4.0) * 0.25;
    } else {                      // 올라감 (연기)
      float rise = mod(t * 0.18 + aSeed * 3.0, 3.0);
      p.y += rise * 2.2;
      p.x += rise * 0.9 + sin(t + aSeed * 6.0) * 0.2;
      vTw = rise / 3.0;
    }
    vSeed = aSeed;
    if (uMode < 1.5) vTw = 0.5 + 0.5 * sin(t * 2.6 + aSeed * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
  }`;

const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uColor2;
  uniform float uOpacity;
  uniform float uMode;
  uniform float uShape;
  varying float vSeed;
  varying float vTw;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a;
    if (uShape < 0.5) {
      a = smoothstep(0.5, 0.0, d);            // 부드러운 원
      a *= a;
    } else if (uShape < 1.5) {
      // 잎사귀 모양
      vec2 q = vec2(c.x * cos(vSeed * 6.0) - c.y * sin(vSeed * 6.0), c.x * sin(vSeed * 6.0) + c.y * cos(vSeed * 6.0));
      a = 1.0 - smoothstep(0.18, 0.24, length(q * vec2(1.0, 2.2)));
    } else {
      // 별 모양 반짝이
      float star = max(1.0 - smoothstep(0.0, 0.06, abs(c.x)) , 1.0 - smoothstep(0.0, 0.06, abs(c.y))) * smoothstep(0.5, 0.0, d);
      a = max(star, smoothstep(0.18, 0.0, d));
    }
    vec3 col = mix(uColor, uColor2, fract(vSeed * 7.13));
    float tw = uMode > 1.5 ? (1.0 - vTw) * smoothstep(0.0, 0.15, vTw) : (0.45 + 0.55 * vTw);
    gl_FragColor = vec4(col, a * uOpacity * tw);
    if (gl_FragColor.a < 0.003) discard;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function makePoints({ count, seed, spread, yMin, yMax, color, color2, size, mode = 0, shape = 0, blending = THREE.AdditiveBlending, center = [0, 0, 0], height = 4 }) {
  const rnd = seeded(seed);
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * spread;
    pos[i * 3] = center[0] + Math.cos(a) * r;
    pos[i * 3 + 1] = center[1] + yMin + rnd() * (yMax - yMin);
    pos[i * 3 + 2] = center[2] + Math.sin(a) * r;
    seeds[i] = rnd();
    sizes[i] = size * (0.6 + rnd() * 0.8);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(...center), spread + yMax + 6);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 300 },
      uColor: { value: new THREE.Color(color) },
      uColor2: { value: new THREE.Color(color2 || color) },
      uOpacity: { value: 0 },
      uMode: { value: mode },
      uShape: { value: shape },
      uDrift: { value: new THREE.Vector3() },
      uHeight: { value: height },
    },
    vertexShader: POINT_VERT,
    fragmentShader: POINT_FRAG,
    transparent: true,
    depthWrite: false,
    blending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

export function createEffects() {
  const group = new THREE.Group();
  group.name = 'effects';
  const fireflies = makePoints({ count: 70, seed: 3, spread: ISLAND_RADIUS - 1, yMin: 0.3, yMax: 2.8, color: '#fff3a0', color2: '#d9ff9a', size: 0.09 });
  const sparkles = makePoints({ count: 50, seed: 9, spread: ISLAND_RADIUS - 1.5, yMin: 0.2, yMax: 3.5, color: '#ffffff', color2: '#fff0b0', size: 0.13, shape: 2 });
  const dust = makePoints({ count: 180, seed: 5, spread: ISLAND_RADIUS + 2, yMin: 0.2, yMax: 5, color: '#6d5a3e', color2: '#9a8660', size: 0.07, blending: THREE.NormalBlending });
  const leaves = makePoints({ count: 34, seed: 11, spread: ISLAND_RADIUS - 1, yMin: 0, yMax: 0.1, color: '#7cc24d', color2: '#b6dc5a', size: 0.17, mode: 1, shape: 1, blending: THREE.NormalBlending, height: 5 });
  const smokes = FACTORIES.map((f, i) => {
    const s = makePoints({ count: 40, seed: 20 + i, spread: 0.6 * f.scale, yMin: 0, yMax: 0.2, color: '#5d554b', color2: '#8a8174', size: 1.5 * f.scale, mode: 2, blending: THREE.NormalBlending, center: [f.pos[0], 4.2 * f.scale, f.pos[1]] });
    return s;
  });
  group.add(fireflies, sparkles, dust, leaves, ...smokes);

  // 빛줄기 (happy)
  const rayCanvas = document.createElement('canvas');
  rayCanvas.width = 64;
  rayCanvas.height = 256;
  const g = rayCanvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, 'rgba(255,248,210,0.9)');
  grad.addColorStop(1, 'rgba(255,248,210,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,1)');
  side.addColorStop(0.5, 'rgba(0,0,0,0)');
  side.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = side;
  g.fillRect(0, 0, 64, 256);
  const rayTex = new THREE.CanvasTexture(rayCanvas);
  rayTex.colorSpace = THREE.SRGBColorSpace;
  const rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const rays = new THREE.Group();
  const rnd = seeded(42);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2 + rnd() * 1.4, 11), rayMat);
    m.position.set(-2 + i * 1.8 + rnd(), 4.2, -3.5 + rnd() * 3);
    m.rotation.z = 0.42;
    m.userData.phase = rnd() * 6;
    rays.add(m);
  }
  group.add(rays);

  // 나비
  const wingCanvas = document.createElement('canvas');
  wingCanvas.width = wingCanvas.height = 64;
  const wg = wingCanvas.getContext('2d');
  wg.fillStyle = '#ffffff';
  wg.beginPath();
  wg.ellipse(30, 22, 26, 18, -0.3, 0, Math.PI * 2);
  wg.ellipse(24, 46, 16, 13, 0.4, 0, Math.PI * 2);
  wg.fill();
  const wingTex = new THREE.CanvasTexture(wingCanvas);
  const butterflies = [];
  const bColors = ['#ffd166', '#f4a3c7', '#9ad0ff', '#ffffff'];
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ map: wingTex, color: bColors[i % bColors.length], transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), mat);
      wing.position.x = 0.08 * s;
      wing.scale.x = s;
      wing.rotation.x = -Math.PI / 2;
      pivot.add(wing);
      b.add(pivot);
    }
    b.userData = { phase: i * 1.7, center: [[-4.3, 3.6], [-3.0, -0.2], [0.6, 3.2], [5.9, 2.8], [-5.5, 0.6]][i], r: 0.8 + i * 0.15 };
    butterflies.push(b);
    group.add(b);
  }

  // 정화 효과 (celebrate)
  const burst = makePoints({ count: 60, seed: 77, spread: 0.1, yMin: 0, yMax: 0.1, color: '#fff7b0', color2: '#b9ff9c', size: 0.2, shape: 2 });
  const burstDirs = [];
  const brnd = seeded(8);
  for (let i = 0; i < 60; i++) {
    const a = brnd() * Math.PI * 2;
    burstDirs.push(new THREE.Vector3(Math.cos(a) * (0.6 + brnd()), 1.2 + brnd() * 1.6, Math.sin(a) * (0.6 + brnd())));
  }
  burst.visible = false;
  group.add(burst);
  let burstT = -1;
  const burstOrigin = new THREE.Vector3();

  function startBurst(pos) {
    burstOrigin.copy(pos);
    burstT = 0;
    burst.visible = true;
  }

  function update(dt, time, w, camera, pixelScale) {
    for (const p of [fireflies, sparkles, dust, leaves, ...smokes, burst]) {
      p.material.uniforms.uTime.value = time;
      p.material.uniforms.uScale.value = pixelScale;
    }
    fireflies.material.uniforms.uOpacity.value = w.happy;
    fireflies.visible = w.happy > 0.01;
    sparkles.material.uniforms.uOpacity.value = w.happy * 0.9;
    sparkles.visible = w.happy > 0.01;
    dust.material.uniforms.uOpacity.value = w.sad * 0.8;
    dust.visible = w.sad > 0.01;
    for (const s of smokes) {
      s.material.uniforms.uOpacity.value = w.sad * 0.7;
      s.visible = w.sad > 0.02;
    }
    leaves.material.uniforms.uOpacity.value = 0.9;
    leaves.material.uniforms.uColor.value.set(w.sad > 0.5 ? '#8a6a3a' : '#7cc24d');
    leaves.material.uniforms.uColor2.value.set(w.sad > 0.5 ? '#6b5334' : '#b6dc5a');

    rayMat.opacity = w.happy * 0.28;
    rays.visible = w.happy > 0.01;
    rays.children.forEach(m => {
      m.material.opacity = w.happy * 0.28;
      m.scale.x = 0.85 + 0.2 * Math.sin(time * 0.6 + m.userData.phase);
    });
    const camY = Math.atan2(camera.position.x, camera.position.z);
    rays.rotation.y = camY;

    const bScale = Math.max(0, 1 - w.sad * 1.2);
    butterflies.forEach((b, i) => {
      const { phase, center, r } = b.userData;
      const t = time * 0.6 + phase;
      b.position.set(center[0] + Math.cos(t) * r, 0.7 + Math.sin(t * 2.3) * 0.25 + i * 0.08, center[1] + Math.sin(t * 1.3) * r * 0.7);
      b.rotation.y = -t + Math.PI / 2;
      const flap = Math.sin(time * 18 + phase) * 0.9;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
      b.scale.setScalar(bScale * (i < 3 ? 1 : w.happy));
      b.visible = b.scale.x > 0.01;
    });

    if (burstT >= 0) {
      burstT += dt;
      const k = burstT / 1.4;
      const pos = burst.geometry.attributes.position;
      for (let i = 0; i < burstDirs.length; i++) {
        const d = burstDirs[i];
        pos.setXYZ(i, burstOrigin.x + d.x * k * 1.2, burstOrigin.y + 0.5 + d.y * k - 1.2 * k * k, burstOrigin.z + d.z * k * 1.2);
      }
      pos.needsUpdate = true;
      burst.material.uniforms.uOpacity.value = Math.max(0, 1 - k);
      if (k >= 1) {
        burstT = -1;
        burst.visible = false;
      }
    }
  }

  return { group, update, startBurst };
}

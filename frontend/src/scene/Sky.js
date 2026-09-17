import * as THREE from 'three';

// 상태별 하늘·안개·조명 색 (sRGB 16진수). 수정은 여기서.
export const SKY_PRESETS = {
  default: {
    top: '#7fc3ee', horizon: '#e4f4fb', sun: '#fff6dc', fog: '#dcefe9', fogNear: 26, fogFar: 70,
    hemiSky: '#fff4dc', hemiGround: '#7f9f68', hemi: 1.55, sunColor: '#fff0d2', sunI: 2.9,
  },
  happy: {
    top: '#6fbde6', horizon: '#fff1c4', sun: '#ffe7a3', fog: '#f1ecc8', fogNear: 24, fogFar: 72,
    hemiSky: '#fff0cc', hemiGround: '#88ad5f', hemi: 1.7, sunColor: '#ffe0a0', sunI: 3.3,
  },
  sad: {
    top: '#7d6d4c', horizon: '#cdb67c', sun: '#e8cf8d', fog: '#b09c6a', fogNear: 14, fogFar: 58,
    hemiSky: '#d8c69a', hemiGround: '#6f6450', hemi: 1.3, sunColor: '#d8bd80', sunI: 1.9,
  },
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpC = new THREE.Color();

export function mixColor(target, key, w) {
  tmpA.set(SKY_PRESETS.default[key]).multiplyScalar(w.default);
  tmpB.set(SKY_PRESETS.happy[key]).multiplyScalar(w.happy);
  tmpC.set(SKY_PRESETS.sad[key]).multiplyScalar(w.sad);
  return target.copy(tmpA).add(tmpB).add(tmpC);
}

export function mixNumber(key, w) {
  return SKY_PRESETS.default[key] * w.default + SKY_PRESETS.happy[key] * w.happy + SKY_PRESETS.sad[key] * w.sad;
}

export function createSky() {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSun: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(-0.35, 0.55, -0.75).normalize() },
    uSmog: { value: 0 },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir;
      uniform float uSmog; uniform float uTime;
      varying vec3 vDir;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
      float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
      void main() {
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
        float s = max(dot(normalize(vDir), uSunDir), 0.0);
        col += uSun * (pow(s, 64.0) * 0.8 + pow(s, 6.0) * 0.18);
        // 스모그 띠
        vec2 q = vec2(atan(vDir.z, vDir.x) * 3.0 + uTime * 0.02, h * 6.0);
        float smog = n2(q * 2.0) * 0.6 + n2(q * 5.0) * 0.4;
        col = mix(col, vec3(0.42, 0.36, 0.25), uSmog * smoothstep(0.35, 0.8, smog) * (1.0 - smoothstep(0.05, 0.6, h)) * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), material);
  mesh.name = 'sky';
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

// 먼지(uDirt)·시듦(uWither) 셰이더 패치.
// 모델의 휴지 자세 좌표(position)로 노이즈를 만들어 얼룩이 몸에 붙어 움직이게 한다.

const NOISE = /* glsl */ `
uniform float uDirt;
uniform float uWither;
varying vec3 vGrimePos;
float gHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float gNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x),
                 mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x),
                 mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gFbm(vec3 p) {
  return 0.55 * gNoise(p) + 0.3 * gNoise(p * 2.31) + 0.15 * gNoise(p * 5.13);
}
`;

const APPLY = /* glsl */ `
{
  vec3 gp = vGrimePos * GRIME_SCALE;
  float n = gFbm(gp);
  float spots = smoothstep(0.68 - 0.12 * uDirt, 0.75 - 0.12 * uDirt, n) * uDirt;
  float streak = smoothstep(0.62, 0.76, gFbm(gp * vec3(2.2, 0.35, 2.2) + 7.0)) * uDirt;
  float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum) * vec3(0.93, 0.9, 0.84), uDirt * 0.3);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.13, 0.12, 0.11), clamp(spots * 0.75 + streak * 0.3, 0.0, 0.75));
  #ifdef GRIME_LEAF
    float l2 = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    vec3 dry = vec3(l2) * vec3(1.35, 0.98, 0.42) + vec3(0.03, 0.018, 0.0);
    float patchy = gFbm(gp * 0.6 + 3.0);
    diffuseColor.rgb = mix(diffuseColor.rgb, dry, uWither * (0.5 + 0.5 * patchy));
    float holes = smoothstep(0.7, 0.76, gFbm(gp * 1.6 + 11.0)) * uWither;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.06, 0.03), holes * 0.8);
  #endif
}
`;

/**
 * @param {THREE.Material} material MeshStandardMaterial
 * @param {{uDirt:{value:number}, uWither:{value:number}}} uniforms 공유 유니폼
 * @param {{leaf?:boolean, scale?:number}} opts
 */
export function patchGrime(material, uniforms, { leaf = false, scale = 14 } = {}) {
  material.defines = { ...(material.defines || {}), GRIME_SCALE: scale.toFixed(2) };
  if (leaf) material.defines.GRIME_LEAF = '';
  material.onBeforeCompile = shader => {
    shader.uniforms.uDirt = uniforms.uDirt;
    shader.uniforms.uWither = uniforms.uWither;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrimePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrimePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${APPLY}`);
  };
  material.customProgramCacheKey = () => `grime-${leaf ? 'leaf' : 'body'}-${scale}`;
  material.needsUpdate = true;
  return material;
}

export function grimeUniforms() {
  return { uDirt: { value: 0 }, uWither: { value: 0 } };
}

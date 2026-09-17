// 환경이 마을 설정 — 숫자는 이 파일 한 곳에서만 바꾼다.
// 기획서 7장 점수 규칙과 함께 바꿔야 하는 값에는 표시를 해 두었다.

export const MOOD_THRESHOLDS = {
  happy: 70, // 이 점수 이상이면 happy (기획서와 함께 수정)
  sad: 30,   // 이 점수 미만이면 sad (기획서와 함께 수정)
};

export const MOOD_LABELS = {
  happy: '반짝반짝',
  default: '보통',
  sad: '꼬질꼬질',
};

// 상태가 바뀔 때 화면이 넘어가는 시간(초)
export const TRANSITION_SECONDS = 1.6;

// 점수에 따라 연속으로 변하는 먼지·시듦 정도 (점수 → 0~1)
// dirt: DIRT_START 이하부터 묻기 시작해 DIRT_FULL에서 최대
export const DIRT_START = 55;
export const DIRT_FULL = 10;
export const WITHER_START = 40;
export const WITHER_FULL = 10;

export const ASSET_URLS = {
  character: 'models/hwangyeongi.glb',
  village: 'models/village.glb',
  faces: {
    default: 'textures/face_default.webp',
    blink: 'textures/face_blink.webp',
    happy: 'textures/face_happy.webp',
    sad: 'textures/face_sad.webp',
    sadBlink: 'textures/face_sad_blink.webp',
    sleep: 'textures/face_sleep.webp',
  },
};

export const MISSIONS = [
  { id: 'meal', label: '빈 그릇 인증', short: '빈 그릇', icon: '🍚' },
  { id: 'product', label: '친환경 제품 인증', short: '친환경 제품', icon: '🛒' },
  { id: 'phrase', label: '환경 문구 찾기', short: '환경 문구', icon: '🔍' },
];

export const RENDER = {
  maxPixelRatio: 2,
  shadowMapSize: 1024,
};

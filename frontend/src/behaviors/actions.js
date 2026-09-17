import { PLACEMENTS, TRASH, streamX } from '../world/layout.js';

const bench = PLACEMENTS.find(p => p.id === 'bench');
const bins = PLACEMENTS.find(p => p.id === 'bins');
const CAMERA = [0.6, 14];

// moods: 자동 행동에서 고를 수 있는 상태. 클릭으로 부르면 상태와 상관없이 실행된다.
// tool: 손에 드는 소품, faceOverride: 표정 강제, seat: 앉을 자리, next: 이어지는 행동
export const ACTIONS = [
  {
    id: 'water', label: '물 주기', clip: 'water', tool: 'can', moods: ['default', 'happy'],
    target: [-0.95, -0.9], face: [-0.95, -1.9], duration: 6,
    thought: { default: '쑥쑥 자라라!', happy: '새싹들이 반짝반짝!', sad: '물도 탁해졌어…' },
  },
  {
    id: 'plant', label: '씨앗 심기', clip: 'plant', tool: 'trowel', moods: ['default', 'happy'],
    target: [0.5, -0.9], face: [0.5, -1.9], duration: 6,
    thought: { default: '여기에 새싹 하나!', happy: '꽃밭을 더 넓혀야지!', sad: '흙이 너무 말랐어…' },
  },
  {
    id: 'sweep', label: '낙엽 쓸기', clip: 'sweep', tool: 'broom', moods: ['default'],
    target: [-1.15, 2.7], face: [-0.2, 3.9], duration: 6,
    thought: { default: '길을 깨끗하게~', happy: '쓱싹쓱싹!', sad: '쓸어도 쓸어도 끝이 없어…' },
  },
  {
    id: 'butterfly', label: '나비 구경', clip: 'look', moods: ['default', 'happy'],
    target: [-3.3, 3.1], face: [-4.6, 3.9], duration: 6,
    thought: { default: '나비야, 어디 가?', happy: '반딧불이도 놀러 왔네!', sad: '나비가 안 보여…' },
  },
  {
    id: 'stroll', label: '개울가 산책', clip: 'look', moods: ['default', 'happy'],
    target: [2.75, 2.7], face: [streamX(2.7), 2.7], duration: 5, via: [[1.2, 3.6]],
    thought: { default: '물소리가 좋아.', happy: '물고기다! 안녕!', sad: '물이 너무 탁해…' },
  },
  {
    id: 'nap', label: '벤치에서 낮잠', clip: 'sleep', moods: ['default'], faceOverride: 'sleep',
    target: [bench.pos[0] + 0.45, bench.pos[1] + 0.75], face: [bench.pos[0] + 1.2, bench.pos[1] + 2.3], duration: 12,
    seat: { pos: [bench.pos[0] + 0.02, bench.pos[1] + 0.03], y: 0.46 },
    thought: { default: '나무 그늘 아래서… 쿨쿨.', happy: '행복한 꿈을 꿔야지…', sad: '잠도 안 와…' },
  },
  {
    id: 'stretch', label: '기지개 켜기', clip: 'stretch', moods: ['default', 'happy'],
    target: [-2.85, -0.75], face: CAMERA, duration: 2,
    thought: { default: '으쌰, 상쾌해!', happy: '오늘도 힘내자!', sad: '몸이 무거워…' },
  },
  {
    id: 'wave', label: '손 흔들기', clip: 'wave', moods: ['default', 'happy'],
    target: [-0.3, 3.3], face: CAMERA, duration: 4,
    thought: { default: '안녕! 오늘도 같이 실천하자!', happy: '고마워! 마을이 반짝반짝해!', sad: '도와줄래…?' },
  },
  {
    id: 'mail', label: '우편함 보기', clip: 'look', moods: ['default', 'happy'],
    target: [-1.55, 0.6], face: [-1.95, -0.05], duration: 4,
    thought: { default: '편지가 왔을까?', happy: '응원 편지가 가득!', sad: '텅 비었네…' },
  },
  {
    id: 'bins', label: '분리수거함 살피기', clip: 'look', moods: ['default', 'happy'],
    target: [0.75, 1.35], face: [bins.pos[0], bins.pos[1]], duration: 4,
    thought: { default: '종이, 플라스틱, 캔!', happy: '분리수거 완벽해!', sad: '분리수거함이 넘쳐…' },
  },
  {
    id: 'dance', label: '신나서 폴짝', clip: 'happy_idle', moods: ['happy'],
    target: [0.3, 2.0], face: CAMERA, duration: 5,
    thought: { default: '랄랄라~', happy: '반짝반짝 기분 최고!', sad: '…' },
  },
  {
    id: 'jump', label: '점프', clip: 'jump', moods: ['happy'],
    target: [0.95, 2.9], face: CAMERA, duration: 3.2,
    thought: { default: '폴짝!', happy: '폴짝! 마을이 살아났어!', sad: '…' },
  },
  {
    id: 'sulk', label: '시무룩하게 앉기', clip: 'sit_sad', moods: ['sad'],
    target: [-1.0, 1.0], face: CAMERA, duration: 9,
    thought: { default: '조금 쉬어야지.', happy: '조금 쉬어야지.', sad: '마을이 너무 지저분해…' },
  },
  {
    id: 'shake', label: '먼지 털기', clip: 'shake', moods: ['sad'],
    target: [0.25, 1.7], face: CAMERA, duration: 2,
    thought: { default: '부르르!', happy: '부르르!', sad: '에취! 먼지가 너무 많아.' },
  },
  {
    id: 'pickup', label: '쓰레기 줍기', clip: 'pickup', moods: ['sad'], dynamicTarget: 'trash',
    target: [0.4, 2.6], face: [0.4, 2.6], duration: 1.67, next: 'hesitate',
    thought: { default: '쓰레기 발견!', happy: '쓰레기 발견!', sad: '이건 어디에 버리지?' },
  },
  {
    id: 'hesitate', label: '멈칫', clip: 'sad_idle', moods: [], dynamicTarget: 'towardBins',
    target: [0.6, 1.5], face: [bins.pos[0], bins.pos[1]], duration: 3.5,
    thought: { default: '어디 보자…', happy: '어디 보자…', sad: '혼자서는 역부족이야… 도와줄래?' },
  },
  {
    id: 'mope', label: '터덜터덜', clip: 'sad_idle', moods: ['sad'],
    target: [2.3, 2.3], face: [streamX(2.3), 2.3], duration: 5,
    thought: { default: '…', happy: '…', sad: '다시 반짝이고 싶어.' },
  },
];

export const actionById = Object.fromEntries(ACTIONS.map(a => [a.id, a]));

// 3D 오브젝트 클릭 → 행동
export const CLICK_ACTIONS = {
  can: 'water',
  garden: 'plant',
  trowel: 'plant',
  broom: 'sweep',
  bench: 'nap',
  stream: 'stroll',
  sign: 'wave',
  house: 'stretch',
  mailbox: 'mail',
  bins: 'bins',
  trash: 'pickup',
};

export function actionsForMood(mood) {
  return ACTIONS.filter(a => a.moods.includes(mood));
}

export function nearestTrash(x, z) {
  let best = TRASH[0];
  let bd = Infinity;
  for (const t of TRASH) {
    if (t.y !== undefined) continue; // 물속 쓰레기는 제외
    const d = Math.hypot(t.pos[0] - x, t.pos[1] - z);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

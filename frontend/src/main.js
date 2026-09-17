// 개발용 실행 파일: 가짜 점수·가짜 인증으로 3D 화면을 확인한다.
// 실제 앱에서는 이 파일 대신 Supabase 결과를 받아 village API를 호출한다.
import { createVillage } from './village.js';

const params = new URLSearchParams(location.search);
const dev = import.meta.env.DEV || params.has('dev');
const startScore = params.has('score') ? Number(params.get('score')) : 62;

let score = startScore;
const remaining = { meal: 3, product: 2, phrase: 10 };
const POINTS = { meal: 10, product: 10, phrase: 1 };

const village = createVillage(document.querySelector('#app'), {
  initialScore: score,
  remaining,
  dev,
  onDevScore: s => { score = s; },
});

// 가짜 인증: 버튼을 누르면 0.8초 뒤 성공 처리
village.onMissionSelect(async kind => {
  if (remaining[kind] <= 0) return;
  await new Promise(r => setTimeout(r, 800));
  remaining[kind] -= 1;
  score = Math.min(100, score + POINTS[kind]);
  village.setRemaining(remaining);
  village.setCleanliness(score);
  village.celebrate(POINTS[kind]);
});

if (params.has('action')) {
  village.ready.then(() => {
    window.__village = village;
  });
}
window.__village = village;

if (import.meta.hot) {
  import.meta.hot.dispose(() => village.dispose());
}

// 홈 화면 — 환경이 마을을 띄우고 내 점수를 보여준다 (로그인 계정 또는 게스트)
import { supabase } from '../supabase.js';
import { createVillage } from '../../village.js';

// 연결명세 §1 점수 규칙 상수와 같은 값 — 게스트는 DB가 없어 여기서만 흉내낸다
const GUEST_POINTS = { meal: 10, product: 10, phrase: 1 };

/**
 * @param {HTMLElement} root
 * @param {{ session?: import('@supabase/supabase-js').Session|null, onLoginRequest?: () => void }} [options]
 * @returns {Promise<() => void>} 정리(dispose) 함수
 */
export async function renderHome(root, { session = null, onLoginRequest } = {}) {
  root.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'home-wrap';
  const villageHost = document.createElement('div');
  villageHost.className = 'home-village';
  wrap.append(villageHost);

  const isGuest = !session;
  let initialScore = 50;
  let guestScore = 50; // 새로고침하면 50으로 초기화 — 저장하지 않는다

  if (session) {
    const bar = document.createElement('div');
    bar.className = 'home-topbar';
    const nicknameEl = document.createElement('span');
    nicknameEl.className = 'home-nickname';
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'home-logout';
    logoutBtn.textContent = '로그아웃';
    logoutBtn.onclick = () => supabase.auth.signOut();
    bar.append(nicknameEl, logoutBtn);
    wrap.append(bar);

    // Google 계정의 이름·프로필 사진은 쓰지 않는다 — profiles.nickname만 쓴다 (연결명세 §2-6)
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nickname, score')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('프로필을 불러오지 못했어요:', error);
    }
    nicknameEl.textContent = profile?.nickname ?? '새싹';
    initialScore = profile?.score ?? 50;
  } else {
    const banner = document.createElement('div');
    banner.className = 'home-guest-banner';
    const text = document.createElement('span');
    text.textContent = '둘러보는 중이에요 · 점수를 자유롭게 눌러볼 수 있어요 (로그인하면 진짜로 저장돼요)';
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.className = 'home-login-request';
    loginBtn.textContent = '로그인하기';
    loginBtn.onclick = () => onLoginRequest?.();
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'home-guest-reset';
    resetBtn.textContent = '50으로 초기화';
    resetBtn.onclick = () => {
      guestScore = 50;
      village.setCleanliness(guestScore);
    };
    banner.append(text, loginBtn, resetBtn);
    wrap.append(banner);
  }

  root.append(wrap);

  const village = createVillage(villageHost, {
    initialScore,
    // 임시: S11에서 get-status로 교체 (오늘 남은 인증 횟수)
    remaining: { meal: 3, product: 2, phrase: 10 },
    // MVP 시연용 — 화면 미리보기 패널을 로그인·게스트 양쪽에서 켠다 (village.js/UI.js에 이미 있던 기능)
    dev: true,
  });

  village.onMissionSelect(missionId => {
    if (isGuest) {
      const points = GUEST_POINTS[missionId] ?? 0;
      guestScore = Math.min(100, Math.max(0, guestScore + points));
      village.setCleanliness(guestScore);
      village.celebrate(points);
      return;
    }
    // 임시: S4에서 촬영 화면으로 교체
    alert('곧 열려요! 조금만 기다려 주세요.');
  });

  return () => village.dispose();
}

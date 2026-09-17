// 앱 시작 — 로그인 상태 / 게스트 둘러보기 / 로그인 화면을 전환한다
import './app/app.css';
import { supabase } from './app/supabase.js';
import { renderLogin } from './app/screens/login.js';
import { renderHome } from './app/screens/home.js';

const root = document.querySelector('#app');

// null과 절대 같아질 수 없는 값으로 시작해야 로그인 안 된 첫 실행에서도 화면이 그려진다
// (9/18에 고친 문제: 초기값이 null이면 첫 INITIAL_SESSION(session=null) 이벤트가 "같은 상태"로 보여 아무것도 안 그려짐)
let currentUserId = Symbol('초기값');
let disposeCurrent = null;
let guestMode = false; // 게스트 모드는 새로고침하면 풀린다 (저장하지 않음)

function showLogin() {
  guestMode = false;
  disposeCurrent?.();
  disposeCurrent = null;
  renderLogin(root, {
    onGuestMode: () => {
      guestMode = true;
      disposeCurrent?.();
      disposeCurrent = null;
      renderHome(root, { session: null, onLoginRequest: showLogin }).then(dispose => {
        disposeCurrent = dispose;
      });
    },
  });
}

supabase.auth.onAuthStateChange((_event, session) => {
  const userId = session?.user?.id ?? null;
  if (guestMode && !userId) return; // 게스트로 둘러보는 중에는 "로그인 없음" 상태를 다시 그리지 않음
  if (userId === currentUserId) return; // 같은 사용자면 다시 그리지 않음 (토큰 갱신 등)
  currentUserId = userId;
  guestMode = false;

  disposeCurrent?.();
  disposeCurrent = null;

  if (session) {
    renderHome(root, { session }).then(dispose => {
      disposeCurrent = dispose;
    });
  } else {
    showLogin();
  }
});

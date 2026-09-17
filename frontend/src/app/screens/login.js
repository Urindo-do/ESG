// 로그인 화면 — Google 기본, 이메일은 테스트용, 게스트 둘러보기
import { supabase } from '../supabase.js';

const ERROR_CODE_MESSAGES = {
  email_address_invalid: '쓸 수 없는 이메일 주소예요.',
  email_address_not_authorized: '지금은 이 이메일로 가입할 수 없어요.',
};

function friendlyAuthError(err) {
  const code = err?.code;
  if (code && ERROR_CODE_MESSAGES[code]) return ERROR_CODE_MESSAGES[code];
  console.error('로그인 오류:', err);
  return code ? `문제가 생겼어요. (${code})` : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
}

/** Google 리디렉션 주소에 error/error_description이 있으면 안내 문구를 만들고 주소창에서 지운다 */
function readAndClearOAuthError() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const error = search.get('error') || hash.get('error');
  const description = search.get('error_description') || hash.get('error_description');
  if (!error) return null;

  console.error('Google 로그인 오류:', error, description);

  ['error', 'error_description', 'error_code'].forEach(key => {
    search.delete(key);
    hash.delete(key);
  });
  const newSearch = search.toString();
  const newHash = hash.toString();
  const url = window.location.pathname + (newSearch ? `?${newSearch}` : '') + (newHash ? `#${newHash}` : '');
  window.history.replaceState(null, '', url);

  return `Google 로그인에 실패했어요. (${error})`;
}

/**
 * @param {HTMLElement} root
 * @param {{ onGuestMode?: () => void }} [options]
 */
export function renderLogin(root, { onGuestMode } = {}) {
  root.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'auth-wrap';
  wrap.innerHTML = `
    <div class="auth-card">
      <h1>환경이 마을</h1>

      <button type="button" class="auth-google">
        <span class="auth-google-icon" aria-hidden="true">G</span>
        Google로 시작하기
      </button>

      <p class="auth-error" role="alert" hidden></p>

      <details class="auth-email-details">
        <summary>이메일로 로그인 (테스트용)</summary>
        <div class="auth-tabs" role="tablist">
          <button type="button" class="auth-tab active" data-mode="login" role="tab">로그인</button>
          <button type="button" class="auth-tab" data-mode="signup" role="tab">회원가입</button>
        </div>
        <form class="auth-form" novalidate>
          <label class="auth-nickname-label" hidden>
            닉네임
            <input type="text" name="nickname" placeholder="새싹" autocomplete="nickname" maxlength="20">
          </label>
          <label>
            이메일
            <input type="email" name="email" required autocomplete="email">
          </label>
          <label>
            비밀번호
            <input type="password" name="password" required minlength="6" autocomplete="current-password">
          </label>
          <p class="auth-email-error" role="alert" hidden></p>
          <button type="submit" class="auth-submit">로그인</button>
        </form>
      </details>

      <button type="button" class="auth-guest">로그인 없이 둘러보기</button>
    </div>
  `;
  root.append(wrap);

  // ── Google 리디렉션 오류 표시 ─────────────────────────────
  const oauthErrorEl = wrap.querySelector('.auth-error');
  const oauthMessage = readAndClearOAuthError();
  if (oauthMessage) {
    oauthErrorEl.textContent = oauthMessage;
    oauthErrorEl.hidden = false;
  }

  // ── Google로 시작하기 ────────────────────────────────────
  wrap.querySelector('.auth-google').addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      oauthErrorEl.textContent = friendlyAuthError(error);
      oauthErrorEl.hidden = false;
    }
  });

  // ── 로그인 없이 둘러보기 ──────────────────────────────────
  wrap.querySelector('.auth-guest').addEventListener('click', () => onGuestMode?.());

  // ── 이메일로 로그인 (테스트용) ────────────────────────────
  const tabs = wrap.querySelectorAll('.auth-tab');
  const form = wrap.querySelector('.auth-form');
  const nicknameLabel = wrap.querySelector('.auth-nickname-label');
  const nicknameInput = form.elements.nickname;
  const passwordInput = form.elements.password;
  const submitBtn = wrap.querySelector('.auth-submit');
  const errorEl = wrap.querySelector('.auth-email-error');
  let mode = 'login';

  function setMode(next) {
    mode = next;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
    nicknameLabel.hidden = mode !== 'signup';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submitBtn.textContent = mode === 'signup' ? '회원가입' : '로그인';
    errorEl.hidden = true;
  }
  tabs.forEach(t => { t.onclick = () => setMode(t.dataset.mode); });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    errorEl.hidden = true;
    submitBtn.disabled = true;

    const email = form.elements.email.value.trim();
    const password = passwordInput.value;
    const nickname = nicknameInput.value.trim();

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname || '새싹' } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // 성공하면 main.js의 onAuthStateChange가 홈 화면으로 넘긴다.
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err);
      errorEl.hidden = false;
      submitBtn.disabled = false;
    }
  });

  setMode('login');
}

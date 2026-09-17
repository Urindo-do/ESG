import { MISSIONS, MOOD_LABELS, MOOD_THRESHOLDS } from '../config.js';
import { ACTIONS } from '../behaviors/actions.js';
import './styles.css';

const ICONS = {
  meal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0Z" fill="currentColor" opacity=".9"/><path d="M8 7c0-1.5 1-1.5 1-3M12 7c0-1.5 1-1.5 1-3M16 7c0-1.5 1-1.5 1-3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  product: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z" fill="currentColor" opacity=".9"/><path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M12 17.5c-2.6-1-3-3.4-.4-5.6 2.6 2.2 2.2 4.6.4 5.6Z" fill="#fff"/></svg>',
  phrase: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" stroke-width="2.2" fill="none"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M10.5 13.2c-1.9-.8-2.2-2.5-.3-4.1 1.9 1.6 1.6 3.3.3 4.1Z" fill="currentColor"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 13.7-5.6L20 4v6h-6l2.3-2.3A6 6 0 1 0 18 12h2a8 8 0 0 1-16 0Z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14l12-7Z" fill="currentColor"/></svg>',
  camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" fill="currentColor"/></svg>',
};

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export function createUI(root, handlers, { dev = false } = {}) {
  root.classList.add('hv-ui');
  root.innerHTML = '';

  // ── 상단 카드 ─────────────────────────────────────────────
  const top = el('section', 'hv-top');
  top.setAttribute('aria-label', '환경이 상태');
  const titleRow = el('div', 'hv-title-row');
  const title = el('h1', 'hv-title', '환경이 마을');
  const moodChip = el('span', 'hv-mood', '보통');
  moodChip.setAttribute('role', 'status');
  titleRow.append(title, moodChip);

  const gauge = el('div', 'hv-gauge');
  gauge.setAttribute('role', 'meter');
  gauge.setAttribute('aria-label', '청결 점수');
  gauge.setAttribute('aria-valuemin', '0');
  gauge.setAttribute('aria-valuemax', '100');
  const track = el('div', 'hv-gauge-track');
  const fill = el('div', 'hv-gauge-fill');
  track.append(fill);
  for (const v of [MOOD_THRESHOLDS.sad, MOOD_THRESHOLDS.happy]) {
    const tick = el('span', 'hv-gauge-tick');
    tick.style.left = `${v}%`;
    track.append(tick);
  }
  const scoreText = el('span', 'hv-score', '<b>0</b><small>/100</small>');
  gauge.append(el('span', 'hv-gauge-label', '청결'), track, scoreText);

  const remain = el('p', 'hv-remain');
  remain.setAttribute('aria-label', '오늘 남은 인증 횟수');
  top.append(titleRow, gauge, remain);

  // ── 말풍선·점수 팝업 ───────────────────────────────────────
  const bubble = el('div', 'hv-bubble');
  bubble.setAttribute('aria-live', 'polite');
  const popLayer = el('div', 'hv-pops');
  const tooltip = el('div', 'hv-tooltip');

  // ── 오른쪽 카메라 버튼 ─────────────────────────────────────
  const side = el('div', 'hv-side');
  const zoomIn = el('button', 'hv-round', '＋');
  zoomIn.setAttribute('aria-label', '확대');
  const zoomOut = el('button', 'hv-round', '－');
  zoomOut.setAttribute('aria-label', '축소');
  const resetBtn = el('button', 'hv-round', ICONS.camera);
  resetBtn.setAttribute('aria-label', '카메라 초기화');
  resetBtn.title = '카메라 초기화';
  side.append(zoomIn, zoomOut, resetBtn);
  zoomIn.onclick = () => handlers.onZoom?.(0.82);
  zoomOut.onclick = () => handlers.onZoom?.(1.22);
  resetBtn.onclick = () => handlers.onReset?.();

  // ── 하단: 미션 + 보조 버튼 ─────────────────────────────────
  const bottom = el('section', 'hv-bottom');
  const missions = el('div', 'hv-missions');
  const missionButtons = {};
  for (const m of MISSIONS) {
    const b = el('button', `hv-mission hv-mission-${m.id}`, `<span class="hv-mi">${ICONS[m.id]}</span><span class="hv-ml">${m.label}</span><span class="hv-mc" aria-hidden="true"></span>`);
    b.type = 'button';
    b.onclick = () => {
      if (b.getAttribute('aria-disabled') === 'true') {
        flashRemain(m.id);
        return;
      }
      handlers.onMission?.(m.id);
    };
    missionButtons[m.id] = b;
    missions.append(b);
  }
  const aux = el('div', 'hv-aux');
  const autoBtn = el('button', 'hv-chip', `${ICONS.auto}<span>자동 행동</span>`);
  autoBtn.setAttribute('aria-pressed', 'true');
  autoBtn.onclick = () => handlers.onAuto?.(autoBtn.getAttribute('aria-pressed') !== 'true');
  const pauseBtn = el('button', 'hv-chip', `${ICONS.pause}<span>잠시 멈춤</span>`);
  pauseBtn.onclick = () => handlers.onPause?.();
  const resumeBtn = el('button', 'hv-chip', `${ICONS.play}<span>다시 시작</span>`);
  resumeBtn.onclick = () => handlers.onResume?.();
  const actionText = el('span', 'hv-action', '');
  aux.append(autoBtn, pauseBtn, resumeBtn, actionText);
  bottom.append(missions, aux);

  // ── 로딩 ──────────────────────────────────────────────────
  const loading = el('div', 'hv-loading', '<div class="hv-sprout"></div><strong>환경이 마을을 불러오는 중…</strong><div class="hv-progress"><span></span></div>');

  root.append(top, side, bubble, popLayer, tooltip, bottom, loading);

  // ── 개발용 패널 ───────────────────────────────────────────
  let devPanel = null;
  let devSlider = null;
  let devValue = null;
  if (dev) {
    devPanel = el('details', 'hv-dev');
    devPanel.innerHTML = `<summary>개발용 패널</summary>
      <label class="hv-dev-row"><span>청결 점수</span><input type="range" min="0" max="100" step="1" id="hv-dev-score"><output id="hv-dev-value">0</output></label>
      <div class="hv-dev-row hv-dev-buttons">
        <button type="button" data-score="85">happy</button>
        <button type="button" data-score="55">기본</button>
        <button type="button" data-score="12">sad</button>
      </div>
      <div class="hv-dev-row hv-dev-buttons">
        <button type="button" id="hv-dev-decay">시간 경과 테스트 (−10)</button>
        <button type="button" id="hv-dev-gain">인증 성공 (+10)</button>
      </div>
      <label class="hv-dev-row"><span>행동</span><select id="hv-dev-action"><option value="">직접 고르기</option>${ACTIONS.map(a => `<option value="${a.id}">${a.label}</option>`).join('')}</select></label>`;
    root.append(devPanel);
    devSlider = devPanel.querySelector('#hv-dev-score');
    devValue = devPanel.querySelector('#hv-dev-value');
    devSlider.addEventListener('input', () => {
      devValue.textContent = devSlider.value;
      handlers.onDevScore?.(Number(devSlider.value));
    });
    devPanel.querySelectorAll('[data-score]').forEach(b => {
      b.onclick = () => handlers.onDevScore?.(Number(b.dataset.score));
    });
    devPanel.querySelector('#hv-dev-decay').onclick = () => handlers.onDevDecay?.();
    devPanel.querySelector('#hv-dev-gain').onclick = () => handlers.onDevGain?.();
    devPanel.querySelector('#hv-dev-action').onchange = e => {
      if (e.target.value) handlers.onDevAction?.(e.target.value);
      e.target.value = '';
    };
  }

  let remainingState = { meal: 0, product: 0, phrase: 0 };

  function flashRemain(id) {
    const span = remain.querySelector(`[data-k="${id}"]`);
    if (!span) return;
    span.classList.remove('hv-flash');
    void span.offsetWidth;
    span.classList.add('hv-flash');
  }

  let bubbleTimer = 0;
  let bubbleVisible = false;

  return {
    setScore(score, mood) {
      const s = Math.round(score);
      fill.style.width = `${s}%`;
      scoreText.querySelector('b').textContent = s;
      gauge.setAttribute('aria-valuenow', String(s));
      gauge.dataset.mood = mood;
      moodChip.textContent = MOOD_LABELS[mood];
      moodChip.dataset.mood = mood;
      root.dataset.mood = mood;
      if (devSlider && document.activeElement !== devSlider) {
        devSlider.value = String(s);
        devValue.textContent = String(s);
      }
    },
    setRemaining(r) {
      remainingState = { ...remainingState, ...r };
      remain.innerHTML = MISSIONS.map(m => `<span data-k="${m.id}">${m.short} <b>${remainingState[m.id] ?? 0}</b></span>`).join('<i aria-hidden="true">·</i>');
      for (const m of MISSIONS) {
        const n = remainingState[m.id] ?? 0;
        const b = missionButtons[m.id];
        b.setAttribute('aria-disabled', n <= 0 ? 'true' : 'false');
        b.querySelector('.hv-mc').textContent = n;
        b.setAttribute('aria-label', `${m.label}, 오늘 ${n}회 남음`);
      }
    },
    setBehavior(state) {
      autoBtn.setAttribute('aria-pressed', String(state.automatic));
      autoBtn.classList.toggle('on', state.automatic);
      pauseBtn.disabled = state.paused;
      resumeBtn.disabled = !state.paused && state.phase !== 'rest';
      actionText.textContent = state.paused ? '멈춤' : state.action ? state.action.label : '';
    },
    say(text, seconds = 3.2) {
      if (!text) return;
      bubble.textContent = text;
      bubble.classList.add('show');
      bubbleVisible = true;
      bubbleTimer = seconds;
    },
    tick(dt) {
      if (bubbleVisible) {
        bubbleTimer -= dt;
        if (bubbleTimer <= 0) {
          bubble.classList.remove('show');
          bubbleVisible = false;
        }
      }
    },
    positionHead(x, y, visible) {
      bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      popLayer.style.transform = `translate(${x}px, ${y}px)`;
      bubble.style.visibility = visible ? '' : 'hidden';
    },
    pop(points) {
      const p = el('div', 'hv-pop', `+${points}`);
      popLayer.append(p);
      setTimeout(() => p.remove(), 1600);
    },
    tooltip(text, x, y) {
      if (!text) {
        tooltip.classList.remove('show');
        return;
      }
      tooltip.textContent = text;
      tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
      tooltip.classList.add('show');
    },
    progress(ratio) {
      loading.querySelector('.hv-progress span').style.width = `${Math.round(ratio * 100)}%`;
    },
    loaded() {
      loading.classList.add('hidden');
    },
    error(message) {
      loading.classList.remove('hidden');
      loading.innerHTML = `<strong>3D 마을을 열지 못했어요</strong><span>${message}</span><button type="button" class="hv-retry">다시 시도</button>`;
      loading.querySelector('.hv-retry').onclick = () => location.reload();
    },
    dispose() {
      root.innerHTML = '';
      root.classList.remove('hv-ui');
    },
  };
}

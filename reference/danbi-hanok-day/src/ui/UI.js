import { ACTIONS } from '../behaviors/actions.js';

export function createUI(container, handlers) {
  container.innerHTML = `
    <header class="topbar">
      <div class="brand"><span class="brand-icon" aria-hidden="true">🐾</span><div><p class="eyebrow">작은 한옥 이야기</p><h1>단비의 하루<span class="title-dot">.</span></h1></div></div>
      <div class="weather"><span aria-hidden="true">☀</span><div><strong>햇살 좋은 오후</strong><small>오늘도, 느긋하게</small></div></div>
    </header>
    <aside class="status-card" aria-label="단비의 현재 행동">
      <div class="status-heading"><span class="status-avatar" aria-hidden="true">🐶</span><div><strong>단비</strong><span class="subtitle">아기 진돗개 · 우리 집 막내</span></div><span id="mode-badge" class="badge">자동</span></div>
      <div class="status-line"><span class="live-dot"></span><p id="status" role="status" aria-live="polite"></p></div>
      <p id="thought" class="thought"></p>
    </aside>
    <div id="bubble" class="speech-bubble" aria-hidden="true"></div>
    <div id="object-tooltip" role="tooltip" hidden></div>
    <div class="camera-tools" aria-label="카메라 조작">
      <button id="zoom-in" title="확대" aria-label="확대">＋</button>
      <button id="zoom-out" title="축소" aria-label="축소">−</button>
      <span class="tool-divider"></span>
      <button id="reset-camera" title="카메라 초기화" aria-label="카메라 초기화">⌂</button>
    </div>
    <section class="bottom-area" aria-label="단비 행동 선택">
      <p class="scene-hint"><span>↔</span> 드래그로 둘러보기 <i>·</i> 스크롤로 확대 <i>·</i> 물건을 눌러 함께 놀아요</p>
      <div class="control-card">
        <div class="control-top"><div><span class="little-flower">✿</span><strong>단비야, 뭐 할까?</strong></div><label class="auto-control"><span>자동 행동</span><input id="auto-toggle" type="checkbox" checked role="switch"/><span class="switch-track" aria-hidden="true"></span></label></div>
        <div class="actions">${ACTIONS.map(a => `<button class="action-button" data-action="${a.id}" aria-pressed="false"><span class="action-icon" aria-hidden="true">${a.icon}</span><span>${a.label}</span></button>`).join('')}</div>
        <div class="control-footer"><p>작은 일들로 채우는, 포근한 하루</p><button id="pause" class="pause-button">Ⅱ <span>잠시 멈춤</span></button></div>
      </div>
      <p class="footer-note">단비네 한옥 <span>✦</span> 마음이 쉬어가는 곳</p>
    </section>`;
  container.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => handlers.onAction(button.dataset.action)));
  container.querySelector('#auto-toggle').addEventListener('change', event => handlers.onAuto(event.target.checked));
  container.querySelector('#pause').addEventListener('click', handlers.onPause);
  container.querySelector('#reset-camera').addEventListener('click', handlers.onReset);
  container.querySelector('#zoom-in').addEventListener('click', () => handlers.onZoom(0.84));
  container.querySelector('#zoom-out').addEventListener('click', () => handlers.onZoom(1.19));
  const bubble = container.querySelector('#bubble'), tooltip = container.querySelector('#object-tooltip');
  return {
    update({ action, walking, automatic, paused }) {
      container.querySelector('#status').textContent = paused ? '잠깐 쉬고 있어요' : walking ? `${action.label} 하러 가는 중` : `${action.label} 하는 중`;
      container.querySelector('#thought').textContent = `“${action.thought}”`;
      container.querySelector('#mode-badge').textContent = automatic ? '자동' : '함께';
      container.querySelector('#auto-toggle').checked = automatic;
      container.querySelector('#pause').innerHTML = paused ? '▷ <span>다시 시작</span>' : 'Ⅱ <span>잠시 멈춤</span>';
      container.querySelectorAll('[data-action]').forEach(button => {
        const selected = button.dataset.action === action.id;
        button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
      });
      bubble.textContent = paused ? '잠시 쉬어갈까요?' : walking ? '총총총…' : action.id === 'sleep' ? '쿨… 쿨…' : action.thought;
    },
    positionBubble(x, y, visible) { bubble.style.left = `${x}px`; bubble.style.top = `${y}px`; bubble.style.opacity = visible ? '1' : '0'; },
    tooltip(name, x, y) {
      tooltip.hidden = !name;
      tooltip.textContent = name ? `${name} · 눌러 보기` : '';
      tooltip.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, x + 15))}px`;
      tooltip.style.top = `${Math.max(10, y - 42)}px`;
    },
  };
}

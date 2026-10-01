export const DEEPUM_RAIN_EMOJIS = ['✨', '💫', '🫪'] as const;

const FALLBACK_DISTORTED_FACE = '😵‍💫';
const GENERATION_DURATION_MS = 3_000;
const EMOJI_INTERVAL_MS = 60;
const MIN_FALL_DURATION_MS = 2_000;
const MAX_FALL_DURATION_MS = 4_000;
const STYLE_ID = 'deepum-rain-styles';
const CONTAINER_ID = 'deepum-rain';

let running = false;

export function containsDeepum(content: string): boolean {
  return /(?:^|[^\p{L}\p{N}_])deepum(?=$|[^\p{L}\p{N}_])/iu.test(content);
}

function supportsEmoji(emoji: string): boolean {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return false;
  context.font = '32px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  const candidateWidth = context.measureText(emoji).width;
  const unsupportedWidth = context.measureText('\u{10FFFF}').width;
  const replacementWidth = context.measureText('\uFFFD').width;
  return candidateWidth !== unsupportedWidth && candidateWidth !== replacementWidth;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes deepum-emoji-fall {
      from { transform: translate3d(-50%, -4rem, 0) rotate(0deg); }
      to { transform: translate3d(calc(-50% + var(--deepum-drift)), calc(100vh + 5rem), 0) rotate(var(--deepum-spin)); }
    }
  `;
  document.head.appendChild(style);
}

function createFallingEmoji(container: HTMLElement, emojis: readonly string[]) {
  const emoji = document.createElement('span');
  const duration = MIN_FALL_DURATION_MS + Math.random() * (MAX_FALL_DURATION_MS - MIN_FALL_DURATION_MS);
  emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
  emoji.setAttribute('aria-hidden', 'true');
  Object.assign(emoji.style, {
    position: 'fixed',
    top: '0',
    left: `${Math.random() * 100}vw`,
    zIndex: '2147483646',
    pointerEvents: 'none',
    userSelect: 'none',
    fontSize: `${24 + Math.random() * 36}px`,
    lineHeight: '1',
    willChange: 'transform',
    animation: `deepum-emoji-fall ${duration}ms linear forwards`,
  });
  emoji.style.setProperty('--deepum-drift', `${-80 + Math.random() * 160}px`);
  emoji.style.setProperty('--deepum-spin', `${360 + Math.random() * 720}deg`);
  container.appendChild(emoji);
  emoji.addEventListener('animationend', () => emoji.remove(), { once: true });
  window.setTimeout(() => emoji.remove(), duration + 150);
}

export function lluviaDeepum(content: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!containsDeepum(content) || running) return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;

  running = true;
  ensureStyles();
  const container = document.createElement('div');
  container.id = CONTAINER_ID;
  container.setAttribute('aria-hidden', 'true');
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483646',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(container);

  const distortedFace = supportsEmoji('🫪') ? '🫪' : FALLBACK_DISTORTED_FACE;
  const emojis = DEEPUM_RAIN_EMOJIS.map((emoji) => emoji === '🫪' ? distortedFace : emoji);
  const interval = window.setInterval(() => createFallingEmoji(container, emojis), EMOJI_INTERVAL_MS);

  window.setTimeout(() => {
    window.clearInterval(interval);
    window.setTimeout(() => {
      container.remove();
      running = false;
    }, MAX_FALL_DURATION_MS + 200);
  }, GENERATION_DURATION_MS);

  return true;
}

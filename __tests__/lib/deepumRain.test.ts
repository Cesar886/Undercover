/** @jest-environment jsdom */

import { containsDeepum, lluviaDeepum } from '@/lib/deepumRain';

function mockMotionPreference(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn().mockReturnValue({ matches }),
  });
}

function mockEmojiWidths(supported: boolean) {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '',
    measureText: (text: string) => ({ width: text === '🫪' && supported ? 20 : 10 }),
  } as unknown as CanvasRenderingContext2D);
}

beforeEach(() => {
  jest.useFakeTimers();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  mockMotionPreference(false);
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('detects deepum as a case-insensitive whole word inside a phrase', () => {
  expect(containsDeepum('hola DEEPUM a todos')).toBe(true);
  expect(containsDeepum('deepum')).toBe(true);
  expect(containsDeepum('nodeepum123')).toBe(false);
});

it('does not animate when reduced motion is requested', () => {
  mockMotionPreference(true);
  expect(lluviaDeepum('mensaje deepum')).toBe(false);
  expect(document.getElementById('deepum-rain')).toBeNull();
});

it('runs once, ignores overlapping triggers, and cleans up', () => {
  mockEmojiWidths(true);
  expect(lluviaDeepum('mensaje con deepum')).toBe(true);
  expect(lluviaDeepum('otro deepum')).toBe(false);
  jest.advanceTimersByTime(60);
  expect(document.querySelectorAll('#deepum-rain span')).toHaveLength(1);
  jest.advanceTimersByTime(7_200);
  expect(document.getElementById('deepum-rain')).toBeNull();
});

it('uses the fallback face when the recent emoji is unsupported', () => {
  mockEmojiWidths(false);
  jest.spyOn(Math, 'random').mockReturnValue(0.99);
  expect(lluviaDeepum('deepum')).toBe(true);
  jest.advanceTimersByTime(60);
  expect(document.querySelector('#deepum-rain span')?.textContent).toBe('😵‍💫');
  jest.advanceTimersByTime(7_200);
});

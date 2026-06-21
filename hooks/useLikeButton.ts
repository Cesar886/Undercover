import { useRef, useState, useCallback } from 'react';

interface Options {
  /** Called when user does a quick tap/click (no long press) */
  onQuickTap: () => void;
  /** Milliseconds before hover opens the picker. Default: 500 */
  hoverDelay?: number;
  /** Milliseconds for mobile long-press to open the picker. Default: 500 */
  longPressDelay?: number;
}

interface UseLikeButtonReturn {
  pickerOpen: boolean;
  setPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closePicker: () => void;
  onWrapMouseEnter: () => void;
  onWrapMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchMove: () => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onButtonClick: () => void;
}

/**
 * Encapsulates Facebook-style like-button interaction:
 * - Desktop: hover for `hoverDelay`ms → opens picker; mouse-leave → closes it
 * - Mobile:  quick tap → onQuickTap; hold for `longPressDelay`ms → opens picker
 * - Click:   always calls onQuickTap (picker state is managed separately)
 */
export function useLikeButton({
  onQuickTap,
  hoverDelay     = 500,
  longPressDelay = 500,
}: Options): UseLikeButtonReturn {
  const [pickerOpen, setPickerOpen] = useState(false);

  const hoverTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHoverRef  = useRef(false);
  const touchMovedRef     = useRef(false);
  const longPressDidFire  = useRef(false);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    openedByHoverRef.current = false;
  }, []);

  // ── Desktop: hover ───────────────────────────────────────────────
  const onWrapMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      openedByHoverRef.current = true;
      setPickerOpen(true);
    }, hoverDelay);
  }, [hoverDelay]);

  const onWrapMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (openedByHoverRef.current) {
      setPickerOpen(false);
      openedByHoverRef.current = false;
    }
  }, []);

  // ── Mobile: long-press ───────────────────────────────────────────
  const onTouchStart = useCallback(() => {
    touchMovedRef.current    = false;
    longPressDidFire.current = false;
    longPressRef.current = setTimeout(() => {
      longPressDidFire.current = true;
      setPickerOpen(true);
    }, longPressDelay);
  }, [longPressDelay]);

  const onTouchMove = useCallback(() => {
    touchMovedRef.current = true;
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      // Quick tap: no scroll movement and long-press didn't fire
      if (!touchMovedRef.current && !longPressDidFire.current) {
        e.preventDefault();
        onQuickTap();
      }
    },
    [onQuickTap],
  );

  // ── Click (desktop) ──────────────────────────────────────────────
  const onButtonClick = useCallback(() => {
    onQuickTap();
  }, [onQuickTap]);

  return {
    pickerOpen,
    setPickerOpen,
    closePicker,
    onWrapMouseEnter,
    onWrapMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onButtonClick,
  };
}

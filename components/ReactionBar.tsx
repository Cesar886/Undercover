'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost } from '@/lib/apiClient';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { ReactionCounts, ReactionEmoji } from '@/types';

const EMOJIS: ReactionEmoji[] = ['❤️', '😂', '🤯', '🫶', '🙃', '🫪'];

interface FloatingEmoji {
  id: number;
  emoji: string;
  x: number;
}

interface Props {
  postId: string;
}

export function ReactionBar({ postId }: Props) {
  const [counts, setCounts]       = useState<ReactionCounts>({});
  const [myReaction, setMyReaction] = useState<ReactionEmoji | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [popping, setPopping]     = useState<ReactionEmoji | null>(null);
  const [floaters, setFloaters]   = useState<FloatingEmoji[]>([]);
  const [loading, setLoading]     = useState(false);
  const floaterIdRef = useRef(0);
  const pickerRef    = useRef<HTMLDivElement>(null);
  const triggerRef   = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    apiGet<{ counts: ReactionCounts; myReaction: ReactionEmoji | null }>(
      `/api/posts/${postId}/reactions`
    ).then((r) => {
      if (r.ok) {
        setCounts(r.data.counts);
        setMyReaction(r.data.myReaction);
      }
    });
  }, [postId]);

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:reaction' && ev.postId === postId) {
          setCounts(ev.counts);
        }
      },
      [postId]
    )
  );

  useEffect(() => {
    if (!pickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  async function handleReact(emoji: ReactionEmoji) {
    if (loading) return;
    setPickerOpen(false);

    const next = myReaction === emoji ? null : emoji;

    setMyReaction(next);
    setCounts((prev) => {
      const updated = { ...prev };
      if (myReaction) {
        const prevCount = (updated[myReaction] ?? 1) - 1;
        if (prevCount <= 0) delete updated[myReaction];
        else updated[myReaction] = prevCount;
      }
      if (next) {
        updated[next] = (updated[next] ?? 0) + 1;
      }
      return updated;
    });

    if (next) {
      setPopping(next);
      setTimeout(() => setPopping(null), 400);

      const id = ++floaterIdRef.current;
      const x = Math.random() * 20 - 10;
      setFloaters((prev) => [...prev, { id, emoji: next, x }]);
      setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== id)), 600);
    }

    setLoading(true);
    const r = await apiPost<{ counts: ReactionCounts; myReaction: ReactionEmoji | null }>(
      `/api/posts/${postId}/reactions`,
      { emoji: next }
    );
    setLoading(false);

    if (r.ok) {
      setCounts(r.data.counts);
      setMyReaction(r.data.myReaction);
    } else {
      setMyReaction(myReaction);
      setCounts((prev) => prev);
    }
  }

  const totalReactions = EMOJIS.reduce((sum, e) => sum + (counts[e] ?? 0), 0);
  const hasAny = totalReactions > 0;

  return (
    <div className="relative flex items-center gap-1.5 flex-wrap">
      {EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        if (count === 0 && myReaction !== emoji) return null;
        const isActive = myReaction === emoji;
        return (
          <div key={emoji} className="relative">
            <button
              onClick={() => handleReact(emoji)}
              className={`relative flex items-center gap-1 rounded-full px-2 py-0.5 text-xs border transition-all duration-150
                ${isActive
                  ? 'bg-violet-100 dark:bg-violet-600/20 border-violet-400 dark:border-violet-500 text-violet-700 dark:text-violet-300'
                  : 'bg-stone-50 dark:bg-violet-950/30 border-stone-200 dark:border-violet-500/15 text-stone-500 dark:text-[#6b6a8f] hover:border-stone-300 dark:hover:border-violet-400/30 hover:bg-stone-100 dark:hover:bg-violet-900/20'
                }
                ${popping === emoji ? 'animate-reaction-pop' : ''}
              `}
              aria-label={`Reaccionar con ${emoji}`}
            >
              <span>{emoji}</span>
              {count > 0 && (
                <span className="tabular-nums leading-none">{count}</span>
              )}
            </button>
            {floaters
              .filter((f) => f.emoji === emoji)
              .map((f) => (
                <span
                  key={f.id}
                  className="pointer-events-none absolute -top-1 left-1/2 text-base animate-reaction-float"
                  style={{ transform: `translateX(calc(-50% + ${f.x}px))` }}
                >
                  {f.emoji}
                </span>
              ))}
          </div>
        );
      })}

      <div className="relative">
        <button
          ref={triggerRef}
          onClick={() => setPickerOpen((o) => !o)}
          className={`flex items-center justify-center w-6 h-6 rounded-full border text-[11px] transition-all duration-150
            ${pickerOpen
              ? 'bg-violet-100 dark:bg-violet-600/20 border-violet-400 dark:border-violet-500 text-violet-600 dark:text-violet-400'
              : 'bg-stone-50 dark:bg-violet-950/30 border-stone-200 dark:border-violet-500/15 text-stone-400 dark:text-[#4a4870] hover:border-stone-300 dark:hover:border-violet-400/30 hover:text-stone-600 dark:hover:text-violet-300'
            }
            ${!hasAny && !myReaction ? 'opacity-0 group-hover:opacity-100' : ''}
          `}
          aria-label="Reaccionar"
        >
          {pickerOpen ? '×' : '+'}
        </button>

        {pickerOpen && (
          <div
            ref={pickerRef}
            className="absolute bottom-full left-0 mb-2 z-50 animate-picker-in"
          >
            <div className="flex items-center gap-1 px-2 py-1.5 rounded-2xl bg-white dark:bg-[#0d0b1a] border border-stone-200 dark:border-violet-500/20 shadow-xl dark:shadow-[0_8px_32px_rgba(124,58,237,0.2)]">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={`text-lg w-8 h-8 flex items-center justify-center rounded-xl transition-all duration-100
                    hover:scale-125 hover:bg-stone-100 dark:hover:bg-violet-900/40 active:scale-95
                    ${myReaction === emoji ? 'bg-violet-100 dark:bg-violet-600/25 scale-110' : ''}
                  `}
                  aria-label={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

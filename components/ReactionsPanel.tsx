'use client';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { apiGet, apiPatch, apiPost } from '@/lib/apiClient';
import { useFeedEvents } from '@/components/FeedStreamProvider';
import { useLikeButton } from '@/hooks/useLikeButton';
import { ReactionCounts, ReactionEmoji } from '@/types';

const REACTION_EMOJIS: ReactionEmoji[] = ['❤️', '😂', '🤯', '🫶', '🙃', '🫪'];
const REACTION_LABELS: Record<ReactionEmoji, string> = {
  '❤️': 'Me encanta',
  '😂': 'Me divierte',
  '🤯': 'Me sorprende',
  '🫶': 'Me importa',
  '🙃': 'Me parece curioso',
  '🫪': 'Me indigna',
};

type VoteType = 'up' | 'down';
interface Floater { id: number; key: string; emoji: string; x: number }

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function ThumbUp({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3v11zM20.007 11H15V5a3 3 0 0 0-3-3L8 11v11h11.28a2 2 0 0 0 1.99-1.76l.71-7a2 2 0 0 0-1.973-2.24z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
    </svg>
  );
}

function ThumbDown({ filled, className }: { filled?: boolean; className?: string }) {
  return filled ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3V2zM3.993 13H9v6a3 3 0 0 0 3 3l4-9V2H4.72a2 2 0 0 0-1.99 1.76l-.71 7A2 2 0 0 0 3.993 13z"/>
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface ReactionPickerProps {
  voted: VoteType | null;
  myReaction: ReactionEmoji | null;
  onVote: (type: VoteType) => void;
  onReact: (emoji: ReactionEmoji) => void;
}

const ReactionPicker = memo(function ReactionPicker({ voted, myReaction, onVote, onReact }: ReactionPickerProps) {
  const isDownActive = voted === 'down';
  return (
    <div
      role="dialog"
      aria-label="Elige una reacción"
      className="absolute bottom-full left-0 pb-2 z-50 animate-picker-in origin-bottom-left"
    >
      <div className="
        flex items-end gap-0.5 px-2 py-2 rounded-2xl
        bg-white dark:bg-[#0d0b1a]
        border border-stone-200 dark:border-violet-500/20
        shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]
        dark:shadow-[0_8px_48px_rgba(0,0,0,0.55),0_0_0_1px_rgba(139,92,246,0.12)]
      ">
        <button
          onClick={() => onVote('down')}
          aria-label={isDownActive ? 'Quitar No me gusta' : 'No me gusta'}
          aria-pressed={isDownActive}
          className="group relative px-1.5 py-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          {isDownActive && (
            <span aria-hidden className="absolute inset-0 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 ring-1 ring-inset ring-violet-400/30" />
          )}
          <span
            className={`
              text-[22px] block origin-bottom transition-all duration-200 ease-out animate-emoji-enter
              group-hover:scale-[1.5] group-hover:-translate-y-3
              group-hover:drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]
              ${isDownActive ? 'scale-[1.15] drop-shadow-[0_0_10px_rgba(124,58,237,0.55)]' : ''}
            `}
          >
            👎
          </span>
        </button>
        <div aria-hidden className="w-px h-5 mx-0.5 self-center flex-shrink-0 bg-gradient-to-b from-transparent via-stone-200 to-transparent dark:via-white/10" />

        {REACTION_EMOJIS.map((emoji, i) => (
          <button
            key={emoji}
            onClick={() => onReact(emoji)}
            aria-label={REACTION_LABELS[emoji]}
            aria-pressed={myReaction === emoji}
            className="group relative px-1.5 py-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {myReaction === emoji && (
              <span aria-hidden className="absolute inset-0 rounded-xl bg-violet-500/10 dark:bg-violet-500/20 ring-1 ring-inset ring-violet-400/30" />
            )}
            <span
              className={`
                text-[22px] block origin-bottom transition-all duration-200 ease-out animate-emoji-enter
                group-hover:scale-[1.5] group-hover:-translate-y-3
                group-hover:drop-shadow-[0_6px_16px_rgba(0,0,0,0.18)]
                ${myReaction === emoji ? 'scale-[1.15] drop-shadow-[0_0_10px_rgba(124,58,237,0.55)]' : ''}
              `}
              style={{ animationDelay: `${(i + 1) * 28}ms` }}
            >
              {emoji}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});

interface MainLikeButtonProps {
  voted: VoteType | null;
  upvotes: number;
  popping: string | null;
  pickerOpen: boolean;
  onWrapMouseEnter: () => void;
  onWrapMouseLeave: () => void;
  onButtonClick: () => void;
  onTouchStart: () => void;
  onTouchMove: () => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onVote: (type: VoteType) => void;
  onReact: (emoji: ReactionEmoji) => void;
  myReaction: ReactionEmoji | null;
  floaters: Floater[];
}

const MainLikeButton = memo(function MainLikeButton({
  voted, upvotes, popping, pickerOpen,
  onWrapMouseEnter, onWrapMouseLeave, onButtonClick,
  onTouchStart, onTouchMove, onTouchEnd,
  onVote, onReact, myReaction, floaters,
}: MainLikeButtonProps) {
  const isUpvoted = voted === 'up';
  const label     = isUpvoted
    ? 'Me gusta (seleccionado)'
    : 'Me gusta — mantén presionado para más reacciones';

  return (
    <div className="relative" onMouseEnter={onWrapMouseEnter} onMouseLeave={onWrapMouseLeave}>
      <button
        onClick={onButtonClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        title="Me gusta · Mantén presionado para más reacciones"
        className={`
          flex items-center gap-1.5 transition-all duration-200 select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-1
          p-0.5 rounded
          ${isUpvoted
            ? 'text-sky-500 dark:text-sky-400'
            : 'text-stone-400/70 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400'
          }
          ${popping === 'up' ? 'animate-fb-pop' : ''}
        `}
      >
        <ThumbUp filled={isUpvoted} className="w-3.5 h-3.5 flex-shrink-0" />
        {upvotes > 0 && (
          <span className="text-[10px] tabular-nums font-medium leading-none" aria-label={`${upvotes} votos`}>
            {upvotes}
          </span>
        )}
      </button>

      {floaters
        .filter(f => f.key === 'up')
        .map(f => (
          <span
            key={f.id}
            aria-hidden
            className="pointer-events-none absolute -top-1 left-1/2 text-base animate-fb-float"
            style={{ transform: `translateX(calc(-50% + ${f.x}px))` }}
          >
            {f.emoji}
          </span>
        ))}

      {pickerOpen && (
        <ReactionPicker
          voted={voted}
          myReaction={myReaction}
          onVote={onVote}
          onReact={onReact}
        />
      )}
    </div>
  );
});

interface DislikeButtonProps {
  voted: VoteType | null;
  downvotes: number;
  popping: string | null;
  floaters: Floater[];
  onVote: (type: VoteType) => void;
}

const DislikeButton = memo(function DislikeButton({
  voted, downvotes, popping, floaters, onVote,
}: DislikeButtonProps) {
  const isDownvoted = voted === 'down';

  return (
    <div className="relative">
      <button
        onClick={() => onVote('down')}
        aria-label={isDownvoted ? 'Quitar No me gusta' : 'No me gusta'}
        aria-pressed={isDownvoted}
        className={`
          flex items-center gap-1.5 transition-all duration-200 select-none
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-1
          p-0.5 rounded
          ${isDownvoted
            ? 'text-sky-500 dark:text-sky-400'
            : 'text-stone-400/70 dark:text-stone-600 hover:text-stone-600 dark:hover:text-stone-400'
          }
          ${popping === 'down' ? 'animate-fb-pop' : ''}
        `}
      >
        <ThumbDown filled={isDownvoted} className="w-3.5 h-3.5 flex-shrink-0" />
        {downvotes > 0 && (
          <span className="text-[10px] tabular-nums font-medium leading-none" aria-label={`${downvotes} votos`}>
            {downvotes}
          </span>
        )}
      </button>

      {floaters
        .filter(f => f.key === 'down')
        .map(f => (
          <span
            key={f.id}
            aria-hidden
            className="pointer-events-none absolute -top-1 left-1/2 text-base animate-fb-float"
            style={{ transform: `translateX(calc(-50% + ${f.x}px))` }}
          >
            {f.emoji}
          </span>
        ))}
    </div>
  );
});

interface ReactionPillProps {
  emoji: string;
  count: number;
  active: boolean;
  popping: boolean;
  disabled?: boolean;
  floaters: Floater[];
  onClick: () => void;
  label: string;
}

const ReactionPill = memo(function ReactionPill({
  emoji, count, active, popping, disabled, floaters, onClick, label,
}: ReactionPillProps) {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
        className={`
          flex items-center gap-0.5 px-1 py-0.5 rounded text-xs
          transition-all duration-200 select-none disabled:cursor-not-allowed
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1
          ${active
            ? 'text-violet-600 dark:text-violet-400'
            : 'text-stone-500 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
          }
          ${popping ? 'animate-fb-pop' : ''}
        `}
      >
        <span className="text-sm leading-none" aria-hidden>{emoji}</span>
        {count > 0 && (
          <span className="tabular-nums leading-none font-semibold tracking-tight" aria-label={`${count}`}>
            {count}
          </span>
        )}
      </button>

      {floaters.map(f => (
        <span
          key={f.id}
          aria-hidden
          className="pointer-events-none absolute -top-1 left-1/2 text-base animate-fb-float"
          style={{ transform: `translateX(calc(-50% + ${f.x}px))` }}
        >
          {f.emoji}
        </span>
      ))}
    </div>
  );
});

// ── Main panel ────────────────────────────────────────────────────────────────

interface Props {
  postId: string;
  /** When set, this panel targets a comment instead of the post itself. */
  commentId?: string;
  upvotes: number;
  downvotes: number;
  onVoted?: () => void;
  onVoteError?: (msg: string) => void;
}

export function ReactionsPanel({ postId, commentId, upvotes, downvotes, onVoted, onVoteError }: Props) {
  const apiBase = commentId
    ? `/api/posts/${postId}/comments/${commentId}`
    : `/api/posts/${postId}`;

  const [voteCounts, setVoteCounts]         = useState({ upvotes, downvotes });
  const [voted, setVoted]                   = useState<VoteType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>({});
  const [myReaction, setMyReaction]         = useState<ReactionEmoji | null>(null);
  const [popping, setPopping]               = useState<string | null>(null);
  const [floaters, setFloaters]             = useState<Floater[]>([]);
  const floaterIdRef = useRef(0);

  useEffect(() => {
    Promise.all([
      apiGet<{ voted: VoteType | null }>(`${apiBase}/vote`),
      apiGet<{ counts: ReactionCounts; myReaction: ReactionEmoji | null }>(`${apiBase}/reactions`),
    ]).then(([voteRes, reactRes]) => {
      if (voteRes.ok && voteRes.data.voted) setVoted(voteRes.data.voted);
      if (reactRes.ok) {
        setReactionCounts(reactRes.data.counts);
        setMyReaction(reactRes.data.myReaction);
      }
    });
  }, [apiBase]);

  useFeedEvents(useCallback((ev) => {
    if (commentId) return;
    if (ev.type === 'post:vote' && ev.postId === postId)
      setVoteCounts({ upvotes: ev.upvotes, downvotes: ev.downvotes });
    if (ev.type === 'post:reaction' && ev.postId === postId)
      setReactionCounts(ev.counts);
  }, [postId, commentId]));

  function pop(key: string, emoji: string) {
    setPopping(key);
    setTimeout(() => setPopping(null), 450);
    const id = ++floaterIdRef.current;
    const x  = Math.random() * 20 - 10;
    setFloaters(prev => [...prev, { id, key, emoji, x }]);
    setTimeout(() => setFloaters(prev => prev.filter(f => f.id !== id)), 700);
  }

  async function handleVote(type: VoteType) {
    closePicker();
    const prev = voted;
    const next: VoteType | null = prev === type ? null : type;

    const upDelta   = (next === 'up'   ? 1 : 0) - (prev === 'up'   ? 1 : 0);
    const downDelta = (next === 'down' ? 1 : 0) - (prev === 'down' ? 1 : 0);

    setVoted(next);
    setVoteCounts(c => ({
      upvotes:   c.upvotes   + upDelta,
      downvotes: c.downvotes + downDelta,
    }));
    if (next) pop(next, next === 'up' ? '👍' : '👎');

    const r = await apiPatch<{ votes: { upvotes: number; downvotes: number } }>(
      `${apiBase}/vote`, { vote_type: next }
    );
    if (r.ok) { setVoteCounts(r.data.votes); onVoted?.(); }
    else { setVoteCounts({ upvotes, downvotes }); setVoted(prev); onVoteError?.(r.error); }
  }

  async function handleReaction(emoji: ReactionEmoji) {
    closePicker();
    const next = myReaction === emoji ? null : emoji;
    setMyReaction(next);
    setReactionCounts(prev => {
      const u = { ...prev };
      if (myReaction) {
        const c = (u[myReaction] ?? 1) - 1;
        if (c <= 0) delete u[myReaction]; else u[myReaction] = c;
      }
      if (next) u[next] = (u[next] ?? 0) + 1;
      return u;
    });
    if (next) pop(next, next);

    await apiPost<{ counts: ReactionCounts; myReaction: ReactionEmoji | null }>(
      `${apiBase}/reactions`, { emoji: next }
    );
  }

  const handleUpvote = useCallback(() => {
    handleVote('up');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voted]);

  const {
    pickerOpen,
    setPickerOpen,
    closePicker,
    onWrapMouseEnter,
    onWrapMouseLeave,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onButtonClick,
  } = useLikeButton({ onQuickTap: handleUpvote });

  const pills: { key: string; emoji: string; count: number; active: boolean; label: string }[] = [];

  for (const emoji of REACTION_EMOJIS) {
    const count = reactionCounts[emoji] ?? 0;
    if (count > 0 || myReaction === emoji)
      pills.push({
        key: emoji, emoji, count,
        active: myReaction === emoji,
        label: myReaction === emoji
          ? `${REACTION_LABELS[emoji]} (seleccionado)`
          : `${REACTION_LABELS[emoji]} · ${count}`,
      });
  }

  return (
    <div role="group" aria-label="Reacciones" className="relative flex items-center gap-1 flex-wrap">

      <MainLikeButton
        voted={voted}
        upvotes={voteCounts.upvotes}
        popping={popping}
        pickerOpen={pickerOpen}
        onWrapMouseEnter={onWrapMouseEnter}
        onWrapMouseLeave={onWrapMouseLeave}
        onButtonClick={onButtonClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onVote={handleVote}
        onReact={handleReaction}
        myReaction={myReaction}
        floaters={floaters}
      />

      <DislikeButton
        voted={voted}
        downvotes={voteCounts.downvotes}
        popping={popping}
        floaters={floaters}
        onVote={handleVote}
      />

      {pills.length > 0 && (
        <div className="flex items-center gap-0.5 ml-2 pl-2 border-l border-stone-200/60 dark:border-white/[0.07]">
          {pills.map(pill => (
            <ReactionPill
              key={pill.key}
              emoji={pill.emoji}
              count={pill.count}
              active={pill.active}
              popping={popping === pill.key}
              disabled={false}
              floaters={floaters.filter(f => f.key === pill.key)}
              onClick={() => handleReaction(pill.emoji as ReactionEmoji)}
              label={pill.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/apiClient';
import { useFeedEvents } from '@/components/FeedStreamProvider';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
  onVoted?: () => void;
  onError?: (msg: string) => void;
}

interface VoteResponse {
  votes: { upvotes: number; downvotes: number };
}

export function VoteButtons({ postId, upvotes, downvotes, onVoted, onError }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted]   = useState<'up' | 'down' | null>(null);
  const [popping, setPopping] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    apiGet<{ voted: 'up' | 'down' | null }>(`/api/posts/${postId}/vote`).then((r) => {
      if (r.ok && r.data.voted) setVoted(r.data.voted);
    });
  }, [postId]);

  useFeedEvents(
    useCallback(
      (ev) => {
        if (ev.type === 'post:vote' && ev.postId === postId) {
          setCounts({ upvotes: ev.upvotes, downvotes: ev.downvotes });
        }
      },
      [postId]
    )
  );

  async function handleVote(voteType: 'up' | 'down') {
    if (voted) return;

    setCounts((prev) => ({
      upvotes:   prev.upvotes   + (voteType === 'up'   ? 1 : 0),
      downvotes: prev.downvotes + (voteType === 'down' ? 1 : 0),
    }));
    setVoted(voteType);
    setPopping(voteType);
    setTimeout(() => setPopping(null), 400);

    const result = await apiPatch<VoteResponse>(`/api/posts/${postId}/vote`, { vote_type: voteType });

    if (result.ok) {
      setCounts(result.data.votes);
      onVoted?.();
    } else {
      setCounts({ upvotes, downvotes });
      setVoted(null);
      onError?.(result.error);
    }
  }

  const upClass = voted === 'up'
    ? 'bg-mauve-500 dark:bg-violet-600 border-mauve-500 dark:border-violet-600 text-white font-semibold scale-105'
    : 'border-stone-200 dark:border-violet-500/20 text-stone-500 dark:text-[#6b6a8f] hover:bg-mauve-50 dark:hover:bg-violet-600/10 hover:border-mauve-400 dark:hover:border-violet-400 hover:text-mauve-600 dark:hover:text-violet-400';

  const downClass = voted === 'down'
    ? 'bg-sky-500 dark:bg-sky-600 border-sky-500 dark:border-sky-600 text-white font-semibold scale-105'
    : 'border-stone-200 dark:border-violet-500/20 text-stone-500 dark:text-[#6b6a8f] hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-300 hover:text-sky-500';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-all disabled:cursor-not-allowed ${upClass} ${popping === 'up' ? 'animate-vote-pop' : ''}`}
        aria-label="Upvote"
      >
        <span className="text-[10px] leading-none">▲</span>
        <span className={`inline-block tabular-nums ${popping === 'up' ? 'animate-vote-bounce' : ''}`}>
          {counts.upvotes}
        </span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-all disabled:cursor-not-allowed ${downClass} ${popping === 'down' ? 'animate-vote-pop' : ''}`}
        aria-label="Downvote"
      >
        <span className="text-[10px] leading-none">▼</span>
        <span className={`inline-block tabular-nums ${popping === 'down' ? 'animate-vote-bounce' : ''}`}>
          {counts.downvotes}
        </span>
      </button>
    </div>
  );
}

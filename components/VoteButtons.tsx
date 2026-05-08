'use client';
import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
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
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    apiGet<{ voted: 'up' | 'down' | null }>(`/api/posts/${postId}/vote`).then((r) => {
      if (r.ok && r.data.voted) setVoted(r.data.voted);
    });
  }, [postId]);

  // Actualización en tiempo real: cuando otro usuario vota, los conteos se actualizan sin recarga.
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
    setBounce(true);
    setTimeout(() => setBounce(false), 300);

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
    ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-400 text-orange-500'
    : 'border-stone-200 dark:border-slate-700 text-stone-500 dark:text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-300 hover:text-orange-500';

  const downClass = voted === 'down'
    ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-400 text-sky-500'
    : 'border-stone-200 dark:border-slate-700 text-stone-500 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 hover:border-sky-300 hover:text-sky-500';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-all active:scale-95 disabled:cursor-not-allowed ${upClass}`}
        aria-label="Upvote"
      >
        <ThumbsUp size={12} strokeWidth={1.5} />
        <span className={bounce && voted === 'up' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.upvotes}
        </span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-all active:scale-95 disabled:cursor-not-allowed ${downClass}`}
        aria-label="Downvote"
      >
        <ThumbsDown size={12} strokeWidth={1.5} />
        <span className={bounce && voted === 'down' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.downvotes}
        </span>
      </button>
    </div>
  );
}

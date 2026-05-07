'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/apiClient';

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
    setCounts({ upvotes, downvotes });
  }, [upvotes, downvotes]);

  useEffect(() => {
    apiGet<{ voted: 'up' | 'down' | null }>(`/api/posts/${postId}/vote`).then((r) => {
      if (r.ok && r.data.voted) setVoted(r.data.voted);
    });
  }, [postId]);

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
    ? 'bg-orange-50 border-orange-400 text-orange-500'
    : 'border-gray-200 text-gray-400 hover:border-orange-300 hover:text-orange-500';

  const downClass = voted === 'down'
    ? 'bg-blue-50 border-blue-400 text-blue-500'
    : 'border-gray-200 text-gray-400 hover:border-blue-300 hover:text-blue-500';

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed ${upClass}`}
        aria-label="Upvote"
      >
        <ThumbsUp size={12} />
        <span className={bounce && voted === 'up' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.upvotes}
        </span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={!!voted}
        className={`flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs transition-colors disabled:cursor-not-allowed ${downClass}`}
        aria-label="Downvote"
      >
        <ThumbsDown size={12} />
        <span className={bounce && voted === 'down' ? 'animate-vote-bounce inline-block' : 'inline-block'}>
          {counts.downvotes}
        </span>
      </button>
    </div>
  );
}

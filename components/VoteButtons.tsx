'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
  onVoted?: () => void;
}

export function VoteButtons({ postId, upvotes, downvotes, onVoted }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    try {
      const stored: Record<string, 'up' | 'down'> = JSON.parse(
        localStorage.getItem('voted_posts_v2') ?? '{}'
      );
      if (stored[postId]) setVoted(stored[postId]);
    } catch {
      // localStorage unavailable
    }
  }, [postId]);

  async function handleVote(voteType: 'up' | 'down') {
    if (voted) return;
    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });
      if (res.ok) {
        const data = await res.json();
        setCounts(data.votes);
        setVoted(voteType);
        setBounce(true);
        setTimeout(() => setBounce(false), 300);
        const stored: Record<string, 'up' | 'down'> = JSON.parse(
          localStorage.getItem('voted_posts_v2') ?? '{}'
        );
        stored[postId] = voteType;
        localStorage.setItem('voted_posts_v2', JSON.stringify(stored));
        onVoted?.();
      }
    } catch {
      // network error — silently fail
    }
  }

  const upClass = voted === 'up'
    ? 'bg-orange-500/15 border-orange-500 text-orange-400'
    : 'border-zinc-700 text-zinc-400 hover:border-orange-500/50 hover:text-orange-400';

  const downClass = voted === 'down'
    ? 'bg-blue-500/15 border-blue-500 text-blue-400'
    : 'border-zinc-700 text-zinc-400 hover:border-blue-500/50 hover:text-blue-400';

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

'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { castVote } from '@/lib/localStore';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
  onVoted?: () => void;
}

export function VoteButtons({ postId, upvotes, downvotes, onVoted }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted]   = useState<'up' | 'down' | null>(null);
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    try {
      const stored: Record<string, 'up' | 'down'> = JSON.parse(
        localStorage.getItem('voted_posts_v2') ?? '{}'
      );
      if (stored[postId]) setVoted(stored[postId]);
    } catch {}
  }, [postId]);

  function handleVote(voteType: 'up' | 'down') {
    if (voted) return;
    const updated = castVote(postId, voteType);
    setCounts(updated);
    setVoted(voteType);
    setBounce(true);
    setTimeout(() => setBounce(false), 300);
    try {
      const stored: Record<string, 'up' | 'down'> = JSON.parse(
        localStorage.getItem('voted_posts_v2') ?? '{}'
      );
      stored[postId] = voteType;
      localStorage.setItem('voted_posts_v2', JSON.stringify(stored));
    } catch {}
    onVoted?.();
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

'use client';
import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

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

  async function handleVote(voteType: 'up' | 'down') {
    if (voted) return;

    // optimistic update
    setCounts((prev) => ({
      upvotes:   prev.upvotes   + (voteType === 'up'   ? 1 : 0),
      downvotes: prev.downvotes + (voteType === 'down' ? 1 : 0),
    }));
    setVoted(voteType);
    setBounce(true);
    setTimeout(() => setBounce(false), 300);

    try {
      const res = await fetch(`/api/posts/${postId}/vote`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote_type: voteType }),
      });

      if (res.ok) {
        const data = await res.json();
        setCounts(data.votes);
        onVoted?.();
      } else {
        // revert on error (e.g. 409 already voted)
        setCounts({ upvotes, downvotes });
        setVoted(null);
      }
    } catch {
      setCounts({ upvotes, downvotes });
      setVoted(null);
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

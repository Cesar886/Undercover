'use client';
import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

interface VoteButtonsProps {
  postId: string;
  upvotes: number;
  downvotes: number;
}

export function VoteButtons({ postId, upvotes, downvotes }: VoteButtonsProps) {
  const [counts, setCounts] = useState({ upvotes, downvotes });
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('voted_posts') ?? '[]');
      setVoted(stored.includes(postId));
    } catch {
      // localStorage unavailable (SSR or private mode)
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
        const stored: string[] = JSON.parse(localStorage.getItem('voted_posts') ?? '[]');
        localStorage.setItem('voted_posts', JSON.stringify([...stored, postId]));
        setVoted(true);
      }
    } catch {
      // network error — silently fail
    }
  }

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => handleVote('up')}
        disabled={voted}
        className={`flex items-center gap-1 text-sm transition-colors ${
          voted ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-[#D85A30]'
        }`}
        aria-label="Upvote"
      >
        <ThumbsUp size={14} />
        <span>{counts.upvotes}</span>
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={voted}
        className={`flex items-center gap-1 text-sm transition-colors ${
          voted ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-400 hover:text-blue-400'
        }`}
        aria-label="Downvote"
      >
        <ThumbsDown size={14} />
        <span>{counts.downvotes}</span>
      </button>
    </div>
  );
}

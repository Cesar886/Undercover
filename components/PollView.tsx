'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Check } from 'lucide-react';
import { PostPoll } from '@/types';
import { apiPost } from '@/lib/apiClient';
import { useFeedEvents } from '@/components/FeedStreamProvider';

interface PollViewProps {
  postId: string;
  poll: PostPoll;
  disabled?: boolean;
  onChange?: (poll: PostPoll) => void;
  onError?: (message: string) => void;
}

function voteLabel(count: number): string {
  return `${count} voto${count === 1 ? '' : 's'}`;
}

export function PollView({ postId, poll, disabled = false, onChange, onError }: PollViewProps) {
  const [current, setCurrent] = useState<PostPoll>(poll);
  const [savingOption, setSavingOption] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(poll);
  }, [poll]);

  useFeedEvents(
    useCallback(
      (event) => {
        if (event.type !== 'post:poll' || event.postId !== postId) return;
        setCurrent((existing) => ({
          ...event.poll,
          user_vote_option_id: existing.user_vote_option_id ?? event.poll.user_vote_option_id ?? null,
        }));
      },
      [postId]
    )
  );

  const sortedOptions = useMemo(
    () => [...current.options].sort((a, b) => a.position - b.position),
    [current.options]
  );

  async function vote(optionId: string, event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || savingOption) return;

    setSavingOption(optionId);
    const result = await apiPost<{ poll: PostPoll }>(`/api/posts/${postId}/poll/vote`, {
      option_id: optionId,
    });
    setSavingOption(null);

    if (result.ok) {
      setCurrent(result.data.poll);
      onChange?.(result.data.poll);
    } else {
      onError?.(result.error);
    }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-3 dark:border-violet-500/15 dark:bg-violet-950/20">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-[#6b6a8f]">
          <BarChart3 size={13} strokeWidth={1.8} />
          Encuesta
        </div>
        <span className="text-[11px] text-stone-400 dark:text-[#4a4870]">
          {voteLabel(current.total_votes)}
        </span>
      </div>

      <div className="space-y-1.5">
        {sortedOptions.map((option) => {
          const selected = current.user_vote_option_id === option.id;
          const percent = current.total_votes > 0
            ? Math.round((option.votes / current.total_votes) * 100)
            : 0;

          return (
            <button
              key={option.id}
              type="button"
              onClick={(event) => vote(option.id, event)}
              disabled={disabled || !!savingOption}
              aria-pressed={selected}
              className={`group relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors ${
                selected
                  ? 'border-violet-300 bg-white text-violet-700 dark:border-violet-500/50 dark:bg-violet-500/10 dark:text-violet-100'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:text-stone-900 dark:border-violet-500/10 dark:bg-[#0d0b1a]/70 dark:text-[#b8b2df] dark:hover:border-violet-500/25 dark:hover:text-violet-100'
              } ${disabled ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
            >
              <span
                aria-hidden
                className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                  selected ? 'bg-violet-500/15 dark:bg-violet-400/20' : 'bg-stone-200/60 dark:bg-violet-500/10'
                }`}
                style={{ width: `${percent}%` }}
              />
              <span className="relative z-[1] flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-xs font-medium">
                  {selected && <Check size={13} strokeWidth={2} className="shrink-0" />}
                  <span className="truncate">{option.label}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-stone-400 dark:text-[#6b6a8f]">
                  {savingOption === option.id ? '...' : `${percent}% · ${option.votes}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {disabled && (
        <p className="mt-2 text-[11px] text-stone-400 dark:text-[#4a4870]">
          Encuesta cerrada
        </p>
      )}
    </div>
  );
}

export function PostSkeleton() {
  return (
    <article className="bg-white dark:bg-[#0d0b1a] border border-gray-200 dark:border-violet-500/10 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-violet-900/25" />
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-violet-900/25" />
        <div className="h-3 w-10 rounded-full bg-gray-200 dark:bg-violet-900/25" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-violet-900/25" />
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-violet-900/25" />
        <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-violet-900/25" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-14 rounded-full bg-gray-200 dark:bg-violet-900/25" />
        <div className="h-6 w-14 rounded-full bg-gray-200 dark:bg-violet-900/25" />
      </div>
    </article>
  );
}

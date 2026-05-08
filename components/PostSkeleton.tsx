export function PostSkeleton() {
  return (
    <article className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-800" />
        <div className="h-3 w-20 rounded bg-gray-200 dark:bg-slate-800" />
        <div className="h-3 w-10 rounded-full bg-gray-200 dark:bg-slate-800" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-slate-800" />
        <div className="h-3 w-full rounded bg-gray-200 dark:bg-slate-800" />
        <div className="h-3 w-3/5 rounded bg-gray-200 dark:bg-slate-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-14 rounded-full bg-gray-200 dark:bg-slate-800" />
        <div className="h-6 w-14 rounded-full bg-gray-200 dark:bg-slate-800" />
      </div>
    </article>
  );
}

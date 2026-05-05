export function PostSkeleton() {
  return (
    <article className="bg-[#111111] border border-[#222222] rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-zinc-800" />
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-3 w-10 rounded-full bg-zinc-800" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-full rounded bg-zinc-800" />
        <div className="h-3 w-3/5 rounded bg-zinc-800" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-14 rounded-full bg-zinc-800" />
        <div className="h-6 w-14 rounded-full bg-zinc-800" />
      </div>
    </article>
  );
}

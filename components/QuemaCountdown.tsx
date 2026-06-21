'use client';
import { useState, useEffect } from 'react';

const TZ = 'America/Monterrey';

function getNextQuema(): Date {
  const now = new Date();
  // toLocaleString trick: get wall-clock Monterrey time as a "local" Date
  const mtyNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));

  const weekday = mtyNow.getDay(); // 0=Sun, 1=Mon
  const hour    = mtyNow.getHours();

  let daysToAdd = (1 - weekday + 7) % 7;
  if (daysToAdd === 0 && hour >= 5) daysToAdd = 7;

  const targetMty = new Date(mtyNow);
  targetMty.setDate(mtyNow.getDate() + daysToAdd);
  targetMty.setHours(5, 0, 0, 0);

  // Convert back to real UTC: real_target = targetMty - (mtyNow - now)
  return new Date(targetMty.getTime() - mtyNow.getTime() + now.getTime());
}

function format(ms: number): string {
  if (ms <= 0) return '¡ahora!';
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function QuemaCountdown() {
  const [ms, setMs]           = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const tick = () => setMs(getNextQuema().getTime() - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!mounted) return null;

  const urgent = ms < 3_600_000; // less than 1 hour

  return (
    <div className="flex items-center justify-center gap-1.5 py-1.5 text-[11px]">
      <span className={urgent ? 'text-orange-500 animate-pulse' : 'text-orange-400/70 dark:text-orange-500/50'}>
        🔥
      </span>
      <span className="text-gray-400 dark:text-[#4a4870]">
        Quema Total en{' '}
        <span className={`font-mono tabular-nums font-semibold ${urgent ? 'text-orange-500' : 'text-gray-500 dark:text-[#6b6a8f]'}`}>
          {format(ms)}
        </span>
        {' '}
        <span className="text-gray-300 dark:text-[#2e2b4a]">
          — Lunes 5:00 AM (Montemorelos, N.L.)
        </span>
      </span>
    </div>
  );
}

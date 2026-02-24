import { format } from 'date-fns';

/**
 * Format a date string to dd.MM.yyyy using date-fns.
 * Originally from src/utils/formatDate.ts
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '';
  return format(new Date(date), 'dd.MM.yyyy');
}

/**
 * Format a timestamp to locale time string (e.g. "2:30 PM").
 * Originally from src/components/chat/MessageBubble.tsx
 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a session timestamp: show time if today, otherwise short date.
 * Originally from src/components/chat/SessionDrawer.tsx (fmtTime / formatTime)
 */
export function formatSessionTime(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Format a number with k/M suffixes (e.g. 1200 -> "1.2k").
 * Originally from src/screens/SkillsScreen.tsx
 */
export function formatCount(n?: number): string {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

/**
 * Format a unix timestamp (seconds) to an ISO date string (YYYY-MM-DD).
 * Originally from src/screens/SkillsScreen.tsx
 */
export function formatCompactDate(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * Safely extract an error message from an unknown thrown value.
 */
export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * LinePriceOverrideBadge
 *
 * Tiny pill shown next to the line price (in cell) or next to the column
 * header (at document level) when an override is active.
 *
 * Variants:
 *  - `document` — shown in the column header area when the document-level
 *    source differs from the company/party baseline.
 *  - `line` — shown in the price cell when a per-line override is active.
 *  - `lineLocked` — same shape as `line`, but with a lock icon, used when
 *    the user explicitly chose "Lock (manual, no auto-resolve)".
 *
 * The badge is intentionally minimal: 1 line of text, no border, no
 * interaction. It is purely a visual signal that the price shown for this
 * line is NOT a fresh auto-resolution against the document default.
 */
import React from 'react';
import { Lock, Tag } from 'lucide-react';
import type { LinePriceSource } from './LinePriceSourceSelector';
import { linePriceSourceLabelEN } from './createPriceOverrideMenuItems';

export type LinePriceOverrideBadgeVariant = 'document' | 'line' | 'lineLocked';

interface LinePriceOverrideBadgeProps {
  variant: LinePriceOverrideBadgeVariant;
  /**
   * Source the override resolves to. For `lineLocked`, this is the source
   * that the line WOULD use if unlocked (informational).
   */
  source: LinePriceSource | null;
  /** Optional title (tooltip) override; default depends on variant. */
  title?: string;
  className?: string;
  /**
   * Compact rendering — drops the source name, just shows the icon + "OVR"
   * or "🔒". Used when space is tight (e.g. inside a small price cell).
   */
  compact?: boolean;
}

export function LinePriceOverrideBadge({
  variant,
  source,
  title,
  className,
  compact = false,
}: LinePriceOverrideBadgeProps) {
  const isLocked = variant === 'lineLocked';
  const Icon = isLocked ? Lock : Tag;
  const baseClass =
    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide';
  const variantClass = isLocked
    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-800'
    : variant === 'document'
      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 ring-1 ring-indigo-200 dark:ring-indigo-800'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800';
  const defaultTitle = isLocked
    ? 'Line is locked — price is manual and will not be auto-resolved'
    : variant === 'document'
      ? `Document override: ${linePriceSourceLabelEN(source)}`
      : `Line override: ${linePriceSourceLabelEN(source)}`;
  const label = isLocked
    ? compact
      ? '🔒'
      : '🔒 Locked'
    : compact
      ? 'OVR'
      : `Override${source ? `: ${linePriceSourceLabelEN(source)}` : ''}`;

  return (
    <span
      title={title ?? defaultTitle}
      aria-label={title ?? defaultTitle}
      className={`${baseClass} ${variantClass} ${className ?? ''}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

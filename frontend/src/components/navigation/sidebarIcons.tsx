import React from 'react';
import * as Lucide from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

// Custom enhanced 2gears Line Art Icon component using SVG rotation groups
const TwoGearsIcon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }> = ({ className, strokeWidth = 2, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="24"
      height="24"
      className={className}
      {...props}
    >
      {/* Gear 1 (larger, top-left, 8 teeth) */}
      <g>
        <circle cx="9" cy="9" r="3.5" />
        <circle cx="9" cy="9" r="1.2" />
        {/* Teeth */}
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(45 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(90 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(135 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(180 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(225 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(270 9 9)" />
        <path d="M8.2 5.5 L8.5 3.5 H9.5 L9.8 5.5" transform="rotate(315 9 9)" />
      </g>

      {/* Gear 2 (smaller, bottom-right, 6 teeth) */}
      <g>
        <circle cx="16.5" cy="16.5" r="2.2" />
        <circle cx="16.5" cy="16.5" r="0.8" />
        {/* Teeth */}
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" />
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" transform="rotate(60 16.5 16.5)" />
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" transform="rotate(120 16.5 16.5)" />
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" transform="rotate(180 16.5 16.5)" />
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" transform="rotate(240 16.5 16.5)" />
        <path d="M15.9 14.3 L16.1 12.8 H16.9 L17.1 14.3" transform="rotate(300 16.5 16.5)" />
      </g>
    </svg>
  );
};

// Custom Sales Icon: ClipboardList with Large Up-Trending Arrow (Same Color)
const ClipboardUpTrendIcon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }> = ({ className, strokeWidth = 2, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="24"
      height="24"
      className={className}
      {...props}
    >
      {/* Clipboard board */}
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      {/* Clipboard clip */}
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      
      {/* Clipboard list lines */}
      <path d="M8 8h8" />
      <path d="M8 12h4" />

      {/* Up-trending line (large) */}
      <path d="M7 18 L11 13 L13 15 L18 10" />
      {/* Arrow head */}
      <path d="M14 10h4v4" />
    </svg>
  );
};

// Custom Purchases Icon: ClipboardList with Large Down-Trending Arrow (Same Color)
const ClipboardDownTrendIcon: React.FC<React.SVGProps<SVGSVGElement> & { strokeWidth?: number }> = ({ className, strokeWidth = 2, ...props }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="24"
      height="24"
      className={className}
      {...props}
    >
      {/* Clipboard board */}
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      {/* Clipboard clip */}
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      
      {/* Clipboard list lines */}
      <path d="M8 8h8" />
      <path d="M8 12h4" />

      {/* Down-trending line (large) */}
      <path d="M7 11 L11 15 L13 13 L18 18" />
      {/* Arrow head */}
      <path d="M14 18h4v-4" />
    </svg>
  );
};

/**
 * Resolves an icon name to a Lucide icon component.
 * Falls back to null if the icon name is not found in lucide-react.
 */
export const resolveSidebarIcon = (name?: string | null): IconComponent | null => {
  if (!name) return null;
  if (name === '2gears') return TwoGearsIcon;
  if (name === 'ClipboardUpTrend') return ClipboardUpTrendIcon;
  if (name === 'ClipboardDownTrend') return ClipboardDownTrendIcon;
  return (Lucide as any)[name] ?? null;
};

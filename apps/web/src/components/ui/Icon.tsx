import type { ReactNode } from 'react';

const PATHS = {
  fullscreen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  exit: <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  dice: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <g fill="currentColor" stroke="none">
        <circle cx="8.5" cy="8.5" r="1.7" />
        <circle cx="15.5" cy="15.5" r="1.7" />
        <circle cx="12" cy="12" r="1.7" />
        <circle cx="15.5" cy="8.5" r="1.7" />
        <circle cx="8.5" cy="15.5" r="1.7" />
      </g>
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  play: <path d="M7 5l12 7-12 7z" fill="currentColor" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

interface Props {
  name: IconName;
  className?: string;
}

/** Inline stroke icon (1em square, inherits the text color). Decorative: label the parent control. */
export function Icon({ name, className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? 'size-[1em] shrink-0'}
    >
      {PATHS[name]}
    </svg>
  );
}

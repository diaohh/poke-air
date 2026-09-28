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
  back: <path d="M15 5l-7 7 7 7" />,
  flag: <path d="M5 21V4M5 4h11l-2 4 2 4H5" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" />
    </>
  ),
  undo: <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" />,
  refresh: <path d="M20 12a8 8 0 11-2.3-5.7M20 4v5h-5" />,
  sound: <path d="M4 9v6h4l5 4V5L8 9H4zM16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />,
  soundOff: <path d="M4 9v6h4l5 4V5L8 9H4zM17 9l5 6M22 9l-5 6" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="M15 15l5 5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
      <path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5" />
    </>
  ),
  save: <path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
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

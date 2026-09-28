/** Joins class names, skipping falsy values: `cn('btn', active && 'btn--primary')`. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

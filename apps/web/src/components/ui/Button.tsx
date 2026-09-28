import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type ButtonVariant = 'primary' | 'gold' | 'ghost' | 'ok' | 'team-red' | 'team-blue';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  /** Host-sized: deeper 3D edge. */
  xl?: boolean;
  /** Pulsing glow for the screen's main call to action. */
  glow?: boolean;
}

/**
 * Chunky 3D button (styles in `styles/components/_button.scss`). Size, padding and font come from
 * the caller's Tailwind classes. Keep one `primary` per screen; team variants only for team actions.
 */
export function Button({ variant, xl, glow, className, type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={cn('btn', `btn--${variant}`, xl && 'btn--xl', glow && 'btn--glow', className)}
      {...rest}
    />
  );
}

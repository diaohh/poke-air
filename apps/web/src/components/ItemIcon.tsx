import { ITEM_ICON_SHEET } from '@poke-air/shared';
import { cn } from '../lib/cn';

interface Props {
  /** Index in the item icon sheet (`DexItem.icon`, `BattlePokemon.itemIcon`). */
  icon: number | undefined;
  /** Multiplies the 24 px icon (pixel art: integers look best). */
  scale?: number;
  className?: string;
}

/**
 * An item's icon cut from Showdown's self-hosted item icon sheet (decision D-42). Always shown next
 * to the item's name, so screen readers skip it. Until `pnpm fetch:sprites` has downloaded the
 * sheet it simply stays empty.
 */
export function ItemIcon({ icon, scale = 1, className }: Props) {
  if (icon === undefined) return null;
  const { url, size, columns } = ITEM_ICON_SHEET;
  const px = size * scale;
  return (
    <span
      aria-hidden="true"
      className={cn('pixelated inline-block shrink-0 bg-no-repeat', className)}
      style={{
        width: px,
        height: px,
        backgroundImage: `url(${url})`,
        backgroundSize: `${columns * px}px auto`,
        backgroundPosition: `${-(icon % columns) * px}px ${-Math.floor(icon / columns) * px}px`,
      }}
    />
  );
}

/**
 * Trainer avatars players can pick. IDs match Pokémon Showdown trainer sprite file names
 * (`/sprites/trainers/<id>.png`), which `packages/data` downloads once for self-hosting.
 * Display names live in the web i18n resources (`trainers.<id>`), not here.
 */
export const TRAINER_AVATARS = [
  'red',
  'blue',
  'lance',
  'misty',
  'brock',
  'sabrina',
  'giovanni',
  'ethan',
  'lyra',
  'kris',
  'karen',
  'may',
  'brendan',
  'steven',
  'wallace',
  'dawn',
  'lucas',
  'cynthia',
  'volo',
  'hilbert',
  'hilda',
  'n',
  'iris',
  'serena',
  'calem',
  'diantha',
  'elio',
  'selene',
  'kukui',
  'lillie',
  'gladion',
  'victor',
  'gloria',
  'leon',
  'hop',
  'marnie',
  'raihan',
  'geeta',
  'penny',
  'kieran',
  'carmine',
] as const;

export type TrainerAvatar = (typeof TRAINER_AVATARS)[number];

export function isTrainerAvatar(value: string): value is TrainerAvatar {
  return (TRAINER_AVATARS as readonly string[]).includes(value);
}

export function randomTrainerAvatar(random: () => number = Math.random): TrainerAvatar {
  return TRAINER_AVATARS[Math.floor(random() * TRAINER_AVATARS.length)] ?? 'red';
}

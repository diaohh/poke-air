import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@poke-air/shared';

export type RandomInt = (maxExclusive: number) => number;

export function generateRoomCode(randomInt: RandomInt): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

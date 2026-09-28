import { SAVED_TEAMS_MAX } from '@poke-air/shared';
import { local } from './storage';

/**
 * Teams saved on this phone (decision D-39): named Showdown texts in localStorage. Loading one
 * sends the text through `team:import`, so the server validates it like any paste.
 */
export interface SavedTeam {
  id: string;
  name: string;
  /** Showdown team text. */
  text: string;
  /** Species in the team, for the list preview. */
  species: string[];
  savedAt: number;
}

const KEY = 'savedTeams';

export function listSavedTeams(): SavedTeam[] {
  const teams = local.get<SavedTeam[]>(KEY);
  return Array.isArray(teams) ? teams : [];
}

/** Adds a team (newest first); a team with the same name is replaced. Keeps the latest 30. */
export function saveTeam(name: string, text: string, species: string[]): SavedTeam[] {
  const team: SavedTeam = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    text,
    species,
    savedAt: Date.now(),
  };
  const teams = [team, ...listSavedTeams().filter((t) => t.name !== name)].slice(
    0,
    SAVED_TEAMS_MAX,
  );
  local.set(KEY, teams);
  return teams;
}

export function deleteSavedTeam(id: string): SavedTeam[] {
  const teams = listSavedTeams().filter((t) => t.id !== id);
  local.set(KEY, teams);
  return teams;
}

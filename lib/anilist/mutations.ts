/**
 * All AniList GraphQL mutations used by AniSync.
 *
 * These run only through `executeUserQuery` / `executeAuthorizedQuery`
 * in `lib/anilist/client.ts` — every mutation requires the per-user
 * OAuth access token (never a public request), because AniList scopes
 * list writes to the token owner's account.
 *
 * Input shapes are re-exported from `types/anilist.ts` so route
 * handlers and the bot can construct payloads without duplicating
 * type definitions.
 */

import type { RequestDocument } from "graphql-request";

import type {
  FuzzyDate,
  MediaListStatus,
  SaveMediaListEntryInput,
} from "@/types/anilist";

export type { SaveMediaListEntryInput };

/* ------------------------------------------------------------------ */
/* SaveMediaListEntry — the core 2-way sync mutation                   */
/* ------------------------------------------------------------------ */

export const SAVE_MEDIA_LIST_ENTRY = /* GraphQL */ `
  mutation SaveMediaListEntry(
    $mediaId: Int!
    $status: MediaListStatus
    $progress: Int
    $score: Float
    $notes: String
    $startedAt: FuzzyDateInput
    $completedAt: FuzzyDateInput
    $private: Boolean
  ) {
    SaveMediaListEntry(
      mediaId: $mediaId
      status: $status
      progress: $progress
      score: $score
      notes: $notes
      startedAt: $startedAt
      completedAt: $completedAt
      private: $private
    ) {
      id
      mediaId
      status
      progress
      score
      notes
      updatedAt
      startedAt {
        year
        month
        day
      }
      completedAt {
        year
        month
        day
      }
    }
  }
` as RequestDocument;

/** The updated list entry returned by SaveMediaListEntry. */
export interface SavedMediaListEntry {
  id: number;
  mediaId: number;
  status: MediaListStatus | null;
  progress: number | null;
  score: number | null;
  notes: string | null;
  updatedAt: number;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
}

export interface SaveMediaListEntryResult {
  SaveMediaListEntry: SavedMediaListEntry | null;
}

/* ------------------------------------------------------------------ */
/* UpdateUser — persists dashboard preferences back to AniList         */
/* ------------------------------------------------------------------ */

export const UPDATE_USER = /* GraphQL */ `
  mutation UpdateUser($titleLanguage: UserTitleLanguage) {
    UpdateUser(titleLanguage: $titleLanguage) {
      id
      name
      options {
        titleLanguage
      }
    }
  }
` as RequestDocument;

export interface UpdateUserResult {
  UpdateUser: {
    id: number;
    name: string;
    options: { titleLanguage: string | null } | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* Helpers — build mutation variables from partial dashboard payloads  */
/* ------------------------------------------------------------------ */

/**
 * Build the variables object for SaveMediaListEntry from a partial
 * dashboard payload. `undefined` fields are omitted entirely so AniList
 * does not overwrite existing values with nulls (partial updates only
 * touch the fields the user actually changed).
 */
export function buildSaveEntryVariables(
  mediaId: number,
  input: Partial<SaveMediaListEntryInput>,
): {
  mediaId: number;
  status?: MediaListStatus;
  progress?: number;
  score?: number;
  notes?: string;
  startedAt?: { year?: number; month?: number; day?: number };
  completedAt?: { year?: number; month?: number; day?: number };
  private?: boolean;
} {
  const variables: {
    mediaId: number;
    status?: MediaListStatus;
    progress?: number;
    score?: number;
    notes?: string;
    startedAt?: { year?: number; month?: number; day?: number };
    completedAt?: { year?: number; month?: number; day?: number };
    private?: boolean;
  } = { mediaId };

  if (input.status !== undefined) variables.status = input.status;
  if (input.progress !== undefined) variables.progress = input.progress;
  if (input.score !== undefined) variables.score = input.score;
  if (input.notes !== undefined) variables.notes = input.notes;
  if (input.private !== undefined) variables.private = input.private;
  if (input.startedAt !== undefined) variables.startedAt = input.startedAt;
  if (input.completedAt !== undefined) variables.completedAt = input.completedAt;

  return variables;
}

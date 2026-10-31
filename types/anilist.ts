/**
 * AniList media data model — single source of truth for all AniList data
 * structures across the client, API routes, components, and Discord embeds.
 */

export type MediaFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC"
  | "MANGA"
  | "NOVEL"
  | "ONE_SHOT";

export type MediaStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export type MediaListStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "DROPPED"
  | "PAUSED"
  | "REPEATING";

export type RelationType =
  | "ADAPTATION"
  | "PREQUEL"
  | "SEQUEL"
  | "PARENT"
  | "SIDE_STORY"
  | "CHARACTER"
  | "SUMMARY"
  | "ALTERNATIVE"
  | "SPIN_OFF"
  | "OTHER"
  | "SOURCE"
  | "COMPILATION"
  | "CONTAINS";

export type Season =
  | "WINTER"
  | "SPRING"
  | "SUMMER"
  | "FALL";

export interface FuzzyDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface AniListTitle {
  romaji: string;
  english: string | null;
  native: string;
  userPreferred: string;
}

export interface AniListCoverImage {
  extraLarge: string;
  large: string;
  medium: string;
  color: string | null;
}

export interface AniListTrailer {
  id: string;
  site: "youtube" | "dailymotion";
  thumbnail: string | null;
}

export interface NextAiringEpisode {
  id: number;
  airingAt: number; // Unix timestamp
  timeUntilAiring: number; // Seconds until airing
  episode: number;
}

export interface MediaTag {
  id: number;
  name: string;
  description: string;
  category: string;
  rank: number; // 0–100, relevance/prevalence
  isGeneralSpoiler: boolean;
  isMediaSpoiler: boolean;
  isAdult: boolean;
}

export interface StudioNode {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  siteUrl: string | null;
}

export interface CharacterEdge {
  role: "MAIN" | "SUPPORTING" | "BACKGROUND";
  node: {
    id: number;
    name: { full: string; native: string | null };
    image: { large: string; medium: string };
    gender: string | null;
    age: string | null;
    description: string | null;
  };
  voiceActors: Array<{
    id: number;
    name: { full: string; native: string | null };
    image: { large: string };
    languageV2: string | null;
  }>;
}

export interface StaffEdge {
  role: string;
  node: {
    id: number;
    name: { full: string };
    image: { large: string };
  };
}

export interface RelationEdge {
  relationType: RelationType;
  node: {
    id: number;
    type: "ANIME" | "MANGA";
    title: { userPreferred: string };
    coverImage: { medium: string };
    format: MediaFormat;
    status: MediaStatus;
  };
}

export interface ExternalLink {
  id: number;
  url: string;
  site: string;
  type: "STREAMING" | "SOCIAL" | "INFO" | "OFFICIAL";
  icon: string | null;
  color: string | null;
}

export interface StreamingEpisode {
  title: string | null;
  thumbnail: string | null;
  url: string;
  site: string;
}

export interface RecommendationNode {
  rating: number;
  mediaRecommendation: {
    id: number;
    title: { userPreferred: string };
    coverImage: { large: string };
    averageScore: number | null;
  } | null;
}

export interface ScoreDistributionEntry {
  score: number;
  amount: number;
}

export interface StatusDistributionEntry {
  status: MediaListStatus;
  amount: number;
}

export interface MediaListEntry {
  id: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  priority: number;
  private: boolean;
  notes: string | null;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
  updatedAt: number;
}

/** The full enhanced media model powering the premium UI. */
export interface AniListMedia {
  // Core identity
  id: number;
  idMal: number | null;
  type: "ANIME" | "MANGA";
  format: MediaFormat;
  status: MediaStatus;

  // Titles
  title: AniListTitle;

  // Visual assets (all variants for responsive/HiDPI rendering)
  coverImage: AniListCoverImage;
  bannerImage: string | null;
  trailer: AniListTrailer | null;

  // Episode / chapter data
  episodes: number | null;
  duration: number | null;
  season: Season | null;
  seasonYear: number | null;

  // Airing info
  startDate: FuzzyDate;
  endDate: FuzzyDate;
  nextAiringEpisode: NextAiringEpisode | null;

  // Ratings & popularity
  averageScore: number | null;
  meanScore: number | null;
  popularity: number;
  favourites: number;

  // Classification
  genres: string[];
  tags: MediaTag[];
  isAdult: boolean;

  // Production
  studios: { nodes: StudioNode[] };

  // Characters (for character carousel UI)
  characters: { edges: CharacterEdge[] };

  // Staff (Director, Composer, etc.)
  staff: { edges: StaffEdge[] };

  // Related media
  relations: { edges: RelationEdge[] };

  // External links (for streaming badges)
  externalLinks: ExternalLink[];

  // Streaming episodes (if available)
  streamingEpisodes: StreamingEpisode[];

  // Recommendations
  recommendations: { nodes: RecommendationNode[] };

  // Stats for data visualization
  stats: {
    scoreDistribution: ScoreDistributionEntry[];
    statusDistribution: StatusDistributionEntry[];
  };

  // User-specific data (populated when user is authenticated)
  mediaListEntry: MediaListEntry | null;

  // URLs
  siteUrl: string;
  description: string | null;
}

/** Watchlist entry as returned by the MediaListCollection query. */
export interface WatchlistEntry {
  id: number;
  mediaId: number;
  status: MediaListStatus;
  score: number;
  progress: number;
  progressVolumes: number | null;
  repeat: number;
  priority: number;
  private: boolean;
  notes: string | null;
  updatedAt: number;
  startedAt: FuzzyDate;
  completedAt: FuzzyDate;
  media: {
    id: number;
    idMal: number | null;
    title: AniListTitle;
    coverImage: { large: string; medium: string; color: string | null };
    bannerImage: string | null;
    episodes: number | null;
    duration: number | null;
    format: MediaFormat;
    status: MediaStatus;
    averageScore: number | null;
    genres: string[];
    nextAiringEpisode: {
      airingAt: number;
      episode: number;
      timeUntilAiring: number;
    } | null;
    externalLinks: Array<Pick<ExternalLink, "site" | "url" | "type" | "icon" | "color">>;
    studios: { nodes: Array<{ name: string; isAnimationStudio: boolean }> };
  };
}

/** Options used when saving a user's list entry. */
export interface SaveMediaListEntryInput {
  mediaId: number;
  status?: MediaListStatus;
  progress?: number;
  score?: number;
  notes?: string;
  startedAt?: FuzzyDate;
  completedAt?: FuzzyDate;
}

/** Formats an AniList score (0–100) into the matching design token color. */
export function scoreToColor(score: number | null): string {
  if (score === null) return "#171C2B";
  if (score >= 80) return "#00E676"; // excellent
  if (score >= 65) return "#76FF03"; // good
  if (score >= 50) return "#FFEA00"; // average
  if (score >= 30) return "#FF6D00"; // poor
  return "#F44336"; // bad
}

/** Strips HTML tags from AniList descriptions for safe display. */
export function stripHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

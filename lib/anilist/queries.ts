/**
 * All AniList GraphQL queries with typed result shapes.
 *
 * Every exported query is a `RequestDocument` compatible with
 * `executeQuery` / `executePublicQuery` / `executeUserQuery` in
 * `lib/anilist/client.ts`. Result interfaces map 1:1 to the fields
 * requested so the GraphQL response is fully typed end-to-end.
 */

import type { RequestDocument } from "graphql-request";

import type {
  AniListMedia,
  FuzzyDate,
  MediaListStatus,
  WatchlistEntry,
} from "@/types/anilist";

/* ------------------------------------------------------------------ */
/* GetMediaDetail — the enhanced full media query for the detail page  */
/* ------------------------------------------------------------------ */

export const GET_MEDIA_DETAIL = /* GraphQL */ `
  query GetMediaDetail($id: Int!, $userId: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      type
      format
      status
      title {
        romaji
        english
        native
        userPreferred
      }
      coverImage {
        extraLarge
        large
        medium
        color
      }
      bannerImage
      trailer {
        id
        site
        thumbnail
      }
      description(asHtml: false)
      episodes
      duration
      season
      seasonYear
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
      nextAiringEpisode {
        id
        airingAt
        timeUntilAiring
        episode
      }
      averageScore
      meanScore
      popularity
      favourites
      genres
      tags {
        id
        name
        description
        category
        rank
        isGeneralSpoiler
        isMediaSpoiler
        isAdult
      }
      isAdult
      studios {
        nodes {
          id
          name
          isAnimationStudio
          siteUrl
        }
      }
      characters(sort: [ROLE, RELEVANCE], perPage: 12) {
        edges {
          role
          node {
            id
            name {
              full
              native
            }
            image {
              large
              medium
            }
            gender
            age
            description
          }
          voiceActors(language: JAPANESE, sort: RELEVANCE) {
            id
            name {
              full
              native
            }
            image {
              large
            }
            languageV2
          }
        }
      }
      staff(sort: RELEVANCE, perPage: 8) {
        edges {
          role
          node {
            id
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
      relations {
        edges {
          relationType(version: 2)
          node {
            id
            type
            title {
              userPreferred
            }
            coverImage {
              medium
            }
            format
            status
          }
        }
      }
      externalLinks {
        id
        url
        site
        type
        icon
        color
      }
      streamingEpisodes {
        title
        thumbnail
        url
        site
      }
      recommendations(sort: RATING_DESC, perPage: 6) {
        nodes {
          rating
          mediaRecommendation {
            id
            title {
              userPreferred
            }
            coverImage {
              large
            }
            averageScore
          }
        }
      }
      stats {
        scoreDistribution {
          score
          amount
        }
        statusDistribution {
          status
          amount
        }
      }
      mediaListEntry {
        id
        status
        score
        progress
        progressVolumes
        repeat
        priority
        private
        notes
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
        updatedAt
      }
      siteUrl
    }
  }
` as RequestDocument;

export interface GetMediaDetailResult {
  Media: AniListMedia | null;
}

/* ------------------------------------------------------------------ */
/* GetUserWatchlist — rich entries for the 2-way sync table            */
/* ------------------------------------------------------------------ */

export const GET_USER_WATCHLIST = /* GraphQL */ `
  query GetUserWatchlist($userId: Int!, $status: MediaListStatus) {
    MediaListCollection(userId: $userId, type: ANIME, status: $status, sort: UPDATED_TIME_DESC) {
      lists {
        name
        status
        entries {
          id
          mediaId
          status
          score
          progress
          progressVolumes
          repeat
          priority
          private
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
          media {
            id
            idMal
            title {
              romaji
              english
              native
              userPreferred
            }
            coverImage {
              large
              medium
              color
            }
            bannerImage
            episodes
            duration
            format
            status
            averageScore
            genres
            nextAiringEpisode {
              airingAt
              episode
              timeUntilAiring
            }
            externalLinks {
              site
              url
              type
              icon
              color
            }
            studios {
              nodes {
                name
                isAnimationStudio
              }
            }
          }
        }
      }
    }
  }
` as RequestDocument;

export interface GetUserWatchlistResult {
  MediaListCollection: {
    lists: Array<{
      name: string;
      status: MediaListStatus | null;
      entries: WatchlistEntry[];
    }>;
  } | null;
}

/* ------------------------------------------------------------------ */
/* GetUserProfile — stats powering /profile and the GenreHeatmap       */
/* ------------------------------------------------------------------ */

export interface UserProfileStats {
  episodesWatched: number;
  minutesWatched: number;
  count: number;
  statusDistribution: Array<{ status: MediaListStatus; amount: number }>;
  scoreDistribution: Array<{ score: number; amount: number }>;
  genreStats: Array<{ genre: string; count: number; minutesWatched: number }>;
}

export const GET_USER_PROFILE = /* GraphQL */ `
  query GetUserProfile($userId: Int!) {
    User(id: $userId) {
      id
      name
      avatar {
        large
      }
      bannerImage
      statistics {
        anime {
          count
          episodesWatched
          minutesWatched
          statusDistribution {
            status
            amount
          }
          scoreDistribution {
            score
            amount
          }
          genres {
            genre
            count
            minutesWatched
          }
        }
      }
      favourites {
        anime(perPage: 5) {
          nodes {
            id
            title {
              userPreferred
            }
            coverImage {
              large
            }
            averageScore
          }
        }
      }
    }
  }
` as RequestDocument;

export interface FavouriteMedia {
  id: number;
  title: { userPreferred: string };
  coverImage: { large: string };
  averageScore: number | null;
}

export interface GetUserProfileResult {
  User: {
    id: number;
    name: string;
    avatar: { large: string | null } | null;
    bannerImage: string | null;
    statistics: {
      anime: UserProfileStats;
    };
    favourites: {
      anime: { nodes: FavouriteMedia[] };
    };
  } | null;
}

/* ------------------------------------------------------------------ */
/* GetAiringSchedule — /schedule command + AiringScheduleCalendar      */
/* ------------------------------------------------------------------ */

export const GET_AIRING_SCHEDULE = /* GraphQL */ `
  query GetAiringSchedule($start: Int, $end: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end) {
        id
        airingAt
        timeUntilAiring
        episode
        media {
          id
          title {
            userPreferred
          }
          coverImage {
            medium
            color
          }
          episodes
          format
          status
          averageScore
        }
      }
    }
  }
` as RequestDocument;

export interface AiringScheduleItem {
  id: number;
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  media: {
    id: number;
    title: { userPreferred: string };
    coverImage: { medium: string; color: string | null };
    episodes: number | null;
    format: string;
    status: string;
    averageScore: number | null;
  } | null;
}

export interface GetAiringScheduleResult {
  Page: {
    pageInfo: {
      total: number;
      currentPage: number;
      lastPage: number;
      hasNextPage: boolean;
    };
    airingSchedules: AiringScheduleItem[];
  } | null;
}

/* ------------------------------------------------------------------ */
/* GetMediaRecommendations — /recommend command                        */
/* ------------------------------------------------------------------ */

export const GET_MEDIA_RECOMMENDATIONS = /* GraphQL */ `
  query GetMediaRecommendations($mediaId: Int!, $page: Int) {
    Media(id: $mediaId, type: ANIME) {
      id
      title {
        userPreferred
      }
      recommendations(sort: RATING_DESC, page: $page, perPage: 10) {
        pageInfo {
          total
          currentPage
          hasNextPage
        }
        nodes {
          rating
          mediaRecommendation {
            id
            title {
              userPreferred
            }
            coverImage {
              large
            }
            averageScore
            format
            genres
          }
        }
      }
    }
  }
` as RequestDocument;

export interface MediaRecommendation {
  id: number;
  title: { userPreferred: string };
  coverImage: { large: string };
  averageScore: number | null;
  format: string;
  genres: string[];
}

export interface GetMediaRecommendationsResult {
  Media: {
    id: number;
    title: { userPreferred: string };
    recommendations: {
      pageInfo: { total: number; currentPage: number; hasNextPage: boolean };
      nodes: Array<{
        rating: number;
        mediaRecommendation: MediaRecommendation | null;
      }>;
    } | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* SearchAnime — fuzzy search for /anime and /progress commands        */
/* ------------------------------------------------------------------ */

export const SEARCH_ANIME = /* GraphQL */ `
  query SearchAnime($search: String, $perPage: Int = 6) {
    Page(perPage: $perPage) {
      pageInfo {
        hasNextPage
      }
      media(search: $search, type: ANIME, sort: SEARCH_MATCH, isAdult: false) {
        id
        title {
          romaji
          english
          native
          userPreferred
        }
        coverImage {
          medium
          color
        }
        format
        status
        episodes
        seasonYear
        averageScore
      }
    }
  }
` as RequestDocument;

export interface SearchAnimeResultItem {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string;
    userPreferred: string;
  };
  coverImage: { medium: string; color: string | null };
  format: string;
  status: string;
  episodes: number | null;
  seasonYear: number | null;
  averageScore: number | null;
}

export interface SearchAnimeResult {
  Page: {
    pageInfo: { hasNextPage: boolean };
    media: SearchAnimeResultItem[];
  } | null;
}

/* ------------------------------------------------------------------ */
/* GetViewerId — resolves the authenticated Viewer's AniList id        */
/* ------------------------------------------------------------------ */

export const GET_VIEWER = /* GraphQL */ `
  query GetViewer {
    Viewer {
      id
      name
      avatar {
        large
      }
      options {
        titleLanguage
      }
    }
  }
` as RequestDocument;

export interface GetViewerResult {
  Viewer: {
    id: number;
    name: string;
    avatar: { large: string | null } | null;
    options: { titleLanguage: string | null } | null;
  } | null;
}

/* ------------------------------------------------------------------ */
/* FuzzyDateInput helper — converts a FuzzyDate to the mutation input  */
/* ------------------------------------------------------------------ */

export interface FuzzyDateInput {
  year?: number | null;
  month?: number | null;
  day?: number | null;
}

export function toFuzzyDateInput(date: FuzzyDate | null | undefined): FuzzyDateInput | undefined {
  if (date === null || date === undefined) return undefined;
  if (date.year === null && date.month === null && date.day === null) {
    return undefined;
  }
  return { year: date.year ?? undefined, month: date.month ?? undefined, day: date.day ?? undefined };
}

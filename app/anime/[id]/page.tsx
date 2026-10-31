import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { setAuthToken, executePublicQuery } from "@/lib/anilist/client";
import {
  GET_MEDIA_DETAIL,
  type GetMediaDetailResult,
} from "@/lib/anilist/queries";
import { AnimeHeroCard } from "@/components/anime/AnimeHeroCard";
import { CharacterCarousel } from "@/components/anime/CharacterCarousel";
import { ScoreDistributionChart } from "@/components/anime/ScoreDistributionChart";
import { RelationsGraph } from "@/components/anime/RelationsGraph";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { stripHtml } from "@/types/anilist";

interface AnimeDetailPageProps {
  params: { id: string };
}

export default async function AnimeDetailPage({
  params,
}: AnimeDetailPageProps) {
  const mediaId = parseInt(params.id, 10);
  if (Number.isNaN(mediaId)) {
    notFound();
  }

  // Try to use the authenticated user's token for mediaListEntry.
  let userId: number | undefined;
  try {
    const session = await auth();
    if (session?.user?.anilistId) {
      const dbUser = await prisma.user.findUnique({
        where: { anilistId: session.user.anilistId },
        select: { encryptedAccessToken: true },
      });
      if (dbUser?.encryptedAccessToken) {
        const token = decryptToken(dbUser.encryptedAccessToken);
        setAuthToken(token);
        userId = session.user.anilistId;
      }
    }
  } catch {
    // Not authenticated — proceed with public query.
  }

  const result = await executePublicQuery<GetMediaDetailResult>(
    GET_MEDIA_DETAIL,
    { id: mediaId, userId },
    "anonymous",
    { cacheKey: `media:${mediaId}`, cacheTtlSeconds: 300 },
  );

  if (!result.Media) {
    notFound();
  }

  const media = result.Media;
  const description = stripHtml(media.description);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Hero */}
      <AnimeHeroCard media={media} />

      {/* Description */}
      {description && (
        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">Synopsis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Characters */}
      {media.characters.edges.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">
            Characters
          </h2>
          <CharacterCarousel characters={media.characters.edges} />
        </div>
      )}

      {/* Score Distribution */}
      {media.stats.scoreDistribution.length > 0 && (
        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">
              Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScoreDistributionChart
              distribution={media.stats.scoreDistribution}
              userScore={media.mediaListEntry?.score ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* Relations */}
      {media.relations.edges.length > 0 && (
        <Card className="border-space-700 bg-space-800">
          <CardHeader>
            <CardTitle className="text-lg text-foreground">
              Related
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RelationsGraph
              relations={media.relations.edges}
              currentMediaId={media.id}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
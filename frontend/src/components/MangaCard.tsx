import { useEffect, useState } from "react";
import { Link, type To } from "react-router-dom";
import { getSourceLabel } from "../constants/sourceMetadata";
import { cn, toDisplayName } from "../lib/utils";
import { fetchJson } from "../services/apiClient";
import type { ChapterImagesResponse, LocalChaptersResponse } from "../types/api";

/**
 * Propriedades do componente MangaCard.
 * @param slug - O slug único do mangá (ex: "one-piece").
 * @param className - Classes CSS adicionais do Tailwind.
 */
interface MangaCardProps {
  mangaKey: string;
  className?: string;
  to?: To;
  state?: unknown;
}

const COVER_IMAGE_CACHE = new Map<string, string | null>();
const COVER_IMAGE_REQUESTS = new Map<string, Promise<string | null>>();

/**
 * Componente que exibe um card de mangá com link para a página de leitura.
 */
function parseMangaKey(mangaKey: string): { source: string; slug: string } {
  const separatorIndex = mangaKey.indexOf("::");
  if (separatorIndex < 0) {
    return { source: "mangalivre", slug: mangaKey };
  }
  return {
    source: mangaKey.slice(0, separatorIndex),
    slug: mangaKey.slice(separatorIndex + 2),
  };
}

async function loadCoverImageUrl(mangaKey: string, source: string, slug: string): Promise<string | null> {
  if (COVER_IMAGE_CACHE.has(mangaKey)) {
    return COVER_IMAGE_CACHE.get(mangaKey) ?? null;
  }

  const pendingRequest = COVER_IMAGE_REQUESTS.get(mangaKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    try {
      const chaptersData = await fetchJson<LocalChaptersResponse>(
        `/api/mangas/${encodeURIComponent(slug)}/chapters?source=${encodeURIComponent(source)}`,
      );
      const firstChapterId = chaptersData.chapters?.[0]?.id;
      if (!firstChapterId) {
        COVER_IMAGE_CACHE.set(mangaKey, null);
        return null;
      }

      const chapterImagesData = await fetchJson<ChapterImagesResponse>(
        `/api/mangas/${encodeURIComponent(slug)}/chapters/${encodeURIComponent(firstChapterId)}/images?source=${encodeURIComponent(source)}`,
      );
      const imageUrl = chapterImagesData.images?.[0]?.url ?? null;
      COVER_IMAGE_CACHE.set(mangaKey, imageUrl);
      return imageUrl;
    } catch {
      COVER_IMAGE_CACHE.set(mangaKey, null);
      return null;
    } finally {
      COVER_IMAGE_REQUESTS.delete(mangaKey);
    }
  })();

  COVER_IMAGE_REQUESTS.set(mangaKey, request);
  return request;
}

export function MangaCard({ mangaKey, className, to, state }: MangaCardProps) {
  const { source, slug } = parseMangaKey(mangaKey);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(
    COVER_IMAGE_CACHE.has(mangaKey) ? (COVER_IMAGE_CACHE.get(mangaKey) ?? null) : null,
  );

  useEffect(() => {
    let isCancelled = false;

    void loadCoverImageUrl(mangaKey, source, slug).then((imageUrl) => {
      if (!isCancelled) {
        setCoverImageUrl(imageUrl);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [mangaKey, slug, source]);

  return (
    <Link
      to={to ?? "/leitura"}
      state={state ?? { mangaSlug: slug, source }}
      className={cn(
        "group min-h-56 border border-neutral-900/20 bg-white p-4 transition hover:border-neutral-900 dark:border-neutral-100/20 dark:bg-neutral-900 dark:hover:border-neutral-100/50",
        className,
      )}
    >
      <div className="mb-3 flex h-36 items-center justify-center rounded-2xl border border-neutral-900/10 bg-neutral-100 dark:border-neutral-100/10 dark:bg-neutral-800">
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt={`Capa de ${toDisplayName(slug)}`}
            className="h-full w-full rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <span className="text-sm font-semibold uppercase tracking-[0.16em] text-neutral-600 dark:text-neutral-400">
            Manga
          </span>
        )}
      </div>

      <p className="m-0 text-base font-semibold capitalize text-neutral-900 dark:text-neutral-100">
        {toDisplayName(slug)}
      </p>

      <p className="m-0 mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500 transition group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-300">
        Origem: {getSourceLabel(source)}
      </p>

      <p className="m-0 mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500 transition group-hover:text-neutral-700 dark:text-neutral-500 dark:group-hover:text-neutral-300">
        Toque para ler
      </p>
    </Link>
  );
}

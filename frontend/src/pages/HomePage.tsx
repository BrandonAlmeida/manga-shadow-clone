import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { MangaCard } from "../components/MangaCard";
import { toDisplayName } from "../lib/utils";
import { fetchJson } from "../services/apiClient";
import type { LastBookmark, LastBookmarkResponse, LastContinueReadingResponse, LocalMangasResponse } from "../types/api";
import { MdMenuBook, MdPlayCircleOutline, MdWatchLater } from "react-icons/md";
import logo from "../../public/MSHCL_Black.svg";

const CARD_WIDTH = 220;
const RECENT_MANGAS_LIMIT = 10;

interface MangaBookmark {
  chapter: string;
  page: number;
  total: number;
  bookmarkAt: number;
}

interface ContinueReadingTarget {
  mangaKey: string;
  source: string;
  slug: string;
  chapter: string;
  page: number;
  readerPath: string;
}

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

function normalizeBookmark(bookmark: LastBookmark | null): MangaBookmark | null {
  if (!bookmark) {
    return null;
  }

  if (!Number.isInteger(bookmark.page) || !Number.isInteger(bookmark.total) || bookmark.page <= 0 || bookmark.total <= 0) {
    return null;
  }

  const parsedBookmarkAt = Date.parse(bookmark.bookmark_at);
  if (Number.isNaN(parsedBookmarkAt)) {
    return null;
  }

  return {
    chapter: bookmark.chapter,
    page: bookmark.page,
    total: bookmark.total,
    bookmarkAt: parsedBookmarkAt,
  };
}

function buildContinueReadingTarget(mangaKey: string, chapter: string, page: number): ContinueReadingTarget {
  const { source, slug } = parseMangaKey(mangaKey);
  return {
    mangaKey,
    source,
    slug,
    chapter,
    page,
    readerPath: `/leitura?manga=${encodeURIComponent(slug)}&source=${encodeURIComponent(source)}&chapter=${encodeURIComponent(chapter)}&page=${page}`,
  };
}

export function HomePage() {
  const [mangas, setMangas] = useState<string[]>([]);
  const [lastBookmarkByManga, setLastBookmarkByManga] = useState<Record<string, MangaBookmark | null>>({});
  const [continueReadingFromStateFile, setContinueReadingFromStateFile] = useState<ContinueReadingTarget | null>(null);
  const [filter, setFilter] = useState("");
  const [statusMessage, setStatusMessage] = useState("Carregando mangás...");
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const allCarouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        const [mangaData, continueReadingData] = await Promise.all([
          fetchJson<LocalMangasResponse>("/api/mangas"),
          fetchJson<LastContinueReadingResponse>("/api/mangas/continue-reading-last").catch(() => ({ continue_reading: null })),
        ]);
        const nextMangas = mangaData.mangas ?? [];

        if (isCancelled) {
          return;
        }

        setMangas(nextMangas);
        setStatusMessage(nextMangas.length ? "" : "Nenhum mangá encontrado.");

        const continueReadingEntry = continueReadingData.continue_reading;
        if (continueReadingEntry && nextMangas.includes(continueReadingEntry.manga_key)) {
          setContinueReadingFromStateFile(
            buildContinueReadingTarget(
              continueReadingEntry.manga_key,
              continueReadingEntry.chapter,
              continueReadingEntry.page,
            ),
          );
        } else {
          setContinueReadingFromStateFile(null);
        }

        if (!nextMangas.length) {
          setLastBookmarkByManga({});
          return;
        }

        const entries = await Promise.all(
          nextMangas.map(async (mangaKey) => {
            const { source, slug } = parseMangaKey(mangaKey);
            try {
              const data = await fetchJson<LastBookmarkResponse>(`/api/mangas/${slug}/bookmark-last?source=${source}`);
              return [mangaKey, normalizeBookmark(data.bookmark)] as const;
            } catch {
              return [mangaKey, null] as const;
            }
          }),
        );

        if (isCancelled) {
          return;
        }

        setLastBookmarkByManga(Object.fromEntries(entries));
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Falha ao carregar dados.";
        setMangas([]);
        setLastBookmarkByManga({});
        setContinueReadingFromStateFile(null);
        setStatusMessage(message);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, []);

  const scrollCarousel = useCallback((carouselElement: HTMLDivElement | null, direction: "left" | "right") => {
    if (!carouselElement) {
      return;
    }
    const offset = direction === "left" ? -CARD_WIDTH : CARD_WIDTH;
    carouselElement.scrollBy({ left: offset, behavior: "smooth" });
  }, []);

  const mangaSet = useMemo(() => new Set(mangas), [mangas]);

  const continueReadingManga = useMemo(() => {
    if (continueReadingFromStateFile && mangaSet.has(continueReadingFromStateFile.mangaKey)) {
      return continueReadingFromStateFile;
    }

    let selectedMangaKey: string | null = null;
    let selectedBookmark: MangaBookmark | null = null;

    for (const mangaKey of mangas) {
      const bookmark = lastBookmarkByManga[mangaKey];
      if (!bookmark) {
        continue;
      }

      if (!selectedBookmark || bookmark.bookmarkAt > selectedBookmark.bookmarkAt) {
        selectedMangaKey = mangaKey;
        selectedBookmark = bookmark;
      }
    }

    if (!selectedMangaKey || !selectedBookmark) {
      return null;
    }

    return buildContinueReadingTarget(selectedMangaKey, selectedBookmark.chapter, selectedBookmark.page);
  }, [continueReadingFromStateFile, lastBookmarkByManga, mangaSet, mangas]);

  const normalizedFilter = filter.trim().toLowerCase();

  const filteredMangas = useMemo(
    () =>
      mangas.filter((mangaKey) => {
        const { slug } = parseMangaKey(mangaKey);
        return toDisplayName(slug).toLowerCase().includes(normalizedFilter);
      }),
    [mangas, normalizedFilter],
  );
  const recentMangas = mangas.slice(0, RECENT_MANGAS_LIMIT);

  return (
    <main className="mx-auto grid w-full gap-6 px-4 py-6 pb-16 md:px-6 md:py-8">
      <section className="overflow-hidden bg-neutral-100 dark:bg-neutral-950">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex justify-center items-center">
            <img
              src={logo}
              alt="logo"
              className="w-40 dark:invert"
            />
            <div className="flex flex-col ">
              <p className="m-0 text-xs font-semibold uppercase tracking-[0.18em]">MangaShadow</p>
              <p className="m-0 max-w-xl text-sm text-neutral-700 md:text-base dark:text-neutral-300">
                Biblioteca offline e open-source para leitura de mangás.
              </p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="p-4 md:p-5">
            <div>
              <CardTitle className="md:text-xl flex items-center gap-2">
                <MdPlayCircleOutline />
                <span>Continuar lendo</span>
              </CardTitle>
              <CardDescription>Retome no último capítulo e na última página marcados.</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4 pt-0 md:p-5 md:pt-0">
            {!continueReadingManga ? (
              <p className="m-0 rounded-2xl border border-dashed border-neutral-900/25 bg-white/60 px-4 py-8 text-center text-sm text-neutral-700 dark:border-neutral-100/25 dark:bg-neutral-900/60 dark:text-neutral-300">
                Nenhum progresso de leitura encontrado ainda.
              </p>
            ) : (
              <div className="flex justify-center sm:justify-start">
                <MangaCard
                  mangaKey={continueReadingManga.mangaKey}
                  to={continueReadingManga.readerPath}
                  state={{
                    mangaSlug: continueReadingManga.slug,
                    source: continueReadingManga.source,
                    chapterSlug: continueReadingManga.chapter,
                  }}
                  className="w-full max-w-[220px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between p-4 md:p-5">
            <div>
              <CardTitle className="md:text-xl flex items-center gap-2">
                <MdWatchLater />
                <span>Recentes</span>
              </CardTitle>
              <CardDescription>Últimos mangás adicionados localmente.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scrollCarousel(carouselRef.current, "left")}
                aria-label="Voltar lista"
              >
                <FiArrowLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scrollCarousel(carouselRef.current, "right")}
                aria-label="Avançar lista"
              >
                <FiArrowRight />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 p-4 pt-0 md:p-5 md:pt-0">
            {!recentMangas.length ? (
              <p className="m-0 rounded-2xl border border-dashed border-neutral-900/25 bg-white/60 px-4 py-8 text-center text-sm text-neutral-700 dark:border-neutral-100/25 dark:bg-neutral-900/60 dark:text-neutral-300">
                {statusMessage || "Nenhum mangá baixado encontrado."}
              </p>
            ) : (
              <div
                ref={carouselRef}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {recentMangas.map((manga) => (
                  <MangaCard
                    key={manga}
                    mangaKey={manga}
                    className="w-[220px] shrink-0 snap-start"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between p-4 md:p-5">
            <div>
              <CardTitle className="md:text-xl flex items-center gap-2">
                <MdMenuBook />
                <span>Todos</span>
              </CardTitle>
              <CardDescription>Filtre e abra qualquer mangá disponível na biblioteca local.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scrollCarousel(allCarouselRef.current, "left")}
                aria-label="Voltar lista completa"
              >
                <FiArrowLeft />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => scrollCarousel(allCarouselRef.current, "right")}
                aria-label="Avançar lista completa"
              >
                <FiArrowRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 md:p-5 md:pt-0">
            <Input
              placeholder="Filtrar mangá"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />

            {!filteredMangas.length ? (
              <p className="m-0 rounded-2xl border border-dashed border-neutral-900/25 bg-white/60 px-4 py-8 text-center text-sm text-neutral-700 dark:border-neutral-100/25 dark:bg-neutral-900/60 dark:text-neutral-300">
                {statusMessage || "Nenhum mangá encontrado para o filtro informado."}
              </p>
            ) : (
              <div
                ref={allCarouselRef}
                className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {filteredMangas.map((manga) => (
                  <MangaCard
                    key={manga}
                    mangaKey={manga}
                    className="w-[220px] shrink-0 snap-start"
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

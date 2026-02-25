import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { MdCheckCircle, MdCheckCircleOutline } from "react-icons/md";
import { getSourceLabel } from "../constants/sourceMetadata";
import { ReaderBar } from "../components/ReaderBar";
import { useCursorAutoHide } from "../hooks/useCursorAutoHide";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/ui/tooltip";
import { fetchJson, postJson } from "../services/apiClient";
import type {
  BookmarkResultResponse,
  ChapterImagesResponse,
  ContinueReadingResultResponse,
  ExportResponse,
  LastBookmark,
  LastBookmarkResponse,
  LocalChaptersResponse,
  LocalMangasResponse,
  ReadStateResponse,
  ReadToggleResponse,
} from "../types/api";
import { MdPictureAsPdf, MdSearch } from "react-icons/md";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

interface SelectChapterOptions {
  targetPage?: number;
  mangaSlug?: string;
  source?: string;
  syncQuery?: boolean;
}

interface SelectMangaOptions {
  syncQuery?: boolean;
}

interface ReaderNavigationState {
  mangaSlug?: string;
  chapterSlug?: string;
  source?: string;
  page?: number;
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

function buildMangaKey(source: string, slug: string): string {
  return `${source}::${slug}`;
}

const MOBILE_SECTION_SCROLL_OFFSET = 70;

export function ReaderPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mangas, setMangas] = useState<string[]>([]);
  const [mangaFilter, setMangaFilter] = useState("");
  const [chapterFilter, setChapterFilter] = useState("");
  const [activeManga, setActiveManga] = useState<string | null>(null);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);
  const [localChapters, setLocalChapters] = useState<string[]>([]);
  const [chapterByRemoteSlug, setChapterByRemoteSlug] = useState<Record<string, string>>({});
  const [images, setImages] = useState<Array<{ name: string; url: string }>>([]);
  const [readStates, setReadStates] = useState<Record<string, boolean>>({});
  const [bookmarkPages, setBookmarkPages] = useState<Record<string, number>>({});
  const [lastBookmark, setLastBookmark] = useState<LastBookmark | null>(null);
  const [, setChapterStatus] = useState("Selecione um mangá");
  const [, setReaderSubtitle] = useState("Selecione um capítulo para iniciar.");
  const [readerTitle, setReaderTitle] = useState("Leitor");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(() => {
    try {
      const storedZoomLevel = Number(localStorage.getItem("reader:zoom-level"));
      if (Number.isFinite(storedZoomLevel) && storedZoomLevel >= 0 && storedZoomLevel <= 300) {
        return storedZoomLevel;
      }
      return 100;
    } catch {
      return 100;
    }
  });
  const [exportMode, setExportMode] = useState(false);
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [isReaderActionsOpen, setIsReaderActionsOpen] = useState(false);
  const [isReaderBarHidden, setIsReaderBarHidden] = useState(true);

  const readerPagesRef = useRef<HTMLDivElement | null>(null);
  const chaptersSectionRef = useRef<HTMLElement | null>(null);
  const readerSectionRef = useRef<HTMLElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingTargetPageRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);

  const hasReaderPages = images.length > 0;
  const isReaderCursorHidden = useCursorAutoHide(readerPagesRef, { enabled: hasReaderPages });
  const isMobile = useMemo(() => window.matchMedia("(max-width: 900px)").matches, []);
  const isElectronRuntime = useMemo(() => Boolean(window.electronAPI), []);

  const scrollToSectionOnMobile = useCallback(
    (targetRef: { current: HTMLElement | null }) => {
      if (!isMobile) {
        return;
      }

      window.requestAnimationFrame(() => {
        const targetElement = targetRef.current;
        if (!targetElement) {
          return;
        }

        const targetPosition =
          targetElement.getBoundingClientRect().top + window.scrollY - MOBILE_SECTION_SCROLL_OFFSET;
        window.scrollTo({ top: Math.max(0, targetPosition), behavior: "smooth" });
      });
    },
    [isMobile],
  );

  const filteredMangas = useMemo(
    () => mangas.filter((mangaKey) => parseMangaKey(mangaKey).slug.toLowerCase().includes(mangaFilter.toLowerCase())),
    [mangas, mangaFilter],
  );

  const chapterCollator = useMemo(() => new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" }), []);

  const sortedLocalChapters = useMemo(
    () =>
      [...localChapters].sort((firstChapter, secondChapter) => chapterCollator.compare(firstChapter, secondChapter)),
    [chapterCollator, localChapters],
  );

  const filteredChapters = useMemo(
    () => sortedLocalChapters.filter((chapter) => chapter.toLowerCase().includes(chapterFilter.toLowerCase())),
    [chapterFilter, sortedLocalChapters],
  );

  const refreshLastBookmark = useCallback(async (mangaSlug: string, source: string) => {
    const data = await fetchJson<LastBookmarkResponse>(`/api/mangas/${mangaSlug}/bookmark-last?source=${source}`);
    const bookmark = data.bookmark;
    if (bookmark && Number.isInteger(bookmark.page) && bookmark.page > 0) {
      setLastBookmark(bookmark);
      return bookmark;
    }
    setLastBookmark(null);
    return null;
  }, []);

  const updateReaderQuery = useCallback(
    (mangaSlug: string | null, chapterSlug: string | null, source: string | null, page: number | null = null) => {
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);

          if (mangaSlug) {
            nextParams.set("manga", mangaSlug);
          } else {
            nextParams.delete("manga");
          }

          if (chapterSlug) {
            nextParams.set("chapter", chapterSlug);
          } else {
            nextParams.delete("chapter");
          }

          if (source) {
            nextParams.set("source", source);
          } else {
            nextParams.delete("source");
          }

          if (page && page > 0) {
            nextParams.set("page", String(page));
          } else {
            nextParams.delete("page");
          }

          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const closeReader = useCallback(() => {
    setActiveChapter(null);
    setReaderTitle("Leitor");
    setReaderSubtitle("Selecione um capítulo para iniciar.");
    setImages([]);
    setCurrentPage(0);
    setTotalPages(0);
    setIsReaderActionsOpen(false);
    setIsReaderBarHidden(true);
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
  }, []);

  const loadMangas = useCallback(async () => {
    const data = await fetchJson<LocalMangasResponse>("/api/mangas");
    setMangas(data.mangas ?? []);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadMangas().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Falha ao atualizar.";
        setChapterStatus(message);
      });
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [loadMangas]);

  useEffect(() => {
    try {
      localStorage.setItem("reader:zoom-level", String(zoomLevel));
    } catch {
      // Ignora falha de persistência para não interromper a UX.
    }
  }, [zoomLevel]);

  useEffect(() => {
    const navigationState = location.state as ReaderNavigationState | null;
    if (!navigationState?.mangaSlug) {
      return;
    }

    const locationSearchParams = new URLSearchParams(location.search);
    if (
      locationSearchParams.get("manga") ||
      locationSearchParams.get("chapter") ||
      locationSearchParams.get("source")
    ) {
      return;
    }

    updateReaderQuery(
      navigationState.mangaSlug,
      navigationState.chapterSlug ?? null,
      navigationState.source ?? "mangalivre",
      navigationState.page ?? null,
    );
  }, [location.search, location.state, updateReaderQuery]);

  const handleSelectManga = useCallback(
    async (mangaKey: string, options?: SelectMangaOptions) => {
      const { slug, source } = parseMangaKey(mangaKey);
      setActiveManga(mangaKey);
      setActiveChapter(null);
      setChapterFilter("");
      setExportMode(false);
      setSelectedChapters(new Set());
      setChapterByRemoteSlug({});
      setChapterStatus("Carregando capítulos...");
      setReaderTitle("Leitor");
      setReaderSubtitle("Selecione um capítulo para iniciar.");
      closeReader();
      if (options?.syncQuery !== false) {
        scrollToSectionOnMobile(chaptersSectionRef);
      }

      const [chaptersData, readData] = await Promise.all([
        fetchJson<LocalChaptersResponse>(`/api/mangas/${slug}/chapters?source=${source}`),
        fetchJson<ReadStateResponse>(`/api/mangas/${slug}/chapters/read-state?source=${source}`),
      ]);

      const chapters = chaptersData.chapters ?? [];
      const chapterIds = chapters.map((chapter) => chapter.id);
      const remoteMap = Object.fromEntries(chapters.map((chapter) => [chapter.remote_slug, chapter.id]));
      setLocalChapters(chapterIds);
      setChapterByRemoteSlug(remoteMap);
      setReadStates(readData.states ?? {});
      setBookmarkPages(readData.bookmarks ?? {});
      setChapterStatus(chapterIds.length ? "Selecione um capítulo." : "Nenhum capítulo baixado.");
      await refreshLastBookmark(slug, source);

      const firstUnreadChapter = [...chapterIds]
        .sort((firstChapter, secondChapter) => chapterCollator.compare(firstChapter, secondChapter))
        .find((chapter) => readData.states?.[chapter] !== true);

      if (options?.syncQuery !== false) {
        updateReaderQuery(slug, firstUnreadChapter ?? null, source);
      }
    },
    [chapterCollator, closeReader, refreshLastBookmark, scrollToSectionOnMobile, updateReaderQuery],
  );

  const updateReadState = useCallback(
    async (chapterSlug: string) => {
      if (!activeManga) {
        return;
      }
      const { slug: mangaSlug, source } = parseMangaKey(activeManga);
      const data = await postJson<ReadToggleResponse>(
        `/api/mangas/${mangaSlug}/chapters/${chapterSlug}/read-toggle?source=${source}`,
      );
      setReadStates((prev) => ({ ...prev, [chapterSlug]: data.read === true }));
    },
    [activeManga],
  );

  const updateCurrentPageByViewport = useCallback(() => {
    const container = readerPagesRef.current;
    if (!container) {
      return;
    }

    const pageImages = Array.from(container.querySelectorAll<HTMLImageElement>("img[data-page]"));
    if (!pageImages.length) {
      return;
    }

    const anchor = window.innerHeight * 0.2;
    let bestVisiblePage = 0;
    let bestVisibleDistance = Number.POSITIVE_INFINITY;
    let bestAnyPage = 0;
    let bestAnyDistance = Number.POSITIVE_INFINITY;

    for (const image of pageImages) {
      const page = Number(image.getAttribute("data-page") ?? "0");
      if (page <= 0) {
        continue;
      }

      const rect = image.getBoundingClientRect();
      const distance = Math.abs(rect.top - anchor);
      if (distance < bestAnyDistance) {
        bestAnyDistance = distance;
        bestAnyPage = page;
      }

      const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
      if (!isVisible) {
        continue;
      }
      if (distance < bestVisibleDistance) {
        bestVisibleDistance = distance;
        bestVisiblePage = page;
      }
    }

    const nextPage = bestVisiblePage || bestAnyPage;
    if (nextPage > 0) {
      setCurrentPage(nextPage);
    }
  }, []);

  const observeImages = useCallback(() => {
    if (!readerPagesRef.current) {
      return;
    }
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      () => {
        updateCurrentPageByViewport();
      },
      { threshold: [0, 0.01, 0.1, 0.25], rootMargin: "0px 0px -70% 0px" },
    );

    readerPagesRef.current
      .querySelectorAll<HTMLImageElement>("img[data-page]")
      .forEach((element) => observerRef.current?.observe(element));
    updateCurrentPageByViewport();
  }, [updateCurrentPageByViewport]);

  const goToPage = useCallback(
    (value: number, behavior: ScrollBehavior = "smooth") => {
      if (!readerPagesRef.current || totalPages <= 0) {
        return;
      }
      const safeValue = Math.max(1, Math.min(value, totalPages));
      const target = readerPagesRef.current.querySelector<HTMLImageElement>(`img[data-page="${safeValue}"]`);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior, block: "start" });
      setCurrentPage(safeValue);
    },
    [totalPages],
  );

  const handleSelectChapter = useCallback(
    async (chapterSlug: string, options?: SelectChapterOptions) => {
      const mangaSlug = options?.mangaSlug ?? (activeManga ? parseMangaKey(activeManga).slug : null);
      const source = options?.source ?? (activeManga ? parseMangaKey(activeManga).source : null);
      if (!mangaSlug) {
        return;
      }
      if (!source) {
        return;
      }

      if (options?.syncQuery !== false) {
        updateReaderQuery(mangaSlug, chapterSlug, source, options?.targetPage ?? null);
      }

      const resolvedChapter = chapterByRemoteSlug[chapterSlug] ?? chapterSlug;
      setActiveChapter(resolvedChapter);
      if (options?.syncQuery !== false) {
        scrollToSectionOnMobile(readerSectionRef);
      }
      setReaderTitle(`${mangaSlug.replace(/-/g, " ")}`);
      setReaderSubtitle("Carregando páginas...");

      const data = await fetchJson<ChapterImagesResponse>(
        `/api/mangas/${mangaSlug}/chapters/${resolvedChapter}/images?source=${source}`,
      );
      const nextImages = data.images ?? [];
      setImages(nextImages);

      if (!nextImages.length) {
        pendingTargetPageRef.current = null;
        setReaderSubtitle("Nenhuma imagem encontrada.");
        setCurrentPage(0);
        setTotalPages(0);
        return;
      }

      setReaderSubtitle(`${nextImages.length} páginas`);
      setCurrentPage(1);
      setTotalPages(nextImages.length);
      setIsReaderBarHidden(false);
      pendingTargetPageRef.current = options?.targetPage && options.targetPage > 0 ? options.targetPage : null;
    },
    [activeManga, chapterByRemoteSlug, scrollToSectionOnMobile, updateReaderQuery],
  );

  useEffect(() => {
    if (!activeChapter || images.length === 0) {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      pendingTargetPageRef.current = null;
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      observeImages();
      const targetPage = pendingTargetPageRef.current;
      if (targetPage && targetPage > 0) {
        goToPage(targetPage, "auto");
      }
      pendingTargetPageRef.current = null;
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeChapter, images, goToPage, observeImages]);

  useEffect(() => {
    if (!activeChapter || images.length === 0) {
      return;
    }

    let ticking = false;
    const handleScrollOrResize = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        updateCurrentPageByViewport();
      });
    };

    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize);
    handleScrollOrResize();

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [activeChapter, images, updateCurrentPageByViewport]);

  useEffect(() => {
    const mangaSlug = searchParams.get("manga");
    const chapterSlug = searchParams.get("chapter");
    const pageValue = Number(searchParams.get("page") ?? "");
    const targetPage = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : undefined;
    const source = searchParams.get("source");
    if (!mangaSlug || !source) {
      return;
    }

    const mangaKey = buildMangaKey(source, mangaSlug);

    const resolvedChapter = chapterSlug ? (chapterByRemoteSlug[chapterSlug] ?? chapterSlug) : null;
    if (activeManga === mangaKey && (resolvedChapter ? activeChapter === resolvedChapter : true)) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        if (mangas.length > 0 && !mangas.includes(mangaKey)) {
          setChapterStatus("Mangá solicitado não foi encontrado localmente.");
          return;
        }

        if (activeManga !== mangaKey) {
          await handleSelectManga(mangaKey, { syncQuery: false });
          if (isCancelled) {
            return;
          }
        }

        if (chapterSlug) {
          await handleSelectChapter(chapterSlug, {
            mangaSlug,
            source,
            targetPage,
            syncQuery: false,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Falha ao abrir capítulo solicitado.";
        setChapterStatus(message);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeChapter, activeManga, chapterByRemoteSlug, handleSelectChapter, handleSelectManga, mangas, searchParams]);

  const handleContinueFromMarkedPage = useCallback(async () => {
    if (!activeManga) {
      return;
    }
    const { slug: mangaSlug, source } = parseMangaKey(activeManga);
    const bookmark = await refreshLastBookmark(mangaSlug, source);
    if (!bookmark) {
      setChapterStatus("Nenhuma página marcada para este mangá.");
      return;
    }
    if (!localChapters.includes(bookmark.chapter)) {
      setChapterStatus("Capítulo marcado não foi encontrado localmente.");
      return;
    }
    await handleSelectChapter(bookmark.chapter, { targetPage: bookmark.page, source });

    await postJson<BookmarkResultResponse, { page: number; total: number }>(
      `/api/mangas/${mangaSlug}/chapters/${bookmark.chapter}/bookmark?source=${source}`,
      { page: bookmark.page, total: bookmark.total },
    );

    setBookmarkPages((prev) => {
      const next = { ...prev };
      delete next[bookmark.chapter];
      return next;
    });
    setLastBookmark(null);
  }, [activeManga, handleSelectChapter, localChapters, refreshLastBookmark]);

  const nextChapterSlug = useMemo(() => {
    if (!activeChapter) {
      return null;
    }

    const currentChapterIndex = sortedLocalChapters.indexOf(activeChapter);
    if (currentChapterIndex < 0 || currentChapterIndex + 1 >= sortedLocalChapters.length) {
      return null;
    }

    return sortedLocalChapters[currentChapterIndex + 1];
  }, [activeChapter, sortedLocalChapters]);

  const handleGoToNextChapter = useCallback(() => {
    if (!nextChapterSlug) {
      return;
    }

    const chapterToMarkAsRead = activeChapter;
    if (chapterToMarkAsRead && readStates[chapterToMarkAsRead] !== true) {
      void updateReadState(chapterToMarkAsRead).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Falha ao marcar capítulo atual como lido.";
        setReaderSubtitle(message);
      });
    }

    window.scrollTo({ top: 0, behavior: "auto" });

    void handleSelectChapter(nextChapterSlug, { targetPage: 1 }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Falha ao abrir próximo capítulo.";
      setReaderSubtitle(message);
    });
  }, [activeChapter, handleSelectChapter, nextChapterSlug, readStates, updateReadState]);

  const handleMarkCurrentPage = useCallback(async () => {
    if (!activeManga || !activeChapter || !hasReaderPages) {
      return;
    }

    const { slug: mangaSlug, source } = parseMangaKey(activeManga);
    const data = await postJson<BookmarkResultResponse, { page: number; total: number }>(
      `/api/mangas/${mangaSlug}/chapters/${activeChapter}/bookmark?source=${source}`,
      { page: currentPage, total: totalPages },
    );

    if (data.bookmarked && data.page) {
      setBookmarkPages((prev) => ({ ...prev, [activeChapter]: data.page ?? 0 }));
      setReaderSubtitle(`Página ${data.page} marcada.`);
      await refreshLastBookmark(mangaSlug, source);
      return;
    }

    setBookmarkPages((prev) => {
      const next = { ...prev };
      delete next[activeChapter];
      return next;
    });
    setReaderSubtitle("Marcação removida.");
    await refreshLastBookmark(mangaSlug, source);
  }, [activeChapter, activeManga, currentPage, hasReaderPages, refreshLastBookmark, totalPages]);

  const handleExportSelected = useCallback(async () => {
    if (!activeManga) {
      return;
    }
    const { slug: mangaSlug, source } = parseMangaKey(activeManga);
    const chapters = Array.from(selectedChapters);
    if (!chapters.length) {
      setChapterStatus("Selecione ao menos um capítulo.");
      return;
    }

    setChapterStatus("Gerando PDF...");
    const data = await postJson<ExportResponse, { chapters: string[] }>(
      `/api/mangas/${mangaSlug}/export?source=${source}`,
      {
        chapters,
      },
    );
    if (data.url) {
      window.location.href = data.url;
    }
    setExportMode(false);
    setSelectedChapters(new Set());
    setChapterStatus("Selecione um capítulo.");
  }, [activeManga, selectedChapters]);

  const handleConfirmChapterFilter = useCallback(() => {
    setChapterFilter((previousFilter) => previousFilter.trim());
  }, []);

  useEffect(() => {
    const onScroll = () => {
      if (!hasReaderPages) {
        setIsReaderBarHidden(true);
        return;
      }
      if (isMobile && isReaderActionsOpen) {
        setIsReaderBarHidden(false);
        lastScrollYRef.current = window.scrollY;
        return;
      }
      const currentY = window.scrollY;
      setIsReaderBarHidden(currentY > lastScrollYRef.current);
      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasReaderPages, isMobile, isReaderActionsOpen]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsReaderActionsOpen(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      if (hasReaderPages) {
        const clickTarget = event.target;
        if (!(clickTarget instanceof Node)) {
          return;
        }

        const pagesContainer = readerPagesRef.current;
        if (!pagesContainer || !pagesContainer.contains(clickTarget)) {
          return;
        }

        if (
          clickTarget instanceof Element &&
          clickTarget.closest("button, a, input, textarea, select, label, [role='button']")
        ) {
          return;
        }

        setIsReaderBarHidden((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onEscape);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onEscape);
      window.removeEventListener("click", onClick);
    };
  }, [hasReaderPages]);

  const canResumeBookmark = Boolean(activeManga && lastBookmark);
  const showChaptersPanel = Boolean(activeManga);
  const activeMangaSlug = activeManga ? parseMangaKey(activeManga).slug : null;
  const showReaderPanel = Boolean(activeChapter);

  useEffect(() => {
    if (!activeManga || !activeChapter || currentPage <= 0 || totalPages <= 0) {
      return;
    }

    const { slug: mangaSlug, source } = parseMangaKey(activeManga);
    const timerId = window.setTimeout(() => {
      void postJson<ContinueReadingResultResponse, { page: number; total: number }>(
        `/api/mangas/${mangaSlug}/chapters/${activeChapter}/continue-reading?source=${source}`,
        { page: currentPage, total: totalPages },
      ).catch(() => {
        // Ignora falha de persistência para não interromper a UX.
      });
    }, 400);

    return () => window.clearTimeout(timerId);
  }, [activeChapter, activeManga, currentPage, totalPages]);

  return (
    <TooltipProvider delayDuration={120}>
      <main className="mx-auto grid w-full gap-6 px-4 py-6 pb-16 md:px-6 md:py-8">
        <section className={`grid gap-6 ${showChaptersPanel ? "lg:grid-cols-[1.2fr_0.8fr]" : ""}`}>
          <div className="min-w-0 border border-neutral-900/15 bg-white/70 p-5 dark:border-neutral-100/15 dark:bg-neutral-900/70">
            <div className="mb-4 flex flex-col items-start gap-3">
              <div className="flex items-center justify-between w-full">
                <h2 className="m-0 text-2xl text-neutral-900 dark:text-neutral-100">Mangás</h2>
              </div>

              <div className="w-full">
                <Input
                  type="search"
                  placeholder="Filtrar mangás baixados"
                  value={mangaFilter}
                  onChange={(event) => setMangaFilter(event.target.value)}
                />
              </div>
            </div>

            <div
              className="flex flex-col gap-2 overflow-y-auto"
              aria-live="polite"
            >
              {!filteredMangas.length ? (
                <p className="m-0 text-neutral-600 dark:text-neutral-400">Nenhum mangá encontrado.</p>
              ) : (
                filteredMangas.map((mangaKey) => {
                  const { slug, source } = parseMangaKey(mangaKey);
                  return (
                    <button
                      key={mangaKey}
                      type="button"
                      className={`flex w-full items-center gap-2 border bg-white p-4 text-left transition hover:cursor-pointer hover:bg-neutral-50 dark:bg-neutral-900 dark:hover:bg-neutral-800 ${
                        activeManga === mangaKey
                          ? "border-neutral-900/50"
                          : "border-neutral-900/20 hover:border-neutral-900/35"
                      }`}
                      onClick={() => {
                        void handleSelectManga(mangaKey).catch((error: unknown) => {
                          const message = error instanceof Error ? error.message : "Falha ao carregar.";
                          setChapterStatus(message);
                        });
                      }}
                    >
                      <div className="flex flex-col">
                        <h3 className="m-0 font-serif text-sm text-neutral-900 dark:text-neutral-100">
                          {slug.replace(/-/g, " ")}
                        </h3>
                        <p className="m-0 mt-1 text-xs uppercase tracking-[0.12em] text-neutral-500 dark:text-neutral-500">
                          Origem: {getSourceLabel(source)}
                        </p>
                      </div>
                      <span className="ml-auto text-sm text-neutral-600 dark:text-neutral-400">{">"}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {showChaptersPanel ? (
            <aside
              ref={chaptersSectionRef}
              className="min-w-0 border border-neutral-900/15 bg-white/70 p-5 dark:border-neutral-100/15 dark:bg-neutral-900/70"
            >
              <div className="mb-4 flex flex-col items-start gap-3">
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    <h2 className="m-0 text-2xl text-neutral-900 dark:text-neutral-100">Capítulos</h2>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {sortedLocalChapters.length} {sortedLocalChapters.length === 1 ? "capítulo" : "capítulos"}
                    </span>
                  </div>
                  <h3 className="text-xs text-neutral-400">{activeMangaSlug}</h3>
                </div>
                <div className={`flex w-full flex-col items-center gap-2 ${activeManga ? "" : "hidden"}`}>
                  <div className="flex w-full flex-row items-stretch gap-2">
                    <Button
                      variant="secondary"
                      className="h-auto min-w-0 flex-1 flex-col whitespace-normal"
                      disabled={!canResumeBookmark}
                      onClick={() => {
                        void handleContinueFromMarkedPage().catch((error: unknown) => {
                          const message = error instanceof Error ? error.message : "Falha ao continuar leitura.";
                          setChapterStatus(message);
                        });
                      }}
                    >
                      <span>Continuar de onde marquei</span>

                      <p
                        className={`m-0 text-center text-[10px] max-w-50 md:max-w-70 truncate leading-tight text-neutral-500 dark:text-neutral-400 ${canResumeBookmark ? "" : "hidden"}`}
                      >
                        {lastBookmark ? `${lastBookmark.chapter.replace(/-/g, " ")} - p. ${lastBookmark.page}` : ""}
                      </p>
                    </Button>

                    <Button
                      variant="secondary"
                      size="icon"
                      className={activeManga ? "" : "hidden"}
                      onClick={() => setExportMode(true)}
                      disabled={exportMode || !activeManga || isElectronRuntime}
                      title={isElectronRuntime ? "Exportacao indisponivel no modo Electron." : "Exportar capitulos"}
                    >
                      <MdPictureAsPdf size={20} />
                    </Button>
                  </div>

                  <div className="flex w-full items-stretch gap-2">
                    <Input
                      type="search"
                      className="min-w-0 flex-1"
                      placeholder="Filtrar capítulos"
                      value={chapterFilter}
                      onChange={(event) => setChapterFilter(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleConfirmChapterFilter();
                        }
                      }}
                    />
                    <Button
                      variant="secondary"
                      size="icon"
                      onClick={handleConfirmChapterFilter}
                    >
                      <MdSearch size={20} />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid max-h-[320px] gap-2.5 overflow-y-auto pr-1">
                {!filteredChapters.length ? (
                  <p className="m-0 text-neutral-600 dark:text-neutral-400">Nenhum capítulo baixado.</p>
                ) : (
                  filteredChapters.map((chapter) => {
                    const isRead = readStates[chapter] === true;
                    if (exportMode) {
                      return (
                        <div
                          key={chapter}
                          className="flex items-center justify-between gap-3 border border-neutral-900/20 bg-white px-3 py-2 dark:border-neutral-100/20 dark:bg-neutral-900"
                        >
                          <label className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              className="accent-amber-700"
                              checked={selectedChapters.has(chapter)}
                              onChange={(event) => {
                                setSelectedChapters((prev) => {
                                  const next = new Set(prev);
                                  if (event.target.checked) {
                                    next.add(chapter);
                                  } else {
                                    next.delete(chapter);
                                  }
                                  return next;
                                });
                              }}
                            />
                            <span>{chapter.replace(/-/g, " ")}</span>
                          </label>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={chapter}
                        className={`flex items-center justify-between gap-3 border px-3 py-2 ${
                          activeChapter === chapter
                            ? "border-neutral-900/45 bg-neutral-200/45"
                            : isRead
                              ? "border-emerald-700/35 bg-emerald-100/40"
                              : "border-neutral-900/20 bg-white hover:border-neutral-900/35 hover:bg-neutral-50 dark:border-neutral-100/20 dark:bg-neutral-900 dark:hover:border-neutral-100/35 dark:hover:bg-neutral-800"
                        } cursor-pointer`}
                        data-chapter={chapter}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          void handleSelectChapter(chapter).catch((error: unknown) => {
                            const message = error instanceof Error ? error.message : "Falha ao abrir capítulo.";
                            setReaderSubtitle(message);
                          });
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ") {
                            return;
                          }
                          event.preventDefault();
                          void handleSelectChapter(chapter).catch((error: unknown) => {
                            const message = error instanceof Error ? error.message : "Falha ao abrir capítulo.";
                            setReaderSubtitle(message);
                          });
                        }}
                      >
                        <div className="w-full text-left text-sm">
                          <span>{chapter.replace(/-/g, " ")}</span>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={isRead ? "Marcar como não lido" : "Marcar como lido"}
                              className="h-9 w-9 rounded-full border-none bg-transparent text-neutral-700 hover:bg-neutral-200/50 dark:bg-transparent dark:text-neutral-300 dark:hover:bg-neutral-700/40"
                              onClick={(event) => {
                                event.stopPropagation();
                                void updateReadState(chapter).catch((error: unknown) => {
                                  const message =
                                    error instanceof Error ? error.message : "Falha ao atualizar leitura.";
                                  setChapterStatus(message);
                                });
                              }}
                            >
                              {isRead ? <MdCheckCircle size={18} /> : <MdCheckCircleOutline size={18} />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            sideOffset={10}
                          >
                            {isRead ? "Marcar como não lido" : "Marcar como lido"}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    );
                  })
                )}
              </div>

              <div className={`mt-3 flex justify-end gap-2.5 ${exportMode ? "" : "hidden"}`}>
                <Button
                  className="px-4 py-2 text-sm"
                  onClick={() => {
                    void handleExportSelected().catch((error: unknown) => {
                      const message = error instanceof Error ? error.message : "Falha ao exportar.";
                      setChapterStatus(message);
                    });
                  }}
                >
                  Exportar selecionados
                </Button>
                <Button
                  variant="secondary"
                  className="px-4 py-2 text-sm"
                  onClick={() => setExportMode(false)}
                >
                  Cancelar
                </Button>
              </div>
            </aside>
          ) : null}
        </section>

        {showReaderPanel ? (
          <>
            <section
              ref={readerSectionRef}
              className="border border-neutral-900/15 bg-white/70 p-5 dark:border-neutral-100/15 dark:bg-neutral-900/70"
            >
              <div className="flex flex-col md:flex-row w-full items-start justify-between gap-4">
                <div className="flex flex-col items-start">
                  <h2 className="m-0 text-sm md:text-2xl capitalize text-neutral-900 dark:text-neutral-100">
                    {readerTitle}
                  </h2>
                  <h3 className="text-xs text-neutral-500 capitalize">capítulo: {activeChapter?.replace(/-/g, " ")}</h3>
                </div>

                <div className="flex flex-col self-end md:self-start items-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">Página</span>
                    <input
                      type="number"
                      className="w-10 border border-neutral-900/20 bg-white px-2 py-1 text-sm text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-400/70 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-500/60"
                      min={1}
                      step={1}
                      value={currentPage || 0}
                      disabled={!hasReaderPages}
                      onChange={(event) => setCurrentPage(Number(event.target.value || 0))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          goToPage(Number((event.target as HTMLInputElement).value || 1));
                        }
                      }}
                    />
                    <span className="text-sm text-neutral-700 dark:text-neutral-300">/ {totalPages}</span>
                  </div>
                </div>
              </div>
            </section>

            <div
              ref={readerPagesRef}
              className={`flex flex-col items-center justify-center gap-2 md:gap-3 ${isReaderCursorHidden ? "cursor-none" : ""}`}
            >
              {images.map((image, index) => (
                <img
                  key={image.url}
                  loading="lazy"
                  alt={image.name}
                  src={image.url}
                  data-page={index + 1}
                  className="w-full"
                  style={{ width: `${zoomLevel}%` }}
                />
              ))}

              {nextChapterSlug ? (
                <div className="mt-6 mb-2 flex w-full justify-center">
                  <Button
                    className="px-5 py-2 text-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleGoToNextChapter();
                    }}
                  >
                    Próximo capítulo
                  </Button>
                </div>
              ) : null}
            </div>

            <ReaderBar
              isHidden={isReaderBarHidden}
              currentPage={currentPage}
              totalPages={totalPages}
              hasPages={hasReaderPages}
              isActionsOpen={isReaderActionsOpen}
              isBookmarked={activeChapter ? bookmarkPages[activeChapter] === currentPage : false}
              zoomLevel={zoomLevel}
              onPageChange={setCurrentPage}
              onPageSubmit={(page) => goToPage(page)}
              onToggleActions={() => setIsReaderActionsOpen((prev) => !prev)}
              onMarkPage={() => {
                void handleMarkCurrentPage().catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : "Falha ao marcar página.";
                  setReaderSubtitle(message);
                });
              }}
              onScrollToTop={() => {
                window.scrollTo({ top: 0, behavior: "smooth" });
                setIsReaderActionsOpen(false);
              }}
              onZoomIn={() => setZoomLevel((prev) => Math.min(prev + 10, 300))}
              onZoomOut={() => setZoomLevel((prev) => Math.max(prev - 10, 0))}
            />
          </>
        ) : null}
      </main>
    </TooltipProvider>
  );
}

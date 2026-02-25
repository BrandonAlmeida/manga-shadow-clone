import type { ApiError } from "../types/api";

function decodePathSegments(pathname: string): string[] {
  return pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function parseRequestUrl(url: string): URL {
  return new URL(url, "http://localhost");
}

function requireSource(searchParams: URLSearchParams): string {
  const source = searchParams.get("source")?.trim();
  if (!source) {
    throw new Error("Informe a fonte (source).");
  }
  return source;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function ensureInteger(value: unknown, fieldName: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`Informe um valor inteiro para ${fieldName}.`);
  }
  return value as number;
}

function ensureElectronApi() {
  if (!window.electronAPI) {
    throw new Error("Modo Electron indisponivel neste ambiente.");
  }
  return window.electronAPI;
}

async function handleElectronGet<T>(url: string): Promise<T> {
  const electronApi = ensureElectronApi();
  const parsedUrl = parseRequestUrl(url);
  const pathname = parsedUrl.pathname;
  const segments = decodePathSegments(pathname);

  if (pathname === "/api/settings/downloads-dir") {
    const downloadsDir = await electronApi.getLibraryDir();
    return { downloads_dir: downloadsDir } as T;
  }

  if (pathname === "/api/mangas") {
    const mangas = await electronApi.listMangas();
    return { mangas } as T;
  }

  if (pathname === "/api/mangas/continue-reading-last") {
    const continueReading = await electronApi.getLastContinueReading();
    return { continue_reading: continueReading } as T;
  }

  if (
    segments.length === 4
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "bookmark-last"
  ) {
    const mangaSlug = segments[2];
    const source = requireSource(parsedUrl.searchParams);
    const bookmark = await electronApi.getLastBookmark(mangaSlug, source);
    return { manga: mangaSlug, bookmark } as T;
  }

  if (
    segments.length === 4
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
  ) {
    const mangaSlug = segments[2];
    const source = requireSource(parsedUrl.searchParams);
    const chapters = await electronApi.listChapters(mangaSlug, source);
    return { manga: mangaSlug, chapters } as T;
  }

  if (
    segments.length === 5
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
    && segments[4] === "read-state"
  ) {
    const mangaSlug = segments[2];
    const source = requireSource(parsedUrl.searchParams);
    const data = await electronApi.getReadState(mangaSlug, source);
    return {
      manga: mangaSlug,
      states: data.states,
      bookmarks: data.bookmarks,
    } as T;
  }

  if (
    segments.length === 6
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
    && segments[5] === "images"
  ) {
    const mangaSlug = segments[2];
    const chapterSlug = segments[4];
    const source = requireSource(parsedUrl.searchParams);
    const images = await electronApi.listImages(mangaSlug, chapterSlug, source);
    return {
      manga: mangaSlug,
      chapter: chapterSlug,
      images,
    } as T;
  }

  if (pathname.startsWith("/api/remote/")) {
    throw new Error("Catalogo online indisponivel no modo Electron.");
  }

  throw new Error(`Rota nao suportada no modo Electron: ${pathname}`);
}

async function handleElectronPost<T, B = unknown>(url: string, body?: B): Promise<T> {
  const electronApi = ensureElectronApi();
  const parsedUrl = parseRequestUrl(url);
  const pathname = parsedUrl.pathname;
  const segments = decodePathSegments(pathname);

  if (pathname === "/api/settings/downloads-dir/pick") {
    const result = await electronApi.pickLibraryDir();
    return {
      status: result.status,
      downloads_dir: result.downloadsDir,
    } as T;
  }

  if (pathname === "/api/settings/downloads-dir/open") {
    const result = await electronApi.openLibraryDir();
    return {
      status: result.status,
      downloads_dir: result.downloadsDir,
    } as T;
  }

  if (pathname === "/api/settings/downloads-dir") {
    const payload = asRecord(body);
    const downloadsDir = payload.downloads_dir;
    if (typeof downloadsDir !== "string" || !downloadsDir.trim()) {
      throw new Error("Informe um caminho valido para downloads.");
    }
    const nextLibraryDir = await electronApi.setLibraryDir(downloadsDir);
    return {
      status: "ok",
      downloads_dir: nextLibraryDir,
    } as T;
  }

  if (
    segments.length === 6
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
    && segments[5] === "read-toggle"
  ) {
    const mangaSlug = segments[2];
    const chapterSlug = segments[4];
    const source = requireSource(parsedUrl.searchParams);
    return (await electronApi.toggleRead(mangaSlug, chapterSlug, source)) as T;
  }

  if (
    segments.length === 6
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
    && segments[5] === "bookmark"
  ) {
    const payload = asRecord(body);
    const page = ensureInteger(payload.page, "page");
    const total = ensureInteger(payload.total, "total");

    const mangaSlug = segments[2];
    const chapterSlug = segments[4];
    const source = requireSource(parsedUrl.searchParams);
    return (await electronApi.toggleBookmark(mangaSlug, chapterSlug, source, page, total)) as T;
  }

  if (
    segments.length === 6
    && segments[0] === "api"
    && segments[1] === "mangas"
    && segments[3] === "chapters"
    && segments[5] === "continue-reading"
  ) {
    const payload = asRecord(body);
    const page = ensureInteger(payload.page, "page");
    const total = ensureInteger(payload.total, "total");

    const mangaSlug = segments[2];
    const chapterSlug = segments[4];
    const source = requireSource(parsedUrl.searchParams);
    return (await electronApi.saveContinueReading(mangaSlug, chapterSlug, source, page, total)) as T;
  }

  if (pathname.startsWith("/api/remote/")) {
    throw new Error("Catalogo online indisponivel no modo Electron.");
  }

  if (pathname.endsWith("/export")) {
    throw new Error("Exportacao para PDF nao esta disponivel no modo Electron.");
  }

  if (pathname.endsWith("/verify")) {
    throw new Error("Verificacao remota nao esta disponivel no modo Electron.");
  }

  throw new Error(`Rota nao suportada no modo Electron: ${pathname}`);
}

export async function fetchJson<T>(url: string): Promise<T> {
  if (window.electronAPI) {
    return handleElectronGet<T>(url);
  }

  const response = await fetch(url);
  const data = (await response.json().catch(() => ({}))) as ApiError & T;
  if (!response.ok) {
    const message = data.error ?? `Erro ao carregar ${url}`;
    throw new Error(message);
  }
  return data as T;
}

export async function postJson<T, B = unknown>(url: string, body?: B): Promise<T> {
  if (window.electronAPI) {
    return handleElectronPost<T, B>(url, body);
  }

  const options: RequestInit = { method: "POST", headers: {} };
  if (body !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const data = (await response.json().catch(() => ({}))) as ApiError & T;
  if (!response.ok) {
    const message = data.error ?? `Erro ao carregar ${url}`;
    throw new Error(message);
  }
  return data as T;
}

export function extractRemoteSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0] === "manga") {
      return parts[1];
    }
    if (parts.length >= 2 && parts[0] === "series") {
      return parts[1];
    }
    return parts[0] ?? "";
  } catch {
    return url.trim().replace(/^\/+|\/+$/g, "");
  }
}

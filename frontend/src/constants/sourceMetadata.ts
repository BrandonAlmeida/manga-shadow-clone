import type { RemoteSource } from "../types/api";

interface RemoteSourceCapabilities {
  canDownload: boolean;
  canVerify: boolean;
  canDownloadAll: boolean;
}

interface RemoteSourceMetadata {
  label: string;
  badgeClassName: string;
  capabilities: RemoteSourceCapabilities;
}

export const DEFAULT_REMOTE_SOURCE: RemoteSource = "mangalivre";

export const REMOTE_SOURCE_OPTIONS: Array<{ value: RemoteSource; label: string }> = [
  { value: "mangalivre", label: "MangaLivre" },
  { value: "mangastop", label: "MangaStop" },
  { value: "mangalivreblog", label: "MangaLivre Blog" },
  { value: "asuracomic", label: "Asura Comic" },
];

export const DEFAULT_SELECTED_REMOTE_SOURCES: RemoteSource[] = REMOTE_SOURCE_OPTIONS.map((option) => option.value);

export const REMOTE_SOURCE_METADATA: Record<RemoteSource, RemoteSourceMetadata> = {
  mangalivre: {
    label: "MangaLivre",
    badgeClassName: "border-emerald-600/40 bg-emerald-100 text-emerald-900",
    capabilities: { canDownload: true, canVerify: true, canDownloadAll: true },
  },
  mangastop: {
    label: "MangaStop",
    badgeClassName: "border-sky-600/40 bg-sky-100 text-sky-900",
    capabilities: { canDownload: false, canVerify: false, canDownloadAll: false },
  },
  mangalivreblog: {
    label: "MangaLivre Blog",
    badgeClassName: "border-amber-600/40 bg-amber-100 text-amber-900",
    capabilities: { canDownload: true, canVerify: true, canDownloadAll: true },
  },
  asuracomic: {
    label: "Asura Comic",
    badgeClassName: "border-rose-600/40 bg-rose-100 text-rose-900",
    capabilities: { canDownload: true, canVerify: true, canDownloadAll: true },
  },
};

const SOURCE_LABELS: Record<string, string> = {
  ...Object.fromEntries(REMOTE_SOURCE_OPTIONS.map((option) => [option.value, option.label])),
  userlocal: "userlocal",
};

export function getSourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source;
}

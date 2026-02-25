export interface ApiError {
  error?: string;
}

export interface LocalMangasResponse {
  mangas: string[];
}

export interface LocalChaptersResponse {
  manga: string;
  chapters: Array<{
    id: string;
    label: string;
    remote_slug: string;
  }>;
}

export interface ReadStateResponse {
  manga: string;
  states: Record<string, boolean>;
  bookmarks: Record<string, number>;
}

export interface ImageItem {
  name: string;
  url: string;
}

export interface ChapterImagesResponse {
  manga: string;
  chapter: string;
  images: ImageItem[];
}

export interface BookmarkResultResponse {
  manga: string;
  chapter: string;
  bookmarked: boolean;
  page: number | null;
  total: number | null;
  bookmark_at: string | null;
}

export interface LastBookmark {
  chapter: string;
  page: number;
  total: number;
  bookmark_at: string;
}

export interface LastBookmarkResponse {
  manga: string;
  bookmark: LastBookmark | null;
}

export interface ContinueReadingEntry {
  manga_key: string;
  manga: string;
  source: string;
  chapter: string;
  page: number;
  total: number;
  updated_at: string;
}

export interface LastContinueReadingResponse {
  continue_reading: ContinueReadingEntry | null;
}

export interface ContinueReadingResultResponse {
  manga: string;
  source: string;
  chapter: string;
  page: number;
  total: number;
  updated_at: string;
}

export interface ReadToggleResponse {
  manga: string;
  chapter: string;
  read: boolean;
  read_at: string | null;
}

export interface ExportResponse {
  status: string;
  url?: string;
}

export interface DownloadsDirResponse {
  downloads_dir: string;
}

export interface UpdateDownloadsDirResponse {
  status: string;
  downloads_dir: string;
}

export interface PickDownloadsDirResponse {
  status: "ok" | "cancelled";
  downloads_dir: string;
}

export interface OpenDownloadsDirResponse {
  status: "ok";
  downloads_dir: string;
}

export type UpdateStatus =
  | "idle"
  | "unsupported"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export interface AppUpdateStateResponse {
  status: UpdateStatus;
  current_version: string;
  latest_version: string | null;
  progress_percent: number | null;
  release_url: string | null;
  message: string;
}

export interface AppUpdateOpenReleaseResponse {
  status: "ok";
  url: string;
}

export type RemoteSource = "mangalivre" | "mangastop" | "mangalivreblog" | "asuracomic";

export interface RemoteManga {
  title: string;
  url: string;
  source: RemoteSource;
}

export interface RemoteMangasResponse {
  sources?: RemoteSource[];
  total: number;
  mangas: RemoteManga[];
}

export interface RemoteChapter {
  title?: string;
  slug?: string;
  url?: string;
  source?: RemoteSource;
}

export interface RemoteChaptersResponse {
  manga: string;
  total: number;
  chapters: RemoteChapter[];
}

export interface VerifyResponse {
  ok: boolean;
  expected_total: number;
  local_total: number;
  missing: string[];
  empty: string[];
}

export type DownloadJobStatus = "idle" | "running" | "done" | "partial" | "cancelled" | "error" | "cancelling";

export interface DownloadJobResponse {
  manga?: string;
  status: DownloadJobStatus;
  total?: number;
  completed?: number;
  failed?: number;
  current?: string;
  started_at?: number;
  ended_at?: number | null;
  error?: string;
  cancel?: boolean;
}

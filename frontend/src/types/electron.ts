export interface ElectronChapterItem {
  id: string;
  label: string;
  remote_slug: string;
}

export interface ElectronImageItem {
  name: string;
  url: string;
}

export interface ElectronReadState {
  states: Record<string, boolean>;
  bookmarks: Record<string, number>;
}

export interface ElectronPickLibraryResult {
  status: "ok" | "cancelled";
  downloadsDir: string;
}

export interface ElectronOpenLibraryResult {
  status: "ok";
  downloadsDir: string;
}

export interface ElectronLastBookmark {
  chapter: string;
  page: number;
  total: number;
  bookmark_at: string;
}

export interface ElectronContinueReading {
  manga_key: string;
  manga: string;
  source: string;
  chapter: string;
  page: number;
  total: number;
  updated_at: string;
}

export interface ElectronBookmarkToggleResult {
  manga: string;
  chapter: string;
  bookmarked: boolean;
  page: number | null;
  total: number | null;
  bookmark_at: string | null;
}

export interface ElectronReadToggleResult {
  manga: string;
  chapter: string;
  read: boolean;
  read_at: string | null;
}

export interface ElectronContinueReadingResult {
  manga: string;
  source: string;
  chapter: string;
  page: number;
  total: number;
  updated_at: string;
}

export interface ElectronBridge {
  getLibraryDir: () => Promise<string>;
  setLibraryDir: (libraryDir: string) => Promise<string>;
  pickLibraryDir: () => Promise<ElectronPickLibraryResult>;
  openLibraryDir: () => Promise<ElectronOpenLibraryResult>;
  listMangas: () => Promise<string[]>;
  listChapters: (mangaSlug: string, source: string) => Promise<ElectronChapterItem[]>;
  listImages: (mangaSlug: string, chapterSlug: string, source: string) => Promise<ElectronImageItem[]>;
  getReadState: (mangaSlug: string, source: string) => Promise<ElectronReadState>;
  toggleRead: (mangaSlug: string, chapterSlug: string, source: string) => Promise<ElectronReadToggleResult>;
  getLastBookmark: (mangaSlug: string, source: string) => Promise<ElectronLastBookmark | null>;
  toggleBookmark: (
    mangaSlug: string,
    chapterSlug: string,
    source: string,
    page: number,
    total: number,
  ) => Promise<ElectronBookmarkToggleResult>;
  getLastContinueReading: () => Promise<ElectronContinueReading | null>;
  saveContinueReading: (
    mangaSlug: string,
    chapterSlug: string,
    source: string,
    page: number,
    total: number,
  ) => Promise<ElectronContinueReadingResult>;
}

import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  getLibraryDir: () => ipcRenderer.invoke("library:get-dir"),
  setLibraryDir: (libraryDir) => ipcRenderer.invoke("library:set-dir", libraryDir),
  pickLibraryDir: () => ipcRenderer.invoke("library:pick-dir"),
  openLibraryDir: () => ipcRenderer.invoke("library:open-dir"),
  listMangas: () => ipcRenderer.invoke("library:list-mangas"),
  listChapters: (mangaSlug, source) =>
    ipcRenderer.invoke("library:list-chapters", {
      mangaSlug,
      source,
    }),
  listImages: (mangaSlug, chapterSlug, source) =>
    ipcRenderer.invoke("library:list-images", {
      mangaSlug,
      chapterSlug,
      source,
    }),
  getReadState: (mangaSlug, source) =>
    ipcRenderer.invoke("library:get-read-state", {
      mangaSlug,
      source,
    }),
  toggleRead: (mangaSlug, chapterSlug, source) =>
    ipcRenderer.invoke("library:toggle-read", {
      mangaSlug,
      chapterSlug,
      source,
    }),
  getLastBookmark: (mangaSlug, source) =>
    ipcRenderer.invoke("library:get-last-bookmark", {
      mangaSlug,
      source,
    }),
  toggleBookmark: (mangaSlug, chapterSlug, source, page, total) =>
    ipcRenderer.invoke("library:toggle-bookmark", {
      mangaSlug,
      chapterSlug,
      source,
      page,
      total,
    }),
  getLastContinueReading: () => ipcRenderer.invoke("library:get-last-continue-reading"),
  saveContinueReading: (mangaSlug, chapterSlug, source, page, total) =>
    ipcRenderer.invoke("library:save-continue-reading", {
      mangaSlug,
      chapterSlug,
      source,
      page,
      total,
    }),
};

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, protocol, shell } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "mshcl",
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const IMAGE_EXTENSIONS = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const COLLATOR = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const SETTINGS_FILE_NAME = "settings.json";
const DEV_SERVER_URL = process.env.ELECTRON_DEV_SERVER_URL?.trim() ?? "";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..");
const FRONTEND_DIST_INDEX = path.join(FRONTEND_ROOT, "dist", "index.html");
const APP_NAME = "Manga Shadow";
const APP_WINDOW_TITLE = "Manga Shadow Clone";
const APP_ICON_PATH = path.join(FRONTEND_ROOT, "public", "favicon.svg");
const UPDATER_STATE_CHANNEL = "updater:state-changed";
const GITHUB_OWNER = "BrandonAlmeida";
const GITHUB_REPO = "manga-shadow-clone";
const GITHUB_RELEASES_LATEST_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const UPDATE_CHECK_INITIAL_DELAY_MS = 2500;
const UPDATE_CHECK_COOLDOWN_MS = 5 * 60 * 1000;

const UPDATER_STATUS = {
  idle: "idle",
  unsupported: "unsupported",
  checking: "checking",
  available: "available",
  downloading: "downloading",
  downloaded: "downloaded",
  upToDate: "up-to-date",
  error: "error",
};

let mainWindowReference = null;
let hasConfiguredUpdaterService = false;
let lastUpdateCheckAt = 0;

let updaterState = {
  status: UPDATER_STATUS.idle,
  currentVersion: app.getVersion(),
  latestVersion: null,
  progressPercent: null,
  releaseUrl: GITHUB_RELEASES_LATEST_URL,
  message: "",
};

function getUpdaterStateSnapshot() {
  return { ...updaterState };
}

function emitUpdaterState() {
  if (!mainWindowReference || mainWindowReference.isDestroyed()) {
    return;
  }

  mainWindowReference.webContents.send(UPDATER_STATE_CHANNEL, getUpdaterStateSnapshot());
}

function setUpdaterState(nextState) {
  updaterState = {
    ...updaterState,
    ...nextState,
  };
  emitUpdaterState();
  return getUpdaterStateSnapshot();
}

function formatUpdateError(error) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "Falha ao consultar atualizacoes.";
}

async function checkForAppUpdates() {
  setUpdaterState({
    status: UPDATER_STATUS.checking,
    progressPercent: null,
    message: "Verificando novas versões...",
  });

  try {
    const response = await net.fetch(GITHUB_LATEST_RELEASE_API_URL, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "manga-shadow-clone-updater",
      },
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar release no GitHub (HTTP ${response.status}).`);
    }

    const releasePayload = await response.json();
    const latestTag = String(releasePayload?.tag_name ?? "").trim();
    const latestVersion = normalizeVersion(latestTag);
    const releaseUrl = String(releasePayload?.html_url ?? GITHUB_RELEASES_LATEST_URL).trim() || GITHUB_RELEASES_LATEST_URL;

    if (!latestVersion) {
      throw new Error("Nao foi possivel identificar a versão da release mais recente.");
    }

    const currentVersion = normalizeVersion(app.getVersion());
    if (compareVersions(latestVersion, currentVersion) > 0) {
      return setUpdaterState({
        status: UPDATER_STATUS.available,
        latestVersion,
        progressPercent: null,
        releaseUrl,
        message: `Nova versão ${latestVersion} disponível. Clique para baixar no GitHub.`,
      });
    }

    return setUpdaterState({
      status: UPDATER_STATUS.upToDate,
      latestVersion,
      progressPercent: null,
      releaseUrl,
      message: "Você já está na versão mais recente.",
    });
  } catch (error) {
    const message = formatUpdateError(error);
    return setUpdaterState({
      status: UPDATER_STATUS.error,
      progressPercent: null,
      releaseUrl: GITHUB_RELEASES_LATEST_URL,
      message,
    });
  }
}

function normalizeVersion(version) {
  if (typeof version !== "string") {
    return "";
  }

  return version
    .trim()
    .replace(/^v/i, "")
    .split("-")[0]
    .trim();
}

function compareVersions(firstVersion, secondVersion) {
  const firstParts = firstVersion.split(".").map((part) => Number.parseInt(part, 10));
  const secondParts = secondVersion.split(".").map((part) => Number.parseInt(part, 10));
  const maxLength = Math.max(firstParts.length, secondParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const firstValue = Number.isFinite(firstParts[index]) ? firstParts[index] : 0;
    const secondValue = Number.isFinite(secondParts[index]) ? secondParts[index] : 0;

    if (firstValue > secondValue) {
      return 1;
    }

    if (firstValue < secondValue) {
      return -1;
    }
  }

  return 0;
}

function shouldThrottleUpdateCheck() {
  const now = Date.now();
  return now - lastUpdateCheckAt < UPDATE_CHECK_COOLDOWN_MS;
}

function triggerUpdateCheck(options = {}) {
  const force = options.force === true;
  if (!force && shouldThrottleUpdateCheck()) {
    return;
  }

  lastUpdateCheckAt = Date.now();
  void checkForAppUpdates();
}

function configureUpdaterService() {
  if (hasConfiguredUpdaterService) {
    return;
  }
  hasConfiguredUpdaterService = true;
  setUpdaterState({
    status: UPDATER_STATUS.idle,
    latestVersion: null,
    progressPercent: null,
    releaseUrl: GITHUB_RELEASES_LATEST_URL,
    message: "Atualizações automáticas desativadas. Novas versões são baixadas pelo GitHub.",
  });

  setTimeout(() => {
    triggerUpdateCheck({ force: true });
  }, UPDATE_CHECK_INITIAL_DELAY_MS);
}

function getAppIcon() {
  const icon = nativeImage.createFromPath(APP_ICON_PATH);
  return icon.isEmpty() ? null : icon;
}

function applyAppIdentity() {
  app.setName(APP_NAME);
  app.setAboutPanelOptions({ applicationName: APP_NAME });

  if (process.platform === "darwin") {
    const appIcon = getAppIcon();
    if (appIcon) {
      app.dock?.setIcon(appIcon);
    }
  }
}

let settingsCache = null;

function sortValues(values) {
  return [...values].sort((firstValue, secondValue) => COLLATOR.compare(firstValue, secondValue));
}

function toErrorMessage(error, fallbackMessage) {
  return error instanceof Error ? error.message : fallbackMessage;
}

function toUtcIsoWithoutMilliseconds() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function parseMangaKey(mangaKey) {
  const separatorIndex = mangaKey.indexOf("::");
  if (separatorIndex <= 0 || separatorIndex >= mangaKey.length - 2) {
    return null;
  }
  return {
    source: mangaKey.slice(0, separatorIndex),
    slug: mangaKey.slice(separatorIndex + 2),
  };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value) {
  return isRecord(value) ? value : {};
}

function isPathInside(basePath, targetPath) {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(targetPath);
  const relativePath = path.relative(resolvedBase, resolvedTarget);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function directoryExists(directoryPath) {
  try {
    const stats = await fs.stat(directoryPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function readJson(filePath, fallbackValue) {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(content);
    return isRecord(parsed) ? parsed : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

async function writeJson(filePath, payload) {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf-8");
}

function getSettingsFilePath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE_NAME);
}

function getDefaultLibraryDir() {
  return path.join(app.getPath("documents"), "MangaShadow", "downloads");
}

async function loadSettings() {
  if (settingsCache) {
    return settingsCache;
  }

  const filePath = getSettingsFilePath();
  const settings = await readJson(filePath, {});
  const rawLibraryDir = typeof settings.libraryDir === "string" ? settings.libraryDir.trim() : "";
  const libraryDir = path.resolve(rawLibraryDir || getDefaultLibraryDir());

  await ensureDirectory(libraryDir);
  settingsCache = { libraryDir };
  await writeJson(filePath, settingsCache);
  return settingsCache;
}

async function saveSettings(nextSettings) {
  settingsCache = nextSettings;
  await writeJson(getSettingsFilePath(), nextSettings);
}

async function getLibraryDir() {
  const settings = await loadSettings();
  return settings.libraryDir;
}

async function setLibraryDir(rawLibraryDir) {
  if (typeof rawLibraryDir !== "string" || !rawLibraryDir.trim()) {
    throw new Error("Informe um caminho valido para biblioteca.");
  }

  const resolvedDirectory = path.resolve(rawLibraryDir.trim());
  await ensureDirectory(resolvedDirectory);
  await saveSettings({ libraryDir: resolvedDirectory });
  return resolvedDirectory;
}

async function readDirectories(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath, { withFileTypes: true });
    return sortValues(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  } catch {
    return [];
  }
}

async function listImageNames(chapterPath) {
  try {
    const entries = await fs.readdir(chapterPath, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name);
    return sortValues(files);
  } catch {
    return [];
  }
}

function sourceMangaPath(libraryDir, source, mangaSlug) {
  return path.join(libraryDir, source, mangaSlug);
}

async function resolveMangaPath(libraryDir, source, mangaSlug) {
  return sourceMangaPath(libraryDir, source, mangaSlug);
}

async function listMangas(libraryDir) {
  const mangas = new Set();
  const rootDirectories = await readDirectories(libraryDir);

  for (const rootDirectory of rootDirectories) {
    if (!isValidSource(rootDirectory)) {
      continue;
    }

    const rootPath = path.join(libraryDir, rootDirectory);
    const mangaDirectories = await readDirectories(rootPath);
    for (const mangaDirectory of mangaDirectories) {
      mangas.add(`${rootDirectory}::${mangaDirectory}`);
    }
  }

  return sortValues([...mangas]);
}

function isValidSource(source) {
  if (typeof source !== "string") {
    return false;
  }

  const normalizedSource = source.trim();
  if (!normalizedSource || normalizedSource.startsWith(".")) {
    return false;
  }

  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(normalizedSource);
}

async function listDownloadedChapterIds(mangaPath) {
  const chapterDirectories = await readDirectories(mangaPath);
  const chapterIds = [];

  for (const chapterDirectory of chapterDirectories) {
    if (chapterDirectory === ".index") {
      continue;
    }

    const chapterPath = path.join(mangaPath, chapterDirectory);
    const images = await listImageNames(chapterPath);
    if (images.length > 0) {
      chapterIds.push(chapterDirectory);
    }
  }

  return sortValues(chapterIds);
}

async function loadChapterIndex(mangaPath) {
  const indexPath = path.join(mangaPath, ".index", "chapters.json");
  return readJson(indexPath, {});
}

function chapterEntries(indexData) {
  const entries = asRecord(indexData).entries;
  if (!Array.isArray(entries)) {
    return [];
  }
  return entries.filter((entry) => isRecord(entry));
}

function buildChapterEntryMapById(indexData) {
  const entryMap = new Map();

  for (const entry of chapterEntries(indexData)) {
    const chapterId = String(entry.id ?? "").trim();
    const remoteSlug = String(entry.remote_slug ?? "").trim();
    const title = String(entry.title ?? "").trim();

    if (!chapterId || !remoteSlug) {
      continue;
    }

    entryMap.set(chapterId, {
      id: chapterId,
      label: title || chapterId,
      remote_slug: remoteSlug,
    });
  }

  return entryMap;
}

function chapterIdFromRemoteSlug(indexData, remoteSlug) {
  for (const entry of chapterEntries(indexData)) {
    if (String(entry.remote_slug ?? "").trim() !== remoteSlug) {
      continue;
    }

    const chapterId = String(entry.id ?? "").trim();
    if (chapterId) {
      return chapterId;
    }
  }

  return remoteSlug;
}

async function listChapterItemsForSource(libraryDir, mangaSlug, source) {
  const mangaPath = await resolveMangaPath(libraryDir, source, mangaSlug);
  const chapterIds = await listDownloadedChapterIds(mangaPath);
  const chapterIndex = await loadChapterIndex(mangaPath);
  const chapterEntryMap = buildChapterEntryMapById(chapterIndex);

  return chapterIds.map((chapterId) => {
    const mappedEntry = chapterEntryMap.get(chapterId);
    if (mappedEntry) {
      return mappedEntry;
    }
    return {
      id: chapterId,
      label: chapterId,
      remote_slug: chapterId,
    };
  });
}

async function findChapterPath(libraryDir, mangaSlug, chapterSlug, source) {
  const mangaPath = await resolveMangaPath(libraryDir, source, mangaSlug);
  const chapterIndex = await loadChapterIndex(mangaPath);
  const localChapterSlug = chapterIdFromRemoteSlug(chapterIndex, chapterSlug);
  const candidates = [
    path.join(mangaPath, localChapterSlug),
    path.join(mangaPath, chapterSlug),
  ];

  for (const candidatePath of candidates) {
    if (await directoryExists(candidatePath)) {
      return candidatePath;
    }
  }

  return null;
}

function createImageUrl(filePath) {
  return `mshcl://image?path=${encodeURIComponent(path.resolve(filePath))}`;
}

async function listChapterImages(libraryDir, mangaSlug, chapterSlug, source) {
  const chapterPath = await findChapterPath(libraryDir, mangaSlug, chapterSlug, source);
  if (!chapterPath) {
    return [];
  }

  const imageNames = await listImageNames(chapterPath);
  return imageNames.map((imageName) => ({
    name: imageName,
    url: createImageUrl(path.join(chapterPath, imageName)),
  }));
}

function emptyReadState() {
  return { version: 1, chapters: {} };
}

async function resolveReadStatePath(libraryDir, mangaSlug, source) {
  const mangaPath = await resolveMangaPath(libraryDir, source, mangaSlug);
  const statePath = path.join(mangaPath, "state.json");
  if (await fileExists(statePath)) {
    return { mangaPath, statePath };
  }

  const legacyStatePath = path.join(mangaPath, ".state.json");
  if (await fileExists(legacyStatePath)) {
    return { mangaPath, statePath: legacyStatePath };
  }

  return { mangaPath, statePath };
}

function normalizeReadState(state) {
  if (!isRecord(state)) {
    return emptyReadState();
  }

  const normalizedState = { ...state };
  if (!isRecord(normalizedState.chapters)) {
    normalizedState.chapters = {};
  }

  if (typeof normalizedState.version !== "number") {
    normalizedState.version = 1;
  }

  return normalizedState;
}

async function loadReadState(libraryDir, mangaSlug, source) {
  const { statePath } = await resolveReadStatePath(libraryDir, mangaSlug, source);
  const state = await readJson(statePath, emptyReadState());
  return normalizeReadState(state);
}

async function saveReadState(libraryDir, mangaSlug, source, state) {
  const { mangaPath } = await resolveReadStatePath(libraryDir, mangaSlug, source);
  const nextStatePath = path.join(mangaPath, "state.json");
  const legacyStatePath = path.join(mangaPath, ".state.json");

  await ensureDirectory(mangaPath);
  const temporaryPath = `${nextStatePath}.tmp`;
  await fs.writeFile(temporaryPath, JSON.stringify(normalizeReadState(state), null, 2), "utf-8");
  await fs.rename(temporaryPath, nextStatePath);

  if (legacyStatePath !== nextStatePath && (await pathExists(legacyStatePath))) {
    await fs.unlink(legacyStatePath).catch(() => undefined);
  }
}

function chapterStateMap(state) {
  const chapters = asRecord(state).chapters;
  if (isRecord(chapters)) {
    return chapters;
  }
  return {};
}

async function getReadState(libraryDir, mangaSlug, source) {
  const state = await loadReadState(libraryDir, mangaSlug, source);
  const chapters = chapterStateMap(state);
  const states = {};
  const bookmarks = {};

  for (const [chapterSlug, entry] of Object.entries(chapters)) {
    if (!isRecord(entry)) {
      continue;
    }

    states[chapterSlug] = Boolean(entry.read);

    const bookmarkPage = entry.bookmark_page;
    const bookmarkTotal = entry.bookmark_total;
    if (
      Number.isInteger(bookmarkPage)
      && Number.isInteger(bookmarkTotal)
      && bookmarkPage > 0
      && bookmarkTotal > 0
    ) {
      bookmarks[chapterSlug] = Math.max(1, Math.min(bookmarkPage, bookmarkTotal));
    }
  }

  return { states, bookmarks };
}

async function toggleRead(libraryDir, mangaSlug, chapterSlug, source) {
  const state = await loadReadState(libraryDir, mangaSlug, source);
  const chapters = chapterStateMap(state);
  const currentEntry = asRecord(chapters[chapterSlug]);
  const nextRead = !Boolean(currentEntry.read);
  const readAt = nextRead ? toUtcIsoWithoutMilliseconds() : null;

  chapters[chapterSlug] = {
    ...currentEntry,
    read: nextRead,
    read_at: readAt,
  };
  state.chapters = chapters;

  await saveReadState(libraryDir, mangaSlug, source, state);
  return {
    manga: mangaSlug,
    chapter: chapterSlug,
    read: nextRead,
    read_at: readAt,
  };
}

async function toggleBookmark(libraryDir, mangaSlug, chapterSlug, source, page, total) {
  if (!Number.isInteger(page) || !Number.isInteger(total) || total <= 0) {
    throw new Error("Valores invalidos para bookmark.");
  }

  const state = await loadReadState(libraryDir, mangaSlug, source);
  const chapters = chapterStateMap(state);
  const currentEntry = asRecord(chapters[chapterSlug]);

  const currentPage = currentEntry.bookmark_page;
  const currentTotal = currentEntry.bookmark_total;
  const hasBookmark =
    Number.isInteger(currentPage)
    && Number.isInteger(currentTotal)
    && currentPage > 0
    && currentTotal > 0;

  if (hasBookmark && currentPage === page) {
    chapters[chapterSlug] = {
      ...currentEntry,
      bookmark_page: null,
      bookmark_total: null,
      bookmark_at: null,
    };
    state.chapters = chapters;
    await saveReadState(libraryDir, mangaSlug, source, state);
    return {
      manga: mangaSlug,
      chapter: chapterSlug,
      bookmarked: false,
      page: null,
      total: null,
      bookmark_at: null,
    };
  }

  for (const entry of Object.values(chapters)) {
    if (!isRecord(entry)) {
      continue;
    }
    entry.bookmark_page = null;
    entry.bookmark_total = null;
    entry.bookmark_at = null;
  }

  const bookmarkAt = toUtcIsoWithoutMilliseconds();
  chapters[chapterSlug] = {
    ...currentEntry,
    bookmark_page: page,
    bookmark_total: total,
    bookmark_at: bookmarkAt,
  };
  state.chapters = chapters;

  await saveReadState(libraryDir, mangaSlug, source, state);
  return {
    manga: mangaSlug,
    chapter: chapterSlug,
    bookmarked: true,
    page,
    total,
    bookmark_at: bookmarkAt,
  };
}

async function getLastBookmark(libraryDir, mangaSlug, source) {
  const state = await loadReadState(libraryDir, mangaSlug, source);
  const chapters = chapterStateMap(state);
  let latestBookmark = null;

  for (const [chapterSlug, entry] of Object.entries(chapters)) {
    if (!isRecord(entry)) {
      continue;
    }

    const bookmarkAt = entry.bookmark_at;
    const bookmarkPage = entry.bookmark_page;
    const bookmarkTotal = entry.bookmark_total;
    if (
      typeof bookmarkAt !== "string"
      || !Number.isInteger(bookmarkPage)
      || !Number.isInteger(bookmarkTotal)
      || bookmarkPage <= 0
      || bookmarkTotal <= 0
    ) {
      continue;
    }

    const candidate = {
      chapter: chapterSlug,
      page: Math.max(1, Math.min(bookmarkPage, bookmarkTotal)),
      total: bookmarkTotal,
      bookmark_at: bookmarkAt,
    };

    if (!latestBookmark || candidate.bookmark_at > latestBookmark.bookmark_at) {
      latestBookmark = candidate;
    }
  }

  return latestBookmark;
}

function extractContinueReadingPayload(chapterSlug, entry) {
  const chapter = String(entry.chapter ?? chapterSlug).trim();
  const page = entry.page;
  const total = entry.total;
  const updatedAt = entry.updated_at;

  if (
    !chapter
    || !Number.isInteger(page)
    || !Number.isInteger(total)
    || page <= 0
    || total <= 0
    || typeof updatedAt !== "string"
  ) {
    return null;
  }

  return {
    chapter,
    page: Math.max(1, Math.min(page, total)),
    total,
    updated_at: updatedAt,
  };
}

async function saveContinueReading(libraryDir, mangaSlug, chapterSlug, source, page, total) {
  if (!Number.isInteger(page) || !Number.isInteger(total) || total <= 0) {
    throw new Error("Valores invalidos para continuar leitura.");
  }

  const chapterPath = await findChapterPath(libraryDir, mangaSlug, chapterSlug, source);
  if (!chapterPath) {
    throw new Error("Capitulo nao encontrado.");
  }

  const state = await loadReadState(libraryDir, mangaSlug, source);
  const continueReading = {
    chapter: chapterSlug,
    page: Math.max(1, Math.min(page, total)),
    total,
    updated_at: toUtcIsoWithoutMilliseconds(),
  };

  state.continue_reading = continueReading;
  await saveReadState(libraryDir, mangaSlug, source, state);
  return continueReading;
}

async function getLastContinueReading(libraryDir) {
  const mangaKeys = await listMangas(libraryDir);
  let latestEntry = null;

  for (const mangaKey of mangaKeys) {
    const parsedMangaKey = parseMangaKey(mangaKey);
    if (!parsedMangaKey) {
      continue;
    }
    const { source, slug } = parsedMangaKey;
    const state = await loadReadState(libraryDir, slug, source);
    const entry = asRecord(state).continue_reading;
    if (!isRecord(entry)) {
      continue;
    }

    const payload = extractContinueReadingPayload("", entry);
    if (!payload) {
      continue;
    }

    const candidate = {
      manga_key: mangaKey,
      manga: slug,
      source,
      chapter: payload.chapter,
      page: payload.page,
      total: payload.total,
      updated_at: payload.updated_at,
    };

    if (!latestEntry || candidate.updated_at > latestEntry.updated_at) {
      latestEntry = candidate;
    }
  }

  return latestEntry;
}

function ensureNonEmptySlug(rawValue, fieldName) {
  if (typeof rawValue !== "string" || !rawValue.trim()) {
    throw new Error(`Informe o ${fieldName}.`);
  }
  return rawValue.trim();
}

function ensureSource(rawSource) {
  if (typeof rawSource !== "string" || !rawSource.trim()) {
    throw new Error("Informe a fonte (source).");
  }

  const source = rawSource.trim();
  if (!isValidSource(source)) {
    throw new Error("Fonte local inválida.");
  }

  return source;
}

function ensureInteger(rawValue, fieldName) {
  if (!Number.isInteger(rawValue)) {
    throw new Error(`Informe um valor inteiro para ${fieldName}.`);
  }
  return rawValue;
}

function registerIpcHandlers() {
  ipcMain.handle("library:get-dir", async () => {
    return getLibraryDir();
  });

  ipcMain.handle("library:set-dir", async (_, rawLibraryDir) => {
    return setLibraryDir(rawLibraryDir);
  });

  ipcMain.handle("library:pick-dir", async () => {
    const currentLibraryDir = await getLibraryDir();
    const selection = await dialog.showOpenDialog({
      title: "Selecione a pasta com seus mangas",
      defaultPath: currentLibraryDir,
      properties: ["openDirectory", "createDirectory"],
    });

    if (selection.canceled || !selection.filePaths[0]) {
      return { status: "cancelled", downloadsDir: currentLibraryDir };
    }

    const nextLibraryDir = await setLibraryDir(selection.filePaths[0]);
    return { status: "ok", downloadsDir: nextLibraryDir };
  });

  ipcMain.handle("library:open-dir", async () => {
    const currentLibraryDir = await getLibraryDir();
    await ensureDirectory(currentLibraryDir);
    const errorMessage = await shell.openPath(currentLibraryDir);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
    return { status: "ok", downloadsDir: currentLibraryDir };
  });

  ipcMain.handle("library:list-mangas", async () => {
    const libraryDir = await getLibraryDir();
    return listMangas(libraryDir);
  });

  ipcMain.handle("library:list-chapters", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const source = ensureSource(data.source);
    const libraryDir = await getLibraryDir();
    return listChapterItemsForSource(libraryDir, mangaSlug, source);
  });

  ipcMain.handle("library:list-images", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const chapterSlug = ensureNonEmptySlug(data.chapterSlug, "capitulo");
    const source = ensureSource(data.source);
    const libraryDir = await getLibraryDir();
    return listChapterImages(libraryDir, mangaSlug, chapterSlug, source);
  });

  ipcMain.handle("library:get-read-state", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const source = ensureSource(data.source);
    const libraryDir = await getLibraryDir();
    return getReadState(libraryDir, mangaSlug, source);
  });

  ipcMain.handle("library:toggle-read", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const chapterSlug = ensureNonEmptySlug(data.chapterSlug, "capitulo");
    const source = ensureSource(data.source);
    const libraryDir = await getLibraryDir();
    return toggleRead(libraryDir, mangaSlug, chapterSlug, source);
  });

  ipcMain.handle("library:get-last-bookmark", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const source = ensureSource(data.source);
    const libraryDir = await getLibraryDir();
    return getLastBookmark(libraryDir, mangaSlug, source);
  });

  ipcMain.handle("library:toggle-bookmark", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const chapterSlug = ensureNonEmptySlug(data.chapterSlug, "capitulo");
    const source = ensureSource(data.source);
    const page = ensureInteger(data.page, "page");
    const total = ensureInteger(data.total, "total");
    const safePage = Math.max(1, Math.min(page, total));
    const libraryDir = await getLibraryDir();
    return toggleBookmark(libraryDir, mangaSlug, chapterSlug, source, safePage, total);
  });

  ipcMain.handle("library:get-last-continue-reading", async () => {
    const libraryDir = await getLibraryDir();
    return getLastContinueReading(libraryDir);
  });

  ipcMain.handle("library:save-continue-reading", async (_, payload) => {
    const data = asRecord(payload);
    const mangaSlug = ensureNonEmptySlug(data.mangaSlug, "manga");
    const chapterSlug = ensureNonEmptySlug(data.chapterSlug, "capitulo");
    const source = ensureSource(data.source);
    const page = ensureInteger(data.page, "page");
    const total = ensureInteger(data.total, "total");
    const safePage = Math.max(1, Math.min(page, total));
    const libraryDir = await getLibraryDir();
    const continueReading = await saveContinueReading(libraryDir, mangaSlug, chapterSlug, source, safePage, total);
    return {
      manga: mangaSlug,
      source,
      chapter: continueReading.chapter,
      page: continueReading.page,
      total: continueReading.total,
      updated_at: continueReading.updated_at,
    };
  });

  ipcMain.handle("updater:get-state", async () => {
    return getUpdaterStateSnapshot();
  });

  ipcMain.handle("updater:check-for-updates", async () => {
    return checkForAppUpdates();
  });

  ipcMain.handle("updater:open-release-page", async () => {
    const releaseUrl = getUpdaterStateSnapshot().releaseUrl || GITHUB_RELEASES_LATEST_URL;
    await shell.openExternal(releaseUrl);
    setUpdaterState({
      message: "Página da release aberta no navegador.",
    });
    return { status: "ok", url: releaseUrl };
  });
}

async function handleImageProtocolRequest(request) {
  const requestUrl = new URL(request.url);
  const requestedPath = requestUrl.searchParams.get("path");
  if (!requestedPath) {
    return new Response("Not Found", { status: 404 });
  }

  const resolvedPath = path.resolve(requestedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  const libraryDir = await getLibraryDir();
  if (!isPathInside(libraryDir, resolvedPath)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!(await fileExists(resolvedPath))) {
    return new Response("Not Found", { status: 404 });
  }

  return net.fetch(pathToFileURL(resolvedPath).toString());
}

async function createMainWindow() {
  const appIcon = getAppIcon();

  const mainWindow = new BrowserWindow({
    title: APP_WINDOW_TITLE,
    ...(appIcon ? { icon: appIcon } : {}),
    width: 1360,
    height: 900,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: "#121212",
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindowReference = mainWindow;

  let hasShownWindow = false;
  const showWindow = () => {
    if (hasShownWindow || mainWindow.isDestroyed()) {
      return;
    }
    hasShownWindow = true;
    mainWindow.show();
  };

  mainWindow.once("ready-to-show", showWindow);
  mainWindow.webContents.once("did-finish-load", showWindow);
  mainWindow.webContents.once("did-finish-load", emitUpdaterState);
  mainWindow.on("closed", () => {
    if (mainWindowReference === mainWindow) {
      mainWindowReference = null;
    }
  });

  if (DEV_SERVER_URL) {
    try {
      await mainWindow.loadURL(DEV_SERVER_URL);
    } catch {
      if (!(await fileExists(FRONTEND_DIST_INDEX))) {
        throw new Error(
          "Nao foi possivel abrir o servidor de desenvolvimento e o build local nao foi encontrado.",
        );
      }
      await mainWindow.loadFile(FRONTEND_DIST_INDEX);
    }
  } else {
    if (!(await fileExists(FRONTEND_DIST_INDEX))) {
      throw new Error("Build do frontend nao encontrado. Rode npm run build na pasta frontend.");
    }
    await mainWindow.loadFile(FRONTEND_DIST_INDEX);
  }

  setTimeout(showWindow, 1500);
}

async function bootstrap() {
  applyAppIdentity();
  await loadSettings();

  registerIpcHandlers();
  configureUpdaterService();
  protocol.handle("mshcl", (request) => handleImageProtocolRequest(request));
  await createMainWindow();
}

app.whenReady().then(bootstrap).catch((error) => {
  const message = toErrorMessage(error, "Falha ao iniciar o aplicativo.");
  dialog.showErrorBox("MangaShadow Electron", message);
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
    return;
  }

  triggerUpdateCheck();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MdFolderOpen, MdOpenInNew, MdRefresh, MdSave } from "react-icons/md";
import { getSourceLabel } from "../constants/sourceMetadata";
import { toDisplayName } from "../lib/utils";
import { fetchJson, postJson } from "../services/apiClient";
import type {
  AppUpdateOpenReleaseResponse,
  AppUpdateStateResponse,
  DownloadsDirResponse,
  LocalMangasResponse,
  OpenDownloadsDirResponse,
  PickDownloadsDirResponse,
  UpdateDownloadsDirResponse,
} from "../types/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const MANGA_PREVIEW_LIMIT = 8;
const STATUS_MESSAGE_VISIBLE_MS = 3000;

function parseMangaKey(mangaKey: string): { source: string; slug: string } {
  const separatorIndex = mangaKey.indexOf("::");
  if (separatorIndex <= 0 || separatorIndex >= mangaKey.length - 2) {
    return { source: "userlocal", slug: "" };
  }
  return {
    source: mangaKey.slice(0, separatorIndex),
    slug: mangaKey.slice(separatorIndex + 2),
  };
}

export function SettingsPage() {
  const isElectronRuntime = useMemo(() => Boolean(window.electronAPI), []);
  const [libraryDir, setLibraryDir] = useState("");
  const [libraryDirDraft, setLibraryDirDraft] = useState("");
  const [mangaKeys, setMangaKeys] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState("Carregando configuração...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [updateState, setUpdateState] = useState<AppUpdateStateResponse | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isOpeningReleasePage, setIsOpeningReleasePage] = useState(false);
  const statusMessageTimeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  const clearStatusMessageTimeout = useCallback(() => {
    if (statusMessageTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(statusMessageTimeoutRef.current);
    statusMessageTimeoutRef.current = null;
  }, []);

  const showTemporaryStatusMessage = useCallback(
    (message: string) => {
      clearStatusMessageTimeout();
      setStatusMessage(message);

      statusMessageTimeoutRef.current = window.setTimeout(() => {
        setStatusMessage((currentMessage) => (currentMessage === message ? "" : currentMessage));
        statusMessageTimeoutRef.current = null;
      }, STATUS_MESSAGE_VISIBLE_MS);
    },
    [clearStatusMessageTimeout],
  );

  const applyUpdaterState = useCallback((nextState: AppUpdateStateResponse) => {
    setUpdateState(nextState);
  }, []);

  const refreshMangaList = useCallback(
    async (successPrefix?: string) => {
      setIsRefreshing(true);

      try {
        const mangaData = await fetchJson<LocalMangasResponse>("/api/mangas");
        const nextMangaKeys = mangaData.mangas ?? [];
        setMangaKeys(nextMangaKeys);

        if (successPrefix) {
          const countLabel = `${nextMangaKeys.length} ${nextMangaKeys.length === 1 ? "manga" : "mangas"}`;
          showTemporaryStatusMessage(`${successPrefix} Biblioteca atual: ${countLabel}.`);
          return;
        }

        setStatusMessage(nextMangaKeys.length > 0 ? "" : "Nenhum manga encontrado na pasta configurada.");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Falha ao listar biblioteca.";
        setMangaKeys([]);
        setStatusMessage(message);
      } finally {
        setIsRefreshing(false);
      }
    },
    [showTemporaryStatusMessage],
  );

  useEffect(() => {
    return () => {
      clearStatusMessageTimeout();
    };
  }, [clearStatusMessageTimeout]);

  useEffect(() => {
    let isCancelled = false;

    if (!isElectronRuntime) {
      setStatusMessage("Abra esta branch pelo aplicativo Electron: npm run electron:start");
      return () => {
        isCancelled = true;
      };
    }

    void (async () => {
      setIsRefreshing(true);
      try {
        const [settingsData, mangaData, nextUpdateState] = await Promise.all([
          fetchJson<DownloadsDirResponse>("/api/settings/downloads-dir"),
          fetchJson<LocalMangasResponse>("/api/mangas"),
          fetchJson<AppUpdateStateResponse>("/api/app/update"),
        ]);

        if (isCancelled) {
          return;
        }

        const nextLibraryDir = settingsData.downloads_dir ?? "";
        const nextMangaKeys = mangaData.mangas ?? [];
        setLibraryDir(nextLibraryDir);
        setLibraryDirDraft(nextLibraryDir);
        setMangaKeys(nextMangaKeys);
        applyUpdaterState(nextUpdateState);
        setStatusMessage(nextMangaKeys.length > 0 ? "" : "Nenhum manga encontrado na pasta configurada.");
      } catch (error: unknown) {
        if (isCancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Falha ao carregar configuração.";
        setStatusMessage(message);
      } finally {
        if (!isCancelled) {
          setIsRefreshing(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [applyUpdaterState, isElectronRuntime]);

  useEffect(() => {
    if (!isElectronRuntime || !window.electronAPI) {
      return;
    }

    const unsubscribe = window.electronAPI.onUpdaterStateChange((payload) => {
      applyUpdaterState({
        status: payload.status,
        current_version: payload.currentVersion,
        latest_version: payload.latestVersion,
        progress_percent: payload.progressPercent,
        release_url: payload.releaseUrl,
        message: payload.message,
      });
    });

    return unsubscribe;
  }, [applyUpdaterState, isElectronRuntime]);

  const saveLibraryDir = useCallback(async () => {
    if (!isElectronRuntime) {
      setStatusMessage("Salvar pasta está disponível apenas no aplicativo Electron.");
      return;
    }

    const nextPath = libraryDirDraft.trim();
    if (!nextPath) {
      setStatusMessage("Informe um caminho válido para biblioteca.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const data = await postJson<UpdateDownloadsDirResponse, { downloads_dir: string }>(
        "/api/settings/downloads-dir",
        {
          downloads_dir: nextPath,
        },
      );

      setLibraryDir(data.downloads_dir);
      setLibraryDirDraft(data.downloads_dir);
      await refreshMangaList("Pasta da biblioteca atualizada com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar pasta da biblioteca.";
      setStatusMessage(message);
    } finally {
      setIsSaving(false);
    }
  }, [isElectronRuntime, libraryDirDraft, refreshMangaList]);

  const pickLibraryDir = useCallback(async () => {
    if (!isElectronRuntime) {
      setStatusMessage("Selecionar pasta está disponível apenas no aplicativo Electron.");
      return;
    }

    setIsPicking(true);
    setStatusMessage("");

    try {
      const data = await postJson<PickDownloadsDirResponse>("/api/settings/downloads-dir/pick");
      setLibraryDir(data.downloads_dir);
      setLibraryDirDraft(data.downloads_dir);
      await refreshMangaList("Pasta da biblioteca atualizada com sucesso.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao abrir seletor de pasta.";
      setStatusMessage(message);
    } finally {
      setIsPicking(false);
    }
  }, [isElectronRuntime, refreshMangaList]);

  const openLibraryDir = useCallback(async () => {
    if (!isElectronRuntime) {
      setStatusMessage("Abrir pasta está disponível apenas no aplicativo Electron.");
      return;
    }

    setIsOpening(true);
    setStatusMessage("");

    try {
      const data = await postJson<OpenDownloadsDirResponse>("/api/settings/downloads-dir/open");
      setLibraryDir(data.downloads_dir);
      if (libraryDirDraft.trim() === libraryDir.trim()) {
        setLibraryDirDraft(data.downloads_dir);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao abrir pasta da biblioteca.";
      setStatusMessage(message);
    } finally {
      setIsOpening(false);
    }
  }, [isElectronRuntime, libraryDir, libraryDirDraft]);

  const checkForUpdates = useCallback(async () => {
    if (!isElectronRuntime) {
      setStatusMessage("Atualizações estão disponíveis apenas no aplicativo Electron.");
      return;
    }

    setIsCheckingUpdates(true);

    try {
      const nextUpdateState = await postJson<AppUpdateStateResponse>("/api/app/update/check");
      applyUpdaterState(nextUpdateState);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao verificar atualizações.";
      setStatusMessage(message);
    } finally {
      setIsCheckingUpdates(false);
    }
  }, [applyUpdaterState, isElectronRuntime]);

  const openReleasePage = useCallback(async () => {
    if (!isElectronRuntime) {
      setStatusMessage("As atualizações estão disponíveis apenas no aplicativo Electron.");
      return;
    }

    setIsOpeningReleasePage(true);

    try {
      await postJson<AppUpdateOpenReleaseResponse>("/api/app/update/open-release");
      showTemporaryStatusMessage("Página da nova versão aberta no navegador.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Falha ao abrir a página da release.";
      setStatusMessage(message);
    } finally {
      setIsOpeningReleasePage(false);
    }
  }, [isElectronRuntime, showTemporaryStatusMessage]);

  const mangaPreview = useMemo(() => {
    const normalizedMangas = mangaKeys
      .map((mangaKey) => {
        const { source, slug } = parseMangaKey(mangaKey);
        if (!slug) {
          return null;
        }

        return {
          key: mangaKey,
          label: toDisplayName(slug),
          source: getSourceLabel(source),
        };
      })
      .filter((manga): manga is { key: string; label: string; source: string } => Boolean(manga));

    return normalizedMangas.slice(0, MANGA_PREVIEW_LIMIT);
  }, [mangaKeys]);

  const remainingMangas = Math.max(0, mangaKeys.length - mangaPreview.length);

  const updateStatusLabel = useMemo(() => {
    if (!updateState) {
      return "Carregando estado de atualização...";
    }

    return updateState.message || "Nenhum status de atualização disponível.";
  }, [updateState]);

  const canOpenReleasePage = Boolean(updateState?.release_url) && !isOpeningReleasePage;

  return (
    <main className="mx-auto grid w-full gap-6 px-4 py-6 pb-16 md:px-6 md:py-8">
      <section className="grid gap-6 border border-neutral-900/15 bg-white/70 p-5 dark:border-neutral-100/15 dark:bg-neutral-900/70">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="grid gap-1">
            <h2 className="text-2xl text-neutral-900 dark:text-neutral-100">Configuração da biblioteca</h2>
            <p className="text-sm text-neutral-700 dark:text-neutral-300">
              Escolha a pasta local com seus mangas. O leitor vai usar apenas essa biblioteca offline.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-700 dark:text-neutral-300">
            Pasta da biblioteca
          </span>

          <div className="flex w-full flex-col gap-2 md:flex-row">
            <Input
              className="h-11"
              value={libraryDirDraft}
              placeholder="/Users/seu-usuario/Mangas"
              onChange={(event) => setLibraryDirDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  void saveLibraryDir();
                }
              }}
            />

            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={
                  !isElectronRuntime ||
                  isRefreshing ||
                  isSaving ||
                  isPicking ||
                  libraryDirDraft.trim() === libraryDir.trim()
                }
                onClick={() => {
                  void saveLibraryDir();
                }}
              >
                <MdSave className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                disabled={!isElectronRuntime || isRefreshing || isSaving || isPicking || isOpening}
                onClick={() => {
                  void pickLibraryDir();
                }}
              >
                <MdFolderOpen className="h-4 w-4" />
              </Button>

              <Button
                variant="secondary"
                disabled={
                  !isElectronRuntime || isRefreshing || isSaving || isPicking || isOpening || !libraryDir.trim()
                }
                onClick={() => {
                  void openLibraryDir();
                }}
              >
                <MdOpenInNew className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <code className="opacity-50 text-xs bg-transparent">
            Insira no formato: /&lt;source&gt;/&lt;manga&gt;/&lt;capítulo&gt;, exemplo /downloads/userlocal/naruto/01
          </code>

          {statusMessage ? <p className="text-sm text-amber-800 dark:text-amber-300">{statusMessage}</p> : null}
        </div>

        <article className="grid gap-2 border border-neutral-900/20 bg-white p-4 dark:border-neutral-100/20 dark:bg-neutral-900">
          <h3 className="text-lg text-neutral-900 dark:text-neutral-100">Biblioteca detectada</h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {mangaKeys.length} {mangaKeys.length === 1 ? "mangá encontrado" : "mangás encontrados"}.
          </p>

          {!mangaPreview.length ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Nenhum mangá para mostrar.</p>
          ) : (
            <ul className="grid gap-1.5 list-none p-0 text-sm text-neutral-800 dark:text-neutral-200">
              {mangaPreview.map((manga) => (
                <li
                  key={manga.key}
                  className="flex items-center justify-between gap-3 border border-neutral-900/10 bg-neutral-100/50 px-2 py-1 dark:border-neutral-100/10 dark:bg-neutral-800/40"
                >
                  <span className="truncate">{manga.label}</span>
                  <span className="shrink-0 text-xs uppercase tracking-[0.08em] text-neutral-500 dark:text-neutral-400">
                    {manga.source}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {remainingMangas > 0 ? (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">+ {remainingMangas} mangas na biblioteca.</p>
          ) : null}
        </article>

        <article className="grid gap-3 border border-neutral-900/20 bg-white p-4 dark:border-neutral-100/20 dark:bg-neutral-900">
          <h3 className="text-lg text-neutral-900 dark:text-neutral-100">Atualizações do aplicativo</h3>

          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Versão atual: {updateState?.current_version ?? "-"}
            {updateState?.latest_version ? ` | Nova versão: ${updateState.latest_version}` : ""}
          </p>

          <p className="text-sm text-neutral-700 dark:text-neutral-300">{updateStatusLabel}</p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={!isElectronRuntime || isCheckingUpdates || isOpeningReleasePage}
              onClick={() => {
                void checkForUpdates();
              }}
            >
              <MdRefresh className="h-4 w-4" />
            </Button>

            <Button
              variant="secondary"
              disabled={!canOpenReleasePage}
              onClick={() => {
                void openReleasePage();
              }}
            >
              <MdOpenInNew className="h-4 w-4" />
            </Button>
          </div>
        </article>
      </section>
    </main>
  );
}

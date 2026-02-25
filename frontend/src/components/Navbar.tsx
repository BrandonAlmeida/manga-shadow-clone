import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { FiBookOpen, FiHome, FiSettings } from "react-icons/fi";
import { IconButton } from "./ui/icon-button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { cn } from "../lib/utils";
import {
  MdAdd,
  MdDarkMode,
  MdLightMode,
  MdMenu,
  MdPause,
  MdPlayArrow,
  MdRemove,
  MdVisibility,
  MdVisibilityOff,
  MdZoomInMap,
  MdZoomOutMap,
} from "react-icons/md";
import { useTheme } from "../hooks/useTheme";

const READER_AUTO_HIDE_STORAGE_KEY = "reader:auto-hide-enabled";
const READER_AUTO_SCROLL_SPEED_STORAGE_KEY = "reader:auto-scroll-speed";

export function Navbar() {
  const lastScrollYRef = useRef(0);
  const { mode, toggleMode } = useTheme();
  const { pathname } = useLocation();
  const isReaderPage = pathname.startsWith("/leitura");
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopActionsMenuOpen, setIsDesktopActionsMenuOpen] = useState(false);
  const [isReaderAutoHideEnabled, setIsReaderAutoHideEnabled] = useState(() => {
    try {
      return localStorage.getItem(READER_AUTO_HIDE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(false);
  const [isAutoScrollPressPaused, setIsAutoScrollPressPaused] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(() => {
    try {
      const storedSpeed = Number(localStorage.getItem(READER_AUTO_SCROLL_SPEED_STORAGE_KEY));
      if (Number.isFinite(storedSpeed) && storedSpeed >= 1 && storedSpeed <= 8) {
        return storedSpeed;
      }
      return 2;
    } catch {
      return 2;
    }
  });
  const isHeaderEffectivelyHidden = isReaderPage && isReaderAutoHideEnabled && isHeaderHidden;

  useEffect(() => {
    const handleToggleHeaderShortcut = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsHeaderHidden((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleToggleHeaderShortcut);
    return () => window.removeEventListener("keydown", handleToggleHeaderShortcut);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(READER_AUTO_HIDE_STORAGE_KEY, String(isReaderAutoHideEnabled));
    } catch {
      // Ignora falha de persistência para não interromper a UX.
    }
  }, [isReaderAutoHideEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(READER_AUTO_SCROLL_SPEED_STORAGE_KEY, String(autoScrollSpeed));
    } catch {
      // Ignora falha de persistência para não interromper a UX.
    }
  }, [autoScrollSpeed]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      if (!document.fullscreenElement) {
        setIsAutoScrollEnabled(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const shouldHideHeader = currentScrollY > lastScrollYRef.current;

      if (!isReaderPage) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (!isReaderAutoHideEnabled) {
        setIsHeaderHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (shouldHideHeader) {
        setIsMobileMenuOpen(false);
        setIsDesktopActionsMenuOpen(false);
      }

      setIsHeaderHidden(shouldHideHeader);

      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isReaderAutoHideEnabled, isReaderPage]);

  useEffect(() => {
    if (!isReaderPage || !isAutoScrollEnabled || isAutoScrollPressPaused) {
      return;
    }

    let animationFrameId = 0;
    let lastFrameTime = performance.now();

    const animateAutoScroll = (currentFrameTime: number) => {
      const elapsedTime = currentFrameTime - lastFrameTime;
      lastFrameTime = currentFrameTime;
      const pixelsPerSecond = autoScrollSpeed * 33;
      const scrollDelta = (pixelsPerSecond * elapsedTime) / 1000;
      window.scrollBy({ top: scrollDelta, behavior: "auto" });
      animationFrameId = window.requestAnimationFrame(animateAutoScroll);
    };

    animationFrameId = window.requestAnimationFrame(animateAutoScroll);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [autoScrollSpeed, isAutoScrollEnabled, isAutoScrollPressPaused, isReaderPage]);

  useEffect(() => {
    if (!isReaderPage || !isAutoScrollEnabled) {
      return;
    }

    let previousScrollY = window.scrollY;
    let upwardScrollStartedAt: number | null = null;

    const handleStopAutoScrollOnUpwardScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < previousScrollY) {
        if (upwardScrollStartedAt === null) {
          upwardScrollStartedAt = performance.now();
        }

        if (performance.now() - upwardScrollStartedAt >= 100) {
          setIsAutoScrollEnabled(false);
          setIsAutoScrollPressPaused(false);
          upwardScrollStartedAt = null;
        }
      } else {
        upwardScrollStartedAt = null;
      }

      previousScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleStopAutoScrollOnUpwardScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleStopAutoScrollOnUpwardScroll);
  }, [isAutoScrollEnabled, isReaderPage]);

  useEffect(() => {
    if (!isReaderPage || !isAutoScrollEnabled) {
      return;
    }

    const handlePauseAutoScrollOnPressStart = () => {
      setIsAutoScrollPressPaused(true);
    };

    const handlePauseAutoScrollOnPressEnd = () => {
      setIsAutoScrollPressPaused(false);
    };

    window.addEventListener("pointerdown", handlePauseAutoScrollOnPressStart, { passive: true });
    window.addEventListener("pointerup", handlePauseAutoScrollOnPressEnd, { passive: true });
    window.addEventListener("pointercancel", handlePauseAutoScrollOnPressEnd, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handlePauseAutoScrollOnPressStart);
      window.removeEventListener("pointerup", handlePauseAutoScrollOnPressEnd);
      window.removeEventListener("pointercancel", handlePauseAutoScrollOnPressEnd);
      setIsAutoScrollPressPaused(false);
    };
  }, [isAutoScrollEnabled, isReaderPage]);

  const toggleFullScreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      return;
    }
    await document.exitFullscreen();
  };

  const handleToggleReaderAutoHide = () => {
    setIsReaderAutoHideEnabled((previousState) => {
      const nextState = !previousState;

      if (nextState) {
        setIsMobileMenuOpen(false);
        setIsDesktopActionsMenuOpen(false);
        setIsHeaderHidden(true);
        return nextState;
      }

      setIsHeaderHidden(false);
      return nextState;
    });
  };

  return (
    <TooltipProvider delayDuration={120}>
      <nav
        className={cn(
          "pointer-events-none fixed inset-x-0 top-5 z-50 flex justify-center px-2 md:justify-end md:px-4",
          isHeaderEffectivelyHidden ? "opacity-0 -translate-y-3" : "opacity-100 translate-y-0",
        )}
      >
        <div className="pointer-events-auto flex max-w-full items-center justify-center gap-2 overflow-x-auto border border-neutral-900/15 bg-white/70 p-2 backdrop-blur-xl transition dark:border-neutral-100/15 dark:bg-neutral-900/70">
          <NavLink
            to="/"
            end
            aria-label="Home"
            className={({ isActive }) =>
              cn(
                "inline-flex h-11 shrink-0 items-center gap-2 px-2 text-neutral-900 transition-opacity dark:text-neutral-100",
                isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
              )
            }
          >
            <FiHome size={19} />
            <span className="text-xs font-semibold">/home</span>
          </NavLink>
          <NavLink
            to="/leitura"
            aria-label="Leitura"
            className={({ isActive }) =>
              cn(
                "inline-flex h-11 shrink-0 items-center gap-2 px-2 text-neutral-900 transition-opacity dark:text-neutral-100",
                isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
              )
            }
          >
            <FiBookOpen size={19} />
            <span className="text-xs font-semibold">/leitura</span>
          </NavLink>
          <NavLink
            to="/config"
            aria-label="Configuracao"
            className={({ isActive }) =>
              cn(
                "inline-flex h-11 shrink-0 items-center gap-2 px-2 text-neutral-900 transition-opacity dark:text-neutral-100",
                isActive ? "opacity-100" : "opacity-70 hover:opacity-100",
              )
            }
          >
            <FiSettings size={19} />
            <span className="text-xs font-semibold">/config</span>
          </NavLink>
        </div>
      </nav>

      <header
        className={cn(
          "fixed inset-x-0 bottom-5 z-50 x-5 flex w-full justify-between px-4 transition",
          isHeaderEffectivelyHidden
            ? "pointer-events-none translate-y-3 opacity-0"
            : "pointer-events-auto translate-y-0 opacity-100",
        )}
      >
        <div className="border border-neutral-900/15 bg-white/70 p-2 backdrop-blur-xl dark:border-neutral-100/15 dark:bg-neutral-900/70 md:hidden">
          <button
            type="button"
            aria-label="Abrir ações"
            onClick={() => setIsMobileMenuOpen((previousState) => !previousState)}
            className="inline-flex size-11 items-center justify-center border border-neutral-900/20 bg-white text-neutral-800 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <MdMenu size={21} />
          </button>
        </div>

        {isMobileMenuOpen ? (
          <div className="w-fit absolute bottom-16 left-4 right-4 flex flex-col gap-2 border border-neutral-900/15 bg-white/80 p-2 backdrop-blur-xl dark:border-neutral-100/15 dark:bg-neutral-900/80 md:hidden">
            <div className="relative flex flex-col items-start gap-2">
              {isReaderPage ? (
                <IconButton
                  icon={isReaderAutoHideEnabled ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                  label={isReaderAutoHideEnabled ? "Desligar auto ocultar" : "Ligar auto ocultar"}
                  isActive={isReaderAutoHideEnabled}
                  onClick={handleToggleReaderAutoHide}
                />
              ) : null}
              {isReaderPage ? (
                <IconButton
                  icon={isAutoScrollEnabled ? <MdPause size={19} /> : <MdPlayArrow size={19} />}
                  label={isAutoScrollEnabled ? "Pausar auto scroll" : "Iniciar auto scroll"}
                  isActive={isAutoScrollEnabled}
                  caption={`${autoScrollSpeed}x`}
                  className="h-auto min-h-11 py-1"
                  onClick={() => setIsAutoScrollEnabled((previousState) => !previousState)}
                />
              ) : null}
              {isReaderPage ? (
                <IconButton
                  icon={<MdAdd size={19} />}
                  label="Aumentar velocidade"
                  onClick={() => setAutoScrollSpeed((previousSpeed) => Math.min(previousSpeed + 1, 8))}
                  disabled={autoScrollSpeed >= 8}
                />
              ) : null}
              {isReaderPage ? (
                <IconButton
                  icon={<MdRemove size={19} />}
                  label="Diminuir velocidade"
                  onClick={() => setAutoScrollSpeed((previousSpeed) => Math.max(previousSpeed - 1, 1))}
                  disabled={autoScrollSpeed <= 1}
                />
              ) : null}
              <IconButton
                icon={mode === "dark" ? <MdLightMode size={19} /> : <MdDarkMode size={19} />}
                label="Alternar tema"
                isActive={mode === "dark"}
                onClick={toggleMode}
              />
              <IconButton
                icon={isFullscreen ? <MdZoomInMap size={19} /> : <MdZoomOutMap size={19} />}
                label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
                onClick={() => void toggleFullScreen()}
              />
            </div>
          </div>
        ) : null}

        <div className="hidden md:block" />

        <div className="relative hidden items-center border border-neutral-900/15 bg-white/70 p-2 backdrop-blur-xl dark:border-neutral-100/15 dark:bg-neutral-900/70 md:flex">
          <Tooltip>
            <TooltipTrigger asChild>
              <IconButton
                icon={<MdMenu size={19} />}
                label="Ações"
                onClick={() => setIsDesktopActionsMenuOpen((previousState) => !previousState)}
              />
            </TooltipTrigger>
            <TooltipContent
              side="left"
              sideOffset={12}
            >
              Ações
            </TooltipContent>
          </Tooltip>

          {isDesktopActionsMenuOpen ? (
            <div className="absolute bottom-16 left-0 right-0 flex flex-col gap-2 border border-neutral-900/15 bg-white/80 p-2 backdrop-blur-xl dark:border-neutral-100/15 dark:bg-neutral-900/80">
              {isReaderPage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      icon={isReaderAutoHideEnabled ? <MdVisibilityOff size={19} /> : <MdVisibility size={19} />}
                      label={isReaderAutoHideEnabled ? "Desligar auto ocultar" : "Ligar auto ocultar"}
                      isActive={isReaderAutoHideEnabled}
                      onClick={handleToggleReaderAutoHide}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    sideOffset={12}
                  >
                    {isReaderAutoHideEnabled ? "Desligar auto ocultar" : "Ligar auto ocultar"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {isReaderPage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      icon={isAutoScrollEnabled ? <MdPause size={19} /> : <MdPlayArrow size={19} />}
                      label={isAutoScrollEnabled ? "Pausar auto scroll" : "Iniciar auto scroll"}
                      isActive={isAutoScrollEnabled}
                      caption={`${autoScrollSpeed}x`}
                      className="h-auto min-h-11 py-1"
                      onClick={() => setIsAutoScrollEnabled((previousState) => !previousState)}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    sideOffset={12}
                  >
                    {isAutoScrollEnabled ? "Pausar auto scroll" : "Iniciar auto scroll"}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {isReaderPage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      icon={<MdAdd size={19} />}
                      label="Aumentar velocidade"
                      onClick={() => setAutoScrollSpeed((previousSpeed) => Math.min(previousSpeed + 1, 8))}
                      disabled={autoScrollSpeed >= 8}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    sideOffset={12}
                  >
                    Aumentar velocidade
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {isReaderPage ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <IconButton
                      icon={<MdRemove size={19} />}
                      label="Diminuir velocidade"
                      onClick={() => setAutoScrollSpeed((previousSpeed) => Math.max(previousSpeed - 1, 1))}
                      disabled={autoScrollSpeed <= 1}
                    />
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    sideOffset={12}
                  >
                    Diminuir velocidade
                  </TooltipContent>
                </Tooltip>
              ) : null}
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton
                    icon={mode === "dark" ? <MdLightMode size={19} /> : <MdDarkMode size={19} />}
                    label="Alternar tema"
                    isActive={mode === "dark"}
                    onClick={() => {
                      setIsDesktopActionsMenuOpen(false);
                      toggleMode();
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={12}
                >
                  Alternar tema
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <IconButton
                    icon={isFullscreen ? <MdZoomInMap size={19} /> : <MdZoomOutMap size={19} />}
                    label={isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
                    onClick={() => {
                      setIsDesktopActionsMenuOpen(false);
                      void toggleFullScreen();
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent
                  side="left"
                  sideOffset={12}
                >
                  {isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"}
                </TooltipContent>
              </Tooltip>
            </div>
          ) : null}
        </div>
      </header>
    </TooltipProvider>
  );
}

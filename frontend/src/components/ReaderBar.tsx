import { MdBookmarkAdd, MdBookmarkAdded, MdKeyboardArrowUp, MdZoomIn, MdZoomOut } from "react-icons/md";
import { cn } from "../lib/utils";
import { HiAdjustmentsHorizontal } from "react-icons/hi2";

/**
 * Propriedades do componente ReaderBar.
 */
interface ReaderBarProps {
  isHidden: boolean;
  currentPage: number;
  totalPages: number;
  hasPages: boolean;
  isActionsOpen: boolean;
  isBookmarked: boolean;
  zoomLevel: number;
  onPageChange: (page: number) => void;
  onPageSubmit: (page: number) => void;
  onToggleActions: () => void;
  onMarkPage: () => void;
  onScrollToTop: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/**
 * Barra de ações flutuante para o ReaderPage.
 * Contém navegação de páginas e ações rápidas (marcar lido, marcar página, subir).
 */
export function ReaderBar({
  isHidden,
  currentPage,
  totalPages,
  hasPages,
  isActionsOpen,
  isBookmarked,
  zoomLevel,
  onPageChange,
  onPageSubmit,
  onToggleActions,
  onMarkPage,
  onScrollToTop,
  onZoomIn,
  onZoomOut,
}: ReaderBarProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "fixed bottom-5 right-4 z-50 flex items-center justify-between gap-2.5 border border-neutral-900/20 bg-white/70 px-3 py-2 shadow-[0_12px_24px_rgba(38,38,38,0.14)] backdrop-blur transition md:sticky md:bottom-5 md:right-auto md:w-fit md:justify-center md:self-center dark:border-neutral-100/20 dark:bg-neutral-900/70",
        isHidden ? "pointer-events-none translate-y-3 opacity-0" : "pointer-events-auto translate-y-0 opacity-100",
      )}
    >
      {/* Navegação de Páginas */}
      <div className="flex items-center gap-2 font-semibold">
        <span className="text-sm text-neutral-700 dark:text-neutral-300">Página</span>
        <input
          type="number"
          className="w-16 border border-neutral-900/20 bg-white px-2 py-1 text-center text-sm tabular-nums text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-400/70 dark:border-neutral-100/20 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:ring-neutral-500/60"
          min={1}
          step={1}
          value={currentPage || 0}
          disabled={!hasPages}
          onChange={(event) => onPageChange(Number(event.target.value || 0))}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onPageSubmit(Number((event.target as HTMLInputElement).value || 1));
            }
          }}
        />
        <span className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-nowrap">/ {totalPages}</span>
      </div>

      <button
        className={cn(
          "min-h-10 border border-neutral-900/25 bg-white px-3 py-1.5 text-xl font-semibold uppercase tracking-[0.08em] text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 disabled:shadow-none dark:border-neutral-100/25 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800",
          "md:hidden",
        )}
        type="button"
        aria-expanded={isActionsOpen}
        aria-controls="reader-actions-menu"
        onClick={onToggleActions}
      >
        <HiAdjustmentsHorizontal />
      </button>

      {/* Menu de Ações Rápidas */}
      <div
        id="reader-actions-menu"
        className={cn(
          "absolute bottom-[calc(100%+10px)] right-0 flex-col gap-2 border border-neutral-900/20 bg-white/70 backdrop-blur transition dark:bg-neutral-900/70 pointer-events-auto p-2.5 shadow-[0_12px_24px_rgba(38,38,38,0.14)] dark:border-neutral-100/20 md:static md:flex md:min-w-0 md:flex-row md:border-none md:bg-transparent md:p-0 md:shadow-none",
          isActionsOpen ? "flex" : "hidden md:flex",
        )}
      >
        <button
          className={cn(
            "hover:cursor-pointer w-full justify-center md:w-auto",
            "min-h-10 border border-neutral-900/25 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 disabled:shadow-none dark:border-neutral-100/25 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800",
          )}
          type="button"
          disabled={!hasPages}
          onClick={onMarkPage}
          title={isBookmarked ? "Remover marcação" : "Marcar página"}
        >
          <span className="flex items-center gap-2">
            {isBookmarked ? (
              <>
                <MdBookmarkAdded size={18} />
                <span className="md:hidden">Marcado</span>
              </>
            ) : (
              <>
                <MdBookmarkAdd size={18} />
                <span className="md:hidden">Marcar</span>
              </>
            )}
          </span>
        </button>
        <div className="flex items-center gap-1 border border-neutral-900/25 bg-white dark:border-neutral-100/25 dark:bg-neutral-900">
          <button
            className="hover:cursor-pointer flex h-10 w-10 items-center justify-center transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
            type="button"
            title="Diminuir zoom"
            onClick={onZoomOut}
            disabled={zoomLevel <= 50}
          >
            <MdZoomOut size={18} />
          </button>
          <span className="min-w-[45px] text-center text-[10px] font-bold tabular-nums text-neutral-900 dark:text-neutral-100">
            {zoomLevel}%
          </span>
          <button
            className="hover:cursor-pointer flex h-10 w-10 items-center justify-center transition hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
            type="button"
            title="Aumentar zoom"
            onClick={onZoomIn}
            disabled={zoomLevel >= 200}
          >
            <MdZoomIn size={18} />
          </button>
        </div>

        <button
          className={cn(
            "hover:cursor-pointer flex items-center gap-2 min-h-11 border border-neutral-900/25 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-neutral-900 transition hover:bg-neutral-100 disabled:cursor-default disabled:opacity-50 disabled:shadow-none dark:border-neutral-100/25 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800",
          )}
          type="button"
          onClick={onScrollToTop}
        >
          <MdKeyboardArrowUp />
          <span className="md:hidden">Topo</span>
        </button>
      </div>
    </div>
  );
}

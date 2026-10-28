"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CloseIcon } from "@/icons";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  children: React.ReactNode;
  showCloseButton?: boolean; // New prop to control close button visibility
  isFullscreen?: boolean; // Default to false for backwards compatibility
  labelledBy?: string;
  closeLabel?: string;
}

const suscribirMontaje = () => () => {};
const obtenerMontajeCliente = () => true;
const obtenerMontajeServidor = () => false;

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className,
  showCloseButton = true, // Default to true for backwards compatibility
  isFullscreen = false,
  labelledBy,
  closeLabel = "Close",
}) => {
  const montado = useSyncExternalStore(
    suscribirMontaje,
    obtenerMontajeCliente,
    obtenerMontajeServidor,
  );
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!montado || !isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    if (isOpen) {
      const focoInicial =
        modalRef.current?.querySelector<HTMLElement>("[data-foco-inicial]") ||
        modalRef.current?.querySelector<HTMLElement>(
          'input:not([aria-hidden="true"]):not([tabindex="-1"]), button:not([tabindex="-1"]), select, textarea',
        );
      focoInicial?.focus();
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
      if (event.key === "Tab" && isOpen) {
        const elements = Array.from(
          modalRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([aria-hidden="true"]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), a[href]',
          ) || [],
        ).filter((el) => el.getClientRects().length);
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (isOpen) previous?.focus();
    };
  }, [isOpen, montado]);

  useEffect(() => {
    if (!montado || !isOpen) return;
    const desbordamientoAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = desbordamientoAnterior;
    };
  }, [isOpen, montado]);

  if (!isOpen || !montado) return null;

  const contentClasses = isFullscreen
    ? "w-full h-full"
    : "superficie-cristal superficie-cristal-modal relative w-full rounded-3xl border bg-white dark:bg-gray-900";

  return createPortal(
    <div className="modal fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      {!isFullscreen && (
        <div
          className="fixed inset-0 h-full w-full bg-gray-900/50 backdrop-blur-sm dark:bg-black/60"
          onClick={onClose}
        ></div>
      )}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`${contentClasses} ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            type="button"
            aria-label={closeLabel}
            className="absolute end-4 top-4 z-999 inline-flex size-9 items-center justify-center rounded-xl text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none sm:end-6 sm:top-5 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <CloseIcon aria-hidden="true" className="size-4.5" />
          </button>
        )}
        <div>{children}</div>
      </div>
    </div>,
    document.body,
  );
};

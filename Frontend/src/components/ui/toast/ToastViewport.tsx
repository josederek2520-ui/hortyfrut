"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { AlertIcon, CheckCircleIcon, CloseIcon, InfoIcon } from "@/icons";
import type { ToastNotice } from "@/hooks/useToast";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function TarjetaAviso({
  toast,
  onDismiss,
}: {
  toast: ToastNotice;
  onDismiss: (id: number) => void;
}) {
  const t = useTranslations("toast");
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = element.current;
    if (!card) return;
    let remaining = toast.duration;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointerInside = false;
    let focusInside = false;
    const stop = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      timer = undefined;
      remaining = Math.max(0, remaining - (performance.now() - started));
    };
    const update = () => {
      stop();
      const pausado = pointerInside || focusInside || document.hidden;
      card.setAttribute("data-pausado", String(pausado));
      if (pausado) return;
      started = performance.now();
      timer = setTimeout(() => onDismiss(toast.id), remaining);
    };
    const enter = () => {
      pointerInside = true;
      update();
    };
    const leave = () => {
      pointerInside = false;
      update();
    };
    const focus = () => {
      focusInside = true;
      update();
    };
    const blur = (event: FocusEvent) => {
      focusInside =
        event.relatedTarget instanceof Node &&
        card.contains(event.relatedTarget);
      update();
    };
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("focusin", focus);
    card.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      stop();
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("focusin", focus);
      card.removeEventListener("focusout", blur);
      document.removeEventListener("visibilitychange", update);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const Icon =
    toast.variant === "success"
      ? CheckCircleIcon
      : toast.variant === "error"
        ? AlertIcon
        : InfoIcon;
  return (
    <div
      ref={element}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-variante={toast.variant}
      className="aviso-cristal pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 motion-safe:animate-toast-enter"
    >
      <span className="aviso-cristal__icono inline-flex size-11 shrink-0 items-center justify-center rounded-2xl">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="aviso-cristal__titulo text-sm font-semibold">
          {t(toast.variant)}
        </p>
        <p className="aviso-cristal__mensaje mt-1 text-sm leading-5 break-words">
          {toast.message}
        </p>
      </div>
      <button
        type="button"
        aria-label={t("dismiss")}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onDismiss(toast.id)}
        className="aviso-cristal__cerrar -me-1 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-xl transition focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
      >
        <CloseIcon aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-hidden="true"
        className="aviso-cristal__tiempo absolute inset-x-0 bottom-0 h-0.5"
      >
        <span
          className="aviso-cristal__progreso block h-full w-full"
          style={{ "--duracion-aviso": `${toast.duration}ms` } as CSSProperties}
        />
      </span>
    </div>
  );
}

export default function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastNotice[];
  onDismiss: (id: number) => void;
}) {
  const mounted = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const t = useTranslations("toast");
  if (!mounted || !toasts.length) return null;
  return createPortal(
    <section
      aria-label={t("region")}
      className="region-avisos-hortyfru pointer-events-none fixed start-4 end-4 bottom-4 z-999999 flex flex-col gap-3 sm:start-auto sm:end-6 sm:bottom-6 sm:w-100"
    >
      {toasts.map((toast) => (
        <TarjetaAviso key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </section>,
    document.body,
  );
}

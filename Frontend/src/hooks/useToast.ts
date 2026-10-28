"use client";

import { useCallback, useRef, useState } from "react";

export type ToastVariant = "success" | "error" | "info";
export interface ToastNotice {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastNotice[]>([]);
  const sequence = useRef(0);
  const notify = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const toast = {
        id: ++sequence.current,
        message,
        variant,
        duration: variant === "error" ? 7000 : 5000,
      };
      setToasts((current) => [
        ...current
          .filter(
            (item) => item.message !== message || item.variant !== variant,
          )
          .slice(-2),
        toast,
      ]);
    },
    [],
  );
  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  return { toasts, notify, dismiss };
}

"use client";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { animarVistaAgregarCompra } from "./animacionAgregarCompra";

export default function VistaAgregarCompra({
  visible,
  clave,
  children,
}: {
  visible: boolean;
  clave: string | number;
  children: ReactNode;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!visible || !elemento.current) return;
    return animarVistaAgregarCompra(
      elemento.current,
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    );
  }, [visible, clave]);
  return (
    <div ref={elemento} hidden={!visible} className="min-w-0">
      {children}
    </div>
  );
}

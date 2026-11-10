"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { animarEntradaPreparacion } from "./animacionEntradaPreparacion";

export default function VistaAnimadaPreparacion({
  visible,
  clave,
  id,
  children,
}: {
  visible: boolean;
  clave: string | number;
  id?: string;
  children: ReactNode;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!visible || !elemento.current) return;
    return animarEntradaPreparacion(
      elemento.current,
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    );
  }, [visible, clave]);
  // Las dos vistas permanecen montadas para conservar filtros, página y campos.
  return (
    <div ref={elemento} id={id} hidden={!visible} className="min-w-0">
      {children}
    </div>
  );
}

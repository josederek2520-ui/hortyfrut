"use client";

import type { ReactNode } from "react";
import { cn } from "@/utils";

export default function GrupoMenuLateral({
  clave,
  titulo,
  mostrarTexto,
  children,
}: {
  clave: string;
  titulo: string;
  mostrarTexto: boolean;
  children: ReactNode;
}) {
  const identificadorTitulo = `grupo-menu-${clave}`;
  return (
    <section aria-labelledby={identificadorTitulo}>
      <h2
        id={identificadorTitulo}
        className={cn(
          "mb-2 px-3 pt-2 text-theme-xs font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-300",
          !mostrarTexto && "sr-only",
        )}
      >
        {titulo}
      </h2>
      {!mostrarTexto && (
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-px w-5 bg-gray-200 dark:bg-gray-700"
        />
      )}
      {children}
    </section>
  );
}

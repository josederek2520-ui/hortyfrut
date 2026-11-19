"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { destinoSalidaPreparacion } from "@/components/preparaciones/salidaTrabajoPreparacion";

export default function useProteccionComercial(
  modificado: boolean,
  bloqueado: boolean,
) {
  const [destino, establecerDestino] = useState<string | null>(null);
  const salirPermitido = useRef(false),
    navegador = useRouter();
  useEffect(() => {
    if (!modificado && !bloqueado) return;
    const avisar = (evento: BeforeUnloadEvent) => {
      if (!salirPermitido.current) evento.preventDefault();
    };
    const proteger = (evento: MouseEvent) => {
      if (salirPermitido.current) return;
      const enlace =
        evento.target instanceof Element
          ? evento.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      const ruta = destinoSalidaPreparacion(evento, enlace, window.location);
      if (!ruta) return;
      evento.preventDefault();
      evento.stopPropagation();
      if (!bloqueado) establecerDestino(ruta);
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", proteger, true);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      document.removeEventListener("click", proteger, true);
    };
  }, [modificado, bloqueado]);
  return {
    destino,
    cerrar: () => establecerDestino(null),
    salir: (ruta: string) => {
      if (bloqueado) return;
      if (modificado) establecerDestino(ruta);
      else navegador.push(ruta);
    },
    confirmar: () => {
      if (destino) {
        salirPermitido.current = true;
        navegador.push(destino);
      }
    },
  };
}

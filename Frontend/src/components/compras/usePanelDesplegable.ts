"use client";
import { useLayoutEffect, type RefObject } from "react";
import { posicionDesplegable } from "./posicionDesplegable";

export default function usePanelDesplegable({
  abierto,
  ancla,
  panel,
  entrada,
  alCerrar,
  anchoRem,
}: {
  abierto: boolean;
  ancla: RefObject<HTMLButtonElement | null>;
  panel: RefObject<HTMLDivElement | null>;
  entrada: RefObject<HTMLInputElement | null>;
  alCerrar: () => void;
  anchoRem: number;
}) {
  useLayoutEffect(() => {
    if (!abierto || !ancla.current || !panel.current) return;
    const boton = ancla.current;
    const contenedor = panel.current;
    const ventana = window.visualViewport;
    const posicionar = () => {
      contenedor.style.removeProperty("max-height");
      const rectangulo = boton.getBoundingClientRect();
      const medidas = {
        ancla: rectangulo,
        anchoVentana: ventana?.width || document.documentElement.clientWidth,
        altoVentana: ventana?.height || window.innerHeight,
        inicioVentana: ventana?.offsetLeft || 0,
        superiorVentana: ventana?.offsetTop || 0,
        anchoPreferido:
          anchoRem *
          parseFloat(getComputedStyle(document.documentElement).fontSize),
        altoPanel: contenedor.scrollHeight,
        anchoDocumento: document.documentElement.clientWidth,
        derechaIzquierda: getComputedStyle(boton).direction === "rtl",
      };
      // Primero fija el ancho para medir el alto real del contenido.
      const inicial = posicionDesplegable(medidas);
      contenedor.style.setProperty("width", `${inicial.ancho}px`);
      const posicion = posicionDesplegable({
        ...medidas,
        altoPanel: contenedor.scrollHeight,
      });
      contenedor.style.setProperty("max-height", `${posicion.altoMaximo}px`);
      contenedor.style.setProperty("top", `${posicion.superior}px`);
      contenedor.style.setProperty(
        "inset-inline-start",
        `${posicion.inicio}px`,
      );
      contenedor.style.setProperty("visibility", "visible");
    };
    const fuera = (evento: Event) => {
      const objetivo = evento.target;
      if (
        objetivo instanceof Node &&
        !contenedor.contains(objetivo) &&
        !boton.contains(objetivo)
      )
        alCerrar();
    };
    const alDesplazar = (evento: Event) => {
      if (evento.target instanceof Node && contenedor.contains(evento.target))
        return;
      const caja = boton.getBoundingClientRect();
      const superior = ventana?.offsetTop || 0;
      if (
        caja.bottom < superior ||
        caja.top > superior + (ventana?.height || window.innerHeight)
      )
        alCerrar();
      else posicionar();
    };
    const alTecla = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        alCerrar();
        boton.focus({ preventScroll: true });
      }
      if (evento.key !== "Tab") return;
      const controles = Array.from(
        contenedor.querySelectorAll<HTMLElement>(
          "input:not([disabled]), button:not([disabled])",
        ),
      );
      const primero = controles[0];
      const ultimo = controles[controles.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        alCerrar();
        boton.focus({ preventScroll: true });
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        const externos = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href]',
          ),
        ).filter(
          (control) =>
            !contenedor.contains(control) &&
            control.tabIndex >= 0 &&
            control.getClientRects().length,
        );
        const siguiente = externos[externos.indexOf(boton) + 1];
        if (siguiente) {
          evento.preventDefault();
          alCerrar();
          siguiente.focus();
        }
      }
    };
    posicionar();
    entrada.current?.focus({ preventScroll: true });
    const observador = new ResizeObserver(posicionar);
    observador.observe(contenedor);
    observador.observe(boton);
    document.addEventListener("pointerdown", fuera, true);
    document.addEventListener("focusin", fuera);
    contenedor.addEventListener("keydown", alTecla);
    window.addEventListener("scroll", alDesplazar, true);
    window.addEventListener("resize", posicionar);
    ventana?.addEventListener("resize", posicionar);
    ventana?.addEventListener("scroll", posicionar);
    return () => {
      observador.disconnect();
      document.removeEventListener("pointerdown", fuera, true);
      document.removeEventListener("focusin", fuera);
      contenedor.removeEventListener("keydown", alTecla);
      window.removeEventListener("scroll", alDesplazar, true);
      window.removeEventListener("resize", posicionar);
      ventana?.removeEventListener("resize", posicionar);
      ventana?.removeEventListener("scroll", posicionar);
    };
  }, [abierto, ancla, panel, entrada, alCerrar, anchoRem]);
}

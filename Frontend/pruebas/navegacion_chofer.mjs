import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
function prepararCabecera() {
  let salidaRecibida;
  const cargar = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": {
      useTranslations: (namespace) =>
        crearTraductor({ locale: "es", messages: mensajes, namespace }),
    },
    "@/i18n/navigation": {
      Link: ({ children, ...propiedades }) =>
        React.createElement("a", propiedades, children),
    },
    "@/context/SidebarContext": {
      useSidebar: () => ({
        isExpanded: true,
        isMobileOpen: false,
        toggleSidebar: () => {},
        toggleMobileSidebar: () => {},
      }),
    },
    "@/components/common/ThemeToggleButton": {
      ThemeToggleButton: () => React.createElement("span", {}, "Tema"),
    },
    "@/components/common/MarcaHortyfru": {
      default: () => React.createElement("span", {}, "HortyFru"),
    },
    "@/components/header/NotificationDropdown": {
      default: () => React.createElement("span", {}, "Alertas de la plantilla"),
    },
    "@/components/auth/SessionAccount": {
      default: ({ alSalir }) => {
        salidaRecibida = alSalir;
        return React.createElement("span", {}, "Mi cuenta");
      },
    },
    "@/components/chat/IndicadorChat": { default: () => null },
    "@/icons": new Proxy({}, { get: () => () => null }),
    "@/utils": { cn: (...clases) => clases.filter(Boolean).join(" ") },
  });
  return {
    Cabecera: cargar("layout/CabeceraAplicacion").default,
    salida: () => salidaRecibida,
  };
}
prueba(
  "la barra del chofer incluye menu movil, marca, cuenta y salida propia",
  () => {
    const { Cabecera, salida } = prepararCabecera();
    const salir = async () => {};
    const html = representar(
      React.createElement(Cabecera, { modoChofer: true, alSalir: salir }),
    );
    afirmar.ok(html.includes('aria-controls="navegacion-principal"'));
    afirmar.ok(html.includes('aria-controls="cuenta-cabecera"'));
    afirmar.ok(html.includes('href="/mis-viajes"'));
    afirmar.ok(html.includes("Mi cuenta"));
    afirmar.ok(!html.includes('role="search"'));
    afirmar.ok(!html.includes("Alertas de la plantilla"));
    afirmar.equal(salida(), salir);
  },
);
prueba(
  "la barra administrativa conserva su busqueda y sus controles al compartir la disposicion",
  () => {
    const { Cabecera } = prepararCabecera();
    const html = representar(React.createElement(Cabecera));
    afirmar.ok(html.includes('role="search"'));
    afirmar.ok(html.includes("Alertas de la plantilla"));
    afirmar.ok(html.includes('href="/"'));
  },
);

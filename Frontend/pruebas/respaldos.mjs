import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const mensajes = Object.fromEntries(
  ["es", "en"].map((idioma) => [
    idioma,
    JSON.parse(
      leerArchivo(
        new URL(`../src/messages/${idioma}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
const traductor = crearTraductor({
  locale: "es",
  messages: mensajes.es,
  namespace: "respaldos",
});
const cargar = crearCargadorChofer({
  react: React,
  "react/jsx-runtime": jsx,
  "lucide-react": iconos,
  "next-intl": { useLocale: () => "es", useTranslations: () => traductor },
});
const { fechaRespaldo, tamanoRespaldo } = cargar("components/respaldos/tipos");
const Historial = cargar("components/respaldos/HistorialRespaldos").default;
const respaldo = {
  id: "a1b2c3d4-1234-4567-abcd-123456789abc",
  nombre: "hortyfru_08-11-2026_001.zip",
  creado_en: "2026-11-09T01:30:45Z",
  responsable_nombre: "Responsable de prueba",
  tamano_bytes: 1024 * 1024,
  error: "",
};

prueba("la fecha operativa usa Bolivia al cruzar la medianoche UTC", () => {
  afirmar.match(fechaRespaldo(respaldo.creado_en, "es"), /08\/11\/2026/);
  afirmar.match(fechaRespaldo(respaldo.creado_en, "es"), /21:30/);
  afirmar.equal(tamanoRespaldo(1024 * 1024, "es"), "1 MB");
});

prueba("solo una copia completada y con permiso ofrece descargar", () => {
  const pintar = (estado, permiso) =>
    representar(
      React.createElement(Historial, {
        respaldos: [{ ...respaldo, estado }],
        puedeDescargar: permiso,
        descargando: null,
        alDescargar() {},
      }),
    );
  afirmar.match(
    pintar("completado", true),
    /aria-label="Descargar hortyfru_08-11-2026/,
  );
  for (const [estado, permiso] of [
    ["preparando", true],
    ["fallido", true],
    ["completado", false],
  ])
    afirmar.doesNotMatch(pintar(estado, permiso), /<button/);
});

prueba(
  "el historial conserva el nombre y muestra errores sin interpretarlos como HTML",
  () => {
    const html = representar(
      React.createElement(Historial, {
        respaldos: [
          { ...respaldo, estado: "fallido", error: "<script>privado</script>" },
        ],
        puedeDescargar: true,
        descargando: null,
        alDescargar() {},
      }),
    );
    afirmar.match(html, /hortyfru_08-11-2026_001.zip/);
    afirmar.match(html, /&lt;script&gt;/);
    afirmar.doesNotMatch(html, /<script>/);
  },
);

prueba(
  "los dos idiomas tienen las mismas acciones y permisos de respaldos",
  () => {
    afirmar.deepEqual(
      Object.keys(mensajes.es.respaldos).sort(),
      Object.keys(mensajes.en.respaldos).sort(),
    );
    for (const idioma of ["es", "en"]) {
      afirmar.ok(mensajes[idioma].sidebar.items.respaldos);
      afirmar.ok(mensajes[idioma].roles.modules.respaldos);
      for (const permiso of [
        "view_respaldo",
        "add_respaldo",
        "descargar_respaldo",
      ])
        afirmar.ok(mensajes[idioma].roles.permissionLabels[permiso]);
    }
  },
);

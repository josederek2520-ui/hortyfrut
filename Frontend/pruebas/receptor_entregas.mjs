import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leer } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leer(new URL(`../src/messages/${idioma}.json`, import.meta.url), "utf8"),
  );
  const t = crearTraductor({
    locale: idioma,
    messages: mensajes,
    namespace: "entregas",
  });
  const cargar = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": iconos,
    "next-intl": { useTranslations: () => t, useLocale: () => idioma },
    "@/i18n/navigation": {
      Link: ({ children, href, ...propiedades }) =>
        React.createElement("a", { href, ...propiedades }, children),
    },
    "@/components/form/CampoFecha": {
      default: ({ value, id }) =>
        React.createElement("input", { id, value, readOnly: true }),
    },
  });
  prueba(
    `el receptor de sucursal es de solo lectura y distingue al registrador en ${idioma}`,
    () => {
      const Cabecera = cargar(
        "components/entregas/CabeceraRecepcionEntrega",
      ).default;
      const html = representar(
        React.createElement(Cabecera, {
          hoja: {
            id: null,
            estado: "pendiente",
            receptor_asignado: { id: 8, nombre: "Ana Rojas" },
            origen: {
              sucursal_nombre: "Centro",
              codigo_pedido: "PED-1",
              codigo_despacho: "DES-1",
              descargada_en: "2026-11-10T12:00:00Z",
            },
          },
          fecha: "2026-11-10",
          recibidoPor: "Ana Rojas",
          registradoPor: "Usuario de oficina",
          editable: true,
          bloqueado: false,
          ocupado: false,
          errores: {},
          volver() {},
          alFecha() {},
        }),
      );
      afirmar.match(html, /id="entrega-recibido-por"[^>]*readonly=""/i);
      afirmar.ok(html.includes("Ana Rojas"));
      afirmar.ok(html.includes("Usuario de oficina"));
      afirmar.ok(html.includes(t("receptorAutomatico")));
    },
  );
  prueba(
    `consultar todas no ofrece registro para una sucursal sin autorización en ${idioma}`,
    () => {
      const Fila = cargar("components/entregas/FilaListadoEntrega").default;
      const html = representar(
        React.createElement(Fila, {
          fila: {
            despacho: 1,
            pedido: 2,
            estado: "pendiente",
            sucursal_nombre: "Centro",
            cliente_nombre: "Cliente",
            descargada_en: "2026-11-10T12:00:00Z",
            acciones: {
              registrar: false,
              editar: false,
              enviar: false,
              revisar: false,
            },
          },
          permisos: { crear: true, editar: true, confirmar: true },
          oficina: true,
        }),
      );
      afirmar.ok(html.includes(t("accionConsultar")));
      afirmar.ok(!html.includes(t("accionRegistrar")));
    },
  );
}

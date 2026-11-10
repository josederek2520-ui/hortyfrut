import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
function cargar(nombre, dependencias = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL("../src/components/despachos/" + nombre, import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: compilador.ModuleKind.CommonJS,
          target: compilador.ScriptTarget.ES2022,
          jsx: compilador.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports: exportaciones,
      require: (ruta) => dependencias[ruta] ?? { default: {} },
    },
  );
  return exportaciones;
}
function representarMapa(documento, propiedades = {}) {
  const lineas = [],
    marcadores = [];
  const contenedor = ({ children }) => React.createElement("div", {}, children);
  const Mapa = cargar("MapaRutaCarretera.tsx", {
    react: React,
    "react/jsx-runtime": jsx,
    "react-leaflet": {
      MapContainer: contenedor,
      Popup: contenedor,
      useMap: () => ({}),
      useMapEvents: () => ({}),
      Circle: () => null,
      Marker: ({ children, ...propiedades }) => {
        marcadores.push(propiedades);
        return React.createElement("div", {}, children);
      },
      Polyline: (propiedades) => {
        lineas.push(propiedades);
        return null;
      },
    },
    leaflet: { divIcon: (datos) => datos },
    "next-intl": {
      useTranslations: (namespace) =>
        crearTraductor({ locale: "es", messages: mensajes, namespace }),
    },
    "@/context/ThemeContext": { useTheme: () => ({ theme: "light" }) },
    "./iconosMapa": cargar("iconosMapa.ts"),
  }).default;
  const html = representar(
    React.createElement(Mapa, { documento, ...propiedades }),
  );
  return { html, lineas, marcadores };
}
function documento() {
  const puntos = [
    {
      tipo: "almacen",
      parada: null,
      sucursal: null,
      orden: 0,
      nombre: "Almacén Central",
      cliente: "",
      longitud: "-68.14",
      latitud: "-16.5",
      color: "#16803c",
    },
    {
      tipo: "sucursal",
      parada: 7,
      sucursal: 8,
      orden: 1,
      nombre: "Sucursal <Centro>",
      cliente: "Cliente",
      longitud: "-68.12",
      latitud: "-16.49",
      color: "#2563eb",
    },
    {
      tipo: "retorno",
      parada: null,
      sucursal: null,
      orden: 2,
      nombre: "Almacén Central",
      cliente: "",
      longitud: "-68.14",
      latitud: "-16.5",
      color: "#16803c",
    },
  ];
  const coordenadas = [
    [-68.14, -16.5],
    [-68.12, -16.49],
    [-68.14, -16.5],
  ];
  return {
    despacho: 1,
    estado: "pendiente_aprobacion",
    puntos,
    faltantes: [],
    plan: {
      puntos,
      geometria: { type: "LineString", coordinates: coordenadas },
      tramos: [
        {
          orden: 1,
          color: "#2563eb",
          geometria: {
            type: "LineString",
            coordinates: coordenadas.slice(0, 2),
          },
        },
        {
          orden: 2,
          color: "#16803c",
          geometria: { type: "LineString", coordinates: coordenadas.slice(1) },
        },
      ],
    },
  };
}

prueba(
  "la supervision conserva almacen, sucursal y carretera al agregar el camion medido",
  () => {
    const resultado = representarMapa(documento(), {
      ubicacionActiva: true,
      posicion: {
        id: "gps",
        latitud: -16.501,
        longitud: -68.141,
        precisionM: 8,
        capturadaEn: "2026-11-04T12:00:00Z",
        recibidaEn: "2026-11-04T12:00:01Z",
      },
    });
    afirmar.equal(resultado.lineas.length, 2);
    afirmar.equal(resultado.marcadores.length, 3);
    afirmar.equal(resultado.marcadores[0].zIndexOffset, 1000);
    afirmar.ok(resultado.html.includes("Precisión"));
    afirmar.equal(resultado.marcadores[1].title, "Almacén Central");
    afirmar.equal(resultado.marcadores[2].title, "Sucursal <Centro>");
  },
);

prueba(
  "el mapa web usa colores por llegada, los SVG proporcionados y un único almacén",
  () => {
    const resultado = representarMapa(documento());
    afirmar.equal(resultado.lineas.length, 2);
    afirmar.equal(resultado.lineas[0].pathOptions.color, "#2563eb");
    afirmar.equal(resultado.lineas[1].pathOptions.color, "#16803c");
    afirmar.equal(resultado.marcadores.length, 2);
    afirmar.equal(resultado.marcadores[1].alt, "1. Sucursal <Centro>");
    afirmar.ok(
      resultado.marcadores[0].icon.html.includes("data:image/svg+xml,"),
    );
    afirmar.ok(
      decodeURIComponent(resultado.marcadores[1].icon.html).includes(
        'fill="#2563eb"',
      ),
    );
    afirmar.ok(resultado.html.includes("Sucursal &lt;Centro&gt;"));
  },
);

prueba(
  "un plan histórico conserva su línea global cuando faltan geometrías por tramo",
  () => {
    const datos = documento();
    datos.plan.tramos = [];
    const resultado = representarMapa(datos);
    afirmar.equal(resultado.lineas.length, 1);
    afirmar.equal(resultado.lineas[0].positions.length, 3);
    datos.estado = "obsoleta";
    afirmar.equal(representarMapa(datos).lineas.length, 0);
  },
);

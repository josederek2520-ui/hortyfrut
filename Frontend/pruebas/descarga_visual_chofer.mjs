import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leer } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { createTranslator as traductor } from "next-intl";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const mensajes = JSON.parse(
  leer(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const cargar = crearCargadorChofer({
  react: React,
  "react/jsx-runtime": jsx,
  "lucide-react": iconos,
  "next-intl": {
    useTranslations: (namespace) =>
      traductor({ locale: "es", messages: mensajes, namespace }),
  },
  "next/image": {
    default: ({ fill, unoptimized, ...datos }) =>
      React.createElement("img", datos),
  },
  "@/icons": {
    IconoProducto: () => React.createElement("span", { "data-sin-foto": true }),
  },
  "leaflet/dist/leaflet.css": {},
  "maplibre-gl/dist/maplibre-gl.css": {},
  "./estilosChofer.module.css": { default: {} },
  "@maplibre/maplibre-gl-leaflet": {},
  "@/lib/mapas/prepararMotorMapa": {},
  "@/context/ThemeContext": { useTheme: () => ({ theme: "light" }) },
  leaflet: { divIcon: (valor) => valor },
  "react-leaflet": {
    MapContainer: ({ children }) => React.createElement("div", {}, children),
    Popup: ({ children }) => children,
    Marker: ({ title, zIndexOffset, icon, children }) =>
      React.createElement(
        "div",
        {
          "data-destino": title,
          "data-prioridad": zIndexOffset,
          "data-icono": icon.html,
        },
        children,
      ),
    Polyline: ({ positions, pathOptions }) =>
      React.createElement("div", {
        "data-tramo": JSON.stringify(positions),
        "data-color": pathOptions.color,
      }),
    useMap: () => ({}),
    useMapEvents: () => ({}),
    Circle: () => null,
  },
});
const Mapa = cargar("components/chofer/MapaChofer").default;
const Producto = cargar("components/chofer/ProductoDescargaChofer").default;
const vistaRecorrido = cargar(
  "lib/chofer/modulos/recorrido/aplicacion/vistaRecorrido",
).vistaRecorrido;
function recorrido() {
  const puntos = [
    {
      tipo: "almacen",
      orden: 0,
      parada: null,
      posicion: [-68.1, -16.5],
      nombre: "Almacen",
    },
    {
      tipo: "sucursal",
      orden: 1,
      parada: 10,
      posicion: [-68.2, -16.5],
      nombre: "Centro",
      color: "#2563eb",
    },
    {
      tipo: "sucursal",
      orden: 2,
      parada: 20,
      posicion: [-68.3, -16.5],
      nombre: "Norte",
      color: "#a855f7",
    },
    {
      tipo: "retorno",
      orden: 3,
      parada: null,
      posicion: [-68.1, -16.5],
      nombre: "Almacen",
    },
  ];
  const tramos = puntos.slice(1).map((destino, indice) => ({
    orden: destino.orden,
    color: destino.color ?? "#16803c",
    geometria: {
      type: "LineString",
      coordinates: [puntos[indice].posicion, destino.posicion],
    },
  }));
  return {
    estado: "lista",
    puntos,
    plan: {
      id: 7,
      puntos,
      tramos,
      geometria: {
        type: "LineString",
        coordinates: puntos.map((punto) => punto.posicion),
      },
    },
  };
}
function mapa(ruta, paradas, mostrarCompleto = false, estadoViaje = "en_ruta") {
  return representar(
    React.createElement(Mapa, {
      ruta,
      paradas,
      estadoViaje,
      mostrarCompleto,
      posicion: null,
    }),
  );
}
prueba(
  "llegar y descargar solo parte de los pedidos conserva sucursal y carretera",
  () => {
    const html = mapa(recorrido(), [
      {
        id: 10,
        llegadaEn: "hoy",
        descargadaEn: null,
        pedidos: 2,
        pedidosDescargados: 1,
      },
      { id: 20, descargadaEn: null },
    ]);
    afirmar.match(html, /data-destino="Centro"/);
    afirmar.doesNotMatch(html, /Centro: entregada/);
    afirmar.match(html, /data-color="#2563eb"/);
    afirmar.match(html, /data-prioridad="400"/);
    afirmar.equal((html.match(/data-tramo=/g) ?? []).length, 3);
  },
);
prueba(
  "completar sucursal conserva icono y color con marca de entregada y oculta solo su tramo",
  () => {
    const ruta = recorrido(),
      guardada = JSON.stringify(ruta);
    const paradas = [
      { id: 10, descargadaEn: "hoy" },
      { id: 20, descargadaEn: null },
    ];
    const html = mapa(ruta, paradas);
    afirmar.match(html, /data-destino="Centro: entregada"/);
    afirmar.match(html, /data-icono="[^"]*#2563eb/);
    afirmar.match(html, /✓/);
    afirmar.doesNotMatch(html, /data-color="#2563eb"/);
    afirmar.match(html, /data-destino="Norte" data-prioridad="400"/);
    afirmar.match(html, /data-color="#a855f7"/);
    afirmar.equal((html.match(/data-tramo=/g) ?? []).length, 2);
    const completa = mapa(ruta, paradas, true);
    afirmar.match(completa, /data-destino="Centro: entregada"/);
    afirmar.match(completa, /data-color="#2563eb"/);
    afirmar.equal((completa.match(/data-tramo=/g) ?? []).length, 3);
    afirmar.match(
      mapa(ruta, paradas, false, "finalizado"),
      /data-destino="Centro: entregada"/,
    );
    afirmar.equal(JSON.stringify(ruta), guardada);
  },
);
prueba(
  "ultima descarga conserva todas las sucursales e ilumina solo la geometria real del regreso",
  () => {
    const ruta = recorrido(),
      paradas = [
        { id: 10, descargadaEn: "hoy" },
        { id: 20, descargadaEn: "hoy" },
      ];
    const html = mapa(ruta, paradas);
    afirmar.match(html, /data-destino="Centro: entregada"/);
    afirmar.match(html, /data-destino="Norte: entregada"/);
    afirmar.doesNotMatch(html, /data-color="#2563eb"|data-color="#a855f7"/);
    afirmar.match(html, /data-destino="Almacen"/);
    afirmar.equal((html.match(/data-tramo=/g) ?? []).length, 1);
    afirmar.match(html, /data-color="#16803c"/);
    const vista = vistaRecorrido(ruta, paradas, "en_ruta");
    afirmar.equal(vista.tramos[0], ruta.plan.tramos[2]);
    afirmar.equal(vista.puntos, ruta.plan.puntos);
    for (const punto of ruta.plan.puntos)
      afirmar.ok(
        vista.coordenadas.some(
          (posicion) =>
            JSON.stringify(posicion) === JSON.stringify(punto.posicion),
        ),
        "El encuadre debe conservar cada sucursal como referencia",
      );
    afirmar.notEqual(vista.clave, vistaRecorrido(ruta, [], "en_ruta").clave);
  },
);
prueba(
  "un plan historico sin desglose no inventa geometria para ocultar tramos",
  () => {
    const ruta = recorrido();
    ruta.plan.tramos = [];
    afirmar.equal(
      vistaRecorrido(ruta, [{ id: 10, descargadaEn: "hoy" }], "en_ruta")
        .lineaGlobal,
      ruta.plan.geometria,
    );
  },
);
prueba(
  "revision compacta muestra foto, cajillas y trazabilidad sin repetir peso ni presentacion",
  () => {
    const producto = {
      nombre: "Banana",
      imagen: "/api/v1/chofer/mis-viajes/1/imagenes/3/",
      cantidad: 1,
      columna: "cajas",
      presentacion: "Caja",
      pesoKg: "7.000",
      codigoPreparacion: "PRE-0007",
      cajillasPreparacion: [{ cajilla: 2, color: "Verde", cantidad: 3 }],
      aportes: [
        {
          lote: 1,
          codigo: "L041126-01",
          cantidad: "7.000",
          unidad: "Kg",
          pesoKg: "7.000",
        },
      ],
    };
    const html = representar(
      React.createElement(Producto, {
        producto,
        verificable: true,
        comprobada: true,
        ocupado: false,
        alComprobar: () => {},
      }),
    );
    afirmar.match(
      html,
      /src="\/api\/v1\/chofer\/mis-viajes\/1\/imagenes\/3\/"/,
    );
    afirmar.match(html, /object-contain/);
    afirmar.match(html, /1 caja/);
    afirmar.match(html, /Verde/);
    afirmar.match(html, /× 3/);
    afirmar.doesNotMatch(html, /7\.000|Caja ·|7 kg · 7 kg/);
    afirmar.match(
      html,
      /<details[^>]*>.*Ver trazabilidad.*PRE-0007.*L041126-01/s,
    );
    afirmar.doesNotMatch(html, /<details[^>]*open/);
    afirmar.match(html, /type="checkbox"/);
    const sinFoto = representar(
      React.createElement(Producto, {
        producto: { ...producto, imagen: null, cajillasPreparacion: [] },
        verificable: false,
        comprobada: false,
        ocupado: true,
      }),
    );
    afirmar.match(sinFoto, /data-sin-foto/);
    afirmar.doesNotMatch(sinFoto, /type="checkbox"|Cajillas previstas/);
  },
);

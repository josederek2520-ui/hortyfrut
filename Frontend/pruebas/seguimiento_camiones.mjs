import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";
const cargar = crearCargadorChofer({}, { URLSearchParams });
const { consultaSeguimientoCamiones, elegirViajeSupervision, esViajeActual } =
  cargar("components/despachos/seguimientoCamiones");
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

prueba(
  "el listado de seguimiento consulta los viajes actuales y pagina con sus filtros",
  () => {
    const ruta = consultaSeguimientoCamiones({
      buscar: "  DES-000012  ",
      estado: "en_ruta",
      pagina: 2,
    });
    afirmar.equal(
      ruta,
      "despachos/viajes-actuales/?pagina=2&buscar=DES-000012&estado=en_ruta",
    );
    afirmar.equal(
      consultaSeguimientoCamiones({ buscar: "", estado: "", pagina: 1 }),
      "despachos/viajes-actuales/?pagina=1",
    );
    for (const [estado, enviado, esperado] of [
      ["borrador", null, false],
      ["borrador", "fecha", true],
      ["en_ruta", null, true],
      ["finalizado", "fecha", false],
      ["cancelado", "fecha", false],
    ]) {
      afirmar.equal(esViajeActual({ estado, enviado_en: enviado }), esperado);
    }
  },
);
prueba(
  "cambiar filtros retira la seleccion anterior y el acceso desde Despachos conserva su viaje",
  () => {
    afirmar.equal(
      elegirViajeSupervision(
        [{ id: 7 }],
        { ruta: "inicial", id: 8 },
        "inicial",
      ),
      8,
    );
    afirmar.equal(
      elegirViajeSupervision([{ id: 7 }], { ruta: "inicial", id: 8 }, "otra"),
      7,
    );
    afirmar.equal(elegirViajeSupervision([], null, "otra"), null);
  },
);
prueba(
  "los idiomas habilitados cubren todas las operaciones del historial de rutas",
  () => {
    for (const idioma of ["es", "en"]) {
      const t = crearTraductor({
        locale: idioma,
        messages: mensajes[idioma],
        namespace: "despachos",
      });
      for (const accion of [
        "enviar",
        "iniciar",
        "llegar",
        "descargar",
        "descargar_pedido",
        "finalizar",
        "cancelar",
        "calcular_ruta",
        "aprobar_ruta",
        "optimizar_ruta",
        "cancelar_optimizacion",
      ])
        afirmar.equal(t.has(`acciones.${accion}`), true, `${idioma}:${accion}`);
      afirmar.equal(t.has("accionRegistrada"), true);
      afirmar.ok(mensajes[idioma].sidebar.items.seguimiento_camiones);
    }
    afirmar.deepEqual(
      Object.keys(mensajes.es.seguimientoCamiones).sort(),
      Object.keys(mensajes.en.seguimientoCamiones).sort(),
    );
  },
);
prueba(
  "el motor usa un worker propio de exactamente su version instalada",
  () => {
    const rutas = [];
    const version = JSON.parse(
      leerArchivo(
        new URL("../node_modules/maplibre-gl/package.json", import.meta.url),
        "utf8",
      ),
    ).version;
    const cargarMotor = crearCargadorChofer({
      "maplibre-gl": {
        getVersion: () => version,
        setWorkerUrl: (ruta) => rutas.push(ruta),
      },
    });
    cargarMotor("lib/mapas/prepararMotorMapa").prepararMotorMapa();
    afirmar.equal(rutas[0], `/mapas/maplibre/${version}/worker.mjs`);
  },
);

function cargarVista() {
  return crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "next-intl": {
      useLocale: () => "es",
      useTranslations: (namespace) =>
        crearTraductor({ locale: "es", messages: mensajes.es, namespace }),
    },
    "./estilosSeguimientoCamiones.module.css": { default: {} },
    "@/components/compras/PaginadorCompras": {
      default: ({ total }) =>
        React.createElement("p", {}, `Paginacion ${total}`),
    },
    "@/components/logistica/EstadoConsultaLogistica": { default: () => null },
    "@/components/logistica/tipos": { clasePanel: "panel" },
    "@/lib/api": { api: () => {}, ApiError: class extends Error {} },
    "@/i18n/navigation": {
      Link: ({ children, ...propiedades }) =>
        React.createElement("a", propiedades, children),
    },
    "./SeguimientoEnVivoDespacho": {
      default: () => React.createElement("p", {}, "Canal en vivo"),
    },
  });
}
prueba(
  "el panel presenta diez viajes seleccionables y omite paginacion cuando esta vacio",
  () => {
    const Lista = cargarVista()(
      "components/despachos/ListadoViajesSupervision",
    ).default;
    const results = Array.from({ length: 10 }, (_, indice) => ({
      id: indice + 1,
      codigo: `DES-${indice + 1}`,
      estado: "en_ruta",
      vehiculo_placa: "123-ABC",
      chofer_nombre: "Chofer",
      almacen_nombre: "Central",
      fecha_reparto: "2026-11-04",
    }));
    const propiedades = {
      filtros: { buscar: "", estado: "", pagina: 1 },
      identificador: 1,
      alElegir: () => {},
      alCambiar: () => {},
      consulta: {
        datos: { count: 13, results },
        cargando: false,
        fallo: false,
        recargar: () => {},
      },
    };
    const html = representar(React.createElement(Lista, propiedades));
    afirmar.equal((html.match(/<li>/g) || []).length, 10);
    afirmar.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
    afirmar.ok(html.includes("Paginacion 13"));
    const vacio = representar(
      React.createElement(Lista, {
        ...propiedades,
        consulta: { ...propiedades.consulta, datos: { count: 0, results: [] } },
      }),
    );
    afirmar.ok(vacio.includes("No hay viajes en ruta"));
    afirmar.ok(!vacio.includes("Paginacion"));
  },
);
prueba(
  "Despachos enlaza a la seccion de seguimiento sin abrir un canal ni un mapa incrustado",
  () => {
    const Ruta = cargarVista()("components/despachos/RutaDespacho").default;
    const html = representar(
      React.createElement(Ruta, {
        despacho: {
          id: 7,
          version: "version",
          estado: "en_ruta",
          enviado_en: "fecha",
        },
        alError: () => {},
      }),
    );
    afirmar.ok(html.includes('href="/seguimiento-camiones?viaje=7"'));
    afirmar.ok(!html.includes("Canal en vivo"));
  },
);

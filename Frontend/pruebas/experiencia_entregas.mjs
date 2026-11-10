import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargar = crearCargadorChofer();
const calculos = cargar("components/entregas/calculosEntrega");
const producto = {
  producto: 1,
  nombre: "Banana",
  cajas: 0,
  unidades: 0,
  peso_kg: "7",
  aportes: [],
};
const linea = () => ({
  ...calculos.lineaVacia(),
  cajas_recibidas: "0",
  unidades_recibidas: "0",
  peso_recibido_kg: "6.8",
});

prueba(
  "el progreso recorre doce productos y distingue vacio de cero, sin alterar lo anotado",
  () => {
    const productos = Array.from({ length: 12 }, (_, indice) => ({
      ...producto,
      producto: indice + 1,
    }));
    const hoja = { origen: { productos } };
    const lineas = Object.fromEntries(
      productos.slice(0, 11).map((fila) => [fila.producto, linea()]),
    );
    const original = JSON.stringify(lineas);
    afirmar.equal(
      calculos.progresoRecepcionEntrega(hoja, lineas).completos,
      11,
    );
    afirmar.equal(calculos.progresoRecepcionEntrega(hoja, lineas).total, 12);
    afirmar.equal(JSON.stringify(lineas), original);
    lineas[12] = { ...linea(), peso_recibido_kg: "0" };
    afirmar.equal(
      calculos.progresoRecepcionEntrega(hoja, lineas).completos,
      12,
    );
    lineas[12].peso_rechazado_kg = "0.1";
    afirmar.equal(
      calculos.progresoRecepcionEntrega(hoja, lineas).completos,
      11,
    );
  },
);

prueba(
  "la revision identifica cabecera y campos de productos fuera de la primera pagina",
  () => {
    const hoja = {
      fecha_minima: "2026-11-01",
      fecha_maxima: "2026-11-08",
      origen: { productos: [producto, { ...producto, producto: 12 }] },
    };
    const errores = calculos.validarRecepcionEntrega(
      hoja,
      { 1: linea() },
      "",
      "",
    );
    afirmar.equal(errores.fecha_recepcion[0], "fechaObligatoria");
    afirmar.equal(errores.recibido_por[0], "personaObligatoria");
    afirmar.equal(errores["12_peso_recibido_kg"][0], "cantidadObligatoria");
    afirmar.equal(
      calculos.validarRecepcionEntrega(
        hoja,
        { 1: linea(), 12: linea() },
        "2026-10-31",
        "Persona",
      ).fecha_recepcion[0],
      "fechaFueraRango",
    );
    afirmar.equal(
      Object.keys(
        calculos.erroresLineaEntrega({ ...linea(), peso_rechazado_kg: "0.3" }),
      ).includes("motivo_rechazo"),
      true,
    );
  },
);

prueba(
  "un error navega a su producto o aporte entre paginas sin afectar la cabecera",
  () => {
    const hoja = {
      origen: {
        productos: Array.from({ length: 25 }, (_, indice) => ({
          ...producto,
          producto: indice + 100,
        })),
      },
    };
    afirmar.equal(
      calculos.destinoErrorEntrega(hoja, "110_peso_recibido_kg").pagina,
      2,
    );
    afirmar.equal(calculos.destinoErrorEntrega(hoja, "lotes_124").pagina, 3);
    afirmar.equal(
      calculos.destinoErrorEntrega(hoja, "fecha_recepcion").pagina,
      null,
    );
    afirmar.equal(
      calculos.destinoErrorEntrega(hoja, "recibido_por").campo,
      "recibido_por",
    );
    afirmar.equal(
      calculos.destinoErrorEntrega(hoja, "aportes").campo,
      "lineas",
    );
  },
);

prueba(
  "la diferencia por producto conserva signos y milesimas, separada del rechazo",
  () => {
    afirmar.equal(calculos.diferenciaProductoEntrega("7", "6,999"), "0.001");
    afirmar.equal(calculos.diferenciaProductoEntrega("7", "7.001"), "-0.001");
    afirmar.equal(calculos.diferenciaProductoEntrega("7", "7"), "0");
    afirmar.equal(calculos.diferenciaProductoEntrega(null, "7"), null);
    afirmar.equal(calculos.diferenciaProductoEntrega("7", ""), null);
  },
);

prueba(
  "la conciliacion cuenta todos los aportes, exige ceros explicitos y suma exactamente",
  () => {
    const origenes = Array.from({ length: 12 }, (_, indice) => ({
      carga: indice + 1,
      lote: 50 + indice,
    }));
    const p = { ...producto, aportes: origenes };
    const aportes = Object.fromEntries(
      origenes.map((a) => [
        a.carga + "-" + a.lote,
        { ...a, peso_recibido_kg: "0.1", peso_rechazado_kg: "0" },
      ]),
    );
    const l = { ...linea(), peso_recibido_kg: "1.2" };
    let resumen = calculos.resumenConciliacionEntrega(p, l, aportes);
    afirmar.equal(resumen.recibido, "1.2");
    afirmar.equal(resumen.coincide, true);
    aportes["12-61"].peso_recibido_kg = "0.101";
    resumen = calculos.resumenConciliacionEntrega(p, l, aportes);
    afirmar.equal(resumen.pendienteRecibido, "-0.001");
    afirmar.equal(resumen.coincide, false);
    aportes["12-61"].peso_rechazado_kg = "";
    afirmar.equal(
      calculos.resumenConciliacionEntrega(p, l, aportes).completos,
      11,
    );
    const vacios = {};
    calculos.resumenConciliacionEntrega(p, l, vacios);
    afirmar.equal(Object.keys(vacios).length, 0);
  },
);

for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL("../src/messages/" + idioma + ".json", import.meta.url),
      "utf8",
    ),
  );
  const t = crearTraductor({
    locale: idioma,
    messages: mensajes,
    namespace: "entregas",
  });
  const icono = () => React.createElement("i", { "aria-hidden": true });
  const cargador = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": { useTranslations: () => t, useLocale: () => idioma },
    "lucide-react": { ArrowRight: icono, Save: icono, LoaderCircle: icono },
    "@/components/productos/ImagenProducto": {
      default: ({ nombre }) => React.createElement("span", {}, nombre),
    },
  });
  prueba(
    "la consulta confirmada muestra cantidades y motivos sin campos editables en " +
      idioma,
    () => {
      const Tabla = cargador(
        "components/entregas/TablaRecepcionEntrega",
      ).default;
      const html = representar(
        React.createElement(Tabla, {
          productos: [producto],
          lineas: {
            1: {
              ...linea(),
              peso_rechazado_kg: "0.3",
              motivo_rechazo: "Golpeado",
            },
          },
          errores: {},
          bloqueado: true,
          soloLectura: true,
          alCambiar: () => afirmar.fail("Consulta inmutable"),
        }),
      );
      afirmar.doesNotMatch(html, /<input|<textarea|disabled=/);
      afirmar.ok(html.includes("Golpeado"));
      afirmar.ok(html.includes(idioma === "es" ? "6,5" : "6.5"));
      afirmar.ok(
        html.includes(
          t("faltanKilos", { kilos: idioma === "es" ? "0,2" : "0.2" }),
        ),
      );
    },
  );
  prueba(
    "las acciones distinguen borrador, revision y consulta confirmada en " +
      idioma,
    () => {
      const Acciones = cargador(
        "components/entregas/AccionesRecepcionEntrega",
      ).default;
      const base = {
        permisos: { crear: true, editar: true, enviar: true, confirmar: true },
        editable: true,
        oficina: false,
        ocupado: false,
        incierto: false,
        modificado: false,
        alSalir() {},
        alGuardar() {},
        alEnviar() {},
        alConfirmar() {},
        alDevolver() {},
      };
      const pendiente = representar(
        React.createElement(Acciones, {
          ...base,
          hoja: { id: null, estado: "pendiente" },
        }),
      );
      afirmar.ok(pendiente.includes(t("enviarRevision")));
      afirmar.ok(pendiente.includes(t("recepcionSinRegistrar")));
      const revision = representar(
        React.createElement(Acciones, {
          ...base,
          hoja: { id: 1, estado: "revision" },
          oficina: true,
        }),
      );
      afirmar.ok(revision.includes(t("guardarCambios")));
      afirmar.ok(revision.includes(t("confirmar")));
      const confirmada = representar(
        React.createElement(Acciones, {
          ...base,
          hoja: { id: 1, estado: "confirmada" },
          editable: false,
          oficina: true,
        }),
      );
      afirmar.ok(confirmada.includes(t("confirmadaSoloConsulta")));
      afirmar.ok(!confirmada.includes(t("guardar")));
      afirmar.ok(!confirmada.includes(t("confirmar") + "</button>"));
    },
  );
}

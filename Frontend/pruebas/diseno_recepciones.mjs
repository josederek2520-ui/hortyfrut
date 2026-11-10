import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import * as iconos from "lucide-react";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const Entrada = ({ error, ...propiedades }) =>
  React.createElement("input", {
    ...propiedades,
    "aria-invalid": error || undefined,
  });
const Etiqueta = ({ children, htmlFor }) =>
  React.createElement("label", { htmlFor }, children);
const Fecha = ({ alCambiar, error, ...propiedades }) =>
  React.createElement("input", {
    ...propiedades,
    type: "date",
    "aria-invalid": error || undefined,
    onChange: (evento) => alCambiar(evento.target.value),
  });
const Selector = ({ etiqueta, valor, nombre, deshabilitado }) =>
  React.createElement(
    "button",
    {
      type: "button",
      name: nombre,
      disabled: deshabilitado,
      "aria-label": etiqueta,
    },
    valor?.nombre,
  );
const nodos = (arbol) =>
  !arbol || typeof arbol !== "object"
    ? []
    : [arbol, ...React.Children.toArray(arbol.props?.children).flatMap(nodos)];
const base = () => ({
  clave: "compra-1",
  detalleCompra: 1,
  producto: { id: 10, nombre: "Banana" },
  unidad: { id: 2, nombre: "Kilogramo", abreviatura: "kg", es_kg: true },
  medidaCompra: "Caja",
  pendiente: "3",
  cantidadCompra: "2",
  cantidadInventario: "15",
  pesoKg: "",
  vencimiento: "",
  proveedorNombre: "Mario Mamani",
  unidadCompra: null,
});

function preparar(linea = base(), idioma = "es", cambiosPropiedades = {}) {
  const estados = [];
  let indiceEstado = 0;
  const mensajes = JSON.parse(
    leerArchivo(
      new URL(`../src/messages/${idioma}.json`, import.meta.url),
      "utf8",
    ),
  );
  const cargar = crearCargadorChofer({
    react: {
      ...React,
      useState: (inicial) => {
        const indice = indiceEstado++;
        if (!(indice in estados)) estados[indice] = inicial;
        return [
          estados[indice],
          (nuevo) =>
            (estados[indice] =
              typeof nuevo === "function" ? nuevo(estados[indice]) : nuevo),
        ];
      },
    },
    "react/jsx-runtime": jsx,
    "lucide-react": iconos,
    "next-intl": {
      useLocale: () => idioma,
      useTranslations: (namespace) =>
        crearTraductor({ locale: idioma, messages: mensajes, namespace }),
    },
    "@/components/form/input/InputField": { default: Entrada },
    "@/components/form/Label": { default: Etiqueta },
    "@/components/form/CampoFecha": { default: Fecha },
    "@/components/compras/DesplegableCompra": { default: Selector },
    "@/components/productos/ImagenProducto": {
      default: ({ nombre }) =>
        React.createElement("span", { role: "img", "aria-label": nombre }),
    },
  });
  const calculos = cargar("components/recepciones/calculos");
  const Fila = cargar(
    "components/recepciones/LineaFormularioRecepcion",
  ).default;
  const propiedades = {
    linea,
    indice: 0,
    vinculada: true,
    fecha: "2026-11-04",
    ocupado: false,
    errores: {},
    alCambiar: (cambios) =>
      (propiedades.linea = calculos.actualizarMedicion(
        propiedades.linea,
        cambios,
      )),
    alEliminar() {},
    alError() {},
    ...cambiosPropiedades,
  };
  let arbol;
  const dibujar = () => {
    indiceEstado = 0;
    arbol = Fila(propiedades);
    return arbol;
  };
  dibujar();
  return {
    propiedades,
    dibujar,
    html: () => representar(dibujar()),
    entrada: (campo) =>
      nodos(dibujar()).find(
        (nodo) =>
          nodo.type === Entrada && nodo.props.name === `detalle_0_${campo}`,
      ),
    fecha: () => nodos(dibujar()).find((nodo) => nodo.type === Fecha),
    unidad: () => nodos(dibujar()).find((nodo) => nodo.type === Selector),
    mas: () =>
      nodos(dibujar()).find(
        (nodo) =>
          nodo.type === "button" &&
          nodo.props["aria-controls"]?.startsWith("extras-"),
      ),
  };
}

prueba(
  "la fila compacta separa lo recibido y lo medido y calcula solo el pendiente de compra",
  () => {
    for (const idioma of ["es", "en"]) {
      const entorno = preparar(base(), idioma);
      afirmar.equal(entorno.entrada("cantidad_compra").props.value, "2");
      afirmar.equal(entorno.entrada("cantidad_inventario").props.value, "15");
      afirmar.match(
        entorno.html(),
        idioma === "es" ? /Pendiente: 3 Caja/ : /Pending: 3 Caja/,
      );
      afirmar.match(
        entorno.html(),
        idioma === "es" ? /Quedará: 1 Caja/ : /Remaining: 1 Caja/,
      );
      afirmar.equal(
        nodos(entorno.dibujar()).filter((nodo) => nodo.props?.role === "cell")
          .length,
        5,
      );
      entorno
        .entrada("cantidad_compra")
        .props.onChange({ target: { value: "2,5" } });
      afirmar.equal(entorno.propiedades.linea.cantidadCompra, "2,5");
      afirmar.equal(entorno.propiedades.linea.cantidadInventario, "15");
      afirmar.match(entorno.html(), /0[,.]5 Caja/);
      entorno
        .entrada("cantidad_compra")
        .props.onChange({ target: { value: "2,55" } });
      afirmar.equal(entorno.propiedades.linea.cantidadCompra, "2,5");
    }
  },
);

prueba(
  "las filas vacias conservan campos vacios y el exceso sigue visible junto a la llegada",
  () => {
    const entorno = preparar({
      ...base(),
      cantidadCompra: "",
      cantidadInventario: "",
    });
    afirmar.equal(entorno.entrada("cantidad_compra").props.value, "");
    afirmar.equal(entorno.entrada("cantidad_inventario").props.value, "");
    afirmar.doesNotMatch(entorno.html(), /Quedará:/);
    afirmar.equal(entorno.fecha().props.min, "2026-11-04");
    entorno
      .entrada("cantidad_compra")
      .props.onChange({ target: { value: "4" } });
    afirmar.match(entorno.html(), /role="alert"[^>]*>Supera lo pendiente/);
    afirmar.doesNotMatch(entorno.html(), /Quedará: -/);
    entorno.fecha().props.alCambiar("2026-11-10");
    afirmar.equal(entorno.propiedades.linea.vencimiento, "2026-11-10");
    afirmar.equal(entorno.propiedades.linea.cantidadInventario, "");
  },
);

prueba(
  "una unidad base identica conserva un solo campo y cambiarla retira la medicion",
  () => {
    const entorno = preparar({
      ...base(),
      medidaCompra: "kg",
      unidadCompra: 2,
      cantidadCompra: "6",
      cantidadInventario: "6",
    });
    afirmar.equal(entorno.entrada("cantidad_compra"), undefined);
    afirmar.match(entorno.html(), /Misma cantidad de/);
    entorno
      .entrada("cantidad_inventario")
      .props.onChange({ target: { value: "7" } });
    afirmar.equal(entorno.propiedades.linea.cantidadInventario, "7");
    afirmar.equal(entorno.propiedades.linea.cantidadCompra, "7");
    entorno
      .unidad()
      .props.alElegir({
        id: 3,
        nombre: "Unidad",
        abreviatura: "uni",
        es_kg: false,
      });
    afirmar.equal(entorno.propiedades.linea.cantidadInventario, "");
    afirmar.equal(entorno.propiedades.linea.pesoKg, "");
    afirmar.equal(entorno.entrada("cantidad_compra").props.value, "7");
    afirmar.equal(entorno.entrada("cantidad_inventario").props.value, "");
  },
);

prueba(
  "mas datos solo abre el peso adicional y el vencimiento y errores mantienen su acceso",
  () => {
    const unidad = {
      id: 3,
      nombre: "Unidad",
      abreviatura: "uni",
      es_kg: false,
    };
    const entorno = preparar({ ...base(), unidad }, "es", {
      errores: {
        detalle_0_fecha_vencimiento: ["Vencimiento anterior"],
        detalle_0_cantidad_inventario: ["Anota la cantidad real"],
      },
    });
    afirmar.equal(entorno.entrada("peso_kg"), undefined);
    afirmar.ok(entorno.fecha());
    afirmar.match(entorno.html(), /Vencimiento anterior/);
    afirmar.match(entorno.html(), /Anota la cantidad real/);
    entorno.mas().props.onClick();
    afirmar.ok(entorno.entrada("peso_kg"));
    afirmar.ok(entorno.fecha());
    afirmar.ok(
      nodos(entorno.dibujar()).some(
        (nodo) =>
          nodo.props?.id === "extras-compra-1" &&
          nodo.props.className.includes("xl:col-span-5"),
      ),
    );
    entorno.mas().props.onClick();
    afirmar.equal(entorno.entrada("peso_kg"), undefined);
    afirmar.equal(preparar().mas(), undefined);
    const directa = preparar(
      { ...base(), detalleCompra: null, cantidadCompra: "", unidad },
      "es",
      { vinculada: false },
    );
    afirmar.equal(directa.entrada("cantidad_compra"), undefined);
    afirmar.ok(directa.entrada("cantidad_inventario"));
    afirmar.ok(directa.fecha());
  },
);

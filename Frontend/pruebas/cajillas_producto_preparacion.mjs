import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import * as jsx from "react/jsx-runtime";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
function cargar(ruta, dependencias = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/${ruta}`, import.meta.url),
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
      crypto: { randomUUID: () => "cajilla-prueba" },
      require: (nombre) => {
        if (nombre in dependencias) return dependencias[nombre];
        if (nombre === "react/jsx-runtime") return jsx;
        if (nombre === "next-intl")
          return {
            useTranslations: (namespace) =>
              crearTraductor({ locale: "es", messages: mensajes, namespace }),
            useLocale: () => "es",
          };
        if (nombre === "react")
          return {
            useId: () => "cajillas-prueba",
            useState: (inicial) => [
              typeof inicial === "function" ? inicial() : inicial,
              () => {},
            ],
          };
        return {
          default: nombre.endsWith(".css") ? {} : nombre.split("/").at(-1),
        };
      },
    },
  );
  return exportaciones;
}
function nodos(nodo) {
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  if (!nodo || typeof nodo !== "object") return [];
  return [nodo, ...nodos(nodo.props?.children)];
}
const plan = cargar("preparaciones/planCajillasPreparacion.ts");
const calculos = cargar("preparaciones/calculos.ts");
const validaciones = cargar("preparaciones/validaciones.ts", {
  "./calculos": calculos,
});
const papaya = { id: 3, nombre: "Papaya" };
const banana = { id: 4, nombre: "Banana" };
const sucursal = { id: 5, nombre: "Satélite" };
const color = { id: 2, nombre: "Rojo" };
const vacio = () => ({ lineas: [], asignaciones: {}, cajillas: [] });

prueba(
  "la sugerencia usa solo cajas del producto y destino, resta lo anotado y no altera UNI ni mediciones",
  () => {
    const documento = vacio();
    documento.asignaciones = {
      1: {
        producto: 3,
        sucursal: 5,
        columna: "cajas",
        cantidad: "3",
        aportes: {},
      },
      2: {
        producto: 3,
        sucursal: 5,
        columna: "unidades",
        cantidad: "40",
        aportes: {},
      },
      3: {
        producto: 4,
        sucursal: 5,
        columna: "cajas",
        cantidad: "6",
        aportes: {},
      },
      4: {
        producto: 3,
        sucursal: 8,
        columna: "cajas",
        cantidad: "10",
        aportes: {},
      },
    };
    afirmar.equal(plan.sugerenciaCajillasProducto(documento, 3, 5), 3);
    const cambiado = plan.anotarCajillasProducto(
      documento,
      papaya,
      sucursal,
      color,
      "2",
      "1",
    );
    afirmar.equal(plan.sugerenciaCajillasProducto(cambiado, 3, 5), 1);
    afirmar.equal(documento.asignaciones[1].cantidad, "3");
    afirmar.equal(Object.keys(documento.asignaciones[1].aportes).length, 0);
  },
);

prueba(
  "el saldo previsto del color resta el documento completo y no convierte el borrador en reserva",
  () => {
    const documento = plan.anotarCajillasProducto(
      vacio(),
      papaya,
      sucursal,
      { ...color, saldo: 10 },
      "2",
      "1",
    );
    const cambiado = plan.anotarCajillasProducto(
      documento,
      banana,
      { id: 8, nombre: "Centro" },
      color,
      "3",
      "2",
    );
    afirmar.equal(
      plan.saldoPrevistoColor(cambiado, { ...color, saldo: 10 }),
      5,
    );
    afirmar.equal(cambiado.cajillas[0].color.saldo, 10);
    afirmar.equal(plan.saldoPrevistoColor(cambiado, color), undefined);
  },
);

prueba(
  "elegir el color anota de inmediato la cantidad sugerida y sigue permitiendo cambiarla",
  () => {
    const documento = vacio();
    documento.asignaciones[1] = {
      producto: 3,
      sucursal: 5,
      columna: "cajas",
      cantidad: "2",
      aportes: {},
    };
    let cambiado;
    const Cajillas = cargar("preparaciones/CajillasProductoPreparacion.tsx", {
      "./planCajillasPreparacion": plan,
    }).default;
    const arbol = Cajillas({
      documento,
      producto: papaya,
      sucursal,
      almacen: 1,
      errores: {},
      alCambiar: (valor) => {
        cambiado = valor;
      },
      alError: () => {},
    });
    afirmar.equal(
      nodos(arbol).find((nodo) => nodo.type === "CampoDirectorio").props.value,
      "2",
    );
    nodos(arbol)
      .find((nodo) => nodo.type === "DesplegableCompra")
      .props.alElegir({ ...color, saldo: 10 });
    afirmar.equal(cambiado.cajillas[0].cantidad, "2");
    afirmar.equal(cambiado.cajillas[0].color.saldo, 10);
  },
);

prueba(
  "las cajillas se suman dentro del producto y destino sin copiar CANT/UNI ni mediciones",
  () => {
    const original = vacio();
    original.asignaciones[1] = {
      producto: 3,
      sucursal: 5,
      cantidad: "2",
      aportes: {},
    };
    let documento = plan.anotarCajillasProducto(
      original,
      papaya,
      sucursal,
      color,
      "7",
      "1",
    );
    documento = plan.anotarCajillasProducto(
      documento,
      banana,
      sucursal,
      color,
      "3",
      "2",
    );
    documento = plan.anotarCajillasProducto(
      documento,
      papaya,
      sucursal,
      color,
      "1",
      "3",
    );
    afirmar.equal(original.cajillas.length, 0);
    afirmar.equal(documento.cajillas.length, 2);
    afirmar.equal(plan.cajillasDelProducto(documento, 3, 5)[0].cantidad, "8");
    afirmar.equal(plan.cajillasDelProducto(documento, 4, 5)[0].cantidad, "3");
    afirmar.equal(documento.asignaciones[1].cantidad, "2");
    afirmar.equal(Object.keys(documento.asignaciones[1].aportes).length, 0);
    afirmar.equal(
      plan.resumirCajillasPreparacion(documento.cajillas)[0].cantidad,
      11,
    );
  },
);

prueba(
  "la cantidad manual controlada se conserva y elegir color la anota en el destino correcto",
  () => {
    const documento = vacio();
    documento.asignaciones[1] = {
      producto: 3,
      sucursal: 5,
      columna: "cajas",
      cantidad: "2",
      aportes: {},
    };
    const Cajillas = cargar("preparaciones/CajillasProductoPreparacion.tsx", {
      "./planCajillasPreparacion": plan,
    }).default;
    let entrada = { cantidadManual: "4", agregando: true },
      cambiado;
    const propiedades = () => ({
      documento,
      producto: papaya,
      sucursal,
      almacen: 1,
      errores: {},
      entrada,
      alEntrada: (cambio) => (entrada = { ...entrada, ...cambio }),
      alCambiar: (valor) => (cambiado = valor),
      alError() {},
    });
    let arbol = Cajillas(propiedades());
    const campo = nodos(arbol).find((nodo) => nodo.type === "CampoDirectorio");
    afirmar.equal(campo.props.value, "4");
    campo.props.onChange({ target: { value: "3" } });
    afirmar.equal(entrada.cantidadManual, "3");
    arbol = Cajillas(propiedades());
    nodos(arbol)
      .find((nodo) => nodo.type === "DesplegableCompra")
      .props.alElegir(color);
    afirmar.equal(cambiado.cajillas[0].cantidad, "3");
    afirmar.equal(cambiado.cajillas[0].sucursal.id, 5);
    afirmar.equal(cambiado.cajillas[0].producto.id, 3);
    afirmar.equal(entrada.cantidadManual, null);
    afirmar.equal(entrada.agregando, false);
  },
);

prueba(
  "solo admite enteros positivos y controla el límite al sumar el mismo color",
  () => {
    for (const cantidad of ["", "0", "-1", "1.5", "1,5", "2147483648", "texto"])
      afirmar.equal(
        plan.anotarCajillasProducto(
          vacio(),
          papaya,
          sucursal,
          color,
          cantidad,
          "1",
        ),
        null,
      );
    const documento = plan.anotarCajillasProducto(
      vacio(),
      papaya,
      sucursal,
      color,
      "2147483647",
      "1",
    );
    afirmar.equal(
      plan.anotarCajillasProducto(documento, papaya, sucursal, color, "1", "2"),
      null,
    );
  },
);

prueba(
  "el borrador conserva el producto y las previsiones históricas sin adjudicarlas automáticamente",
  () => {
    const fuente = {
      lineas: [],
      asignaciones: [],
      cajillas: [
        {
          id: 1,
          producto: 3,
          producto_nombre: "Papaya",
          sucursal: 5,
          sucursal_nombre: "Satélite",
          cajilla: 2,
          color: "Rojo",
          cantidad: 2,
        },
        {
          id: 2,
          sucursal: 5,
          sucursal_nombre: "Satélite",
          cajilla: 2,
          color: "Rojo",
          cantidad: 4,
        },
      ],
    };
    const documento = calculos.desdePreparacion(fuente);
    const carga = calculos.serializarDocumento(documento);
    afirmar.equal(documento.cajillas[1].producto, null);
    afirmar.equal(carga.cajillas[0].producto, 3);
    afirmar.equal(carga.cajillas[1].producto, null);
    afirmar.equal(
      plan.resumirCajillasPreparacion(documento.cajillas)[0].cantidad,
      6,
    );
  },
);

prueba(
  "la confirmación detecta cajillas sin preparación del producto en ese destino",
  () => {
    const documento = plan.anotarCajillasProducto(
      vacio(),
      papaya,
      sucursal,
      color,
      "2",
      "1",
    );
    const errores = validaciones.validarConfirmacionPreparacion(documento, {
      sinAsignaciones: "Sin cantidades",
      positiva: "Positiva",
      cajillasSinPreparar: "Prepara el producto o quita sus cajillas",
    });
    afirmar.equal(
      errores.cajillas_0_producto[0],
      "Prepara el producto o quita sus cajillas",
    );
  },
);

prueba(
  "CANT y UNI de la misma sucursal comparten un solo editor de cajillas en su ficha",
  () => {
    const documento = vacio();
    const necesidad = {
      clave: "1",
      id: 1,
      detalle: 1,
      producto: 3,
      sucursal: 5,
      cantidad: "2",
      pendiente: 3,
      disponible: true,
      aportes: {},
    };
    documento.asignaciones[1] = necesidad;
    documento.asignaciones[2] = {
      ...necesidad,
      clave: "2",
      id: 2,
      columna: "unidades",
    };
    const Reparto = cargar("preparaciones/RepartoProductoPreparacion.tsx", {
      "./useRepartoSucursalPreparacion": {
        default: () => ({
          sucursales: [{ id: 5, nombre: "Satélite" }],
          elegida: { id: 5, nombre: "Satélite" },
          guardadas: Object.values(documento.asignaciones),
          delProducto: Object.values(documento.asignaciones),
          filas: Object.values(documento.asignaciones),
          totalSucursales: 1,
          totalPedidos: 2,
          totalAnotadas: 1,
          posicionSucursal: 0,
        }),
      },
      "./calculos": calculos,
    }).default;
    const arbol = Reparto({
      producto: papaya,
      documento,
      contexto: "cliente=1",
      errores: {},
      alCambiar: () => {},
      alCambiarDocumento: () => {},
      alError: () => {},
    });
    const filas = nodos(arbol).filter(
      (nodo) => nodo.type === "FilaSucursalPreparacion",
    );
    afirmar.equal(filas.length, 2);
    const editores = nodos(arbol).filter(
      (nodo) => nodo.type === "CajillasProductoPreparacion",
    );
    afirmar.equal(editores.length, 1);
    afirmar.equal(editores[0].props.sucursal.id, 5);
  },
);

prueba(
  "el despacho suma ambos productos y cuenta una sola vez los planes repetidos en CANT y UNI",
  () => {
    const previsiones = [
      {
        preparacion_id: 1,
        sucursal_id: 5,
        producto_id: 3,
        cajilla_id: 2,
        color: "Rojo",
        cantidad: 2,
      },
      {
        preparacion_id: 1,
        sucursal_id: 5,
        producto_id: null,
        cajilla_id: 2,
        color: "Rojo",
        cantidad: 1,
      },
    ];
    const cargas = [
      {
        preparacion: 1,
        producto: 3,
        sucursal: 5,
        cajillas_previstas: previsiones,
      },
      {
        preparacion: 1,
        producto: 3,
        sucursal: 5,
        cajillas_previstas: previsiones,
      },
      {
        preparacion: 1,
        producto: 4,
        sucursal: 5,
        cajillas_previstas: [
          { ...previsiones[0], producto_id: 4, cantidad: 3 },
        ],
      },
    ];
    const { preverCajillasCarga } = cargar(
      "despachos/cajillasPreparadasDespacho.ts",
    );
    const resultado = preverCajillasCarga(cargas);
    afirmar.equal(resultado.length, 1);
    afirmar.equal(resultado[0].cantidad, 6);
  },
);

import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const nodos = (arbol) =>
  !arbol || typeof arbol !== "object"
    ? []
    : [arbol, ...React.Children.toArray(arbol.props?.children).flatMap(nodos)];
const vacio = () => ({ lineas: [], asignaciones: {}, cajillas: [] });
const necesidad = (id, sucursal = id, columna = "cajas") => ({
  id,
  pedido: id,
  codigo: `PED-${id}`,
  sucursal,
  sucursal_nombre: `Sucursal ${String(sucursal).padStart(2, "0")}`,
  producto: 3,
  producto_nombre: "Banana",
  presentacion_nombre: columna === "cajas" ? "Caja" : "Unidad",
  columna,
  cantidad: 2,
  preparada: 0,
  pendiente: 2,
  disponible: true,
});

function preparar(solicitar, cambios = {}) {
  const estados = [],
    efectos = [];
  let cursor = 0,
    cursorEfecto = 0,
    pendientes = [],
    arbol;
  const peticiones = [],
    errores = [];
  const cargar = crearCargadorChofer(
    {
      react: {
        ...React,
        useState(inicial) {
          const indice = cursor++;
          if (!(indice in estados))
            estados[indice] =
              typeof inicial === "function" ? inicial() : inicial;
          return [
            estados[indice],
            (valor) =>
              (estados[indice] =
                typeof valor === "function" ? valor(estados[indice]) : valor),
          ];
        },
        useEffect(funcion, dependencias) {
          const indice = cursorEfecto++;
          if (
            !efectos[indice] ||
            dependencias.some(
              (valor, posicion) =>
                !Object.is(valor, efectos[indice].dependencias[posicion]),
            )
          )
            pendientes.push(() => {
              efectos[indice]?.limpiar?.();
              efectos[indice] = { dependencias, limpiar: funcion() };
            });
        },
      },
      "react/jsx-runtime": jsx,
      "lucide-react": iconos,
      "next-intl": {
        useTranslations: (namespace) =>
          crearTraductor({ locale: "es", messages: mensajes, namespace }),
      },
      "@/components/ui/button/Button": { default: "Boton" },
      "@/components/compras/PaginadorCompras": { default: "Paginador" },
      "./FilaSucursalPreparacion": { default: "FilaSucursal" },
      "./CajillasProductoPreparacion": { default: "Cajillas" },
      "./SelectorSucursalesPreparacion": { default: "SelectorSucursales" },
      "./CargaTrabajoPreparacion": { default: "Cargando" },
      "./estilosTrabajo.module.css": { default: {} },
      "@/lib/api": {
        api: (ruta, opciones) => {
          peticiones.push({ ruta, opciones });
          return solicitar(ruta, opciones);
        },
      },
    },
    { window: { setTimeout, clearTimeout } },
  );
  const calculos = cargar("components/preparaciones/calculos");
  const Componente = cargar(
    "components/preparaciones/RepartoProductoPreparacion",
  ).default;
  const propiedades = {
    producto: { id: 3, nombre: "Banana" },
    documento: vacio(),
    contexto: "cliente=1&fecha_pedidos=2026-11-06",
    almacen: 1,
    ocupado: false,
    errores: {},
    alError: (error) => errores.push(error),
    alCambiar: (fila) =>
      (propiedades.documento = {
        ...propiedades.documento,
        asignaciones: {
          ...propiedades.documento.asignaciones,
          [fila.clave]: fila,
        },
      }),
    alCambiarDocumento: (documento) => (propiedades.documento = documento),
    alQuitar: (clave) => {
      const asignaciones = { ...propiedades.documento.asignaciones };
      delete asignaciones[clave];
      propiedades.documento = { ...propiedades.documento, asignaciones };
    },
    alElegirLote() {},
    ...cambios,
  };
  const representar = () => {
    cursor = cursorEfecto = 0;
    pendientes = [];
    arbol = Componente(propiedades);
    pendientes.forEach((funcion) => funcion());
    return arbol;
  };
  const actualizar = async () => {
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      representar();
      await esperar(2);
    }
    return representar();
  };
  representar();
  return {
    propiedades,
    peticiones,
    errores,
    cargar,
    calculos,
    representar,
    actualizar,
    arbol: () => arbol,
    buscar: (tipo) => nodos(arbol).filter((nodo) => nodo.type === tipo),
    cerrar: () => efectos.forEach((efecto) => efecto.limpiar?.()),
  };
}

function servidor(filas) {
  return async (ruta) => {
    const parametros = new URLSearchParams(ruta.split("?")[1]);
    const pagina = Number(parametros.get("pagina"));
    const todos = ruta.includes("sucursales-producto")
      ? [
          ...new Map(
            filas.map((fila) => [
              fila.sucursal,
              {
                id: fila.sucursal,
                nombre: fila.sucursal_nombre,
                pedidos: 1,
                lineas: 1,
              },
            ]),
          ).values(),
        ]
      : filas.filter(
          (fila) => fila.sucursal === Number(parametros.get("sucursal")),
        );
    return {
      count: todos.length,
      results: todos.slice((pagina - 1) * 10, pagina * 10),
    };
  };
}

prueba(
  "cambiar de sucursal conserva cantidades, aportes y cajillas de todo el documento",
  async () => {
    const entorno = preparar(servidor([necesidad(1), necesidad(2)]));
    await entorno.actualizar();
    afirmar.equal(entorno.buscar("FilaSucursal").length, 1);
    const primera = entorno.buscar("FilaSucursal")[0];
    primera.props.alCambiar({
      ...primera.props.asignacion,
      cantidad: "1",
      aportes: { 8: { cantidad: "7", pesoKg: "" } },
    });
    entorno.representar();
    entorno
      .buscar("Cajillas")[0]
      .props.alCambiar({
        ...entorno.propiedades.documento,
        cajillas: [
          {
            clave: "verde",
            producto: { id: 3, nombre: "Banana" },
            sucursal: { id: 1, nombre: "Sucursal 01" },
            color: { id: 4, nombre: "Verde" },
            cantidad: "1",
          },
        ],
      });
    entorno.representar();
    entorno
      .buscar("Cajillas")[0]
      .props.alEntrada({ cantidadManual: "4", agregando: true });
    entorno.representar();
    entorno.buscar("SelectorSucursales")[0].props.alElegir(2);
    await entorno.actualizar();
    afirmar.ok(
      entorno
        .buscar("FilaSucursal")
        .every((fila) => fila.props.asignacion.sucursal === 2),
    );
    const segunda = entorno.buscar("FilaSucursal")[0];
    segunda.props.alCambiar({
      ...segunda.props.asignacion,
      cantidad: "2",
      aportes: { 8: { cantidad: "9", pesoKg: "" } },
    });
    entorno.representar();
    afirmar.equal(
      entorno.buscar("Cajillas")[0].props.entrada.cantidadManual,
      null,
    );
    entorno.buscar("SelectorSucursales")[0].props.alElegir(1);
    await entorno.actualizar();
    afirmar.equal(
      entorno.buscar("FilaSucursal")[0].props.asignacion.cantidad,
      "1",
    );
    afirmar.equal(
      entorno.buscar("Cajillas")[0].props.entrada.cantidadManual,
      "4",
    );
    afirmar.equal(entorno.buscar("Cajillas")[0].props.entrada.agregando, true);
    const carga = entorno.calculos.serializarDocumento(
      entorno.propiedades.documento,
    );
    afirmar.equal(carga.asignaciones.length, 2);
    afirmar.equal(carga.asignaciones[0].aportes[0].cantidad, "7");
    afirmar.equal(carga.asignaciones[1].aportes[0].cantidad, "9");
    afirmar.equal(carga.cajillas[0].cantidad, 1);
    entorno.cerrar();
  },
);

prueba(
  "varios pedidos CANT y UNI de una sucursal mantienen paginas de diez y un editor de cajillas",
  async () => {
    const entorno = preparar(
      servidor([
        ...Array.from({ length: 12 }, (_, indice) =>
          necesidad(indice + 1, 1, indice % 2 ? "unidades" : "cajas"),
        ),
        necesidad(20, 2),
      ]),
    );
    await entorno.actualizar();
    afirmar.equal(
      entorno.buscar("SelectorSucursales")[0].props.sucursales.length,
      2,
    );
    afirmar.equal(entorno.buscar("FilaSucursal").length, 10);
    const fila = entorno.buscar("FilaSucursal")[0];
    fila.props.alCambiar({ ...fila.props.asignacion, cantidad: "1" });
    entorno.representar();
    afirmar.equal(entorno.buscar("Cajillas").length, 1);
    entorno
      .buscar("Paginador")
      .find((nodo) => nodo.props.total === 12)
      .props.alCambiar(2);
    await entorno.actualizar();
    afirmar.equal(entorno.buscar("FilaSucursal").length, 2);
    afirmar.ok(
      entorno
        .buscar("FilaSucursal")
        .every((nodo) => nodo.props.asignacion.sucursal === 1),
    );
    afirmar.equal(entorno.buscar("Cajillas").length, 1);
    entorno.cerrar();
  },
);

prueba(
  "la navegacion entre sucursales cruza paginas y vuelve al ultimo destino anterior",
  async () => {
    const entorno = preparar(
      servidor(
        Array.from({ length: 12 }, (_, indice) => necesidad(indice + 1)),
      ),
    );
    await entorno.actualizar();
    entorno.buscar("SelectorSucursales")[0].props.alElegir(10);
    await entorno.actualizar();
    const siguiente = () =>
      entorno
        .buscar("Boton")
        .find((nodo) => nodo.props.children === "Siguiente sucursal");
    siguiente().props.onClick();
    await entorno.actualizar();
    afirmar.equal(entorno.buscar("SelectorSucursales")[0].props.elegida, 11);
    const anterior = entorno
      .buscar("Boton")
      .find((nodo) => nodo.props["aria-label"] === "Sucursal anterior");
    anterior.props.onClick();
    await entorno.actualizar();
    afirmar.equal(entorno.buscar("SelectorSucursales")[0].props.elegida, 10);
    afirmar.equal(entorno.buscar("Paginador")[0].props.pagina, 1);
    entorno.cerrar();
  },
);

prueba(
  "una respuesta tardia de otra sucursal no reemplaza los pedidos visibles",
  async () => {
    const pendientes = [];
    const grupos = servidor([necesidad(1), necesidad(2)]);
    const entorno = preparar((ruta, opciones) =>
      ruta.includes("sucursales-producto")
        ? grupos(ruta)
        : new Promise((resolver) =>
            pendientes.push({ ruta, opciones, resolver }),
          ),
    );
    await entorno.actualizar();
    entorno.buscar("SelectorSucursales")[0].props.alElegir(2);
    await entorno.actualizar();
    afirmar.ok(pendientes[0].opciones.signal.aborted);
    pendientes[1].resolver({ count: 1, results: [necesidad(2)] });
    await entorno.actualizar();
    afirmar.equal(
      entorno.buscar("FilaSucursal")[0].props.asignacion.sucursal,
      2,
    );
    pendientes[0].resolver({ count: 1, results: [necesidad(1)] });
    await entorno.actualizar();
    afirmar.equal(
      entorno.buscar("FilaSucursal")[0].props.asignacion.sucursal,
      2,
    );
    entorno.cerrar();
  },
);

prueba(
  "los errores abren la sucursal y la pagina de pedidos correctas sin perder cajillas",
  () => {
    const entorno = preparar(
      async () => {
        throw new Error("No debe consultar");
      },
      { mostrarAnotadas: true },
    );
    entorno.cerrar();
    const documento = vacio();
    const convertir = entorno.calculos.desdeNecesidad;
    for (let indice = 1; indice <= 12; indice++)
      documento.asignaciones[String(indice)] = convertir(necesidad(indice));
    for (let indice = 13; indice <= 23; indice++)
      documento.asignaciones[String(indice)] = convertir(necesidad(indice, 12));
    documento.cajillas.push({
      clave: "rojo",
      producto: { id: 3, nombre: "Banana" },
      sucursal: { id: 12, nombre: "Sucursal 12" },
      color: { id: 4, nombre: "Rojo" },
      cantidad: "1",
    });
    const error = preparar(
      async () => {
        throw new Error("No debe consultar");
      },
      {
        documento,
        mostrarAnotadas: true,
        paginaInicial: 99,
        errores: { asignaciones_22_cantidad: ["Cantidad invalida"] },
      },
    );
    afirmar.equal(error.buscar("SelectorSucursales")[0].props.elegida, 12);
    afirmar.equal(
      error.buscar("Paginador").find((nodo) => nodo.props.total === 12).props
        .pagina,
      2,
    );
    afirmar.equal(error.buscar("FilaSucursal").length, 2);
    afirmar.ok(
      error
        .buscar("FilaSucursal")
        .some((nodo) => nodo.props.asignacion.clave === "23"),
    );
    afirmar.equal(error.buscar("Cajillas").length, 1);
    afirmar.equal(error.peticiones.length, 0);
    error.cerrar();
  },
);

prueba(
  "anotados conserva destinos que ya no tienen pendientes y bloquea navegar durante el guardado",
  async () => {
    const entorno = preparar(servidor([necesidad(1)]));
    entorno.propiedades.documento.asignaciones["2"] =
      entorno.calculos.desdeNecesidad(necesidad(2));
    await entorno.actualizar();
    const alternar = () =>
      nodos(entorno.arbol()).find(
        (nodo) =>
          nodo.type === "button" &&
          String(nodo.props.children).startsWith("Ver "),
      );
    alternar().props.onClick();
    await entorno.actualizar();
    afirmar.equal(entorno.buscar("SelectorSucursales")[0].props.elegida, 2);
    afirmar.equal(
      entorno.buscar("FilaSucursal")[0].props.asignacion.sucursal,
      2,
    );
    entorno.propiedades.ocupado = true;
    entorno.representar();
    afirmar.ok(entorno.buscar("SelectorSucursales")[0].props.ocupado);
    alternar().props.onClick();
    entorno.representar();
    afirmar.equal(entorno.buscar("SelectorSucursales")[0].props.elegida, 2);
    entorno.cerrar();
  },
);

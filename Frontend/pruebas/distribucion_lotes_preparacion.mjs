import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargarPuro = crearCargadorChofer();
const distribucion = cargarPuro(
  "components/preparaciones/distribucionLotesPreparacion",
);
const calculos = cargarPuro("components/preparaciones/calculos");
const lote = (id = 1, saldo = "2") => ({
  id,
  nombre: `L041126-${id}`,
  producto: 3,
  producto_nombre: "Papaya",
  unidad: 1,
  unidad_nombre: "Kilogramo",
  unidad_abreviatura: "kg",
  es_kg: true,
  saldo,
});
const base = () => {
  const origen = lote();
  const asignacion = {
    clave: "1",
    detalle: 1,
    pedido: 7,
    codigo: "PED-000017",
    sucursal: 4,
    sucursalNombre: "Miraflores",
    producto: 3,
    productoNombre: "Papaya",
    presentacion: "Caja",
    columna: "cajas",
    solicitada: 1,
    pendiente: 1,
    cantidad: "1",
    disponible: true,
    aportes: { 1: { cantidad: "7", pesoKg: "" } },
  };
  return {
    origen,
    asignacion,
    documento: {
      lineas: [{ lote: origen, merma: "", aprovechable: "", motivo: "" }],
      asignaciones: { 1: asignacion },
      cajillas: [],
    },
  };
};
const contexto = "cliente=1&fecha_pedidos=2026-11-06";
const aplicar = (
  datos,
  adicionales,
  huella = distribucion.huellaDistribucionLotes(
    datos.documento,
    datos.asignacion,
    contexto,
    1,
  ),
) =>
  distribucion.aplicarDistribucionLotes(
    datos.documento,
    datos.asignacion,
    datos.origen,
    adicionales,
    huella,
    contexto,
    1,
  );
const codigo = (esperado) => (error) => error.codigo === esperado;

prueba(
  "avisa que faltan 5 kg y solo aplicar el reparto cambia 7 a 2 mas 5",
  () => {
    const datos = base(),
      copia = JSON.stringify(datos);
    const aviso = distribucion.insuficienciaLotePreparacion(
      datos.documento,
      datos.asignacion,
      datos.origen,
    );
    afirmar.equal(aviso.disponible, "2");
    afirmar.equal(aviso.faltante, "5");
    const propuesta = distribucion.proponerDistribucionLotes(
      datos.documento,
      datos.asignacion,
      datos.origen,
      [lote(2, "5")],
    );
    afirmar.equal(propuesta.faltante, "0");
    afirmar.deepEqual(
      Array.from(propuesta.filas, (fila) => fila.cantidad),
      ["2", "5"],
    );
    afirmar.equal(JSON.stringify(datos), copia);
    const nuevo = aplicar(datos, [lote(2, "5")]);
    afirmar.equal(nuevo.asignaciones[1].aportes[1].cantidad, "2");
    afirmar.equal(nuevo.asignaciones[1].aportes[2].cantidad, "5");
    afirmar.equal(nuevo.asignaciones[1].cantidad, "1");
    afirmar.equal(
      calculos.serializarDocumento(nuevo).asignaciones[0].aportes.length,
      2,
    );
    afirmar.equal(JSON.stringify(datos), copia);
  },
);

prueba(
  "el reparto resta otras sucursales, descarte y aprovechable y conserva sus datos",
  () => {
    const datos = base();
    datos.origen.saldo = "10";
    datos.documento.lineas[0].merma = "0.5";
    datos.documento.lineas[0].aprovechable = "0.5";
    datos.documento.lineas[0].motivo = "Separacion medida";
    datos.documento.asignaciones[2] = {
      ...datos.asignacion,
      clave: "2",
      sucursal: 5,
      aportes: { 1: { cantidad: "7", pesoKg: "" } },
    };
    datos.documento.cajillas.push({
      clave: "verde",
      sucursal: { id: 4, nombre: "Miraflores" },
      producto: { id: 3, nombre: "Papaya" },
      color: { id: 2, nombre: "Verde" },
      cantidad: "1",
    });
    const previo = JSON.stringify(datos.documento.asignaciones[2]);
    const nuevo = aplicar(datos, [lote(2, "8")]);
    afirmar.equal(nuevo.asignaciones[1].aportes[1].cantidad, "2");
    afirmar.equal(nuevo.asignaciones[1].aportes[2].cantidad, "5");
    afirmar.equal(JSON.stringify(nuevo.asignaciones[2]), previo);
    afirmar.equal(nuevo.cajillas, datos.documento.cajillas);
    afirmar.equal(nuevo.lineas[0].merma, "0.5");
    afirmar.equal(nuevo.lineas[0].aprovechable, "0.5");
  },
);

prueba(
  "admite tres lotes y decimales exactos sin aplicar un reparto incompleto",
  () => {
    const datos = base();
    afirmar.equal(
      distribucion.proponerDistribucionLotes(
        datos.documento,
        datos.asignacion,
        datos.origen,
        [lote(2, "3")],
      ).faltante,
      "2",
    );
    afirmar.throws(() => aplicar(datos, [lote(2, "3")]), codigo("incompleto"));
    afirmar.equal(
      aplicar(datos, [lote(2, "3"), lote(3, "2")]).asignaciones[1].aportes[3]
        .cantidad,
      "2",
    );
    datos.origen.saldo = "0.125";
    datos.asignacion.aportes[1].cantidad = "0.5";
    const preciso = aplicar(datos, [lote(2, "0.375")]);
    afirmar.equal(preciso.asignaciones[1].aportes[1].cantidad, "0.125");
    afirmar.equal(preciso.asignaciones[1].aportes[2].cantidad, "0.375");
    afirmar.equal(
      distribucion.totalesKgAsignacion(preciso, preciso.asignaciones[1])[0]
        .cantidad,
      "0.5",
    );
  },
);

prueba(
  "rechaza otra unidad, producto, duplicados, saldos desconocidos y cambios durante la revision",
  () => {
    const datos = base();
    for (const otro of [
      { ...lote(2, "5"), unidad: 2 },
      { ...lote(2, "5"), producto: 4 },
      { ...lote(2, "5"), es_kg: false },
    ])
      afirmar.throws(() => aplicar(datos, [otro]), codigo("incompatible"));
    afirmar.throws(
      () => aplicar(datos, [datos.origen]),
      codigo("seleccionado"),
    );
    afirmar.throws(
      () => aplicar(datos, [lote(2, "1"), lote(2, "5")]),
      codigo("seleccionado"),
    );
    afirmar.throws(
      () => aplicar(datos, [{ ...lote(2), saldo: undefined }]),
      codigo("datos"),
    );
    afirmar.throws(() => aplicar(datos, [lote(2, "0")]), codigo("sin_saldo"));
    const huella = distribucion.huellaDistribucionLotes(
      datos.documento,
      datos.asignacion,
      contexto,
      1,
    );
    datos.documento.lineas[0].merma = "1";
    afirmar.throws(
      () => aplicar(datos, [lote(2, "6")], huella),
      codigo("cambio"),
    );
    datos.documento.lineas[0].merma = "incorrecto";
    afirmar.throws(() => aplicar(datos, [lote(2, "6")]), codigo("datos"));
  },
);

prueba(
  "retira el origen agotado sin dejar una linea inutil y respeta los limites del documento",
  () => {
    const datos = base();
    datos.origen.saldo = "0";
    for (let indice = 10; indice < 509; indice++)
      datos.documento.lineas.push({
        lote: lote(indice),
        merma: "",
        aprovechable: "",
        motivo: "",
      });
    const nuevo = aplicar(datos, [lote(2, "7")]);
    afirmar.equal(nuevo.lineas.length, 500);
    afirmar.equal(nuevo.asignaciones[1].aportes[1], undefined);
    afirmar.equal(nuevo.asignaciones[1].aportes[2].cantidad, "7");
    afirmar.ok(!nuevo.lineas.some((fila) => fila.lote.id === 1));
    datos.origen.saldo = "2";
    afirmar.throws(() => aplicar(datos, [lote(2, "7")]), codigo("limite"));
    const muchos = base();
    for (let indice = 10; indice < 29; indice++)
      muchos.asignacion.aportes[indice] = { cantidad: "1", pesoKg: "" };
    afirmar.throws(() => aplicar(muchos, [lote(2, "7")]), codigo("limite"));
  },
);

const nodos = (arbol) =>
  !arbol || typeof arbol !== "object"
    ? []
    : [arbol, ...React.Children.toArray(arbol.props?.children).flatMap(nodos)];
const texto = (arbol) =>
  React.Children.toArray(arbol)
    .map((nodo) =>
      typeof nodo === "string" || typeof nodo === "number"
        ? String(nodo)
        : texto(nodo?.props?.children),
    )
    .join(" ");
function prepararVista(idioma = "es") {
  const estados = [];
  let cursor = 0,
    arbol;
  const mensajes = JSON.parse(
    leerArchivo(
      new URL(`../src/messages/${idioma}.json`, import.meta.url),
      "utf8",
    ),
  );
  const cargar = crearCargadorChofer({
    react: {
      ...React,
      useCallback: (funcion) => funcion,
      useState: (inicial) => {
        const indice = cursor++;
        if (!(indice in estados))
          estados[indice] = typeof inicial === "function" ? inicial() : inicial;
        return [
          estados[indice],
          (valor) =>
            (estados[indice] =
              typeof valor === "function" ? valor(estados[indice]) : valor),
        ];
      },
    },
    "react/jsx-runtime": jsx,
    "lucide-react": iconos,
    "next-intl": {
      useTranslations: (namespace) =>
        crearTraductor({ locale: idioma, messages: mensajes, namespace }),
      useLocale: () => idioma,
    },
    "@/components/ui/modal": { Modal: "Modal" },
    "@/components/ui/button/Button": { default: "Boton" },
    "@/components/compras/DesplegableCompra": { default: "Selector" },
    "@/components/clientes/CampoDirectorio": { default: "Campo" },
    "./estilosTrabajo.module.css": { default: {} },
  });
  const datos = base(),
    aplicados = [];
  const propiedades = {
    ...datos,
    contexto,
    almacen: 1,
    ocupado: false,
    alError() {},
    alAplicar: (documento) => aplicados.push(documento),
  };
  const Componente = cargar(
    "components/preparaciones/CompletarLotesPreparacion",
  ).default;
  const representar = () => {
    cursor = 0;
    arbol = Componente(propiedades);
    return arbol;
  };
  representar();
  return {
    datos,
    propiedades,
    aplicados,
    cargar,
    representar,
    nodos: () => nodos(arbol),
    textos: () => texto(arbol),
    boton: (etiqueta) =>
      nodos(arbol).find(
        (nodo) =>
          nodo.type === "Boton" && texto(nodo.props.children) === etiqueta,
      ),
    selector: () => nodos(arbol).find((nodo) => nodo.type === "Selector"),
  };
}

prueba(
  "la revision permite cancelar sin cambios y solo aplica dos mas cinco tras confirmar",
  () => {
    const entorno = prepararVista();
    const copia = JSON.stringify(entorno.datos.documento);
    entorno.boton("Completar con otro lote").props.onClick();
    entorno.representar();
    afirmar.ok(entorno.boton("Aplicar reparto").props.disabled);
    afirmar.match(entorno.textos(), /Faltan 5 kg/);
    afirmar.match(entorno.selector().props.ruta, /unidad=1/);
    entorno.selector().props.alElegir(lote(2, "5"));
    entorno.representar();
    afirmar.equal(JSON.stringify(entorno.datos.documento), copia);
    afirmar.equal(entorno.boton("Aplicar reparto").props.disabled, false);
    entorno.boton("Cancelar").props.onClick();
    entorno.representar();
    afirmar.equal(entorno.aplicados.length, 0);
    afirmar.equal(JSON.stringify(entorno.datos.documento), copia);
    entorno.boton("Completar con otro lote").props.onClick();
    entorno.representar();
    entorno.selector().props.alElegir(lote(2, "5"));
    entorno.representar();
    entorno.boton("Aplicar reparto").props.onClick();
    afirmar.equal(entorno.aplicados.length, 1);
    afirmar.equal(
      entorno.aplicados[0].asignaciones[1].aportes[1].cantidad,
      "2",
    );
    afirmar.equal(
      entorno.aplicados[0].asignaciones[1].aportes[2].cantidad,
      "5",
    );
  },
);

prueba(
  "con un segundo lote insuficiente informa el restante y exige otro para habilitar aplicar",
  () => {
    const entorno = prepararVista();
    entorno.boton("Completar con otro lote").props.onClick();
    entorno.representar();
    entorno.selector().props.alElegir(lote(2, "3"));
    entorno.representar();
    afirmar.match(entorno.textos(), /Faltan 2 kg/);
    afirmar.ok(entorno.boton("Aplicar reparto").props.disabled);
    afirmar.deepEqual(
      Array.from(entorno.selector().props.datosConsulta.excluir),
      [1, 2],
    );
    entorno.selector().props.alElegir(lote(3, "2"));
    entorno.representar();
    afirmar.match(entorno.textos(), /Reparto completo: 7 kg/);
    afirmar.equal(entorno.boton("Aplicar reparto").props.disabled, false);
    entorno
      .nodos()
      .find(
        (nodo) =>
          nodo.type === "button" &&
          nodo.props["aria-label"] === "Quitar L041126-2 del reparto",
      )
      .props.onClick();
    entorno.representar();
    afirmar.match(entorno.textos(), /Faltan 3 kg/);
    afirmar.ok(entorno.boton("Aplicar reparto").props.disabled);
  },
);

prueba(
  "un cambio de cantidades invalida la propuesta y guardar bloquea su aplicacion",
  () => {
    const entorno = prepararVista();
    entorno.boton("Completar con otro lote").props.onClick();
    entorno.representar();
    entorno.selector().props.alElegir(lote(2, "5"));
    entorno.representar();
    entorno.propiedades.asignacion.aportes[1].cantidad = "6";
    entorno.representar();
    afirmar.match(entorno.textos(), /Los datos cambiaron/);
    afirmar.ok(entorno.boton("Aplicar reparto").props.disabled);
    entorno.boton("Aplicar reparto").props.onClick();
    afirmar.equal(entorno.aplicados.length, 0);
    entorno.boton("Volver a revisar").props.onClick();
    entorno.representar();
    entorno.selector().props.alElegir(lote(2, "5"));
    entorno.representar();
    afirmar.match(entorno.textos(), /Reparto completo: 6 kg/);
    entorno.propiedades.ocupado = true;
    entorno.representar();
    afirmar.ok(entorno.boton("Aplicar reparto").props.disabled);
    entorno.boton("Aplicar reparto").props.onClick();
    afirmar.equal(entorno.aplicados.length, 0);
  },
);

prueba(
  "el aporte muestra una advertencia clara y conserva el total de kg por medida",
  () => {
    for (const idioma of ["es", "en"]) {
      const entorno = prepararVista(idioma);
      const Aportes = entorno.cargar(
        "components/preparaciones/AportesSucursalPreparacion",
      ).default;
      const arbol = Aportes({
        ...entorno.propiedades,
        prefijo: "asignaciones_0",
        errores: {},
        alCambiar() {},
        alElegirLote() {},
        alCambiarDocumento() {},
      });
      afirmar.match(
        texto(arbol),
        idioma === "es" ? /Este lote no alcanza/ : /This lot is insufficient/,
      );
      afirmar.doesNotMatch(texto(arbol), /-5/);
      afirmar.ok(
        nodos(arbol).some(
          (nodo) =>
            nodo.type ===
            entorno.cargar("components/preparaciones/CompletarLotesPreparacion")
              .default,
        ),
      );
    }
    const datos = base(),
      nuevo = aplicar(datos, [lote(2, "5")]);
    afirmar.equal(
      distribucion.totalesKgAsignacion(nuevo, nuevo.asignaciones[1])[0]
        .cantidad,
      "7",
    );
  },
);

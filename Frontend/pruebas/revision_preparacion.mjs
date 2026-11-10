import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargarPuro = crearCargadorChofer();
const revision = cargarPuro(
  "components/preparaciones/revisionPorSucursalPreparacion",
);
const lote = (id, opciones = {}) => ({
  id,
  nombre: `L041126-0${id}`,
  producto: 3,
  producto_nombre: "Papaya",
  unidad: 1,
  unidad_nombre: "Kilogramo",
  unidad_abreviatura: "kg",
  es_kg: true,
  ...opciones,
});
const asignacion = (clave, opciones = {}) => ({
  clave: String(clave),
  detalle: clave,
  pedido: clave,
  codigo: `PED-0000${clave}`,
  sucursal: 5,
  sucursalNombre: "Miraflores",
  producto: 3,
  productoNombre: "Papaya",
  presentacion: "Caja",
  columna: "cajas",
  cantidad: "1",
  disponible: true,
  aportes: { 1: { cantidad: "2", pesoKg: "" } },
  ...opciones,
});
const linea = (fuente, opciones = {}) => ({
  lote: fuente,
  merma: "",
  aprovechable: "",
  motivo: "",
  ...opciones,
});
const cajilla = (clave, opciones = {}) => ({
  clave: String(clave),
  producto: { id: 3, nombre: "Papaya" },
  sucursal: { id: 5, nombre: "Miraflores" },
  color: { id: 2, nombre: "Azul" },
  cantidad: "1",
  ...opciones,
});
const documento = () => ({
  lineas: [linea(lote(1)), linea(lote(2))],
  asignaciones: {
    1: asignacion(1),
    2: asignacion(2, { aportes: { 2: { cantidad: "5", pesoKg: "" } } }),
  },
  cajillas: [cajilla(1)],
});

prueba(
  "la revisión reúne pedidos por producto y sucursal sin duplicar cajillas ni sumar CANT con UNI",
  () => {
    const datos = documento();
    datos.asignaciones[2].columna = "unidades";
    datos.asignaciones[2].presentacion = "Unidad";
    datos.asignaciones[2].cantidad = "4";
    datos.lineas[0].merma = "3";
    const original = JSON.stringify(datos);
    const grupos = revision.agruparRevisionPreparacion(datos);
    afirmar.equal(grupos.length, 1);
    afirmar.equal(grupos[0].pedidos.length, 2);
    afirmar.equal(grupos[0].productos.length, 1);
    const producto = grupos[0].productos[0];
    afirmar.equal(producto.cantidades[0].columna, "cajas");
    afirmar.equal(producto.cantidades[0].cantidad, "1");
    afirmar.equal(producto.cantidades[1].columna, "unidades");
    afirmar.equal(producto.cantidades[1].cantidad, "4");
    afirmar.equal(producto.pesoKg, "7"); // No incluye el descarte en la entrega.
    afirmar.equal(producto.cajillas.length, 1);
    afirmar.equal(producto.asignaciones[1].aportes[2].cantidad, "5");
    afirmar.equal(revision.totalCajillasRevision(datos), 1);
    afirmar.equal(JSON.stringify(datos), original);
  },
);

prueba(
  "las presentaciones distintas conservan sus cantidades y las mediciones suman decimales exactos",
  () => {
    const datos = documento();
    datos.asignaciones[1].aportes[1].cantidad = "0.1";
    datos.asignaciones[2].aportes[2].cantidad = "0.2";
    datos.asignaciones[2].presentacion = "Caja pequeña";
    let producto = revision.agruparRevisionPreparacion(datos)[0].productos[0];
    afirmar.equal(producto.cantidades.length, 2);
    afirmar.equal(producto.pesoKg, "0.3");
    datos.asignaciones[2].presentacion = "Caja";
    producto = revision.agruparRevisionPreparacion(datos)[0].productos[0];
    afirmar.equal(producto.cantidades.length, 1);
    afirmar.equal(producto.cantidades[0].cantidad, "2");
    afirmar.equal(producto.asignaciones.length, 2);
  },
);

prueba(
  "el peso usa la medición física de unidades y no presenta un total si falta algún aporte",
  () => {
    const datos = documento();
    datos.lineas[1].lote = lote(2, {
      es_kg: false,
      unidad: 2,
      unidad_nombre: "Unidad",
      unidad_abreviatura: "u",
    });
    datos.asignaciones[2].aportes[2] = { cantidad: "100", pesoKg: "1.125" };
    const peso = () =>
      revision.agruparRevisionPreparacion(datos)[0].productos[0].pesoKg;
    afirmar.equal(peso(), "3.125");
    for (const valor of ["", "0", "no medido"]) {
      datos.asignaciones[2].aportes[2].pesoKg = valor;
      afirmar.equal(peso(), null);
    }
    datos.asignaciones[2].aportes[2].pesoKg = "1.125";
    datos.lineas.pop();
    afirmar.equal(peso(), null);
    datos.asignaciones[2].aportes = {};
    afirmar.equal(peso(), null);
  },
);

prueba(
  "las previsiones históricas y sin pedidos mantienen su destino sin inventar producto ni reparto",
  () => {
    const datos = documento();
    datos.cajillas.push(
      cajilla(2, {
        producto: null,
        cantidad: "2",
        sucursal: { id: 7, nombre: "Sopocachi" },
      }),
    );
    datos.cajillas.push(
      cajilla(3, { producto: { id: 8, nombre: "Banana" }, cantidad: "4" }),
    );
    const grupos = revision.agruparRevisionPreparacion(datos);
    const historica = grupos.find((fila) => fila.id === 7);
    afirmar.equal(historica.productos.length, 0);
    afirmar.equal(historica.pedidos.length, 0);
    afirmar.equal(historica.cajillasHistoricas[0].cantidad, "2");
    const banana = grupos
      .find((fila) => fila.id === 5)
      .productos.find((fila) => fila.id === 8);
    afirmar.equal(banana.asignaciones.length, 0);
    afirmar.equal(banana.cantidades.length, 0);
    afirmar.equal(banana.pesoKg, null);
    afirmar.equal(banana.cajillas[0].cantidad, "4");
    afirmar.equal(revision.totalCajillasRevision(datos), 7);
  },
);

prueba(
  "el formato de revisión conserva mediciones grandes sin redondearlas y adapta los separadores",
  () => {
    afirmar.equal(
      revision.numeroRevisionPreparacion("99999999999999.123", "en"),
      "99,999,999,999,999.123",
    );
    afirmar.equal(
      revision.numeroRevisionPreparacion("12345.120", "es"),
      "12.345,12",
    );
    afirmar.equal(revision.numeroRevisionPreparacion("7.000", "es"), "7");
    afirmar.equal(
      revision.numeroRevisionPreparacion("sin medir", "es"),
      "sin medir",
    );
  },
);

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const traducir = crearTraductor({
  locale: "es",
  messages: mensajes,
  namespace: "preparaciones",
});
const cargarVista = crearCargadorChofer({
  react: React,
  "react/jsx-runtime": jsx,
  "lucide-react": iconos,
  "next-intl": { useLocale: () => "es", useTranslations: () => traducir },
  "./estilosTrabajo.module.css": { default: {} },
  "@/components/productos/ImagenProducto": { default: () => null },
  "@/components/compras/PaginadorCompras": {
    default: ({ total }) =>
      React.createElement("nav", { "data-total": total }, "Paginación"),
  },
});
const Vista = cargarVista(
  "components/preparaciones/RevisionPreparacion",
).default;

prueba(
  "la vista agrupa antes de paginar diez sucursales y conserva el conteo completo",
  () => {
    const datos = documento();
    datos.asignaciones = Object.fromEntries(
      Array.from({ length: 11 }, (_, indice) => {
        const id = indice + 1;
        return [
          id,
          asignacion(id, {
            sucursal: id,
            sucursalNombre: `Sucursal ${String(id).padStart(2, "0")}`,
          }),
        ];
      }),
    );
    datos.cajillas = [];
    const html = representar(React.createElement(Vista, { documento: datos }));
    afirmar.equal((html.match(/Sucursal \d{2}<\/h3>/g) || []).length, 10);
    afirmar.match(html, /11 sucursales/);
    afirmar.match(html, /data-total="11"/);
    afirmar.doesNotMatch(html, /Sucursal 11/);
  },
);

prueba(
  "la revisión muestra una sola previsión por producto entre pedidos y conserva la trazabilidad",
  () => {
    const datos = documento();
    const original = JSON.stringify(datos);
    const html = representar(
      React.createElement(Vista, { documento: datos, mostrarResumen: false }),
    );
    afirmar.equal((html.match(/1 cajilla/g) || []).length, 1);
    afirmar.match(html, /PED-00001/);
    afirmar.match(html, /PED-00002/);
    afirmar.match(html, /L041126-01/);
    afirmar.match(html, /L041126-02/);
    afirmar.match(html, /7 kg/);
    afirmar.doesNotMatch(html, /Paginación/);
    afirmar.equal(JSON.stringify(datos), original);
  },
);

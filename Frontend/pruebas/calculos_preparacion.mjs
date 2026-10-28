import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { join as unirRuta, dirname as nombreCarpeta } from "node:path";
import { fileURLToPath as rutaDesdeUrl } from "node:url";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const directorio = nombreCarpeta(rutaDesdeUrl(import.meta.url));

// Ejecuta las mismas funciones puras de la interfaz, sin React ni dependencias nuevas.
function cargarModulo(nombre, dependencias = {}) {
  const fuente = leerArchivo(
    unirRuta(directorio, "../src/components/preparaciones", `${nombre}.ts`),
    "utf8",
  );
  const resultado = compilador.transpileModule(fuente, {
    compilerOptions: {
      module: compilador.ModuleKind.CommonJS,
      target: compilador.ScriptTarget.ES2020,
    },
  });
  const exportaciones = {};
  ejecutarContexto(resultado.outputText, {
    exports: exportaciones,
    require: (ruta) => {
      if (ruta in dependencias) return dependencias[ruta];
      throw new Error(`Dependencia inesperada: ${ruta}`);
    },
  });
  return exportaciones;
}

const calculos = cargarModulo("calculos");
const { validarDocumento, validarConfirmacionPreparacion } = cargarModulo("validaciones", {
  "./calculos": calculos,
});
const mensajes = {
  cantidad: "Cantidad inválida",
  entero: "Cantidad entera inválida",
  origen: "Línea retirada",
  motivo: "Falta motivo",
  superaPendiente: (cantidad) => `Quedan ${cantidad}`,
};

function documentoBase() {
  return {
    lineas: [
      { lote: { id: 1, es_kg: true }, merma: "0", aprovechable: "0", motivo: "" },
      { lote: { id: 2, es_kg: true }, merma: "0", aprovechable: "0", motivo: "" },
    ],
    asignaciones: {
      9: { detalle: 9, cantidad: "1", pendiente: 2, aportes: {} },
    },
    cajillas: [],
  };
}

prueba("las cantidades medidas se suman exactamente a tres decimales", () => {
  afirmar.equal(calculos.deMiles(calculos.aMiles("0.1") + calculos.aMiles("0.2")), "0.300");
  afirmar.equal(calculos.deMiles(calculos.aMiles("99999999999.999")), "99999999999.999");
});

prueba("una caja atendida desde dos lotes se cuenta una vez", () => {
  const documento = documentoBase();
  documento.asignaciones[9].aportes = {
    1: { cantidad: "4.125", pesoKg: "" },
    2: { cantidad: "5.875", pesoKg: "" },
  };
  documento.lineas[0].merma = "0.250";
  documento.lineas[0].aprovechable = "0.125";
  documento.lineas[0].motivo = "Separación por calidad";
  const carga = calculos.serializarDocumento(documento);
  afirmar.equal(carga.asignaciones[0].cantidad, 1);
  afirmar.equal(carga.asignaciones[0].aportes.length, 2);
  afirmar.equal(carga.lineas[0].cantidad_utilizada, "4.500");
  afirmar.equal(carga.lineas[1].cantidad_utilizada, "5.875");
});

prueba("borrar una medición en kg descarta el peso guardado oculto", () => {
  const documento = documentoBase();
  documento.asignaciones[9].aportes[1] = { cantidad: "", pesoKg: "3.000" };
  const carga = calculos.serializarDocumento(documento);
  afirmar.equal(carga.asignaciones[0].aportes.length, 0);
  afirmar.equal(carga.lineas[0].cantidad_utilizada, "0.000");
});

prueba("en otras unidades se conserva el peso real separado de la cantidad", () => {
  const documento = documentoBase();
  documento.lineas[0].lote.es_kg = false;
  documento.asignaciones[9].aportes[1] = { cantidad: "2", pesoKg: "0.850" };
  const carga = calculos.serializarDocumento(documento);
  afirmar.equal(carga.asignaciones[0].aportes[0].cantidad, "2");
  afirmar.equal(carga.asignaciones[0].aportes[0].peso_kg, "0.850");
  afirmar.equal(carga.asignaciones[0].cantidad, 1);
});

prueba("la validación detecta un pedido que ya no tiene cantidad suficiente", () => {
  const documento = documentoBase();
  documento.asignaciones[9].cantidad = "3";
  afirmar.equal(validarDocumento(documento, mensajes).asignaciones_0_cantidad[0], "Quedan 2");
});

prueba("se validan también filas fuera de la página visible", () => {
  const documento = documentoBase();
  documento.cajillas = Array.from({ length: 11 }, (_, indice) => ({
    sucursal: { id: indice + 1 }, color: { id: 1 }, cantidad: "1",
  }));
  documento.cajillas[10].cantidad = "1.5";
  afirmar.equal(validarDocumento(documento, mensajes).cajillas_10_cantidad[0], mensajes.entero);
  documento.asignaciones[9].aportes[1] = { cantidad: "1.0001", pesoKg: "" };
  afirmar.equal(validarDocumento(documento, mensajes).asignaciones_0_aportes_0_cantidad[0], mensajes.cantidad);
});

const mensajesConfirmacion = {
  sinAsignaciones: "Anota una sucursal",
  positiva: "Debe ser mayor a cero",
  sinMedicion: "Falta medir",
  peso: "Falta el peso real",
  saldo: "Supera el saldo",
  lote: "Lote de otro producto",
  sinUso: "Lote sin usar",
};

function documentoTrabajo() {
  const documento = documentoBase();
  documento.lineas.forEach((linea, indice) => {
    Object.assign(linea.lote, {
      producto: 3, producto_nombre: "Papaya", saldo: "30.000",
      producto_imagen: "/api/v1/preparaciones/imagenes/3/?cliente=1&fecha_pedidos=2026-10-28",
      producto_categoria: { id: 2, nombre: "Frutas" }, nombre: `L281026-0${indice + 1}`,
    });
  });
  Object.assign(documento.asignaciones[9], {
    clave: "9", producto: 3, productoNombre: "Papaya", columna: "cajas",
  });
  return documento;
}

prueba("la lista de la hoja conserva fotos y categorías sin repetir productos", () => {
  const documento = documentoTrabajo();
  documento.asignaciones[12] = {
    ...documento.asignaciones[9], clave: "12", detalle: 12, producto: 4,
    productoNombre: "Banana", imagen: "/foto-banana", categoria: { id: 2, nombre: "Frutas" },
  };
  const productos = calculos.productosDelDocumento(documento);
  afirmar.equal(productos.length, 2);
  afirmar.equal(productos.map((producto) => producto.nombre).join(","), "Banana,Papaya");
  afirmar.equal(productos[1].imagen, documento.lineas[0].lote.producto_imagen);
  afirmar.equal(productos[1].categoria.nombre, "Frutas");
  afirmar.equal(productos[0].imagen, "/foto-banana");
  const carga = calculos.serializarDocumento(documento);
  afirmar.equal("imagen" in carga.asignaciones[1], false);
  afirmar.equal("producto_imagen" in carga.lineas[0], false);
});

prueba("quitar un lote conserva CANT y UNI y las mediciones de los demás lotes", () => {
  const documento = documentoTrabajo();
  documento.asignaciones[9].aportes = { 1: { cantidad: "10", pesoKg: "" }, 2: { cantidad: "4.5", pesoKg: "" } };
  documento.asignaciones[10] = {
    ...documento.asignaciones[9], clave: "10", detalle: 10, columna: "unidades", cantidad: "2",
    aportes: { 2: { cantidad: "0.75", pesoKg: "" } },
  };
  const original = JSON.stringify(documento);
  const cambiado = calculos.quitarLoteDocumento(documento, 1);
  afirmar.equal(JSON.stringify(documento), original);
  afirmar.equal(cambiado.lineas.length, 1);
  afirmar.equal(cambiado.asignaciones[9].cantidad, "1");
  afirmar.equal(cambiado.asignaciones[10].cantidad, "2");
  afirmar.equal(cambiado.asignaciones[9].aportes[1], undefined);
  afirmar.equal(cambiado.asignaciones[9].aportes[2].cantidad, "4.5");
  afirmar.equal(cambiado.asignaciones[10].aportes[2].cantidad, "0.75");
});

prueba("un borrador permite mediciones incompletas y la revisión exige completarlas", () => {
  const documento = documentoTrabajo();
  afirmar.equal(Object.keys(validarDocumento(documento, mensajes)).length, 0);
  let errores = validarConfirmacionPreparacion(documento, mensajesConfirmacion);
  afirmar.equal(errores.asignaciones_0_aportes[0], mensajesConfirmacion.sinMedicion);
  afirmar.equal(errores.lineas_0_cantidad_utilizada[0], mensajesConfirmacion.sinUso);
  documento.asignaciones[9].cantidad = "0";
  errores = validarConfirmacionPreparacion(documento, mensajesConfirmacion);
  afirmar.equal(errores.asignaciones_0_cantidad[0], mensajesConfirmacion.positiva);
});

prueba("el saldo incluye lo repartido, lo descartado y lo separado sin redondeos", () => {
  const documento = documentoTrabajo();
  documento.lineas = documento.lineas.slice(0, 1);
  documento.lineas[0].lote.saldo = "10.000";
  documento.asignaciones[9].aportes[1] = { cantidad: "9.750", pesoKg: "" };
  documento.lineas[0].merma = "0.125";
  documento.lineas[0].aprovechable = "0.125";
  documento.lineas[0].motivo = "Revisión de calidad";
  afirmar.equal(Object.keys(validarConfirmacionPreparacion(documento, mensajesConfirmacion)).length, 0);
  documento.lineas[0].aprovechable = "0.126";
  afirmar.equal(validarConfirmacionPreparacion(documento, mensajesConfirmacion).lineas_0_cantidad_utilizada[0], mensajesConfirmacion.saldo);
});

prueba("los lotes de otras unidades requieren peso real y deben corresponder al producto", () => {
  const documento = documentoTrabajo();
  documento.lineas = documento.lineas.slice(0, 1);
  documento.lineas[0].lote.es_kg = false;
  documento.asignaciones[9].aportes[1] = { cantidad: "2", pesoKg: "" };
  afirmar.equal(validarConfirmacionPreparacion(documento, mensajesConfirmacion).asignaciones_0_aportes_0_peso_kg[0], mensajesConfirmacion.peso);
  documento.asignaciones[9].aportes[1].pesoKg = "10.5";
  afirmar.equal(Object.keys(validarConfirmacionPreparacion(documento, mensajesConfirmacion)).length, 0);
  documento.lineas[0].lote.producto = 4;
  afirmar.equal(validarConfirmacionPreparacion(documento, mensajesConfirmacion).asignaciones_0_aportes_0_lote[0], mensajesConfirmacion.lote);
});

prueba("la revisión detecta cantidades sin medir fuera de la página y del producto visibles", () => {
  const documento = documentoTrabajo();
  documento.lineas = documento.lineas.slice(0, 1);
  documento.asignaciones = Object.fromEntries(Array.from({ length: 12 }, (_, indice) => [indice + 20, {
    ...documento.asignaciones[9], clave: String(indice + 20), detalle: indice + 20,
    aportes: { 1: { cantidad: "1", pesoKg: "" } },
  }]));
  documento.asignaciones[31].aportes = {};
  documento.asignaciones[31].producto = 5;
  afirmar.equal(validarConfirmacionPreparacion(documento, mensajesConfirmacion).asignaciones_11_aportes[0], mensajesConfirmacion.sinMedicion);
});

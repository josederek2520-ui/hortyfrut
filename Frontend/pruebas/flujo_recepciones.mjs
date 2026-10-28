import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { dirname as nombreCarpeta, join as unirRuta } from "node:path";
import { fileURLToPath as rutaDesdeUrl } from "node:url";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const directorio = nombreCarpeta(rutaDesdeUrl(import.meta.url));
function cargar(nombre, dependencias = {}) {
  const fuente = leerArchivo(
    unirRuta(directorio, "../src/components/recepciones", `${nombre}.ts`),
    "utf8",
  );
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(fuente, {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2020,
      },
    }).outputText,
    {
      exports: exportaciones,
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        throw new Error(`Dependencia inesperada: ${ruta}`);
      },
    },
  );
  return exportaciones;
}
const calculos = cargar("calculos");
const { validarLineasRecepcion } = cargar("validaciones", {
  "./calculos": calculos,
});
const mensajes = {
  cantidad: "cantidad",
  positiva: "positiva",
  peso: "peso",
  vencimiento: "vencimiento",
  pendiente: "pendiente",
  mismaUnidad: "mismaUnidad",
  sinLineas: "sinLineas",
  limite: "limite",
};
const opcion = (id = 1) => ({
  id,
  producto: 10,
  nombre: "Banana",
  unidad: { id: 2, nombre: "Kilogramo", abreviatura: "kg", es_kg: true },
  disponible: true,
  medida_compra: "Caja",
  unidad_compra: null,
  cantidad_pendiente: "10.000",
  proveedor_nombre: `Proveedor ${id}`,
});
const linea = (id = 1) => ({
  ...calculos.lineaDesdeOpcion(opcion(id)),
  cantidadCompra: "8",
  cantidadInventario: "120",
});
const validar = (lineas, confirmar = true, vinculada = true) =>
  validarLineasRecepcion(lineas, vinculada, confirmar, "2026-10-27", mensajes);

prueba(
  "cargar pendientes no rellena cantidades ni mezcla proveedores del mismo producto",
  () => {
    const primera = calculos.lineaDesdeOpcion(opcion());
    const segunda = calculos.lineaDesdeOpcion(opcion(2));
    afirmar.equal(primera.cantidadCompra, "");
    afirmar.equal(primera.cantidadInventario, "");
    afirmar.equal(primera.producto.id, segunda.producto.id);
    afirmar.notEqual(primera.clave, segunda.clave);
    afirmar.notEqual(primera.proveedorNombre, segunda.proveedorNombre);
  },
);
prueba(
  "las cajas contadas y los kilos pesados se mantienen independientes",
  () => {
    const nueva = calculos.actualizarMedicion(linea(), { cantidadCompra: "7" });
    afirmar.equal(nueva.cantidadInventario, "120");
    const pesada = calculos.actualizarMedicion(nueva, {
      cantidadInventario: "113,250",
    });
    afirmar.equal(pesada.cantidadCompra, "7");
    const carga = calculos.serializarLineasRecepcion([pesada], true)[0];
    afirmar.equal(carga.cantidad_compra, "7");
    afirmar.equal(carga.cantidad_inventario, "113.250");
    afirmar.equal(Object.keys(validar([pesada])).length, 0);
  },
);
prueba("solo una unidad base idéntica comparte el campo de cantidad", () => {
  const base = { ...linea(), unidadCompra: 2, medidaCompra: "Kilogramo" };
  const nueva = calculos.actualizarMedicion(base, {
    cantidadInventario: "6,125",
  });
  afirmar.equal(nueva.cantidadCompra, "6,125");
  afirmar.equal(Object.keys(validar([nueva])).length, 0);
  afirmar.equal(calculos.mismaUnidadRecepcion(linea()), false);
  afirmar.equal(
    calculos.mismaUnidadRecepcion({
      ...base,
      unidad: { ...base.unidad, id: 3 },
    }),
    false,
  );
  afirmar.equal(
    validar([{ ...base, cantidadCompra: "3", cantidadInventario: "4" }])
      .detalle_0_cantidad_inventario[0],
    "mismaUnidad",
  );
});
prueba(
  "cambiar de unidad borra la medición y el peso anteriores sin convertir cantidades",
  () => {
    const nueva = calculos.actualizarMedicion(
      { ...linea(), pesoKg: "120" },
      { unidad: { id: 3, nombre: "Unidad", abreviatura: "uni", es_kg: false } },
    );
    afirmar.equal(nueva.cantidadCompra, "8");
    afirmar.equal(nueva.cantidadInventario, "");
    afirmar.equal(nueva.pesoKg, "");
    afirmar.equal(
      validar([nueva]).detalle_0_cantidad_inventario[0],
      "positiva",
    );
  },
);
prueba(
  "filas vacías y cambios de unidad sin cantidades no se envían como productos recibidos",
  () => {
    const vacia = calculos.lineaDesdeOpcion(opcion());
    const borrada = { ...vacia, id: 9, unidad: { ...vacia.unidad, id: 3 } };
    const seleccion = calculos.seleccionarLineasRecepcion([
      vacia,
      borrada,
      linea(3),
    ]);
    afirmar.equal(seleccion.lineas.length, 1);
    afirmar.equal(seleccion.indices[0], 2);
    afirmar.equal(
      calculos.serializarLineasRecepcion(seleccion.lineas, true).length,
      1,
    );
  },
);
prueba(
  "los errores vuelven a la fila correcta aunque se omitan filas vacías",
  () => {
    const errores = calculos.erroresEnHojaRecepcion(
      { detalle_0_cantidad_compra: ["pendiente"], almacen: ["requerido"] },
      [12],
    );
    afirmar.equal(errores.detalle_12_cantidad_compra[0], "pendiente");
    afirmar.equal(errores.almacen[0], "requerido");
  },
);
prueba(
  "la revisión valida también filas de páginas posteriores y el pendiente exacto",
  () => {
    const lineas = Array.from({ length: 11 }, (_, indice) => linea(indice + 1));
    lineas[10].cantidadCompra = "10.001";
    afirmar.equal(validar(lineas).detalle_10_cantidad_compra[0], "pendiente");
    lineas[10].cantidadCompra = "9.1234";
    afirmar.equal(validar(lineas).detalle_10_cantidad_compra[0], "cantidad");
    afirmar.equal(
      calculos.aMilesRecepcion("0,1") + calculos.aMilesRecepcion("0.2"),
      300n,
    );
  },
);
prueba(
  "el borrador admite cantidades incompletas y confirmar exige cantidades positivas",
  () => {
    const incompleta = { ...linea(), cantidadInventario: "" };
    afirmar.equal(Object.keys(validar([incompleta], false)).length, 0);
    afirmar.equal(
      validar([incompleta]).detalle_0_cantidad_inventario[0],
      "positiva",
    );
    afirmar.equal(validar([]).detalles[0], "sinLineas");
  },
);
prueba(
  "el ingreso sin compra no contabiliza cantidades de compra ni duplica pesos en kg",
  () => {
    const directa = {
      ...linea(),
      detalleCompra: null,
      cantidadCompra: "",
      pesoKg: "999",
    };
    const carga = calculos.serializarLineasRecepcion([directa], false)[0];
    afirmar.equal(carga.cantidad_compra, "0");
    afirmar.equal(carga.detalle_compra, null);
    afirmar.equal(carga.peso_kg, null);
    afirmar.equal(Object.keys(validar([directa], true, false)).length, 0);
  },
);
prueba(
  "peso adicional y vencimiento se validan aun cuando están en Más datos",
  () => {
    const adicional = {
      ...linea(),
      unidad: { id: 3, nombre: "Unidad", abreviatura: "uni", es_kg: false },
      pesoKg: "0",
      vencimiento: "2026-10-26",
    };
    const errores = validar([adicional], false);
    afirmar.equal(errores.detalle_0_peso_kg[0], "peso");
    afirmar.equal(errores.detalle_0_fecha_vencimiento[0], "vencimiento");
  },
);

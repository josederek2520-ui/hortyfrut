import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { dirname as nombreCarpeta, join as unirRuta } from "node:path";
import { fileURLToPath as rutaDesdeUrl } from "node:url";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const directorio = nombreCarpeta(rutaDesdeUrl(import.meta.url));
function cargarModulo(nombre, dependencias = {}) {
  const fuente = leerArchivo(
    unirRuta(directorio, "../src/components/compras", `${nombre}.ts`),
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
const moneda = cargarModulo("../../lib/moneda");
const calculos = cargarModulo("calculos", { "@/lib/moneda": moneda });
const { validarLineasCompra } = cargarModulo("validaciones", {
  "./calculos": calculos,
});
const mensajes = {
  cantidad: "cantidad",
  precio: "precio",
  proveedor: "proveedor",
  cantidadPositiva: "cantidadPositiva",
  precioPositivo: "precioPositivo",
  sinLineas: "sinLineas",
  duplicada: "duplicada",
  importe: "importe",
  totalPositivo: "totalPositivo",
};
const lineaBase = (producto = 1, proveedor = 1) => ({
  clave: `linea-${producto}`,
  producto: { id: producto, nombre: "Papaya" },
  presentacion: null,
  proveedor: proveedor ? { id: proveedor, nombre: "Proveedor" } : null,
  cantidad: "1",
  precioUnitario: "2.50",
});
const validar = (lineas, registrar = true) =>
  validarLineasCompra(lineas, registrar, mensajes);

prueba(
  "el borrador admite líneas incompletas y el registro exige proveedor e importes positivos",
  () => {
    const linea = { ...lineaBase(1, null), cantidad: "", precioUnitario: "0" };
    afirmar.equal(Object.keys(validar([linea], false)).length, 0);
    const errores = validar([linea]);
    afirmar.equal(errores.detalle_0_proveedor[0], "proveedor");
    afirmar.equal(errores.detalle_0_cantidad[0], "cantidadPositiva");
    afirmar.equal(errores.detalle_0_precio_unitario[0], "precioPositivo");
    afirmar.equal(validar([]).detalles[0], "sinLineas");
  },
);
prueba("se valida una línea fuera de la primera página", () => {
  const lineas = Array.from({ length: 11 }, (_, indice) =>
    lineaBase(indice + 1),
  );
  lineas[10].cantidad = "2.1234";
  lineas[10].precioUnitario = "-3";
  const errores = validar(lineas);
  afirmar.equal(errores.detalle_10_cantidad[0], "cantidad");
  afirmar.equal(errores.detalle_10_precio_unitario[0], "precio");
});
prueba(
  "un producto puede comprarse a distintos proveedores o en distintas presentaciones",
  () => {
    const otraPresentacion = {
      ...lineaBase(),
      presentacion: { id: 4, nombre: "Caja" },
    };
    afirmar.equal(
      Object.keys(validar([lineaBase(), lineaBase(1, 2), otraPresentacion]))
        .length,
      0,
    );
  },
);
prueba(
  "una combinación repetida se rechaza también al guardar borrador",
  () => {
    for (const registrar of [true, false]) {
      afirmar.equal(
        validar([lineaBase(), lineaBase()], registrar).detalle_1_proveedor[0],
        "duplicada",
      );
    }
    afirmar.equal(
      Object.keys(validar([lineaBase(1, null), lineaBase(1, null)], false))
        .length,
      0,
    );
  },
);
prueba(
  "coma decimal y redondeo por línea coinciden con el total exacto",
  () => {
    const lineas = [
      { ...lineaBase(), cantidad: "0,005", precioUnitario: "1,00" },
      { ...lineaBase(2), cantidad: "0.005", precioUnitario: "1.00" },
    ];
    afirmar.equal(Object.keys(validar(lineas)).length, 0);
    afirmar.equal(calculos.totalCentavos(lineas), 2n);
  },
);
prueba(
  "el registro no permite un total redondeado a cero ni un total fuera del límite",
  () => {
    afirmar.equal(
      validar([{ ...lineaBase(), cantidad: "0.001", precioUnitario: "0.01" }])
        .detalles[0],
      "totalPositivo",
    );
    const linea = {
      ...lineaBase(),
      cantidad: "100",
      precioUnitario: "9999999999.99",
    };
    afirmar.equal(
      validar([linea, { ...linea, producto: { id: 2 } }]).detalles[0],
      "importe",
    );
  },
);
prueba(
  "los límites de cada campo se comprueban incluso cuando el subtotal sería cero",
  () => {
    const errores = validar(
      [{ ...lineaBase(), cantidad: "1000000000", precioUnitario: "0" }],
      false,
    );
    afirmar.equal(errores.detalle_0_cantidad[0], "cantidad");
    afirmar.equal(
      validar([{ ...lineaBase(), precioUnitario: "10000000000" }], false)
        .detalle_0_precio_unitario[0],
      "precio",
    );
  },
);

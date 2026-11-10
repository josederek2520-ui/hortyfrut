import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const fuente = leerArchivo(
  new URL(
    "../src/components/compras/seleccionProductosCompra.ts",
    import.meta.url,
  ),
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
  { exports: exportaciones, URLSearchParams },
);
const {
  productosSeleccionadosCompra,
  consultaProductosCompra,
  incorporarProductoCompra,
  agregarOtroProveedorCompra,
  consultaReferenciasPedidosCompra,
} = exportaciones;
const datos = {
  producto: { id: 3, nombre: "Banana", cajas: 20, unidades: 5 },
  cantidad: "",
  importeTotal: "",
  proveedor: null,
  presentacion: null,
};

prueba(
  "la referencia consulta la fecha elegida y solo los productos de la página, sin multiplicar proveedores",
  () => {
    const lineas = Array.from({ length: 12 }, (_, indice) => ({
      producto: { id: indice + 1 },
    }));
    const pagina = lineas.slice(10);
    const consulta = consultaReferenciasPedidosCompra("2026-10-31", [
      ...pagina,
      pagina[0],
    ]);
    const url = new URL(consulta, "https://hortyfru.test/");
    afirmar.equal(url.pathname, "/compras/necesidades/");
    afirmar.equal(url.searchParams.get("productos"), "11,12");
    afirmar.equal(url.searchParams.get("fecha_pedidos"), "2026-10-31");
    afirmar.equal(url.searchParams.has("fecha_compra"), false);
    afirmar.equal(url.searchParams.has("solo_disponibles"), false);
    afirmar.notEqual(
      consultaReferenciasPedidosCompra("2026-11-01", pagina),
      consulta,
    );
    afirmar.equal(consultaReferenciasPedidosCompra("", pagina), null);
    afirmar.equal(consultaReferenciasPedidosCompra("2026-10-31", []), null);
  },
);

prueba(
  "otro proveedor crea una fila independiente y conserva oculta la selección hasta quitar la última",
  () => {
    const origen = {
      ...datos,
      clave: "original",
      id: 50,
      cantidad: "2",
      importeTotal: "30",
      proveedor: { id: 8, nombre: "Mario Mamani" },
      presentacion: { id: 6, nombre: "Caja" },
    };
    const lineas = agregarOtroProveedorCompra(
      [origen],
      "original",
      "otro-proveedor",
    );
    afirmar.equal(lineas.length, 2);
    afirmar.equal(lineas[0], origen);
    afirmar.equal(lineas[1].producto.id, origen.producto.id);
    afirmar.equal(lineas[1].presentacion.id, 6);
    afirmar.equal(lineas[1].clave, "otro-proveedor");
    afirmar.equal("id" in lineas[1], false);
    afirmar.equal(lineas[1].proveedor, null);
    afirmar.equal(lineas[1].cantidad, "");
    afirmar.equal(lineas[1].importeTotal, "");
    afirmar.deepEqual(Array.from(productosSeleccionadosCompra(lineas)), [3]);
    afirmar.deepEqual(
      Array.from(productosSeleccionadosCompra(lineas.slice(1))),
      [3],
    );
    afirmar.deepEqual(
      Array.from(productosSeleccionadosCompra(lineas.slice(2))),
      [],
    );
    const sinOrigen = [origen];
    afirmar.equal(
      agregarOtroProveedorCompra(sinOrigen, "eliminada", "nueva"),
      sinOrigen,
    );
    const limite = Array.from({ length: 500 }, () => origen);
    afirmar.equal(
      agregarOtroProveedorCompra(limite, "original", "nueva"),
      limite,
    );
  },
);

prueba(
  "agregar oculta el producto y quitarlo lo devuelve sin copiar CANT ni UNI",
  () => {
    const lineas = incorporarProductoCompra([], datos, "banana");
    afirmar.deepEqual(Array.from(productosSeleccionadosCompra(lineas)), [3]);
    afirmar.equal(lineas[0].cantidad, "");
    afirmar.equal(lineas[0].importeTotal, "");
    afirmar.equal(lineas[0].presentacion, null);
    afirmar.deepEqual(
      Array.from(
        productosSeleccionadosCompra(
          lineas.filter((linea) => linea.clave !== "banana"),
        ),
      ),
      [],
    );
    const manual = {
      ...datos,
      cantidad: "7.5",
      importeTotal: "4",
      presentacion: { id: 9, nombre: "Bolsa" },
    };
    const nueva = incorporarProductoCompra([], manual, "manual")[0];
    afirmar.equal(nueva.cantidad, "7.5");
    afirmar.equal(nueva.presentacion.id, 9);
  },
);

prueba(
  "los productos de todas las páginas se ocultan y los duplicados históricos esperan a la última fila",
  () => {
    const lineas = Array.from({ length: 15 }, (_, indice) => ({
      producto: { id: indice + 1 },
    }));
    afirmar.equal(productosSeleccionadosCompra(lineas).length, 15);
    afirmar.ok(productosSeleccionadosCompra(lineas).includes(15));
    const historicas = [{ producto: { id: 3 } }, { producto: { id: 3 } }];
    afirmar.deepEqual(
      Array.from(productosSeleccionadosCompra(historicas.slice(1))),
      [3],
    );
    afirmar.deepEqual(
      Array.from(productosSeleccionadosCompra(historicas.slice(2))),
      [],
    );
    afirmar.equal(
      incorporarProductoCompra(historicas, datos, "repetida"),
      historicas,
    );
    afirmar.equal(incorporarProductoCompra(lineas, datos, "repetida"), lineas);
    const limite = Array.from({ length: 500 }, () => ({
      producto: { id: 99 },
    }));
    afirmar.equal(incorporarProductoCompra(limite, datos, "extra"), limite);
  },
);

prueba(
  "pedidos y catálogo consultan la fecha requerida y excluyen antes de la paginación",
  () => {
    for (const origen of ["pedidos", "catalogo"]) {
      const consulta = consultaProductosCompra({
        origen,
        fecha: "2026-10-31",
        buscar: "Banana",
        pagina: 2,
        categoria: { id: 7 },
        excluidos: [11, 3, 11],
      });
      const url = new URL(consulta, "https://hortyfru.test/");
      afirmar.equal(
        url.pathname,
        origen === "pedidos" ? "/compras/necesidades/" : "/compras/productos/",
      );
      afirmar.equal(url.searchParams.get("fecha_pedidos"), "2026-10-31");
      afirmar.equal(url.searchParams.has("fecha_compra"), false);
      afirmar.equal(url.searchParams.get("pagina"), "2");
      afirmar.equal(url.searchParams.get("categoria"), "7");
      afirmar.equal(url.searchParams.get("excluir_productos"), "3,11");
      afirmar.equal(
        url.searchParams.get("solo_disponibles"),
        origen === "pedidos" ? "true" : null,
      );
    }
  },
);

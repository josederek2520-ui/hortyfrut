import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import compilador from "typescript";

function cargar(nombre, dependencias = {}) {
  const fuente = leerArchivo(
    new URL(`../src/components/preparaciones/${nombre}.ts`, import.meta.url),
    "utf8",
  );
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(fuente, {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports: exportaciones,
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        throw new Error(`Dependencia inesperada: ${ruta}`);
      },
      URLSearchParams,
      AbortController,
      // Las respuestas se controlan por separado; no se espera la demora del buscador.
      setTimeout: (funcion) => setTimeout(funcion, 0),
      clearTimeout,
    },
  );
  return exportaciones;
}
const calculos = cargar("calculos");
const navegacion = cargar("navegacionProductosPreparacion");
const productos = (inicio, cantidad) =>
  Array.from({ length: cantidad }, (_, indice) => ({
    id: inicio + indice,
    nombre: `Producto ${inicio + indice}`,
    cajas: 2,
    unidades: 3,
    pendientes_cajas: 2,
    pendientes_unidades: 3,
  }));

function crearSesion() {
  const almacen = [];
  const peticiones = [];
  const abiertos = [];
  const errores = [];
  let cursor = 0;
  let efectos = [];
  let seleccionado = productos(10, 1)[0];
  const documento = {
    lineas: [
      {
        lote: { id: 7, producto: 1, producto_nombre: "Banana", es_kg: true },
        merma: "",
        aprovechable: "",
        motivo: "",
      },
    ],
    asignaciones: {
      1: {
        producto: 1,
        productoNombre: "Banana",
        cantidad: "2",
        aportes: { 7: { cantidad: "6.25", pesoKg: "" } },
      },
    },
    cajillas: [],
  };
  const react = {
    useState: (inicial) => {
      const indice = cursor++;
      if (!(indice in almacen))
        almacen[indice] = typeof inicial === "function" ? inicial() : inicial;
      return [
        almacen[indice],
        (valor) => {
          almacen[indice] =
            typeof valor === "function" ? valor(almacen[indice]) : valor;
        },
      ];
    },
    useRef: (inicial) => {
      const indice = cursor++;
      return (almacen[indice] ||= { current: inicial });
    },
    useEffect: (efecto, dependencias) => {
      const indice = cursor++;
      const anterior = almacen[indice];
      if (
        !anterior ||
        dependencias.some(
          (valor, posicion) =>
            !Object.is(valor, anterior.dependencias[posicion]),
        )
      ) {
        efectos.push(() => {
          anterior?.limpiar?.();
          almacen[indice] = { dependencias, limpiar: efecto() };
        });
      }
    },
  };
  class ErrorApiPrueba extends Error {}
  const consulta = cargar("useProductosTrabajoPreparacion", {
    react,
    "next-intl": { useLocale: () => "es" },
    "@/lib/api": {
      ApiError: ErrorApiPrueba,
      api: (ruta, opciones) =>
        new Promise((resolver, rechazar) =>
          peticiones.push({ ruta, opciones, resolver, rechazar }),
        ),
    },
    "./calculos": calculos,
    "./navegacionProductosPreparacion": navegacion,
  }).default;
  const abrir = (producto) => {
    seleccionado = producto;
    abiertos.push(producto.id);
  };
  const error = (problema) => errores.push(problema);
  const renderizar = () => {
    cursor = 0;
    efectos = [];
    const modelo = consulta(
      "cliente=1&fecha_pedidos=2026-10-31",
      documento,
      seleccionado,
      abrir,
      error,
    );
    efectos.forEach((efecto) => efecto());
    return modelo;
  };
  const resolver = async (datos) => {
    await esperar(0);
    peticiones.at(-1).resolver(datos);
    await esperar(0);
    return renderizar();
  };
  const cerrar = () => almacen.forEach((valor) => valor?.limpiar?.());
  return {
    renderizar,
    resolver,
    peticiones,
    abiertos,
    errores,
    documento,
    cerrar,
    seleccionado: () => seleccionado,
  };
}

prueba(
  "la navegación respeta los límites de página de 10 y no salta a un producto ajeno",
  () => {
    const filas = productos(1, 10);
    afirmar.equal(
      navegacion.pasoProductoPreparacion(filas, 1, 1, 23, -1),
      null,
    );
    afirmar.equal(
      navegacion.pasoProductoPreparacion(filas, 99, 1, 23, 1),
      null,
    );
    afirmar.equal(
      navegacion.pasoProductoPreparacion(filas, 9, 1, 23, 1).producto.id,
      10,
    );
    afirmar.equal(
      navegacion.pasoProductoPreparacion(filas, 10, 1, 23, 1).pagina,
      2,
    );
    afirmar.equal(
      navegacion.pasoProductoPreparacion(productos(11, 10), 11, 2, 23, -1)
        .pagina,
      1,
    );
    afirmar.equal(
      navegacion.pasoProductoPreparacion(productos(21, 3), 23, 3, 23, 1),
      null,
    );
  },
);

prueba(
  "anterior y siguiente cruzan páginas conservando cantidades, lotes y mediciones",
  async () => {
    const sesion = crearSesion();
    try {
      const original = JSON.stringify(sesion.documento);
      sesion.renderizar();
      let modelo = await sesion.resolver({
        count: 12,
        results: productos(1, 10),
      });
      modelo.mover(1);
      modelo = sesion.renderizar();
      afirmar.equal(modelo.navegando, true);
      modelo = await sesion.resolver({ count: 12, results: productos(11, 2) });
      afirmar.equal(sesion.seleccionado().id, 11);
      afirmar.equal(modelo.pagina, 2);
      modelo.mover(-1);
      sesion.renderizar();
      modelo = await sesion.resolver({ count: 12, results: productos(1, 10) });
      afirmar.equal(sesion.seleccionado().id, 10);
      afirmar.equal(modelo.pagina, 1);
      afirmar.equal(JSON.stringify(sesion.documento), original);
      afirmar.equal(sesion.errores.length, 0);
      afirmar.ok(
        sesion.peticiones.every((peticion) => !peticion.opciones.method),
      );
    } finally {
      sesion.cerrar();
    }
  },
);

prueba(
  "volver a productos cancela un cambio pendiente y descarta respuestas tardías",
  async () => {
    const sesion = crearSesion();
    try {
      sesion.renderizar();
      let modelo = await sesion.resolver({
        count: 12,
        results: productos(1, 10),
      });
      modelo.mover(1);
      modelo = sesion.renderizar();
      await esperar(0);
      const pendiente = sesion.peticiones.at(-1);
      modelo.cancelarNavegacion();
      modelo = sesion.renderizar();
      afirmar.equal(modelo.pagina, 1);
      afirmar.equal(pendiente.opciones.signal.aborted, true);
      pendiente.resolver({ count: 12, results: productos(11, 2) });
      await esperar(0);
      modelo = sesion.renderizar();
      afirmar.equal(sesion.seleccionado().id, 10);
      afirmar.equal(sesion.abiertos.length, 0);
      afirmar.equal(modelo.filas[0].id, 1);
      modelo.alBuscar("Banana");
      modelo.alCategoria({ id: 3, nombre: "Frutas" });
      modelo = sesion.renderizar();
      modelo.cancelarNavegacion();
      modelo = sesion.renderizar();
      afirmar.equal(modelo.buscar, "Banana");
      afirmar.equal(modelo.categoria.id, 3);
    } finally {
      sesion.cerrar();
    }
  },
);

prueba(
  "Solo pendientes reinicia la página, descarta la consulta anterior y conserva lo preparado",
  async () => {
    const sesion = crearSesion();
    try {
      const original = JSON.stringify(sesion.documento);
      sesion.renderizar();
      let modelo = await sesion.resolver({
        count: 12,
        results: productos(1, 10),
      });
      afirmar.equal(modelo.vista, "todos");
      afirmar.equal(
        new URLSearchParams(sesion.peticiones[0].ruta.split("?")[1]).get(
          "solo_pendientes",
        ),
        "false",
      );
      modelo.alPagina(2);
      sesion.renderizar();
      await esperar(0);
      const anterior = sesion.peticiones.at(-1);

      modelo = sesion.renderizar();
      modelo.alVista("pendientes");
      modelo = sesion.renderizar();
      afirmar.equal(modelo.pagina, 1);
      afirmar.equal(modelo.filas.length, 0);
      afirmar.equal(anterior.opciones.signal.aborted, true);
      anterior.resolver({ count: 12, results: productos(11, 2) });
      await esperar(0);
      modelo = sesion.renderizar();
      afirmar.equal(modelo.filas.length, 0);

      modelo = await sesion.resolver({ count: 2, results: productos(2, 2) });
      afirmar.equal(modelo.total, 2);
      afirmar.equal(modelo.filas[0].id, 2);
      afirmar.equal(
        new URLSearchParams(sesion.peticiones.at(-1).ruta.split("?")[1]).get(
          "solo_pendientes",
        ),
        "true",
      );
      modelo.alVista("todos");
      modelo = sesion.renderizar();
      afirmar.equal(modelo.filas.length, 0);
      modelo = await sesion.resolver({ count: 12, results: productos(1, 10) });
      afirmar.equal(modelo.total, 12);
      afirmar.equal(modelo.pagina, 1);
      afirmar.equal(JSON.stringify(sesion.documento), original);
      afirmar.ok(
        sesion.peticiones.every((peticion) => !peticion.opciones.method),
      );
      afirmar.equal(sesion.errores.length, 0);
    } finally {
      sesion.cerrar();
    }
  },
);

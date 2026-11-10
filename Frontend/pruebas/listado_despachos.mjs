import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import * as internacionalizacion from "next-intl";
import * as iconos from "lucide-react";
import compilador from "typescript";

function cargar(nombre, dependencias = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/despachos/${nombre}`, import.meta.url),
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
      require: (ruta) => {
        if (ruta.endsWith(".module.css")) return { default: {} };
        if (ruta in dependencias) return dependencias[ruta];
        throw new Error(`Dependencia no configurada: ${ruta}`);
      },
      URLSearchParams,
      AbortController,
      setTimeout: (funcion) => setTimeout(funcion, 0),
      clearTimeout,
    },
  );
  return exportaciones;
}
const listado = cargar("listadoDespachos.ts");

prueba(
  "un despacho enviado abre su resumen y conserva bloqueada la edicion",
  () => {
    const accion = listado.accionListadoDespacho(
      { id: 3, estado: "borrador", enviado_en: "2026-10-30T12:00:00Z" },
      true,
    );
    afirmar.equal(accion.ruta, "/despachos/3");
    afirmar.equal(accion.etiqueta, "verResumenListado");
  },
);
const filtros = {
  vista: "activos",
  buscar: "",
  fecha: "",
  estado: "",
  pagina: 1,
};
const resumen = {
  total: 4,
  borrador: 1,
  en_ruta: 1,
  finalizado: 1,
  cancelado: 1,
  hay_carga_disponible: true,
};

prueba(
  "la vista inicial incluye activos de cualquier fecha y pagina en el servidor",
  () => {
    const rutas = listado.consultasListadoDespachos(filtros);
    const parametros = new URLSearchParams(rutas.lista.split("?")[1]);
    afirmar.equal(parametros.get("vista"), "activos");
    afirmar.equal(parametros.get("pagina"), "1");
    afirmar.equal(parametros.has("fecha"), false);
    afirmar.equal(parametros.has("page_size"), false);
  },
);

prueba(
  "busqueda y fecha se comparten en los contadores, sin el estado ni la pagina de la lista",
  () => {
    const rutas = listado.consultasListadoDespachos({
      ...filtros,
      buscar: "  DES-4 & 5  ",
      estado: "en_ruta",
      fecha: "2026-10-28",
      pagina: 3,
    });
    const lista = new URLSearchParams(rutas.lista.split("?")[1]);
    const contadores = new URLSearchParams(rutas.resumen.split("?")[1]);
    afirmar.equal(lista.get("buscar"), "DES-4 & 5");
    afirmar.equal(contadores.get("buscar"), "DES-4 & 5");
    afirmar.equal(contadores.get("fecha"), "2026-10-28");
    afirmar.equal(contadores.has("estado"), false);
    afirmar.equal(contadores.has("vista"), false);
    afirmar.equal(contadores.has("pagina"), false);
    afirmar.equal(
      new URLSearchParams(
        listado
          .consultasListadoDespachos({
            ...filtros,
            vista: "historial",
            estado: "en_ruta",
          })
          .lista.split("?")[1],
      ).has("estado"),
      false,
    );
  },
);

prueba(
  "un filtro sin coincidencias se distingue de la primera carga y del historial vacio",
  () => {
    afirmar.equal(
      listado.tipoVacioListadoDespachos("activos", true, {
        ...resumen,
        total: 0,
        hay_carga_disponible: false,
      }),
      "filtros",
    );
    afirmar.equal(
      listado.tipoVacioListadoDespachos("activos", false, {
        ...resumen,
        total: 0,
      }),
      "primero",
    );
    afirmar.equal(
      listado.tipoVacioListadoDespachos("activos", false, {
        ...resumen,
        total: 0,
        hay_carga_disponible: false,
      }),
      "sin_carga",
    );
    afirmar.equal(
      listado.tipoVacioListadoDespachos("historial", false, resumen),
      "historial",
    );
    afirmar.equal(
      listado.tipoVacioListadoDespachos("activos", false, resumen),
      "activos",
    );
    afirmar.equal(
      listado.tipoVacioListadoDespachos("activos", false, null),
      "vista",
    );
  },
);

prueba(
  "la accion de un borrador solo lleva a editar si existe ese permiso",
  () => {
    afirmar.equal(
      listado.accionListadoDespacho({ id: 7, estado: "borrador" }, true).ruta,
      "/despachos/7/editar",
    );
    afirmar.equal(
      listado.accionListadoDespacho({ id: 7, estado: "borrador" }, false).ruta,
      "/despachos/7",
    );
    for (const estado of ["en_ruta", "finalizado", "cancelado"])
      afirmar.equal(
        listado.accionListadoDespacho({ id: 7, estado }, true).ruta,
        "/despachos/7",
      );
  },
);

function crearConsulta() {
  const almacen = [];
  let cursor = 0;
  let efectos = [];
  const peticiones = [];
  const errores = [];
  const react = {
    useState: (inicial) => {
      const indice = cursor++;
      if (!(indice in almacen)) almacen[indice] = inicial;
      return [
        almacen[indice],
        (valor) => {
          almacen[indice] =
            typeof valor === "function" ? valor(almacen[indice]) : valor;
        },
      ];
    },
    useCallback: (funcion) => funcion,
    useEffect: (efecto, dependencias) => {
      const indice = cursor++;
      const anterior = almacen[indice];
      if (
        !anterior ||
        dependencias.some(
          (valor, posicion) =>
            !Object.is(valor, anterior.dependencias[posicion]),
        )
      )
        efectos.push(() => {
          anterior?.limpiar?.();
          almacen[indice] = { dependencias, limpiar: efecto() };
        });
    },
  };
  const consulta = cargar("useConsultaListadoDespachos.ts", {
    react,
    "@/lib/api": {
      api: (ruta, opciones) =>
        new Promise((resolver, rechazar) =>
          peticiones.push({ ruta, opciones, resolver, rechazar }),
        ),
    },
  }).default;
  const alError = (error) => errores.push(error);
  const renderizar = (ruta) => {
    cursor = 0;
    efectos = [];
    const modelo = consulta(ruta, alError, 0);
    efectos.forEach((efecto) => efecto());
    return modelo;
  };
  return {
    renderizar,
    peticiones,
    errores,
    cerrar: () => almacen.forEach((valor) => valor?.limpiar?.()),
  };
}

prueba(
  "cambiar de vista oculta inmediatamente los resultados anteriores y descarta respuestas tardias",
  async () => {
    const sesion = crearConsulta();
    const activos = "despachos/?vista=activos";
    const historial = "despachos/?vista=historial";
    sesion.renderizar(activos);
    await esperar(0);
    sesion.peticiones[0].resolver({ count: 1, results: [{ id: 1 }] });
    await esperar(0);
    afirmar.equal(sesion.renderizar(activos).datos.results[0].id, 1);
    let modelo = sesion.renderizar(historial);
    afirmar.equal(modelo.datos, null);
    afirmar.equal(modelo.cargando, true);
    await esperar(0);
    sesion.renderizar(activos);
    await esperar(0);
    afirmar.equal(sesion.peticiones[1].opciones.signal.aborted, true);
    sesion.peticiones[2].resolver({ count: 1, results: [{ id: 3 }] });
    await esperar(0);
    sesion.peticiones[1].resolver({ count: 1, results: [{ id: 2 }] });
    await esperar(0);
    modelo = sesion.renderizar(activos);
    afirmar.equal(modelo.datos.results[0].id, 3);
    afirmar.equal(sesion.errores.length, 0);
    sesion.cerrar();
  },
);

prueba(
  "un fallo se puede reintentar y una consulta sin permiso no hace peticiones",
  async () => {
    const sesion = crearConsulta();
    afirmar.equal(sesion.renderizar(null).cargando, false);
    await esperar(0);
    afirmar.equal(sesion.peticiones.length, 0);
    const ruta = "despachos/?vista=activos";
    sesion.renderizar(ruta);
    await esperar(0);
    sesion.peticiones[0].rechazar(new Error("Fallo de conexion"));
    await esperar(0);
    let modelo = sesion.renderizar(ruta);
    afirmar.equal(modelo.fallo, true);
    modelo.recargar();
    modelo = sesion.renderizar(ruta);
    afirmar.equal(modelo.fallo, false);
    afirmar.equal(modelo.cargando, true);
    await esperar(0);
    sesion.peticiones[1].resolver({ count: 0, results: [] });
    await esperar(0);
    afirmar.equal(sesion.renderizar(ruta).datos.count, 0);
    sesion.cerrar();
  },
);

const dependenciasVista = {
  "react/jsx-runtime": jsx,
  "next-intl": internacionalizacion,
  "lucide-react": iconos,
  "@/i18n/navigation": {
    Link: ({ href, children, ...propiedades }) =>
      React.createElement("a", { href, ...propiedades }, children),
  },
  "@/components/ui/button/Button": {
    default: ({ children, ...propiedades }) =>
      React.createElement("button", propiedades, children),
  },
  "./listadoDespachos": listado,
  "./tipos": cargar("tipos.ts"),
};
const Estado = cargar("EstadoListadoDespachos.tsx", dependenciasVista).default;
const Fila = cargar("FilaListadoDespachos.tsx", dependenciasVista).default;
function dibujar(componente, propiedades, idioma = "es") {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL(`../src/messages/${idioma}.json`, import.meta.url),
      "utf8",
    ),
  );
  return representar(
    React.createElement(
      internacionalizacion.NextIntlClientProvider,
      { locale: idioma, timeZone: "America/La_Paz", messages: mensajes },
      React.createElement(componente, propiedades),
    ),
  );
}

prueba(
  "el estado vacio ofrece preparaciones solo con permiso y distingue filtros",
  () => {
    const propiedades = {
      cargando: false,
      fallo: false,
      vista: "activos",
      hayFiltros: false,
      resumen: { ...resumen, total: 0, hay_carga_disponible: false },
      puedeCrear: false,
      puedeVerPreparaciones: false,
    };
    afirmar.ok(!dibujar(Estado, propiedades).includes('href="/preparaciones"'));
    afirmar.ok(
      dibujar(Estado, { ...propiedades, puedeVerPreparaciones: true }).includes(
        'href="/preparaciones"',
      ),
    );
    const filtrado = dibujar(Estado, { ...propiedades, hayFiltros: true });
    afirmar.ok(filtrado.includes("No hay coincidencias"));
    afirmar.ok(filtrado.includes("Limpiar filtros"));
    afirmar.ok(!filtrado.includes('href="/despachos/nuevo"'));
  },
);

prueba(
  "la fila muestra progreso fisico y siguiente destino con traducciones completas",
  () => {
    const despacho = {
      id: 7,
      codigo: "DES-000007",
      estado: "en_ruta",
      fecha_reparto: "2026-10-28",
      almacen_nombre: "Central",
      vehiculo_placa: "1234-ABC",
      chofer_nombre: "Jose",
      resumen: { paradas: 4, completadas: 2 },
      siguiente_destino: {
        cliente_nombre: "Hipermaxi",
        sucursal_nombre: "Satelite",
        orden: 3,
      },
    };
    for (const idioma of ["es", "en"]) {
      const resultado = dibujar(Fila, { despacho, puedeEditar: false }, idioma);
      afirmar.ok(resultado.includes('role="progressbar"'));
      afirmar.ok(resultado.includes('aria-valuenow="2"'));
      afirmar.ok(resultado.includes('aria-valuemax="4"'));
      afirmar.ok(resultado.includes("Hipermaxi"));
      afirmar.ok(resultado.includes("Satelite"));
      afirmar.ok(!resultado.includes("/editar"));
    }
    afirmar.ok(
      !dibujar(Fila, {
        despacho: { ...despacho, estado: "cancelado" },
        puedeEditar: true,
      }).includes('role="progressbar"'),
    );
  },
);

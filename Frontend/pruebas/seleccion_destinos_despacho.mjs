import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import compilador from "typescript";
function cargar(nombre, dependencias = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL("../src/components/despachos/" + nombre, import.meta.url),
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
      URLSearchParams,
      AbortController,
      require: (ruta) =>
        ruta in dependencias
          ? dependencias[ruta]
          : { default: ruta.endsWith(".css") ? {} : ruta.split("/").at(-1) },
    },
  );
  return exportaciones;
}
const seleccion = cargar("seleccionDestinosDespacho.ts");
const fila = (id, sucursal = 5) => ({
  id,
  pedido: sucursal === 5 ? 20 : 21,
  codigo_pedido: sucursal === 5 ? "PED-000020" : "PED-000021",
  sucursal,
  sucursal_nombre: sucursal === 5 ? "Centro" : "Norte",
  cliente_nombre: "Hipermaxi",
  producto: 2,
  producto_nombre: "Papaya",
  columna: "cajas",
  cantidad: 1,
  peso_kg: "0.100",
  fecha_requerida: "2026-10-30",
});
const grupo = {
  sucursal: 5,
  sucursal_nombre: "Centro",
  cliente_nombre: "Hipermaxi",
  asignaciones: 11,
  productos: 1,
  cajas: 11,
  unidades: 0,
  peso_kg: "1.100",
};
prueba(
  "agrupar conserva CANT y UNI independientes y suma pesos sin errores de decimales",
  () => {
    const grupos = seleccion.agruparCargaDestinos([
      fila(1),
      { ...fila(2), columna: "unidades", cantidad: 4, peso_kg: "0.200" },
      fila(3, 6),
    ]);
    afirmar.equal(grupos.length, 2);
    afirmar.equal(grupos[0].productos, 1);
    afirmar.equal(grupos[0].asignaciones, 2);
    afirmar.equal(grupos[0].cajas, 1);
    afirmar.equal(grupos[0].unidades, 4);
    afirmar.equal(grupos[0].peso_kg, "0.300");
    afirmar.equal(
      seleccion.pesoCargaDespacho([
        { peso_kg: "99999999999.999" },
        { peso_kg: "0.001" },
      ]),
      "100000000000.000",
    );
    afirmar.equal(
      seleccion.cargaDelDestino(
        [{ ...fila(1), fecha_requerida: "2026-10-29" }, fila(2), fila(3, 6)],
        5,
        "2026-10-30",
      ).length,
      1,
    );
  },
);
prueba(
  "seleccionar sucursal consulta todas sus paginas de diez con el mismo contexto",
  async () => {
    const peticiones = [];
    const datos = await seleccion.cargarDestinoCompleto(
      new URLSearchParams({
        almacen: "1",
        sucursal: "5",
        despacho: "8",
        fecha: "2026-10-30",
      }),
      async (ruta) => {
        const parametros = new URLSearchParams(ruta.split("?")[1]);
        peticiones.push(parametros);
        return {
          count: 11,
          version_carga: "v1",
          results:
            parametros.get("pagina") === "1"
              ? Array.from({ length: 10 }, (_, indice) => fila(indice + 1))
              : [fila(11)],
        };
      },
      new AbortController().signal,
    );
    afirmar.equal(datos.length, 11);
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[1].get("pagina"), "2");
    for (const consulta of peticiones)
      for (const [campo, valor] of Object.entries({
        almacen: "1",
        sucursal: "5",
        despacho: "8",
        fecha: "2026-10-30",
      }))
        afirmar.equal(consulta.get(campo), valor);
  },
);
prueba(
  "un cambio de version, duplicados o limite excesivo nunca devuelve una sucursal parcial",
  async () => {
    for (const modo of ["version", "duplicado", "limite"]) {
      let pagina = 0;
      await afirmar.rejects(
        () =>
          seleccion.cargarDestinoCompleto(
            new URLSearchParams(),
            async () => {
              pagina++;
              return {
                count: modo === "limite" ? 1001 : 11,
                version_carga: modo === "version" && pagina === 2 ? "v2" : "v1",
                results:
                  pagina === 1
                    ? Array.from({ length: 10 }, (_, indice) =>
                        fila(indice + 1),
                      )
                    : [fila(modo === "duplicado" ? 1 : 11)],
              };
            },
            new AbortController().signal,
          ),
        seleccion.ErrorSeleccionDestino,
      );
    }
  },
);
function crearSesion(seleccionInicial = [fila(99, 6)]) {
  let arbol,
    cursor = 0,
    actuales = seleccionInicial;
  const consultas = [];
  const valores = [],
    peticiones = [],
    cambios = [],
    estados = [];
  const react = {
    useState: (inicial) => {
      const indice = cursor++;
      if (!(indice in valores)) valores[indice] = inicial;
      return [
        valores[indice],
        (valor) => {
          valores[indice] =
            typeof valor === "function" ? valor(valores[indice]) : valor;
        },
      ];
    },
    useRef: (inicial) => {
      const indice = cursor++;
      return (valores[indice] ||= { current: inicial });
    },
    useEffect: () => {},
  };
  const Componente = cargar("SeleccionCargaDespacho.tsx", {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "next-intl": {
      useTranslations: () => (clave) => clave,
      useLocale: () => "es",
    },
    "@/components/compras/calculos": { mostrarFecha: (fecha) => fecha },
    "@/components/logistica/tipos": { claseEntrada: "entrada" },
    "./useConsultaListadoDespachos": {
      default: (ruta) => {
        consultas.push(ruta);
        return {
          datos: { count: 1, results: [grupo] },
          cargando: false,
          fallo: false,
          recargar: () => {},
        };
      },
    },
    "./seleccionDestinosDespacho": seleccion,
    "@/lib/api": {
      api: (ruta, opciones) =>
        new Promise((resolver, rechazar) =>
          peticiones.push({ ruta, opciones, resolver, rechazar }),
        ),
    },
  }).default;
  const todos = (nodo = arbol) =>
    !nodo || typeof nodo !== "object"
      ? []
      : Array.isArray(nodo)
        ? nodo.flatMap((hijo) => todos(hijo))
        : [nodo, ...todos(nodo.props?.children ?? null)];
  const renderizar = () => {
    cursor = 0;
    arbol = Componente({
      almacen: 1,
      despacho: 8,
      seleccionadas: actuales,
      alCambiar: (filas) => {
        actuales = filas;
        cambios.push(filas);
      },
      alError: () => {},
      alCargando: (valor) => estados.push(valor),
    });
  };
  renderizar();
  return {
    peticiones,
    consultas,
    cambios,
    estados,
    renderizar,
    actuales: () => actuales,
    todos,
    marcarPedido: (pedido) =>
      todos()
        .find((nodo) => nodo.type === "FilaDestinoCargaDespacho")
        .props.alSeleccionarPedido(pedido),
    marcar: () =>
      todos()
        .find((nodo) => nodo.type === "FilaDestinoCargaDespacho")
        .props.alSeleccionar(),
    resolver: async (datos) => {
      peticiones.at(-1).resolver(datos);
      await esperar(0);
      renderizar();
    },
  };
}
prueba(
  "la interfaz aplica la sucursal completa una sola vez y conserva otros destinos al quitarla",
  async () => {
    const sesion = crearSesion();
    sesion.marcar();
    sesion.renderizar();
    afirmar.equal(sesion.cambios.length, 0);
    afirmar.equal(sesion.estados.at(-1), true);
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: Array.from({ length: 10 }, (_, indice) => fila(indice + 1)),
    });
    afirmar.equal(sesion.cambios.length, 0);
    afirmar.equal(sesion.peticiones.length, 2);
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: [fila(11)],
    });
    afirmar.equal(sesion.cambios.length, 1);
    afirmar.equal(sesion.actuales().length, 12);
    afirmar.equal(sesion.estados.at(-1), false);
    sesion.marcar();
    sesion.renderizar();
    afirmar.equal(sesion.actuales().length, 1);
    afirmar.equal(sesion.actuales()[0].sucursal, 6);
  },
);
prueba(
  "cancelar descarta respuestas tardias y libera el bloqueo sin modificar la carga",
  async () => {
    const sesion = crearSesion();
    sesion.marcar();
    sesion.renderizar();
    sesion
      .todos()
      .find(
        (nodo) =>
          nodo.type === "button" &&
          nodo.props.children === "cancelarSeleccionDestino",
      )
      .props.onClick();
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: Array.from({ length: 10 }, (_, indice) => fila(indice + 1)),
    });
    afirmar.equal(sesion.cambios.length, 0);
    afirmar.equal(sesion.actuales().length, 1);
    afirmar.equal(sesion.estados.at(-1), false);
    afirmar.equal(sesion.peticiones[0].opciones.signal.aborted, true);
  },
);
prueba(
  "un cambio entre paginas conserva lo elegido y muestra un error recuperable",
  async () => {
    const sesion = crearSesion();
    sesion.marcar();
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: Array.from({ length: 10 }, (_, indice) => fila(indice + 1)),
    });
    await sesion.resolver({
      count: 11,
      version_carga: "v2",
      results: [fila(11)],
    });
    afirmar.equal(sesion.cambios.length, 0);
    afirmar.equal(sesion.actuales().length, 1);
    afirmar.ok(
      sesion
        .todos()
        .some(
          (nodo) =>
            nodo.props?.role === "alert" &&
            nodo.props.children === "cargaCambioDestino",
        ),
    );
    afirmar.equal(sesion.estados.at(-1), false);
  },
);

prueba(
  "agrupar por pedido conserva su fecha, productos distintos y cantidades independientes",
  () => {
    const grupos = seleccion.agruparCargaPedidos([
      fila(1),
      { ...fila(2), columna: "unidades", cantidad: 4, peso_kg: "0.200" },
      {
        ...fila(3),
        pedido: 22,
        codigo_pedido: "PED-000022",
        fecha_requerida: "2026-11-02",
      },
    ]);
    afirmar.equal(grupos.length, 2);
    afirmar.equal(grupos[0].pedido, 20);
    afirmar.equal(grupos[0].codigo_pedido, "PED-000020");
    afirmar.equal(grupos[0].fecha_requerida, "2026-10-30");
    afirmar.equal(grupos[0].productos, 1);
    afirmar.equal(grupos[0].asignaciones, 2);
    afirmar.equal(grupos[0].cajas, 1);
    afirmar.equal(grupos[0].unidades, 4);
    afirmar.equal(grupos[0].peso_kg, "0.300");
    afirmar.equal(
      seleccion.cargaDelDestino(
        [fila(1), { ...fila(2), pedido: 22 }],
        5,
        "",
        20,
      ).length,
      1,
    );
  },
);
prueba(
  "incluir un pedido consulta todas sus paginas y no quita los otros pedidos de la sucursal",
  async () => {
    const otro = { ...fila(200), pedido: 24, codigo_pedido: "PED-000024" };
    const sesion = crearSesion([otro, fila(99, 6)]);
    const pedido = { pedido: 20, asignaciones: 11 };
    sesion.marcarPedido(pedido);
    sesion.renderizar();
    const parametros = new URLSearchParams(
      sesion.peticiones[0].ruta.split("?")[1],
    );
    afirmar.equal(parametros.get("pedido"), "20");
    afirmar.equal(parametros.get("sucursal"), "5");
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: Array.from({ length: 10 }, (_, indice) => fila(indice + 1)),
    });
    afirmar.equal(sesion.cambios.length, 0);
    await sesion.resolver({
      count: 11,
      version_carga: "v1",
      results: [fila(11)],
    });
    afirmar.equal(sesion.actuales().length, 13);
    sesion.marcarPedido(pedido);
    sesion.renderizar();
    afirmar.equal(sesion.actuales().length, 2);
    afirmar.ok(sesion.actuales().some((fila) => fila.pedido === 24));
  },
);
prueba(
  "cambiar la fecha conserva los pedidos elegidos y permite ver toda la carga de otras fechas",
  () => {
    const sesion = crearSesion([
      fila(1),
      { ...fila(99, 6), fecha_requerida: "2026-10-29" },
    ]);
    sesion
      .todos()
      .find((nodo) => nodo.type === "CampoFecha")
      .props.alCambiar("2026-10-30");
    sesion.renderizar();
    afirmar.equal(sesion.actuales().length, 2);
    afirmar.ok(sesion.consultas.at(-1).includes("fecha=2026-10-30"));
    afirmar.ok(
      sesion
        .todos()
        .some((nodo) => nodo.props?.children === "pedidosFueraFechaCarga"),
    );
    sesion
      .todos()
      .find(
        (nodo) =>
          nodo.type === "button" &&
          nodo.props.children === "verTodaCargaElegida",
      )
      .props.onClick();
    sesion.renderizar();
    afirmar.equal(
      sesion.todos().find((nodo) => nodo.type === "CampoFecha").props.value,
      "",
    );
    afirmar.equal(
      sesion.todos().filter((nodo) => nodo.type === "FilaDestinoCargaDespacho")
        .length,
      2,
    );
    afirmar.equal(sesion.actuales().length, 2);
  },
);

prueba(
  "la lista pagina pedidos completos y conserva almacen, fecha y despacho en sus productos",
  () => {
    let cursor = 0,
      arbol;
    const valores = [],
      rutas = [],
      elegidos = [];
    const react = {
      useState: (inicial) => {
        const indice = cursor++;
        if (!(indice in valores)) valores[indice] = inicial;
        return [
          valores[indice],
          (valor) => {
            valores[indice] = valor;
          },
        ];
      },
    };
    const Componente = cargar("PedidosDestinoDespacho.tsx", {
      react,
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next-intl": { useTranslations: () => (clave) => clave },
      "./seleccionDestinosDespacho": seleccion,
      "./useConsultaListadoDespachos": {
        default: (ruta) => {
          rutas.push(ruta);
          const pagina = Number(
            new URLSearchParams(ruta.split("?")[1]).get("pagina"),
          );
          return {
            cargando: false,
            fallo: false,
            recargar: () => {},
            datos: {
              count: 11,
              results: Array.from(
                { length: pagina === 1 ? 10 : 1 },
                (_, indice) => ({
                  pedido: 20 + (pagina - 1) * 10 + indice,
                  asignaciones: 2,
                }),
              ),
            },
          };
        },
      },
    }).default;
    const nodos = (nodo) =>
      !nodo || typeof nodo !== "object"
        ? []
        : Array.isArray(nodo)
          ? nodo.flatMap(nodos)
          : [nodo, ...nodos(nodo.props?.children)];
    const renderizar = () => {
      cursor = 0;
      arbol = Componente({
        ruta: "despachos/disponibles/?almacen=1&sucursal=5&despacho=8&fecha=2026-11-02",
        filasElegidas: [],
        seleccionadas: [],
        soloElegidas: false,
        bloqueado: false,
        alSeleccionarPedido: (pedido) => elegidos.push(pedido),
        alAlternar: () => {},
        alError: () => {},
      });
    };
    renderizar();
    afirmar.equal(
      nodos(arbol).filter((nodo) => nodo.type === "FilaPedidoCargaDespacho")
        .length,
      10,
    );
    const primero = nodos(arbol).find(
      (nodo) => nodo.type === "FilaPedidoCargaDespacho",
    );
    const parametros = new URLSearchParams(
      primero.props.rutaDetalle.split("?")[1],
    );
    for (const [campo, valor] of Object.entries({
      almacen: "1",
      sucursal: "5",
      despacho: "8",
      fecha: "2026-11-02",
      pedido: "20",
    }))
      afirmar.equal(parametros.get(campo), valor);
    primero.props.alSeleccionar();
    afirmar.equal(elegidos[0].pedido, 20);
    nodos(arbol)
      .find((nodo) => nodo.type === "PaginadorCompras")
      .props.alCambiar(2);
    renderizar();
    afirmar.equal(
      new URLSearchParams(rutas.at(-1).split("?")[1]).get("pagina"),
      "2",
    );
    afirmar.equal(
      nodos(arbol).filter((nodo) => nodo.type === "FilaPedidoCargaDespacho")
        .length,
      1,
    );
  },
);
prueba(
  "la vista de carga elegida agrupa todas las asignaciones antes de paginar pedidos",
  () => {
    const Componente = cargar("PedidosDestinoDespacho.tsx", {
      react: { useState: (inicial) => [inicial, () => {}] },
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next-intl": { useTranslations: () => (clave) => clave },
      "./seleccionDestinosDespacho": seleccion,
      "./useConsultaListadoDespachos": {
        default: (ruta) => {
          afirmar.equal(ruta, null);
          return { cargando: false, fallo: false };
        },
      },
    }).default;
    const filas = Array.from({ length: 11 }, (_, indice) => fila(indice + 1));
    const arbol = Componente({
      ruta: "despachos/disponibles/?almacen=1&sucursal=5",
      filasElegidas: filas,
      seleccionadas: filas,
      soloElegidas: true,
      bloqueado: false,
      alSeleccionarPedido: () => {},
      alAlternar: () => {},
      alError: () => {},
    });
    const nodos = (nodo) =>
      !nodo || typeof nodo !== "object"
        ? []
        : Array.isArray(nodo)
          ? nodo.flatMap(nodos)
          : [nodo, ...nodos(nodo.props?.children)];
    afirmar.equal(
      nodos(arbol).filter((nodo) => nodo.type === "FilaPedidoCargaDespacho")
        .length,
      1,
    );
    afirmar.equal(
      nodos(arbol).find((nodo) => nodo.type === "FilaPedidoCargaDespacho").props
        .pedido.asignaciones,
      11,
    );
    afirmar.ok(!nodos(arbol).some((nodo) => nodo.type === "PaginadorCompras"));
  },
);

import React from "react";
import * as jsx from "react/jsx-runtime";
import * as internacionalizacion from "next-intl";
import * as iconos from "lucide-react";
import { renderToStaticMarkup as representar } from "react-dom/server";
prueba(
  "cada pedido muestra codigo, fecha requerida y solo cantidades preparadas en ambos idiomas",
  () => {
    const calculos = cargar("../compras/calculos.ts");
    const Componente = cargar("FilaPedidoCargaDespacho.tsx", {
      react: React,
      "react/jsx-runtime": jsx,
      "next-intl": internacionalizacion,
      "lucide-react": iconos,
      "@/components/compras/calculos": calculos,
    }).default;
    for (const idioma of ["es", "en"]) {
      const mensajes = JSON.parse(
        leerArchivo(
          new URL("../src/messages/" + idioma + ".json", import.meta.url),
          "utf8",
        ),
      );
      const pedido = {
        pedido: 20,
        codigo_pedido: "PED-000020",
        fecha_requerida: "2026-11-02",
        asignaciones: 2,
        productos: 1,
        cajas: 1,
        unidades: 0,
        peso_kg: "5.400",
      };
      const resultado = representar(
        React.createElement(
          internacionalizacion.NextIntlClientProvider,
          { locale: idioma, messages: mensajes, timeZone: "America/La_Paz" },
          React.createElement(Componente, {
            pedido,
            rutaDetalle: "ruta",
            seleccionadas: [fila(1)],
            soloElegidas: false,
            bloqueado: false,
            ampliado: false,
            alAmpliar: () => {},
            alSeleccionar: () => {},
            alAlternar: () => {},
            alError: () => {},
          }),
        ),
      );
      afirmar.ok(resultado.includes("PED-000020"));
      afirmar.ok(
        resultado.includes(calculos.mostrarFecha("2026-11-02", idioma)),
      );
      afirmar.ok(resultado.includes(idioma === "es" ? "1 caja" : "1 box"));
      afirmar.ok(
        !resultado.includes(idioma === "es" ? "0 unidades" : "0 units"),
      );
      afirmar.ok(!resultado.includes("5.400"));
      afirmar.ok(resultado.includes('aria-checked="mixed"'));
    }
  },
);

prueba(
  "si la disponibilidad cambia y una pagina deja de existir, reintentar vuelve a la primera pagina",
  () => {
    let cursor = 0,
      arbol,
      reintentos = 0;
    const valores = [];
    const Componente = cargar("PedidosDestinoDespacho.tsx", {
      react: {
        useState: (inicial) => {
          const indice = cursor++;
          if (!(indice in valores)) valores[indice] = inicial;
          return [
            valores[indice],
            (valor) => {
              valores[indice] = valor;
            },
          ];
        },
      },
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next-intl": { useTranslations: () => (clave) => clave },
      "./seleccionDestinosDespacho": seleccion,
      "./useConsultaListadoDespachos": {
        default: (ruta) => {
          const pagina = Number(
            new URLSearchParams(ruta.split("?")[1]).get("pagina"),
          );
          return {
            cargando: false,
            fallo: pagina === 2,
            recargar: () => {
              reintentos++;
            },
            datos: { count: 11, results: [{ pedido: 20, asignaciones: 1 }] },
          };
        },
      },
    }).default;
    const nodos = (nodo) =>
      !nodo || typeof nodo !== "object"
        ? []
        : Array.isArray(nodo)
          ? nodo.flatMap(nodos)
          : [nodo, ...nodos(nodo.props?.children)];
    const renderizar = () => {
      cursor = 0;
      arbol = Componente({
        ruta: "despachos/disponibles/?almacen=1&sucursal=5",
        filasElegidas: [],
        seleccionadas: [],
        soloElegidas: false,
        bloqueado: false,
        alSeleccionarPedido: () => {},
        alAlternar: () => {},
        alError: () => {},
      });
    };
    renderizar();
    nodos(arbol)
      .find((nodo) => nodo.type === "PaginadorCompras")
      .props.alCambiar(2);
    renderizar();
    const estado = nodos(arbol).find(
      (nodo) => nodo.type === "EstadoConsultaLogistica",
    );
    afirmar.ok(estado.props.fallo);
    estado.props.alRecargar();
    renderizar();
    afirmar.equal(reintentos, 1);
    afirmar.equal(
      nodos(arbol).find((nodo) => nodo.type === "PaginadorCompras").props
        .pagina,
      1,
    );
  },
);

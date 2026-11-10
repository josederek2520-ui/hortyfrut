import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import * as iconos from "lucide-react";
import compilador from "typescript";

const mensajes = Object.fromEntries(
  ["es", "en"].map((idioma) => [
    idioma,
    JSON.parse(
      leerArchivo(
        new URL(`../src/messages/${idioma}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);
const traducciones = (idioma = "es") => ({
  useLocale: () => idioma,
  useTranslations: (namespace) =>
    crearTraductor({ locale: idioma, messages: mensajes[idioma], namespace }),
});
function cargar(nombre, dependencias = {}, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/compras/${nombre}`, import.meta.url),
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
      setTimeout,
      clearTimeout,
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        if (ruta === "react") return React;
        if (ruta === "react/jsx-runtime") return jsx;
        if (ruta === "lucide-react") return iconos;
        if (ruta === "next-intl") return traducciones();
        throw new Error(`Dependencia sin preparar: ${ruta}`);
      },
      ...entorno,
    },
  );
  return exportaciones;
}
const calculos = cargar("calculos.ts", {
  "@/lib/moneda": cargar("../../lib/moneda.ts"),
});
const seleccion = cargar("seleccionProductosCompra.ts");
const Boton = cargar("../ui/button/Button.tsx").default;
const producto = {
  id: 3,
  nombre: "Banana",
  cajas: 5,
  unidades: 0,
  unidad_nombre: "Kilogramo",
  categoria: { id: 2, nombre: "Frutas" },
};
function nodos(nodo) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  return [nodo, ...nodos(nodo.props?.children)];
}
function crearGanchos() {
  const estados = [],
    referencias = [],
    efectos = [];
  let indiceEstado, indiceReferencia, indiceEfecto, pendientes;
  const ganchos = {
    useState(inicial) {
      const indice = indiceEstado++;
      if (!(indice in estados))
        estados[indice] = typeof inicial === "function" ? inicial() : inicial;
      return [
        estados[indice],
        (nuevo) => {
          estados[indice] =
            typeof nuevo === "function" ? nuevo(estados[indice]) : nuevo;
        },
      ];
    },
    useRef(inicial) {
      const indice = indiceReferencia++;
      return (referencias[indice] ||= { current: inicial });
    },
    useId: () => "compra-prueba",
    useEffect(funcion, dependencias) {
      const indice = indiceEfecto++;
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
  };
  return {
    ganchos,
    referencias,
    comenzar() {
      indiceEstado = indiceReferencia = indiceEfecto = 0;
      pendientes = [];
    },
    confirmar() {
      pendientes.forEach((funcion) => funcion());
    },
    cerrar() {
      efectos.forEach((efecto) => efecto.limpiar?.());
    },
  };
}

function prepararAvisoFecha(consultar, idioma = "es") {
  const entorno = crearGanchos();
  const Aviso = cargar("AvisoPedidosFechaCompra.tsx", {
    react: { ...React, ...entorno.ganchos },
    "next-intl": traducciones(idioma),
    "@/lib/api": { api: consultar },
  }).default;
  return {
    representar(fecha) {
      entorno.comenzar();
      const arbol = Aviso({ fecha });
      entorno.confirmar();
      return arbol;
    },
    cerrar: entorno.cerrar,
  };
}

prueba(
  "el aviso consulta la fecha elegida y distingue carga, pedidos y fecha vacia en ambos idiomas",
  async () => {
    for (const idioma of ["es", "en"]) {
      const consultas = [];
      const entorno = prepararAvisoFecha(async (ruta) => {
        consultas.push(ruta);
        const fecha = new URLSearchParams(ruta.split("?")[1]).get(
          "fecha_pedidos",
        );
        return {
          fecha_pedidos: fecha,
          resumen: { pedidos: fecha === "2026-11-06" ? 2 : 0 },
          results: [],
        };
      }, idioma);
      afirmar.equal(entorno.representar(""), null);
      afirmar.equal(consultas.length, 0);
      afirmar.match(
        representar(entorno.representar("2026-11-06")),
        idioma === "es" ? /Consultando pedidos/ : /Checking orders/,
      );
      await esperar(0);
      const conPedidos = representar(entorno.representar("2026-11-06"));
      afirmar.match(
        conPedidos,
        idioma === "es" ? /Hay pedidos pendientes/ : /There are pending orders/,
      );
      afirmar.match(conPedidos, /text-brand-700/);
      afirmar.match(
        representar(entorno.representar("2026-11-07")),
        idioma === "es" ? /Consultando pedidos/ : /Checking orders/,
      );
      await esperar(0);
      afirmar.match(
        representar(entorno.representar("2026-11-07")),
        idioma === "es"
          ? /No hay pedidos pendientes/
          : /There are no pending orders/,
      );
      afirmar.equal(consultas.length, 2);
      entorno.cerrar();
    }
  },
);

prueba(
  "el aviso ignora respuestas tardias de otra fecha y retira la consulta al vaciar o salir",
  async () => {
    const pendientes = [];
    const entorno = prepararAvisoFecha(
      (ruta, opciones) =>
        new Promise((resolver) =>
          pendientes.push({ ruta, opciones, resolver }),
        ),
    );
    entorno.representar("2026-11-06");
    entorno.representar("2026-11-07");
    afirmar.ok(pendientes[0].opciones.signal.aborted);
    pendientes[1].resolver({
      fecha_pedidos: "2026-11-07",
      resumen: { pedidos: 0 },
    });
    await esperar(0);
    afirmar.match(
      representar(entorno.representar("2026-11-07")),
      /No hay pedidos pendientes/,
    );
    pendientes[0].resolver({
      fecha_pedidos: "2026-11-06",
      resumen: { pedidos: 4 },
    });
    await esperar(0);
    afirmar.match(
      representar(entorno.representar("2026-11-07")),
      /No hay pedidos pendientes/,
    );
    afirmar.equal(entorno.representar(""), null);
    afirmar.ok(pendientes[1].opciones.signal.aborted);
    entorno.representar("2026-11-08");
    entorno.cerrar();
    afirmar.ok(pendientes[2].opciones.signal.aborted);
  },
);

prueba(
  "un error o una respuesta incorrecta nunca se presenta como ausencia de pedidos y permite reintentar",
  async () => {
    let llamadas = 0;
    const entorno = prepararAvisoFecha(async () => {
      if (++llamadas === 1) throw new Error("Sin conexion");
      return {
        fecha_pedidos: llamadas === 2 ? "2026-11-09" : "2026-11-06",
        resumen: { pedidos: 1 },
      };
    });
    entorno.representar("2026-11-06");
    await esperar(0);
    for (let intento = 0; intento < 2; intento++) {
      const arbol = entorno.representar("2026-11-06");
      afirmar.match(representar(arbol), /No se pudieron consultar los pedidos/);
      afirmar.doesNotMatch(representar(arbol), /No hay pedidos pendientes/);
      nodos(arbol)
        .find((nodo) => nodo.type === "button")
        .props.onClick();
      afirmar.match(
        representar(entorno.representar("2026-11-06")),
        /Consultando pedidos/,
      );
      await esperar(0);
    }
    afirmar.match(
      representar(entorno.representar("2026-11-06")),
      /Hay pedidos pendientes/,
    );
    entorno.cerrar();
  },
);

prueba(
  "lo solicitado usa palabras y omite las cantidades no pedidas en ambos idiomas",
  () => {
    for (const idioma of ["es", "en"]) {
      const Cantidades = cargar("CantidadesSolicitadasCompra.tsx", {
        "next-intl": traducciones(idioma),
      }).default;
      const texto = (cajas, unidades) =>
        representar(React.createElement(Cantidades, { cajas, unidades }));
      afirmar.match(texto(1, 0), idioma === "es" ? /1 caja/ : /1 box/);
      afirmar.doesNotMatch(texto(1, 0), /unidad|unit|CANT|UNI|>0/);
      afirmar.match(texto(0, 3), idioma === "es" ? /3 unidades/ : /3 units/);
      afirmar.doesNotMatch(texto(0, 3), /caja|box|>0/);
      afirmar.match(texto(2, 3), idioma === "es" ? /2 cajas/ : /2 boxes/);
    }
  },
);

prueba(
  "la compra vacia bloquea revisar y permite guardar borrador; agregar una linea habilita revisar",
  () => {
    const Barra = cargar("BarraCompra.tsx", {
      "@/components/ui/button/Button": { default: Boton },
      "./tipos": { clasePanel: "panel" },
      "./calculos": calculos,
    }).default;
    const propiedades = {
      lineas: [],
      guardando: false,
      conflicto: false,
      puedeGuardar: true,
      puedeRegistrar: true,
      alSalir() {},
      alRevisar() {},
    };
    const vacia = nodos(Barra(propiedades));
    afirmar.equal(
      vacia.find((nodo) => nodo.type === Boton && nodo.props.onClick).props
        .disabled,
      true,
    );
    afirmar.equal(
      vacia.find((nodo) => nodo.type === Boton && nodo.props.type === "submit")
        .props.disabled,
      false,
    );
    const conProducto = nodos(
      Barra({
        ...propiedades,
        lineas: [{ producto, cantidad: "", importeTotal: "", proveedor: null }],
      }),
    );
    afirmar.equal(
      conProducto.find((nodo) => nodo.type === Boton && nodo.props.onClick)
        .props.disabled,
      false,
    );
  },
);

prueba(
  "el modal muestra el total manual y cambiar las cajas no lo multiplica",
  () => {
    const sesion = prepararModal();
    sesion.buscar("lista").props.alElegir(producto);
    sesion.renderizar();
    sesion
      .buscar("formulario")
      .props.alCambiar({ cantidad: "5", importeTotal: "150.01" });
    sesion.renderizar();
    const textoTotal = () =>
      sesion
        .todos()
        .filter((nodo) => typeof nodo.props?.children === "string")
        .map((nodo) => nodo.props.children)
        .join(" ");
    afirmar.match(textoTotal(), /150,01/);
    afirmar.doesNotMatch(textoTotal(), /750,05/);
    sesion.buscar("formulario").props.alCambiar({ cantidad: "9" });
    sesion.renderizar();
    afirmar.equal(
      sesion.buscar("formulario").props.datos.importeTotal,
      "150.01",
    );
    afirmar.match(textoTotal(), /150,01/);
    sesion.cerrar();
  },
);

function prepararModal(aceptar = true) {
  const ganchos = crearGanchos();
  const agregados = [];
  const propiedades = {
    fecha: "2026-11-02",
    excluidos: [],
    productoInicial: null,
    deshabilitado: false,
    alCerrar() {},
    alError(error) {
      throw error;
    },
    alAgregar(datos) {
      if (!aceptar) return false;
      agregados.push(datos);
      propiedades.excluidos = [...propiedades.excluidos, datos.producto.id];
      return true;
    },
  };
  const panel = { scrollTop: 0, querySelector: () => ({ focus() {} }) };
  const Modal = cargar(
    "ModalAgregarProductoCompra.tsx",
    {
      react: ganchos.ganchos,
      "@/components/ui/modal": { Modal: "modal" },
      "@/components/ui/button/Button": { default: Boton },
      "./ListaProductosAgregarCompra": { default: "lista" },
      "./FormularioProductoCompra": { default: "formulario" },
      "./VistaAgregarCompra": { default: "vista" },
      "./calculos": calculos,
      "./estilosAgregarCompra.module.css": { default: {} },
    },
    {
      requestAnimationFrame: (funcion) => {
        funcion();
        return 1;
      },
      cancelAnimationFrame() {},
    },
  ).default;
  let arbol;
  const renderizar = () => {
    ganchos.comenzar();
    arbol = Modal(propiedades);
    ganchos.referencias[1].current = panel;
    ganchos.confirmar();
    return arbol;
  };
  renderizar();
  return {
    agregados,
    propiedades,
    panel,
    renderizar,
    cerrar: ganchos.cerrar,
    buscar: (tipo) => nodos(arbol).find((nodo) => nodo.type === tipo),
    todos: () => nodos(arbol),
  };
}

prueba(
  "volver conserva datos manuales y agregar regresa a la lista con confirmacion y contador",
  () => {
    const sesion = prepararModal();
    sesion.panel.scrollTop = 150;
    sesion.buscar("lista").props.alElegir(producto);
    sesion.renderizar();
    afirmar.equal(sesion.buscar("lista").props.oculta, true);
    afirmar.equal(sesion.buscar("formulario").props.datos.cantidad, "");
    afirmar.equal(sesion.buscar("formulario").props.datos.presentacion, null);
    sesion.buscar("formulario").props.alCambiar({
      cantidad: "2.5",
      importeTotal: "30",
      presentacion: { id: 8, nombre: "Caja" },
    });
    sesion.renderizar();
    sesion.buscar("formulario").props.alVolver();
    sesion.renderizar();
    afirmar.equal(sesion.panel.scrollTop, 150);
    sesion.buscar("lista").props.alElegir(producto);
    sesion.renderizar();
    afirmar.equal(sesion.buscar("formulario").props.datos.cantidad, "2.5");
    const envio = sesion
      .todos()
      .find((nodo) => nodo.type === Boton && nodo.props.type === "submit");
    afirmar.equal(
      envio.props.form,
      sesion.buscar("formulario").props.identificador,
    );
    sesion.buscar("formulario").props.alAgregar();
    sesion.renderizar();
    afirmar.equal(sesion.agregados[0].cantidad, "2.5");
    afirmar.equal(sesion.agregados[0].presentacion.id, 8);
    afirmar.equal(sesion.buscar("formulario"), undefined);
    afirmar.equal(sesion.buscar("lista").props.oculta, false);
    afirmar.deepEqual(sesion.buscar("lista").props.excluidos, [3]);
    afirmar.ok(
      sesion
        .todos()
        .some((nodo) => nodo.props?.children === "Ver compra · 1 producto"),
    );
    afirmar.ok(
      sesion
        .todos()
        .some((nodo) => nodo.props?.children === "Agregaste Banana"),
    );
    sesion.cerrar();
  },
);

prueba(
  "un agregado rechazado conserva el formulario y la informacion ingresada",
  () => {
    const sesion = prepararModal(false);
    sesion.buscar("lista").props.alElegir(producto);
    sesion.renderizar();
    sesion.buscar("formulario").props.alCambiar({ cantidad: "7" });
    sesion.renderizar();
    sesion.buscar("formulario").props.alAgregar();
    sesion.renderizar();
    afirmar.equal(sesion.buscar("formulario").props.datos.cantidad, "7");
    afirmar.equal(sesion.buscar("lista").props.oculta, true);
    afirmar.equal(sesion.agregados.length, 0);
    sesion.cerrar();
  },
);

prueba(
  "el origen, busqueda, categoria y pagina se conservan al ocultar y volver a la lista",
  async () => {
    const ganchos = crearGanchos();
    const consultas = [];
    const propiedades = {
      fecha: "2026-11-02",
      excluidos: [],
      oculta: false,
      deshabilitado: false,
      alElegir() {},
      alError(error) {
        throw error;
      },
    };
    const Lista = cargar("ListaProductosAgregarCompra.tsx", {
      react: ganchos.ganchos,
      "@/components/productos/ImagenProducto": { default: "foto" },
      "@/components/form/input/InputField": { default: "entrada" },
      "@/components/ui/button/Button": { default: Boton },
      "./DesplegableCompra": { default: "categoria" },
      "./PaginadorCompras": { default: "paginas" },
      "./CantidadesSolicitadasCompra": { default: "cantidades" },
      "./seleccionProductosCompra": seleccion,
      "@/lib/api": {
        api: async (consulta) => {
          consultas.push(consulta);
          return { count: 12, results: [producto] };
        },
        ApiError: Error,
      },
    }).default;
    let arbol;
    const renderizar = () => {
      ganchos.comenzar();
      arbol = Lista(propiedades);
      ganchos.confirmar();
    };
    const buscar = (tipo) => nodos(arbol).find((nodo) => nodo.type === tipo);
    renderizar();
    await esperar(10);
    renderizar();
    nodos(arbol)
      .find(
        (nodo) =>
          nodo.type === "button" && nodo.props.children === "Todo el catálogo",
      )
      .props.onClick();
    renderizar();
    buscar("entrada").props.onChange({ target: { value: "Banana" } });
    renderizar();
    buscar("categoria").props.alElegir({ id: 2, nombre: "Frutas" });
    renderizar();
    await esperar(270);
    renderizar();
    buscar("paginas").props.alCambiar(2);
    renderizar();
    await esperar(270);
    renderizar();
    const antes = consultas.at(-1);
    propiedades.oculta = true;
    renderizar();
    propiedades.oculta = false;
    renderizar();
    await esperar(270);
    renderizar();
    afirmar.equal(consultas.at(-1), antes);
    const parametros = new URL(antes, "https://hortyfru.test/");
    afirmar.equal(parametros.pathname, "/compras/productos/");
    afirmar.equal(parametros.searchParams.get("buscar"), "Banana");
    afirmar.equal(parametros.searchParams.get("categoria"), "2");
    afirmar.equal(parametros.searchParams.get("pagina"), "2");
    ganchos.cerrar();
  },
);

prueba(
  "las transiciones respetan movimiento reducido y se cancelan al cambiar de vista",
  () => {
    const { animarVistaAgregarCompra } = cargar("animacionAgregarCompra.ts");
    for (const reducida of [false, true]) {
      const escuchas = new Set();
      let cancelaciones = 0,
        fotogramas,
        opciones;
      const preferencia = {
        matches: reducida,
        addEventListener: (_, funcion) => escuchas.add(funcion),
        removeEventListener: (_, funcion) => escuchas.delete(funcion),
      };
      const limpiar = animarVistaAgregarCompra(
        {
          animate: (pasos, configuracion) => {
            fotogramas = pasos;
            opciones = configuracion;
            return { cancel: () => cancelaciones++ };
          },
        },
        preferencia,
      );
      afirmar.ok(opciones.duration <= (reducida ? 100 : 250));
      afirmar.ok(
        fotogramas.every((paso) =>
          Object.keys(paso).every((clave) =>
            ["opacity", "transform"].includes(clave),
          ),
        ),
      );
      if (reducida)
        afirmar.ok(fotogramas.every((paso) => !("transform" in paso)));
      escuchas.forEach((funcion) => funcion());
      afirmar.equal(cancelaciones, 1);
      limpiar();
      afirmar.equal(escuchas.size, 0);
      afirmar.equal(cancelaciones, 2);
    }
    afirmar.doesNotThrow(animarVistaAgregarCompra({}, {}));
  },
);

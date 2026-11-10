import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

const fuente = compilador.transpileModule(
  leerArchivo(
    new URL(
      "../src/components/despachos/SelectorTransporteDespacho.tsx",
      import.meta.url,
    ),
    "utf8",
  ),
  {
    compilerOptions: {
      module: compilador.ModuleKind.CommonJS,
      target: compilador.ScriptTarget.ES2022,
      jsx: compilador.JsxEmit.ReactJSX,
    },
  },
).outputText;
const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const opciones = (desde, cantidad) =>
  Array.from({ length: cantidad }, (_, indice) => ({
    id: desde + indice,
    nombre: `Vehiculo ${desde + indice}`,
  }));

function crearSesion({ deshabilitado = false, reducido = false } = {}) {
  const almacen = [];
  let cursor = 0,
    arbol,
    valor = null;
  let efectos = [],
    composicion = [];
  const peticiones = [],
    elegidos = [],
    errores = [],
    animaciones = [];
  const preferencia = {
    matches: reducido,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const ancla = {
    focus: () => {},
    getBoundingClientRect: () => ({ top: 100 }),
  };
  const panel = {
    getBoundingClientRect: () => ({ bottom: 400 }),
    animate: (fotogramas, configuracion) => {
      const animacion = {
        fotogramas,
        configuracion,
        cancelada: false,
        cancel: () => {
          animacion.cancelada = true;
        },
      };
      animaciones.push(animacion);
      return animacion;
    },
  };
  const efecto = (funcion, dependencias, lista) => {
    const indice = cursor++;
    const anterior = almacen[indice];
    if (
      !anterior ||
      dependencias.some(
        (valor, posicion) => !Object.is(valor, anterior.dependencias[posicion]),
      )
    )
      lista.push(() => {
        anterior?.limpiar?.();
        almacen[indice] = { dependencias, limpiar: funcion() };
      });
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
    useId: () => {
      const indice = cursor++;
      return (almacen[indice] ||= `selector-${indice}`);
    },
    useCallback: (funcion) => funcion,
    useEffect: (funcion, dependencias) =>
      efecto(funcion, dependencias, efectos),
    useLayoutEffect: (funcion, dependencias) =>
      efecto(funcion, dependencias, composicion),
  };
  const dependencias = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "react-dom": {
      createPortal: (children) => ({ type: "portal", props: { children } }),
    },
    "next-intl": {
      useTranslations: (namespace) =>
        crearTraductor({ locale: "es", messages: mensajes, namespace }),
    },
    "lucide-react": {},
    "@/components/ui/button/Button": { default: "Button" },
    "@/components/compras/PaginadorOpcionesCompra": { default: "Paginador" },
    "@/components/compras/usePanelDesplegable": { default: () => {} },
    "@/lib/api": {
      ApiError: class ErrorApi extends Error {},
      api: (ruta, opciones) =>
        new Promise((resolver, rechazar) =>
          peticiones.push({ ruta, opciones, resolver, rechazar }),
        ),
    },
  };
  const exportaciones = {};
  ejecutarContexto(fuente, {
    exports: exportaciones,
    require: (ruta) => dependencias[ruta],
    URLSearchParams,
    AbortController,
    window: { matchMedia: () => preferencia },
    document: {
      body: {},
      getElementById: () => ({ scrollIntoView: () => {} }),
    },
  });
  const alElegir = (opcion) => {
    elegidos.push(opcion);
    valor = opcion;
  };
  const alError = (error) => errores.push(error);
  function todos(nodo) {
    if (!arguments.length) nodo = arbol;
    if (!nodo || typeof nodo !== "object") return [];
    return Array.isArray(nodo)
      ? nodo.flatMap((hijo) => todos(hijo))
      : [nodo, ...todos(nodo.props?.children)];
  }
  function renderizar() {
    cursor = 0;
    efectos = [];
    composicion = [];
    arbol = exportaciones.default({
      nombre: "vehiculo",
      ruta: "despachos/vehiculos/",
      etiqueta: "Vehiculo",
      opcionVacia: "Elegir vehiculo",
      valor,
      deshabilitado,
      alElegir,
      alError,
    });
    const control = todos().find((nodo) => nodo.props?.role === "combobox");
    control.props.ref.current = ancla;
    const ventana = todos().find((nodo) => nodo.type === "portal")?.props
      .children;
    if (ventana) ventana.props.ref.current = panel;
    composicion.forEach((funcion) => funcion());
    efectos.forEach((funcion) => funcion());
    return arbol;
  }
  const control = () => todos().find((nodo) => nodo.props?.role === "combobox");
  const tecla = (key) => {
    control().props.onKeyDown({
      key,
      nativeEvent: { isComposing: false },
      preventDefault: () => {},
    });
    renderizar();
  };
  const abrir = () => {
    control().props.onClick();
    renderizar();
  };
  renderizar();
  return {
    todos,
    renderizar,
    control,
    tecla,
    abrir,
    peticiones,
    elegidos,
    errores,
    animaciones,
    resolver: async (datos) => {
      peticiones.at(-1).resolver(datos);
      await esperar(0);
      renderizar();
    },
  };
}

prueba(
  "el selector abre una lista anclada sin modal ni buscador y selecciona con teclado",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    afirmar.equal(sesion.control().props["aria-expanded"], true);
    afirmar.equal(sesion.control().props["aria-haspopup"], "listbox");
    afirmar.ok(
      !sesion
        .todos()
        .some((nodo) => nodo.type === "input" || nodo.props?.role === "dialog"),
    );
    await sesion.resolver({ count: 3, results: opciones(1, 3) });
    afirmar.equal(
      sesion.todos().filter((nodo) => nodo.props?.role === "option").length,
      3,
    );
    afirmar.ok(!sesion.todos().some((nodo) => nodo.type === "Paginador"));
    sesion.tecla("ArrowDown");
    sesion.tecla("Enter");
    afirmar.equal(sesion.elegidos[0].id, 2);
    afirmar.equal(sesion.control().props["aria-expanded"], false);
  },
);

prueba(
  "la paginacion conserva diez opciones por pagina sin parametros de busqueda",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    await sesion.resolver({ count: 12, results: opciones(1, 10) });
    afirmar.ok(sesion.todos().some((nodo) => nodo.type === "Paginador"));
    sesion.tecla("PageDown");
    const parametros = new URLSearchParams(
      sesion.peticiones.at(-1).ruta.split("?")[1],
    );
    afirmar.equal(parametros.get("pagina"), "2");
    afirmar.equal(parametros.has("buscar"), false);
    afirmar.equal(
      sesion.todos().filter((nodo) => nodo.props?.role === "option").length,
      0,
    );
    await sesion.resolver({ count: 12, results: opciones(11, 2) });
    sesion.tecla("End");
    sesion.tecla("Enter");
    afirmar.equal(sesion.elegidos[0].id, 12);
  },
);

prueba(
  "Escape cancela la consulta y una respuesta tardia no reabre ni selecciona",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    const peticion = sesion.peticiones[0];
    sesion.tecla("Escape");
    afirmar.equal(peticion.opciones.signal.aborted, true);
    peticion.resolver({ count: 1, results: opciones(1, 1) });
    await esperar(0);
    sesion.renderizar();
    afirmar.equal(sesion.control().props["aria-expanded"], false);
    afirmar.equal(sesion.elegidos.length, 0);
    afirmar.equal(sesion.errores.length, 0);
  },
);

prueba(
  "movimiento reducido usa una entrada breve sin desplazamiento y deshabilitado no abre",
  () => {
    const sesion = crearSesion({ reducido: true });
    sesion.abrir();
    afirmar.ok(sesion.animaciones[0].configuracion.duration <= 100);
    afirmar.ok(
      sesion.animaciones[0].fotogramas.every((paso) => !("transform" in paso)),
    );
    sesion.tecla("Escape");
    afirmar.equal(sesion.animaciones[0].cancelada, true);
    const bloqueada = crearSesion({ deshabilitado: true });
    bloqueada.abrir();
    afirmar.equal(bloqueada.control().props["aria-expanded"], false);
    afirmar.equal(bloqueada.peticiones.length, 0);
  },
);

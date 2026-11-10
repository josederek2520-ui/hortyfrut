import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import * as jsx from "react/jsx-runtime";
import compilador from "typescript";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const bloqueoDesplazamiento = crearCargadorChofer()(
  "lib/bloqueoDesplazamiento",
);

function cargar(ruta, dependencias, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL("../src/components/" + ruta, import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: compilador.ModuleKind.CommonJS,
          jsx: compilador.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports: exportaciones,
      require: (nombre) =>
        nombre === "react/jsx-runtime" ? jsx : dependencias[nombre],
      ...entorno,
    },
  );
  return exportaciones;
}
function nodos(nodo) {
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  if (!nodo || typeof nodo !== "object") return [];
  return [nodo, ...nodos(nodo.props?.children)];
}
function prepararModal(
  posicion = "derecha",
  cuerpo = { style: { overflow: "auto" } },
) {
  const efectos = [];
  const escuchas = new Map();
  let cierres = 0;
  let pila;
  const documento = {
    body: cuerpo,
    addEventListener: (nombre, funcion) => escuchas.set(nombre, funcion),
    removeEventListener: (nombre) => escuchas.delete(nombre),
    querySelectorAll: () => pila,
  };
  const control = () => {
    const elemento = {
      focus: () => {
        documento.activeElement = elemento;
      },
      getClientRects: () => [{}],
    };
    return elemento;
  };
  const ancla = control();
  documento.activeElement = ancla;
  const titulo = control();
  const primero = control();
  const ultimo = control();
  const elementoModal = {
    querySelector: () => titulo,
    querySelectorAll: () => [primero, ultimo],
  };
  const Modal = cargar(
    "ui/modal/index.tsx",
    {
      react: {
        useRef: (valor) => ({ current: valor }),
        useEffect: (funcion) => efectos.push(funcion),
        useSyncExternalStore: () => true,
      },
      "react-dom": { createPortal: (contenido) => contenido },
      "@/icons": { CloseIcon: "IconoCerrar" },
      "@/lib/bloqueoDesplazamiento": bloqueoDesplazamiento,
    },
    { document: documento },
  ).Modal;
  const arbol = Modal({
    isOpen: true,
    onClose: () => {
      cierres += 1;
    },
    posicion,
    labelledBy: "producto",
    children: "contenido",
  });
  const dialogo = nodos(arbol).find((nodo) => nodo.props?.role === "dialog");
  dialogo.props.ref.current = elementoModal;
  pila = [elementoModal];
  const limpiezas = efectos.map((efecto) => efecto()).filter(Boolean);
  const teclado = (key, shiftKey = false) => {
    const evento = {
      key,
      shiftKey,
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
    };
    escuchas.get("keydown")(evento);
    return evento;
  };
  return {
    arbol,
    dialogo,
    documento,
    titulo,
    primero,
    ultimo,
    ancla,
    teclado,
    cierres: () => cierres,
    apilar: () => {
      pila = [elementoModal, {}];
    },
    limpiar: () => limpiezas.forEach((funcion) => funcion()),
  };
}

prueba(
  "el panel se ancla al extremo derecho y conserva el diálogo accesible",
  () => {
    const sesion = prepararModal();
    afirmar.match(sesion.arbol.props.className, /justify-end/);
    afirmar.equal(sesion.dialogo.props["aria-modal"], "true");
    afirmar.equal(sesion.dialogo.props["aria-labelledby"], "producto");
    afirmar.equal(sesion.documento.activeElement, sesion.titulo);
    afirmar.equal(sesion.documento.body.style.overflow, "hidden");
    sesion.limpiar();
    afirmar.equal(sesion.documento.activeElement, sesion.ancla);
    afirmar.equal(sesion.documento.body.style.overflow, "auto");
  },
);

prueba("Tab contiene el foco y Escape solo cierra el diálogo superior", () => {
  const sesion = prepararModal();
  sesion.documento.activeElement = sesion.ultimo;
  afirmar.equal(sesion.teclado("Tab").defaultPrevented, true);
  afirmar.equal(sesion.documento.activeElement, sesion.primero);
  afirmar.equal(sesion.teclado("Tab", true).defaultPrevented, true);
  afirmar.equal(sesion.documento.activeElement, sesion.ultimo);
  sesion.teclado("Escape");
  afirmar.equal(sesion.cierres(), 1);
  sesion.apilar();
  sesion.teclado("Escape");
  afirmar.equal(sesion.cierres(), 1);
  sesion.limpiar();
});

prueba(
  "el producto usa una región de trabajo sin un diálogo superpuesto",
  () => {
    const Vista = cargar("preparaciones/VistaProductoPreparacion.tsx", {
      "./VistaAnimadaPreparacion": { default: "VistaAnimadaPreparacion" },
      "./estilosTrabajo.module.css": { default: {} },
    }).default;
    const vista = Vista({ children: "formulario" });
    const region = vista.props.children;
    afirmar.equal(vista.type, "VistaAnimadaPreparacion");
    afirmar.equal(region.type, "section");
    afirmar.equal(
      region.props["aria-labelledby"],
      "nombre-producto-preparacion",
    );
    afirmar.equal(region.props["aria-modal"], undefined);
    afirmar.equal(region.props.children, "formulario");
  },
);

prueba("los modales existentes conservan su posición centrada", () => {
  const sesion = prepararModal("centro");
  afirmar.match(sesion.arbol.props.className, /justify-center/);
  afirmar.match(sesion.dialogo.props.className, /rounded-3xl/);
  sesion.limpiar();
});

prueba(
  "volver del recorrido con dos diálogos abiertos libera el desplazamiento del historial",
  () => {
    const panel = prepararModal();
    const confirmacion = prepararModal("centro", panel.documento.body);
    panel.limpiar();
    afirmar.equal(panel.documento.body.style.overflow, "hidden");
    confirmacion.limpiar();
    afirmar.equal(panel.documento.body.style.overflow, "auto");
  },
);

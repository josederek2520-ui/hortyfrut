import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

function montarDisposicion({ altura = 72, superior = 16 } = {}) {
  const efectos = [];
  const eventos = new Map();
  const propiedades = new Map();
  const medidas = { altura, superior };
  let observador;
  const barra = {
    getBoundingClientRect: () => ({ height: medidas.altura }),
  };
  const contenedor = {
    querySelector: () => barra,
    style: {
      setProperty: (nombre, valor) => propiedades.set(nombre, valor),
      removeProperty: (nombre) => propiedades.delete(nombre),
    },
  };
  const cargar = crearCargadorChofer(
    {
      react: {
        useRef: () => ({ current: null }),
        useLayoutEffect: (efecto) => efectos.push(efecto),
      },
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "@/context/SidebarContext": {
        useSidebar: () => ({
          isExpanded: true,
          isHovered: false,
          isMobileOpen: false,
        }),
      },
      "@/layout/AppHeader": { default: "Cabecera" },
      "@/layout/AppSidebar": { default: "Menu" },
      "@/layout/Backdrop": { default: "Velo" },
    },
    {
      getComputedStyle: () => ({ top: String(medidas.superior) + "px" }),
      window: {
        addEventListener: (nombre, funcion) => eventos.set(nombre, funcion),
        removeEventListener: (nombre, funcion) => {
          if (eventos.get(nombre) === funcion) eventos.delete(nombre);
        },
      },
      ResizeObserver: class {
        constructor(funcion) {
          observador = { actualizar: funcion, desconectado: false };
        }
        observe(elemento) {
          afirmar.equal(elemento, barra);
        }
        disconnect() {
          observador.desconectado = true;
        }
      },
    },
  );
  const Disposicion = cargar("layout/DisposicionAplicacion").default;
  const vista = Disposicion({ children: "Producto" });
  vista.props.children[2].props.ref.current = contenedor;
  const limpiar = efectos[0]();
  return { propiedades, medidas, eventos, observador, limpiar };
}

prueba(
  "reserva la barra real y su separación antes de abrir el producto",
  () => {
    const sesion = montarDisposicion({ altura: 72.25, superior: 16 });
    afirmar.equal(sesion.propiedades.get("--limite-barra-aplicacion"), "89px");
    sesion.limpiar();
  },
);

prueba(
  "la cuenta móvil ampliada y los cambios de tamaño actualizan el espacio",
  () => {
    const sesion = montarDisposicion();
    sesion.medidas.altura = 156;
    sesion.medidas.superior = 12;
    sesion.observador.actualizar();
    afirmar.equal(sesion.propiedades.get("--limite-barra-aplicacion"), "168px");
    sesion.medidas.altura = 72;
    sesion.medidas.superior = 16;
    sesion.eventos.get("resize")();
    afirmar.equal(sesion.propiedades.get("--limite-barra-aplicacion"), "88px");
    sesion.limpiar();
  },
);

prueba("desmontar retira la medición y sus observadores", () => {
  const sesion = montarDisposicion();
  sesion.limpiar();
  afirmar.equal(sesion.propiedades.size, 0);
  afirmar.equal(sesion.eventos.size, 0);
  afirmar.equal(sesion.observador.desconectado, true);
});

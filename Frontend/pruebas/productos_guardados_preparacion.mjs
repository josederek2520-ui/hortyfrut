import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const nodos = (nodo) => {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  return [nodo, ...nodos(nodo.props?.children)];
};

for (const idioma of ["es", "en"]) {
  prueba(
    `distingue guardados, anotados sin guardar y productos nuevos en ${idioma}`,
    () => {
      const mensajes = JSON.parse(
        leerArchivo(
          new URL(`../src/messages/${idioma}.json`, import.meta.url),
          "utf8",
        ),
      );
      const t = crearTraductor({
        locale: idioma,
        messages: mensajes,
        namespace: "preparaciones",
      });
      const dependencias = {
        "react/jsx-runtime": {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        },
        "next-intl": { useTranslations: () => t },
        "lucide-react": {
          ArrowRight: "Flecha",
          CircleCheck: "Guardado",
          Search: "Buscar",
          PackageSearch: "Vacio",
        },
        "@/components/compras/tipos": { clasePanel: "panel" },
      };
      for (const ruta of [
        "@/components/form/input/InputField",
        "@/components/ui/button/Button",
        "@/components/productos/ImagenProducto",
        "@/components/compras/DesplegableCompra",
        "@/components/compras/PaginadorCompras",
        "./CantidadesPedidoPreparacion",
        "./CargaTrabajoPreparacion",
      ])
        dependencias[ruta] = { default: ruta.split("/").at(-1) };
      const Lista = crearCargadorChofer(dependencias)(
        "components/preparaciones/ListaProductosPreparacion",
      ).default;
      const productos = ["Banana", "Papaya", "Pepino"].map(
        (nombre, indice) => ({ id: indice + 1, nombre }),
      );
      const guardada = {
        asignaciones: [{ producto: 1 }],
        lineas: [],
        cajillas: [],
      };
      const elegidos = [];
      const representar = (persistida) =>
        Lista({
          modelo: {
            filas: productos,
            vista: "todos",
            total: 3,
            cargando: false,
            fallo: false,
          },
          documento: {
            asignaciones: { 2: { producto: 2, cantidad: "1", aportes: {} } },
            lineas: [],
            cajillas: [],
          },
          guardada: persistida,
          ocupado: false,
          alElegir: (producto) => elegidos.push(producto.id),
          alError: () => {},
        });
      const arbol = representar(guardada);
      const boton = (raiz, id) =>
        nodos(raiz).find(
          (nodo) => nodo.props?.["data-producto-preparacion"] === id,
        );
      const fila = (raiz, id) =>
        nodos(raiz).find(
          (nodo) => nodo.props?.role === "row" && boton(nodo, id),
        );
      afirmar.equal(fila(arbol, 1).props["data-guardado"], true);
      afirmar.equal(
        boton(arbol, 1).props.children,
        idioma === "es" ? "Editar" : "Edit",
      );
      afirmar.equal(
        boton(arbol, 1).props["aria-label"],
        t("editarProductoAccesible", { producto: "Banana" }),
      );
      afirmar.ok(
        nodos(fila(arbol, 1)).some(
          (nodo) =>
            Array.isArray(nodo.props?.children) &&
            nodo.props.children.includes(t("productoGuardadoTrabajo")),
        ),
      );
      afirmar.equal(fila(arbol, 2).props["data-guardado"], undefined);
      afirmar.equal(
        boton(arbol, 2).props.children,
        t("continuarProductoTrabajo"),
      );
      afirmar.equal(fila(arbol, 3).props["data-guardado"], undefined);
      afirmar.equal(boton(arbol, 3).props.children, t("prepararTrabajo"));
      boton(arbol, 1).props.onClick();
      afirmar.deepEqual(elegidos, [1]);
      afirmar.equal(
        fila(representar(undefined), 1).props["data-guardado"],
        undefined,
      );
    },
  );
}

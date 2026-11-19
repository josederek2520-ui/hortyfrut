import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leer } from "node:fs";
import { setTimeout as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargar = crearCargadorChofer();
const calculos = cargar("components/entregas/calculosEntrega");
const mensajes = JSON.parse(
  leer(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const t = crearTraductor({
  locale: "es",
  messages: mensajes,
  namespace: "entregas",
});
const producto = {
  producto: 1,
  nombre: "Banana",
  cajas: 1,
  unidades: 0,
  peso_kg: "0.3",
  aportes: [
    { carga: 1, lote: 1, codigo_lote: "L1", preparacion: "P1", peso_kg: "0.1" },
    { carga: 2, lote: 2, codigo_lote: "L2", preparacion: "P1", peso_kg: "0.2" },
  ],
};
const linea = {
  ...calculos.lineaVacia(),
  cajas_recibidas: "1",
  unidades_recibidas: "0",
  peso_recibido_kg: "0.3",
};

function crearReact() {
  const memorias = [];
  let cursor = 0,
    efectos = [];
  const react = {
    useState(inicial) {
      const indice = cursor++;
      if (!(indice in memorias))
        memorias[indice] = typeof inicial === "function" ? inicial() : inicial;
      return [
        memorias[indice],
        (valor) => {
          memorias[indice] =
            typeof valor === "function" ? valor(memorias[indice]) : valor;
        },
      ];
    },
    useRef(inicial) {
      const indice = cursor++;
      memorias[indice] ??= { current: inicial };
      return memorias[indice];
    },
    useCallback(funcion, dependencias) {
      const indice = cursor++;
      if (
        !memorias[indice] ||
        dependencias.some(
          (valor, posicion) =>
            !Object.is(valor, memorias[indice].dependencias[posicion]),
        )
      )
        memorias[indice] = { funcion, dependencias };
      return memorias[indice].funcion;
    },
    useEffect(funcion, dependencias) {
      const indice = cursor++;
      const anterior = memorias[indice];
      if (
        !anterior ||
        dependencias.some(
          (valor, posicion) =>
            !Object.is(valor, anterior.dependencias[posicion]),
        )
      )
        efectos.push(() => {
          anterior?.limpiar?.();
          memorias[indice] = { dependencias, limpiar: funcion() };
        });
    },
  };
  return {
    react,
    dibujar(funcion) {
      cursor = 0;
      efectos = [];
      const resultado = funcion();
      efectos.forEach((efecto) => efecto());
      return resultado;
    },
    cerrar() {
      memorias.forEach((valor) => valor?.limpiar?.());
    },
  };
}
function encontrar(nodo, condicion) {
  if (!nodo || typeof nodo !== "object") return null;
  if (condicion(nodo)) return nodo;
  for (const hijo of React.Children.toArray(nodo.props?.children)) {
    const resultado = encontrar(hijo, condicion);
    if (resultado) return resultado;
  }
  return null;
}

prueba(
  "los pendientes incluyen todos los productos y no exigen repartir un aporte único",
  () => {
    const productos = [
      producto,
      { ...producto, producto: 11 },
      { ...producto, producto: 12, aportes: [producto.aportes[0]] },
    ];
    const lineas = { 1: linea, 11: linea, 12: linea };
    const aportes = {
      "1-1": {
        carga: 1,
        lote: 1,
        peso_recibido_kg: "0.1",
        peso_rechazado_kg: "0",
      },
      "2-2": {
        carga: 2,
        lote: 2,
        peso_recibido_kg: "0.2",
        peso_rechazado_kg: "0",
      },
    };
    const original = JSON.stringify(aportes);
    afirmar.equal(
      calculos.pendientesConciliacionEntrega(productos, lineas, aportes).length,
      0,
    );
    const incompleto = {
      ...producto,
      producto: 11,
      aportes: [{ ...producto.aportes[0], carga: 3 }, producto.aportes[1]],
    };
    afirmar.deepEqual(
      Array.from(
        calculos.pendientesConciliacionEntrega(
          [producto, incompleto, productos[2]],
          lineas,
          aportes,
        ),
        (fila) => fila.producto,
      ),
      [11],
    );
    afirmar.equal(JSON.stringify(aportes), original);
  },
);

prueba(
  "cambiar página o cerrar el panel aborta consultas y oculta respuestas anteriores",
  async () => {
    const entorno = crearReact(),
      peticiones = [];
    const cargador = crearCargadorChofer({
      react: entorno.react,
      "@/lib/api": {
        api: (ruta, opciones) =>
          new Promise((resolver, rechazar) =>
            peticiones.push({ ruta, opciones, resolver, rechazar }),
          ),
      },
    });
    const usar = cargador("components/entregas/useConsultaEntrega").default;
    let ruta = null;
    const dibujar = () => entorno.dibujar(() => usar(ruta));
    afirmar.equal(dibujar().cargando, false);
    ruta = "entregas/7/pedidos/1/productos/?pagina=1";
    dibujar();
    await esperar(0);
    ruta = "entregas/7/pedidos/1/productos/?pagina=2";
    afirmar.equal(dibujar().datos, null);
    afirmar.equal(peticiones[0].opciones.signal.aborted, true);
    await esperar(0);
    peticiones[0].resolver({ pagina: 1 });
    peticiones[1].resolver({ pagina: 2 });
    await esperar(0);
    afirmar.equal(dibujar().datos.pagina, 2);
    ruta = "entregas/7/pedidos/1/productos/?pagina=3";
    dibujar();
    await esperar(0);
    ruta = null;
    afirmar.equal(dibujar().datos, null);
    afirmar.equal(peticiones[2].opciones.signal.aborted, true);
    peticiones[2].resolver({ pagina: 3 });
    await esperar(0);
    afirmar.equal(dibujar().datos, null);
    afirmar.ok(peticiones.every((peticion) => !peticion.opciones.method));
    entorno.cerrar();
  },
);

prueba(
  "un fallo de consulta se reintenta con la misma ruta sin crear operaciones",
  async () => {
    const entorno = crearReact(),
      peticiones = [];
    const cargador = crearCargadorChofer({
      react: entorno.react,
      "@/lib/api": {
        api: (ruta, opciones) =>
          new Promise((resolver, rechazar) =>
            peticiones.push({ ruta, opciones, resolver, rechazar }),
          ),
      },
    });
    const usar = cargador("components/entregas/useConsultaEntrega").default;
    const dibujar = () =>
      entorno.dibujar(() =>
        usar("entregas/7/pedidos/1/aportes/?producto=11&pagina=2"),
      );
    dibujar();
    await esperar(0);
    peticiones[0].rechazar(new Error("Sin conexión"));
    await esperar(0);
    const fallido = dibujar();
    afirmar.equal(fallido.fallo, true);
    fallido.reintentar();
    afirmar.equal(dibujar().cargando, true);
    await esperar(0);
    peticiones[1].resolver({ count: 1, results: [] });
    await esperar(0);
    afirmar.equal(dibujar().fallo, false);
    afirmar.equal(peticiones[0].ruta, peticiones[1].ruta);
    afirmar.ok(peticiones.every((peticion) => !peticion.opciones.method));
    entorno.cerrar();
  },
);

prueba(
  "cerrar conserva producto, página de aportes, búsqueda y anotaciones sin guardar",
  () => {
    const entorno = crearReact(),
      rutas = [];
    const productos = Array.from({ length: 12 }, (_, indice) => ({
      ...producto,
      producto: indice + 1,
      nombre: "Producto " + (indice + 1),
    }));
    const propiedades = {
      abierto: true,
      tipo: "lotes",
      productoElegido: 11,
      ruta: "entregas/7/pedidos/1/",
      hoja: { origen: { productos } },
      lineas: { 11: linea },
      aportes: {},
      oficina: true,
      soloLectura: false,
      bloqueado: false,
      errores: {},
      alProducto: (valor) => {
        propiedades.productoElegido = valor;
      },
      alCambiarAportes: (valor) => {
        propiedades.aportes = valor;
      },
      alCerrar: () => {
        propiedades.abierto = false;
      },
    };
    const cargador = crearCargadorChofer(
      {
        react: entorno.react,
        "react/jsx-runtime": jsx,
        "next-intl": { useTranslations: () => t, useLocale: () => "es" },
        "lucide-react": new Proxy({}, { get: () => () => null }),
        "@/components/ui/modal": { Modal: "Dialogo" },
        "@/components/ui/button/Button": { default: "Boton" },
        "@/components/productos/ImagenProducto": { default: "Imagen" },
        "@/components/pedidos/PaginadorPedidos": { default: "Paginas" },
        "./ConciliacionLotesEntrega": { default: "Conciliacion" },
        "./ReferenciaPedidoEntrega": { default: "Referencia" },
        "./useConsultaEntrega": {
          default: (ruta) => {
            rutas.push(ruta);
            const pagina = Number(ruta?.match(/pagina=(\d+)/)?.[1] ?? 1);
            return {
              datos: ruta
                ? {
                    count: 12,
                    results: productos.slice((pagina - 1) * 10, pagina * 10),
                  }
                : null,
              cargando: false,
              fallo: false,
            };
          },
        },
      },
      { URLSearchParams },
    );
    const Panel = cargador("components/entregas/PanelRecepcionEntrega").default;
    const dibujar = () => entorno.dibujar(() => Panel(propiedades));
    let arbol = dibujar();
    afirmar.match(rutas.at(-1), /pagina=2/);
    encontrar(arbol, (nodo) => nodo.type === "Conciliacion").props.alPagina(2);
    const anotado = {
      "1-1": {
        carga: 1,
        lote: 1,
        peso_recibido_kg: "0.123",
        peso_rechazado_kg: "0",
      },
    };
    encontrar(arbol, (nodo) => nodo.type === "Conciliacion").props.alCambiar(
      anotado,
    );
    encontrar(
      arbol,
      (nodo) =>
        nodo.type === "Boton" && nodo.props.children === t("listoPanel"),
    ).props.onClick();
    arbol = dibujar();
    afirmar.equal(arbol.props.isOpen, false);
    afirmar.equal(rutas.at(-1), null);
    propiedades.abierto = true;
    arbol = dibujar();
    const conciliacion = encontrar(
      arbol,
      (nodo) => nodo.type === "Conciliacion",
    );
    afirmar.equal(conciliacion.props.producto.producto, 11);
    afirmar.equal(conciliacion.props.pagina, 2);
    afirmar.equal(conciliacion.props.aportes, anotado);
    propiedades.tipo = "pedido";
    arbol = dibujar();
    encontrar(arbol, (nodo) => nodo.type === "input").props.onChange({
      target: { value: "Papaya" },
    });
    arbol = dibujar();
    encontrar(arbol, (nodo) => nodo.type === "Paginas").props.alCambiar(2);
    propiedades.alCerrar();
    dibujar();
    propiedades.abierto = true;
    dibujar();
    afirmar.match(rutas.at(-1), /pagina=2&buscar=Papaya/);
    propiedades.tipo = "lotes";
    propiedades.oficina = false;
    arbol = dibujar();
    afirmar.equal(arbol.props.isOpen, false);
    afirmar.equal(rutas.at(-1), null);
    entorno.cerrar();
  },
);

for (const soloLectura of [false, true]) {
  prueba(
    `los lotes están abiertos y conservan las mediciones sin repartir automáticamente: ${soloLectura ? "consulta" : "edición"}`,
    () => {
      const cargador = crearCargadorChofer({
        react: React,
        "react/jsx-runtime": jsx,
        "next-intl": { useTranslations: () => t, useLocale: () => "es" },
        "./useConsultaEntrega": {
          default: () => ({
            datos: { count: 2, results: producto.aportes },
            cargando: false,
            fallo: false,
          }),
        },
      });
      const Conciliacion = cargador(
        "components/entregas/ConciliacionLotesEntrega",
      ).default;
      const html = representar(
        React.createElement(Conciliacion, {
          ruta: "entregas/7/pedidos/1/",
          producto,
          aportes: {},
          bloqueado: soloLectura,
          soloLectura,
          linea,
          pagina: 1,
          alPagina() {},
          alCambiar() {
            afirmar.fail("Consultar no debe repartir pesos");
          },
        }),
      );
      afirmar.doesNotMatch(html, /<details|<summary/);
      if (soloLectura) afirmar.doesNotMatch(html, /<input/);
      else {
        afirmar.match(html, /<input/);
        afirmar.match(html, /value=""/);
      }
    },
  );
}

prueba("un error del aporte once selecciona su segunda página", async () => {
  const entorno = crearReact();
  let paginaSolicitada;
  const aportes = Array.from({ length: 11 }, (_, indice) => ({
    ...producto.aportes[0],
    carga: indice + 1,
    lote: indice + 1,
  }));
  const anotados = Object.fromEntries(
    aportes
      .slice(0, 10)
      .map((aporte) => [
        `${aporte.carga}-${aporte.lote}`,
        { ...aporte, peso_recibido_kg: "0.1", peso_rechazado_kg: "0" },
      ]),
  );
  const cargador = crearCargadorChofer({
    react: entorno.react,
    "react/jsx-runtime": jsx,
    "next-intl": { useTranslations: () => t, useLocale: () => "es" },
    "./useConsultaEntrega": {
      default: () => ({ cargando: true, datos: null, fallo: false }),
    },
  });
  const Conciliacion = cargador(
    "components/entregas/ConciliacionLotesEntrega",
  ).default;
  entorno.dibujar(() =>
    Conciliacion({
      ruta: "entregas/7/pedidos/1/",
      producto: { ...producto, aportes },
      aportes: anotados,
      bloqueado: false,
      linea,
      pagina: 1,
      error: ["conciliacionIncompleta"],
      alPagina: (pagina) => {
        paginaSolicitada = pagina;
      },
      alCambiar() {},
    }),
  );
  await esperar(0);
  afirmar.equal(paginaSolicitada, 2);
  entorno.cerrar();
});

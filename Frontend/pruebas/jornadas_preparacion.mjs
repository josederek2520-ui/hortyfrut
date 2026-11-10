import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import * as jsx from "react/jsx-runtime";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const traducciones = {
  useTranslations: (namespace) =>
    crearTraductor({ locale: "es", messages: mensajes, namespace }),
  useLocale: () => "es",
};
function cargar(nombre, dependencias = {}, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/preparaciones/${nombre}`, import.meta.url),
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
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        if (ruta === "react/jsx-runtime") return jsx;
        if (ruta === "next-intl") return traducciones;
        return { default: ruta.endsWith(".css") ? {} : ruta.split("/").at(-1) };
      },
      ...entorno,
    },
  );
  return exportaciones;
}
const permisos = {
  ver: true,
  crear: true,
  editar: true,
  confirmar: true,
  cancelar: true,
};
const grupo = {
  cliente: 12,
  cliente_nombre: "Hipermaxi",
  cliente_activo: true,
  fecha_pedidos: "2026-10-31",
  pedidos: 5,
  sucursales: 3,
  productos: 4,
  borradores: 0,
  confirmadas: 0,
  canceladas: 0,
  borrador_id: null,
  estado: "pendiente",
};
const acciones = cargar("accionesJornadaPreparacion.ts");
function nodos(nodo) {
  if (!nodo || typeof nodo !== "object") return [];
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  return [nodo, ...nodos(nodo.props?.children)];
}
function crearGanchos() {
  const estados = [],
    efectos = [];
  let indiceEstado, indiceEfecto, pendientes;
  return {
    ganchos: {
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
    },
    comenzar() {
      indiceEstado = indiceEfecto = 0;
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

prueba(
  "cada grupo ofrece una accion autorizada y varios borradores nunca eligen uno arbitrario",
  () => {
    afirmar.equal(
      acciones.accionJornadaPreparacion(grupo, permisos).tipo,
      "preparar",
    );
    const borrador = { ...grupo, borradores: 1, borrador_id: 8 };
    afirmar.equal(
      acciones.accionJornadaPreparacion(borrador, permisos).ruta,
      "/preparaciones/8/editar",
    );
    afirmar.equal(
      acciones.accionJornadaPreparacion(
        { ...borrador, borradores: 2 },
        permisos,
      ).tipo,
      "ver",
    );
    afirmar.equal(
      acciones.accionJornadaPreparacion(borrador, {
        ...permisos,
        editar: false,
      }).tipo,
      "ver",
    );
    afirmar.equal(
      acciones.accionJornadaPreparacion(grupo, { ...permisos, crear: false })
        .tipo,
      "ver",
    );
    afirmar.equal(
      acciones.accionJornadaPreparacion(
        { ...borrador, estado: "preparado" },
        permisos,
      ).tipo,
      "ver",
    );
    afirmar.equal(
      acciones.accionJornadaPreparacion(
        { ...grupo, cliente_activo: false },
        permisos,
      ).tipo,
      "ver",
    );
  },
);

function prepararGestion(inicial = {}) {
  const ganchos = crearGanchos();
  const avisos = [];
  const Gestion = cargar("GestionPreparaciones.tsx", {
    react: { ...ganchos.ganchos, useEffect() {} },
    "@/components/compras/tipos": { clasePanel: "panel" },
    "./useAvisosPreparaciones": {
      default: () => ({
        avisos: [],
        cerrarAviso() {},
        tratarError(error) {
          throw error;
        },
        notificar: (texto) => avisos.push(texto),
      }),
    },
  }).default;
  let arbol;
  const renderizar = () => {
    ganchos.comenzar();
    arbol = Gestion({
      sesion: { permisos_preparaciones: permisos },
      ...inicial,
    });
    return arbol;
  };
  renderizar();
  const buscar = (tipo) => nodos(arbol).find((nodo) => nodo.type === tipo);
  return {
    buscar,
    renderizar,
    avisos,
    boton: (texto) =>
      nodos(arbol).find((nodo) =>
        [nodo.props?.children].flat(Infinity).includes(texto),
      ),
  };
}

prueba(
  "la entrada principal muestra grupos y preparar abre la jornada sin crear cantidades",
  () => {
    const sesion = prepararGestion();
    afirmar.equal(
      sesion.buscar("ListadoJornadasPreparacion").props.activo,
      true,
    );
    afirmar.equal(sesion.buscar("JornadaPreparacion"), undefined);
    sesion.boton("Preparar pedidos").props.onClick();
    sesion.renderizar();
    afirmar.equal(
      sesion.buscar("ListadoJornadasPreparacion").props.activo,
      false,
    );
    afirmar.equal(
      sesion.buscar("JornadaPreparacion").props.clienteInicial,
      undefined,
    );
    afirmar.equal(
      sesion.buscar("JornadaPreparacion").props.fechaInicial,
      undefined,
    );
  },
);

prueba(
  "abrir y preparar un grupo conservan su cliente y fecha sin separar sucursales",
  () => {
    const sesion = prepararGestion();
    sesion.buscar("ListadoJornadasPreparacion").props.alAbrir(grupo);
    sesion.renderizar();
    afirmar.equal(sesion.buscar("DetalleJornadaPreparacion").props.cliente, 12);
    afirmar.equal(
      sesion.buscar("DetalleJornadaPreparacion").props.fecha,
      "2026-10-31",
    );
    sesion.buscar("DetalleJornadaPreparacion").props.alPreparar(grupo);
    sesion.renderizar();
    afirmar.equal(sesion.buscar("JornadaPreparacion").props.clienteInicial, 12);
    afirmar.equal(
      sesion.buscar("JornadaPreparacion").props.fechaInicial,
      "2026-10-31",
    );
  },
);

prueba(
  "volver protege cambios sin guardar y permanece bloqueado durante el guardado",
  () => {
    const sesion = prepararGestion();
    sesion.buscar("ListadoJornadasPreparacion").props.alPreparar(grupo);
    sesion.renderizar();
    sesion
      .buscar("JornadaPreparacion")
      .props.alEstadoTrabajo({ modificado: true, guardando: true });
    sesion.renderizar();
    afirmar.equal(sesion.boton("Volver al listado").props.disabled, true);
    sesion.boton("Volver al listado").props.onClick();
    sesion.renderizar();
    afirmar.equal(sesion.buscar("DialogoTrabajoPreparacion"), undefined);
    sesion
      .buscar("JornadaPreparacion")
      .props.alEstadoTrabajo({ modificado: true, guardando: false });
    sesion.renderizar();
    sesion.boton("Volver al listado").props.onClick();
    sesion.renderizar();
    afirmar.ok(sesion.buscar("JornadaPreparacion"));
    sesion.buscar("DialogoTrabajoPreparacion").props.alCerrar();
    sesion.renderizar();
    afirmar.ok(sesion.buscar("JornadaPreparacion"));
    sesion.boton("Volver al listado").props.onClick();
    sesion.renderizar();
    sesion.buscar("DialogoTrabajoPreparacion").props.alConfirmar();
    sesion.renderizar();
    afirmar.equal(sesion.buscar("JornadaPreparacion"), undefined);
    afirmar.equal(
      sesion.buscar("ListadoJornadasPreparacion").props.activo,
      true,
    );
    afirmar.equal(
      sesion.buscar("ListadoJornadasPreparacion").props.revision,
      1,
    );
  },
);

prueba(
  "confirmar vuelve al listado y renueva datos sin perder el componente de filtros",
  () => {
    const sesion = prepararGestion();
    sesion.buscar("ListadoJornadasPreparacion").props.alPreparar(grupo);
    sesion.renderizar();
    sesion.buscar("JornadaPreparacion").props.alConfirmada();
    sesion.renderizar();
    afirmar.equal(
      sesion.buscar("ListadoJornadasPreparacion").props.revision,
      1,
    );
    afirmar.equal(sesion.avisos.length, 1);
    afirmar.equal(sesion.buscar("JornadaPreparacion"), undefined);
    const directa = prepararGestion({
      clienteInicial: 12,
      fechaInicial: "2026-10-31",
    });
    afirmar.equal(
      directa.buscar("DetalleJornadaPreparacion").props.cliente,
      12,
    );
  },
);

prueba(
  "el grupo permite consultar pedidos sin crear y mantiene las operaciones en su cliente y fecha",
  () => {
    let abierto = false;
    const Detalle = cargar("DetalleJornadaPreparacion.tsx", {
      react: { useId: () => "resumen-grupo" },
      "@/components/ui/modal": { Modal: "Modal" },
      "@/hooks/useModal": {
        useModal: () => ({
          isOpen: abierto,
          openModal: () => {
            abierto = true;
          },
          closeModal() {},
        }),
      },
      "@/components/compras/tipos": { clasePanel: "panel" },
      "@/components/compras/calculos": { mostrarFecha: (fecha) => fecha },
      "./accionesJornadaPreparacion": acciones,
      "./useConsultaPreparacion": {
        default: () => ({
          datos: { count: 1, results: [grupo] },
          cargando: false,
          fallo: false,
        }),
      },
    }).default;
    const propiedades = {
      cliente: 12,
      fecha: "2026-10-31",
      permisos: { ...permisos, crear: false, editar: false },
      alPreparar() {
        throw new Error("No debe preparar");
      },
      alError() {},
    };
    let arbol = Detalle(propiedades);
    afirmar.equal(
      nodos(arbol).some((nodo) => nodo.props?.children === "Preparar"),
      false,
    );
    const historial = nodos(arbol).find(
      (nodo) => nodo.type === "HistorialPreparaciones",
    );
    afirmar.equal(historial.props.clienteFijo, 12);
    afirmar.equal(historial.props.fechaFija, "2026-10-31");
    nodos(arbol)
      .find(
        (nodo) =>
          nodo.props?.children === mensajes.preparaciones.verResumenPedidos,
      )
      .props.onClick();
    arbol = Detalle(propiedades);
    const hoja = nodos(arbol).find((nodo) => nodo.type === "HojaConsolidada");
    afirmar.equal(hoja.props.soloConsulta, true);
    afirmar.equal(hoja.props.puedeCrear, false);
    afirmar.equal(hoja.props.clienteInicial, 12);
  },
);

prueba(
  "las preparaciones del grupo siempre filtran por cliente y fecha en el servidor",
  () => {
    const ganchos = crearGanchos();
    let consulta;
    const Historial = cargar("HistorialPreparaciones.tsx", {
      react: ganchos.ganchos,
      "@/components/compras/tipos": {
        clasePanel: "panel",
        claseEstado: () => "estado",
      },
      "@/components/inventario/tipos": { claseSelectorInventario: "selector" },
      "./useConsultaPreparacion": {
        default: (ruta) => {
          consulta = ruta;
          return {
            datos: { count: 0, results: [] },
            cargando: false,
            fallo: false,
          };
        },
      },
    }).default;
    ganchos.comenzar();
    Historial({
      clienteFijo: 12,
      fechaFija: "2026-10-31",
      permisos,
      alError() {},
    });
    const parametros = new URL(consulta, "https://hortyfru.test/").searchParams;
    afirmar.equal(parametros.get("cliente"), "12");
    afirmar.equal(parametros.get("fecha_pedidos"), "2026-10-31");
    afirmar.equal(parametros.get("pagina"), "1");
  },
);

prueba(
  "una respuesta de filtros anteriores se cancela y la revision externa renueva el mismo listado",
  async () => {
    const ganchos = crearGanchos();
    const peticiones = [];
    const consultarEstado = cargar(
      "useConsultaPreparacion.ts",
      {
        react: ganchos.ganchos,
        "@/lib/api": {
          api: (ruta, opciones) =>
            new Promise((resolver) =>
              peticiones.push({ ruta, opciones, resolver }),
            ),
        },
      },
      { window: { setTimeout, clearTimeout } },
    ).default;
    const errores = [];
    const alError = (error) => errores.push(error);
    const renderizar = (ruta, revision = 0) => {
      ganchos.comenzar();
      const estado = consultarEstado(ruta, alError, revision);
      ganchos.confirmar();
      return estado;
    };
    renderizar("preparaciones/jornadas/?pagina=1");
    await esperar(5);
    renderizar("preparaciones/jornadas/?pagina=2");
    await esperar(5);
    afirmar.equal(peticiones[0].opciones.signal.aborted, true);
    peticiones[0].resolver({ count: 1, results: [grupo] });
    await esperar(0);
    afirmar.equal(renderizar("preparaciones/jornadas/?pagina=2").datos, null);
    peticiones[1].resolver({
      count: 12,
      results: [{ ...grupo, fecha_pedidos: "2026-10-30" }],
    });
    await esperar(0);
    afirmar.equal(
      renderizar("preparaciones/jornadas/?pagina=2").datos.count,
      12,
    );
    afirmar.equal(
      renderizar("preparaciones/jornadas/?pagina=2", 1).datos,
      null,
    );
    await esperar(5);
    afirmar.equal(peticiones.length, 3);
    afirmar.equal(errores.length, 0);
    ganchos.cerrar();
  },
);

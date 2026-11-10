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

function cargar(nombre, dependencias = {}, entorno = {}) {
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
      require: (ruta) =>
        ruta in dependencias
          ? dependencias[ruta]
          : { default: ruta.endsWith(".css") ? {} : ruta.split("/").at(-1) },
      ...entorno,
    },
  );
  return exportaciones;
}
const navegacion = cargar("navegacionFormularioDespacho.ts");
const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const carga = {
  id: 91,
  sucursal: 5,
  producto: 2,
  producto_nombre: "Banana",
  sucursal_nombre: "Centro",
  cliente_nombre: "Hipermaxi",
  columna: "cajas",
  cantidad: 3,
  peso_kg: "12.750",
  aportes: [{ lote: 2, cantidad: "12.750", unidad: "kg", peso_kg: "12.750" }],
};
const permisos = {
  ver: true,
  crear: true,
  editar: true,
  enviar: true,
  iniciar: true,
  recorrido: true,
  finalizar: true,
  cancelar: true,
};
const borrador = (version = "v2") => ({
  id: 7,
  codigo: "DES-000007",
  version,
  almacen: 1,
  almacen_nombre: "Central",
  vehiculo: 2,
  vehiculo_placa: "1234-ABC",
  vehiculo_capacidad_kg: "2000.000",
  chofer: 3,
  chofer_nombre: "Jose",
  fecha_reparto: "2026-10-29",
  observaciones: "",
  cargas: [{ ...carga, id: 100, asignacion: carga.id }],
  paradas: [{ sucursal: carga.sucursal }],
  cajillas: [],
  estado: "borrador",
});

const cargaPrevista = {
  ...carga,
  preparacion: 4,
  cajillas_previstas: [
    {
      preparacion_id: 4,
      sucursal_id: carga.sucursal,
      producto_id: carga.producto,
      cajilla_id: 8,
      color: "Verde",
      cantidad: 2,
    },
  ],
};

prueba(
  "elegir carga incorpora las cajillas y el guardado transmite el modo automatico",
  () => {
    const sesion = crearSesion();
    sesion.elegirTransporte();
    sesion.buscar("SeleccionCargaDespacho").props.alCambiar([cargaPrevista]);
    sesion.renderizar();
    sesion.continuar();
    const paradas = sesion.buscar("ParadasFormularioDespacho").props;
    afirmar.equal(paradas.automaticas, true);
    afirmar.equal(paradas.cajillas.length, 1);
    afirmar.equal(paradas.cajillas[0].cantidad, 2);
    sesion.boton("Revisar despacho").props.onClick();
    const guardado = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(guardado.cajillas_automaticas, true);
    afirmar.equal(guardado.cajillas[0].cantidad, 2);
  },
);

prueba(
  "reabrir el borrador antiguo recupera previstas y permite ajustar sin perderlas",
  () => {
    const inicial = {
      ...borrador(),
      cajillas_automaticas: null,
      cargas: [{ ...cargaPrevista, asignacion: cargaPrevista.id }],
    };
    const sesion = crearSesion(inicial);
    sesion.continuar();
    afirmar.equal(
      sesion.buscar("ParadasFormularioDespacho").props.cajillas[0].cantidad,
      2,
    );
    sesion.boton("Ajustar cajillas").props.onClick();
    sesion.renderizar();
    let paradas = sesion.buscar("ParadasFormularioDespacho").props;
    afirmar.equal(paradas.automaticas, false);
    paradas.alCajillas([{ ...paradas.cajillas[0], cantidad: 5 }]);
    sesion.renderizar();
    sesion.buscar("PasosFormularioDespacho").props.alElegir(0);
    sesion.renderizar();
    sesion
      .buscar("SeleccionCargaDespacho")
      .props.alCambiar([{ ...cargaPrevista, cantidad: 1 }]);
    sesion.renderizar();
    sesion.continuar();
    paradas = sesion.buscar("ParadasFormularioDespacho").props;
    afirmar.equal(paradas.cajillas[0].cantidad, 5);
    sesion.boton("Revisar despacho").props.onClick();
    const guardado = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(guardado.cajillas_automaticas, false);
    afirmar.equal(guardado.cajillas[0].cantidad, 5);
  },
);

prueba(
  "una lista manual vacia se conserva y Usar previstas restaura el modo automatico",
  () => {
    const inicial = {
      ...borrador(),
      cajillas_automaticas: false,
      cargas: [{ ...cargaPrevista, asignacion: cargaPrevista.id }],
    };
    const sesion = crearSesion(inicial);
    sesion.continuar();
    afirmar.equal(
      sesion.buscar("ParadasFormularioDespacho").props.cajillas.length,
      0,
    );
    sesion.boton("Usar previstas").props.onClick();
    sesion.renderizar();
    const paradas = sesion.buscar("ParadasFormularioDespacho").props;
    afirmar.equal(paradas.automaticas, true);
    afirmar.equal(paradas.cajillas[0].cantidad, 2);
  },
);

prueba(
  "los pasos futuros requieren visitarlos y la revision requiere el borrador guardado",
  () => {
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(2, 0, true, true, true),
      false,
    );
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(0, 2, false, true, false),
      true,
    );
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(1, 2, true, true, false),
      true,
    );
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(2, 2, true, true, false),
      false,
    );
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(2, 2, true, true, true),
      true,
    );
    afirmar.equal(
      navegacion.puedeAbrirPasoDespacho(4, 4, true, true, true),
      false,
    );
  },
);

prueba(
  "los errores de transporte, carga y cajillas llevan al paso correspondiente",
  () => {
    const errores = navegacion.erroresTransporteDespacho(
      {
        almacen: null,
        vehiculo: null,
        chofer: null,
        fecha: "",
        observaciones: "",
      },
      "Requerido",
      "Fecha invalida",
    );
    afirmar.equal(Object.keys(errores).length, 4);
    afirmar.equal(
      navegacion.pasoErrorDespacho({ observaciones: ["Demasiado largo"] }, 2),
      1,
    );
    afirmar.equal(
      navegacion.pasoErrorDespacho({ asignaciones_1: ["No disponible"] }, 2),
      0,
    );
    afirmar.equal(
      navegacion.pasoErrorDespacho({ cajillas_0_cantidad: ["Invalido"] }, 2),
      1,
    );
  },
);

function crearSesion(inicial, autorizaciones = permisos) {
  const almacen = [];
  let cursor = 0;
  let arbol;
  const peticiones = [],
    rutas = [],
    cuadros = [],
    errores = [];
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
    useEffect: () => {},
  };
  const control = { focus: () => {}, scrollIntoView: () => {} };
  class ErrorApiPrueba extends Error {
    constructor(estado, problemas = {}) {
      super("Fallo de prueba");
      this.status = estado;
      this.errors = problemas;
    }
  }
  const componente = cargar(
    "FormularioDespacho.tsx",
    {
      react,
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next-intl": {
        useTranslations: (namespace) =>
          internacionalizacion.createTranslator({
            locale: "es",
            messages: mensajes,
            namespace,
          }),
      },
      "@/i18n/navigation": {
        useRouter: () => ({
          push: (ruta) => rutas.push(ruta),
          refresh: () => {},
        }),
      },
      "@/components/logistica/tipos": { clasePanel: "panel" },
      "@/lib/api": {
        ApiError: ErrorApiPrueba,
        api: (ruta, opciones) =>
          new Promise((resolver, rechazar) =>
            peticiones.push({ ruta, opciones, resolver, rechazar }),
          ),
      },
      "./navegacionFormularioDespacho": navegacion,
      "./cajillasPreparadasDespacho": cargar("cajillasPreparadasDespacho.ts"),
      "lucide-react": iconos,
    },
    {
      crypto: { randomUUID: () => "clave-prueba" },
      requestAnimationFrame: (funcion) => cuadros.push(funcion),
    },
  ).default;
  function todos(nodo) {
    if (!arguments.length) nodo = arbol;
    if (!nodo || typeof nodo !== "object") return [];
    return Array.isArray(nodo)
      ? nodo.flatMap((hijo) => todos(hijo))
      : [nodo, ...todos(nodo.props?.children)];
  }
  function renderizar() {
    cursor = 0;
    arbol = componente({
      despacho: inicial,
      permisos: autorizaciones,
      alError: (error) => errores.push(error),
    });
    const referencia = todos().find((nodo) => nodo.props?.ref)?.props.ref;
    if (referencia) referencia.current = { querySelector: () => control };
    while (cuadros.length) cuadros.shift()();
    return arbol;
  }
  const buscar = (tipo) => todos().find((nodo) => nodo.type === tipo);
  const boton = (etiqueta) =>
    todos().find(
      (nodo) =>
        nodo.type === "Button" &&
        (Array.isArray(nodo.props.children)
          ? nodo.props.children
          : [nodo.props.children]
        ).includes(etiqueta),
    );
  const elegirTransporte = () => {
    (
      buscar("OrigenCargaDespacho") || buscar("TransporteFormularioDespacho")
    ).props.alCambiar({
      almacen: { id: 1, nombre: "Central" },
      vehiculo: { id: 2, nombre: "1234-ABC" },
      chofer: { id: 3, nombre: "Jose" },
      fecha: "2026-10-29",
    });
    renderizar();
  };
  const continuar = () => {
    boton("Continuar a transporte").props.onClick();
    renderizar();
  };
  renderizar();
  return {
    buscar,
    boton,
    renderizar,
    elegirTransporte,
    continuar,
    peticiones,
    rutas,
    errores,
    ErrorApiPrueba,
    paso: () => buscar("PasosFormularioDespacho").props.paso,
    resolver: async (datos = borrador()) => {
      peticiones.at(-1).resolver(datos);
      await esperar(0);
      renderizar();
    },
    rechazar: async (error) => {
      peticiones.at(-1).rechazar(error);
      await esperar(0);
      renderizar();
    },
  };
}

prueba(
  "primero elige carga sin exigir transporte y conserva los datos al volver",
  () => {
    const sesion = crearSesion();
    sesion.continuar();
    afirmar.equal(sesion.paso(), 0);
    afirmar.ok(
      sesion.buscar("OrigenCargaDespacho").props.errores.almacen.length,
    );
    afirmar.equal(
      sesion.buscar("OrigenCargaDespacho").props.errores.vehiculo,
      undefined,
    );
    sesion.buscar("OrigenCargaDespacho").props.alCambiar({
      almacen: { id: 1, nombre: "Central" },
      fecha: "2026-10-29",
    });
    sesion.renderizar();
    sesion.continuar();
    afirmar.equal(sesion.paso(), 0);
    afirmar.equal(sesion.boton("Guardar borrador"), undefined);
    sesion.buscar("SeleccionCargaDespacho").props.alCambiar([carga]);
    sesion.renderizar();
    sesion.buscar("SeleccionCargaDespacho").props.alFechaPedidos("2026-11-02");
    sesion.renderizar();
    sesion.buscar("SeleccionCargaDespacho").props.alCargando(true);
    sesion.renderizar();
    afirmar.equal(sesion.boton("Continuar a transporte").props.disabled, true);
    sesion.buscar("SeleccionCargaDespacho").props.alCargando(false);
    sesion.renderizar();
    sesion.continuar();
    afirmar.equal(sesion.paso(), 1);
    afirmar.equal(
      sesion.buscar("TransporteFormularioDespacho").props.datos.vehiculo,
      null,
    );
    sesion.elegirTransporte();
    sesion.buscar("PasosFormularioDespacho").props.alElegir(0);
    sesion.renderizar();
    afirmar.equal(
      sesion.buscar("SeleccionCargaDespacho").props.seleccionadas[0].id,
      carga.id,
    );
    afirmar.equal(
      sesion.buscar("SeleccionCargaDespacho").props.fechaPedidosInicial,
      "2026-11-02",
    );
    sesion.continuar();
    afirmar.equal(
      sesion.buscar("TransporteFormularioDespacho").props.datos.vehiculo.nombre,
      "1234-ABC",
    );
    afirmar.equal(sesion.peticiones.length, 0);
  },
);

prueba(
  "revisar espera al guardado y solo entonces ofrece iniciar con la version recibida",
  async () => {
    const sesion = crearSesion();
    sesion.elegirTransporte();
    sesion.buscar("SeleccionCargaDespacho").props.alCambiar([carga]);
    sesion.renderizar();
    sesion.continuar();
    const revisar = sesion.boton("Revisar despacho");
    revisar.props.onClick();
    revisar.props.onClick();
    sesion.renderizar();
    afirmar.equal(sesion.peticiones.length, 1);
    afirmar.equal(sesion.paso(), 1);
    afirmar.equal(sesion.buscar("AccionesDespacho"), undefined);
    const cargaGuardada = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(cargaGuardada.asignaciones[0], carga.id);
    afirmar.equal(cargaGuardada.orden_sucursales[0], carga.sucursal);
    afirmar.equal(cargaGuardada.clave_operacion, "clave-prueba");
    await sesion.resolver();
    afirmar.equal(sesion.paso(), 2);
    afirmar.equal(
      sesion.buscar("AccionesDespacho").props.despacho.version,
      "v2",
    );
    afirmar.equal(sesion.rutas.length, 0);
    afirmar.ok(
      sesion.peticiones.every((peticion) => !peticion.ruta.includes("iniciar")),
    );
  },
);

prueba(
  "un conflicto conserva carga y orden y mantiene la revision cerrada",
  async () => {
    const sesion = crearSesion(borrador("v1"));
    sesion.elegirTransporte();
    sesion.continuar();
    sesion.boton("Revisar despacho").props.onClick();
    sesion.renderizar();
    afirmar.equal(JSON.parse(sesion.peticiones[0].opciones.body).version, "v1");
    await sesion.rechazar(new sesion.ErrorApiPrueba(409));
    afirmar.equal(sesion.paso(), 1);
    afirmar.equal(
      sesion.buscar("ParadasFormularioDespacho").props.cargas[0].id,
      carga.id,
    );
    afirmar.equal(
      sesion.buscar("ParadasFormularioDespacho").props.orden[0],
      carga.sucursal,
    );
    afirmar.equal(sesion.buscar("AccionesDespacho"), undefined);
    afirmar.ok(sesion.buscar("TransporteFormularioDespacho").props.bloqueado);
  },
);

prueba(
  "volver a despachos confirma el descarte y guardar respeta los permisos independientes",
  () => {
    const sesion = crearSesion();
    sesion.elegirTransporte();
    sesion.boton("Salir").props.onClick();
    sesion.renderizar();
    afirmar.equal(sesion.rutas.length, 0);
    sesion.buscar("ConfirmacionLogistica").props.alConfirmar();
    afirmar.equal(sesion.rutas[0], "/despachos");
    const lectura = crearSesion(borrador(), { ...permisos, editar: false });
    afirmar.equal(lectura.boton("Guardar borrador"), undefined);
  },
);

prueba(
  "revisar un borrador guardado permite enviar sin conceder permiso de editar",
  () => {
    const lectura = crearSesion(borrador(), { ...permisos, editar: false });
    lectura.continuar();
    lectura.boton("Revisar despacho").props.onClick();
    lectura.renderizar();
    afirmar.equal(lectura.paso(), 2);
    afirmar.equal(lectura.peticiones.length, 0);
    afirmar.equal(lectura.boton("Editar asignación"), undefined);
    afirmar.equal(
      lectura.buscar("AccionesDespacho").props.permisos.enviar,
      true,
    );
    afirmar.equal(lectura.buscar("AccionesDespacho").props.soloEnvio, true);
  },
);

prueba(
  "editar un borrador conserva exactamente las indicaciones historicas sin capturarlas en la hoja",
  () => {
    const historico = {
      ...borrador(),
      observaciones: "  Texto histórico\ncon espacios.  ",
    };
    const sesion = crearSesion(historico);
    sesion.continuar();
    sesion
      .buscar("TransporteFormularioDespacho")
      .props.alCambiar({ fecha: "2026-10-30" });
    sesion.renderizar();
    sesion.boton("Revisar despacho").props.onClick();
    afirmar.equal(
      JSON.parse(sesion.peticiones[0].opciones.body).observaciones,
      historico.observaciones,
    );
  },
);

const seleccionDestinos = cargar("seleccionDestinosDespacho.ts");
const capacidadVehiculo = cargar("../vehiculos/capacidadVehiculo.ts");
const capacidadDespacho = cargar("capacidadDespacho.ts");

prueba(
  "editar y revisar conservan la capacidad actual recibida del vehiculo",
  async () => {
    const sesion = crearSesion(borrador());
    afirmar.equal(
      sesion.buscar("ResumenFormularioDespacho").props.vehiculo.capacidad_kg,
      "2000.000",
    );
    sesion.continuar();
    sesion
      .buscar("TransporteFormularioDespacho")
      .props.alCambiar({ fecha: "2026-10-30" });
    sesion.renderizar();
    sesion.boton("Revisar despacho").props.onClick();
    await sesion.resolver({
      ...borrador("v3"),
      vehiculo_capacidad_kg: "1500.000",
    });
    afirmar.equal(sesion.paso(), 2);
    afirmar.equal(
      sesion.buscar("ResumenFormularioDespacho").props.vehiculo.capacidad_kg,
      "1500.000",
    );
  },
);
const dependenciasVista = {
  "./capacidadDespacho": capacidadDespacho,
  "./seleccionDestinosDespacho": seleccionDestinos,
  "@/components/vehiculos/capacidadVehiculo": capacidadVehiculo,
  react: React,
  "react/jsx-runtime": jsx,
  "next-intl": internacionalizacion,
  "lucide-react": iconos,
  "@/components/logistica/tipos": {
    clasePanel: "panel",
    claseEntrada: "entrada",
  },
  "./navegacionFormularioDespacho": navegacion,
  "@/components/compras/calculos": { mostrarFecha: (fecha) => fecha },
  "./SelectorTransporteDespacho": {
    default: ({ nombre }) =>
      React.createElement("button", { name: nombre, type: "button" }, nombre),
  },
  "@/components/form/CampoFecha": {
    default: ({ name }) => React.createElement("input", { name }),
  },
};
dependenciasVista["./AvisoCapacidadDespacho"] = cargar(
  "AvisoCapacidadDespacho.tsx",
  dependenciasVista,
);
const Resumen = cargar(
  "ResumenFormularioDespacho.tsx",
  dependenciasVista,
).default;
const Transporte = cargar(
  "TransporteFormularioDespacho.tsx",
  dependenciasVista,
).default;
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
  "el resumen compacto omite datos vacios y solo muestra cantidades incluidas",
  () => {
    const propiedades = {
      paso: 0,
      fecha: "2026-10-29",
      almacen: null,
      vehiculo: null,
      chofer: null,
      cargas: [],
      orden: [],
      cajillas: [],
      modificado: false,
    };
    const resultado = dibujar(Resumen, propiedades);
    afirmar.equal(resultado, "");
    for (const idioma of ["es", "en"]) {
      const conCarga = dibujar(
        Resumen,
        { ...propiedades, paso: 2, cargas: [carga], orden: [5] },
        idioma,
      );
      afirmar.ok(conCarga.includes("2026-10-29"));
      afirmar.ok(!conCarga.includes("CANT"));
      afirmar.ok(!conCarga.includes("UNI"));
      afirmar.ok(!conCarga.includes("Pendiente de elegir"));
      afirmar.ok(conCarga.includes(idioma === "es" ? "3 cajas" : "3 boxes"));
      afirmar.ok(conCarga.includes("12"));
    }
  },
);

prueba(
  "la capacidad ingresada en toneladas conserva el limite real de peso en despachos",
  () => {
    const { toneladasAKilogramos } = cargar(
      "../vehiculos/capacidadVehiculo.ts",
    );
    const propiedades = {
      paso: 1,
      fecha: "2026-10-29",
      almacen: null,
      chofer: null,
      vehiculo: {
        id: 4,
        nombre: "453VFC",
        capacidad_kg: toneladasAKilogramos("2.5"),
      },
      cargas: [
        { ...carga, peso_kg: "2500.000", aportes: [{ peso_kg: "2500.000" }] },
      ],
      orden: [5],
      cajillas: [],
      modificado: false,
    };
    afirmar.ok(!dibujar(Resumen, propiedades).includes("t t"));
    afirmar.ok(dibujar(Resumen, propiedades).includes("2,5 t"));
    afirmar.ok(
      !dibujar(Resumen, propiedades).includes(
        mensajes.despachos.capacidadEstados.excedida,
      ),
    );
    afirmar.ok(
      dibujar(Resumen, {
        ...propiedades,
        cargas: [
          { ...carga, peso_kg: "2500.001", aportes: [{ peso_kg: "2500.001" }] },
        ],
      }).includes(mensajes.despachos.capacidadEstados.excedida),
    );
  },
);

prueba(
  "transporte ordena almacen y fecha antes de vehiculo y chofer sin capturar indicaciones",
  () => {
    const resultado = dibujar(Transporte, {
      datos: {
        almacen: null,
        fecha: "2026-10-29",
        vehiculo: null,
        chofer: null,
        observaciones: "",
      },
      bloqueado: false,
      errores: {},
      alCambiar: () => {},
      alError: () => {},
    });
    afirmar.ok(
      resultado.indexOf('name="almacen"') <
        resultado.indexOf('name="fecha_reparto"'),
    );
    afirmar.ok(
      resultado.indexOf('name="fecha_reparto"') <
        resultado.indexOf('name="vehiculo"'),
    );
    afirmar.ok(
      resultado.indexOf('name="vehiculo"') < resultado.indexOf('name="chofer"'),
    );
    afirmar.ok(!/<details[^>]*\sopen/.test(resultado));
    afirmar.ok(!resultado.includes("textarea"));
    afirmar.ok(!resultado.includes('name="observaciones"'));
  },
);

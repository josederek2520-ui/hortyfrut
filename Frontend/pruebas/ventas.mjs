import prueba from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { randomUUID as generarUuid } from "node:crypto";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargar = crearCargadorChofer();
const { alternarEntrega, sumarImportes, validarVenta, formularioDesdeVenta } =
  cargar("components/ventas/calculosVenta");
const { mostrarBolivianos } = cargar("lib/moneda");
const entrega = (id, total = "50.25") => ({
  id,
  codigo: `ENT-${id}`,
  sucursal_nombre: "Centro",
  codigo_pedido: `PED-${id}`,
  fecha_recepcion: "2026-11-11",
  fecha_requerida: "2026-11-10",
  productos: 1,
  peso_aceptado_kg: "10.050",
  total,
  incidencias: [],
});
const formulario = () => ({
  cliente: { id: 3, nombre: "Supermercado", nit: "12345" },
  desde: "2026-11-11",
  hasta: "2026-11-11",
  vencimiento: "",
  entregas: [entrega(1)],
});
const documento = (cambios = {}) => ({
  id: 7,
  codigo: "VEN-000007",
  estado: "borrador",
  version: "v1",
  revision: "revision1",
  cliente: 3,
  cliente_nombre: "Supermercado",
  cliente_nit: "12345",
  desde: "2026-11-11",
  hasta: "2026-11-11",
  vencimiento: null,
  total: "50.25",
  saldo: null,
  cobrado: null,
  estado_cobro: null,
  fecha_emision: null,
  peso_aceptado_kg: "10.050",
  total_entregas: 1,
  total_lineas: 1,
  seleccion: [1],
  entregas: [entrega(1)],
  incidencias: [],
  ...cambios,
});

prueba(
  "la seleccion conserva otras paginas, impide repetidos y no elige entregas sin precio",
  () => {
    let filas = Array.from({ length: 12 }, (_, indice) => entrega(indice + 1));
    filas = alternarEntrega(filas, entrega(2));
    afirmar.equal(filas.length, 11);
    afirmar.ok(filas.some((fila) => fila.id === 12));
    afirmar.equal(
      alternarEntrega(filas, {
        ...entrega(99, null),
        incidencias: ["sin_precio"],
      }).length,
      11,
    );
    afirmar.equal(alternarEntrega(filas, entrega(2)).length, 12);
  },
);
prueba("los centavos se suman y muestran sin perdida de precision", () => {
  afirmar.equal(
    sumarImportes([entrega(1, "0.10"), entrega(2, "0.20")]),
    "0.30",
  );
  afirmar.equal(
    sumarImportes([entrega(1, "9999999999999999.98"), entrega(2, "0.01")]),
    "9999999999999999.99",
  );
  afirmar.match(
    mostrarBolivianos("9999999999999999.99", "es"),
    /9\.999\.999\.999\.999\.999,99/,
  );
  afirmar.match(
    mostrarBolivianos("9999999999999999.99", "en"),
    /9,999,999,999,999,999\.99/,
  );
  afirmar.match(mostrarBolivianos("-0.01", "en"), /-.*0\.01/);
  afirmar.equal(sumarImportes([entrega(1, null)]), null);
});
prueba(
  "validacion incluye selecciones fuera de la pagina y no pierde recepciones al cambiar el filtro",
  () => {
    const datos = formulario();
    datos.entregas = Array.from({ length: 12 }, (_, indice) =>
      entrega(indice + 1),
    );
    datos.entregas[11].fecha_recepcion = "2026-11-12";
    afirmar.ok(validarVenta(datos, true).includes("fueraPeriodo"));
    afirmar.equal(datos.entregas.length, 12);
    datos.hasta = "2026-11-12";
    afirmar.equal(validarVenta(datos, true).length, 0);
    afirmar.deepEqual(formularioDesdeVenta(documento()).entregas, [entrega(1)]);
  },
);

class ErrorApi extends Error {
  constructor(status, errors = {}) {
    super();
    this.status = status;
    this.errors = errors;
  }
}
function escenario(
  solicitar,
  nombre = "components/ventas/useGestionVenta",
  dependencias = {},
) {
  let cursor = 0;
  const memoria = [],
    efectos = [],
    eventos = new Map();
  const react = {
    useState(inicial) {
      const indice = cursor++;
      if (!(indice in memoria))
        memoria[indice] = typeof inicial === "function" ? inicial() : inicial;
      return [
        memoria[indice],
        (valor) => {
          memoria[indice] =
            typeof valor === "function" ? valor(memoria[indice]) : valor;
        },
      ];
    },
    useRef(inicial) {
      const indice = cursor++;
      memoria[indice] ??= { current: inicial };
      return memoria[indice];
    },
    useCallback(funcion, dependencias) {
      const indice = cursor++;
      if (
        !memoria[indice] ||
        dependencias.some(
          (valor, pos) => valor !== memoria[indice].dependencias[pos],
        )
      )
        memoria[indice] = { funcion, dependencias };
      return memoria[indice].funcion;
    },
    useEffect(funcion, dependencias) {
      const indice = cursor++;
      if (
        !memoria[indice] ||
        dependencias.some(
          (valor, pos) => valor !== memoria[indice].dependencias[pos],
        )
      ) {
        memoria[indice]?.limpiar?.();
        memoria[indice] = { dependencias };
        efectos.push(() => {
          memoria[indice].limpiar = funcion();
        });
      }
    },
  };
  const usar = crearCargadorChofer(
    {
      react,
      "@/lib/api": { api: solicitar, ApiError: ErrorApi },
      "@/lib/chofer/infraestructura/crearClaveOperacion": {
        crearClaveOperacion: generarUuid,
      },
      ...dependencias,
    },
    {
      window: {
        addEventListener(clave, funcion) {
          eventos.set(clave, funcion);
        },
        removeEventListener(clave) {
          eventos.delete(clave);
        },
      },
    },
  )(nombre).default;
  return {
    dibujar(...parametros) {
      cursor = 0;
      const resultado = usar(...parametros);
      efectos.splice(0).forEach((funcion) => funcion());
      return resultado;
    },
    desmontar() {
      memoria.forEach((valor) => valor?.limpiar?.());
    },
    cambiarSesion() {
      eventos.get("hortyfru:session-changed")?.();
    },
  };
}
function anotar(entorno) {
  entorno.dibujar().cambiar(formulario());
  return entorno.dibujar();
}

function buscarElemento(elemento, coincide) {
  if (!elemento || typeof elemento !== "object") return null;
  if (coincide(elemento)) return elemento;
  for (const hijo of React.Children.toArray(elemento.props?.children)) {
    const encontrado = buscarElemento(hijo, coincide);
    if (encontrado) return encontrado;
  }
  return null;
}
function contextoInteractivo() {
  let datos = formulario();
  const entorno = escenario(null, "components/ventas/ContextoVenta", {
    "react/jsx-runtime": jsx,
    "next-intl": {
      useLocale: () => "es",
      useTranslations: () => (clave) => clave,
    },
    "lucide-react": new Proxy({}, { get: () => "svg" }),
    "@/components/ui/button/Button": { default: "button" },
    "@/components/form/CampoFecha": { default: "calendario" },
  });
  const dibujar = (revision = false, editable = true) =>
    entorno.dibujar({
      formulario: datos,
      documento: null,
      revision,
      editable,
      bloqueado: false,
      alCambiar: (cambios) => {
        datos = { ...datos, ...cambios };
      },
      alElegirCliente() {},
    });
  const periodo = () => {
    const componente = buscarElemento(
      dibujar(),
      (e) => typeof e.props.alModo === "function",
    );
    return componente.type(componente.props);
  };
  return { dibujar, periodo, datos: () => datos };
}
prueba(
  "un dia cambia ambas fechas y alternar el periodo conserva las entregas",
  () => {
    const contexto = contextoInteractivo();
    const calendario = (identificador) =>
      buscarElemento(contexto.periodo(), (e) => e.props.id === identificador);
    const modo = (nombre) =>
      buscarElemento(
        contexto.periodo(),
        (e) => e.type === "button" && e.props.children === nombre,
      );
    afirmar.equal(calendario("venta-hasta"), null);
    calendario("venta-desde").props.alCambiar("2026-11-12");
    afirmar.equal(contexto.datos().desde, "2026-11-12");
    afirmar.equal(contexto.datos().hasta, "2026-11-12");
    modo("variosDias").props.onClick();
    calendario("venta-hasta").props.alCambiar("2026-11-14");
    afirmar.equal(contexto.datos().hasta, "2026-11-14");
    modo("unDia").props.onClick();
    afirmar.equal(contexto.datos().hasta, contexto.datos().desde);
    afirmar.equal(contexto.datos().entregas.length, 1);
    afirmar.equal(contexto.datos().entregas[0].fecha_recepcion, "2026-11-11");
    afirmar.ok(validarVenta(contexto.datos(), true).includes("fueraPeriodo"));
  },
);
prueba(
  "revisar muestra el vencimiento y volver conserva el modo varios dias",
  () => {
    const contexto = contextoInteractivo();
    afirmar.equal(
      buscarElemento(
        contexto.dibujar(),
        (e) => e.props.id === "venta-vencimiento",
      ),
      null,
    );
    buscarElemento(
      contexto.periodo(),
      (e) => e.type === "button" && e.props.children === "variosDias",
    ).props.onClick();
    const vencimiento = buscarElemento(
      contexto.dibujar(true),
      (e) => e.props.id === "venta-vencimiento",
    );
    afirmar.ok(vencimiento);
    vencimiento.props.alCambiar("2026-12-15");
    afirmar.equal(contexto.datos().vencimiento, "2026-12-15");
    afirmar.ok(
      buscarElemento(contexto.periodo(), (e) => e.props.id === "venta-hasta"),
    );
    afirmar.equal(
      buscarElemento(
        contexto.dibujar(true, false),
        (e) => e.props.id === "venta-vencimiento",
      ),
      null,
    );
    afirmar.equal(contexto.datos().entregas.length, 1);
  },
);
prueba(
  "cambiar el vencimiento en revision exige guardar y utiliza la nueva version al emitir",
  async () => {
    const peticiones = [];
    let vencimiento = null;
    const entorno = escenario(async (ruta, opciones) => {
      const datos = JSON.parse(opciones.body);
      peticiones.push({ ruta, datos });
      if ("vencimiento" in datos) vencimiento = datos.vencimiento;
      return documento({
        version: "v" + peticiones.length,
        revision: "revision" + peticiones.length,
        vencimiento,
      });
    });
    await anotar(entorno).operar("revisar");
    entorno.dibujar().cambiar({ vencimiento: "2026-12-15" });
    afirmar.equal(entorno.dibujar().paso, "revision");
    await entorno.dibujar().operar("emitir");
    afirmar.equal(peticiones.length, 1);
    await entorno.dibujar().operar("revisar");
    afirmar.equal(peticiones[1].ruta, "ventas/" + documento().id + "/guardar/");
    afirmar.equal(peticiones[1].datos.vencimiento, "2026-12-15");
    afirmar.equal(entorno.dibujar().modificado, false);
    await entorno.dibujar().operar("emitir");
    afirmar.equal(peticiones[2].datos.version, "v2");
    afirmar.equal(peticiones[2].datos.revision, "revision2");
  },
);
prueba(
  "revisar guarda primero y emitir usa la version y la revision recibidas",
  async () => {
    const peticiones = [],
      entorno = escenario(async (ruta, opciones) => {
        peticiones.push({ ruta, datos: JSON.parse(opciones.body) });
        return documento({
          estado: ruta.endsWith("/emitir/") ? "emitida" : "borrador",
        });
      });
    await anotar(entorno).operar("revisar");
    afirmar.equal(entorno.dibujar().paso, "revision");
    await entorno.dibujar().operar("emitir");
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[1].datos.version, "v1");
    afirmar.equal(peticiones[1].datos.revision, "revision1");
    afirmar.deepEqual(peticiones[0].datos.entregas, [1]);
    afirmar.equal(peticiones[0].datos.total, undefined);
  },
);
prueba(
  "un resultado incierto bloquea cambios y conserva UUID cuerpo y destino al reintentar",
  async () => {
    const cuerpos = [],
      entorno = escenario(async (_, opciones) => {
        cuerpos.push(opciones.body);
        if (cuerpos.length === 1) throw new ErrorApi(0);
        return documento();
      });
    await anotar(entorno).operar("revisar");
    entorno.dibujar().cambiar({ entregas: [] });
    await entorno.dibujar().operar("cancelar");
    afirmar.equal(cuerpos.length, 1);
    afirmar.equal(entorno.dibujar().formulario.entregas.length, 1);
    await entorno.dibujar().operar("reintentar");
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(entorno.dibujar().incierto, false);
    afirmar.equal(entorno.dibujar().paso, "revision");
  },
);
for (const modo of ["desmontar", "cambiarSesion"])
  prueba(
    "respuesta tardia no repone documento despues de " + modo,
    async () => {
      let completar;
      const entorno = escenario(
        () =>
          new Promise((resolver) => {
            completar = resolver;
          }),
      );
      const trabajo = anotar(entorno).operar("guardar");
      entorno[modo]();
      completar(documento());
      await trabajo;
      afirmar.equal(entorno.dibujar().documento, null);
    },
  );
prueba("doble clic no envia dos escrituras simultaneas", async () => {
  let completar,
    llamadas = 0;
  const entorno = escenario(() => {
    llamadas++;
    return new Promise((resolver) => {
      completar = resolver;
    });
  });
  const estado = anotar(entorno),
    primera = estado.operar("guardar");
  await estado.operar("guardar");
  afirmar.equal(llamadas, 1);
  completar(documento());
  await primera;
});

for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL(`../src/messages/${idioma}.json`, import.meta.url),
      "utf8",
    ),
  );
  const cargarVista = crearCargadorChofer(
    {
      react: React,
      "react/jsx-runtime": jsx,
      "next-intl": {
        useLocale: () => idioma,
        useTranslations: (espacio) =>
          crearTraductor({
            locale: idioma,
            messages: mensajes,
            namespace: espacio,
          }),
      },
      "lucide-react": new Proxy({}, { get: () => () => null }),
      "@/i18n/navigation": {
        Link: ({ href, children, ...propiedades }) =>
          React.createElement("a", { href, ...propiedades }, children),
      },
      "@/components/form/CampoFecha": {
        default: () => React.createElement("input"),
      },
      "@/components/pedidos/PaginadorPedidos": { default: () => null },
      "@/hooks/useConsultaPaginada": {
        default: () => ({
          datos: {
            count: 1,
            results: [
              documento({
                estado: "emitida",
                total: "109.50",
                saldo: "9.50",
                cobrado: "100.00",
                estado_cobro: "parcial",
              }),
            ],
            resumen: {
              total: "109.50",
              pendiente_cobro: "9.50",
              emitidas: 1,
              borradores: 0,
            },
          },
          recargar() {},
        }),
      },
    },
    { URLSearchParams },
  );
  prueba(
    "la tarjeta pendiente usa el saldo y conserva el total original en la fila en " +
      idioma,
    () => {
      const Lista = cargarVista("components/ventas/ListaVentas").default;
      const html = representar(
        React.createElement(Lista, {
          sesion: { permisos_ventas: { crear: false } },
        }),
      );
      const inicio = html.indexOf(mensajes.ventas.pendienteCobro);
      const fin = html.indexOf(mensajes.ventas.ventasEmitidas, inicio);
      afirmar.ok(inicio >= 0 && fin > inicio);
      const tarjeta = html.slice(inicio, fin);
      afirmar.ok(tarjeta.includes(mostrarBolivianos("9.50", idioma)));
      afirmar.ok(!tarjeta.includes(mostrarBolivianos("109.50", idioma)));
      afirmar.ok(html.includes(mostrarBolivianos("109.50", idioma)));
    },
  );
  const Resumen = cargarVista("components/ventas/ResumenVenta").default;
  prueba("resumen accesible y saldo historico en " + idioma, () => {
    const html = representar(
      React.createElement(Resumen, {
        total: "50.25",
        cantidad: 1,
        venta: documento({
          estado: "emitida",
          cobrado: "0.00",
          saldo: "50.25",
        }),
      }),
    );
    afirmar.ok(html.includes(mensajes.ventas.sinValorFiscal));
    afirmar.ok(html.includes(mensajes.ventas.saldo));
    afirmar.ok(html.includes("aria-label="));
    afirmar.ok(!html.includes("undefined"));
  });
}
prueba(
  "todas las claves de ventas y sus permisos tienen traducciones equivalentes",
  () => {
    const leer = (idioma) =>
      JSON.parse(
        leerArchivo(
          new URL(`../src/messages/${idioma}.json`, import.meta.url),
          "utf8",
        ),
      );
    const claves = (objeto, prefijo = "") =>
      Object.entries(objeto)
        .flatMap(([clave, valor]) =>
          typeof valor === "object"
            ? claves(valor, prefijo + clave + ".")
            : [prefijo + clave],
        )
        .sort();
    afirmar.deepEqual(claves(leer("es").ventas), claves(leer("en").ventas));
    for (const idioma of ["es", "en"])
      for (const permiso of [
        "view_venta",
        "add_venta",
        "change_venta",
        "emitir_venta",
        "cancelar_venta",
        "descargar_venta",
      ])
        afirmar.ok(leer(idioma).roles.permissionLabels[permiso]);
  },
);

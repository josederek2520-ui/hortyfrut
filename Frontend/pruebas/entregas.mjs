import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { randomUUID as generarUuid } from "node:crypto";
import { setImmediate as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";
const cargar = crearCargadorChofer();
const calculos = cargar("components/entregas/calculosEntrega");
const producto = {
  producto: 1,
  nombre: "Banana",
  cajas: 1,
  unidades: 0,
  peso_kg: "7.000",
  aportes: [],
};
const hoja = () => ({
  id: null,
  estado: "pendiente",
  version: "v0",
  fecha_recepcion: null,
  fecha_minima: "2026-11-01",
  fecha_maxima: "2026-11-08",
  recibido_por: "",
  lineas: [],
  aportes: [],
  comprobante: false,
  origen: { productos: [producto] },
});

prueba("la recepción inicia sin autocompletar cajas, unidades ni kilos", () => {
  const linea = calculos.lineaVacia();
  afirmar.equal(linea.cajas_recibidas, "");
  afirmar.equal(linea.unidades_recibidas, "");
  afirmar.equal(linea.peso_recibido_kg, "");
  afirmar.equal(calculos.pesoAceptado(linea), null);
  afirmar.equal(calculos.diferenciaEntrega(hoja(), {}), null);
});
prueba("aceptado y diferencia son exactos e independientes del rechazo", () => {
  const linea = {
    ...calculos.lineaVacia(),
    cajas_recibidas: "1",
    unidades_recibidas: "0",
    peso_recibido_kg: "6,8",
    peso_rechazado_kg: "0,3",
  };
  afirmar.equal(calculos.pesoAceptado(linea), "6.5");
  afirmar.equal(calculos.diferenciaEntrega(hoja(), { 1: linea }), "0.2");
  const resumen = calculos.resumenPesosEntrega(hoja(), { 1: linea });
  afirmar.equal(resumen.enviado, "7");
  afirmar.equal(resumen.recibido, "6.8");
  afirmar.equal(resumen.aceptado, "6.5");
  afirmar.equal(
    calculos.prepararLineas({ 1: linea }).filas[0].peso_recibido_kg,
    "6.8",
  );
  afirmar.equal(linea.cajas_recibidas, "1");
});
prueba(
  "validar mediciones no redondea decimales ni acepta cajas fraccionadas",
  () => {
    const linea = {
      ...calculos.lineaVacia(),
      cajas_recibidas: "1.5",
      unidades_recibidas: "0",
      peso_recibido_kg: "1.0001",
    };
    const resultado = calculos.prepararLineas({ 1: linea });
    afirmar.ok(resultado.errores["1_cajas_recibidas"]);
    afirmar.ok(resultado.errores["1_peso_recibido_kg"]);
    afirmar.equal(
      calculos.medirEntrega("99999999999.999"),
      BigInt("99999999999999"),
    );
    afirmar.equal(
      calculos.pesoAceptado({
        ...linea,
        peso_recibido_kg: "1",
        peso_rechazado_kg: "1.001",
      }),
      null,
    );
  },
);
for (const idioma of ["es", "en"]) {
  prueba(
    `la hoja compara enviado y recibido y muestra el rechazo en ${idioma}`,
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
        namespace: "entregas",
      });
      const cargarVista = crearCargadorChofer({
        react: React,
        "react/jsx-runtime": jsx,
        "next-intl": { useTranslations: () => t, useLocale: () => idioma },
        "@/components/productos/ImagenProducto": {
          default: ({ nombre }) => React.createElement("span", {}, nombre),
        },
      });
      const Tabla = cargarVista(
        "components/entregas/TablaRecepcionEntrega",
      ).default;
      const html = representar(
        React.createElement(Tabla, {
          productos: [producto],
          lineas: {
            1: {
              ...calculos.lineaVacia(),
              peso_recibido_kg: "6.8",
              peso_rechazado_kg: "0.3",
              motivo_rechazo: "Golpeado",
            },
          },
          errores: {},
          bloqueado: false,
          alCambiar: () => {},
        }),
      );
      for (const campo of ["enviado", "recibido", "rechazado", "aceptado"])
        afirmar.ok(html.includes(t(campo)));
      afirmar.ok(html.includes(idioma === "es" ? "6,5" : "6.5"));
      afirmar.ok(html.includes("Golpeado"));
      afirmar.ok(html.includes("aria-label="));
      afirmar.ok(html.includes("entrega-tabla-1-peso_recibido_kg"));
      afirmar.ok(html.includes("entrega-tarjeta-1-peso_recibido_kg"));
    },
  );
}

class ErrorApi extends Error {
  constructor(status, errors = {}) {
    super();
    this.status = status;
    this.errors = errors;
  }
}
function escenarioGancho(solicitar, { oficina = false, publico = false } = {}) {
  let cursor = 0;
  const memorias = [],
    efectos = [];
  const ventana = { addEventListener: () => {}, removeEventListener: () => {} };
  const react = {
    useState: (inicial) => {
      const i = cursor++;
      if (!(i in memorias))
        memorias[i] = typeof inicial === "function" ? inicial() : inicial;
      return [
        memorias[i],
        (valor) => {
          memorias[i] =
            typeof valor === "function" ? valor(memorias[i]) : valor;
        },
      ];
    },
    useRef: (inicial) => {
      const i = cursor++;
      memorias[i] ??= { current: inicial };
      return memorias[i];
    },
    useCallback: (funcion, dependencias) => {
      const i = cursor++;
      if (
        !memorias[i] ||
        dependencias.some((d, j) => d !== memorias[i].dependencias[j])
      )
        memorias[i] = { funcion, dependencias };
      return memorias[i].funcion;
    },
    useEffect: (funcion, dependencias) => {
      const i = cursor++;
      if (
        !memorias[i] ||
        dependencias.some((d, j) => d !== memorias[i].dependencias[j])
      ) {
        memorias[i]?.limpiar?.();
        memorias[i] = { dependencias };
        efectos.push(() => {
          memorias[i].limpiar = funcion();
        });
      }
    },
  };
  const cargador = crearCargadorChofer(
    {
      react,
      "@/lib/api": { api: solicitar, ApiError: ErrorApi },
      "@/lib/chofer/infraestructura/crearClaveOperacion": {
        crearClaveOperacion: generarUuid,
      },
    },
    { window: ventana, FormData },
  );
  const usar = cargador("components/entregas/useHojaEntrega").default;
  const sesion = {
    acceso_publico: publico,
    permisos_entregas: { confirmar: oficina },
  };
  return {
    dibujar: () => {
      cursor = 0;
      const resultado = usar(7, 1, sesion);
      efectos.splice(0).forEach((efecto) => efecto());
      return resultado;
    },
  };
}
prueba(
  "guardar antes de enviar usa la versión nueva y conserva todas las líneas anotadas",
  async () => {
    const peticiones = [];
    const entorno = escenarioGancho(async (ruta, opciones) => {
      if (!opciones?.method) return hoja();
      const cuerpo = JSON.parse(opciones.body);
      peticiones.push({ ruta, cuerpo });
      return {
        ...hoja(),
        id: 1,
        estado: ruta.endsWith("enviar/") ? "revision" : "borrador",
        version: `v${peticiones.length}`,
        lineas: cuerpo.lineas ?? [],
      };
    });
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    estado.cambiarFecha("2026-11-05");
    estado.cambiarRecibidoPor("Persona que recibió");
    estado.cambiarLineas({
      1: {
        ...calculos.lineaVacia(),
        cajas_recibidas: "1",
        unidades_recibidas: "0",
        peso_recibido_kg: "6,8",
      },
      11: {
        ...calculos.lineaVacia(),
        cajas_recibidas: "0",
        unidades_recibidas: "2",
        peso_recibido_kg: "2.5",
      },
    });
    estado = entorno.dibujar();
    await estado.operar("enviar");
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[0].cuerpo.version, "v0");
    afirmar.equal(peticiones[1].cuerpo.version, "v1");
    afirmar.equal(peticiones[0].cuerpo.lineas.length, 2);
    afirmar.equal(peticiones[0].cuerpo.lineas[0].peso_recibido_kg, "6.8");
    afirmar.equal(entorno.dibujar().hoja.estado, "revision");
  },
);
prueba(
  "una respuesta incierta conserva cuerpo y UUID y no vuelve a guardar antes del reintento",
  async () => {
    const peticiones = [];
    let perdida = true;
    const entorno = escenarioGancho(async (_, opciones) => {
      if (!opciones?.method) return hoja();
      peticiones.push(opciones.body);
      if (perdida) {
        perdida = false;
        throw new ErrorApi(0);
      }
      return { ...hoja(), id: 1, version: "v1", estado: "borrador" };
    });
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    estado.cambiarRecibidoPor("Recepción");
    estado = entorno.dibujar();
    await estado.operar("guardar");
    estado = entorno.dibujar();
    afirmar.equal(estado.incierto, true);
    await estado.operar("reintentar");
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[0], peticiones[1]);
    afirmar.equal(entorno.dibujar().incierto, false);
  },
);
prueba("las traducciones de Entregas contienen las mismas claves", () => {
  const claves = (objeto, prefijo = "") =>
    Object.entries(objeto)
      .flatMap(([clave, valor]) =>
        typeof valor === "object"
          ? claves(valor, `${prefijo}${clave}.`)
          : [`${prefijo}${clave}`],
      )
      .sort();
  const datos = (idioma) =>
    JSON.parse(
      leerArchivo(
        new URL(`../src/messages/${idioma}.json`, import.meta.url),
        "utf8",
      ),
    ).entregas;
  afirmar.deepEqual(claves(datos("es")), claves(datos("en")));
  afirmar.doesNotMatch(JSON.stringify(datos("es")), /\p{L}\?\p{L}/u);
});

prueba(
  "el comprobante usa la versión guardada y se adjunta antes de enviar a revisión",
  async () => {
    const peticiones = [];
    const entorno = escenarioGancho(async (ruta, opciones) => {
      if (!opciones?.method) return hoja();
      peticiones.push({ ruta, cuerpo: opciones.body });
      return {
        ...hoja(),
        id: 1,
        estado: ruta.endsWith("enviar/") ? "revision" : "borrador",
        version: `v${peticiones.length}`,
        comprobante: peticiones.length >= 2,
      };
    });
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    const archivo = new File(["%PDF-1.4\nprueba\n%%EOF"], "recepcion.pdf", {
      type: "application/pdf",
    });
    estado.cambiarArchivo(archivo);
    estado.cambiarFecha("2026-11-05");
    estado.cambiarRecibidoPor("Recepción de prueba");
    estado.cambiarLineas({
      1: {
        ...calculos.lineaVacia(),
        cajas_recibidas: "1",
        unidades_recibidas: "0",
        peso_recibido_kg: "6.8",
      },
    });
    estado = entorno.dibujar();
    await estado.operar("enviar");
    afirmar.equal(peticiones.length, 3);
    afirmar.equal(JSON.parse(peticiones[0].cuerpo).version, "v0");
    afirmar.ok(peticiones[1].cuerpo instanceof FormData);
    afirmar.equal(peticiones[1].cuerpo.get("version"), "v1");
    afirmar.equal(
      peticiones[1].cuerpo.get("comprobante").name,
      "recepcion.pdf",
    );
    afirmar.equal(JSON.parse(peticiones[2].cuerpo).version, "v2");
    afirmar.equal(entorno.dibujar().archivo, null);
    afirmar.equal(entorno.dibujar().hoja.estado, "revision");
  },
);

prueba(
  "enviar identifica productos de otra pagina y la cabecera antes de publicar",
  async () => {
    const peticiones = [];
    const origen = {
      ...hoja(),
      origen: { productos: [producto, { ...producto, producto: 12 }] },
    };
    const entorno = escenarioGancho(async (_, opciones) => {
      if (!opciones?.method) return origen;
      peticiones.push(opciones.body);
      return origen;
    });
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    estado.cambiarLineas({
      1: {
        ...calculos.lineaVacia(),
        cajas_recibidas: "1",
        unidades_recibidas: "0",
        peso_recibido_kg: "7",
      },
    });
    estado = entorno.dibujar();
    await estado.operar("enviar");
    estado = entorno.dibujar();
    afirmar.equal(peticiones.length, 0);
    afirmar.ok(estado.errores.fecha_recepcion);
    afirmar.ok(estado.errores.recibido_por);
    afirmar.ok(estado.errores["12_peso_recibido_kg"]);
    afirmar.equal(estado.revisionErrores, 1);
    estado.cambiarCampo(12, "peso_recibido_kg", "0");
    estado = entorno.dibujar();
    afirmar.equal(estado.lineas[1].peso_recibido_kg, "7");
    afirmar.equal(estado.lineas[12].peso_recibido_kg, "0");
    afirmar.equal(estado.errores["12_peso_recibido_kg"], undefined);
    afirmar.equal(estado.revisionErrores, 1);
  },
);

prueba(
  "la oficina no confirma una distribucion incompleta ni completa lotes automaticamente",
  async () => {
    const original = {
      ...hoja(),
      id: 1,
      estado: "revision",
      fecha_recepcion: "2026-11-05",
      recibido_por: "Sucursal",
      origen: {
        productos: [
          {
            ...producto,
            aportes: [
              { carga: 1, lote: 1 },
              { carga: 2, lote: 2 },
            ],
          },
        ],
      },
      lineas: [
        {
          producto: 1,
          ...calculos.lineaVacia(),
          cajas_recibidas: 1,
          unidades_recibidas: 0,
          peso_recibido_kg: "7",
        },
      ],
    };
    const peticiones = [];
    const entorno = escenarioGancho(
      async (_, opciones) => {
        if (!opciones?.method) return original;
        peticiones.push(opciones.body);
        return original;
      },
      { oficina: true },
    );
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    await estado.operar("confirmar");
    estado = entorno.dibujar();
    afirmar.equal(peticiones.length, 0);
    afirmar.equal(estado.errores.lotes_1[0], "conciliacionIncompleta");
    afirmar.equal(Object.keys(estado.aportes).length, 0);
    estado.cambiarAportes({
      "1-1": {
        carga: 1,
        lote: 1,
        peso_recibido_kg: "1",
        peso_rechazado_kg: "2",
      },
    });
    estado = entorno.dibujar();
    await estado.operar("guardar");
    estado = entorno.dibujar();
    afirmar.equal(peticiones.length, 0);
    afirmar.equal(estado.errores.lotes_1[0], "conciliacionIncompleta");
  },
);

prueba(
  "el fallo inicial se puede reintentar y HTTPS no habilita la revision de oficina",
  async () => {
    let intentos = 0;
    const entorno = escenarioGancho(
      async () => {
        if (++intentos === 1) throw new ErrorApi(0);
        return hoja();
      },
      { oficina: true, publico: true },
    );
    entorno.dibujar();
    await esperar();
    let estado = entorno.dibujar();
    afirmar.equal(estado.fallo, "errorConsulta");
    afirmar.equal(estado.oficina, false);
    estado.reintentarConsulta();
    entorno.dibujar();
    await esperar();
    estado = entorno.dibujar();
    afirmar.equal(intentos, 2);
    afirmar.equal(estado.hoja.version, "v0");
    afirmar.equal(estado.fallo, "");
  },
);

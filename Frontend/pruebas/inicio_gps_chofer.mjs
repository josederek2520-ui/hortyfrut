import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { randomUUID as generarUuid } from "node:crypto";
import { setImmediate as esperar } from "node:timers/promises";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import * as iconos from "lucide-react";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

function escenario() {
  const datos = {
    ahora: Date.now(),
    solicitarPosicion: null,
    observarPosicion: null,
    observaciones: 0,
    retiradas: 0,
    inicios: [],
    lotes: [],
    cierres: [],
  };
  const cargar = crearCargadorChofer(
    {},
    {
      window: { isSecureContext: true },
      document: { visibilityState: "visible" },
      navigator: {
        geolocation: {
          getCurrentPosition: (resolver) => {
            datos.solicitarPosicion = resolver;
          },
          watchPosition: (resolver) => {
            datos.observarPosicion = resolver;
            datos.observaciones += 1;
            return 7;
          },
          clearWatch: () => {
            datos.retiradas += 1;
          },
        },
      },
    },
  );
  const { LocalizadorNavegador } = cargar(
    "lib/chofer/modulos/seguimiento/datos/LocalizadorNavegador",
  );
  const { GestorSeguimiento } = cargar(
    "lib/chofer/modulos/seguimiento/aplicacion/GestorSeguimiento",
  );
  const { ErrorAplicacion } = cargar("lib/chofer/compartido/dominio/Errores");
  const repositorio = {
    iniciar: async (_, documento) => {
      datos.inicios.push(documento);
      return { id: documento.clave_operacion, activa: true };
    },
    enviar: async (_, documento) => {
      datos.lotes.push(documento);
      return { activa: true };
    },
    detener: async (_, documento) => {
      datos.cierres.push(documento);
      return { activa: false };
    },
  };
  const gestor = new GestorSeguimiento(
    repositorio,
    new LocalizadorNavegador(),
    generarUuid,
    () => datos.ahora,
  );
  const punto = (cambios = {}) => ({
    timestamp: datos.ahora,
    coords: {
      latitude: -16.5,
      longitude: -68.14,
      accuracy: 8,
      speed: null,
      heading: null,
    },
    ...cambios,
  });
  return { datos, gestor, repositorio, punto, ErrorAplicacion };
}

prueba(
  "la guia solo recibe la sesion mientras el GPS esta autorizado y activo",
  async () => {
    const { datos, gestor, punto, repositorio } = escenario();
    const inicio = gestor.iniciar(7, "version");
    afirmar.equal(gestor.identificadorSesion(7), null);
    datos.solicitarPosicion(punto());
    await inicio;
    afirmar.equal(
      gestor.identificadorSesion(7),
      datos.inicios[0].clave_operacion,
    );
    afirmar.equal(gestor.identificadorSesion(8), null);
    let completar;
    repositorio.detener = () =>
      new Promise((resolver) => {
        completar = () => resolver({ activa: false });
      });
    const cierre = gestor.detener();
    afirmar.equal(gestor.identificadorSesion(7), null);
    completar();
    await cierre;
    afirmar.equal(gestor.identificadorSesion(7), null);
  },
);

prueba(
  "la primera medición autorizada aparece en el chofer y se envía sin esperar otro GPS",
  async () => {
    const { datos, gestor, punto } = escenario();
    const inicio = gestor.iniciar(7, "version");
    const primera = punto();
    datos.solicitarPosicion(primera);
    await inicio;
    afirmar.equal(datos.observaciones, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "compartiendo");
    afirmar.equal(gestor.obtenerEstado().posicion.latitud, -16.5);
    afirmar.equal(gestor.obtenerEstado().posicion.precisionM, 8);
    afirmar.equal(datos.lotes.length, 1);
    afirmar.equal(datos.lotes[0].sesion, datos.inicios[0].clave_operacion);
    afirmar.equal(
      datos.lotes[0].posiciones[0].capturada_en,
      new Date(primera.timestamp).toISOString(),
    );
    await gestor.detener();
  },
);

prueba(
  "no se dibuja ni envía la ubicación antes de autorizar la sesión",
  async () => {
    const { datos, gestor, repositorio, punto } = escenario();
    let resolverInicio;
    repositorio.iniciar = (_, documento) =>
      new Promise((resolver) => {
        resolverInicio = () =>
          resolver({ id: documento.clave_operacion, activa: true });
      });
    const inicio = gestor.iniciar(7, "version");
    datos.solicitarPosicion(punto());
    await esperar();
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(datos.lotes.length, 0);
    resolverInicio();
    await inicio;
    afirmar.equal(datos.lotes.length, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "compartiendo");
    await gestor.detener();
  },
);

for (const caso of ["imprecisa", "antigua", "coordenadas-invalidas"]) {
  prueba(
    `la lectura inicial ${caso} espera un GPS válido sin dibujar el camión`,
    async () => {
      const { datos, gestor, punto } = escenario();
      const primera = punto();
      if (caso === "imprecisa") primera.coords.accuracy = 101;
      if (caso === "antigua") primera.timestamp -= 30001;
      if (caso === "coordenadas-invalidas") primera.coords.latitude = 91;
      const inicio = gestor.iniciar(7, "version");
      datos.solicitarPosicion(primera);
      await inicio;
      afirmar.equal(gestor.obtenerEstado().posicion, null);
      afirmar.equal(gestor.obtenerEstado().fase, "buscando");
      afirmar.equal(datos.lotes.length, 0);
      if (caso === "imprecisa")
        afirmar.equal(gestor.obtenerEstado().error, "gpsPrecision");
      datos.observarPosicion(punto());
      await esperar();
      afirmar.equal(datos.lotes.length, 1);
      afirmar.equal(gestor.obtenerEstado().fase, "compartiendo");
      afirmar.equal(gestor.obtenerEstado().error, "");
      await gestor.detener();
    },
  );
}

prueba(
  "una respuesta lenta del servidor obliga a revalidar la antigüedad inicial",
  async () => {
    const { datos, gestor, repositorio, punto } = escenario();
    let resolverInicio;
    repositorio.iniciar = (_, documento) =>
      new Promise((resolver) => {
        resolverInicio = () =>
          resolver({ id: documento.clave_operacion, activa: true });
      });
    const inicio = gestor.iniciar(7, "version");
    datos.solicitarPosicion(punto());
    await esperar();
    datos.ahora += 30001;
    resolverInicio();
    await inicio;
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    afirmar.equal(datos.lotes.length, 0);
    datos.observarPosicion(punto());
    await esperar();
    afirmar.equal(datos.lotes.length, 1);
    await gestor.detener();
  },
);

for (const salida of ["detener", "segundo-plano", "cambio-cuenta"]) {
  prueba(
    `${salida} durante el inicio descarta el primer GPS aunque llegue autorización tardía`,
    async () => {
      const { datos, gestor, repositorio, punto } = escenario();
      let resolverInicio;
      repositorio.iniciar = (_, documento) =>
        new Promise((resolver) => {
          resolverInicio = () =>
            resolver({ id: documento.clave_operacion, activa: true });
        });
      const inicio = gestor.iniciar(7, "version");
      datos.solicitarPosicion(punto());
      await esperar();
      if (salida === "detener") void gestor.detener();
      if (salida === "segundo-plano") gestor.establecerPrimerPlano(false);
      if (salida === "cambio-cuenta") gestor.limpiar();
      resolverInicio();
      await inicio;
      afirmar.equal(gestor.obtenerEstado().posicion, null);
      afirmar.equal(datos.observaciones, 0);
      afirmar.equal(datos.lotes.length, 0);
      afirmar.equal(datos.cierres.length, salida === "cambio-cuenta" ? 0 : 1);
    },
  );
}

prueba(
  "negar la autorización del seguimiento no publica la primera medición",
  async () => {
    const { datos, gestor, repositorio, punto } = escenario();
    repositorio.iniciar = async (_, documento) => ({
      id: documento.clave_operacion,
      activa: false,
    });
    const inicio = gestor.iniciar(7, "version");
    datos.solicitarPosicion(punto());
    await inicio;
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    afirmar.equal(gestor.obtenerEstado().error, "gpsSesionCerrada");
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(datos.lotes.length, 0);
  },
);

prueba(
  "el primer punto conserva el intervalo de 3 s y no se duplica al empezar el observador",
  async () => {
    const { datos, gestor, punto } = escenario();
    const inicio = gestor.iniciar(7, "version");
    datos.solicitarPosicion(punto());
    await inicio;
    datos.observarPosicion(punto());
    datos.ahora += 2999;
    datos.observarPosicion(punto());
    await esperar();
    afirmar.equal(datos.lotes.length, 1);
    datos.ahora += 1;
    datos.observarPosicion(punto());
    await esperar();
    afirmar.equal(datos.lotes.length, 2);
    afirmar.notEqual(
      datos.lotes[0].posiciones[0].id,
      datos.lotes[1].posiciones[0].id,
    );
    await gestor.detener();
  },
);

prueba(
  "el primer lote incierto conserva UUID y cuerpo al reintentar sin reactivar GPS",
  async () => {
    const { datos, gestor, repositorio, punto, ErrorAplicacion } = escenario();
    const intentos = [];
    repositorio.enviar = async (_, lote) => {
      intentos.push(lote);
      if (intentos.length === 1) throw new ErrorAplicacion("conexion", 0);
      return { activa: true };
    };
    const inicio = gestor.iniciar(7, "version");
    datos.solicitarPosicion(punto());
    await inicio;
    afirmar.equal(gestor.obtenerEstado().fase, "pendiente");
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    afirmar.equal(datos.retiradas, 1);
    const cuerpo = JSON.stringify(intentos[0]);
    await gestor.reintentar();
    afirmar.equal(intentos[0], intentos[1]);
    afirmar.equal(JSON.stringify(intentos[1]), cuerpo);
    afirmar.equal(datos.observaciones, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "detenido");
  },
);

prueba(
  "el primer envío de otra sesión no hereda esperas del seguimiento anterior",
  async () => {
    const { RepositorioSeguimientoHttp } = crearCargadorChofer()(
      "lib/chofer/modulos/seguimiento/datos/RepositorioSeguimientoHttp",
    );
    let ahora = Date.now();
    const demoras = [];
    const repositorio = new RepositorioSeguimientoHttp(
      {
        solicitar: async (_, { cuerpo }) => {
          const sesion = {
            id: cuerpo.sesion ?? cuerpo.clave_operacion,
            activa: true,
            vence_en: new Date(ahora + 3600000).toISOString(),
          };
          return cuerpo.posiciones ? { sesion } : sesion;
        },
      },
      () => ahora,
      async (demora) => {
        demoras.push(demora);
        ahora += demora;
      },
    );
    const enviar = (sesion) =>
      repositorio.enviar(7, {
        sesion,
        clave_operacion: generarUuid(),
        posiciones: [
          {
            id: generarUuid(),
            latitud: "-16.5000000",
            longitud: "-68.1400000",
            precision_m: "8.00",
            capturada_en: new Date(ahora).toISOString(),
            velocidad_m_s: null,
            rumbo: null,
          },
        ],
      });
    const anterior = generarUuid();
    const nueva = generarUuid();
    await repositorio.iniciar(7, { clave_operacion: anterior, version: "1" });
    await enviar(anterior);
    await repositorio.detener(7, { sesion: anterior, motivo: "chofer" });
    await repositorio.iniciar(7, { clave_operacion: nueva, version: "1" });
    await enviar(nueva);
    afirmar.deepEqual(demoras, []);
    await enviar(nueva);
    afirmar.deepEqual(demoras, [2100]);
  },
);

for (const idioma of ["es", "en"]) {
  prueba(
    `el mapa informa la búsqueda y cambia a GPS activo con una posición real (${idioma})`,
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
        namespace: "chofer",
      });
      const cargar = crearCargadorChofer({
        "react/jsx-runtime": jsx,
        "next-intl": { useTranslations: () => t },
        "lucide-react": iconos,
      });
      const Boton = cargar(
        "components/chofer/BotonUbicacionMapaChofer",
      ).default;
      let aperturas = 0;
      const propiedades = {
        estado: { fase: "iniciando" },
        conPosicion: false,
        alAbrir: () => {
          aperturas += 1;
        },
      };
      const dibujar = (cambios = {}) =>
        representar(React.createElement(Boton, { ...propiedades, ...cambios }));
      for (const fase of ["iniciando", "buscando"]) {
        const html = dibujar({ estado: { fase } });
        afirmar.ok(html.includes(t("buscandoUbicacion")));
        afirmar.ok(html.includes(t(`gps.${fase}`)));
        afirmar.match(html, /role="status"/);
        afirmar.match(html, /motion-safe:animate-spin/);
      }
      const activo = dibujar({
        estado: { fase: "compartiendo" },
        conPosicion: true,
      });
      afirmar.ok(activo.includes(t("gpsActivo")));
      afirmar.doesNotMatch(activo, /animate-spin/);
      const inactivo = dibujar({ estado: null });
      afirmar.ok(inactivo.includes(t("ubicacion")));
      afirmar.ok(!inactivo.includes(t("buscandoUbicacion")));
      Boton(propiedades).props.onClick();
      afirmar.equal(aperturas, 1);
    },
  );
}

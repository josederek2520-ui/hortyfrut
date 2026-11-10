import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { randomUUID as generarUuid } from "node:crypto";
import { setImmediate as esperar } from "node:timers/promises";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

class ErrorApi extends Error {
  constructor(status) {
    super();
    this.status = status;
  }
}
const apiFalsa = { api: async () => {}, ApiError: ErrorApi };
const cargador = crearCargadorChofer({ "@/lib/api": apiFalsa });
const { SonidoChat } = cargador("lib/chat/SonidoChat");
const { GestorEnviosChat } = cargador("lib/chat/GestorEnviosChat");

prueba(
  "el audio suena una vez por mensaje recibido y respeta el silencio",
  async () => {
    let reproducciones = 0;
    const preferencias = new Map(),
      estados = [];
    const almacen = {
      getItem: (clave) => preferencias.get(clave) ?? null,
      setItem: (clave, valor) => preferencias.set(clave, valor),
    };
    const crearAudio = () => ({
      play: async () => {
        reproducciones++;
      },
      pause: () => {},
      currentTime: 0,
    });
    const sonido = new SonidoChat(
      1,
      (estado) => estados.push(estado),
      crearAudio,
      almacen,
      (_, accion) => accion(),
    );
    sonido.estadoInicial();
    await sonido.avisar(5);
    await sonido.avisar(5);
    await sonido.avisar(4);
    afirmar.equal(reproducciones, 1);
    const otra = new SonidoChat(
      1,
      () => {},
      crearAudio,
      almacen,
      (_, accion) => accion(),
    );
    otra.estadoInicial();
    await otra.avisar(5);
    afirmar.equal(reproducciones, 1);
    sonido.silenciar();
    await sonido.avisar(6);
    afirmar.equal(reproducciones, 1);
    await sonido.activar();
    afirmar.equal(estados.at(-1), "activo");
    sonido.cerrar();
    await sonido.avisar(7);
    afirmar.equal(reproducciones, 2);
  },
);
prueba(
  "el bloqueo de autoplay mantiene el chat y ofrece activar sonido",
  async () => {
    const estados = [];
    const sonido = new SonidoChat(
      1,
      (estado) => estados.push(estado),
      () => ({
        play: async () => {
          throw new Error("NotAllowedError");
        },
        pause: () => {},
        currentTime: 0,
      }),
      null,
      (_, accion) => accion(),
    );
    sonido.estadoInicial();
    await sonido.avisar(1);
    afirmar.equal(estados.at(-1), "pendiente");
    await sonido.activar();
    afirmar.equal(estados.at(-1), "pendiente");
  },
);
prueba(
  "un envio incierto conserva UUID y texto hasta obtener el acuse",
  async () => {
    const cuerpos = [];
    const gestor = new GestorEnviosChat(
      async (_, opciones) => {
        cuerpos.push(opciones.body);
        if (cuerpos.length === 1) throw new ErrorApi(0);
        return { ...JSON.parse(opciones.body), id: 8, conversacion: 3 };
      },
      generarUuid,
      1,
    );
    await afirmar.rejects(gestor.enviar(3, "  Hola  "));
    afirmar.equal(gestor.obtenerEstado().get(3).fase, "pendiente");
    await afirmar.rejects(gestor.enviar(3, "Otro cuerpo"));
    await gestor.reintentar(3);
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(JSON.parse(cuerpos[1]).texto, "Hola");
    afirmar.equal(gestor.obtenerEstado().size, 0);
  },
);
prueba(
  "cambiar de cuenta invalida el acuse tardio y borra pendientes de la anterior",
  async () => {
    let resolver;
    const gestor = new GestorEnviosChat(
      (_, opciones) =>
        new Promise((continuar) => {
          resolver = () =>
            continuar({ ...JSON.parse(opciones.body), id: 8, conversacion: 3 });
        }),
      generarUuid,
      1,
    );
    const pendiente = gestor.enviar(3, "Privado");
    gestor.limpiar();
    resolver();
    await afirmar.rejects(pendiente);
    afirmar.equal(gestor.obtenerEstado().size, 0);
  },
);

function escenarioCliente() {
  const temporizadores = new Map(),
    canales = [],
    avisos = [],
    sonidos = [];
  let contador = 0;
  const cargar = crearCargadorChofer(
    { "@/lib/api": apiFalsa },
    {
      setTimeout: (funcion, demora) => {
        const id = ++contador;
        temporizadores.set(id, { funcion, demora });
        return id;
      },
      clearTimeout: (id) => temporizadores.delete(id),
    },
  );
  const { ClienteChat } = cargar("lib/chat/ClienteChat");
  const cliente = new ClienteChat(
    1,
    (aviso) => avisos.push(aviso),
    async () => ({
      usuario: 1,
      acceso: "x".repeat(43),
      websocket: "/ws/chat/",
    }),
    (url) => {
      const canal = {
        url,
        send: (contenido) => {
          canal.ultimo = JSON.parse(contenido);
        },
        close: () => {},
      };
      canales.push(canal);
      return canal;
    },
    () => "https://propio.trycloudflare.com",
    () => ({
      estadoInicial: () => "pendiente",
      avisar: async (id) => sonidos.push(id),
      cerrar: () => {},
    }),
  );
  return { cliente, canales, avisos, sonidos, temporizadores };
}
function estado(revision, id = null) {
  return {
    usuario: 1,
    revision,
    no_leidos: id ? 1 : 0,
    ultimo_recibido: id
      ? {
          id,
          conversacion: 3,
          autor: { id: 2, nombre: "Luis" },
          creado_en: "2026-11-04T12:00:00Z",
        }
      : null,
  };
}
prueba(
  "la conexion privada usa WSS y no reproduce historial, envios propios ni avisos duplicados",
  async () => {
    const escena = escenarioCliente();
    escena.cliente.iniciar();
    await esperar();
    const canal = escena.canales[0];
    canal.onopen();
    afirmar.equal(canal.url, "wss://propio.trycloudflare.com/ws/chat/");
    afirmar.equal(canal.ultimo.acceso, "x".repeat(43));
    const entregar = (datos, inicial = false) =>
      canal.onmessage({
        data: JSON.stringify({ tipo: "estado", inicial, datos }),
      });
    entregar(estado(1, 10), true);
    afirmar.equal(escena.sonidos.length, 0);
    entregar(estado(2, 10));
    afirmar.equal(escena.sonidos.length, 0);
    entregar(estado(3, 11));
    entregar(estado(3, 11));
    entregar(estado(2, 10));
    afirmar.deepEqual(escena.sonidos, [11]);
    afirmar.equal(escena.avisos.length, 1);
    escena.cliente.cerrar();
    entregar(estado(4, 12));
    afirmar.deepEqual(escena.sonidos, [11]);
    afirmar.equal(escena.temporizadores.size, 0);
  },
);
prueba(
  "la reconexion vuelve a obtener acceso sin anunciar mensajes recuperados como nuevos",
  async () => {
    const escena = escenarioCliente();
    escena.cliente.iniciar();
    await esperar();
    escena.canales[0].onopen();
    escena.canales[0].onmessage({
      data: JSON.stringify({
        tipo: "estado",
        inicial: true,
        datos: estado(1, 10),
      }),
    });
    escena.canales[0].onclose({ code: 1006 });
    const [id, tarea] = [...escena.temporizadores.entries()].find(
      ([, tarea]) => tarea.demora === 1000,
    );
    escena.temporizadores.delete(id);
    tarea.funcion();
    await esperar();
    const nuevo = escena.canales[1];
    nuevo.onopen();
    nuevo.onmessage({
      data: JSON.stringify({
        tipo: "estado",
        inicial: true,
        datos: estado(3, 12),
      }),
    });
    afirmar.equal(escena.sonidos.length, 0);
    afirmar.equal(
      escena.cliente.obtenerEstado().resumen.ultimo_recibido.id,
      12,
    );
    escena.cliente.cerrar();
  },
);
prueba(
  "las burbujas muestran texto escapado y las traducciones del chat coinciden",
  () => {
    const es = JSON.parse(
      leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
    );
    const en = JSON.parse(
      leerArchivo(new URL("../src/messages/en.json", import.meta.url), "utf8"),
    );
    afirmar.deepEqual(Object.keys(es.chat).sort(), Object.keys(en.chat).sort());
    afirmar.deepEqual(
      Object.keys(es.chat.conexion).sort(),
      Object.keys(en.chat.conexion).sort(),
    );
    const cargar = crearCargadorChofer({
      react: React,
      "react/jsx-runtime": jsx,
      "lucide-react": new Proxy({}, { get: () => () => null }),
      "next-intl": {
        useLocale: () => "es",
        useTranslations: (namespace) =>
          crearTraductor({ locale: "es", messages: es, namespace }),
      },
    });
    const Burbuja = cargar("components/chat/BurbujaMensajeChat").default;
    const html = representar(
      React.createElement(Burbuja, {
        propio: true,
        mensaje: {
          texto: '<script>alert("x")</script>',
          creado_en: "2026-11-04T12:00:00Z",
          leido_en: "2026-11-04T12:01:00Z",
        },
      }),
    );
    afirmar.ok(!html.includes("<script>"));
    afirmar.ok(html.includes("&lt;script&gt;"));
    afirmar.ok(html.includes("Leído"));
  },
);

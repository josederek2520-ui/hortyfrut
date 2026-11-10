import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { setImmediate as esperar } from "node:timers/promises";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";
class ErrorApi extends Error {
  constructor(status) {
    super();
    this.status = status;
  }
}
function datos(cambios = {}) {
  return {
    despacho: 7,
    version_despacho: "a".repeat(64),
    estado: "en_ruta",
    consultado_en: "2026-11-04T12:00:03Z",
    progreso: {
      total: 2,
      completadas: 0,
      siguiente: {
        id: 9,
        cliente_nombre: "Cliente",
        sucursal_nombre: "Centro",
        llegada_en: null,
      },
    },
    seguimiento: {
      id: "sesion",
      activa: true,
      iniciada_en: "2026-11-04T11:59:00Z",
      cerrada_en: null,
      ultima_posicion: {
        id: "punto",
        latitud: "-16.5",
        longitud: "-68.14",
        precision_m: "8.00",
        capturada_en: "2026-11-04T12:00:00Z",
        recibida_en: "2026-11-04T12:00:01Z",
      },
    },
    ...cambios,
  };
}
function escenario(solicitar) {
  const temporizadores = new Map(),
    conexiones = [],
    solicitudes = [];
  let consecutivo = 0;
  const cargar = crearCargadorChofer(
    { "@/lib/api": { api: () => {}, ApiError: ErrorApi } },
    {
      setTimeout: (funcion, demora) => {
        const id = ++consecutivo;
        temporizadores.set(id, { funcion, demora });
        return id;
      },
      clearTimeout: (id) => temporizadores.delete(id),
    },
  );
  const { ClienteSupervision } = cargar(
    "components/despachos/ClienteSupervision",
  );
  const cliente = new ClienteSupervision(
    7,
    async (...argumentos) => {
      solicitudes.push(argumentos);
      return solicitar
        ? solicitar(...argumentos)
        : {
            despacho: 7,
            acceso: "x".repeat(43),
            websocket: "/ws/seguimiento/7/",
          };
    },
    (url) => {
      const conexion = {
        url,
        enviados: [],
        cierres: 0,
        send(texto) {
          this.enviados.push(JSON.parse(texto));
        },
        close() {
          this.cierres++;
        },
      };
      conexiones.push(conexion);
      return conexion;
    },
    () => "http://localhost:3000",
  );
  return { cargar, cliente, conexiones, solicitudes, temporizadores };
}
async function conectar(escena) {
  escena.cliente.iniciar();
  await esperar();
  const canal = escena.conexiones.at(-1);
  canal.onopen();
  canal.onmessage({
    data: JSON.stringify({ tipo: "seguimiento", datos: datos() }),
  });
  return canal;
}
prueba(
  "el acceso efimero viaja en el primer mensaje y no en la URL del canal",
  async () => {
    const escena = escenario();
    const canal = await conectar(escena);
    afirmar.equal(canal.url, "ws://localhost:3000/ws/seguimiento/7/");
    afirmar.equal(canal.enviados[0].acceso, "x".repeat(43));
    afirmar.equal(escena.solicitudes[0][1].method, "POST");
    afirmar.equal(escena.cliente.obtenerEstado().fase, "en_vivo");
    escena.cliente.detener();
    afirmar.equal(escena.temporizadores.size, 0);
  },
);
prueba("una respuesta tardia tras salir no abre otro canal", async () => {
  let resolver;
  const escena = escenario(
    () =>
      new Promise((continuar) => {
        resolver = continuar;
      }),
  );
  escena.cliente.iniciar();
  escena.cliente.detener();
  resolver({
    despacho: 7,
    acceso: "x".repeat(43),
    websocket: "/ws/seguimiento/7/",
  });
  await esperar();
  afirmar.equal(escena.conexiones.length, 0);
  afirmar.equal(escena.cliente.obtenerEstado().fase, "inactivo");
});
prueba(
  "el cliente conserva la medicion reciente y descarta mensajes atrasados",
  async () => {
    const escena = escenario(),
      canal = await conectar(escena);
    const anterior = datos();
    anterior.consultado_en = "2026-11-04T12:00:04Z";
    anterior.seguimiento.ultima_posicion.capturada_en = "2026-11-04T11:59:59Z";
    canal.onmessage({
      data: JSON.stringify({ tipo: "seguimiento", datos: anterior }),
    });
    afirmar.equal(
      escena.cliente.obtenerEstado().datos.seguimiento.posicion.capturadaEn,
      "2026-11-04T12:00:00Z",
    );
    escena.cliente.detener();
  },
);
prueba(
  "perder permiso limpia la ubicacion y bloquea la reconexion",
  async () => {
    const escena = escenario(),
      canal = await conectar(escena);
    canal.onclose({ code: 4403 });
    escena.cliente.iniciar();
    await esperar();
    afirmar.equal(escena.cliente.obtenerEstado().datos, null);
    afirmar.equal(escena.cliente.obtenerEstado().fase, "sin_permiso");
    afirmar.equal(escena.conexiones.length, 1);
    afirmar.equal(escena.temporizadores.size, 0);
  },
);
prueba(
  "la reconexion obtiene otro acceso y el ultimo estado confirmado",
  async () => {
    const escena = escenario(),
      canal = await conectar(escena);
    canal.onclose({ code: 1006 });
    afirmar.equal(escena.cliente.obtenerEstado().fase, "reconectando");
    afirmar.equal(
      escena.cliente.obtenerEstado().datos.seguimiento.posicion.id,
      "punto",
    );
    const [id, tarea] = [...escena.temporizadores.entries()].find(
      ([, tarea]) => tarea.demora === 1000,
    );
    escena.temporizadores.delete(id);
    tarea.funcion();
    await esperar();
    afirmar.equal(escena.solicitudes.length, 2);
    escena.cliente.detener();
  },
);
prueba(
  "GPS antiguo, detenido o ausente tiene un estado explicito y nunca se inventa",
  () => {
    const { leerSupervision, estadoUbicacion } = escenario().cargar(
      "components/despachos/tiposSupervision",
    );
    const actual = leerSupervision(datos(), 7);
    afirmar.equal(
      estadoUbicacion(actual, Date.parse("2026-11-04T12:00:15Z")),
      "compartiendo",
    );
    afirmar.equal(
      estadoUbicacion(actual, Date.parse("2026-11-04T12:00:16Z")),
      "desactualizada",
    );
    actual.seguimiento.activa = false;
    afirmar.equal(estadoUbicacion(actual, Date.now()), "detenido");
    afirmar.equal(
      estadoUbicacion(
        leerSupervision(datos({ seguimiento: null }), 7),
        Date.now(),
      ),
      "sin_compartir",
    );
    afirmar.throws(() => leerSupervision(datos(), 8));
    const invalido = datos();
    invalido.seguimiento.ultima_posicion.latitud = "";
    afirmar.throws(() => leerSupervision(invalido, 7));
  },
);
prueba(
  "la cola GPS espacia lotes tras una respuesta lenta y conserva su cuerpo",
  async () => {
    const { RepositorioSeguimientoHttp } = escenario().cargar(
      "lib/chofer/modulos/seguimiento/datos/RepositorioSeguimientoHttp",
    );
    let ahora = 10000;
    const enviados = [],
      demoras = [];
    const repositorio = new RepositorioSeguimientoHttp(
      {
        solicitar: async (_, opciones) => {
          enviados.push(opciones.cuerpo);
          return {
            sesion: {
              id: "12345678-1234-1234-1234-123456789012",
              activa: true,
              vence_en: "2026-11-04T13:00:00Z",
            },
          };
        },
      },
      () => ahora,
      async (demora) => {
        demoras.push(demora);
        ahora += demora;
      },
    );
    const lote = { posiciones: [{ id: "punto" }] };
    await repositorio.enviar(7, lote);
    ahora += 100;
    await repositorio.enviar(7, lote);
    afirmar.deepEqual(demoras, [2000]);
    afirmar.equal(enviados[0], lote);
    afirmar.equal(enviados[1], lote);
  },
);

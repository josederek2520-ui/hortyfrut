import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { crearCargador } from "./cargar.mjs";

const cargar = crearCargador();
const { GestorRutas } = cargar("modulos/recorrido/aplicacion/GestorRutas");
const { GestorOperaciones } = cargar(
  "modulos/recorrido/aplicacion/GestorOperaciones",
);
const { ErrorAplicacion } = cargar("compartido/dominio/Errores");
const { ordenarRuta, moverParada } = cargar(
  "modulos/recorrido/aplicacion/ordenRuta",
);
const { leerRutaViaje } = cargar(
  "modulos/recorrido/datos/transformacionesRuta",
);
const { RepositorioRutasHttp } = cargar(
  "modulos/recorrido/datos/RepositorioRutasHttp",
);
const { ClienteApi } = cargar("infraestructura/api/ClienteApi");
const puntos = [
  { tipo: "almacen", parada: null, orden: 0, posicion: [-68, -16] },
  ...Array.from({ length: 12 }, (_, indice) => ({
    tipo: "sucursal",
    parada: indice + 1,
    orden: indice + 1,
    posicion: [-68, -16],
  })),
  { tipo: "retorno", parada: null, orden: 13, posicion: [-68, -16] },
];

prueba(
  "ordenar conserva todas las sucursales entre paginas y quita el trazado anterior hasta recalcular",
  () => {
    const ruta = {
      puntos,
      plan: { id: 9 },
      estado: "lista",
      puedeAprobar: true,
    };
    const orden = Array.from({ length: 12 }, (_, indice) => indice + 1);
    const cambiado = moverParada(orden, 9, 1);
    afirmar.equal(cambiado[10], 10);
    afirmar.equal(orden[9], 10);
    const propuesta = ordenarRuta(ruta, cambiado);
    afirmar.equal(propuesta.puntos.length, 14);
    afirmar.equal(propuesta.puntos[11].parada, 10);
    afirmar.equal(propuesta.plan, null);
    afirmar.equal(propuesta.puedeAprobar, false);
    afirmar.equal(ruta.plan.id, 9);
    afirmar.throws(() => ordenarRuta(ruta, orden.slice(0, 10)));
    afirmar.throws(() =>
      ordenarRuta(
        ruta,
        orden.map(() => 1),
      ),
    );
  },
);

prueba(
  "calcular conserva UUID y cuerpo completo ante un resultado incierto y bloquea otras operaciones",
  async () => {
    const llamadas = [];
    let primera = true,
      uuids = 0;
    const gestor = new GestorRutas(
      {
        operar: async (_viaje, accion, documento) => {
          llamadas.push({
            accion,
            documento: JSON.parse(JSON.stringify(documento)),
          });
          if (primera) {
            primera = false;
            throw new ErrorAplicacion("conexion", 0);
          }
          return { despacho: 7 };
        },
      },
      () => `uuid-${++uuids}`,
    );
    const orden = Array.from({ length: 12 }, (_, indice) => indice + 1);
    await afirmar.rejects(() =>
      gestor.ejecutar(7, "calcular-ruta", {
        version: "v1",
        orden_paradas: orden,
      }),
    );
    orden.reverse();
    await afirmar.rejects(() =>
      gestor.ejecutar(7, "aprobar-ruta", { version: "v2", plan: 9 }),
    );
    await gestor.reintentar(7);
    afirmar.deepEqual(llamadas[0], llamadas[1]);
    afirmar.equal(llamadas[1].documento.orden_paradas.length, 12);
    afirmar.equal(llamadas[1].documento.orden_paradas[0], 1);
    afirmar.equal(uuids, 1);
    afirmar.equal(gestor.pendiente(7), undefined);
  },
);

prueba(
  "una planificacion pendiente impide iniciar y una salida pendiente impide planificar",
  async () => {
    const fallo = async () => {
      throw new ErrorAplicacion("conexion", 0);
    };
    let rutas;
    const viajes = new GestorOperaciones(
      { operar: fallo },
      () => "viaje",
      (id) => rutas.tieneOperacion(id),
    );
    rutas = new GestorRutas(
      { operar: fallo },
      () => "ruta",
      (id) => viajes.tieneOperacion(id),
    );
    await afirmar.rejects(() =>
      rutas.ejecutar(7, "calcular-ruta", { version: "v1" }),
    );
    await afirmar.rejects(
      () => viajes.ejecutar(7, "iniciar", { version: "v1" }),
      /pendiente/,
    );
    rutas.limpiar();
    await afirmar.rejects(() =>
      viajes.ejecutar(7, "iniciar", { version: "v1" }),
    );
    await afirmar.rejects(
      () => rutas.ejecutar(7, "calcular-ruta", { version: "v1" }),
      /pendiente/,
    );
  },
);

prueba(
  "una respuesta del recorrido de una cuenta anterior no se acepta despues de limpiar la sesion",
  async () => {
    let terminar;
    const gestor = new GestorRutas(
      {
        operar: () =>
          new Promise((resolver) => {
            terminar = resolver;
          }),
      },
      () => "uuid",
    );
    const resultado = gestor.ejecutar(7, "aprobar-ruta", {
      version: "v1",
      plan: 9,
    });
    gestor.limpiar();
    terminar({ despacho: 7 });
    await afirmar.rejects(resultado, /sesion/);
    afirmar.equal(gestor.pendiente(7), undefined);
  },
);

prueba(
  "un rechazo definitivo libera la operacion y un nuevo intento recibe otro UUID",
  async () => {
    let cantidad = 0;
    const gestor = new GestorRutas(
      {
        operar: async () => {
          throw new ErrorAplicacion("conflicto", 409);
        },
      },
      () => String(++cantidad),
    );
    await afirmar.rejects(() =>
      gestor.ejecutar(7, "aprobar-ruta", { version: "v1", plan: 9 }),
    );
    afirmar.equal(gestor.pendiente(7), undefined);
    await afirmar.rejects(() =>
      gestor.ejecutar(7, "aprobar-ruta", { version: "v2", plan: 10 }),
    );
    afirmar.equal(cantidad, 2);
  },
);

prueba(
  "las escrituras de recorrido usan exclusivamente la API propia y la lista completa de paradas",
  async () => {
    const llamadas = [];
    const repositorio = new RepositorioRutasHttp({
      solicitar: async (ruta, opciones) => {
        llamadas.push({ ruta, opciones });
        return {
          despacho: 7,
          version_despacho: "a".repeat(64),
          preparando: true,
          puede_ordenar: true,
          puede_calcular: true,
          puede_aprobar: false,
          estado: "sin_calcular",
          puntos: [],
          faltantes: [],
          plan: null,
          trafico_en_vivo: false,
        };
      },
    });
    const documento = {
      version: "a".repeat(64),
      clave_operacion: "uuid",
      orden_paradas: Array.from({ length: 12 }, (_, i) => i + 1),
    };
    const ruta = await repositorio.operar(7, "calcular-ruta", documento);
    afirmar.equal(llamadas[0].ruta, "movil/mis-despachos/7/calcular-ruta/");
    afirmar.equal(llamadas[0].opciones.metodo, "POST");
    afirmar.equal(llamadas[0].opciones.cuerpo.orden_paradas.length, 12);
    afirmar.equal(ruta.preparando, true);
    await afirmar.rejects(() => repositorio.operar(7, "iniciar", documento));
  },
);

prueba(
  "el recorrido confirmado antes de salir se puede revisar y despues de salir exige una version fijada",
  () => {
    const puntosApi = [
      {
        tipo: "almacen",
        orden: 0,
        parada: null,
        sucursal: null,
        nombre: "Central",
        cliente: "",
        latitud: "-16",
        longitud: "-68",
      },
      {
        tipo: "sucursal",
        orden: 1,
        parada: 1,
        sucursal: 1,
        nombre: "Destino",
        cliente: "Cliente",
        latitud: "-16.01",
        longitud: "-68.01",
      },
      {
        tipo: "retorno",
        orden: 2,
        parada: null,
        sucursal: null,
        nombre: "Central",
        cliente: "",
        latitud: "-16",
        longitud: "-68",
      },
    ];
    const documento = {
      despacho: 7,
      version_despacho: "a".repeat(64),
      preparando: true,
      estado: "lista",
      trafico_en_vivo: false,
      puntos: puntosApi,
      faltantes: [],
      puede_calcular: true,
      puede_ordenar: true,
      puede_aprobar: false,
      plan: {
        id: 9,
        numero: 1,
        puntos: puntosApi,
        geometria: {
          type: "LineString",
          coordinates: [
            [-68, -16],
            [-68.01, -16.01],
            [-68, -16],
          ],
        },
        tramos: [
          { orden: 1, distancia_m: "100", duracion_s: "10" },
          { orden: 2, distancia_m: "100", duracion_s: "10" },
        ],
        distancia_m: "200",
        duracion_s: "20",
        aprobada_en: "2026-11-03T10:00:00Z",
        fijada_en: null,
        trafico_en_vivo: false,
      },
    };
    afirmar.equal(leerRutaViaje(documento).estado, "lista");
    documento.preparando = false;
    afirmar.throws(() => leerRutaViaje(documento));
    documento.plan.fijada_en = "2026-11-03T10:01:00Z";
    afirmar.equal(leerRutaViaje(documento).plan.id, 9);
  },
);

prueba(
  "los errores de operaciones muestran el motivo del servidor y conservan la clasificacion",
  async () => {
    const cliente = new ClienteApi(
      "https://hortyfru.test/api/v1/",
      async () => "credencial-sintetica",
      async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          errors: { ruta: ["Revisa los accesos reales de los destinos."] },
        }),
      }),
    );
    await afirmar.rejects(
      () =>
        cliente.solicitar("movil/mis-despachos/7/calcular-ruta/", {
          metodo: "POST",
          cuerpo: {},
        }),
      (error) =>
        error.codigo === "validacion" &&
        error.detalle === "Revisa los accesos reales de los destinos.",
    );
  },
);

import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { crearCargador } from "./cargar.mjs";
const cargar = crearCargador();
const { ErrorAplicacion } = cargar("compartido/dominio/Errores");
const { ClienteApi, normalizarServidor } = cargar(
  "infraestructura/api/ClienteApi",
);
const { RevisionPedido } = cargar(
  "modulos/recorrido/aplicacion/RevisionPedido",
);
const { GestorOperaciones } = cargar(
  "modulos/recorrido/aplicacion/GestorOperaciones",
);
const { ServicioSesion } = cargar("modulos/sesion/aplicacion/ServicioSesion");
const { siguienteAccion } = cargar(
  "modulos/recorrido/aplicacion/accionesViaje",
);

prueba(
  "la URL de produccion exige HTTPS y la credencial se limita a la API movil",
  async () => {
    afirmar.equal(
      normalizarServidor("https://sistema.test/api/v1", false),
      "https://sistema.test/api/v1/",
    );
    for (const url of [
      "http://sistema.test/api/v1/",
      "https://usuario:clave@sistema.test/api/v1/",
      "https://sistema.test/",
      "https://sistema.test/api/v1/?token=secreto",
    ])
      afirmar.throws(() => normalizarServidor(url, false));
    const llamadas = [];
    const cliente = new ClienteApi(
      "https://sistema.test/api/v1/",
      async () => "credencial-prueba",
      async (url, opciones) => {
        llamadas.push({ url, opciones });
        return { ok: true, status: 200, json: async () => ({ count: 0 }) };
      },
    );
    await cliente.solicitar("movil/mis-despachos/?page=1");
    afirmar.equal(
      llamadas[0].opciones.headers.Authorization,
      "Bearer credencial-prueba",
    );
    afirmar.equal(llamadas[0].opciones.credentials, "omit");
    afirmar.equal(llamadas[0].opciones.redirect, "error");
    for (const ruta of [
      "despachos/",
      "https://otro.test/",
      "movil/../usuarios/",
    ])
      await afirmar.rejects(() => cliente.solicitar(ruta));
    afirmar.equal(llamadas.length, 1);
  },
);

prueba(
  "el acceso distingue credenciales incorrectas, datos invalidos y rechazos del servidor",
  async () => {
    for (const [contenido, codigo] of [
      [
        {
          detail: "Revisa los campos indicados.",
          errors: ["El correo o la contraseña no son correctos."],
        },
        "credenciales",
      ],
      [
        {
          detail: "Revisa los campos indicados.",
          errors: { identificador_dispositivo: ["Debe ser un UUID válido."] },
        },
        "validacionAcceso",
      ],
      ["<html><h1>Bad Request (400)</h1></html>", "configuracion"],
      [{ detail: "Bad Request" }, "configuracion"],
    ]) {
      const cliente = new ClienteApi(
        "https://sistema.test/api/v1/",
        async () => null,
        async () => ({
          ok: false,
          status: 400,
          json: async () => {
            if (typeof contenido === "string") throw new SyntaxError();
            return contenido;
          },
        }),
      );
      await afirmar.rejects(
        () =>
          cliente.solicitar("movil/iniciar-sesion/", {
            metodo: "POST",
            credencial: null,
          }),
        (error) =>
          error instanceof ErrorAplicacion &&
          error.codigo === codigo &&
          error.estado === 400,
      );
    }
  },
);

prueba(
  "una respuesta 401 anterior no cierra la sesion de otra cuenta",
  async () => {
    let vigente = "anterior",
      completar,
      indicarInicio;
    const iniciada = new Promise((resolver) => {
      indicarInicio = resolver;
    });
    const cliente = new ClienteApi(
      "https://sistema.test/api/v1/",
      async () => vigente,
      () =>
        new Promise((resolver) => {
          completar = resolver;
          indicarInicio();
        }),
    );
    let expiraciones = 0;
    cliente.alNoAutorizado = () => expiraciones++;
    const solicitud = cliente.solicitar("movil/sesion/");
    await iniciada;
    vigente = "nueva";
    completar({ ok: false, status: 401 });
    await afirmar.rejects(solicitud);
    afirmar.equal(expiraciones, 0);
  },
);

prueba(
  "los productos revisados se conservan entre paginas y se exige la lista completa",
  () => {
    const revision = new RevisionPedido(5, "a".repeat(64));
    const productos = Array.from({ length: 12 }, (_, indice) => ({
      id: indice + 1,
      pedido: 5,
      descargadaEn: null,
    }));
    revision.incorporar(productos.slice(0, 10), 12);
    for (let id = 1; id <= 10; id++) revision.alternar(id);
    afirmar.equal(revision.completa, false);
    afirmar.throws(() => revision.obtenerComprobadas());
    revision.incorporar(productos.slice(10), 12);
    revision.alternar(11);
    revision.alternar(12);
    afirmar.equal(revision.completa, true);
    afirmar.equal(revision.obtenerComprobadas().length, 12);
    revision.alternar(1);
    afirmar.equal(revision.completa, false);
    revision.alternar(1);
    afirmar.equal(revision.estaComprobada(12), true);
    afirmar.throws(() => revision.incorporar([{ id: 90, pedido: 6 }], 12));
    afirmar.throws(() => revision.incorporar([], 13));
  },
);

prueba(
  "un reintento incierto conserva UUID, version y productos comprobados",
  async () => {
    const llamadas = [];
    let intento = 0;
    let claves = 0;
    const gestor = new GestorOperaciones(
      {
        operar: async (viaje, accion, documento) => {
          llamadas.push({
            viaje,
            accion,
            documento: JSON.stringify(documento),
          });
          if (++intento === 1) throw new ErrorAplicacion("conexion", 0);
          return { id: viaje };
        },
      },
      () => `uuid-${++claves}`,
    );
    const checks = [1, 2];
    await afirmar.rejects(() =>
      gestor.ejecutar(3, "descargar-pedido", {
        version: "v1",
        parada: 2,
        pedido: 5,
        cargas_comprobadas: checks,
      }),
    );
    checks.push(9);
    await afirmar.rejects(() =>
      gestor.ejecutar(3, "llegar", { version: "v2" }),
    );
    afirmar.equal((await gestor.reintentar(3)).id, 3);
    afirmar.equal(llamadas[0].documento, llamadas[1].documento);
    afirmar.equal(claves, 1);
    afirmar.equal(gestor.pendiente(3), undefined);
  },
);

prueba(
  "los conflictos se resuelven actualizando y un doble toque no duplica la peticion",
  async () => {
    let terminar;
    let cantidad = 0;
    const gestor = new GestorOperaciones(
      {
        operar: () => {
          cantidad++;
          return new Promise((resolver) => {
            terminar = resolver;
          });
        },
      },
      () => "uuid",
    );
    const primera = gestor.ejecutar(1, "iniciar", { version: "v1" });
    await afirmar.rejects(() =>
      gestor.ejecutar(1, "iniciar", { version: "v1" }),
    );
    afirmar.equal(cantidad, 1);
    terminar({ id: 1 });
    await primera;
    const conflicto = new GestorOperaciones(
      {
        operar: async () => {
          throw new ErrorAplicacion("conflicto", 409);
        },
      },
      () => "uuid",
    );
    await afirmar.rejects(() =>
      conflicto.ejecutar(1, "iniciar", { version: "v1" }),
    );
    afirmar.equal(conflicto.pendiente(1), undefined);
  },
);

prueba(
  "cambiar de cuenta descarta resultados y operaciones de la cuenta anterior",
  async () => {
    let terminar;
    const gestor = new GestorOperaciones(
      {
        operar: () =>
          new Promise((resolver) => {
            terminar = resolver;
          }),
      },
      () => "uuid",
    );
    const primera = gestor.ejecutar(1, "iniciar", { version: "v1" });
    gestor.limpiar();
    terminar({ id: 1 });
    await afirmar.rejects(primera);
    afirmar.equal(gestor.pendiente(1), undefined);
  },
);

prueba(
  "la restauracion anterior no sustituye un acceso nuevo y se comparte en StrictMode",
  async () => {
    let terminar;
    let restauraciones = 0;
    const actual = {
      usuario: { id: 2, nombre: "Chofer" },
      credencial: "nueva",
    };
    const servicio = new ServicioSesion(
      {
        restaurar: () => {
          restauraciones++;
          return new Promise((resolver) => {
            terminar = resolver;
          });
        },
        ingresar: async () => actual,
        eliminarLocal: async () => {},
        cerrar: async () => {},
      },
      () => {},
    );
    const primero = servicio.restaurar(),
      segundo = servicio.restaurar();
    afirmar.equal(primero, segundo);
    afirmar.equal(restauraciones, 1);
    await servicio.ingresar("correo", "clave");
    terminar(null);
    await primero;
    afirmar.equal(servicio.obtenerEstado().sesion.usuario.id, 2);
    await servicio.cerrar();
    afirmar.equal(servicio.obtenerEstado().fase, "anonima");
  },
);

prueba(
  "la limpieza de una sesion termina antes de guardar la siguiente cuenta",
  async () => {
    const nueva = { usuario: { id: 3, nombre: "Chofer" } };
    let terminarLimpieza;
    let ingresos = 0;
    let eliminaciones = 0;
    const servicio = new ServicioSesion(
      {
        restaurar: async () => null,
        ingresar: async () => {
          ingresos++;
          return nueva;
        },
        cerrar: async () => {},
        eliminarLocal: () => {
          eliminaciones++;
          return new Promise((resolver) => {
            terminarLimpieza = resolver;
          });
        },
      },
      () => {},
    );
    const limpieza = servicio.expirar();
    afirmar.equal(servicio.expirar(), limpieza);
    const ingreso = servicio.ingresar("chofer@hortyfru.test", "clave");
    await Promise.resolve();
    afirmar.equal(servicio.obtenerEstado().fase, "iniciando");
    afirmar.equal(ingresos, 0);
    afirmar.equal(eliminaciones, 1);
    terminarLimpieza();
    await Promise.all([limpieza, ingreso]);
    afirmar.equal(ingresos, 1);
    afirmar.equal(servicio.obtenerEstado().sesion.usuario.id, 3);
  },
);

prueba(
  "la accion principal respeta envio, capacidad, llegada, permisos y retorno",
  () => {
    const viaje = {
      estado: "borrador",
      enviadoEn: "hoy",
      capacidad: "apta",
      paradas: [],
    };
    afirmar.equal(siguienteAccion(viaje, true), "iniciar");
    afirmar.equal(siguienteAccion({ ...viaje, enviadoEn: null }, true), null);
    afirmar.equal(
      siguienteAccion({ ...viaje, capacidad: "excedida" }, true),
      null,
    );
    afirmar.equal(siguienteAccion(viaje, false), null);
    const enRuta = {
      ...viaje,
      estado: "en_ruta",
      paradas: [{ id: 1, orden: 1, llegadaEn: null, descargadaEn: null }],
    };
    afirmar.equal(siguienteAccion(enRuta, true), "llegar");
    afirmar.equal(
      siguienteAccion(
        { ...enRuta, paradas: [{ ...enRuta.paradas[0], llegadaEn: "hoy" }] },
        true,
      ),
      "pedidos",
    );
    afirmar.equal(
      siguienteAccion(
        { ...enRuta, paradas: [{ ...enRuta.paradas[0], descargadaEn: "hoy" }] },
        true,
      ),
      "finalizar",
    );
    afirmar.equal(
      siguienteAccion({ ...viaje, estado: "cancelado" }, true),
      null,
    );
  },
);

prueba(
  "los contratos mantienen listas de diez y cantidades independientes",
  () => {
    const { leerPagina, leerPedido } = cargar(
      "modulos/despachos/datos/transformaciones",
    );
    afirmar.throws(() =>
      leerPagina({ count: 11, results: Array(11).fill({}) }, 1, (dato) => dato),
    );
    const pedido = leerPedido({
      pedido: 1,
      parada: 2,
      codigo_pedido: "PED-1",
      fecha_requerida: "2026-11-02",
      cajas: 2,
      unidades: 3,
      peso_kg: "5.4",
      productos: 1,
      asignaciones: 2,
      descargada_en: null,
      responsable_descarga_nombre: "",
      registro_anterior: false,
    });
    afirmar.equal(pedido.cajas, 2);
    afirmar.equal(pedido.unidades, 3);
    afirmar.equal(pedido.pesoKg, "5.4");
  },
);

prueba(
  "la tarjeta recibe el siguiente destino historico sin inventar destinos en viajes completados",
  () => {
    const { leerViaje } = cargar("modulos/despachos/datos/transformaciones");
    const documento = {
      id: 7,
      codigo: "DES-7",
      estado: "en_ruta",
      fecha_reparto: "2026-11-01",
      vehiculo_placa: "1234-ABC",
      chofer_nombre: "Chofer de pruebas",
      almacen_nombre: "Almacén de salida",
      enviado_en: "2026-11-01T10:00:00Z",
      version: "a".repeat(64),
      resumen: {
        cajas: 2,
        unidades: 3,
        peso_kg: "15.5",
        paradas: 2,
        completadas: 0,
        pedidos: 3,
        pedidos_descargados: 0,
        cajillas: 2,
      },
      siguiente_destino: {
        cliente_nombre: "Cliente histórico",
        sucursal_nombre: "Sucursal histórica",
        orden: 1,
      },
    };
    const destino = leerViaje(documento).siguienteDestino;
    afirmar.equal(destino?.cliente, "Cliente histórico");
    afirmar.equal(destino?.sucursal, "Sucursal histórica");
    afirmar.equal(
      leerViaje({ ...documento, estado: "finalizado", siguiente_destino: null })
        .siguienteDestino,
      null,
    );
    const { siguiente_destino, ...anterior } = documento;
    afirmar.equal(leerViaje(anterior).siguienteDestino, null);
  },
);

prueba(
  "el dominio y los casos de uso no dependen de Expo o React Native",
  () => {
    const raiz = new URL("../src/modulos/", import.meta.url);
    for (const modulo of readdirSync(raiz))
      for (const capa of ["dominio", "aplicacion"]) {
        const directorio = new URL(`${modulo}/${capa}/`, raiz);
        let archivos;
        try {
          archivos = readdirSync(directorio);
        } catch {
          continue;
        }
        for (const archivo of archivos)
          afirmar.ok(
            !/from ["'](?:react|expo)/.test(
              readFileSync(new URL(archivo, directorio), "utf8"),
            ),
            archivo,
          );
      }
    const { mensajes } = cargar("compartido/traducciones/mensajes");
    afirmar.deepEqual(
      Object.keys(mensajes.es).sort(),
      Object.keys(mensajes.en).sort(),
    );
  },
);

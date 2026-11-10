import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { randomUUID as generarUuid } from "node:crypto";
import { crearCargador } from "./cargar.mjs";
const cargar = crearCargador();
const { GestorSeguimiento } = cargar(
  "modulos/seguimiento/aplicacion/GestorSeguimiento",
);
const { ErrorAplicacion } = cargar("compartido/dominio/Errores");
const { RepositorioSeguimientoHttp } = cargar(
  "modulos/seguimiento/datos/RepositorioSeguimientoHttp",
);
const { areaPrecision } = cargar(
  "modulos/seguimiento/aplicacion/geometriaUbicacion",
);
const { GestorOperaciones } = cargar(
  "modulos/recorrido/aplicacion/GestorOperaciones",
);
const { ServicioSesion } = cargar("modulos/sesion/aplicacion/ServicioSesion");

prueba(
  "el adaptador nativo comprueba permiso y GPS encendido antes de observar",
  async () => {
    let permitir = false,
      encendido = false,
      observadas = 0;
    const cargarNativo = crearCargador({
      "expo-location": {
        requestForegroundPermissionsAsync: async () => ({ granted: permitir }),
        hasServicesEnabledAsync: async () => encendido,
        Accuracy: { High: 4 },
        watchPositionAsync: async () => {
          observadas++;
          return { remove() {} };
        },
      },
    });
    const { LocalizadorExpo } = cargarNativo(
      "modulos/seguimiento/datos/LocalizadorExpo.native",
    );
    const localizador = new LocalizadorExpo();
    await afirmar.rejects(
      localizador.autorizar(),
      (error) => error.codigo === "gpsPermiso",
    );
    permitir = true;
    await afirmar.rejects(
      localizador.autorizar(),
      (error) => error.codigo === "gpsApagado",
    );
    encendido = true;
    await localizador.autorizar();
    await localizador.observar(
      () => {},
      () => {},
    );
    afirmar.equal(observadas, 1);
  },
);

const esperar = () => new Promise((resolver) => setImmediate(resolver));
function diferido() {
  let resolver;
  const promesa = new Promise((continuar) => {
    resolver = continuar;
  });
  return { promesa, resolver };
}
function escenario() {
  const datos = {
    ahora: Date.now(),
    inicios: [],
    lotes: [],
    cierres: [],
    observaciones: 0,
    retiradas: 0,
    lectura: () => {},
    fallo: () => {},
    sesion: null,
  };
  const repositorio = {
    iniciar: async (viaje, documento) => {
      datos.inicios.push(documento);
      datos.sesion = {
        id: documento.clave_operacion,
        activa: true,
        venceEn: new Date(datos.ahora + 3600000).toISOString(),
      };
      return datos.sesion;
    },
    enviar: async (viaje, documento) => {
      datos.lotes.push(documento);
      return datos.sesion;
    },
    detener: async (viaje, documento) => {
      datos.cierres.push(documento);
      return { ...datos.sesion, activa: false };
    },
  };
  const localizador = {
    autorizar: async () => {},
    observar: async (lectura, fallo) => {
      datos.observaciones++;
      datos.lectura = lectura;
      datos.fallo = fallo;
      return { remove: () => datos.retiradas++ };
    },
  };
  const gestor = new GestorSeguimiento(
    repositorio,
    localizador,
    generarUuid,
    () => datos.ahora,
  );
  const punto = (cambios = {}) => ({
    latitud: -16.5,
    longitud: -68.14,
    precisionM: 8,
    instante: datos.ahora,
    velocidadMS: null,
    rumbo: null,
    ...cambios,
  });
  return { datos, repositorio, localizador, gestor, punto };
}

prueba(
  "el permiso denegado no abre una sesión ni comienza a capturar",
  async () => {
    const { gestor, localizador, datos } = escenario();
    localizador.autorizar = async () => {
      throw new ErrorAplicacion("gpsPermiso");
    };
    await gestor.iniciar(7, "version");
    afirmar.equal(datos.inicios.length, 0);
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(gestor.obtenerEstado().error, "gpsPermiso");
  },
);

prueba(
  "la captura envía coordenadas reales con precisión y detiene localmente antes del cierre HTTP",
  async () => {
    const { gestor, datos, punto, repositorio } = escenario();
    await gestor.iniciar(7, "version");
    afirmar.equal(gestor.obtenerEstado().fase, "buscando");
    datos.lectura(punto());
    await esperar();
    afirmar.equal(datos.lotes.length, 1);
    afirmar.equal(datos.lotes[0].posiciones[0].latitud, "-16.5000000");
    afirmar.equal(datos.lotes[0].posiciones[0].precision_m, "8.00");
    const cierre = diferido();
    repositorio.detener = () => cierre.promesa;
    const pendiente = gestor.detener();
    afirmar.equal(datos.retiradas, 1);
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    datos.lectura(punto({ instante: datos.ahora + 10000 }));
    afirmar.equal(datos.lotes.length, 1);
    cierre.resolver({ ...datos.sesion, activa: false });
    await pendiente;
    afirmar.equal(gestor.obtenerEstado().fase, "detenido");
  },
);

prueba(
  "se descartan lecturas antiguas, imposibles o imprecisas y se limita la frecuencia",
  async () => {
    const { gestor, datos, punto } = escenario();
    await gestor.iniciar(7, "version");
    for (const cambios of [
      { latitud: 100 },
      { instante: datos.ahora - 60000 },
      { precisionM: null },
      { precisionM: 150 },
      { longitud: NaN },
    ])
      datos.lectura(punto(cambios));
    await esperar();
    afirmar.equal(datos.lotes.length, 0);
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    datos.lectura(punto({ velocidadMS: -1, rumbo: -1 }));
    await esperar();
    datos.lectura(punto({ instante: datos.ahora + 1000 }));
    await esperar();
    afirmar.equal(datos.lotes.length, 1);
    afirmar.equal(datos.lotes[0].posiciones[0].velocidad_m_s, null);
    afirmar.equal(datos.lotes[0].posiciones[0].rumbo, null);
  },
);

prueba(
  "pasar a segundo plano durante la autorización impide abrir el seguimiento",
  async () => {
    const { gestor, localizador, datos } = escenario();
    const permiso = diferido();
    localizador.autorizar = () => permiso.promesa;
    const inicio = gestor.iniciar(7, "version");
    gestor.establecerPrimerPlano(false);
    permiso.resolver();
    await inicio;
    afirmar.equal(datos.inicios.length, 0);
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(gestor.obtenerEstado().fase, "detenido");
  },
);

prueba(
  "una respuesta de inicio tardía se cierra sin activar GPS después de salir de la app",
  async () => {
    const { gestor, datos, repositorio } = escenario();
    const respuesta = diferido();
    repositorio.iniciar = async (viaje, documento) => {
      datos.inicios.push(documento);
      return respuesta.promesa;
    };
    const inicio = gestor.iniciar(7, "version");
    await esperar();
    await afirmar.rejects(gestor.iniciar(8, "otra"));
    gestor.establecerPrimerPlano(false);
    respuesta.resolver({ id: datos.inicios[0].clave_operacion, activa: true });
    await inicio;
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(datos.cierres.length, 1);
    afirmar.equal(datos.cierres[0].motivo, "segundo_plano");
  },
);

prueba(
  "una suscripción nativa tardía se retira al detener y no vuelve a emitir",
  async () => {
    const { gestor, datos, localizador, punto } = escenario();
    const suscripcion = diferido();
    localizador.observar = (lectura) => {
      datos.lectura = lectura;
      return suscripcion.promesa;
    };
    const inicio = gestor.iniciar(7, "version");
    await esperar();
    gestor.establecerPrimerPlano(false);
    suscripcion.resolver({ remove: () => datos.retiradas++ });
    await inicio;
    datos.lectura(punto());
    afirmar.equal(datos.retiradas, 1);
    afirmar.equal(datos.lotes.length, 0);
    afirmar.equal(datos.cierres.length, 1);
  },
);

prueba(
  "un inicio incierto conserva UUID y versión y el reintento no reactiva la captura",
  async () => {
    const { gestor, repositorio, datos } = escenario();
    const original = repositorio.iniciar;
    repositorio.iniciar = async (viaje, documento) => {
      const sesion = await original(viaje, documento);
      if (datos.inicios.length === 1) throw new ErrorAplicacion("conexion");
      return sesion;
    };
    await gestor.iniciar(7, "version");
    afirmar.equal(gestor.obtenerEstado().fase, "pendiente");
    await gestor.reintentar();
    afirmar.equal(datos.inicios[0], datos.inicios[1]);
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(datos.cierres.length, 1);
  },
);

prueba(
  "un lote incierto conserva exactamente UUID y cuerpo, detiene GPS y permite comprobar el cierre",
  async () => {
    const { gestor, repositorio, datos, punto } = escenario();
    const original = repositorio.enviar;
    repositorio.enviar = async (viaje, documento) => {
      const sesion = await original(viaje, documento);
      if (datos.lotes.length === 1) throw new ErrorAplicacion("conexion");
      return sesion;
    };
    await gestor.iniciar(7, "version");
    datos.lectura(punto());
    await esperar();
    afirmar.equal(datos.retiradas, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "pendiente");
    await gestor.reintentar();
    afirmar.equal(datos.lotes[0], datos.lotes[1]);
    afirmar.equal(datos.cierres.length, 1);
    afirmar.equal(datos.observaciones, 1);
  },
);

prueba(
  "un rechazo definitivo o la limpieza de cuenta impiden recuperar una captura anterior",
  async () => {
    const { gestor, repositorio, datos, punto } = escenario();
    repositorio.enviar = async () => {
      throw new ErrorAplicacion("conflicto", 409);
    };
    await gestor.iniciar(7, "version");
    datos.lectura(punto());
    await esperar();
    afirmar.equal(gestor.obtenerEstado().fase, "error");
    afirmar.equal(datos.retiradas, 1);
    gestor.limpiar();
    datos.lectura(punto());
    afirmar.equal(gestor.obtenerEstado().viaje, null);
    afirmar.equal(gestor.obtenerEstado().posicion, null);
  },
);

prueba(
  "un cierre incierto conserva su cuerpo aunque el teléfono pase a segundo plano",
  async () => {
    const { gestor, repositorio, datos } = escenario();
    const original = repositorio.detener;
    repositorio.detener = async (viaje, documento) => {
      const sesion = await original(viaje, documento);
      if (datos.cierres.length === 1) throw new ErrorAplicacion("conexion");
      return sesion;
    };
    await gestor.iniciar(7, "version");
    await gestor.detener("chofer");
    afirmar.equal(gestor.obtenerEstado().fase, "pendiente");
    gestor.establecerPrimerPlano(false);
    await esperar();
    afirmar.equal(datos.cierres[0], datos.cierres[1]);
    afirmar.equal(datos.cierres[1].motivo, "chofer");
  },
);

prueba(
  "un error del GPS retira la captura y cierra la sesión sin confirmar ninguna operación del reparto",
  async () => {
    const { gestor, datos } = escenario();
    await gestor.iniciar(7, "version");
    datos.fallo();
    await esperar();
    afirmar.equal(datos.retiradas, 1);
    afirmar.equal(datos.cierres.length, 1);
    afirmar.equal(datos.cierres[0].motivo, "error_gps");
    afirmar.equal(gestor.obtenerEstado().error, "gpsSinSenal");
  },
);

prueba(
  "cambiar de cuenta durante una solicitud no inicia el GPS de la cuenta anterior",
  async () => {
    const { gestor, repositorio, datos } = escenario();
    const respuesta = diferido();
    repositorio.iniciar = () => respuesta.promesa;
    const inicio = gestor.iniciar(7, "version");
    await esperar();
    gestor.limpiar();
    respuesta.resolver({ id: generarUuid(), activa: true });
    await inicio;
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(gestor.obtenerEstado().viaje, null);
  },
);

prueba(
  "finalizar y cerrar sesión detienen la captura antes de esperar la red",
  async () => {
    const orden = [];
    const operaciones = new GestorOperaciones(
      {
        operar: async () => {
          orden.push("red");
          return {};
        },
      },
      generarUuid,
      () => false,
      () => orden.push("detener"),
    );
    await operaciones.ejecutar(7, "finalizar", { version: "version" });
    afirmar.deepEqual(orden, ["detener", "red"]);
    const servicio = new ServicioSesion(
      {
        cerrar: async () => {
          orden.push("cerrar-red");
        },
        eliminarLocal: async () => {},
      },
      () => {},
      () => orden.push("cerrar-captura"),
    );
    await servicio.cerrar();
    afirmar.ok(orden.indexOf("cerrar-captura") < orden.indexOf("cerrar-red"));
  },
);

prueba(
  "la API de seguimiento utiliza exclusivamente las acciones del viaje propio",
  async () => {
    const peticiones = [],
      id = generarUuid();
    const sesion = {
      id,
      activa: true,
      vence_en: new Date(Date.now() + 3600000).toISOString(),
    };
    const repositorio = new RepositorioSeguimientoHttp({
      solicitar: async (ruta, opciones) => {
        peticiones.push({ ruta, opciones });
        return ruta.endsWith("enviar-posiciones/") ? { sesion } : sesion;
      },
    });
    await repositorio.iniciar(7, { clave_operacion: id, version: "version" });
    await repositorio.enviar(7, {
      sesion: id,
      clave_operacion: generarUuid(),
      posiciones: [],
    });
    await repositorio.detener(7, { sesion: id, motivo: "chofer" });
    afirmar.ok(
      peticiones.every(
        ({ ruta, opciones }) =>
          ruta.startsWith("movil/mis-despachos/7/") &&
          opciones.metodo === "POST",
      ),
    );
    await afirmar.rejects(repositorio.iniciar(-1, {}));
  },
);

prueba(
  "el área GPS usa la precisión medida y conserva un anillo cerrado alrededor del chofer",
  () => {
    const figura = areaPrecision({
      latitud: -16.5,
      longitud: -68.14,
      precisionM: 30,
    });
    const anillo = figura.geometry.coordinates[0];
    afirmar.equal(anillo.length, 49);
    afirmar.deepEqual(anillo[0], anillo[48]);
    afirmar.ok(
      anillo.every(
        ([longitud, latitud]) =>
          Math.abs(longitud + 68.14) < 0.001 &&
          Math.abs(latitud + 16.5) < 0.001,
      ),
    );
  },
);

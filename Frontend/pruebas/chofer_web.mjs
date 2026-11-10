import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { randomUUID as generarUuid, webcrypto } from "node:crypto";
import { setImmediate as esperar } from "node:timers/promises";
import { readFileSync as leerArchivo } from "node:fs";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";
const cargar = crearCargadorChofer();
const nucleo = (ruta) => cargar(`lib/chofer/${ruta}`);
const { ErrorAplicacion } = nucleo("compartido/dominio/Errores");
const { GestorOperaciones } = nucleo(
  "modulos/recorrido/aplicacion/GestorOperaciones",
);
const { GestorRutas } = nucleo("modulos/recorrido/aplicacion/GestorRutas");
const { RevisionPedido } = nucleo(
  "modulos/recorrido/aplicacion/RevisionPedido",
);
const { GestorSeguimiento } = nucleo(
  "modulos/seguimiento/aplicacion/GestorSeguimiento",
);

prueba(
  "la prueba HTTP del reparto conserva UUID válidos sin depender de randomUUID",
  () => {
    const cargador = crearCargadorChofer(
      {},
      {
        crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
        Uint8Array,
      },
    );
    const { crearClaveOperacion } = cargador(
      "lib/chofer/infraestructura/crearClaveOperacion",
    );
    const claves = Array.from({ length: 50 }, crearClaveOperacion);
    afirmar.equal(new Set(claves).size, 50);
    for (const clave of claves)
      afirmar.match(
        clave,
        /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
      );
  },
);

prueba(
  "una descarga incierta conserva UUID, versión y las filas revisadas al reintentar",
  async () => {
    const solicitudes = [];
    const gestor = new GestorOperaciones(
      {
        operar: async (...datos) => {
          solicitudes.push(datos);
          if (solicitudes.length === 1)
            throw new ErrorAplicacion("conexion", 0);
          return { id: 7 };
        },
      },
      generarUuid,
    );
    const filas = [1, 2, 3];
    await afirmar.rejects(
      gestor.ejecutar(7, "descargar-pedido", {
        version: "original",
        parada: 2,
        pedido: 3,
        cargas_comprobadas: filas,
      }),
    );
    filas.push(9);
    await afirmar.rejects(gestor.ejecutar(7, "finalizar", { version: "otra" }));
    await gestor.reintentar(7);
    afirmar.equal(solicitudes.length, 2);
    afirmar.equal(solicitudes[0][2], solicitudes[1][2]);
    afirmar.equal(solicitudes[1][2].cargas_comprobadas.length, 3);
    afirmar.equal(gestor.pendiente(7), undefined);
  },
);

prueba(
  "la optimización incierta conserva el orden completo aunque se cambie el arreglo local",
  async () => {
    const solicitudes = [];
    const gestor = new GestorRutas(
      {
        operar: async (...datos) => {
          solicitudes.push(datos);
          if (solicitudes.length === 1)
            throw new ErrorAplicacion("conexion", 503);
          return {};
        },
      },
      generarUuid,
    );
    const orden = Array.from({ length: 13 }, (_, indice) => indice + 1);
    await afirmar.rejects(
      gestor.ejecutar(7, "optimizar-ruta", {
        version: "original",
        orden_paradas: orden,
      }),
    );
    orden.reverse();
    await gestor.reintentar(7);
    afirmar.equal(solicitudes[0][2], solicitudes[1][2]);
    afirmar.equal(solicitudes[1][2].orden_paradas[0], 1);
    afirmar.equal(solicitudes[1][2].orden_paradas.length, 13);
  },
);

prueba(
  "un cambio de cuenta invalida la respuesta tardía de una operación",
  async () => {
    let resolver;
    const respuesta = new Promise((continuar) => {
      resolver = continuar;
    });
    const gestor = new GestorOperaciones(
      { operar: () => respuesta },
      generarUuid,
    );
    const pendiente = gestor.ejecutar(7, "iniciar", { version: "original" });
    gestor.limpiar();
    resolver({ id: 7 });
    await afirmar.rejects(pendiente, (error) => error.codigo === "sesion");
    afirmar.equal(gestor.pendiente(7), undefined);
  },
);

prueba(
  "revisar una página no permite descargar un pedido con trece filas",
  () => {
    const revision = new RevisionPedido(3, "original");
    const filas = Array.from({ length: 13 }, (_, indice) => ({
      id: indice + 1,
      pedido: 3,
      descargadaEn: null,
    }));
    revision.incorporar(filas.slice(0, 10), 13);
    for (let id = 1; id <= 10; id++) revision.alternar(id);
    afirmar.equal(revision.completa, false);
    afirmar.throws(() => revision.obtenerComprobadas());
    revision.incorporar(filas.slice(10), 13);
    for (let id = 11; id <= 13; id++) revision.alternar(id);
    afirmar.equal(revision.completa, true);
    afirmar.equal(revision.obtenerComprobadas().length, 13);
    afirmar.throws(() => revision.incorporar([{ id: 14, pedido: 4 }], 13));
    afirmar.throws(() => revision.incorporar([], 14));
  },
);

prueba(
  "reordenar cruza páginas sin perder sucursales ni sus colores y retira el trazado anterior",
  () => {
    const { moverParada, ordenarRuta } = nucleo(
      "modulos/recorrido/aplicacion/ordenRuta",
    );
    const puntos = [
      { tipo: "almacen" },
      ...Array.from({ length: 12 }, (_, indice) => ({
        tipo: "sucursal",
        parada: indice + 1,
        color: indice + 1,
      })),
      { tipo: "retorno" },
    ];
    const ruta = { puntos, plan: { id: 3 }, estado: "lista" };
    const orden = moverParada(
      Array.from({ length: 12 }, (_, indice) => indice + 1),
      9,
      1,
    );
    const vista = ordenarRuta(ruta, orden);
    afirmar.equal(vista.puntos.length, 14);
    afirmar.equal(vista.puntos[11].parada, 10);
    afirmar.equal(vista.puntos[11].color, 10);
    afirmar.equal(vista.plan, null);
    afirmar.equal(ruta.plan.id, 3);
  },
);

function escenarioGps() {
  const datos = {
    ahora: Date.now(),
    observaciones: 0,
    retiradas: 0,
    lotes: [],
    lectura: () => {},
  };
  const repositorio = {
    iniciar: async (_, inicio) => ({
      id: inicio.clave_operacion,
      activa: true,
    }),
    enviar: async (_, lote) => {
      datos.lotes.push(lote);
      return { activa: true };
    },
    detener: async () => ({ activa: false }),
  };
  const localizador = {
    autorizar: async () => {},
    observar: async (lectura) => {
      datos.lectura = lectura;
      datos.observaciones++;
      return { remove: () => datos.retiradas++ };
    },
  };
  const gestor = new GestorSeguimiento(
    repositorio,
    localizador,
    generarUuid,
    () => datos.ahora,
  );
  const punto = () => ({
    latitud: -16.5,
    longitud: -68.14,
    precisionM: 8,
    instante: datos.ahora,
    velocidadMS: null,
    rumbo: null,
  });
  return { datos, repositorio, localizador, gestor, punto };
}

prueba(
  "el GPS web acepta mediciones a los 3 s y descarta las intermedias",
  async () => {
    const { datos, gestor, punto } = escenarioGps();
    await gestor.iniciar(7, "original");
    datos.lectura(punto());
    await esperar();
    datos.ahora += 2999;
    datos.lectura(punto());
    await esperar();
    afirmar.equal(datos.lotes.length, 1);
    datos.ahora += 1;
    datos.lectura(punto());
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
  "ocultar la pestaña retira el GPS antes de esperar a la red y volver no lo reactiva",
  async () => {
    const { datos, gestor, repositorio, punto } = escenarioGps();
    await gestor.iniciar(7, "original");
    datos.lectura(punto());
    await esperar();
    let resolver;
    repositorio.detener = () =>
      new Promise((continuar) => {
        resolver = continuar;
      });
    gestor.establecerPrimerPlano(false);
    afirmar.equal(datos.retiradas, 1);
    afirmar.equal(gestor.obtenerEstado().posicion, null);
    gestor.establecerPrimerPlano(true);
    resolver({ activa: false });
    await esperar();
    afirmar.equal(datos.observaciones, 1);
    afirmar.equal(gestor.obtenerEstado().fase, "detenido");
  },
);

prueba(
  "una autorización GPS tardía no reactiva la captura tras salir",
  async () => {
    const { datos, gestor, localizador } = escenarioGps();
    let resolver;
    localizador.autorizar = () =>
      new Promise((continuar) => {
        resolver = continuar;
      });
    const inicio = gestor.iniciar(7, "original");
    gestor.establecerPrimerPlano(false);
    resolver();
    await inicio;
    afirmar.equal(datos.observaciones, 0);
    afirmar.equal(gestor.obtenerEstado().posicion, null);
  },
);

prueba(
  "el GPS descarta mediciones imprecisas y conserva el mismo lote incierto al comprobar su cierre",
  async () => {
    const { datos, gestor, repositorio, punto } = escenarioGps();
    await gestor.iniciar(7, "original");
    datos.lectura({ ...punto(), precisionM: 150 });
    await esperar();
    afirmar.equal(datos.lotes.length, 0);
    const intentos = [];
    repositorio.enviar = async (_, lote) => {
      intentos.push(lote);
      if (intentos.length === 1) throw new ErrorAplicacion("conexion", 0);
      return { activa: true };
    };
    datos.lectura(punto());
    await esperar();
    afirmar.equal(gestor.obtenerEstado().fase, "pendiente");
    afirmar.equal(datos.retiradas, 1);
    await gestor.reintentar();
    afirmar.equal(intentos[0], intentos[1]);
    afirmar.equal(gestor.obtenerEstado().fase, "detenido");
  },
);

prueba(
  "el adaptador web exige HTTPS y transforma exclusivamente las mediciones del navegador",
  async () => {
    let autorizadas = 0,
      lectura,
      retiradas = 0;
    const ventana = { isSecureContext: false };
    const cargador = crearCargadorChofer(
      {},
      {
        window: ventana,
        document: { visibilityState: "visible" },
        navigator: {
          geolocation: {
            getCurrentPosition: (resolver) => {
              autorizadas++;
              resolver({
                timestamp: 123,
                coords: {
                  latitude: -16.5,
                  longitude: -68.14,
                  accuracy: 8,
                  speed: null,
                  heading: null,
                },
              });
            },
            watchPosition: (resolver) => {
              lectura = resolver;
              return 12;
            },
            clearWatch: (id) => {
              afirmar.equal(id, 12);
              retiradas++;
            },
          },
        },
      },
    );
    const { LocalizadorNavegador } = cargador(
      "lib/chofer/modulos/seguimiento/datos/LocalizadorNavegador",
    );
    const localizador = new LocalizadorNavegador();
    await afirmar.rejects(
      localizador.autorizar(),
      (error) => error.codigo === "gpsHttps",
    );
    afirmar.equal(autorizadas, 0);
    ventana.isSecureContext = true;
    const primera = await localizador.autorizar();
    afirmar.equal(primera.latitud, -16.5);
    afirmar.equal(primera.precisionM, 8);
    let recibida;
    const observacion = await localizador.observar(
      (posicion) => {
        recibida = posicion;
      },
      () => {},
    );
    lectura({
      timestamp: 123,
      coords: {
        latitude: -16.5,
        longitude: -68.14,
        accuracy: 8,
        speed: null,
        heading: null,
      },
    });
    afirmar.equal(recibida.latitud, -16.5);
    afirmar.equal(recibida.precisionM, 8);
    afirmar.equal(recibida.rumbo, null);
    observacion.remove();
    afirmar.equal(retiradas, 1);
  },
);

prueba(
  "el cliente del chofer usa la sesión web y conserva el cuerpo sin enviar Bearer",
  async () => {
    let solicitud;
    const cargador = crearCargadorChofer({
      "@/lib/api": {
        api: async (...datos) => {
          solicitud = datos;
          return {};
        },
        ApiError: class extends Error {},
      },
    });
    const { ClienteApi } = cargador(
      "lib/chofer/infraestructura/api/ClienteApi",
    );
    const cliente = new ClienteApi();
    await cliente.solicitar("chofer/mis-viajes/7/iniciar/", {
      metodo: "POST",
      cuerpo: { clave_operacion: "misma-clave", version: "original" },
    });
    afirmar.equal(solicitud[0], "chofer/mis-viajes/7/iniciar/");
    afirmar.equal(JSON.parse(solicitud[1].body).clave_operacion, "misma-clave");
    afirmar.equal(solicitud[1].headers, undefined);
    await afirmar.rejects(cliente.solicitar("despachos/7/iniciar/"));
  },
);

prueba(
  "el mapa conserva la línea histórica y solo muestra camión y precisión con una medición",
  () => {
    const contenedor = ({ children }) =>
      React.createElement("section", null, children);
    const cargador = crearCargadorChofer({
      react: React,
      "react/jsx-runtime": jsx,
      "react-leaflet": {
        MapContainer: contenedor,
        Marker: ({ alt, children }) =>
          React.createElement("div", { "data-marcador": alt }, children),
        Polyline: ({ positions }) =>
          React.createElement("div", {
            "data-linea": JSON.stringify(positions),
          }),
        Circle: ({ radius }) =>
          React.createElement("div", { "data-precision": radius }),
        Popup: contenedor,
        useMap: () => ({}),
        useMapEvents: () => {},
      },
      leaflet: { divIcon: (datos) => datos },
      "@maplibre/maplibre-gl-leaflet": {},
      "@/lib/mapas/prepararMotorMapa": { prepararMotorMapa: () => {} },
      "next-intl": { useTranslations: () => (clave) => clave },
      "@/context/ThemeContext": { useTheme: () => ({ theme: "light" }) },
      "leaflet/dist/leaflet.css": {},
      "maplibre-gl/dist/maplibre-gl.css": {},
      "./estilosChofer.module.css": { default: {} },
    });
    const Mapa = cargador("components/chofer/MapaChofer").default;
    const puntos = [
      { tipo: "almacen", posicion: [-68.14, -16.5], nombre: "Almacén" },
      {
        tipo: "sucursal",
        parada: 1,
        orden: 1,
        posicion: [-68.12, -16.49],
        nombre: "Sucursal",
      },
      { tipo: "retorno", posicion: [-68.14, -16.5] },
    ];
    const ruta = {
      puntos,
      estado: "lista",
      plan: {
        id: 1,
        puntos,
        tramos: [{}],
        geometria: {
          coordinates: [
            [-68.14, -16.5],
            [-68.13, -16.51],
            [-68.12, -16.49],
          ],
        },
      },
    };
    const html = (posicion) =>
      representar(React.createElement(Mapa, { ruta, posicion }));
    afirmar.doesNotMatch(
      html(null),
      /data-precision|data-marcador="miUbicacion"/,
    );
    afirmar.match(html(null), /-16.51,-68.13/);
    const conGps = html({ latitud: -16.5, longitud: -68.14, precisionM: 8 });
    afirmar.match(conGps, /data-precision="8"/);
    afirmar.match(conGps, /data-marcador="miUbicacion"/);
  },
);

prueba(
  "las traducciones del chofer conservan las mismas claves en los idiomas habilitados",
  () => {
    const claves = (objeto, prefijo = "") =>
      Object.entries(objeto)
        .flatMap(([clave, valor]) =>
          typeof valor === "object"
            ? claves(valor, `${prefijo}${clave}.`)
            : [`${prefijo}${clave}`],
        )
        .sort();
    const leer = (idioma) =>
      JSON.parse(
        leerArchivo(
          new URL(`../src/messages/${idioma}.json`, import.meta.url),
          "utf8",
        ),
      ).chofer;
    afirmar.deepEqual(claves(leer("es")), claves(leer("en")));
  },
);

prueba(
  "el mapa abre el panel sin una confirmación activa y conserva el permiso de operar",
  () => {
    const version = "a".repeat(64);
    const puntos = [
      { tipo: "almacen" },
      { tipo: "sucursal", parada: 1 },
      { tipo: "retorno" },
    ];
    const viaje = {
      id: 7,
      codigo: "DES-000007",
      estado: "en_ruta",
      version,
      paradas: [
        {
          id: 1,
          nombre: "Centro",
          cliente: "Cliente",
          orden: 1,
          llegadaEn: null,
          descargadaEn: null,
        },
      ],
      resumen: { completadas: 0, paradas: 1 },
    };
    function dibujar(operar) {
      let indice = 0;
      const react = {
        ...React,
        useState: (inicial) => [
          indice++ === 0
            ? "paradas"
            : typeof inicial === "function"
              ? inicial()
              : inicial,
          () => {},
        ],
        useEffect: () => {},
        useCallback: (funcion) => funcion,
        useRef: (inicial) => ({ current: inicial }),
      };
      const vacio = () => null;
      const cargador = crearCargadorChofer({
        react,
        "react/jsx-runtime": jsx,
        "next/dynamic": { default: () => vacio },
        "next-intl": { useTranslations: () => (clave) => clave },
        "lucide-react": Object.fromEntries(
          [
            "ArrowLeft",
            "LocateFixed",
            "Maximize",
            "Moon",
            "Sun",
            "RefreshCw",
            "ChevronUp",
            "ChevronDown",
            "MapPin",
            "Navigation",
            "Smartphone",
            "Map",
          ].map((nombre) => [nombre, vacio]),
        ),
        "@/i18n/navigation": {
          Link: ({ children, href }) =>
            React.createElement("a", { href }, children),
          useRouter: () => ({ push() {} }),
        },
        "@/context/ThemeContext": {
          useTheme: () => ({ theme: "light", toggleTheme() {} }),
        },
        "@/components/ui/button/Button": {
          default: ({ children, disabled }) =>
            React.createElement("button", { disabled }, children),
        },
        "@/components/logistica/ConfirmacionLogistica": { default: vacio },
        "@/components/ui/toast/ToastViewport": { default: vacio },
        "@/hooks/useToast": {
          useToast: () => ({ toasts: [], notify() {}, dismiss() {} }),
        },
        "./ProveedorChofer": {
          useChofer: () => ({
            sesion: { user: { id: 1 }, permisos_chofer: { operar } },
            seguimiento: { identificadorSesion: () => null },
          }),
          useSeguimiento: () => ({ viaje: null, posicion: null }),
        },
        "./useViajeChofer": {
          useViajeChofer: () => ({
            datos: {
              viaje,
              ruta: { puntos, estado: "sin_calcular", plan: null },
            },
          }),
        },
        "./usePantallaEncendida": {
          usePantallaEncendida: () => ({ activa: false, alternar() {} }),
        },
        "./useGuiaChofer": {
          useGuiaChofer: () => ({
            estado: { fase: "inactiva" },
            reintentar() {},
          }),
        },
        "./EstadoGuiaChofer": { default: vacio },
        "./PanelViajeChofer": {
          default: () => React.createElement("aside", null, "Panel del viaje"),
        },
        "./LimiteMapaChofer": { default: ({ children }) => children },
        "./ComparadorCaminosChofer": { default: () => null },
        "./estilosChofer.module.css": { default: {} },
      });
      const Pantalla = cargador("components/chofer/PantallaMapaChofer").default;
      return representar(React.createElement(Pantalla, { identificador: 7 }));
    }
    afirmar.match(dibujar(true), /Panel del viaje/);
    afirmar.match(dibujar(true), /acciones.llegar/);
    afirmar.doesNotMatch(dibujar(false), /acciones.llegar/);
  },
);

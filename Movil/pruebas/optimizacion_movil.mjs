import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import * as jsx from "react/jsx-runtime";
import { crearCargador } from "./cargar.mjs";

const cargar = crearCargador();
const { leerRutaViaje } = cargar(
  "modulos/recorrido/datos/transformacionesRuta",
);
const { lineasColoreadas } = cargar("modulos/recorrido/aplicacion/coloresRuta");
const { RepositorioRutasHttp } = cargar(
  "modulos/recorrido/datos/RepositorioRutasHttp",
);
const { GestorRutas } = cargar("modulos/recorrido/aplicacion/GestorRutas");
const { ErrorAplicacion } = cargar("compartido/dominio/Errores");
const { iconoAlmacenMapa, iconoSucursalMapa, iconoCamionMapa } = cargar(
  "modulos/recorrido/presentacion/iconosMapa",
);

function documento() {
  const puntos = [
    {
      tipo: "almacen",
      parada: null,
      sucursal: null,
      orden: 0,
      nombre: "Almacén",
      cliente: "",
      latitud: "-16.5",
      longitud: "-68.14",
      color: "#16803c",
    },
    {
      tipo: "sucursal",
      parada: 8,
      sucursal: 12,
      orden: 1,
      nombre: "Centro",
      cliente: "Cliente",
      latitud: "-16.49",
      longitud: "-68.12",
      color: "#2563eb",
    },
    {
      tipo: "retorno",
      parada: null,
      sucursal: null,
      orden: 2,
      nombre: "Almacén",
      cliente: "",
      latitud: "-16.5",
      longitud: "-68.14",
      color: "#16803c",
    },
  ];
  const geometria = {
    type: "LineString",
    coordinates: [
      [-68.14, -16.5],
      [-68.12, -16.49],
      [-68.14, -16.5],
    ],
  };
  return {
    despacho: 7,
    version_despacho: "a".repeat(64),
    preparando: true,
    estado: "pendiente_aprobacion",
    puede_ordenar: true,
    puede_calcular: true,
    puede_aprobar: true,
    puede_optimizar: true,
    puntos,
    faltantes: [],
    trafico_en_vivo: false,
    optimizacion: { id: 4, estado: "lista", error: "" },
    plan: {
      id: 3,
      numero: 1,
      puntos,
      geometria,
      aprobada_en: null,
      fijada_en: null,
      trafico_en_vivo: false,
      distancia_m: "3000",
      duracion_s: "100",
      optimizacion: {
        mejora_s: "20",
        mejora_porcentaje: "16.7",
        duracion_inicial_s: "120",
      },
      tramos: [
        {
          orden: 1,
          distancia_m: "1500",
          duracion_s: "50",
          color: "#2563eb",
          geometria: {
            type: "LineString",
            coordinates: geometria.coordinates.slice(0, 2),
          },
        },
        {
          orden: 2,
          distancia_m: "1500",
          duracion_s: "50",
          color: "#16803c",
          geometria: {
            type: "LineString",
            coordinates: geometria.coordinates.slice(1),
          },
        },
      ],
    },
  };
}

prueba(
  "la propuesta conserva métricas, colores y geometrías exactas por tramo",
  () => {
    const ruta = leerRutaViaje(documento());
    afirmar.equal(ruta.plan.optimizacion.mejoraS, 20);
    const lineas = lineasColoreadas(ruta.plan);
    afirmar.equal(lineas.features.length, 2);
    afirmar.equal(
      lineas.features[0].properties.color,
      ruta.plan.puntos[1].color,
    );
    afirmar.equal(
      lineas.features[1].properties.color,
      ruta.plan.puntos[0].color,
    );
    afirmar.deepEqual(
      Array.from(lineas.features[1].geometry.coordinates[1]),
      [-68.14, -16.5],
    );
  },
);

prueba(
  "un plan histórico sin geometrías por tramo conserva la línea original completa",
  () => {
    const anterior = documento();
    anterior.plan.tramos.forEach((tramo) => delete tramo.geometria);
    const ruta = leerRutaViaje(anterior);
    const lineas = lineasColoreadas(ruta.plan);
    afirmar.equal(lineas.features.length, 1);
    afirmar.equal(lineas.features[0].geometry.coordinates.length, 3);
  },
);

prueba(
  "calcular en segundo plano se distingue del plan y rechaza estados o colores inválidos",
  () => {
    const datos = documento();
    datos.optimizacion.estado = "calculando";
    afirmar.equal(leerRutaViaje(datos).optimizacion.estado, "calculando");
    datos.optimizacion.estado = "desconocido";
    afirmar.throws(() => leerRutaViaje(datos));
    const color = documento();
    color.plan.puntos[1].color = "javascript:invalido";
    afirmar.throws(() => leerRutaViaje(color));
  },
);

prueba(
  "optimizar y cancelar usan exclusivamente la API del viaje propio con todos los destinos",
  async () => {
    const llamadas = [];
    const repositorio = new RepositorioRutasHttp({
      solicitar: async (ruta, opciones) => {
        llamadas.push({ ruta, opciones });
        return documento();
      },
    });
    const orden = Array.from({ length: 25 }, (_, indice) => indice + 1);
    await repositorio.operar(7, "optimizar-ruta", {
      version: "a".repeat(64),
      clave_operacion: "uuid",
      orden_paradas: orden,
    });
    await repositorio.operar(7, "cancelar-optimizacion", {
      version: "a".repeat(64),
      clave_operacion: "uuid2",
      calculo: 4,
    });
    afirmar.equal(llamadas[0].ruta, "movil/mis-despachos/7/optimizar-ruta/");
    afirmar.equal(llamadas[0].opciones.cuerpo.orden_paradas.length, 25);
    afirmar.equal(
      llamadas[1].ruta,
      "movil/mis-despachos/7/cancelar-optimizacion/",
    );
    afirmar.equal(llamadas[1].opciones.cuerpo.calculo, 4);
  },
);

prueba(
  "una solicitud incierta de optimización conserva UUID y cuerpo al reintentar",
  async () => {
    let intentos = 0;
    const cuerpos = [];
    const gestor = new GestorRutas(
      {
        operar: async (_viaje, _accion, cuerpo) => {
          cuerpos.push(cuerpo);
          if (!intentos++) throw new ErrorAplicacion("red", 0);
          return leerRutaViaje(documento());
        },
      },
      () => "clave-estable",
    );
    await afirmar.rejects(
      gestor.ejecutar(7, "optimizar-ruta", {
        version: "a".repeat(64),
        orden_paradas: [8],
      }),
    );
    await gestor.reintentar(7);
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(cuerpos[1].clave_operacion, "clave-estable");
  },
);

prueba(
  "el mapa Android usa los SVG aportados y no duplica el marcador del retorno",
  () => {
    const colores = {
      tarjeta: "#ffffff",
      blanco: "#ffffff",
      verde: "#16803c",
      texto: "#111111",
    };
    const cargarMapa = crearCargador({
      react: {
        useEffect: () => {},
        useMemo: (calcular) => calcular(),
        useRef: () => ({ current: null }),
        useState: (valor) => [valor, () => {}],
      },
      "react/jsx-runtime": jsx,
      "react-native": {
        View: "View",
        StyleSheet: { absoluteFill: {}, create: (valor) => valor },
      },
      "@maplibre/maplibre-react-native": {
        Map: "Map",
        Marker: "Marker",
        Camera: "Camera",
        GeoJSONSource: "GeoJSONSource",
        Layer: "Layer",
      },
      "react-native-svg": { SvgXml: "SvgXml" },
      "@/compartido/componentes/Elementos": { Texto: "Texto" },
      "@/compartido/tema/ProveedorInterfaz": {
        usarInterfaz: () => ({
          colores,
          oscuro: false,
          reducirMovimiento: true,
          t: (clave) => clave,
        }),
      },
    });
    const Mapa = cargarMapa(
      "modulos/recorrido/presentacion/MapaRecorrido.native.tsx",
    ).default;
    let inicios = 0,
      cargas = 0,
      errores = 0;
    const propiedades = {
      ruta: leerRutaViaje(documento()),
      siguiente: 8,
      espacioSuperior: 50,
      espacioInferior: 120,
      revisionEncuadre: 0,
      alIniciarCarga: () => inicios++,
      alError: () => errores++,
      alCargar: () => cargas++,
    };
    const arbol = Mapa(propiedades);
    const nodos = (nodo) =>
      Array.isArray(nodo)
        ? nodo.flatMap(nodos)
        : nodo && typeof nodo === "object"
          ? [nodo, ...nodos(nodo.props?.children)]
          : [];
    const todos = nodos(arbol),
      svg = todos.filter((nodo) => nodo.type === "SvgXml");
    afirmar.equal(todos.filter((nodo) => nodo.type === "Marker").length, 2);
    afirmar.equal(svg[0].props.xml, iconoAlmacenMapa);
    afirmar.ok(svg[1].props.xml.includes("#2563eb"));
    afirmar.ok(iconoSucursalMapa.includes("#FF507D"));
    // Descargar el estilo no garantiza que ya se hayan dibujado las calles.
    arbol.props.onWillStartLoadingMap();
    arbol.props.onDidFinishLoadingStyle();
    afirmar.equal(inicios, 1);
    afirmar.equal(cargas, 0);
    arbol.props.onDidFinishLoadingMap();
    afirmar.equal(cargas, 1);
    arbol.props.onDidFailLoadingMap();
    afirmar.equal(errores, 1);
    // Una carga tardía puede recuperar el mapa después del aviso de espera.
    arbol.props.onDidFinishRenderingMapFully();
    afirmar.equal(cargas, 2);
    const conGps = nodos(
      Mapa({
        ...propiedades,
        posicionChofer: {
          id: "gps-real",
          latitud: -16.5,
          longitud: -68.14,
          precisionM: 8,
          capturadaEn: new Date().toISOString(),
        },
      }),
    );
    afirmar.equal(conGps.filter((nodo) => nodo.type === "Marker").length, 3);
    afirmar.ok(
      conGps.some(
        (nodo) => nodo.type === "SvgXml" && nodo.props.xml === iconoCamionMapa,
      ),
    );
  },
);

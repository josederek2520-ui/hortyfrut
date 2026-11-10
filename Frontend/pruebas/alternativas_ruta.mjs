import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import React from "react";
import * as jsx from "react/jsx-runtime";
import * as iconos from "lucide-react";
import { readFileSync as leer } from "node:fs";
import { createTranslator as traductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const mensajes = JSON.parse(
  leer(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const version = "a".repeat(64);
const geometria = {
  type: "LineString",
  coordinates: [
    [-68.14, -16.5],
    [-68.12, -16.49],
  ],
};
const otra = {
  type: "LineString",
  coordinates: [
    [-68.14, -16.5],
    [-68.13, -16.48],
    [-68.12, -16.49],
  ],
};
function respuesta() {
  return {
    consulta: 7,
    plan: 9,
    tramo: 1,
    versionDespacho: version,
    venceEn: new Date(Date.now() + 600000).toISOString(),
    opciones: [
      {
        opcion: 0,
        actual: true,
        distanciaM: 1000,
        duracionS: 60,
        calles: [],
        geometria,
      },
      {
        opcion: 1,
        actual: false,
        distanciaM: 1400,
        duracionS: 100,
        calles: ["Av. Prueba"],
        geometria: otra,
      },
    ],
  };
}
function ruta() {
  const puntos = [
    {
      tipo: "almacen",
      nombre: "Central",
      orden: 0,
      parada: null,
      posicion: geometria.coordinates[0],
      color: "#16803c",
    },
    {
      tipo: "sucursal",
      nombre: "Centro",
      orden: 1,
      parada: 10,
      posicion: geometria.coordinates[1],
      color: "#2563eb",
    },
    {
      tipo: "retorno",
      nombre: "Central",
      orden: 2,
      parada: null,
      posicion: geometria.coordinates[0],
      color: "#16803c",
    },
  ];
  return {
    despacho: 1,
    versionDespacho: version,
    estado: "pendiente_aprobacion",
    preparando: true,
    plan: {
      id: 9,
      puntos,
      geometria,
      tramos: [
        {
          orden: 1,
          color: "#2563eb",
          distanciaM: 1000,
          duracionS: 60,
          geometria,
        },
        {
          orden: 2,
          color: "#16803c",
          distanciaM: 1000,
          duracionS: 60,
          geometria: {
            type: "LineString",
            coordinates: [...geometria.coordinates].reverse(),
          },
        },
      ],
    },
    puntos,
  };
}
const nodos = (arbol) => {
  if (!arbol || typeof arbol !== "object") return [];
  return [
    arbol,
    ...React.Children.toArray(arbol.props?.children).flatMap(nodos),
  ];
};
const textos = (arbol) =>
  React.Children.toArray(arbol)
    .map((nodo) =>
      typeof nodo === "string" || typeof nodo === "number"
        ? String(nodo)
        : textos(nodo?.props?.children),
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
const esperar = () => new Promise((resolver) => setImmediate(resolver));
function preparar(solicitar, documentoRuta = ruta()) {
  const estado = [],
    referencias = [],
    efectos = [],
    limpiezas = [];
  let indiceEstado = 0,
    indiceRef = 0,
    indiceEfecto = 0,
    arbol,
    siguienteUuid = 0;
  const vistas = [],
    elecciones = [],
    temporizadores = [];
  const cargar = crearCargadorChofer(
    {
      react: {
        ...React,
        useState: (inicial) => {
          const indice = indiceEstado++;
          if (!(indice in estado))
            estado[indice] =
              typeof inicial === "function" ? inicial() : inicial;
          return [
            estado[indice],
            (valor) => {
              estado[indice] =
                typeof valor === "function" ? valor(estado[indice]) : valor;
            },
          ];
        },
        useRef: (inicial) => {
          const indice = indiceRef++;
          return (referencias[indice] ??= { current: inicial });
        },
        useEffect: (funcion, deps) => {
          const indice = indiceEfecto++;
          if (
            !efectos[indice] ||
            deps.some((valor, posicion) => valor !== efectos[indice][posicion])
          ) {
            limpiezas[indice]?.();
            efectos[indice] = deps;
            limpiezas[indice] = funcion();
          }
        },
      },
      "react/jsx-runtime": jsx,
      "lucide-react": iconos,
      "next-intl": {
        useTranslations: (namespace) =>
          traductor({ locale: "es", messages: mensajes, namespace }),
      },
      "@/components/ui/modal": { Modal: ({ children }) => children },
      "./ProveedorChofer": {
        useChofer: () => ({ rutas: { consultarAlternativas: solicitar } }),
      },
      "@/lib/chofer/infraestructura/crearClaveOperacion": {
        crearClaveOperacion: () => `uuid-${++siguienteUuid}`,
      },
      "./estilosChofer.module.css": { default: {} },
    },
    {
      setTimeout: (funcion) => {
        temporizadores.push(funcion);
        return temporizadores.length;
      },
      clearTimeout: () => {},
    },
  );
  const Componente = cargar(
    "components/chofer/ComparadorCaminosChofer",
  ).default;
  const propiedades = {
    ruta: documentoRuta,
    bloqueado: false,
    ocupado: false,
    incierto: false,
    errorOperacion: "",
    alCerrar: () => {},
    alVistaPrevia: (vista) => vistas.push(vista),
    alElegir: async (...valores) => {
      elecciones.push(valores);
      return true;
    },
    alReintentar: async () => true,
    alActualizar: () => {},
  };
  const representar = () => {
    indiceEstado = indiceRef = indiceEfecto = 0;
    arbol = Componente(propiedades);
    return arbol;
  };
  const boton = (texto) =>
    nodos(arbol).find(
      (nodo) =>
        typeof nodo.props?.onClick === "function" &&
        textos(nodo.props.children).includes(texto),
    );
  representar();
  return {
    representar,
    boton,
    vistas,
    elecciones,
    temporizadores,
    cargar,
    propiedades,
    arbol: () => arbol,
    desmontar: () => limpiezas.forEach((limpiar) => limpiar?.()),
  };
}

prueba(
  "compara por tramo, permite vista previa y envia solo identificadores al elegir",
  async () => {
    let peticion;
    const entorno = preparar(async (...datos) => {
      peticion = datos;
      return respuesta();
    });
    entorno.boton("Central → Centro").props.onClick();
    await esperar();
    entorno.representar();
    afirmar.equal(peticion[0], 1);
    afirmar.deepEqual(JSON.parse(JSON.stringify(peticion[1])), {
      version,
      plan: 9,
      tramo: 1,
      clave_operacion: "uuid-1",
    });
    afirmar.ok(entorno.boton("Elegir este camino").props.disabled);
    entorno.boton("Camino 2").props.onClick();
    entorno.representar();
    afirmar.equal(entorno.vistas.at(-1).opcion, 1);
    entorno.boton("Ver en mapa").props.onClick();
    entorno.representar();
    afirmar.match(textos(entorno.arbol()), /Vista previa · sin guardar/);
    entorno.boton("Elegir este camino").props.onClick();
    await esperar();
    afirmar.deepEqual(entorno.elecciones, [[7, 1]]);
    entorno.desmontar();
  },
);
prueba(
  "una consulta incierta reintenta la misma clave y una respuesta tras cerrar no cambia la vista",
  async () => {
    const solicitudes = [];
    let veces = 0;
    let ErrorClase;
    let resolver;
    const entorno = preparar(async (...datos) => {
      solicitudes.push(JSON.stringify(datos[1]));
      if (++veces === 1) throw new ErrorClase("conexion", 0);
      return new Promise((aceptar) => {
        resolver = aceptar;
      });
    });
    ErrorClase = entorno.cargar(
      "lib/chofer/compartido/dominio/Errores",
    ).ErrorAplicacion;
    entorno.boton("Central → Centro").props.onClick();
    await esperar();
    entorno.representar();
    entorno.boton("Reintentar").props.onClick();
    await esperar();
    afirmar.equal(solicitudes[0], solicitudes[1]);
    entorno.desmontar();
    resolver(respuesta());
    await esperar();
    afirmar.ok(entorno.vistas.every((vista) => vista === null));
  },
);
prueba(
  "sin otra opcion o con comparacion vencida no habilita una eleccion nueva",
  async () => {
    const solo = respuesta();
    solo.opciones = solo.opciones.slice(0, 1);
    const entorno = preparar(async () => solo);
    entorno.boton("Central → Centro").props.onClick();
    await esperar();
    entorno.representar();
    afirmar.match(textos(entorno.arbol()), /OSRM no encontró otro camino/);
    afirmar.ok(entorno.boton("Elegir este camino").props.disabled);
    entorno.desmontar();
    const completo = preparar(async () => respuesta());
    completo.boton("Central → Centro").props.onClick();
    await esperar();
    completo.representar();
    completo.boton("Camino 2").props.onClick();
    completo.temporizadores.at(-1)();
    completo.representar();
    afirmar.ok(completo.boton("Elegir este camino").props.disabled);
    afirmar.match(textos(completo.arbol()), /comparación venció/);
    completo.desmontar();
  },
);
prueba(
  "la previsualizacion mantiene el original y solo proyecta el tramo elegido incluido retorno",
  () => {
    const cargar = crearCargadorChofer(),
      { previsualizarCamino } = cargar(
        "lib/chofer/modulos/recorrido/aplicacion/previsualizarCamino",
      );
    const base = ruta(),
      copia = JSON.stringify(base),
      comparacion = respuesta();
    const vista = previsualizarCamino(base, { comparacion, opcion: 1 });
    afirmar.equal(vista.plan.tramos.length, 1);
    afirmar.equal(vista.plan.tramos[0].color, "#2563eb");
    afirmar.equal(vista.plan.geometria, comparacion.opciones[1].geometria);
    afirmar.equal(JSON.stringify(base), copia);
    afirmar.equal(
      previsualizarCamino(base, {
        comparacion: { ...comparacion, versionDespacho: "b".repeat(64) },
        opcion: 1,
      }),
      base,
    );
    const regreso = previsualizarCamino(base, {
      comparacion: { ...comparacion, tramo: 2 },
      opcion: 1,
    });
    afirmar.equal(regreso.plan.puntos.at(-1).tipo, "almacen");
    afirmar.equal(regreso.plan.tramos[0].color, "#16803c");
  },
);
prueba(
  "el contrato rechaza caminos con otros extremos y conserva la indicacion sin trafico",
  () => {
    const cargar = crearCargadorChofer(),
      { leerComparacionCaminos } = cargar(
        "lib/chofer/modulos/recorrido/datos/transformacionesRuta",
      );
    const valor = {
      consulta: 7,
      plan: 9,
      tramo: 1,
      version_despacho: version,
      vence_en: new Date().toISOString(),
      trafico_en_vivo: false,
      opciones: respuesta().opciones.map((fila) => ({
        opcion: fila.opcion,
        actual: fila.actual,
        distancia_m: String(fila.distanciaM),
        duracion_s: String(fila.duracionS),
        calles: fila.calles,
        geometria: fila.geometria,
      })),
    };
    afirmar.equal(leerComparacionCaminos(valor).opciones.length, 2);
    afirmar.throws(() =>
      leerComparacionCaminos({ ...valor, trafico_en_vivo: true }),
    );
    afirmar.throws(() =>
      leerComparacionCaminos({
        ...valor,
        opciones: [
          valor.opciones[0],
          {
            ...valor.opciones[1],
            geometria: {
              ...otra,
              coordinates: [
                [-60, -10],
                [-61, -10],
              ],
            },
          },
        ],
      }),
    );
  },
);

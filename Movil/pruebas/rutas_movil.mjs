import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { crearCargador } from "./cargar.mjs";

const cargar = crearCargador();
const { leerRutaViaje } = cargar(
  "modulos/recorrido/datos/transformacionesRuta",
);
const { limitesRuta, enlaceNavegacion } = cargar(
  "modulos/recorrido/aplicacion/geometriaRuta",
);
const { RepositorioRutasHttp } = cargar(
  "modulos/recorrido/datos/RepositorioRutasHttp",
);
const punto = (tipo, orden, longitud = "-68.14", latitud = "-16.5") => ({
  tipo,
  orden,
  parada: tipo === "sucursal" ? orden : null,
  sucursal: tipo === "sucursal" ? orden + 10 : null,
  nombre: `Punto ${orden}`,
  cliente: "Cliente de prueba",
  longitud,
  latitud,
});
const documento = () => {
  const puntos = [
    punto("almacen", 0),
    ...Array.from({ length: 12 }, (_, indice) => punto("sucursal", indice + 1)),
    punto("retorno", 13),
  ];
  return {
    despacho: 7,
    version_despacho: "a".repeat(64),
    estado: "lista",
    puntos,
    faltantes: [],
    trafico_en_vivo: false,
    plan: {
      id: 9,
      numero: 2,
      puntos,
      geometria: {
        type: "LineString",
        coordinates: [
          [-68.14, -16.5],
          [-68.12, -16.49],
          [-68.14, -16.5],
        ],
      },
      distancia_m: "12000.5",
      duracion_s: "1800.1",
      aprobada_en: "2026-11-01T10:00:00Z",
      fijada_en: "2026-11-01T10:05:00Z",
      trafico_en_vivo: false,
      tramos: Array.from({ length: 13 }, (_, indice) => ({
        orden: indice + 1,
        distancia_m: "900",
        duracion_s: "120",
      })),
    },
  };
};

prueba(
  "el mapa conserva mas de diez paradas, separa latitud y longitud y exige un plan fijado",
  () => {
    const ruta = leerRutaViaje(documento());
    afirmar.equal(ruta.puntos.length, 14);
    afirmar.equal(ruta.plan.puntos[1].posicion[0], -68.14);
    afirmar.equal(ruta.plan.puntos[1].posicion[1], -16.5);
    afirmar.equal(ruta.plan.distanciaM, 12000.5);
    const sinAprobar = documento();
    sinAprobar.plan.aprobada_en = null;
    afirmar.throws(() => leerRutaViaje(sinAprobar));
    const sinFijar = documento();
    sinFijar.plan.fijada_en = null;
    afirmar.throws(() => leerRutaViaje(sinFijar));
  },
);

prueba(
  "un recorrido ausente no genera una linea recta y los datos invalidos no llegan al mapa",
  () => {
    const sinRuta = leerRutaViaje({
      despacho: 7,
      version_despacho: "a".repeat(64),
      estado: "sin_calcular",
      plan: null,
      puntos: [],
      faltantes: [],
      trafico_en_vivo: false,
    });
    afirmar.equal(sinRuta.plan, null);
    afirmar.equal(limitesRuta([]), null);
    for (const alterar of [
      (dato) => {
        dato.plan.geometria.coordinates[0][1] = 100;
      },
      (dato) => {
        dato.plan.distancia_m = "NaN";
      },
      (dato) => {
        dato.plan.trafico_en_vivo = true;
      },
      (dato) => {
        dato.plan.puntos[0].latitud = null;
      },
      (dato) => {
        dato.plan.tramos.pop();
      },
      (dato) => {
        dato.plan.puntos.at(-1).latitud = "-16.6";
      },
    ]) {
      const datos = documento();
      alterar(datos);
      afirmar.throws(() => leerRutaViaje(datos));
    }
  },
);

prueba(
  "el encuadre incluye el trazado completo y la navegacion externa usa coordenadas del plan",
  () => {
    const limites = limitesRuta([
      [-68.14, -16.5],
      [-68.2, -16.6],
      [-68.1, -16.4],
    ]);
    afirmar.equal(limites.join(","), "-68.2,-16.6,-68.1,-16.4");
    const ruta = leerRutaViaje(documento());
    afirmar.match(
      enlaceNavegacion(ruta.plan.puntos[1]),
      /destination=-16\.5%2C-68\.14/,
    );
    afirmar.equal(enlaceNavegacion({ posicion: null }), null);
  },
);

prueba(
  "la consulta de ruta solo usa la API movil de su viaje y propaga la cancelacion",
  async () => {
    const llamadas = [],
      controlador = new AbortController();
    const repositorio = new RepositorioRutasHttp({
      solicitar: async (ruta, opciones) => {
        llamadas.push({ ruta, opciones });
        return documento();
      },
    });
    const ruta = await repositorio.consultar(7, controlador.signal);
    afirmar.equal(ruta.despacho, 7);
    afirmar.equal(llamadas[0].ruta, "movil/mis-despachos/7/ruta/");
    afirmar.equal(llamadas[0].opciones.senal, controlador.signal);
    await afirmar.rejects(() => repositorio.consultar(0));
    afirmar.equal(llamadas.length, 1);
  },
);

import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { randomUUID as generarUuid } from "node:crypto";
import { setImmediate as esperar } from "node:timers/promises";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const calculos = crearCargadorChofer()(
  "components/devoluciones/calculosDevolucion",
);
const aporte = {
  id: 7,
  producto: 1,
  producto_nombre: "Tomate",
  codigo_lote: "L091126-01",
  preparacion: "PRE-000001",
  es_kg: true,
  unidad_abreviatura: "kg",
  cantidad_enviada: "20",
  cantidad_devuelta: "0",
  maximo_cantidad: "20",
  maximo_peso: "20",
  peso_rechazado_entrega: "2",
  vencido: false,
};
const origen = {
  id: 3,
  codigo: "ENT-000003",
  version: "origen-v0",
  sucursal_nombre: "Centro",
};
const documento = (cambios = {}) => ({
  id: 11,
  entrega: 3,
  estado: "borrador",
  version: "v1",
  origen,
  almacen: 2,
  almacen_nombre: "Almacén",
  fecha_recepcion: "2026-11-09",
  motivo: "Retorno físico",
  motivo_revision: "",
  lineas: [],
  movimientos: [],
  ...cambios,
});

prueba(
  "el retorno empieza sin mediciones y kg utiliza la misma lectura sin conversion",
  () => {
    const vacia = calculos.lineaNuevaDevolucion(aporte);
    afirmar.equal(vacia.cantidad_recibida, "");
    afirmar.equal(vacia.peso_kg_recibido, "");
    const cambiada = calculos.cambiarMedicionDevolucion(
      vacia,
      "cantidad_recibida",
      "4,001",
    );
    afirmar.equal(cambiada.peso_kg_recibido, "4,001");
    const preparada = calculos.prepararDevolucion({ 7: cambiada }, false, true);
    afirmar.equal(preparada.filas[0].cantidad_recibida, "4.001");
    afirmar.equal(preparada.filas[0].peso_kg_recibido, "4.001");
    afirmar.equal(Object.keys(preparada.errores).length, 0);
    afirmar.equal(vacia.cantidad_recibida, "");
  },
);

prueba(
  "las cantidades de otra unidad y el peso permanecen independientes",
  () => {
    const vacia = calculos.lineaNuevaDevolucion({
      ...aporte,
      es_kg: false,
      unidad_abreviatura: "uni",
    });
    const cambiada = calculos.cambiarMedicionDevolucion(
      vacia,
      "cantidad_recibida",
      "2",
    );
    afirmar.equal(cambiada.peso_kg_recibido, "");
    const preparada = calculos.prepararDevolucion(
      { 7: { ...cambiada, peso_kg_recibido: "4" } },
      false,
      true,
    );
    afirmar.equal(preparada.filas[0].cantidad_recibida, "2");
    afirmar.equal(preparada.filas[0].peso_kg_recibido, "4");
  },
);

prueba(
  "la revision valida todas las paginas y conserva las milesimas exactas",
  () => {
    const filas = Object.fromEntries(
      Array.from({ length: 12 }, (_, indice) => [
        indice + 1,
        {
          ...calculos.lineaNuevaDevolucion({ ...aporte, id: indice + 1 }),
          cantidad_recibida: "1.2",
          peso_kg_recibido: "1.2",
          cantidad_aprovechable: "1.199",
          cantidad_merma: "0.001",
          peso_kg_aprovechable: "1.199",
          peso_kg_merma: "0.001",
        },
      ]),
    );
    let resultado = calculos.prepararDevolucion(filas, true, true);
    afirmar.equal(resultado.filas.length, 12);
    afirmar.equal(Object.keys(resultado.errores).length, 0);
    filas[12].cantidad_merma = "0.002";
    resultado = calculos.prepararDevolucion(filas, true, true);
    afirmar.equal(resultado.errores["12_cantidad_merma"][0], "sumaExacta");
    afirmar.equal(
      calculos.totalPesoDevolucion(filas, "peso_kg_recibido"),
      "14.4",
    );
    afirmar.equal(calculos.medicionDevolucion("1.0001"), null);
  },
);

for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL("../src/messages/" + idioma + ".json", import.meta.url),
      "utf8",
    ),
  );
  const t = crearTraductor({
    locale: idioma,
    messages: mensajes,
    namespace: "devoluciones",
  });
  const icono = () => React.createElement("i", { "aria-hidden": true });
  const cargar = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": { useTranslations: () => t, useLocale: () => idioma },
    "lucide-react": {
      Plus: icono,
      X: icono,
      Package: icono,
      LoaderCircle: icono,
      Save: icono,
    },
    "@/i18n/navigation": {
      Link: ({ children, ...props }) =>
        React.createElement("a", props, children),
    },
  });
  prueba(
    "la revision presenta solo aprovechable y merma y la consulta es inmutable en " +
      idioma,
    () => {
      const Fila = cargar("components/devoluciones/FilaDevolucion").default;
      const props = {
        aporte,
        linea: {
          ...calculos.lineaNuevaDevolucion(aporte),
          cantidad_recibida: "4",
          peso_kg_recibido: "4",
          cantidad_aprovechable: "3",
          peso_kg_aprovechable: "3",
          cantidad_merma: "1",
          peso_kg_merma: "1",
        },
        bloqueado: false,
        verLotes: false,
        errores: {},
        alAgregar() {},
        alQuitar() {},
        alCambiar() {},
        recibida: true,
      };
      const revision = representar(
        React.createElement(Fila, { ...props, modo: "revision" }),
      );
      afirmar.ok(revision.includes(t("aprovechable")));
      afirmar.ok(revision.includes(t("merma")));
      afirmar.equal((revision.match(/<input/g) || []).length, 2);
      afirmar.doesNotMatch(revision, /cantidad_disponible|peso_kg_disponible/);
      const consulta = representar(
        React.createElement(Fila, { ...props, modo: "consulta" }),
      );
      afirmar.doesNotMatch(consulta, /<input|<textarea/);
      const otrasUnidades = representar(
        React.createElement(Fila, {
          ...props,
          aporte: { ...aporte, es_kg: false },
          modo: "revision",
        }),
      );
      afirmar.equal((otrasUnidades.match(/<input/g) || []).length, 4);
    },
  );
  prueba(
    "los permisos distinguen recibir de revisar y la revision cerrada solo permite salir en " +
      idioma,
    () => {
      const Acciones = cargar(
        "components/devoluciones/AccionesDevolucion",
      ).default;
      const props = {
        documento: documento({ estado: "recibida" }),
        permisos: {
          ver: true,
          crear: false,
          editar: false,
          recibir: true,
          revisar: false,
          cancelar: false,
        },
        ocupado: false,
        incierto: false,
        modificado: false,
        editarRecepcion: false,
        editarRevision: false,
        alVolver() {},
        alGuardar() {},
        alRecibir() {},
        alRevisar() {},
        alCancelar() {},
      };
      const sinRevisar = representar(React.createElement(Acciones, props));
      afirmar.ok(!sinRevisar.includes(t("confirmarRevision")));
      const conRevisar = representar(
        React.createElement(Acciones, {
          ...props,
          permisos: { ...props.permisos, revisar: true },
          editarRevision: true,
        }),
      );
      afirmar.ok(conRevisar.includes(t("confirmarRevision")));
      const cerrada = representar(
        React.createElement(Acciones, {
          ...props,
          documento: documento({ estado: "revisada" }),
        }),
      );
      afirmar.equal((cerrada.match(/<button/g) || []).length, 1);
    },
  );
}

class ErrorApi extends Error {
  constructor(status, errors = {}) {
    super();
    this.status = status;
    this.errors = errors;
  }
}
function escenario(solicitar) {
  let cursor = 0;
  const memorias = [],
    efectos = [];
  const react = {
    useState: (inicial) => {
      const i = cursor++;
      if (!(i in memorias))
        memorias[i] = typeof inicial === "function" ? inicial() : inicial;
      return [
        memorias[i],
        (valor) => {
          memorias[i] =
            typeof valor === "function" ? valor(memorias[i]) : valor;
        },
      ];
    },
    useRef: (inicial) => {
      const i = cursor++;
      memorias[i] ??= { current: inicial };
      return memorias[i];
    },
    useCallback: (funcion, dependencias) => {
      const i = cursor++;
      if (
        !memorias[i] ||
        dependencias.some(
          (valor, indice) => valor !== memorias[i].dependencias[indice],
        )
      )
        memorias[i] = { funcion, dependencias };
      return memorias[i].funcion;
    },
    useEffect: (funcion, dependencias) => {
      const i = cursor++;
      if (
        !memorias[i] ||
        dependencias.some(
          (valor, indice) => valor !== memorias[i].dependencias[indice],
        )
      ) {
        memorias[i]?.limpiar?.();
        memorias[i] = { dependencias };
        efectos.push(() => {
          memorias[i].limpiar = funcion();
        });
      }
    },
  };
  const cargar = crearCargadorChofer(
    {
      react,
      "@/lib/api": { api: solicitar, ApiError: ErrorApi },
      "@/lib/chofer/infraestructura/crearClaveOperacion": {
        crearClaveOperacion: generarUuid,
      },
    },
    {
      window: { addEventListener() {}, removeEventListener() {} },
      URLSearchParams,
    },
  );
  const usar = cargar("components/devoluciones/useGestionDevolucion").default;
  return {
    dibujar() {
      cursor = 0;
      const resultado = usar(undefined, 3);
      efectos.splice(0).forEach((efecto) => efecto());
      return resultado;
    },
    desmontar() {
      memorias.forEach((memoria) => memoria?.limpiar?.());
    },
  };
}
function anotar(entorno) {
  let estado = entorno.dibujar();
  estado.establecerOrigen(origen);
  estado.cambiarAlmacen({ id: 2, nombre: "Almacén" });
  estado.cambiarFecha("2026-11-09");
  estado.cambiarMotivo("Retorno físico");
  estado.agregar(aporte);
  estado = entorno.dibujar();
  estado.cambiarCampo(7, "cantidad_recibida", "4,001");
  return entorno.dibujar();
}
prueba(
  "recibir guarda primero y usa la version recibida con la medicion exacta",
  async () => {
    const peticiones = [];
    let lineas = [];
    const entorno = escenario(async (ruta, opciones) => {
      const cuerpo = JSON.parse(opciones.body);
      peticiones.push({ ruta, cuerpo });
      if (cuerpo.lineas)
        lineas = cuerpo.lineas.map((fila) => ({
          ...fila,
          es_kg: true,
          producto_nombre: "Tomate",
          unidad_abreviatura: "kg",
          cantidad_aprovechable: null,
          cantidad_merma: null,
          peso_kg_aprovechable: null,
          peso_kg_merma: null,
        }));
      return documento({
        estado: ruta.endsWith("recibir/") ? "recibida" : "borrador",
        version: "v" + peticiones.length,
        lineas,
      });
    });
    await anotar(entorno).operar("recibir");
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[0].cuerpo.version, "origen-v0");
    afirmar.equal(peticiones[0].cuerpo.lineas[0].cantidad_recibida, "4.001");
    afirmar.equal(peticiones[0].cuerpo.lineas[0].peso_kg_recibido, "4.001");
    afirmar.equal(peticiones[1].cuerpo.version, "v1");
    afirmar.equal(entorno.dibujar().documento.estado, "recibida");
  },
);
prueba(
  "una respuesta perdida conserva exactamente UUID y cuerpo e impide otra operacion hasta comprobar",
  async () => {
    const cuerpos = [];
    let perdida = true;
    const entorno = escenario(async (_, opciones) => {
      cuerpos.push(opciones.body);
      if (perdida) {
        perdida = false;
        throw new ErrorApi(0);
      }
      return documento();
    });
    await anotar(entorno).operar("guardar");
    let estado = entorno.dibujar();
    afirmar.equal(estado.incierto, true);
    await estado.operar("recibir");
    afirmar.equal(cuerpos.length, 1);
    await estado.operar("reintentar");
    afirmar.equal(cuerpos.length, 2);
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(entorno.dibujar().incierto, false);
  },
);
prueba(
  "desmontar la hoja retira la continuidad de una accion con respuesta tardia",
  async () => {
    const peticiones = [];
    let completar;
    const entorno = escenario((ruta, opciones) => {
      peticiones.push({ ruta, cuerpo: opciones.body });
      return new Promise((resolver) => {
        completar = resolver;
      });
    });
    const operacion = anotar(entorno).operar("recibir");
    await esperar();
    entorno.desmontar();
    completar(documento());
    await operacion;
    afirmar.equal(peticiones.length, 1);
    afirmar.equal(entorno.dibujar().documento, null);
  },
);
prueba(
  "las traducciones nuevas tienen las mismas claves y conservan el espanol",
  () => {
    const obtener = (idioma) =>
      JSON.parse(
        leerArchivo(
          new URL("../src/messages/" + idioma + ".json", import.meta.url),
          "utf8",
        ),
      ).devoluciones;
    const claves = (datos, prefijo = "") =>
      Object.entries(datos)
        .flatMap(([clave, valor]) =>
          typeof valor === "object"
            ? claves(valor, prefijo + clave + ".")
            : [prefijo + clave],
        )
        .sort();
    afirmar.deepEqual(claves(obtener("es")), claves(obtener("en")));
    afirmar.doesNotMatch(JSON.stringify(obtener("es")), /\p{L}\?\p{L}/u);
  },
);

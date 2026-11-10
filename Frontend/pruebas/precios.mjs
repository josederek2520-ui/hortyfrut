import prueba from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { randomUUID as generarUuid } from "node:crypto";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import { crearCargadorChofer } from "./ayudas/cargar_chofer.mjs";

const cargar = crearCargadorChofer();
const { normalizarPrecio, centavosPrecio, prepararPrecio } = cargar(
  "components/precios/calculosPrecio",
);
const fila = (producto, precio = "5,25") => ({
  producto,
  producto_nombre: "Producto " + producto,
  categoria_nombre: "Verduras",
  precio_kg: precio,
  precio_anterior: null,
});
const formulario = () => ({
  cliente: { id: 2, nombre: "Supermercado" },
  alcance: "periodo",
  desde: "2026-11-09",
  hasta: "2026-11-15",
  referencia_propuesta: "Lista semanal",
  lineas: [fila(7)],
  entregas: [],
});
const documento = (cambios = {}) => ({
  id: 11,
  codigo: "PRE-000011",
  version: "v1",
  estado: "borrador",
  cliente: 2,
  cliente_nombre: "Supermercado",
  alcance: "periodo",
  desde: "2026-11-09",
  hasta: "2026-11-15",
  referencia_propuesta: "Lista semanal",
  numero_version: 1,
  anterior: null,
  es_actual: false,
  motivo_version: "",
  motivo_rechazo: "",
  registrado_por_nombre: "Oficina",
  propuesto_por_nombre: "",
  propuesto_en: null,
  revisado_por_nombre: "",
  revisado_en: null,
  creado_en: "2026-11-09T12:00:00Z",
  total_productos: 1,
  lineas: [fila(7, "5.25")],
  entregas: [],
  ...cambios,
});

prueba(
  "cada producto conserva su precio exacto sin redondeos ni conversiones",
  () => {
    afirmar.equal(normalizarPrecio("5,2"), "5.20");
    afirmar.equal(centavosPrecio("9999999999.99"), 999999999999n);
    for (const valor of ["0", "-1", "1.001", "1e3", "NaN", "10000000000.00"])
      afirmar.equal(normalizarPrecio(valor), null);
    const f = formulario();
    f.lineas = [fila(7, "4.50"), fila(8, "0.01")];
    const resultado = prepararPrecio(f, true);
    afirmar.equal(resultado.datos.lineas[0].precio_kg, "4.50");
    afirmar.equal(resultado.datos.lineas[1].precio_kg, "0.01");
  },
);
prueba(
  "la propuesta exige precios de otras paginas y el borrador admite campos pendientes",
  () => {
    const f = formulario();
    f.lineas = Array.from({ length: 12 }, (_, i) =>
      fila(i + 1, i === 11 ? "" : "3"),
    );
    afirmar.ok(prepararPrecio(f, true).errores["12_precio_kg"]);
    afirmar.deepEqual(Object.keys(prepararPrecio(f, false).errores), []);
    f.lineas[11].precio_kg = "3.25";
    afirmar.deepEqual(Object.keys(prepararPrecio(f, true).errores), []);
    f.hasta = "2026-11-08";
    afirmar.ok(prepararPrecio(f, true).errores.hasta);
  },
);
prueba(
  "las entregas especificas no heredan fechas y exigen seleccion explicita",
  () => {
    const f = formulario();
    f.alcance = "entregas";
    afirmar.ok(prepararPrecio(f, true).errores.entregas);
    f.entregas = [9, 10];
    const resultado = prepararPrecio(f, true);
    afirmar.equal(resultado.datos.desde, null);
    afirmar.equal(resultado.datos.hasta, null);
    afirmar.deepEqual(Array.from(resultado.datos.entregas), [9, 10]);
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
    namespace: "precios",
  });
  const icono = () => React.createElement("svg");
  const cargador = crearCargadorChofer({
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": { useLocale: () => idioma, useTranslations: () => t },
    "lucide-react": Object.fromEntries(
      ["Package", "Plus", "Trash2", "Search"].map((nombre) => [nombre, icono]),
    ),
    "@/components/pedidos/PaginadorPedidos": {
      default: () => React.createElement("nav", null, "Paginacion"),
    },
  });
  const Productos = cargador("components/precios/ProductosPrecio").default;
  prueba(
    "la hoja muestra un precio independiente por producto y diez filas en " +
      idioma,
    () => {
      const props = {
        lineas: Array.from({ length: 12 }, (_, i) => fila(i + 1, "4.50")),
        pagina: 1,
        buscar: "",
        editable: true,
        version: false,
        bloqueado: false,
        errores: {},
        alPagina() {},
        alBuscar() {},
        alAgregar() {},
        alQuitar() {},
        alPrecio() {},
      };
      const html = representar(React.createElement(Productos, props));
      afirmar.equal((html.match(/inputMode="decimal"/g) || []).length, 10);
      afirmar.ok(html.includes("Producto 10"));
      afirmar.ok(!html.includes("Producto 11"));
      const segunda = representar(
        React.createElement(Productos, { ...props, pagina: 2 }),
      );
      afirmar.equal((segunda.match(/inputMode="decimal"/g) || []).length, 2);
      afirmar.ok(segunda.includes("Producto 12"));
      const consulta = representar(
        React.createElement(Productos, { ...props, editable: false }),
      );
      afirmar.equal((consulta.match(/inputMode="decimal"/g) || []).length, 0);
      afirmar.ok(consulta.includes("Bs"));
    },
  );
  prueba(
    "una correccion muestra precio anterior y conserva todos sus productos en " +
      idioma,
    () => {
      const html = representar(
        React.createElement(Productos, {
          lineas: [{ ...fila(7, "4.50"), precio_anterior: "5.25" }],
          pagina: 1,
          buscar: "",
          editable: true,
          version: true,
          bloqueado: false,
          errores: {},
          alPagina() {},
          alBuscar() {},
          alAgregar() {},
          alQuitar() {},
          alPrecio() {},
        }),
      );
      afirmar.ok(html.includes(t("precioAnterior")));
      afirmar.ok(html.includes("5"));
      afirmar.ok(!html.includes(t("agregarProductos")));
      afirmar.ok(
        !html.includes(t("quitarProducto", { producto: "Producto 7" })),
      );
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
  const memoria = [],
    efectos = [];
  const react = {
    useState(inicial) {
      const i = cursor++;
      if (!(i in memoria))
        memoria[i] = typeof inicial === "function" ? inicial() : inicial;
      return [
        memoria[i],
        (valor) => {
          memoria[i] = typeof valor === "function" ? valor(memoria[i]) : valor;
        },
      ];
    },
    useRef(inicial) {
      const i = cursor++;
      memoria[i] ??= { current: inicial };
      return memoria[i];
    },
    useCallback(funcion, dependencias) {
      const i = cursor++;
      if (
        !memoria[i] ||
        dependencias.some((v, j) => v !== memoria[i].dependencias[j])
      )
        memoria[i] = { funcion, dependencias };
      return memoria[i].funcion;
    },
    useEffect(funcion, dependencias) {
      const i = cursor++;
      if (
        !memoria[i] ||
        dependencias.some((v, j) => v !== memoria[i].dependencias[j])
      ) {
        memoria[i]?.limpiar?.();
        memoria[i] = { dependencias };
        efectos.push(() => {
          memoria[i].limpiar = funcion();
        });
      }
    },
  };
  const usar = crearCargadorChofer(
    {
      react,
      "@/lib/api": { api: solicitar, ApiError: ErrorApi },
      "@/lib/chofer/infraestructura/crearClaveOperacion": {
        crearClaveOperacion: generarUuid,
      },
    },
    { window: { addEventListener() {}, removeEventListener() {} } },
  )("components/precios/useGestionPrecio").default;
  return {
    dibujar() {
      cursor = 0;
      const resultado = usar();
      efectos.splice(0).forEach((e) => e());
      return resultado;
    },
    desmontar() {
      memoria.forEach((m) => m?.limpiar?.());
    },
  };
}
function anotar(entorno) {
  entorno.dibujar().cambiar(() => formulario());
  return entorno.dibujar();
}
prueba(
  "registrar la propuesta guarda antes y utiliza la version devuelta",
  async () => {
    const peticiones = [];
    const entorno = escenario(async (ruta, opciones) => {
      peticiones.push({ ruta, cuerpo: JSON.parse(opciones.body) });
      return documento({
        version: "v" + peticiones.length,
        estado: ruta.endsWith("/presentar/") ? "propuesta" : "borrador",
      });
    });
    await anotar(entorno).operar("presentar");
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(peticiones[0].cuerpo.lineas[0].precio_kg, "5.25");
    afirmar.equal(peticiones[1].cuerpo.version, "v1");
    afirmar.equal(entorno.dibujar().documento.estado, "propuesta");
  },
);
prueba(
  "una respuesta incierta conserva exactamente UUID y cuerpo al reintentar",
  async () => {
    const cuerpos = [];
    let perder = true;
    const entorno = escenario(async (_, opciones) => {
      cuerpos.push(opciones.body);
      if (perder) {
        perder = false;
        throw new ErrorApi(0);
      }
      return documento();
    });
    await anotar(entorno).operar("guardar");
    let estado = entorno.dibujar();
    afirmar.equal(estado.incierto, true);
    await estado.operar("presentar");
    afirmar.equal(cuerpos.length, 1);
    await estado.operar("reintentar");
    afirmar.equal(cuerpos[0], cuerpos[1]);
    afirmar.equal(entorno.dibujar().incierto, false);
  },
);
prueba(
  "una respuesta tardia al salir no registra la propuesta despues de guardar",
  async () => {
    let completar;
    const peticiones = [];
    const entorno = escenario(async (ruta) => {
      peticiones.push(ruta);
      return new Promise((r) => {
        completar = r;
      });
    });
    const operacion = anotar(entorno).operar("presentar");
    entorno.desmontar();
    completar(documento());
    await operacion;
    afirmar.equal(peticiones.length, 1);
    afirmar.equal(entorno.dibujar().documento, null);
  },
);
prueba(
  "las traducciones de precios tienen claves completas en ambos idiomas",
  () => {
    const es = JSON.parse(
      leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
    ).precios;
    const en = JSON.parse(
      leerArchivo(new URL("../src/messages/en.json", import.meta.url), "utf8"),
    ).precios;
    const claves = (obj, prefijo = "") =>
      Object.entries(obj)
        .flatMap(([clave, valor]) =>
          typeof valor === "object"
            ? claves(valor, prefijo + clave + ".")
            : [prefijo + clave],
        )
        .sort();
    afirmar.deepEqual(claves(es), claves(en));
    afirmar.ok(!/\p{L}\?\p{L}/u.test(JSON.stringify(es)));
  },
);

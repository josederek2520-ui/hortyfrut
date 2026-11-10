import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import * as jsx from "react/jsx-runtime";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
function cargar(ruta, dependencias = {}, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL("../src/components/" + ruta, import.meta.url),
        "utf8",
      ),
      {
        compilerOptions: {
          module: compilador.ModuleKind.CommonJS,
          target: compilador.ScriptTarget.ES2022,
          jsx: compilador.JsxEmit.ReactJSX,
        },
      },
    ).outputText,
    {
      exports: exportaciones,
      require: (nombre) => {
        if (nombre in dependencias) return dependencias[nombre];
        if (nombre === "react/jsx-runtime") return jsx;
        if (nombre === "next-intl")
          return {
            useTranslations: (namespace) =>
              crearTraductor({ locale: "es", messages: mensajes, namespace }),
            useLocale: () => "es",
          };
        return {
          default: nombre.endsWith(".css") ? {} : nombre.split("/").at(-1),
        };
      },
      ...entorno,
    },
  );
  return exportaciones;
}
function nodos(nodo) {
  if (Array.isArray(nodo)) return nodo.flatMap(nodos);
  if (!nodo || typeof nodo !== "object") return [];
  return [nodo, ...nodos(nodo.props?.children)];
}
function textos(nodo) {
  if (Array.isArray(nodo)) return nodo.map(textos).join(" ");
  if (typeof nodo === "string" || typeof nodo === "number") return String(nodo);
  return nodo && typeof nodo === "object" ? textos(nodo.props?.children) : "";
}
const calculos = cargar("preparaciones/calculos.ts");
const distribucion = cargar("preparaciones/distribucionLotesPreparacion.ts", {
  "./calculos": calculos,
});
const Aportes = cargar("preparaciones/AportesSucursalPreparacion.tsx", {
  "./calculos": calculos,
  "./distribucionLotesPreparacion": distribucion,
}).default;
function datos() {
  const lote = {
    id: 1,
    nombre: "L301026-01",
    producto: 1,
    unidad: 1,
    unidad_abreviatura: "kg",
    es_kg: true,
    saldo: "8.000",
  };
  const primera = {
    clave: "1",
    detalle: 1,
    sucursal: 1,
    sucursalNombre: "Miraflores",
    producto: 1,
    columna: "cajas",
    cantidad: "1",
    disponible: true,
    aportes: { 1: { cantidad: "7", pesoKg: "" } },
  };
  const segunda = {
    ...primera,
    clave: "2",
    detalle: 2,
    sucursal: 2,
    sucursalNombre: "Satélite",
    aportes: {},
  };
  return {
    lineas: [{ lote, merma: "", aprovechable: "", motivo: "" }],
    asignaciones: { 1: primera, 2: segunda },
    cajillas: [],
  };
}
function renderizar(documento, alElegirLote = () => {}) {
  return Aportes({
    documento,
    asignacion: documento.asignaciones[2],
    contexto: "cliente=1&fecha_pedidos=2026-10-30",
    almacen: 1,
    prefijo: "asignaciones_1",
    errores: {},
    alCambiar: () => {},
    alElegirLote,
    alError: () => {},
  });
}

prueba(
  "el primer lote siempre se elige explícitamente aunque haya uno usado en otra sucursal",
  () => {
    const documento = datos();
    const arbol = renderizar(documento);
    const selector = nodos(arbol).find(
      (nodo) => nodo.type === "DesplegableCompra",
    );
    afirmar.equal(selector.props.etiqueta, "Elegir lote");
    afirmar.equal(
      nodos(arbol).filter((nodo) => nodo.type === "CampoDirectorio").length,
      0,
    );
    afirmar.equal(selector.props.datosConsulta.consumos[0].cantidad, "7.000");
    afirmar.equal(selector.props.datosConsulta.excluir.length, 0);
  },
);

prueba(
  "un lote agotado sigue visible donde se anotó, con saldo disponible para esa sucursal",
  () => {
    const documento = datos();
    documento.asignaciones[2].aportes[1] = { cantidad: "1", pesoKg: "" };
    const arbol = renderizar(documento);
    const selector = nodos(arbol).find(
      (nodo) => nodo.type === "DesplegableCompra",
    );
    afirmar.equal(selector.props.etiqueta, "Agregar lote adicional");
    afirmar.equal(selector.props.datosConsulta.consumos[0].cantidad, "8.000");
    afirmar.equal(selector.props.datosConsulta.excluir[0], 1);
    afirmar.equal(
      selector.props.textoSinOpciones,
      "No hay más lotes con saldo disponible.",
    );
    afirmar.match(textos(arbol), /Disponible para esta sucursal: 1 kg/);
    afirmar.match(textos(arbol), /Quedaría en el lote: 0 kg/);
    afirmar.equal(
      nodos(arbol).find((nodo) => nodo.type === "CampoDirectorio").props.value,
      "1",
    );
  },
);

prueba(
  "la consulta incluye todas las sucursales y separaciones sin perder decimales",
  () => {
    const documento = datos();
    documento.lineas[0].merma = "0.4";
    documento.lineas[0].aprovechable = "0.6";
    afirmar.equal(
      calculos.consumosLotesPreparacion(documento)[0].cantidad,
      "8.000",
    );
    afirmar.equal(
      calculos.disponibleLotePreparacion(documento, documento.lineas[0].lote),
      BigInt(0),
    );
    afirmar.equal(
      calculos.disponibleLotePreparacion(
        documento,
        documento.lineas[0].lote,
        documento.asignaciones[1],
      ),
      BigInt(7000),
    );
    documento.asignaciones[2].aportes[1] = { cantidad: "0.125", pesoKg: "" };
    afirmar.equal(
      calculos.consumosLotesPreparacion(documento)[0].cantidad,
      "8.125",
    );
  },
);

prueba(
  "seleccionar un lote adicional no rellena mediciones ni suma otra caja preparada",
  () => {
    const documento = datos();
    documento.asignaciones[2].aportes[1] = { cantidad: "1", pesoKg: "" };
    let elegido;
    const arbol = renderizar(documento, (lote) => {
      elegido = lote;
    });
    const selector = nodos(arbol).find(
      (nodo) => nodo.type === "DesplegableCompra",
    );
    const otro = {
      ...documento.lineas[0].lote,
      id: 2,
      saldo: "5",
      disponible_preparacion: "5",
    };
    selector.props.alElegir(otro);
    afirmar.equal(elegido, otro);
    afirmar.equal(documento.asignaciones[2].cantidad, "1");
    afirmar.equal(documento.asignaciones[2].aportes[2], undefined);
  },
);

prueba(
  "el desplegable envía la previsión por POST y conserva GET para los otros selectores",
  async () => {
    for (const datosConsulta of [
      undefined,
      { consumos: [{ lote: 1, cantidad: "7.000" }], excluir: [2] },
    ]) {
      const efectos = [];
      let estado = 0;
      let peticion;
      const Desplegable = cargar(
        "compras/DesplegableCompra.tsx",
        {
          react: {
            useState: (valor) => [estado++ === 0 ? true : valor, () => {}],
            useEffect: (funcion) => efectos.push(funcion),
            useRef: (valor) => ({ current: valor }),
            useId: () => "selector",
            useCallback: (funcion) => funcion,
          },
          "react-dom": { createPortal: (contenido) => contenido },
          "./usePanelDesplegable": { default() {} },
          "@/lib/api": {
            api: async (ruta, opciones) => {
              peticion = { ruta, opciones };
              return { count: 0, results: [] };
            },
          },
        },
        {
          AbortController,
          URLSearchParams,
          document: { body: {} },
          window: {
            setTimeout: (funcion) => {
              void funcion();
              return 1;
            },
            clearTimeout() {},
          },
        },
      ).default;
      Desplegable({
        ruta: "preparaciones/lotes/?cliente=1",
        etiqueta: "Elegir lote",
        valor: null,
        tipo: "general",
        datosConsulta,
        alError: () => {},
        alElegir: () => {},
      });
      const limpiezas = efectos.map((efecto) => efecto()).filter(Boolean);
      await Promise.resolve();
      afirmar.ok(peticion.ruta.includes("pagina=1"));
      afirmar.equal(
        peticion.opciones.method,
        datosConsulta ? "POST" : undefined,
      );
      if (datosConsulta)
        afirmar.equal(
          JSON.parse(peticion.opciones.body).consumos[0].cantidad,
          "7.000",
        );
      else afirmar.equal(peticion.opciones.body, undefined);
      limpiezas.forEach((limpiar) => limpiar());
      afirmar.equal(peticion.opciones.signal.aborted, true);
    }
  },
);

import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import { createTranslator as crearTraductor } from "next-intl";
import * as iconos from "lucide-react";
import compilador from "typescript";

const mensajes = Object.fromEntries(
  ["es", "en"].map((idioma) => [
    idioma,
    JSON.parse(
      leerArchivo(
        new URL(`../src/messages/${idioma}.json`, import.meta.url),
        "utf8",
      ),
    ),
  ]),
);

function cargar(nombre, dependencias = {}, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/vehiculos/${nombre}`, import.meta.url),
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
      require: (ruta) => {
        if (ruta in dependencias) return dependencias[ruta];
        if (ruta === "react/jsx-runtime") return jsx;
        if (ruta === "react") return React;
        if (ruta === "lucide-react") return iconos;
        throw new Error(`Dependencia sin preparar: ${ruta}`);
      },
      ...entorno,
    },
  );
  return exportaciones;
}

const capacidad = cargar("capacidadVehiculo.ts");
const vehiculo = {
  id: 4,
  placa: "453VFC",
  tipo: "Camión",
  marca: "Isuzu",
  capacidad_kg: "2500.125",
  imagen: null,
  activo: true,
  responsable_nombre: "José Miguel",
  creado_en: "2026-10-29T16:19:00-04:00",
  version: "version-original",
};
const internacionalizacion = (idioma) => ({
  useLocale: () => idioma,
  useTranslations: (namespace) =>
    crearTraductor({ locale: idioma, messages: mensajes[idioma], namespace }),
});

prueba(
  "las toneladas conservan exactamente toda la precision historica al consultar y guardar",
  () => {
    for (const [kg, toneladas] of [
      ["2000", "2"],
      ["2500.125", "2.500125"],
      ["0.001", "0.000001"],
      ["999999999.999", "999999.999999"],
      ["12.001", "0.012001"],
    ]) {
      afirmar.equal(capacidad.kilogramosAToneladas(kg), toneladas);
      afirmar.equal(capacidad.toneladasAKilogramos(toneladas), kg);
    }
    afirmar.equal(capacidad.toneladasAKilogramos(" 2,5 "), "2500");
    afirmar.equal(capacidad.toneladasAKilogramos(".75"), "750");
    afirmar.equal(capacidad.kilogramosAToneladas("002000.000"), "2");
  },
);

prueba(
  "capacidad opcional y limites positivos coinciden con el contrato existente",
  () => {
    afirmar.equal(capacidad.kilogramosAToneladas(null), "");
    afirmar.equal(capacidad.toneladasAKilogramos(""), "");
    for (const valor of [
      "0",
      "-2",
      "0.0000001",
      "1000000",
      "2.1234567",
      "NaN",
      "Infinity",
      "2 t",
    ])
      afirmar.equal(capacidad.toneladasAKilogramos(valor), null, valor);
    afirmar.equal(
      capacidad.formatearCapacidadToneladas("2000.000", "es"),
      "2 t",
    );
    afirmar.equal(capacidad.formatearCapacidadToneladas("2500", "es"), "2,5 t");
    afirmar.equal(capacidad.formatearCapacidadToneladas("2500", "en"), "2.5 t");
    afirmar.equal(capacidad.formatearCapacidadToneladas(null, "es"), null);
    afirmar.equal(
      capacidad.formatearCapacidadToneladas("0.001", "es"),
      "0,000001 t",
    );
  },
);

function prepararFormulario(existente) {
  const estados = [];
  const referencias = [];
  let indiceEstado = 0;
  let indiceReferencia = 0;
  let arbol;
  const peticiones = [];
  const destinos = [];
  const formulario = {
    reportValidity: () => true,
    querySelector: () => ({ focus() {} }),
  };
  const ganchos = {
    useState(inicial) {
      const indice = indiceEstado++;
      if (!(indice in estados))
        estados[indice] = typeof inicial === "function" ? inicial() : inicial;
      return [
        estados[indice],
        (nuevo) => {
          estados[indice] =
            typeof nuevo === "function" ? nuevo(estados[indice]) : nuevo;
        },
      ];
    },
    useRef() {
      const indice = indiceReferencia++;
      return (referencias[indice] ||= { current: formulario });
    },
    useEffect() {},
  };
  const Componente = cargar(
    "FormularioVehiculo.tsx",
    {
      react: ganchos,
      "next-intl": internacionalizacion("es"),
      "next/image": { default: "img" },
      "@/i18n/navigation": {
        useRouter: () => ({
          push: (destino) => destinos.push(destino),
          refresh() {},
        }),
      },
      "@/components/clientes/CampoDirectorio": { default: "campo" },
      "@/components/ui/button/Button": { default: "boton" },
      "@/components/logistica/ConfirmacionLogistica": {
        default: "confirmacion",
      },
      "@/components/logistica/tipos": { clasePanel: "panel" },
      "./capacidadVehiculo": capacidad,
      "@/lib/api": {
        api: async (ruta, opciones) => {
          peticiones.push({ ruta, ...opciones });
          return existente || vehiculo;
        },
        ApiError: Error,
      },
    },
    { FormData, setTimeout },
  );
  const renderizar = () => {
    indiceEstado = 0;
    indiceReferencia = 0;
    arbol = Componente.default({
      vehiculo: existente,
      alError: (error) => {
        throw error;
      },
    });
    return arbol;
  };
  function nodos(nodo = arbol) {
    if (!nodo || typeof nodo !== "object") return [];
    if (Array.isArray(nodo)) return nodo.flatMap((hijo) => nodos(hijo));
    return [
      nodo,
      ...(nodo.props?.children === undefined ? [] : nodos(nodo.props.children)),
    ];
  }
  const campo = () =>
    nodos().find((nodo) => nodo.props?.name === "capacidadToneladas");
  renderizar();
  return {
    peticiones,
    destinos,
    campo,
    cambiar(valor) {
      campo().props.onChange({ target: { value: valor } });
      renderizar();
    },
    async guardar() {
      await nodos()
        .find((nodo) => nodo.type === "form")
        .props.onSubmit({ preventDefault() {} });
      renderizar();
    },
  };
}

prueba(
  "editar muestra toneladas y guardar sin cambios conserva capacidad y version de la API",
  async () => {
    const formulario = prepararFormulario(vehiculo);
    afirmar.equal(formulario.campo().props.value, "2.500125");
    afirmar.equal(
      formulario.campo().props.etiqueta,
      "Capacidad de carga (toneladas)",
    );
    await formulario.guardar();
    afirmar.equal(formulario.peticiones[0].method, "PATCH");
    afirmar.equal(
      formulario.peticiones[0].body.get("capacidad_kg"),
      "2500.125",
    );
    afirmar.equal(
      formulario.peticiones[0].body.get("version"),
      vehiculo.version,
    );
    afirmar.equal(
      formulario.peticiones[0].body.has("capacidadToneladas"),
      false,
    );
    afirmar.deepEqual(formulario.destinos, ["/vehiculos/4"]);
  },
);

prueba(
  "crear convierte toneladas al contrato de kilos y permite dejar la capacidad vacia",
  async () => {
    const formulario = prepararFormulario();
    formulario.cambiar("3.75");
    await formulario.guardar();
    afirmar.equal(formulario.peticiones[0].method, "POST");
    afirmar.equal(formulario.peticiones[0].body.get("capacidad_kg"), "3750");
    const sinCapacidad = prepararFormulario(vehiculo);
    sinCapacidad.cambiar("");
    await sinCapacidad.guardar();
    afirmar.equal(sinCapacidad.peticiones[0].body.get("capacidad_kg"), "");
  },
);

prueba(
  "una capacidad fuera del rango no se envia a la API y muestra error en el campo",
  async () => {
    const formulario = prepararFormulario(vehiculo);
    formulario.cambiar("0.0000001");
    await formulario.guardar();
    afirmar.equal(formulario.peticiones.length, 0);
    afirmar.match(formulario.campo().props.errores[0], /mayor que cero/);
    formulario.cambiar("2.5");
    afirmar.equal(formulario.campo().props.errores.length, 0);
    await formulario.guardar();
    afirmar.equal(formulario.peticiones[0].body.get("capacidad_kg"), "2500");
  },
);

prueba(
  "listado y ficha muestran la misma capacidad en toneladas en ambos idiomas y respetan permisos",
  () => {
    for (const idioma of ["es", "en"]) {
      const dependencias = {
        "next-intl": internacionalizacion(idioma),
        "@/components/logistica/tipos": { clasePanel: "panel" },
        "./capacidadVehiculo": capacidad,
        "./FotoVehiculo": { default: () => null },
        "./EstadoVehiculo": { default: () => null },
        "@/i18n/navigation": {
          Link: ({ children, ...propiedades }) =>
            React.createElement("a", propiedades, children),
        },
        "@/components/ui/button/Button": {
          default: ({ children }) =>
            React.createElement("button", null, children),
        },
      };
      const Tarjeta = cargar("TarjetaVehiculo.tsx", dependencias).default;
      const Detalle = cargar("DetalleVehiculo.tsx", dependencias).default;
      const datos = { ...vehiculo, capacidad_kg: "2500" };
      const tarjeta = representar(
        React.createElement(Tarjeta, { vehiculo: datos }),
      );
      const detalle = representar(
        React.createElement(Detalle, {
          vehiculo: datos,
          puedeEditar: false,
          puedeCambiarEstado: false,
          alCambiarEstado() {},
        }),
      );
      for (const contenido of [tarjeta, detalle]) {
        afirmar.match(contenido, idioma === "es" ? /2,5 t/ : /2\.5 t/);
        afirmar.doesNotMatch(contenido, /2500 kg/);
      }
      afirmar.doesNotMatch(detalle, /editar|<button/);
      const conPermiso = representar(
        React.createElement(Detalle, {
          vehiculo: datos,
          puedeEditar: true,
          puedeCambiarEstado: true,
          alCambiarEstado() {},
        }),
      );
      afirmar.match(conPermiso, /\/vehiculos\/4\/editar/);
      afirmar.match(conPermiso, /<button/);
    }
  },
);

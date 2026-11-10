import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup as representar } from "react-dom/server";
import * as internacionalizacion from "next-intl";
import * as iconos from "lucide-react";
import compilador from "typescript";

function cargar(nombre, dependencias = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/${nombre}`, import.meta.url),
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
        if (!(ruta in dependencias))
          throw new Error(`Dependencia de prueba pendiente: ${ruta}`);
        return dependencias[ruta];
      },
    },
  );
  return exportaciones;
}
const capacidad = cargar("despachos/capacidadDespacho.ts");
const dependencias = {
  react: React,
  "react/jsx-runtime": jsx,
  "next-intl": internacionalizacion,
  "lucide-react": iconos,
  "./capacidadDespacho": capacidad,
  "@/components/vehiculos/capacidadVehiculo": cargar(
    "vehiculos/capacidadVehiculo.ts",
  ),
  "@/components/ui/button/Button": {
    default: ({ children, disabled }) =>
      React.createElement("button", { disabled }, children),
  },
  "@/components/logistica/ConfirmacionLogistica": { default: () => null },
  "@/components/compras/PaginadorCompras": { default: () => null },
  "@/lib/api": {},
};
const Aviso = cargar(
  "despachos/AvisoCapacidadDespacho.tsx",
  dependencias,
).default;
const Acciones = cargar("despachos/AccionesDespacho.tsx", dependencias).default;

prueba(
  "enviar al chofer exige capacidad y la web no ofrece iniciar el viaje",
  () => {
    const propiedades = {
      despacho: {
        id: 1,
        estado: "borrador",
        paradas: [],
        cargas: [{ peso_kg: "50", aportes: [{ peso_kg: "50" }] }],
        vehiculo_capacidad_kg: "50",
      },
      permisos: { enviar: true, iniciar: true },
      alActualizar: () => {},
      alError: () => {},
    };
    for (const idioma of ["es", "en"]) {
      const listo = dibujar(Acciones, propiedades, idioma);
      afirmar.ok(listo.includes(mensajes[idioma].despachos.acciones.enviar));
      afirmar.ok(!listo.includes(mensajes[idioma].despachos.acciones.iniciar));
      const enviado = dibujar(
        Acciones,
        {
          ...propiedades,
          despacho: {
            ...propiedades.despacho,
            enviado_en: "2026-10-30T12:00:00Z",
          },
        },
        idioma,
      );
      afirmar.ok(!enviado.includes(mensajes[idioma].despachos.acciones.enviar));
      afirmar.ok(
        !enviado.includes(mensajes[idioma].despachos.acciones.iniciar),
      );
    }
    afirmar.ok(
      /<button disabled="">Enviar/.test(
        dibujar(Acciones, {
          ...propiedades,
          despacho: { ...propiedades.despacho, vehiculo_capacidad_kg: null },
        }),
      ),
    );
  },
);
const cargaMedida = (...pesos) => ({
  peso_kg: String(
    pesos.reduce((total, peso) => total + Math.round(Number(peso) * 1000), 0) /
      1000,
  ),
  aportes: pesos.map((peso_kg) => ({ peso_kg })),
});
const comprobar = capacidad.comprobarCapacidadDespacho;
const ocupacion = capacidad.calcularOcupacionCapacidad;
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
function dibujar(componente, propiedades, idioma = "es") {
  return representar(
    React.createElement(
      internacionalizacion.NextIntlClientProvider,
      {
        locale: idioma,
        timeZone: "America/La_Paz",
        messages: mensajes[idioma],
      },
      React.createElement(componente, propiedades),
    ),
  );
}

prueba(
  "capacidad compara kilos medidos con exactitud, incluyendo todas las paginas",
  () => {
    const resultado = comprobar("2000.000", [cargaMedida("1000", "500")]);
    afirmar.equal(resultado.estado, "apta");
    afirmar.equal(resultado.margen_kg, "500.000");
    afirmar.equal(
      comprobar("0.300", [cargaMedida("0.1", "0.2")]).estado,
      "apta",
    );
    afirmar.equal(
      comprobar("0.300", [cargaMedida("0.301")]).estado,
      "excedida",
    );
    afirmar.equal(
      comprobar(
        "10",
        Array.from({ length: 11 }, () => cargaMedida("1")),
      ).estado,
      "excedida",
    );
  },
);

prueba(
  "los pesos ausentes e inconsistentes se distinguen de una carga de cero",
  () => {
    for (const carga of [
      { peso_kg: "5", aportes: [] },
      { peso_kg: "5", aportes: [{ peso_kg: null }] },
      { peso_kg: "0", aportes: [{ peso_kg: "0" }] },
      { peso_kg: "5", aportes: [{ peso_kg: "3" }] },
    ]) {
      const resultado = comprobar("2000", [carga]);
      afirmar.equal(resultado.estado, "peso_incompleto");
      afirmar.equal(resultado.peso_kg, null);
    }
    for (const valor of [null, undefined, "", "0", "-1", "NaN"])
      afirmar.equal(
        comprobar(valor, [cargaMedida("1")]).estado,
        "sin_capacidad",
      );
    afirmar.equal(comprobar("2000", []).estado, "sin_carga");
  },
);

prueba(
  "el aviso explica cada bloqueo en ambos idiomas y muestra toneladas",
  () => {
    for (const idioma of ["es", "en"]) {
      for (const resultado of [
        comprobar(null, [cargaMedida("1")]),
        comprobar("2", [cargaMedida("3")]),
        comprobar("2000", [{ peso_kg: "5", aportes: [] }]),
        comprobar("2000", [cargaMedida("1500")]),
      ]) {
        const texto = dibujar(Aviso, { resultado }, idioma);
        afirmar.ok(texto.includes('role="status"'));
        afirmar.ok(
          texto.includes(
            mensajes[idioma].despachos.capacidadEstados[resultado.estado],
          ),
        );
        if (resultado.estado !== "apta")
          afirmar.ok(
            texto.includes(
              mensajes[idioma].despachos.capacidadAyuda[resultado.estado],
            ),
          );
        if (resultado.capacidad_kg === "2000.000")
          afirmar.ok(texto.includes("2 t"));
      }
    }
  },
);

prueba(
  "enviar se bloquea sin capacidad o por exceso y las acciones del recorrido pertenecen al chofer",
  () => {
    const despacho = {
      id: 1,
      estado: "borrador",
      paradas: [],
      cargas: [cargaMedida("50")],
    };
    const propiedades = {
      despacho,
      permisos: {
        enviar: true,
        iniciar: true,
        cancelar: true,
        recorrido: true,
        finalizar: true,
      },
      alActualizar: () => {},
      alError: () => {},
    };
    for (const capacidad of [null, "49.999", "50.000"]) {
      const texto = dibujar(Acciones, {
        ...propiedades,
        despacho: { ...despacho, vehiculo_capacidad_kg: capacidad },
      });
      afirmar.equal(
        /<button disabled="">Enviar/.test(texto),
        capacidad !== "50.000",
      );
      afirmar.ok(/<button>Cancelar/.test(texto));
    }
    const enRuta = dibujar(Acciones, {
      ...propiedades,
      despacho: { ...despacho, estado: "en_ruta", vehiculo_capacidad_kg: null },
    });
    afirmar.equal(enRuta, "");
  },
);

prueba(
  "46 kg en un camion de 2 t muestran el 2,3 por ciento y 1954 kg disponibles",
  () => {
    const resultado = comprobar("2000", [cargaMedida("14", "15", "17")]);
    const indicador = ocupacion(resultado);
    afirmar.equal(indicador.porcentaje, "2.3");
    afirmar.equal(indicador.porcentajeBarra, 2.3);
    afirmar.equal(indicador.disponibleKg, "1954.000");
    afirmar.equal(indicador.excesoKg, "0.000");
    afirmar.equal(indicador.cercaDelLimite, false);
    afirmar.equal(indicador.excedida, false);
    afirmar.equal(indicador.cota, null);
    for (const idioma of ["es", "en"]) {
      const html = dibujar(Aviso, { resultado }, idioma);
      afirmar.match(html, /role="meter"/);
      afirmar.match(html, /aria-valuenow="2.3"/);
      afirmar.ok(html.includes(idioma === "es" ? "2,3 %" : "2.3%"));
      afirmar.ok(html.includes("1954 kg") || html.includes("1,954 kg"));
      afirmar.ok(html.includes("46 kg"));
      afirmar.ok(html.includes("2 t"));
    }
  },
);

prueba(
  "el indicador recalcula capacidad y peso y advierte desde el 80 por ciento sin bloquear el envio",
  () => {
    afirmar.equal(
      ocupacion(comprobar("1000", [cargaMedida("46")])).porcentaje,
      "4.6",
    );
    const resultado = comprobar("2000", [cargaMedida("1600")]);
    afirmar.equal(resultado.estado, "apta");
    const indicador = ocupacion(resultado);
    afirmar.equal(indicador.cercaDelLimite, true);
    afirmar.equal(indicador.porcentaje, "80");
    afirmar.equal(indicador.disponibleKg, "400.000");
    afirmar.equal(
      ocupacion(comprobar("2000", [cargaMedida("1599.999")])).cercaDelLimite,
      false,
    );
  },
);

prueba(
  "un exceso de un gramo sigue visible aunque el porcentaje redondee al 100",
  () => {
    const exacta = ocupacion(comprobar("2000", [cargaMedida("2000")]));
    afirmar.equal(exacta.porcentaje, "100");
    afirmar.equal(exacta.excedida, false);
    afirmar.equal(exacta.cota, null);
    afirmar.equal(exacta.disponibleKg, "0.000");
    const resultado = comprobar("2000", [cargaMedida("2000.001")]);
    const exceso = ocupacion(resultado);
    afirmar.equal(exceso.cota, "mayor");
    afirmar.equal(exceso.excedida, true);
    afirmar.equal(exceso.excesoKg, "0.001");
    afirmar.equal(exceso.porcentajeBarra, 100);
    const html = dibujar(Aviso, { resultado });
    afirmar.ok(html.includes("Más del 100 %"));
    afirmar.ok(html.includes("Exceso: 0,001 kg"));
    const anterior = ocupacion(comprobar("2000", [cargaMedida("1999.999")]));
    afirmar.equal(anterior.cota, "menor");
    afirmar.equal(anterior.excedida, false);
    afirmar.equal(anterior.disponibleKg, "0.001");
  },
);

prueba(
  "los datos desconocidos no se convierten en una ocupacion de cero",
  () => {
    for (const resultado of [
      comprobar(null, [cargaMedida("46")]),
      comprobar("0", [cargaMedida("46")]),
      comprobar("2000", [{ peso_kg: "46", aportes: [] }]),
      comprobar("2000", []),
    ]) {
      afirmar.equal(ocupacion(resultado), null);
      const html = dibujar(Aviso, { resultado });
      afirmar.doesNotMatch(html, /role="meter"|aria-valuenow/);
    }
    const minima = ocupacion(comprobar("999999999", [cargaMedida("0.001")]));
    afirmar.equal(minima.cota, "menor");
    afirmar.equal(minima.porcentaje, "0.01");
    afirmar.equal(
      capacidad.formatearMedicionCapacidad("99999999999999.001", "en"),
      "99,999,999,999,999.001",
    );
  },
);

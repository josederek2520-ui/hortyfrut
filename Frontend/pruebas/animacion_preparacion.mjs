import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import compilador from "typescript";

const exportaciones = {};
ejecutarContexto(
  compilador.transpileModule(
    leerArchivo(
      new URL(
        "../src/components/preparaciones/animacionEntradaPreparacion.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    { compilerOptions: { module: compilador.ModuleKind.CommonJS } },
  ).outputText,
  { exports: exportaciones },
);

function prepararAnimacion(reducida = false) {
  let fotogramas;
  let opciones;
  let cancelaciones = 0;
  const escuchas = new Set();
  const preferencia = {
    matches: reducida,
    addEventListener: (_, funcion) => escuchas.add(funcion),
    removeEventListener: (_, funcion) => escuchas.delete(funcion),
  };
  const elemento = {
    animate: (nuevosFotogramas, nuevasOpciones) => {
      fotogramas = nuevosFotogramas;
      opciones = nuevasOpciones;
      return { cancel: () => cancelaciones++ };
    },
  };
  const limpiar = exportaciones.animarEntradaPreparacion(elemento, preferencia);
  return {
    fotogramas,
    opciones,
    escuchas,
    limpiar,
    cambiarPreferencia: () => escuchas.forEach((funcion) => funcion()),
    cancelaciones: () => cancelaciones,
  };
}

prueba(
  "movimiento reducido muestra una entrada breve sin desplazamiento",
  () => {
    const sesion = prepararAnimacion(true);
    afirmar.ok(sesion.opciones.duration <= 100);
    afirmar.ok(sesion.fotogramas.every((paso) => !("transform" in paso)));
    sesion.limpiar();
  },
);

prueba(
  "la entrada solo anima composición y no retiene estilos ni bloquea controles",
  () => {
    const sesion = prepararAnimacion();
    afirmar.ok(sesion.opciones.duration <= 300);
    afirmar.equal(sesion.opciones.fill, undefined);
    for (const paso of sesion.fotogramas)
      afirmar.ok(
        Object.keys(paso).every((clave) =>
          ["opacity", "transform"].includes(clave),
        ),
      );
    sesion.limpiar();
  },
);

prueba(
  "volver o cambiar de producto cancela la entrada y retira las escuchas",
  () => {
    const sesion = prepararAnimacion();
    afirmar.equal(sesion.escuchas.size, 1);
    sesion.limpiar();
    afirmar.equal(sesion.cancelaciones(), 1);
    afirmar.equal(sesion.escuchas.size, 0);
  },
);

prueba(
  "cambiar la preferencia de movimiento detiene una entrada activa",
  () => {
    const sesion = prepararAnimacion();
    sesion.cambiarPreferencia();
    afirmar.equal(sesion.cancelaciones(), 1);
    sesion.limpiar();
  },
);

prueba("sin Web Animations la vista conserva su funcionamiento", () => {
  const limpiar = exportaciones.animarEntradaPreparacion({}, {});
  afirmar.doesNotThrow(limpiar);
});

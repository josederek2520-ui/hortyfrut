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
        "../src/components/despachos/cajillasPreparadasDespacho.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    {
      compilerOptions: {
        module: compilador.ModuleKind.CommonJS,
        target: compilador.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports: exportaciones },
);
const {
  preverCajillasCarga,
  conservarCajillasManuales,
  cajillasEfectivasDespacho,
  usaCajillasAutomaticas,
} = exportaciones;
const plan = (cambios = {}) => ({
  preparacion_id: 1,
  producto_id: 3,
  sucursal_id: 5,
  cajilla_id: 2,
  color: "Verde",
  cantidad: 7,
  ...cambios,
});
const carga = (cambios = {}) => ({
  preparacion: 1,
  producto: 3,
  sucursal: 5,
  cantidad: 999,
  cajillas_previstas: [plan()],
  ...cambios,
});
const normalizar = (valor) => JSON.parse(JSON.stringify(valor));

prueba(
  "varios pedidos y lotes en mas de una pagina comparten una sola prevision",
  () => {
    const cargas = Array.from({ length: 22 }, (_, id) =>
      carga({ id, pedido: id + 1 }),
    );
    const resultado = preverCajillasCarga(cargas);
    afirmar.equal(resultado.length, 1);
    afirmar.equal(resultado[0].cantidad, 7);
    afirmar.equal(
      preverCajillasCarga([carga({ cajillas_previstas: [] })]).length,
      0,
    );
  },
);

prueba(
  "cada producto y preparacion aportan una vez; se excluyen destinos y productos no elegidos",
  () => {
    const erroneas = [
      plan(),
      plan({ producto_id: 10 }),
      plan({ sucursal_id: 8 }),
      plan({ preparacion_id: 2 }),
    ];
    const resultado = preverCajillasCarga([
      carga({ cajillas_previstas: erroneas }),
      carga({
        producto: 4,
        cajillas_previstas: [
          plan({ producto_id: 4, cantidad: 3 }),
          plan({ producto_id: null, cantidad: 1 }),
        ],
      }),
      carga({
        cajillas_previstas: [plan(), plan({ producto_id: null, cantidad: 1 })],
      }),
      carga({
        preparacion: 2,
        cajillas_previstas: [plan({ preparacion_id: 2, cantidad: 2 })],
      }),
    ]);
    afirmar.equal(resultado.length, 1);
    afirmar.equal(resultado[0].cantidad, 13);
  },
);

prueba(
  "los ajustes y retiradas manuales sobreviven al cambiar carga; los destinos quitados desaparecen",
  () => {
    const anteriores = [
      carga(),
      carga({ sucursal: 8, cajillas_previstas: [plan({ sucursal_id: 8 })] }),
    ];
    const siguientes = [
      carga(),
      carga({ sucursal: 9, cajillas_previstas: [plan({ sucursal_id: 9 })] }),
    ];
    const manuales = [
      { sucursal: 5, cajilla: 2, color: "Verde", cantidad: 4 },
      { sucursal: 8, cajilla: 2, color: "Verde", cantidad: 9 },
    ];
    const resultado = conservarCajillasManuales(
      anteriores,
      siguientes,
      manuales,
    );
    afirmar.deepEqual(normalizar(resultado), [
      { sucursal: 5, cajilla: 2, color: "Verde", cantidad: 4 },
      { sucursal: 9, cajilla: 2, color: "Verde", cantidad: 7 },
    ]);
    afirmar.equal(
      conservarCajillasManuales([carga()], [carga()], []).length,
      0,
    );
    afirmar.equal(manuales.length, 2);
  },
);

prueba(
  "solo los borradores sin enviar y sin ajuste manual recuperan previstas",
  () => {
    const documento = {
      estado: "borrador",
      enviado_en: null,
      cajillas: [],
      cargas: [carga()],
    };
    afirmar.equal(cajillasEfectivasDespacho(documento)[0].cantidad, 7);
    afirmar.equal(
      usaCajillasAutomaticas({ ...documento, cajillas_automaticas: false }),
      false,
    );
    afirmar.equal(
      cajillasEfectivasDespacho({ ...documento, cajillas_automaticas: false })
        .length,
      0,
    );
    afirmar.equal(
      usaCajillasAutomaticas({ ...documento, cajillas: [{ cantidad: 4 }] }),
      false,
    );
    for (const estado of ["en_ruta", "finalizado", "cancelado"]) {
      afirmar.equal(
        cajillasEfectivasDespacho({ ...documento, estado }).length,
        0,
      );
    }
    afirmar.equal(
      cajillasEfectivasDespacho({ ...documento, enviado_en: "2026-11-03" })
        .length,
      0,
    );
  },
);

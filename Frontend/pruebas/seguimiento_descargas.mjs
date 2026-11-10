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

function cargar(nombre, dependencias) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/despachos/${nombre}`, import.meta.url),
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
          throw Error(`Dependencia no configurada: ${ruta}`);
        return dependencias[ruta];
      },
    },
  );
  return exportaciones;
}

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
const pedido = {
  pedido: 1,
  parada: 3,
  codigo_pedido: "PED-000001",
  fecha_requerida: "2026-11-02",
  sucursal: 12,
  productos: 1,
  asignaciones: 2,
  cajas: 2,
  unidades: 0,
  peso_kg: "5.400",
  descargada_en: null,
  responsable_descarga_nombre: "",
  registro_anterior: false,
};
const consultas = [];
const dependencias = {
  react: React,
  "react/jsx-runtime": jsx,
  "next-intl": internacionalizacion,
  "lucide-react": iconos,
  "@/components/logistica/useConsultaLogistica": {
    default: (ruta) => {
      consultas.push(ruta);
      return {
        cargando: false,
        fallo: false,
        datos: {
          count: 11,
          results: Array.from({ length: 10 }, (_, indice) => ({
            ...pedido,
            pedido: indice + 1,
            codigo_pedido: `PED-${String(indice + 1).padStart(6, "0")}`,
          })),
        },
      };
    },
  },
  "@/components/logistica/EstadoConsultaLogistica": { default: () => null },
  "@/components/compras/PaginadorCompras": {
    default: ({ pagina, total }) =>
      React.createElement("nav", {
        "data-pagina": pagina,
        "data-total": total,
      }),
  },
  "@/components/compras/calculos": { mostrarFecha: (valor) => valor },
  "./CargaDetalleDespacho": { default: () => null },
  "@/components/ui/button/Button": {
    default: ({ children }) => React.createElement("button", null, children),
  },
  "@/components/logistica/ConfirmacionLogistica": { default: () => null },
  "@/lib/api": {},
  "./capacidadDespacho": {},
};
const seguimiento = cargar("SeguimientoPedidosDespacho.tsx", dependencias);
const Acciones = cargar("AccionesDespacho.tsx", dependencias).default;
function dibujar(componente, propiedades, idioma = "es") {
  return representar(
    React.createElement(
      internacionalizacion.NextIntlClientProvider,
      {
        locale: idioma,
        messages: mensajes[idioma],
        timeZone: "America/La_Paz",
      },
      React.createElement(componente, propiedades),
    ),
  );
}

prueba(
  "el pedido pendiente muestra fecha y cantidades legibles sin unidades vacias",
  () => {
    for (const idioma of ["es", "en"]) {
      const resultado = dibujar(
        seguimiento.PedidoSeguimiento,
        { pedido, despachoId: 2, paradaId: 3, alError: () => {} },
        idioma,
      );
      afirmar.ok(resultado.includes("PED-000001"));
      afirmar.ok(resultado.includes("2026-11-02"));
      afirmar.ok(
        resultado.includes(mensajes[idioma].despachos.pedidoPendienteDescarga),
      );
      afirmar.ok(resultado.includes(idioma === "es" ? "5,4 kg" : "5.4 kg"));
      afirmar.ok(!resultado.includes("UNI"));
      afirmar.ok(!resultado.includes("5.400"));
      afirmar.ok(!resultado.includes("Confirmar descarga"));
      afirmar.ok(resultado.includes("min-h-11"));
      afirmar.ok(resultado.includes("motion-safe:transition-transform"));
    }
  },
);

prueba(
  "la descarga muestra responsable y fecha y distingue registros anteriores",
  () => {
    const propiedades = {
      pedido: {
        ...pedido,
        descargada_en: "2026-10-30T16:00:00Z",
        responsable_descarga_nombre: "Chofer de prueba",
      },
      despachoId: 2,
      paradaId: 3,
      alError: () => {},
    };
    const actual = dibujar(seguimiento.PedidoSeguimiento, propiedades);
    afirmar.ok(actual.includes("Descargado"));
    afirmar.ok(actual.includes("Chofer de prueba"));
    const anterior = dibujar(seguimiento.PedidoSeguimiento, {
      ...propiedades,
      pedido: {
        ...propiedades.pedido,
        registro_anterior: true,
        responsable_descarga_nombre: "",
      },
    });
    afirmar.ok(
      anterior.includes(mensajes.es.despachos.descargaHistoricaSucursal),
    );
    afirmar.ok(!anterior.includes("Confirmó:"));
  },
);

prueba(
  "consulta la parada correcta y presenta diez pedidos con su paginacion",
  () => {
    consultas.length = 0;
    const resultado = dibujar(seguimiento.default, {
      despachoId: 2,
      paradaId: 3,
      alError: () => {},
    });
    afirmar.equal(consultas.at(-1), "despachos/2/pedidos/?parada=3&pagina=1");
    afirmar.equal((resultado.match(/<article/g) || []).length, 10);
    afirmar.ok(resultado.includes('data-total="11"'));
    afirmar.ok(resultado.includes('data-pagina="1"'));
  },
);

prueba(
  "la web no ofrece confirmar toda la sucursal despues de la llegada",
  () => {
    const resultado = dibujar(Acciones, {
      despacho: {
        estado: "en_ruta",
        cargas: [],
        paradas: [
          { id: 3, llegada_en: "2026-10-30T12:00:00Z", descargada_en: null },
        ],
        comprobacion_capacidad: { estado: "apta" },
      },
      permisos: { recorrido: true, finalizar: true },
      alActualizar: () => {},
      alError: () => {},
    });
    afirmar.ok(!resultado.includes("<button"));
    afirmar.ok(!resultado.includes("descarga"));
  },
);

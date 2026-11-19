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
const {
  centavosCobro,
  prepararCobro,
  importeDesdeCentavos,
  sumarAplicaciones,
} = cargar("components/cobros/calculosCobro");
const saldo = (id, cambios = {}) => ({
  id,
  cliente: 2,
  codigo: "VEN-" + id,
  fecha_emision: "2026-11-12",
  total: "100.00",
  cobrado: "0.00",
  saldo: "100.00",
  version_saldo: "saldo" + id,
  estado_cobro: "pendiente",
  ...cambios,
});
const formulario = () => ({
  cliente: { id: 2, nombre: "Supermercado", nit: "123" },
  fecha_cobro: "2026-11-12",
  importe: "30,00",
  medio: "efectivo",
  comprobante: null,
  aplicaciones: [{ ...saldo(1), importeAplicado: "30.00" }],
});

prueba(
  "el cobro parcial conserva centavos exactos sin completar otros saldos",
  () => {
    afirmar.equal(centavosCobro("0,10") + centavosCobro("0.20"), 30n);
    afirmar.equal(
      importeDesdeCentavos(999999999999999999n),
      "9999999999999999.99",
    );
    for (const valor of ["NaN", "1e3", "-1", "1.001", "10000000000000000.00"])
      afirmar.equal(centavosCobro(valor), null);
    const preparado = prepararCobro(formulario(), generarUuid());
    afirmar.equal(preparado.errores.length, 0);
    afirmar.equal(preparado.cuerpo.aplicaciones[0].importe, "30.00");
    afirmar.equal(preparado.cuerpo.aplicaciones[0].version_saldo, "saldo1");
  },
);
prueba(
  "asignacion, cliente, comprobante y ventas de otras paginas se validan",
  () => {
    const f = formulario();
    f.aplicaciones = Array.from({ length: 12 }, (_, i) => ({
      ...saldo(i + 1),
      importeAplicado: i === 11 ? "" : "1",
    }));
    f.importe = "12";
    afirmar.ok(
      prepararCobro(f, generarUuid()).errores.includes("aplicacionValida"),
    );
    f.aplicaciones[11].importeAplicado = "1";
    afirmar.equal(prepararCobro(f, generarUuid()).errores.length, 0);
    afirmar.equal(sumarAplicaciones(f), 1200n);
    f.aplicaciones[11].saldo = "0";
    afirmar.ok(
      prepararCobro(f, generarUuid()).errores.includes("aplicacionValida"),
    );
    f.medio = "transferencia";
    afirmar.ok(
      prepararCobro(f, generarUuid()).errores.includes("comprobanteNecesario"),
    );
    f.medio = "efectivo";
    afirmar.ok(
      !prepararCobro(f, generarUuid()).errores.includes("comprobanteNecesario"),
    );
  },
);

class ErrorApi extends Error {
  constructor(status, errors = {}) {
    super();
    this.status = status;
    this.errors = errors;
  }
}
function escenario(
  solicitar,
  nombre = "components/cobros/useHojaCobro",
  extras = {},
) {
  let cursor = 0;
  const memoria = [],
    efectos = [],
    eventos = new Map();
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
        dependencias.some((d, j) => d !== memoria[i].dependencias[j])
      )
        memoria[i] = { funcion, dependencias };
      return memoria[i].funcion;
    },
    useEffect(funcion, dependencias) {
      const i = cursor++;
      if (
        !memoria[i] ||
        dependencias.some((d, j) => d !== memoria[i].dependencias[j])
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
      ...extras.dependencias,
    },
    {
      URLSearchParams,
      FormData,
      File,
      window: {
        addEventListener(clave, funcion) {
          if (!eventos.has(clave)) eventos.set(clave, new Set());
          eventos.get(clave).add(funcion);
        },
        removeEventListener(clave, funcion) {
          eventos.get(clave)?.delete(funcion);
        },
      },
      ...extras.globales,
    },
  )(nombre).default;
  return {
    dibujar(...parametros) {
      cursor = 0;
      const valor = usar(...parametros);
      efectos.splice(0).forEach((e) => e());
      return valor;
    },
    desmontar() {
      memoria.forEach((m) => m?.limpiar?.());
    },
    cambiarSesion() {
      eventos.get("hortyfru:session-changed")?.forEach((f) => f());
    },
  };
}
function anotar(entorno) {
  entorno.dibujar().cambiar(formulario());
  return entorno.dibujar();
}
const revision = {
  medio: "efectivo",
  fecha_cobro: "2026-11-12",
  comprobante: null,
  revision: "revision1",
  importe: "30.00",
  cliente_nombre: "Supermercado",
  aplicaciones: [
    {
      venta: 1,
      codigo: "VEN-1",
      importe: "30.00",
      saldo_anterior: "100.00",
      saldo_posterior: "70.00",
    },
  ],
};
const archivoPrueba = (contenido = "recibo") =>
  new File([contenido], "recibo.png", { type: "image/png" });
prueba(
  "Mis pagos usa exclusivamente su API y conserva el comprobante al reintentar",
  async () => {
    const peticiones = [];
    let incierto = true;
    const entorno = escenario(async (ruta, opciones) => {
      afirmar.ok(ruta.startsWith("mis-pagos/"));
      afirmar.ok(opciones.body instanceof FormData);
      peticiones.push({
        ruta,
        cuerpo: opciones.body.get("datos"),
        archivo: await opciones.body.get("comprobante").text(),
      });
      if (ruta.endsWith("revisar/"))
        return { ...revision, medio: "transferencia" };
      if (incierto) {
        incierto = false;
        throw new ErrorApi(0);
      }
      return { id: 38, codigo: "PAG-000038", estado: "por_verificar" };
    });
    const opciones = { ruta: "mis-pagos", cliente: formulario().cliente };
    afirmar.equal(entorno.dibujar(opciones).formulario.medio, "transferencia");
    afirmar.equal(entorno.dibujar(opciones).formulario.cliente.id, 2);
    entorno
      .dibujar(opciones)
      .cambiar({
        importe: "30",
        aplicaciones: formulario().aplicaciones,
        comprobante: archivoPrueba("inmutable"),
      });
    await entorno.dibujar(opciones).operar("revisar");
    await entorno.dibujar(opciones).operar("registrar");
    afirmar.ok(entorno.dibujar(opciones).bloqueado);
    entorno
      .dibujar(opciones)
      .cambiar({ importe: "50", comprobante: archivoPrueba("reemplazado") });
    const resultado = await entorno.dibujar(opciones).operar("reintentar");
    afirmar.equal(resultado.estado, "por_verificar");
    afirmar.deepEqual(
      peticiones.map((p) => p.ruta),
      ["mis-pagos/revisar/", "mis-pagos/", "mis-pagos/"],
    );
    afirmar.equal(peticiones[1].cuerpo, peticiones[2].cuerpo);
    afirmar.ok(peticiones.every((p) => p.archivo === "inmutable"));
    afirmar.equal(JSON.parse(peticiones[2].cuerpo).importe, "30.00");
  },
);
prueba(
  "transferencias y depositos requieren archivo valido y cheque no se registra",
  () => {
    const f = formulario();
    for (const medio of ["transferencia", "deposito"]) {
      f.medio = medio;
      afirmar.ok(
        prepararCobro(f, generarUuid()).errores.includes(
          "comprobanteNecesario",
        ),
      );
      f.comprobante = archivoPrueba();
      afirmar.deepEqual(
        Array.from(prepararCobro(f, generarUuid()).errores),
        [],
      );
      f.comprobante = { size: 8 * 1024 * 1024 + 1, type: "image/png" };
      afirmar.ok(
        prepararCobro(f, generarUuid()).errores.includes("comprobanteValido"),
      );
      f.comprobante = null;
    }
    f.medio = "cheque";
    afirmar.ok(prepararCobro(f, generarUuid()).errores.includes("medioValido"));
  },
);
prueba(
  "reintentar conserva JSON UUID nombre y bytes del comprobante revisado",
  async () => {
    const peticiones = [];
    let perder = true;
    const entorno = escenario(async (ruta, opciones) => {
      afirmar.ok(opciones.body instanceof FormData);
      const archivo = opciones.body.get("comprobante");
      peticiones.push({
        ruta,
        datos: opciones.body.get("datos"),
        nombre: archivo.name,
        contenido: await archivo.text(),
      });
      if (ruta.endsWith("/revisar/")) return revision;
      if (perder) {
        perder = false;
        throw new ErrorApi(0);
      }
      return { id: 23 };
    });
    const f = {
      ...formulario(),
      medio: "transferencia",
      comprobante: archivoPrueba("contenido original"),
    };
    entorno.dibujar().cambiar(f);
    await entorno.dibujar().operar("revisar");
    await entorno.dibujar().operar("registrar");
    entorno.dibujar().cambiar({ comprobante: archivoPrueba("otro contenido") });
    const resultado = await entorno.dibujar().operar("reintentar");
    afirmar.equal(resultado.id, 23);
    afirmar.equal(peticiones.length, 3);
    afirmar.equal(peticiones[1].datos, peticiones[2].datos);
    afirmar.equal(
      JSON.parse(peticiones[0].datos).clave_operacion,
      JSON.parse(peticiones[1].datos).clave_operacion,
    );
    afirmar.ok(
      peticiones.every(
        (p) =>
          p.nombre === "recibo.png" && p.contenido === "contenido original",
      ),
    );
  },
);
prueba(
  "cambiar archivo invalida revision y efectivo retira el comprobante",
  async () => {
    let llamadas = 0;
    const entorno = escenario(async () => {
      llamadas++;
      return revision;
    });
    entorno.dibujar().cambiar({
      ...formulario(),
      medio: "deposito",
      comprobante: archivoPrueba(),
    });
    await entorno.dibujar().operar("revisar");
    entorno.dibujar().cambiar({ comprobante: archivoPrueba("otro") });
    afirmar.equal(entorno.dibujar().revision, null);
    await entorno.dibujar().operar("registrar");
    afirmar.equal(llamadas, 1);
    entorno.dibujar().cambiar({ medio: "efectivo" });
    afirmar.equal(entorno.dibujar().formulario.comprobante, null);
  },
);
prueba(
  "revisar precede al registro y conserva la misma distribucion y UUID",
  async () => {
    const peticiones = [],
      entorno = escenario(async (ruta, opciones) => {
        peticiones.push({ ruta, cuerpo: JSON.parse(opciones.body) });
        return ruta.endsWith("/revisar/")
          ? revision
          : { id: 7, codigo: "COB-7" };
      });
    await anotar(entorno).operar("revisar");
    afirmar.equal(entorno.dibujar().revision.revision, "revision1");
    const resultado = await entorno.dibujar().operar("registrar");
    afirmar.equal(resultado.id, 7);
    afirmar.equal(peticiones.length, 2);
    afirmar.equal(
      peticiones[0].cuerpo.clave_operacion,
      peticiones[1].cuerpo.clave_operacion,
    );
    afirmar.deepEqual(
      peticiones[0].cuerpo.aplicaciones,
      peticiones[1].cuerpo.aplicaciones,
    );
    afirmar.equal(peticiones[1].cuerpo.revision, "revision1");
  },
);
prueba(
  "resultado incierto conserva exactamente cuerpo UUID y destino al reintentar",
  async () => {
    let perder = true;
    const cuerpos = [],
      entorno = escenario(async (ruta, opciones) => {
        if (ruta.endsWith("/revisar/")) return revision;
        cuerpos.push(opciones.body);
        if (perder) {
          perder = false;
          throw new ErrorApi(0);
        }
        return { id: 8 };
      });
    await anotar(entorno).operar("revisar");
    await entorno.dibujar().operar("registrar");
    const estado = entorno.dibujar();
    afirmar.equal(estado.operacion.incierto, true);
    estado.cambiar({ importe: "999" });
    afirmar.equal(entorno.dibujar().formulario.importe, "30,00");
    const resultado = await estado.operar("reintentar");
    afirmar.equal(resultado.id, 8);
    afirmar.equal(cuerpos[0], cuerpos[1]);
  },
);
for (const salida of ["desmontar", "cambiarSesion"])
  prueba(
    "respuesta tardia no vuelve a abrir la revision tras " + salida,
    async () => {
      let completar;
      const entorno = escenario(
        () =>
          new Promise((r) => {
            completar = r;
          }),
      );
      const pendiente = anotar(entorno).operar("revisar");
      entorno[salida]();
      completar(revision);
      await pendiente;
      afirmar.equal(entorno.dibujar().revision, null);
    },
  );
prueba(
  "doble clic no registra dos escrituras y un conflicto deja visible el error",
  async () => {
    let completar,
      llamadas = 0;
    const entorno = escenario(async (ruta) => {
      if (ruta.endsWith("/revisar/")) return revision;
      llamadas++;
      return new Promise((r) => {
        completar = r;
      });
    });
    await anotar(entorno).operar("revisar");
    const estado = entorno.dibujar(),
      primera = estado.operar("registrar");
    await estado.operar("registrar");
    afirmar.equal(llamadas, 1);
    completar({ id: 9 });
    await primera;
    const conflicto = escenario(async (ruta) => {
      if (ruta.endsWith("/revisar/")) return revision;
      throw new ErrorApi(409);
    });
    await anotar(conflicto).operar("revisar");
    await conflicto.dibujar().operar("registrar");
    afirmar.equal(conflicto.dibujar().revision, null);
    afirmar.equal(conflicto.dibujar().operacion.fallo, "conflicto");
  },
);
prueba(
  "refrescar saldos conserva importes y consulta todas las paginas de diez",
  async () => {
    const rutas = [],
      entorno = escenario(async (ruta) => {
        rutas.push(ruta);
        const pagina = Number(
          new URLSearchParams(ruta.split("?")[1]).get("pagina"),
        );
        return {
          count: 12,
          version_origen: "nueva",
          results: Array.from({ length: pagina === 1 ? 10 : 2 }, (_, i) =>
            saldo((pagina - 1) * 10 + i + 1, {
              saldo: "80.00",
              version_saldo: "actual",
            }),
          ),
        };
      });
    const f = formulario();
    f.aplicaciones = Array.from({ length: 12 }, (_, i) => ({
      ...saldo(i + 1),
      importeAplicado: "1.25",
    }));
    entorno.dibujar().cambiar(f);
    await entorno.dibujar().actualizarSaldos();
    afirmar.equal(rutas.length, 2);
    afirmar.ok(
      entorno
        .dibujar()
        .formulario.aplicaciones.every(
          (f) => f.importeAplicado === "1.25" && f.saldo === "80.00",
        ),
    );
  },
);
prueba(
  "saldos cambiados entre paginas no se aplican parcialmente",
  async () => {
    let llamadas = 0;
    const entorno = escenario(async () => ({
      count: 12,
      version_origen: String(++llamadas),
      results: Array.from({ length: llamadas === 1 ? 10 : 2 }, (_, i) =>
        saldo((llamadas - 1) * 10 + i + 1, { saldo: "80.00" }),
      ),
    }));
    const f = formulario();
    f.aplicaciones = Array.from({ length: 12 }, (_, i) => ({
      ...saldo(i + 1),
      importeAplicado: "1.25",
    }));
    entorno.dibujar().cambiar(f);
    await entorno.dibujar().actualizarSaldos();
    afirmar.equal(entorno.dibujar().falloActualizacion, true);
    afirmar.ok(
      entorno
        .dibujar()
        .formulario.aplicaciones.every((f) => f.saldo === "100.00"),
    );
  },
);
for (const salida of ["desmontar", "cambiarSesion"])
  prueba(
    "una descarga tardia de comprobante se descarta al " + salida,
    async () => {
      let completar,
        descargas = 0;
      const entorno = escenario(
        null,
        "components/cobros/DescargarComprobanteCobro",
        {
          dependencias: {
            "react/jsx-runtime": jsx,
            "next-intl": { useTranslations: () => (clave) => clave },
            "lucide-react": { Download: "svg" },
            "@/components/ui/button/Button": { default: "button" },
          },
          globales: {
            fetch: () =>
              new Promise((resolver) => {
                completar = resolver;
              }),
            URL: {
              createObjectURL: () => {
                descargas++;
                return "blob:prueba";
              },
              revokeObjectURL() {},
            },
            document: { createElement: () => ({ click() {} }) },
          },
        },
      );
      const vista = entorno.dibujar({
        cobro: {
          id: 7,
          codigo: "COB-7",
          comprobante: { tipo: "image/png", tamano: 3 },
        },
      });
      React.Children.toArray(vista.props.children)
        .find((e) => e.type === "button")
        .props.onClick();
      entorno[salida]();
      completar({
        ok: true,
        headers: { get: () => "image/png" },
        blob: async () => new Blob(["png"]),
      });
      await new Promise((resolver) => setTimeout(resolver, 0));
      afirmar.equal(descargas, 0);
    },
  );
for (const idioma of ["es", "en"]) {
  const mensajes = JSON.parse(
    leerArchivo(
      new URL("../src/messages/" + idioma + ".json", import.meta.url),
      "utf8",
    ),
  );
  const dependenciasVista = {
    react: React,
    "react/jsx-runtime": jsx,
    "next-intl": {
      useLocale: () => idioma,
      useTranslations: (namespace) =>
        crearTraductor({ locale: idioma, messages: mensajes, namespace }),
    },
    "lucide-react": new Proxy({}, { get: () => () => null }),
    "@/components/ui/modal": {
      Modal: ({ children }) => React.createElement("div", null, children),
    },
    "@/components/pedidos/PaginadorPedidos": {
      default: () => React.createElement("nav", null, "Paginacion"),
    },
    "@/components/form/CampoFecha": {
      default: ({ id, value, disabled }) =>
        React.createElement("input", { id, value, disabled, readOnly: true }),
    },
  };
  const cargarVista = crearCargadorChofer(dependenciasVista);
  prueba(
    "el supermercado solo informa pagos bancarios y mantiene separado el saldo futuro en " +
      idioma,
    () => {
      const Datos = cargarVista("components/cobros/DatosCobro").default;
      const html = representar(
        React.createElement(Datos, {
          formulario: { ...formulario(), medio: "transferencia" },
          supermercado: true,
          clienteFijo: true,
          bloqueado: false,
          alCambiar() {},
          alCliente() {},
        }),
      );
      afirmar.ok(html.includes('value="transferencia"'));
      afirmar.ok(html.includes('value="deposito"'));
      afirmar.ok(html.includes('type="file"'));
      afirmar.ok(!html.includes('value="efectivo"'));
      afirmar.ok(!html.includes('value="otro"'));
      afirmar.ok(!html.includes(mensajes.cobros.cambiarCliente));
      const Revision = cargarVista("components/cobros/RevisionCobro").default;
      const resumen = representar(
        React.createElement(Revision, {
          revision,
          supermercado: true,
          ocupado: false,
          alCerrar() {},
          alConfirmar() {},
        }),
      );
      afirmar.ok(resumen.includes(mensajes.pagos.saldoSiConfirma));
      afirmar.ok(resumen.includes(mensajes.pagos.enviarPago));
    },
  );
  prueba(
    "el detalle propio no ofrece verificar y la oficina respeta cada permiso en " +
      idioma,
    () => {
      const pago = {
        id: 38,
        codigo: "PAG-000038",
        version: "version1",
        estado: "por_verificar",
        cliente_nombre: "Supermercado",
        importe: "30.00",
        medio: "transferencia",
        fecha_cobro: "2026-11-12",
        informado_por_nombre: "Responsable",
        informado_en: "2026-11-12T12:00:00Z",
        comprobante: { nombre: "recibo.png" },
      };
      const cargarDetalle = crearCargadorChofer({
        ...dependenciasVista,
        "@/i18n/navigation": {
          Link: ({ href, children, ...atributos }) =>
            React.createElement("a", { href, ...atributos }, children),
        },
        "@/components/comercial/useConsultaComercial": {
          default: () => ({ sesionValida: true, datos: pago, recargar() {} }),
        },
        "@/components/comercial/useOperacionComercial": {
          default: () => ({
            autorizado: true,
            ocupado: false,
            incierto: false,
            fallo: null,
          }),
        },
        "@/components/comercial/useProteccionComercial": {
          default: () => ({ destino: null, salir() {} }),
        },
        "@/components/cobros/DescargarComprobanteCobro": {
          default: ({ ruta }) =>
            React.createElement("button", { "data-ruta": ruta }, "Descargar"),
        },
        "@/lib/chofer/infraestructura/crearClaveOperacion": {
          crearClaveOperacion: generarUuid,
        },
        "./AplicacionesPago": { default: () => null },
      });
      const Detalle = cargarDetalle("components/pagos/DetallePago").default;
      const propio = representar(
        React.createElement(Detalle, {
          identificador: 38,
          oficina: false,
          puedeConfirmar: true,
          puedeObservar: true,
        }),
      );
      afirmar.ok(propio.includes('data-ruta="mis-pagos"'));
      afirmar.ok(!propio.includes(mensajes.pagos.confirmarIngreso));
      afirmar.ok(!propio.includes(mensajes.pagos.observar));
      const oficina = representar(
        React.createElement(Detalle, {
          identificador: 38,
          oficina: true,
          puedeConfirmar: true,
          puedeObservar: false,
        }),
      );
      afirmar.ok(oficina.includes('data-ruta="pagos-por-verificar"'));
      afirmar.ok(oficina.includes(mensajes.pagos.confirmarIngreso));
      afirmar.ok(!oficina.includes(mensajes.pagos.observar));
    },
  );
  prueba(
    "solo transferencia y deposito muestran comprobante y cheque no se ofrece en " +
      idioma,
    () => {
      const Datos = cargarVista("components/cobros/DatosCobro").default;
      for (const medio of ["efectivo", "transferencia", "deposito", "otro"]) {
        const html = representar(
          React.createElement(Datos, {
            formulario: { ...formulario(), medio },
            bloqueado: false,
            alCambiar() {},
            alCliente() {},
          }),
        );
        afirmar.equal(
          html.includes('type="file"'),
          ["transferencia", "deposito"].includes(medio),
        );
        afirmar.ok(!html.includes('value="cheque"'));
        afirmar.ok(!html.includes('id="referencia-cobro"'));
      }
    },
  );
  prueba(
    "la revision muestra diez aplicaciones y saldos restantes en " + idioma,
    () => {
      const Vista = cargarVista("components/cobros/RevisionCobro").default;
      const html = representar(
        React.createElement(Vista, {
          revision: {
            ...revision,
            aplicaciones: Array.from({ length: 12 }, (_, i) => ({
              ...revision.aplicaciones[0],
              venta: i + 1,
              codigo: "VENTA PRUEBA " + (i + 1),
            })),
          },
          ocupado: false,
          alCerrar() {},
          alConfirmar() {},
        }),
      );
      afirmar.ok(html.includes("VENTA PRUEBA 10"));
      afirmar.ok(!html.includes("VENTA PRUEBA 11"));
      afirmar.ok(html.includes(mensajes.cobros.saldoPosterior));
    },
  );
  prueba("los estados parcial y pagada se distinguen en " + idioma, () => {
    const Vista = cargarVista("components/ventas/EstadoCobroVenta").default;
    for (const estado of ["pendiente", "parcial", "pagada"])
      afirmar.ok(
        representar(React.createElement(Vista, { estado })).includes(
          mensajes.ventas[estado],
        ),
      );
  });
}
prueba(
  "empresa, cobros, estados y permisos tienen traducciones completas",
  () => {
    const leer = (idioma) =>
      JSON.parse(
        leerArchivo(
          new URL("../src/messages/" + idioma + ".json", import.meta.url),
          "utf8",
        ),
      );
    const claves = (obj, p = "") =>
      Object.entries(obj)
        .flatMap(([k, v]) =>
          typeof v === "object" ? claves(v, p + k + ".") : [p + k],
        )
        .sort();
    for (const espacio of ["empresa", "cobros", "comercialComun", "pagos"])
      afirmar.deepEqual(
        claves(leer("es")[espacio]),
        claves(leer("en")[espacio]),
      );
    for (const idioma of ["es", "en"])
      for (const clave of [
        "view_datosempresa",
        "change_datosempresa",
        "view_cobro",
        "add_cobro",
        "view_avisopago",
        "consultar_pagos_propios",
        "informar_pagos_propios",
        "confirmar_avisopago",
        "observar_avisopago",
      ])
        afirmar.ok(leer(idioma).roles.permissionLabels[clave]);
  },
);

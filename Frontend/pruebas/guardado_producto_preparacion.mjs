import { test as prueba } from "node:test";
import afirmar from "node:assert/strict";
import { readFileSync as leerArchivo } from "node:fs";
import { runInNewContext as ejecutarContexto } from "node:vm";
import { setTimeout as esperar } from "node:timers/promises";
import { createTranslator as crearTraductor } from "next-intl";
import compilador from "typescript";

function cargar(nombre, dependencias = {}, entorno = {}) {
  const exportaciones = {};
  ejecutarContexto(
    compilador.transpileModule(
      leerArchivo(
        new URL(`../src/components/preparaciones/${nombre}`, import.meta.url),
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
        if (ruta.endsWith(".module.css")) return { default: {} };
        // Los componentes hijos se inspeccionan por sus propiedades; no se simula el navegador.
        return { default: ruta.split("/").at(-1) };
      },
      URLSearchParams,
      URL,
      AbortController,
      ...entorno,
    },
  );
  return exportaciones;
}
const calculos = cargar("calculos.ts");
const validaciones = cargar("validaciones.ts", { "./calculos": calculos });
const salida = cargar("salidaTrabajoPreparacion.ts");
const mensajes = JSON.parse(
  leerArchivo(new URL("../src/messages/es.json", import.meta.url), "utf8"),
);
const traducir = crearTraductor({
  locale: "es",
  messages: mensajes,
  namespace: "preparaciones",
});
const producto = {
  id: 1,
  nombre: "Banana",
  cajas: 3,
  unidades: 0,
  pendientes_cajas: 3,
  pendientes_unidades: 0,
};

prueba(
  "la salida protege otras pantallas y respeta enlaces que conservan la hoja",
  () => {
    const evento = {
      defaultPrevented: false,
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
    };
    const ubicacion = { href: "http://localhost:3000/preparaciones" };
    const enlace = {
      href: "http://localhost:3000/pedidos?pagina=2",
      target: "",
      hasAttribute: () => false,
    };
    afirmar.equal(
      salida.destinoSalidaPreparacion(evento, enlace, ubicacion),
      "/pedidos?pagina=2",
    );
    for (const cambio of [
      { href: ubicacion.href + "#productos" },
      { href: "https://otra-web.example/pedidos" },
      { target: "_blank" },
      { hasAttribute: () => true },
    ])
      afirmar.equal(
        salida.destinoSalidaPreparacion(
          evento,
          { ...enlace, ...cambio },
          ubicacion,
        ),
        null,
      );
    for (const cambio of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
      { defaultPrevented: true },
    ])
      afirmar.equal(
        salida.destinoSalidaPreparacion(
          { ...evento, ...cambio },
          enlace,
          ubicacion,
        ),
        null,
      );
  },
);

prueba(
  "quitar el último aporte retira el lote vacío y conserva los lotes con separación de calidad",
  () => {
    for (const merma of ["0", "0.5", "incompleto"]) {
      const inicial = borrador();
      inicial.lineas[0].merma = merma;
      const sesion = crearSesion({ inicial });
      sesion.abrir();
      const reparto = sesion.buscar("RepartoProductoPreparacion").props;
      reparto.alCambiar({
        ...reparto.documento.asignaciones["10"],
        aportes: {},
      });
      sesion.renderizar();
      const documento = sesion.buscar("RepartoProductoPreparacion").props
        .documento;
      afirmar.equal(documento.lineas.length, merma === "0" ? 0 : 1);
    }
  },
);

prueba(
  "la vista amplia oculta la lista y al volver conserva los filtros y lo anotado",
  () => {
    const sesion = crearSesion();
    const modelo = sesion.buscar("ListaProductosPreparacion").props.modelo;
    sesion.abrir();
    sesion.modificar();
    afirmar.equal(
      sesion.buscar("VistaAnimadaPreparacion").props.visible,
      false,
    );
    afirmar.equal(sesion.buscar("form").props.hidden, true);
    afirmar.ok(sesion.buscar("VistaProductoPreparacion"));
    sesion.buscar("CabeceraProductoPreparacion").props.alVolver();
    sesion.renderizar();
    afirmar.equal(sesion.enProducto(), false);
    afirmar.equal(sesion.buscar("form").props.hidden, false);
    afirmar.equal(
      sesion.buscar("ListaProductosPreparacion").props.modelo,
      modelo,
    );
    afirmar.equal(
      sesion.buscar("ListaProductosPreparacion").props.documento.asignaciones[
        "10"
      ].cantidad,
      "2",
    );
  },
);

prueba(
  "los formularios son independientes y guardar el producto genera una sola petición",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    sesion.modificar();
    let detenido = 0;
    const formularioPanel = sesion.buscar("VistaProductoPreparacion").props
      .children;
    const formularios = sesion.todos().filter((nodo) => nodo.type === "form");
    afirmar.equal(formularios.length, 2);
    for (const formulario of formularios)
      afirmar.equal(
        sesion
          .todos(formulario.props.children)
          .some((nodo) => nodo.type === "form"),
        false,
      );
    formularioPanel.props.onSubmit({
      preventDefault() {},
      stopPropagation() {
        detenido += 1;
      },
    });
    sesion.renderizar();
    afirmar.equal(detenido, 1);
    afirmar.equal(sesion.peticiones.length, 1);
    afirmar.equal(sesion.enProducto(), true);
    await sesion.resolver();
    afirmar.equal(sesion.enProducto(), false);
  },
);

prueba(
  "guardar un producto conserva sus cajillas y su destino al volver a la lista",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    const reparto = sesion.buscar("RepartoProductoPreparacion").props;
    reparto.alCambiarDocumento({
      ...reparto.documento,
      cajillas: [
        {
          clave: "nueva",
          producto: { id: 1, nombre: "Banana" },
          sucursal: { id: 5, nombre: "Satélite" },
          color: { id: 2, nombre: "Rojo" },
          cantidad: "2",
        },
      ],
    });
    sesion.renderizar();
    sesion.enviar();
    const carga = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(carga.cajillas[0].producto, 1);
    afirmar.equal(carga.cajillas[0].cantidad, 2);
    const guardada = borrador(1, "v2");
    guardada.cajillas = [
      {
        id: 30,
        producto: 1,
        producto_nombre: "Banana",
        sucursal: 5,
        sucursal_nombre: "Satélite",
        cajilla: 2,
        color: "Rojo",
        cantidad: 2,
      },
    ];
    await sesion.resolver(guardada);
    afirmar.equal(sesion.enProducto(), false);
    afirmar.equal(
      sesion.buscar("ResumenCajillasPreparacion").props.documento.cajillas[0]
        .producto.id,
      1,
    );
  },
);

prueba(
  "una cantidad inválida de cajillas lleva al producto y su reparto sin perder lo anotado",
  () => {
    const inicial = borrador();
    inicial.cajillas = [
      {
        id: 30,
        producto: 1,
        producto_nombre: "Banana",
        sucursal: inicial.asignaciones[0].sucursal,
        sucursal_nombre: inicial.asignaciones[0].sucursal_nombre,
        cajilla: 2,
        color: "Rojo",
        cantidad: 2,
      },
    ];
    const sesion = crearSesion({ inicial });
    const resumen = sesion.buscar("ResumenCajillasPreparacion").props;
    resumen.alCambiar({
      ...resumen.documento,
      cajillas: resumen.documento.cajillas.map((fila) => ({
        ...fila,
        cantidad: "1.5",
      })),
    });
    sesion.renderizar();
    sesion.enviar();
    afirmar.equal(sesion.peticiones.length, 0);
    afirmar.equal(sesion.enProducto(), true);
    const reparto = sesion.buscar("RepartoProductoPreparacion").props;
    afirmar.equal(reparto.mostrarAnotadas, true);
    afirmar.equal(reparto.documento.cajillas[0].cantidad, "1.5");
    afirmar.ok(reparto.errores.cajillas_0_cantidad.length);
  },
);

function borrador(cantidad = 1, version = "v1") {
  return {
    id: 3,
    codigo: "PREP-000003",
    cliente: 1,
    cliente_nombre: "Hipermaxi",
    fecha_pedidos: "2026-10-31",
    almacen: 1,
    almacen_nombre: "Almacen Central",
    estado: "borrador",
    version,
    observaciones: "",
    cajillas: [],
    lineas: [
      {
        id: 5,
        lote: 7,
        lote_codigo: "L291026-01",
        producto: 1,
        producto_nombre: "Banana",
        unidad: 1,
        unidad_nombre: "Kilogramo",
        unidad_abreviatura: "kg",
        es_kg: true,
        cantidad_utilizada: "2.000",
        merma: "0",
        aprovechable: "0",
        motivo_separacion: "",
      },
    ],
    asignaciones: [
      {
        id: 8,
        pedido: 2,
        codigo: "PED-000002",
        detalle_pedido: 10,
        sucursal: 1,
        sucursal_nombre: "Satelite",
        producto: 1,
        producto_nombre: "Banana",
        presentacion_nombre: "Caja",
        columna: "cajas",
        cantidad_solicitada: 3,
        pendiente_actual: 3,
        disponible: true,
        cantidad,
        aportes: [{ lote: 7, cantidad: "2.000", peso_kg: null }],
      },
    ],
  };
}

prueba(
  "confirmar desde la hoja agrupada devuelve el resultado al listado sin abrir otro detalle",
  () => {
    let confirmaciones = 0;
    const sesion = crearSesion({ alConfirmada: () => confirmaciones++ });
    sesion.buscar("BarraTrabajoPreparacion").props.alRevisar();
    sesion.renderizar();
    sesion
      .buscar("ConfirmarPreparacion")
      .props.alGuardar({ ...borrador(), estado: "confirmada" });
    afirmar.equal(confirmaciones, 1);
    afirmar.equal(sesion.rutas.length, 0);
  },
);

prueba(
  "salir de una hoja agrupada guardada vuelve al listado mediante su callback",
  () => {
    let salidas = 0;
    const sesion = crearSesion({ alVolverListado: () => salidas++ });
    sesion.buscar("BarraTrabajoPreparacion").props.alSalir();
    afirmar.equal(salidas, 1);
    afirmar.equal(sesion.rutas.length, 0);
  },
);

function crearSesion({
  inicial = borrador(),
  integrado = true,
  puedeEditar = true,
  puedeConfirmar = true,
  alConfirmada,
  alVolverListado,
} = {}) {
  const almacenHooks = [];
  let cursor = 0;
  let arbol;
  const peticiones = [];
  const rutas = [];
  const errores = [];
  const cuadros = [];
  const desplazamientos = [];
  const enfoques = [];
  const control = {
    focus: () => enfoques.push("control"),
    scrollIntoView: () => {},
  };
  const formulario = { querySelector: () => control };
  const ventana = {
    scrollY: 620,
    scrollTo: (opciones) => desplazamientos.push(opciones.top),
    requestAnimationFrame: (funcion) => cuadros.push(funcion),
  };
  const react = {
    useState: (inicial) => {
      const indice = cursor++;
      if (!(indice in almacenHooks))
        almacenHooks[indice] =
          typeof inicial === "function" ? inicial() : inicial;
      return [
        almacenHooks[indice],
        (valor) => {
          almacenHooks[indice] =
            typeof valor === "function" ? valor(almacenHooks[indice]) : valor;
        },
      ];
    },
    useRef: (inicial) => {
      const indice = cursor++;
      return (almacenHooks[indice] ||= { current: inicial });
    },
    useEffect: () => {},
    useCallback: (funcion) => funcion,
  };
  const modal = () => {
    const [isOpen, establecer] = react.useState(false);
    return {
      isOpen,
      openModal: () => establecer(true),
      closeModal: () => establecer(false),
    };
  };
  const modelo = {
    pagina: 4,
    buscar: "ban",
    vista: "pendientes",
    filas: [producto],
    cancelarNavegacion: () => {},
    navegando: false,
  };
  class ErrorApiPrueba extends Error {
    constructor(estado, problemas = {}) {
      super("Fallo de prueba");
      this.status = estado;
      this.errors = problemas;
    }
  }
  const componente = cargar(
    "FormularioPreparacion.tsx",
    {
      react,
      "react/jsx-runtime": {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      "next-intl": { useTranslations: () => traducir },
      "@/i18n/navigation": {
        useRouter: () => ({
          push: (ruta) => rutas.push(ruta),
          replace: (ruta) => rutas.push(ruta),
          refresh: () => {},
        }),
      },
      "@/lib/api": {
        ApiError: ErrorApiPrueba,
        api: (ruta, opciones) =>
          new Promise((resolver, rechazar) =>
            peticiones.push({ ruta, opciones, resolver, rechazar }),
          ),
      },
      "@/lib/form-validation": {
        focusInvalidField: () => enfoques.push("invalido"),
      },
      "@/hooks/useFormValidation": {
        useFormValidation: () => {
          const [errors, setErrors] = react.useState({});
          return {
            errors,
            setErrors,
            validateForm: (_, problemas) => {
              setErrors(problemas);
              return !Object.keys(problemas).length;
            },
          };
        },
      },
      "@/hooks/useModal": { useModal: modal },
      "@/components/compras/tipos": { clasePanel: "panel" },
      "./calculos": calculos,
      "./validaciones": validaciones,
      "./salidaTrabajoPreparacion": salida,
      "./useProductosTrabajoPreparacion": { default: () => modelo },
    },
    {
      crypto: { randomUUID: () => "clave-prueba" },
      requestAnimationFrame: ventana.requestAnimationFrame,
      window: ventana,
      document: {
        getElementById: () => ({ ...control, querySelector: () => control }),
      },
      sessionStorage: { setItem: () => {} },
    },
  ).default;
  function renderizar() {
    cursor = 0;
    arbol = componente({
      preparacion: inicial || undefined,
      cliente: { id: 1, nombre: "Hipermaxi" },
      fecha: "2026-10-31",
      integrado,
      puedeEditar,
      puedeConfirmar,
      alError: (error) => errores.push(error),
      alRecargar: () => {},
      alConfirmada,
      alVolverListado,
    });
    for (const nodo of todos(arbol))
      if (nodo.type === "form") nodo.props.ref.current = formulario;
    while (cuadros.length) cuadros.shift()();
    return arbol;
  }
  function todos(nodo) {
    if (!arguments.length) nodo = arbol;
    if (!nodo || typeof nodo !== "object") return [];
    if (Array.isArray(nodo)) return nodo.flatMap((hijo) => todos(hijo));
    return [nodo, ...todos(nodo.props?.children)];
  }
  const buscar = (tipo) => todos().find((nodo) => nodo.type === tipo);
  const abrir = () => {
    buscar("ListaProductosPreparacion").props.alElegir(producto);
    renderizar();
  };
  const modificar = () => {
    const reparto = buscar("RepartoProductoPreparacion");
    const asignacion =
      reparto.props.documento.asignaciones["10"] ||
      calculos.desdePreparacion(borrador()).asignaciones["10"];
    reparto.props.alCambiar({ ...asignacion, cantidad: "2" });
    renderizar();
  };
  const enviar = () => {
    todos()
      .find((nodo) => nodo.type === "form" && !nodo.props.hidden)
      .props.onSubmit({ preventDefault: () => {}, stopPropagation: () => {} });
    renderizar();
  };
  renderizar();
  return {
    buscar,
    todos,
    abrir,
    modificar,
    enviar,
    renderizar,
    peticiones,
    rutas,
    errores,
    desplazamientos,
    enfoques,
    ventana,
    modelo,
    ErrorApiPrueba,
    enProducto: () => !!buscar("VistaProductoPreparacion"),
    resolver: async (datos = borrador(2, "v2")) => {
      peticiones.at(-1).resolver(datos);
      await esperar(0);
      renderizar();
    },
    rechazar: async (error) => {
      peticiones.at(-1).rechazar(error);
      await esperar(0);
      renderizar();
    },
  };
}

prueba(
  "guardar y volver espera la respuesta, conserva filtros y posicion y usa la nueva version",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    sesion.modificar();
    sesion.enviar();
    afirmar.equal(sesion.enProducto(), true);
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.guardando,
      true,
    );
    afirmar.equal(sesion.peticiones.length, 1);
    const carga = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(sesion.peticiones[0].opciones.method, "PATCH");
    afirmar.equal(carga.version, "v1");
    afirmar.equal(carga.asignaciones[0].cantidad, 2);
    afirmar.equal(carga.asignaciones[0].aportes[0].cantidad, "2");
    await sesion.resolver();
    afirmar.equal(sesion.enProducto(), false);
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.situacion,
      "guardado",
    );
    afirmar.equal(
      sesion.buscar("ListaProductosPreparacion").props.modelo,
      sesion.modelo,
    );
    afirmar.equal(sesion.modelo.pagina, 4);
    afirmar.equal(sesion.modelo.buscar, "ban");
    afirmar.equal(sesion.desplazamientos.at(-1), 620);
    afirmar.equal(sesion.rutas.length, 0);
    // El siguiente guardado utiliza la versión devuelta por el servidor.
    sesion.abrir();
    const reparto = sesion.buscar("RepartoProductoPreparacion").props;
    reparto.alCambiar({
      ...reparto.documento.asignaciones["10"],
      cantidad: "3",
    });
    sesion.renderizar();
    sesion.enviar();
    afirmar.equal(JSON.parse(sesion.peticiones[1].opciones.body).version, "v2");
    await sesion.resolver(borrador(3, "v3"));
  },
);

prueba(
  "la hoja no captura notas y conserva el texto histórico al guardar",
  () => {
    const inicial = borrador();
    inicial.observaciones = "  Nota histórica de esta preparación.  ";
    const sesion = crearSesion({ inicial });
    afirmar.equal(
      "alObservaciones" in sesion.buscar("CabeceraTrabajoPreparacion").props,
      false,
    );
    sesion.abrir();
    sesion.modificar();
    sesion.enviar();
    const carga = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(carga.observaciones, inicial.observaciones);
  },
);

prueba(
  "un conflicto conserva el producto, los datos y el estado general de conflicto",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    sesion.modificar();
    sesion.enviar();
    await sesion.rechazar(new sesion.ErrorApiPrueba(409));
    afirmar.equal(sesion.enProducto(), true);
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.conflicto,
      true,
    );
    afirmar.equal(
      sesion.buscar("RepartoProductoPreparacion").props.documento.asignaciones[
        "10"
      ].cantidad,
      "2",
    );
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.situacion,
      "conflicto",
    );
    afirmar.equal(sesion.rutas.length, 0);
  },
);

prueba(
  "un borrador sin cambios vuelve a la lista sin otra peticion ni salida de la hoja",
  () => {
    const sesion = crearSesion({ integrado: false });
    sesion.abrir();
    sesion.enviar();
    afirmar.equal(sesion.enProducto(), false);
    afirmar.equal(sesion.peticiones.length, 0);
    afirmar.equal(sesion.rutas.length, 0);
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.situacion,
      "guardado",
    );
  },
);

prueba(
  "crear guarda una sola vez y despues respeta el permiso independiente de editar",
  async () => {
    const sesion = crearSesion({ inicial: null, puedeEditar: false });
    sesion
      .buscar("CabeceraTrabajoPreparacion")
      .props.alAlmacen({ id: 1, nombre: "Almacen Central" });
    sesion.renderizar();
    sesion.abrir();
    sesion.modificar();
    sesion.enviar();
    sesion.enviar();
    afirmar.equal(sesion.peticiones.length, 1);
    afirmar.equal(sesion.peticiones[0].opciones.method, "POST");
    const carga = JSON.parse(sesion.peticiones[0].opciones.body);
    afirmar.equal(carga.clave_operacion, "clave-prueba");
    afirmar.equal(carga.version, undefined);
    await sesion.resolver({
      ...borrador(2, "v2"),
      lineas: [],
      asignaciones: [{ ...borrador(2).asignaciones[0], aportes: [] }],
    });
    afirmar.equal(sesion.enProducto(), false);
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.puedeGuardar,
      false,
    );
  },
);

prueba(
  "un almacen sin elegir lleva al contexto visible y nunca muestra un guardado exitoso",
  () => {
    const sesion = crearSesion({ inicial: null });
    sesion.abrir();
    sesion.modificar();
    sesion.enviar();
    afirmar.equal(sesion.peticiones.length, 0);
    afirmar.equal(sesion.enProducto(), false);
    const contexto = sesion.buscar("CabeceraTrabajoPreparacion");
    afirmar.ok(
      sesion
        .todos()
        .some(
          (nodo) =>
            nodo.type === "div" &&
            nodo.props.hidden !== true &&
            nodo.props.children === contexto,
        ),
    );
    afirmar.equal(
      sesion.buscar("BarraTrabajoPreparacion").props.situacion,
      "modificado",
    );
  },
);

prueba(
  "revisar desde la lista guarda primero y abre revision con la version recibida",
  async () => {
    const sesion = crearSesion();
    sesion.abrir();
    sesion.modificar();
    sesion.buscar("CabeceraProductoPreparacion").props.alVolver();
    sesion.renderizar();
    sesion.buscar("BarraTrabajoPreparacion").props.alRevisar();
    sesion.renderizar();
    afirmar.equal(sesion.buscar("ConfirmarPreparacion"), undefined);
    await sesion.resolver();
    afirmar.equal(
      sesion.buscar("ConfirmarPreparacion").props.preparacion.version,
      "v2",
    );
    afirmar.equal(sesion.peticiones.length, 1);
    afirmar.ok(
      sesion.peticiones.every(
        (peticion) => !peticion.ruta.includes("confirmar"),
      ),
    );
  },
);

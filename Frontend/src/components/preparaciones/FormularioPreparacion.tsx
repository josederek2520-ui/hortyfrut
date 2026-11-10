"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Container as IconoCajillas,
  ChevronDown as IconoDesplegar,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import {
  focusInvalidField as enfocarCampoInvalido,
  type FieldErrors as Errores,
} from "@/lib/form-validation";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import {
  clasePanel,
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import CabeceraTrabajoPreparacion from "./CabeceraTrabajoPreparacion";
import ListaProductosPreparacion from "./ListaProductosPreparacion";
import CabeceraProductoPreparacion from "./CabeceraProductoPreparacion";
import useProductosTrabajoPreparacion from "./useProductosTrabajoPreparacion";
import LotesProductoPreparacion from "./LotesProductoPreparacion";
import RepartoProductoPreparacion from "./RepartoProductoPreparacion";
import ResumenCajillasPreparacion from "./ResumenCajillasPreparacion";
import BarraTrabajoPreparacion from "./BarraTrabajoPreparacion";
import DialogoTrabajoPreparacion from "./DialogoTrabajoPreparacion";
import ConfirmarPreparacion from "./ConfirmarPreparacion";
import VistaAnimadaPreparacion from "./VistaAnimadaPreparacion";
import VistaProductoPreparacion from "./VistaProductoPreparacion";
import estilos from "./estilosTrabajo.module.css";
import { destinoSalidaPreparacion } from "./salidaTrabajoPreparacion";
import {
  desdePreparacion,
  serializarDocumento,
  productosDelDocumento,
  quitarLoteDocumento,
  asignadoLote,
  aMiles,
} from "./calculos";
import {
  validarDocumento,
  validarConfirmacionPreparacion,
} from "./validaciones";
import type {
  AsignacionEditable,
  DocumentoEditable,
  LotePreparacion,
  OpcionPreparacion,
  Preparacion,
  ProductoPreparacion,
  EstadoTrabajoPreparacion,
} from "./tipos";

export default function FormularioPreparacion({
  preparacion,
  cliente,
  fecha,
  puedeConfirmar,
  puedeEditar,
  alError,
  alRecargar,
  integrado = false,
  controlesJornada,
  resumenJornada,
  productoInicial,
  alEstadoTrabajo,
  alConfirmada,
  alVolverListado,
}: {
  preparacion?: Preparacion;
  cliente: OpcionPreparacion;
  fecha: string;
  puedeConfirmar: boolean;
  puedeEditar: boolean;
  alError: (error: unknown) => void;
  alRecargar: () => void;
  integrado?: boolean;
  controlesJornada?: ReactNode;
  resumenJornada?: ReactNode;
  productoInicial?: ProductoPreparacion | null;
  alEstadoTrabajo?: (estado: EstadoTrabajoPreparacion) => void;
  alConfirmada?: () => void;
  alVolverListado?: () => void;
}) {
  const t = useTranslations("preparaciones");
  const navegador = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const formularioProducto = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);
  const posicionLista = useRef<number | null>(null);
  const [actual, establecerActual] = useState(preparacion);
  const [documento, establecerDocumento] = useState<DocumentoEditable>(() =>
    desdePreparacion(preparacion),
  );
  const [almacen, establecerAlmacen] = useState<OpcionCompra | null>(
    preparacion
      ? { id: preparacion.almacen, nombre: preparacion.almacen_nombre }
      : null,
  );
  const [almacenInicial, establecerAlmacenInicial] = useState<number | null>(
    preparacion?.almacen || null,
  );
  const observaciones = actual?.observaciones || "";
  const [producto, establecerProducto] = useState<ProductoPreparacion | null>(
    () =>
      productosDelDocumento(desdePreparacion(preparacion))[0] ||
      productoInicial ||
      null,
  );
  const [vistaTrabajo, establecerVistaTrabajo] = useState<
    "productos" | "producto"
  >("productos");
  const [cajillasAbiertas, establecerCajillasAbiertas] = useState(false);
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [foco, establecerFoco] = useState({
    seccion: "",
    pagina: 1,
    revision: 0,
  });
  const [dialogo, establecerDialogo] = useState<
    "volver" | "recargar" | "almacen" | "lote"
  >("volver");
  const [almacenPropuesto, establecerAlmacenPropuesto] =
    useState<OpcionCompra | null>(null);
  const [lotePropuesto, establecerLotePropuesto] = useState<number | null>(
    null,
  );
  const modalCambios = useModal();
  const modalRevision = useModal();
  const abrirModalCambios = modalCambios.openModal;
  const [rutaSalida, establecerRutaSalida] = useState<string | null>(null);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validar,
  } = useValidacionFormulario();
  const contexto = new URLSearchParams({
    cliente: String(cliente.id),
    fecha_pedidos: fecha,
  }).toString();
  const puedeModificar = !actual || puedeEditar;
  const ocupado = guardando || conflicto || !puedeModificar;
  const modificado =
    JSON.stringify({
      documento: serializarDocumento(documento),
      almacen: almacen?.id || null,
    }) !==
    JSON.stringify({
      documento: serializarDocumento(desdePreparacion(actual)),
      almacen: actual?.almacen || almacenInicial,
    });
  useEffect(() => {
    alEstadoTrabajo?.({ modificado, guardando });
  }, [alEstadoTrabajo, modificado, guardando]);
  useEffect(() => {
    if (preparacion) return;
    const controlador = new AbortController();
    void api<PaginaCompra<OpcionCompra>>("preparaciones/almacenes/", {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted && datos.count === 1) {
          establecerAlmacenInicial(datos.results[0].id);
          establecerAlmacen((elegido) => elegido || datos.results[0]);
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) alError(error);
      });
    return () => controlador.abort();
  }, [preparacion, alError]);
  useEffect(() => {
    if (!modificado && !guardando) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    const protegerEnlace = (evento: MouseEvent) => {
      const enlace =
        evento.target instanceof Element
          ? evento.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      const destino = destinoSalidaPreparacion(evento, enlace, window.location);
      if (!destino) return;
      evento.preventDefault();
      evento.stopPropagation();
      if (guardando) return;
      establecerRutaSalida(destino);
      establecerDialogo("volver");
      abrirModalCambios();
    };
    window.addEventListener("beforeunload", avisar);
    document.addEventListener("click", protegerEnlace, true);
    return () => {
      window.removeEventListener("beforeunload", avisar);
      document.removeEventListener("click", protegerEnlace, true);
    };
  }, [modificado, guardando, abrirModalCambios]);
  const cambiar = (nuevo: DocumentoEditable) => {
    if (ocupado) return;
    if (
      nuevo.lineas.length > 500 ||
      Object.keys(nuevo.asignaciones).length > 500 ||
      nuevo.cajillas.length > 500
    ) {
      establecerFallo(t("limiteFilasTrabajo"));
      return;
    }
    establecerDocumento(nuevo);
    establecerErrores({});
  };
  const elegirProducto = useCallback((elegido: ProductoPreparacion) => {
    establecerProducto(elegido);
    establecerVistaTrabajo("producto");
    establecerFoco((anterior) => ({
      seccion: "",
      pagina: 1,
      revision: anterior.revision + 1,
    }));
    requestAnimationFrame(() => {
      const titulo = document.getElementById("nombre-producto-preparacion");
      document
        .getElementById("vista-producto-preparacion")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
      titulo?.focus({ preventScroll: true });
      const contenido = document.getElementById("ficha-producto-preparacion");
      if (contenido) contenido.scrollTop = 0;
    });
  }, []);
  const productosTrabajo = useProductosTrabajoPreparacion(
    contexto,
    documento,
    producto,
    elegirProducto,
    alError,
  );
  const abrirDesdeLista = (elegido: ProductoPreparacion) => {
    posicionLista.current = window.scrollY;
    elegirProducto(elegido);
  };
  const volverProductos = () => {
    productosTrabajo.cancelarNavegacion();
    establecerVistaTrabajo("productos");
    requestAnimationFrame(() => {
      const control =
        formulario.current?.querySelector<HTMLElement>(
          `[data-producto-preparacion="${producto?.id}"]`,
        ) || document.getElementById("productos-por-preparar");
      control?.focus({ preventScroll: true });
      if (posicionLista.current !== null)
        window.scrollTo({ top: posicionLista.current, behavior: "instant" });
      else control?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  };
  const volverAlContexto = () => {
    productosTrabajo.cancelarNavegacion();
    establecerVistaTrabajo("productos");
    requestAnimationFrame(() => {
      const contexto = formulario.current?.querySelector<HTMLDetailsElement>(
        "[data-contexto-preparacion]",
      );
      if (contexto) contexto.open = true;
      const control = formulario.current?.querySelector<HTMLElement>(
        'button[name="almacen"]',
      );
      control?.focus({ preventScroll: true });
      control?.scrollIntoView({ block: "center", behavior: "instant" });
    });
  };
  const agregarLote = (lote: LotePreparacion) => {
    const existente = documento.lineas.find(
      (linea) => linea.lote.id === lote.id,
    );
    cambiar({
      ...documento,
      lineas: existente
        ? documento.lineas.map((linea) =>
            linea === existente
              ? { ...linea, lote: { ...linea.lote, ...lote } }
              : linea,
          )
        : [
            ...documento.lineas,
            { lote, merma: "", aprovechable: "", motivo: "" },
          ],
    });
  };
  const cambiarAsignacion = (asignacion: AsignacionEditable) => {
    const asignaciones = { ...documento.asignaciones };
    const retirados = Object.keys(asignaciones[asignacion.clave]?.aportes || {})
      .map(Number)
      .filter((lote) => !(lote in asignacion.aportes));
    if (!asignacion.cantidad.trim() && !Object.keys(asignacion.aportes).length)
      delete asignaciones[asignacion.clave];
    else asignaciones[asignacion.clave] = asignacion;
    const lineas = documento.lineas.filter(
      (linea) =>
        !retirados.includes(linea.lote.id) ||
        Object.values(asignaciones).some(
          (fila) => linea.lote.id in fila.aportes,
        ) ||
        [linea.merma, linea.aprovechable].some(
          (valor) => valor.trim() && !/^0+(?:\.0{1,3})?$/.test(valor),
        ) ||
        !!linea.motivo.trim(),
    );
    cambiar({ ...documento, lineas, asignaciones });
  };
  const elegirLoteSucursal = (
    asignacion: AsignacionEditable,
    lote: LotePreparacion,
  ) => {
    const nuevoLote = {
      ...lote,
      producto_imagen: producto?.imagen,
      producto_categoria: producto?.categoria || undefined,
    };
    const existente = documento.lineas.find(
      (linea) => linea.lote.id === lote.id,
    );
    cambiar({
      ...documento,
      lineas: existente
        ? documento.lineas.map((linea) =>
            linea === existente
              ? { ...linea, lote: { ...linea.lote, ...nuevoLote } }
              : linea,
          )
        : [
            ...documento.lineas,
            { lote: nuevoLote, merma: "", aprovechable: "", motivo: "" },
          ],
      asignaciones: {
        ...documento.asignaciones,
        [asignacion.clave]: {
          ...asignacion,
          imagen: producto?.imagen,
          categoria: producto?.categoria || undefined,
          aportes: {
            ...asignacion.aportes,
            [lote.id]: asignacion.aportes[lote.id] || {
              cantidad: "",
              pesoKg: "",
            },
          },
        },
      },
    });
  };
  const abrirDialogo = (tipo: "volver" | "recargar" | "almacen" | "lote") => {
    establecerRutaSalida(null);
    establecerDialogo(tipo);
    modalCambios.openModal();
  };
  const quitarLote = (lote: number) => {
    const linea = documento.lineas.find((fila) => fila.lote.id === lote);
    if (
      asignadoLote(documento, lote) > BigInt(0) ||
      (linea &&
        (aMiles(linea.merma) > BigInt(0) ||
          aMiles(linea.aprovechable) > BigInt(0)))
    ) {
      establecerLotePropuesto(lote);
      abrirDialogo("lote");
    } else cambiar(quitarLoteDocumento(documento, lote));
  };
  const proponerAlmacen = (elegido: OpcionCompra | null) => {
    if (ocupado || elegido?.id === almacen?.id) return;
    if (
      documento.lineas.length ||
      Object.keys(documento.asignaciones).length ||
      documento.cajillas.length
    ) {
      establecerAlmacenPropuesto(elegido);
      abrirDialogo("almacen");
    } else establecerAlmacen(elegido);
  };
  const enfocar = (problemas: Errores) => {
    const nombre =
      Object.keys(problemas).find((clave) => problemas[clave]?.length) || "";
    const referencia = /^(lineas|asignaciones|cajillas)_(\d+)_/.exec(nombre);
    const seccion = referencia?.[1] || "";
    const indice = Number(referencia?.[2] || 0);
    let pagina = 1;
    let productoError: number | undefined;
    if (seccion === "lineas") {
      const linea = documento.lineas[indice];
      productoError = linea?.lote.producto;
      pagina =
        Math.floor(
          documento.lineas
            .filter((fila) => fila.lote.producto === productoError)
            .indexOf(linea) / 10,
        ) + 1;
    } else if (seccion === "asignaciones") {
      const asignaciones = Object.values(documento.asignaciones);
      const asignacion = asignaciones[indice];
      productoError = asignacion?.producto;
      pagina =
        Math.floor(
          asignaciones
            .filter((fila) => fila.producto === productoError)
            .indexOf(asignacion) / 10,
        ) + 1;
    } else if (seccion === "cajillas") {
      const cajilla = documento.cajillas[indice];
      productoError = cajilla?.producto?.id;
      const delProducto = Object.values(documento.asignaciones).filter(
        (fila) => fila.producto === productoError,
      );
      const posicion = delProducto.findIndex(
        (fila) => fila.sucursal === cajilla?.sucursal.id,
      );
      if (productoError && posicion >= 0)
        pagina = Math.floor(posicion / 10) + 1;
      else {
        productoError = undefined;
        establecerVistaTrabajo("productos");
        establecerCajillasAbiertas(true);
        pagina = Math.floor(indice / 10) + 1;
      }
    }
    if (productoError) {
      if (vistaTrabajo === "productos") posicionLista.current = window.scrollY;
      establecerProducto(
        productosDelDocumento(documento).find(
          (fila) => fila.id === productoError,
        ) || null,
      );
      establecerVistaTrabajo("producto");
    }
    if (
      ["almacen", "observaciones", "cliente", "fecha_pedidos"].includes(nombre)
    )
      establecerVistaTrabajo("productos");
    establecerFoco((anterior) => ({
      seccion:
        seccion === "cajillas" && productoError ? "asignaciones" : seccion,
      pagina: Math.max(1, pagina),
      revision: anterior.revision + 1,
    }));
    requestAnimationFrame(() => {
      const destino = formularioProducto.current || formulario.current;
      if (destino) enfocarCampoInvalido(destino);
    });
    if (!referencia && nombre !== "almacen")
      window.requestAnimationFrame(() =>
        (formularioProducto.current || formulario.current)
          ?.querySelector<HTMLElement>("[data-alerta-preparacion]")
          ?.focus(),
      );
  };
  const aplicarGuardada = (guardada: Preparacion) => {
    const nuevo = desdePreparacion(guardada);
    establecerActual(guardada);
    establecerDocumento(nuevo);
    establecerAlmacen({
      id: guardada.almacen,
      nombre: guardada.almacen_nombre,
    });
    establecerProducto((elegido) =>
      elegido
        ? {
            ...elegido,
            ...productosDelDocumento(nuevo).find(
              (fila) => fila.id === elegido.id,
            ),
          }
        : productosDelDocumento(nuevo)[0] || null,
    );
    establecerErrores({});
  };
  const terminar = (
    guardada: Preparacion,
    aviso?: "guardada" | "confirmada",
  ) => {
    aplicarGuardada(guardada);
    if (aviso === "confirmada" && alConfirmada) {
      alConfirmada();
      return;
    }
    try {
      if (aviso) sessionStorage.setItem("preparaciones:aviso", aviso);
    } catch {
      /* El guardado no depende del almacenamiento local. */
    }
    navegador.replace(
      aviso === "confirmada"
        ? "/preparaciones"
        : `/preparaciones/${guardada.id}`,
    );
    navegador.refresh();
  };
  const guardar = async (
    evento?: FormEvent<HTMLFormElement>,
    accion: "borrador" | "productos" | "revision" = "borrador",
  ) => {
    evento?.preventDefault();
    const revisar = accion === "revision";
    if (
      enviando.current ||
      guardando ||
      conflicto ||
      !formulario.current ||
      (revisar && !puedeConfirmar) ||
      (!puedeModificar && modificado)
    )
      return;
    const problemas = validarDocumento(documento, {
      cantidad: t("decimalInvalido"),
      entero: t("enteroInvalido"),
      origen: t("origenAsignacionCambio"),
      motivo: t("motivoObligatorio"),
      superaPendiente: (cantidad) => t("cantidadSuperaPendiente", { cantidad }),
    });
    if (revisar)
      Object.assign(
        problemas,
        validarConfirmacionPreparacion(documento, {
          sinAsignaciones: t("anotaSucursalParaRevisarTrabajo"),
          positiva: t("cantidadPositivaTrabajo"),
          sinMedicion: t("faltanMedicionesTrabajo"),
          peso: t("faltaPesoTrabajo"),
          saldo: t("superaSaldoTrabajo"),
          lote: t("loteNoValidoTrabajo"),
          sinUso: t("loteSinUsoTrabajo"),
          cajillasSinPreparar: t("cajillasProductoSinCantidad"),
        }),
      );
    if (!almacen) problemas.almacen = [t("seleccionarAlmacen")];
    if (!validar(formularioProducto.current || formulario.current, problemas)) {
      establecerFallo(t("revisaDatosTrabajo"));
      enfocar(problemas);
      return;
    }
    establecerFallo("");
    if (actual && !modificado) {
      if (accion === "productos") volverTrasGuardar();
      else if (revisar) modalRevision.openModal();
      else if (!integrado) terminar(actual, "guardada");
      return;
    }
    enviando.current = true;
    establecerGuardando(true);
    try {
      const respuesta = await api<Preparacion>(
        actual ? `preparaciones/${actual.id}/` : "preparaciones/",
        {
          method: actual ? "PATCH" : "POST",
          body: JSON.stringify({
            cliente: cliente.id,
            fecha_pedidos: fecha,
            almacen: almacen!.id,
            observaciones,
            ...(actual
              ? { version: actual.version }
              : { clave_operacion: claveOperacion }),
            ...serializarDocumento(documento),
          }),
        },
      );
      aplicarGuardada(respuesta);
      if (accion === "productos") volverTrasGuardar();
      else if (revisar) modalRevision.openModal();
      else if (!integrado) terminar(respuesta, "guardada");
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocar(error.errors);
      }
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const volverTrasGuardar = () => {
    volverProductos();
  };
  const recargarActual = async () => {
    if (!actual) {
      alRecargar();
      return;
    }
    if (enviando.current) return;
    enviando.current = true;
    establecerGuardando(true);
    try {
      const respuesta = await api<Preparacion>(`preparaciones/${actual.id}/`);
      if (respuesta.estado !== "borrador") {
        terminar(respuesta);
        return;
      }
      aplicarGuardada(respuesta);
      establecerConflicto(false);
      establecerFallo("");
      modalRevision.closeModal();
      modalCambios.closeModal();
    } catch (error) {
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const volver = () => {
    if (integrado && alVolverListado) {
      alVolverListado();
      return;
    }
    navegador.push(
      actual
        ? `/preparaciones/${actual.id}`
        : `/preparaciones?cliente=${cliente.id}&fecha=${fecha}`,
    );
  };
  const salir = (tipo: "volver" | "recargar") => {
    if (guardando) return;
    if (modificado) abrirDialogo(tipo);
    else if (tipo === "recargar") void recargarActual();
    else volver();
  };
  const avisoProblemas = fallo && (
    <div
      role="alert"
      tabIndex={-1}
      data-alerta-preparacion
      className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
    >
      <p>{fallo}</p>
      {Object.entries(errores)
        .filter(
          ([campo, mensajes]) =>
            mensajes.length &&
            !/^(lineas|asignaciones|cajillas)_\d+_/.test(campo) &&
            campo !== "almacen",
        )
        .map(([campo, mensajes]) => (
          <p key={campo} className="mt-1">
            {mensajes.join(" ")}
          </p>
        ))}
      {conflicto && (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => salir("recargar")}
        >
          {t("recargar")}
        </Button>
      )}
    </div>
  );
  const situacionTrabajo = conflicto
    ? "conflicto"
    : guardando
      ? "guardando"
      : modificado
        ? "modificado"
        : actual
          ? "guardado"
          : "vacio";
  const textoEstadoTrabajo = conflicto
    ? t("datosDesactualizadosTrabajo")
    : guardando
      ? t("guardando")
      : modificado
        ? t("cambiosSinGuardar")
        : actual
          ? t("borradorGuardadoBreveTrabajo")
          : t("sinDatosTrabajo");
  const totalCajillas = documento.cajillas.reduce(
    (total, fila) => total + (Number(fila.cantidad) || 0),
    0,
  );
  const barraTrabajo = (
    <BarraTrabajoPreparacion
      compacta={vistaTrabajo === "producto"}
      documento={documento}
      guardando={guardando}
      navegando={productosTrabajo.navegando}
      conflicto={conflicto}
      puedeGuardar={puedeModificar}
      puedeConfirmar={puedeConfirmar}
      producto={vistaTrabajo === "producto" ? producto : null}
      alVolverProductos={volverProductos}
      situacion={situacionTrabajo}
      estado={textoEstadoTrabajo}
      ayudaEstado={
        actual && !puedeModificar ? t("borradorSinEdicionTrabajo") : undefined
      }
      alSalir={() => salir("volver")}
      alRevisar={() => void guardar(undefined, "revision")}
    />
  );
  return (
    <div className={estilos.trabajo}>
      <form
        ref={formulario}
        noValidate
        onSubmit={(evento) => void guardar(evento, "borrador")}
        aria-busy={guardando}
        hidden={vistaTrabajo === "producto"}
        className="space-y-4"
      >
        <header className="space-y-1">
          {!integrado && (
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={() => salir("volver")}
                aria-label={t("volverHoja")}
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <IconoVolver
                  className="size-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </button>
              <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
                <span>
                  {t(actual ? "editarPreparacionCompacto" : "nuevaPreparacion")}
                </span>
                {actual && (
                  <span className="text-sm font-medium tracking-normal text-gray-500 dark:text-gray-400">
                    <span aria-hidden="true" className="me-3">
                      ·
                    </span>
                    {actual.codigo}
                  </span>
                )}
              </h1>
            </div>
          )}
          <div>
            <CabeceraTrabajoPreparacion
              compacta
              codigo={integrado ? actual?.codigo : undefined}
              cliente={cliente.nombre}
              fecha={fecha}
              almacen={almacen}
              ocupado={ocupado}
              errores={errores}
              alAlmacen={proponerAlmacen}
              alError={alError}
              controlesJornada={controlesJornada}
              resumenJornada={resumenJornada}
            />
          </div>
        </header>
        {vistaTrabajo !== "producto" && avisoProblemas}
        <VistaAnimadaPreparacion
          visible={vistaTrabajo === "productos"}
          clave="productos"
        >
          <ListaProductosPreparacion
            modelo={productosTrabajo}
            documento={documento}
            alElegir={abrirDesdeLista}
            ocupado={guardando}
            alError={alError}
          />
        </VistaAnimadaPreparacion>

        <details
          open={cajillasAbiertas}
          onToggle={(evento) =>
            establecerCajillasAbiertas(evento.currentTarget.open)
          }
          className={`${clasePanel} ${estilos.desplegable} group/cajillas px-5 py-2 sm:px-6`}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded text-sm leading-6 font-semibold text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white">
            <IconoCajillas
              className="size-5 shrink-0 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <span>{t("resumenCajillasTitulo")}</span>
            <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-theme-xs font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
              {totalCajillas}
              <span className="sr-only"> {t("cantidadCajillas")}</span>
            </span>
            <IconoDesplegar
              className="ms-auto size-4 shrink-0 text-gray-500 transition-transform group-open/cajillas:rotate-180 motion-reduce:transition-none dark:text-gray-400"
              aria-hidden="true"
            />
          </summary>
          <div
            className={`${estilos.contenidoOpcional} border-t border-gray-100 pt-4 pb-3 dark:border-gray-800`}
          >
            <ResumenCajillasPreparacion
              key={`cajillas-${foco.seccion === "cajillas" ? foco.revision : 0}`}
              documento={documento}
              ocupado={ocupado}
              errores={errores}
              alCambiar={cambiar}
              paginaInicial={foco.seccion === "cajillas" ? foco.pagina : 1}
              alAbrirProducto={(elegido) =>
                abrirDesdeLista(
                  productosDelDocumento(documento).find(
                    (fila) => fila.id === elegido.id,
                  ) || elegido,
                )
              }
            />
          </div>
        </details>
        {vistaTrabajo === "productos" && barraTrabajo}
      </form>
      {vistaTrabajo === "producto" && (
        <VistaProductoPreparacion>
          <form
            ref={formularioProducto}
            noValidate
            aria-busy={guardando}
            className={estilos.trabajo + " flex h-full min-h-0 flex-col"}
            onSubmit={(evento) => {
              evento.stopPropagation();
              void guardar(evento, "productos");
            }}
          >
            {producto && (
              <CabeceraProductoPreparacion
                producto={producto}
                modelo={productosTrabajo}
                ocupado={guardando}
                alVolver={volverProductos}
                cliente={cliente.nombre}
                fecha={fecha}
                almacen={almacen}
                alElegirAlmacen={volverAlContexto}
              />
            )}
            <div
              id="ficha-producto-preparacion"
              className={`${estilos.fondoTrabajoProducto} custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain`}
            >
              {avisoProblemas}
              {producto && (
                <section
                  className="min-w-0"
                  aria-labelledby="nombre-producto-preparacion"
                >
                  <RepartoProductoPreparacion
                    key={`reparto-${producto.id}-${foco.seccion === "asignaciones" ? foco.revision : 0}`}
                    producto={producto}
                    documento={documento}
                    contexto={contexto}
                    almacen={almacen?.id}
                    ocupado={ocupado || productosTrabajo.navegando}
                    errores={errores}
                    paginaInicial={
                      foco.seccion === "asignaciones" ? foco.pagina : 1
                    }
                    mostrarAnotadas={foco.seccion === "asignaciones"}
                    alError={alError}
                    alCambiar={cambiarAsignacion}
                    alCambiarDocumento={cambiar}
                    alElegirLote={elegirLoteSucursal}
                    alQuitar={(clave) => {
                      const asignaciones = { ...documento.asignaciones };
                      delete asignaciones[clave];
                      cambiar({ ...documento, asignaciones });
                    }}
                  />
                  <details
                    open={foco.seccion === "lineas" ? true : undefined}
                    className={`${estilos.desplegable} border-t border-gray-100 dark:border-gray-800`}
                  >
                    <summary className="min-h-11 cursor-pointer rounded px-5 py-4 text-sm font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200">
                      {t("calidadLotesProductoTrabajo")}
                    </summary>
                    <div className={estilos.contenidoOpcional}>
                      <LotesProductoPreparacion
                        key={`lotes-${producto.id}-${foco.seccion === "lineas" ? foco.revision : 0}`}
                        producto={producto}
                        documento={documento}
                        contexto={contexto}
                        almacen={almacen?.id}
                        ocupado={ocupado || productosTrabajo.navegando}
                        errores={errores}
                        paginaInicial={
                          foco.seccion === "lineas" ? foco.pagina : 1
                        }
                        alError={alError}
                        alAgregar={agregarLote}
                        alCambiar={(indice, cambio) =>
                          cambiar({
                            ...documento,
                            lineas: documento.lineas.map((linea, posicion) =>
                              posicion === indice
                                ? { ...linea, ...cambio }
                                : linea,
                            ),
                          })
                        }
                        alQuitar={quitarLote}
                      />
                    </div>
                  </details>
                </section>
              )}
            </div>
            {barraTrabajo}
          </form>
        </VistaProductoPreparacion>
      )}
      {modalRevision.isOpen && actual && (
        <ConfirmarPreparacion
          key={actual.version}
          preparacion={actual}
          accion="confirmar"
          mostrarRevision
          alCerrar={modalRevision.closeModal}
          alError={alError}
          alRecargar={() => void recargarActual()}
          alGuardar={(confirmada) => {
            modalRevision.closeModal();
            terminar(confirmada, "confirmada");
          }}
        />
      )}
      {modalCambios.isOpen && (
        <DialogoTrabajoPreparacion
          tipo={dialogo}
          ocupado={guardando}
          alCerrar={() => {
            establecerRutaSalida(null);
            modalCambios.closeModal();
          }}
          alConfirmar={() => {
            if (dialogo === "volver") {
              if (rutaSalida) navegador.push(rutaSalida);
              else volver();
            } else if (dialogo === "recargar") void recargarActual();
            else if (dialogo === "almacen") {
              establecerAlmacen(almacenPropuesto);
              cambiar({ lineas: [], asignaciones: {}, cajillas: [] });
              modalCambios.closeModal();
            } else if (dialogo === "lote" && lotePropuesto !== null) {
              cambiar(quitarLoteDocumento(documento, lotePropuesto));
              modalCambios.closeModal();
            }
          }}
        />
      )}
    </div>
  );
}

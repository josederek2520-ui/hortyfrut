"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  ShoppingBasket as IconoProductos,
  ClipboardList as IconoPreparar,
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
import ImagenProducto from "@/components/productos/ImagenProducto";
import {
  clasePanel,
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import CabeceraTrabajoPreparacion from "./CabeceraTrabajoPreparacion";
import ListaProductosPreparacion from "./ListaProductosPreparacion";
import LotesProductoPreparacion from "./LotesProductoPreparacion";
import RepartoProductoPreparacion from "./RepartoProductoPreparacion";
import CajillasPreparacion from "./CajillasPreparacion";
import BarraTrabajoPreparacion from "./BarraTrabajoPreparacion";
import DialogoTrabajoPreparacion from "./DialogoTrabajoPreparacion";
import ConfirmarPreparacion from "./ConfirmarPreparacion";
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
} from "./tipos";

export default function FormularioPreparacion({
  preparacion,
  cliente,
  fecha,
  puedeConfirmar,
  puedeEditar,
  alError,
  alRecargar,
}: {
  preparacion?: Preparacion;
  cliente: OpcionPreparacion;
  fecha: string;
  puedeConfirmar: boolean;
  puedeEditar: boolean;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("preparaciones");
  const idioma = useLocale();
  const navegador = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);
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
  const [observaciones, establecerObservaciones] = useState(
    preparacion?.observaciones || "",
  );
  const [producto, establecerProducto] = useState<ProductoPreparacion | null>(
    () => productosDelDocumento(desdePreparacion(preparacion))[0] || null,
  );
  const [vistaMovil, establecerVistaMovil] = useState<"productos" | "preparar">(
    preparacion ? "preparar" : "productos",
  );
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
      observaciones,
    }) !==
    JSON.stringify({
      documento: serializarDocumento(desdePreparacion(actual)),
      almacen: actual?.almacen || almacenInicial,
      observaciones: actual?.observaciones || "",
    });
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
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
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
  const elegirProducto = (elegido: ProductoPreparacion) => {
    establecerProducto(elegido);
    establecerVistaMovil("preparar");
    establecerFoco((anterior) => ({
      seccion: "",
      pagina: 1,
      revision: anterior.revision + 1,
    }));
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
    if (!asignacion.cantidad.trim() && !Object.keys(asignacion.aportes).length)
      delete asignaciones[asignacion.clave];
    else asignaciones[asignacion.clave] = asignacion;
    cambiar({ ...documento, asignaciones });
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
      establecerCajillasAbiertas(true);
      pagina = Math.floor(indice / 10) + 1;
    }
    if (productoError) {
      establecerProducto(
        productosDelDocumento(documento).find(
          (fila) => fila.id === productoError,
        ) || null,
      );
      establecerVistaMovil("preparar");
    }
    establecerFoco((anterior) => ({
      seccion,
      pagina: Math.max(1, pagina),
      revision: anterior.revision + 1,
    }));
    if (formulario.current) enfocarCampoInvalido(formulario.current);
    if (!referencia && nombre !== "almacen")
      window.requestAnimationFrame(() =>
        formulario.current
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
    establecerObservaciones(guardada.observaciones);
    establecerProducto(
      (elegido) =>
        productosDelDocumento(nuevo).find((fila) => fila.id === elegido?.id) ||
        productosDelDocumento(nuevo)[0] ||
        null,
    );
    establecerErrores({});
  };
  const terminar = (
    guardada: Preparacion,
    aviso?: "guardada" | "confirmada",
  ) => {
    aplicarGuardada(guardada);
    try {
      if (aviso) sessionStorage.setItem("preparaciones:aviso", aviso);
    } catch {
      /* El guardado no depende del almacenamiento local. */
    }
    navegador.replace(`/preparaciones/${guardada.id}`);
    navegador.refresh();
  };
  const guardar = async (
    evento?: FormEvent<HTMLFormElement>,
    revisar = false,
  ) => {
    evento?.preventDefault();
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
        }),
      );
    if (!almacen) problemas.almacen = [t("seleccionarAlmacen")];
    if (!validar(formulario.current, problemas)) {
      establecerFallo(t("revisaDatosTrabajo"));
      enfocar(problemas);
      return;
    }
    establecerFallo("");
    if (actual && !modificado) {
      if (revisar) modalRevision.openModal();
      else terminar(actual, "guardada");
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
            observaciones: observaciones.trim(),
            ...(actual
              ? { version: actual.version }
              : { clave_operacion: claveOperacion }),
            ...serializarDocumento(documento),
          }),
        },
      );
      aplicarGuardada(respuesta);
      if (revisar) modalRevision.openModal();
      else terminar(respuesta, "guardada");
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
  const volver = () =>
    navegador.push(
      actual
        ? `/preparaciones/${actual.id}`
        : `/preparaciones?cliente=${cliente.id}&fecha=${fecha}`,
    );
  const salir = (tipo: "volver" | "recargar") => {
    if (guardando) return;
    if (modificado) abrirDialogo(tipo);
    else if (tipo === "recargar") void recargarActual();
    else volver();
  };
  const numero = (valor: number) => new Intl.NumberFormat(idioma).format(valor);
  return (
    <form
      ref={formulario}
      noValidate
      onSubmit={(evento) => void guardar(evento)}
      aria-busy={guardando}
      className="space-y-5"
    >
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={() => salir("volver")}
          className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t("volverHoja")}
        </button>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {t(actual ? "editarPreparacion" : "nuevaPreparacion")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("prepararPorProductoAyuda")}
        </p>
      </div>
      {fallo && (
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
                !["almacen", "observaciones"].includes(campo),
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
      )}
      <CabeceraTrabajoPreparacion
        cliente={cliente.nombre}
        fecha={fecha}
        almacen={almacen}
        observaciones={observaciones}
        ocupado={ocupado}
        errores={errores}
        alAlmacen={proponerAlmacen}
        alObservaciones={(valor) => {
          establecerObservaciones(valor);
          establecerErrores((anteriores) => ({
            ...anteriores,
            observaciones: [],
          }));
        }}
        alError={alError}
      />
      {actual && (
        <p
          role="status"
          className="px-1 text-theme-xs text-gray-500 dark:text-gray-400"
        >
          {actual.codigo} ·{" "}
          {t(
            modificado
              ? "cambiosSinGuardar"
              : puedeModificar
                ? "borradorGuardadoTrabajo"
                : "borradorSinEdicionTrabajo",
          )}
        </p>
      )}
      <div
        role="group"
        aria-label={t("vistaTrabajoPreparacion")}
        className="flex w-fit gap-1 rounded-xl bg-gray-100 p-1 2xl:hidden dark:bg-gray-800"
      >
        <Button
          size="sm"
          variant="outline"
          aria-pressed={vistaMovil === "productos"}
          className="pestana-hortyfru"
          onClick={() => establecerVistaMovil("productos")}
          startIcon={<IconoProductos className="size-4" />}
        >
          {t("productosPorPreparar")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          aria-pressed={vistaMovil === "preparar"}
          className="pestana-hortyfru"
          onClick={() => establecerVistaMovil("preparar")}
          startIcon={<IconoPreparar className="size-4" />}
        >
          {t("prepararTrabajo")}
        </Button>
      </div>
      <div className="grid items-start gap-5 2xl:grid-cols-[18rem_minmax(0,1fr)]">
        <div
          className={`min-w-0 2xl:sticky 2xl:top-28 2xl:block ${vistaMovil === "productos" ? "" : "hidden"}`}
        >
          <ListaProductosPreparacion
            contexto={contexto}
            documento={documento}
            seleccionado={producto}
            alElegir={elegirProducto}
            ocupado={guardando}
            alError={alError}
          />
        </div>
        <div
          id="ficha-producto-preparacion"
          className={`min-w-0 2xl:block ${vistaMovil === "preparar" ? "" : "hidden"}`}
        >
          {producto ? (
            <section
              className={`${clasePanel} min-w-0 overflow-hidden`}
              aria-labelledby="nombre-producto-preparacion"
            >
              <div className="flex flex-wrap items-center gap-4 p-5">
                <div className="w-20 shrink-0 sm:w-24">
                  <ImagenProducto
                    grande
                    origen={producto.imagen || null}
                    nombre={producto.nombre}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                    {producto.categoria?.nombre || producto.subtitulo}
                  </p>
                  <h2
                    id="nombre-producto-preparacion"
                    className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white"
                  >
                    {producto.nombre}
                  </h2>
                  {producto.pendientes_cajas !== undefined && (
                    <p className="mt-2 text-sm text-gray-600 tabular-nums dark:text-gray-300">
                      {t("cantUniPendientes", {
                        cajas: numero(producto.pendientes_cajas),
                        unidades: numero(producto.pendientes_unidades || 0),
                      })}
                    </p>
                  )}
                </div>
              </div>
              <LotesProductoPreparacion
                key={`lotes-${producto.id}-${foco.seccion === "lineas" ? foco.revision : 0}`}
                producto={producto}
                documento={documento}
                contexto={contexto}
                almacen={almacen?.id}
                ocupado={ocupado}
                errores={errores}
                paginaInicial={foco.seccion === "lineas" ? foco.pagina : 1}
                alError={alError}
                alAgregar={agregarLote}
                alCambiar={(indice, cambio) =>
                  cambiar({
                    ...documento,
                    lineas: documento.lineas.map((linea, posicion) =>
                      posicion === indice ? { ...linea, ...cambio } : linea,
                    ),
                  })
                }
                alQuitar={quitarLote}
              />
              <RepartoProductoPreparacion
                key={`reparto-${producto.id}-${foco.seccion === "asignaciones" ? foco.revision : 0}`}
                producto={producto}
                documento={documento}
                contexto={contexto}
                almacen={almacen?.id}
                ocupado={ocupado}
                errores={errores}
                paginaInicial={
                  foco.seccion === "asignaciones" ? foco.pagina : 1
                }
                mostrarAnotadas={foco.seccion === "asignaciones"}
                alError={alError}
                alCambiar={cambiarAsignacion}
                alElegirLote={elegirLoteSucursal}
                alQuitar={(clave) => {
                  const asignaciones = { ...documento.asignaciones };
                  delete asignaciones[clave];
                  cambiar({ ...documento, asignaciones });
                }}
              />
            </section>
          ) : (
            <div
              className={`${clasePanel} flex min-h-72 flex-col items-center justify-center p-8 text-center`}
            >
              <IconoProductos
                className="mb-4 size-10 text-brand-500"
                aria-hidden="true"
              />
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("eligeUnProductoTrabajo")}
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t("eligeProductoAyuda")}
              </p>
            </div>
          )}
        </div>
      </div>
      <details
        open={cajillasAbiertas}
        onToggle={(evento) =>
          establecerCajillasAbiertas(evento.currentTarget.open)
        }
        className={`${clasePanel} p-5 sm:p-6`}
      >
        <summary className="cursor-pointer rounded text-sm font-semibold text-gray-900 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-white">
          {t("cajillasOpcionalesTrabajo")}
          {documento.cajillas.length ? ` · ${documento.cajillas.length}` : ""}
        </summary>
        <div className="mt-5">
          <CajillasPreparacion
            key={`cajillas-${foco.seccion === "cajillas" ? foco.revision : 0}`}
            documento={documento}
            contexto={contexto}
            almacen={almacen?.id}
            ocupado={ocupado}
            errores={errores}
            alCambiar={cambiar}
            alError={alError}
            paginaInicial={foco.seccion === "cajillas" ? foco.pagina : 1}
          />
        </div>
      </details>
      <BarraTrabajoPreparacion
        documento={documento}
        guardando={guardando}
        conflicto={conflicto}
        puedeGuardar={puedeModificar}
        puedeConfirmar={puedeConfirmar}
        alSalir={() => salir("volver")}
        alRevisar={() => void guardar(undefined, true)}
      />
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
          alCerrar={modalCambios.closeModal}
          alConfirmar={() => {
            if (dialogo === "volver") volver();
            else if (dialogo === "recargar") void recargarActual();
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
    </form>
  );
}

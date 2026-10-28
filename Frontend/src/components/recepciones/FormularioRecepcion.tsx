"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft as IconoVolver } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import {
  focusInvalidField as enfocarCampoInvalido,
  type FieldErrors as ErroresCampos,
} from "@/lib/form-validation";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import MigasPagina from "@/components/common/PageBreadCrumb";
import {
  type OpcionCompra,
  type PaginaCompra,
} from "@/components/compras/tipos";
import { fechaLocal } from "@/components/pedidos/fechas";
import DatosRecepcion from "./DatosRecepcion";
import ProductosRecepcion from "./ProductosRecepcion";
import BarraRecepcion from "./BarraRecepcion";
import ConfirmarRecepcion from "./ConfirmarRecepcion";
import ConfirmarCambiosRecepcion from "./ConfirmarCambiosRecepcion";
import {
  actualizarMedicion,
  lineaDesdeOpcion,
  lineasDesdeRecepcion,
  serializarLineasRecepcion,
  seleccionarLineasRecepcion,
  erroresEnHojaRecepcion,
} from "./calculos";
import { validarLineasRecepcion } from "./validaciones";
import type {
  Recepcion,
  LineaRecepcion,
  OrigenRecepcion,
  OpcionProductoRecepcion,
} from "./tipos";

export default function FormularioRecepcion({
  recepcion,
  compraInicial,
  alError,
  alRecargar,
  puedeConfirmar,
  puedeEditar,
}: {
  recepcion?: Recepcion;
  compraInicial?: OrigenRecepcion;
  alError: (error: unknown) => void;
  alRecargar: () => void;
  puedeConfirmar: boolean;
  puedeEditar: boolean;
}) {
  const t = useTranslations("recepciones");
  const navegador = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const enviando = useRef(false);
  const [almacenInicial, establecerAlmacenInicial] = useState<number | null>(
    recepcion?.almacen || null,
  );
  const [actual, establecerActual] = useState(recepcion);
  const [fechaInicial] = useState(fechaLocal);
  const [origen, establecerOrigen] = useState<OrigenRecepcion | null>(() =>
    recepcion?.compra
      ? {
          id: recepcion.compra,
          nombre: recepcion.compra_codigo!,
          fecha_compra: recepcion.compra_fecha!,
        }
      : compraInicial || null,
  );
  const [vinculada, establecerVinculada] = useState(
    recepcion ? !!recepcion.compra : true,
  );
  const [almacen, establecerAlmacen] = useState<OpcionCompra | null>(() =>
    recepcion
      ? { id: recepcion.almacen, nombre: recepcion.almacen_nombre }
      : null,
  );
  const [fecha, establecerFecha] = useState(
    recepcion?.fecha_recepcion || fechaInicial,
  );
  const [observaciones, establecerObservaciones] = useState(
    recepcion?.observaciones || "",
  );
  const [lineas, establecerLineas] = useState<LineaRecepcion[]>(() =>
    lineasDesdeRecepcion(recepcion),
  );
  const [vista, establecerVista] = useState<"pendientes" | "anotados">(
    recepcion ? "anotados" : "pendientes",
  );
  const [pagina, establecerPagina] = useState(1);
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [tipoCambio, establecerTipoCambio] = useState<
    "origen" | "salir" | "recargar" | null
  >(null);
  const [cambioOrigen, establecerCambioOrigen] = useState<{
    vinculada: boolean;
    compra: OrigenRecepcion | null;
  } | null>(null);
  const modalCambio = useModal();
  const modalRevision = useModal();
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validar,
  } = useValidacionFormulario();
  const puedeModificar = !actual || puedeEditar;
  const ocupado = guardando || conflicto || !puedeModificar;
  const modificado =
    vinculada !== (actual ? !!actual.compra : true) ||
    (origen?.id || null) !== (actual?.compra || compraInicial?.id || null) ||
    (almacen?.id || null) !== (actual?.almacen || almacenInicial) ||
    fecha !== (actual?.fecha_recepcion || fechaInicial) ||
    observaciones !== (actual?.observaciones || "") ||
    JSON.stringify(lineas) !== JSON.stringify(lineasDesdeRecepcion(actual));
  useEffect(() => {
    if (recepcion) return;
    const controlador = new AbortController();
    void api<PaginaCompra<OpcionCompra>>("recepciones/almacenes/", {
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
  }, [recepcion, alError]);
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const limpiarErrores = () => establecerErrores({});
  const limpiarCampo = (campo: string) =>
    establecerErrores((anteriores) => ({ ...anteriores, [campo]: [] }));
  const abrirCambio = (tipo: "origen" | "salir" | "recargar") => {
    establecerTipoCambio(tipo);
    modalCambio.openModal();
  };
  const aplicarOrigen = (cambio: {
    vinculada: boolean;
    compra: OrigenRecepcion | null;
  }) => {
    establecerVinculada(cambio.vinculada);
    establecerOrigen(cambio.compra);
    establecerLineas([]);
    establecerPagina(1);
    establecerVista(cambio.vinculada ? "pendientes" : "anotados");
    limpiarErrores();
    establecerFallo("");
    modalCambio.closeModal();
    if (cambio.compra && fecha < cambio.compra.fecha_compra)
      establecerFecha(cambio.compra.fecha_compra);
  };
  const proponerOrigen = (cambio: {
    vinculada: boolean;
    compra: OrigenRecepcion | null;
  }) => {
    if (ocupado || actual) return;
    if (lineas.length) {
      establecerCambioOrigen(cambio);
      abrirCambio("origen");
    } else aplicarOrigen(cambio);
  };
  const cambiarLinea = (
    linea: LineaRecepcion,
    cambios: Partial<LineaRecepcion>,
  ) => {
    if (ocupado) return;
    const indice = lineas.findIndex(
      (guardada) => guardada.clave === linea.clave,
    );
    if (indice < 0 && lineas.length >= 500) {
      establecerFallo(t("limiteLineas"));
      return;
    }
    const nueva = actualizarMedicion(linea, cambios);
    establecerLineas((anteriores) =>
      indice < 0
        ? [...anteriores, nueva]
        : anteriores.map((guardada) =>
            guardada.clave === linea.clave ? nueva : guardada,
          ),
    );
    establecerErrores((anteriores) =>
      Object.fromEntries(
        Object.entries(anteriores).filter(
          ([campo]) =>
            campo !== "detalles" && !campo.startsWith(`detalle_${indice}_`),
        ),
      ),
    );
  };
  const eliminar = (clave: string) => {
    if (ocupado) return;
    const nuevas = lineas.filter((linea) => linea.clave !== clave);
    establecerLineas(nuevas);
    establecerPagina(
      Math.min(pagina, Math.max(1, Math.ceil(nuevas.length / 10))),
    );
    establecerErrores((anteriores) =>
      Object.fromEntries(
        Object.entries(anteriores).filter(
          ([campo]) => campo !== "detalles" && !campo.startsWith("detalle_"),
        ),
      ),
    );
  };
  const agregar = (opcion: OpcionProductoRecepcion) => {
    if (ocupado || !opcion.disponible) return;
    if (lineas.length >= 500) {
      establecerFallo(t("limiteLineas"));
      return;
    }
    establecerLineas((anteriores) => [
      ...anteriores,
      {
        ...lineaDesdeOpcion(opcion),
        clave: crypto.randomUUID(),
        detalleCompra: null,
        medidaCompra: "",
        pendiente: undefined,
        unidadCompra: null,
      },
    ]);
    establecerPagina(Math.floor(lineas.length / 10) + 1);
    establecerVista("anotados");
    limpiarCampo("detalles");
    window.requestAnimationFrame(() =>
      formulario.current
        ?.querySelector<HTMLElement>(
          `[name="detalle_${lineas.length}_cantidad_inventario"]`,
        )
        ?.focus(),
    );
  };
  const enfocarErrores = (problemas: ErroresCampos) => {
    const clave = Object.keys(problemas).find(
      (campo) => problemas[campo]?.length && /^detalle_\d+_/.test(campo),
    );
    if (clave || problemas.detalles?.length) establecerVista("anotados");
    if (clave)
      establecerPagina(Math.floor(Number(clave.split("_")[1]) / 10) + 1);
    if (formulario.current) enfocarCampoInvalido(formulario.current);
  };
  const aplicarRecepcion = (guardada: Recepcion) => {
    establecerActual(guardada);
    establecerOrigen(
      guardada.compra
        ? {
            id: guardada.compra,
            nombre: guardada.compra_codigo!,
            fecha_compra: guardada.compra_fecha!,
          }
        : null,
    );
    establecerVinculada(!!guardada.compra);
    establecerAlmacen({
      id: guardada.almacen,
      nombre: guardada.almacen_nombre,
    });
    establecerFecha(guardada.fecha_recepcion);
    establecerObservaciones(guardada.observaciones);
    establecerLineas(lineasDesdeRecepcion(guardada));
    establecerVista("anotados");
    establecerPagina((anterior) =>
      Math.min(anterior, Math.max(1, Math.ceil(guardada.detalles.length / 10))),
    );
  };
  const terminar = (guardada: Recepcion, aviso?: "guardada" | "confirmada") => {
    aplicarRecepcion(guardada);
    try {
      if (aviso) sessionStorage.setItem("recepciones:aviso", aviso);
    } catch {
      /* El guardado no depende del almacenamiento local. */
    }
    navegador.replace(`/recepciones/${guardada.id}`);
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
    const seleccion = seleccionarLineasRecepcion(lineas);
    const problemas = erroresEnHojaRecepcion(
      validarLineasRecepcion(seleccion.lineas, vinculada, revisar, fecha, {
        cantidad: t("cantidadInvalida"),
        positiva: t("cantidadPositiva"),
        peso: t("pesoInvalido"),
        vencimiento: t("vencimientoInvalido"),
        pendiente: t("cantidadSuperaPendiente"),
        mismaUnidad: t("cantidadesDebenCoincidir"),
        sinLineas: t("sinLineasConfirmar"),
        limite: t("limiteLineas"),
      }),
      seleccion.indices,
    );
    if (!almacen) problemas.almacen = [t("seleccionAlmacen")];
    if (vinculada && !origen) problemas.compra = [t("seleccionCompra")];
    if (revisar && !vinculada && !observaciones.trim())
      problemas.observaciones = [t("motivoIngresoObligatorio")];
    if (!validar(formulario.current, problemas)) {
      establecerFallo(t("revisarCampos"));
      enfocarErrores(problemas);
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
      const guardada = await api<Recepcion>(
        actual ? `recepciones/${actual.id}/` : "recepciones/",
        {
          method: actual ? "PATCH" : "POST",
          body: JSON.stringify({
            compra: vinculada ? origen!.id : null,
            almacen: almacen!.id,
            fecha_recepcion: fecha,
            observaciones: observaciones.trim(),
            ...(actual
              ? { version: actual.version }
              : { clave_operacion: claveOperacion }),
            detalles: serializarLineasRecepcion(seleccion.lineas, vinculada),
          }),
        },
      );
      aplicarRecepcion(guardada);
      limpiarErrores();
      if (revisar) modalRevision.openModal();
      else terminar(guardada, "guardada");
    } catch (error) {
      if (error instanceof ErrorApi) {
        const problemas = erroresEnHojaRecepcion(
          error.errors,
          seleccion.indices,
        );
        establecerErrores(problemas);
        enfocarErrores(problemas);
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
      const guardada = await api<Recepcion>(`recepciones/${actual.id}/`);
      if (guardada.estado !== "borrador") {
        terminar(guardada);
        return;
      }
      aplicarRecepcion(guardada);
      limpiarErrores();
      establecerFallo("");
      establecerConflicto(false);
      modalRevision.closeModal();
      modalCambio.closeModal();
    } catch (error) {
      alError(error);
    } finally {
      enviando.current = false;
      establecerGuardando(false);
    }
  };
  const volver = () =>
    navegador.push(actual ? `/recepciones/${actual.id}` : "/recepciones");
  const salir = () => {
    if (!guardando) {
      if (modificado) abrirCambio("salir");
      else volver();
    }
  };
  return (
    <div className="space-y-5">
      <button
        type="button"
        disabled={guardando}
        onClick={salir}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
      >
        <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
        {t("volverListado")}
      </button>
      <MigasPagina pageTitle={t(actual ? "editar" : "nueva")} />
      <form
        ref={formulario}
        noValidate
        onSubmit={(evento) => void guardar(evento)}
        aria-busy={guardando}
        className="space-y-5"
      >
        {fallo && (
          <div
            role="alert"
            className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
          >
            <p>{fallo}</p>
            {conflicto && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => abrirCambio("recargar")}
              >
                {t("recargar")}
              </Button>
            )}
          </div>
        )}
        <DatosRecepcion
          vinculada={vinculada}
          origen={origen}
          almacen={almacen}
          fecha={fecha}
          observaciones={observaciones}
          guardada={!!actual}
          ocupado={ocupado}
          errores={errores}
          alOrigen={proponerOrigen}
          alAlmacen={(valor) => {
            establecerAlmacen(valor);
            limpiarCampo("almacen");
          }}
          alFecha={(valor) => {
            establecerFecha(valor);
            limpiarCampo("fecha_recepcion");
          }}
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
                  ? "borradorEnHoja"
                  : "borradorSinEdicion",
            )}
          </p>
        )}
        <ProductosRecepcion
          key={`${vinculada}-${origen?.id || "directa"}`}
          compra={origen?.id}
          vinculada={vinculada}
          lineas={lineas}
          fecha={fecha}
          ocupado={ocupado}
          errores={errores}
          vista={vista}
          alVista={establecerVista}
          pagina={pagina}
          alPagina={establecerPagina}
          alCambiar={cambiarLinea}
          alEliminar={eliminar}
          alAgregar={agregar}
          alError={alError}
        />
        <BarraRecepcion
          cantidad={seleccionarLineasRecepcion(lineas).lineas.length}
          almacen={almacen?.nombre}
          ocupado={guardando}
          conflicto={conflicto}
          puedeGuardar={puedeModificar}
          puedeConfirmar={puedeConfirmar}
          alSalir={salir}
          alRevisar={() => void guardar(undefined, true)}
        />
      </form>
      {modalRevision.isOpen && actual && (
        <ConfirmarRecepcion
          key={actual.version}
          recepcion={actual}
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
      {modalCambio.isOpen && tipoCambio && (
        <ConfirmarCambiosRecepcion
          tipo={tipoCambio}
          ocupado={guardando}
          alCerrar={modalCambio.closeModal}
          alConfirmar={() => {
            if (tipoCambio === "origen" && cambioOrigen)
              aplicarOrigen(cambioOrigen);
            else if (tipoCambio === "salir") volver();
            else if (tipoCambio === "recargar") void recargarActual();
          }}
        />
      )}
    </div>
  );
}

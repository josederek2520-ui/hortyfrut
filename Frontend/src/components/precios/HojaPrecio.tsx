"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Save, FileCheck2, Check, X, CopyPlus } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import type { Session } from "@/components/users/types";
import useGestionPrecio from "./useGestionPrecio";
import CabeceraPrecio from "./CabeceraPrecio";
import ProductosPrecio from "./ProductosPrecio";
import SelectorOpcionesPrecio from "./SelectorOpcionesPrecio";
import RevisionPrecio from "./RevisionPrecio";
import HistorialPrecio from "./HistorialPrecio";
import {
  campoPrecio,
  panelPrecio,
  type AccionPrecio,
  type OpcionPrecio,
} from "./tipos";

export default function HojaPrecio({
  sesion,
  identificador,
}: {
  sesion: Session;
  identificador?: number;
}) {
  const t = useTranslations("precios"),
    navegador = useRouter();
  const gestion = useGestionPrecio(identificador);
  const { documento, formulario, ocupado, incierto, errores } = gestion,
    permisos = sesion.permisos_precios!;
  const editable =
    (!documento || documento.estado === "borrador") &&
    (documento ? permisos.editar : permisos.crear);
  const bloqueado = ocupado || incierto;
  const [pagina, establecerPagina] = useState(1),
    [buscar, establecerBuscar] = useState("");
  const [selector, establecerSelector] = useState<
    "clientes" | "productos" | "entregas" | null
  >(null);
  const [confirmacion, establecerConfirmacion] = useState<
    | "salir"
    | "cancelar"
    | "rechazar"
    | "nueva_version"
    | "cambiarCliente"
    | null
  >(null);
  const [revision, establecerRevision] = useState<
    "presentar" | "aceptar" | null
  >(null);
  const [motivo, establecerMotivo] = useState(""),
    [clientePendiente, establecerClientePendiente] =
      useState<OpcionPrecio | null>(null);
  const [historial, establecerHistorial] = useState(false),
    [focoPendiente, establecerFocoPendiente] = useState<string | null>(null);
  const raiz = useRef<HTMLElement>(null),
    ultimaRevision = useRef(0);
  const { toasts, notify, dismiss } = useToast();
  useEffect(() => {
    if (gestion.aviso) notify(t(gestion.aviso), "success");
  }, [gestion.aviso, notify, t]);
  const enfocar = (clave: string) => {
    const coincidencia = /^(\d+)_/.exec(clave);
    if (coincidencia) {
      establecerBuscar("");
      const indice = formulario.lineas.findIndex(
        (f) => f.producto === Number(coincidencia[1]),
      );
      if (indice >= 0) establecerPagina(Math.floor(indice / 10) + 1);
    }
    establecerFocoPendiente(clave);
  };
  useEffect(() => {
    if (ultimaRevision.current === gestion.revisionErrores) return;
    ultimaRevision.current = gestion.revisionErrores;
    const clave = Object.keys(errores)[0];
    if (!clave) return;
    const reloj = setTimeout(() => {
      const coincidencia = /^(\d+)_/.exec(clave);
      if (coincidencia) {
        establecerBuscar("");
        const indice = formulario.lineas.findIndex(
          (f) => f.producto === Number(coincidencia[1]),
        );
        if (indice >= 0) establecerPagina(Math.floor(indice / 10) + 1);
      }
      establecerFocoPendiente(clave);
    }, 0);
    return () => clearTimeout(reloj);
  }, [errores, gestion.revisionErrores, formulario.lineas]);
  useEffect(() => {
    if (!focoPendiente) return;
    const reloj = setTimeout(() => {
      const elemento = Array.from(
        raiz.current?.querySelectorAll<HTMLElement>("[data-campo-precio]") ??
          [],
      ).find((e) => e.dataset.campoPrecio === focoPendiente);
      if (elemento) {
        elemento.scrollIntoView({ block: "center", behavior: "auto" });
        elemento.focus({ preventScroll: true });
        establecerFocoPendiente(null);
      }
    }, 0);
    return () => clearTimeout(reloj);
  }, [focoPendiente, pagina, buscar, formulario.lineas]);
  async function actuar(accion: AccionPrecio, razon = "") {
    const resultado = await gestion.operar(accion, razon);
    if (resultado && resultado.id !== identificador)
      navegador.replace("/precios-acordados/" + resultado.id);
  }
  const volver = () => {
    if (ocupado) return;
    if (gestion.modificado || incierto) establecerConfirmacion("salir");
    else navegador.push("/precios-acordados");
  };
  const elegir = (opcion: OpcionPrecio) => {
    if (selector === "clientes") {
      if (formulario.cliente?.id === opcion.id) return;
      if (formulario.lineas.length || formulario.entregas.length) {
        establecerClientePendiente(opcion);
        establecerConfirmacion("cambiarCliente");
      } else gestion.cambiar((f) => ({ ...f, cliente: opcion }));
    } else if (selector === "productos") {
      if (formulario.lineas.some((f) => f.producto === opcion.id)) return;
      gestion.cambiar((f) => ({
        ...f,
        lineas: [
          ...f.lineas,
          {
            producto: opcion.id,
            producto_nombre: opcion.nombre,
            categoria_nombre: opcion.categoria_nombre ?? "",
            precio_kg: "",
            precio_anterior: null,
          },
        ],
      }));
      establecerBuscar("");
      establecerPagina(Math.floor(formulario.lineas.length / 10) + 1);
    } else {
      gestion.cambiar((f) => ({
        ...f,
        entregas: f.entregas.includes(opcion.id)
          ? f.entregas.filter((id) => id !== opcion.id)
          : [...f.entregas, opcion.id],
      }));
    }
  };
  const abrirConfirmacion = (
    accion: "cancelar" | "rechazar" | "nueva_version",
  ) => {
    establecerMotivo("");
    establecerConfirmacion(accion);
  };
  const mensajeError = (mensaje: string) =>
    t.has("errores." + mensaje) ? t("errores." + mensaje) : mensaje;
  if (identificador && !documento)
    return (
      <div className={panelPrecio + " space-y-4 p-6"}>
        <p role={gestion.fallo ? "alert" : "status"}>
          {t(gestion.fallo || "cargando")}
        </p>
        {gestion.fallo && (
          <Button variant="outline" onClick={gestion.reintentarConsulta}>
            {t("reintentar")}
          </Button>
        )}
      </div>
    );
  return (
    <section
      ref={raiz}
      className="space-y-5 pb-5 text-gray-900 dark:text-white"
    >
      <CabeceraPrecio
        gestion={gestion}
        editable={editable}
        alVolver={volver}
        alCliente={() => establecerSelector("clientes")}
        alEntregas={() => establecerSelector("entregas")}
        alHistorial={() => establecerHistorial((v) => !v)}
      />
      {gestion.fallo && (
        <div
          role="alert"
          className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <p className="font-medium">{t(gestion.fallo)}</p>
          {Object.keys(errores).length > 0 && (
            <ul className="mt-2 space-y-1">
              {Object.entries(errores).map(([clave, mensajes]) => (
                <li key={clave}>
                  <button
                    type="button"
                    className="min-h-9 rounded text-start underline focus-visible:outline-2"
                    onClick={() => enfocar(clave)}
                  >
                    {mensajes.map(mensajeError).join(" ")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {incierto && (
            <div className="mt-3">
              <Button
                variant="outline"
                disabled={ocupado}
                onClick={() => void actuar("reintentar")}
              >
                {t("comprobarOperacion")}
              </Button>
            </div>
          )}
        </div>
      )}
      <ProductosPrecio
        lineas={formulario.lineas}
        pagina={pagina}
        buscar={buscar}
        editable={editable}
        version={!!documento?.anterior}
        bloqueado={bloqueado}
        errores={errores}
        alPagina={establecerPagina}
        alBuscar={(valor) => {
          establecerBuscar(valor);
          establecerPagina(1);
        }}
        alAgregar={() => establecerSelector("productos")}
        alQuitar={(id) => {
          gestion.cambiar((f) => ({
            ...f,
            lineas: f.lineas.filter((l) => l.producto !== id),
          }));
          establecerPagina(1);
        }}
        alPrecio={(id, valor) =>
          gestion.cambiar((f) => ({
            ...f,
            lineas: f.lineas.map((l) =>
              l.producto === id ? { ...l, precio_kg: valor } : l,
            ),
          }))
        }
      />
      {historial && documento && (
        <HistorialPrecio identificador={documento.id} />
      )}
      <footer
        className={
          panelPrecio +
          " sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-4"
        }
      >
        <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
          {t(
            ocupado
              ? "procesando"
              : incierto
                ? "resultadoIncierto"
                : gestion.modificado
                  ? "sinGuardar"
                  : documento?.estado === "propuesta"
                    ? "pendienteAceptacion"
                    : documento?.estado === "aceptado"
                      ? "precioAceptadoAyuda"
                      : "ayudaBorrador",
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={ocupado} onClick={volver}>
            {t("salir")}
          </Button>
          {documento?.estado === "borrador" && permisos.cancelar && (
            <Button
              variant="outline"
              disabled={bloqueado}
              onClick={() => abrirConfirmacion("cancelar")}
            >
              {t("cancelarBorrador")}
            </Button>
          )}
          {editable && (
            <Button
              variant="outline"
              disabled={bloqueado}
              startIcon={<Save className="size-4" />}
              onClick={() => void actuar("guardar")}
            >
              {t("guardarBorrador")}
            </Button>
          )}
          {(!documento || documento.estado === "borrador") &&
            permisos.presentar && (
              <Button
                disabled={
                  bloqueado ||
                  (!documento && !permisos.crear) ||
                  (gestion.modificado && !editable)
                }
                startIcon={<FileCheck2 className="size-4" />}
                onClick={() => {
                  if (gestion.validar()) establecerRevision("presentar");
                }}
              >
                {t("revisarPropuesta")}
              </Button>
            )}
          {documento?.estado === "propuesta" && permisos.rechazar && (
            <Button
              variant="outline"
              disabled={bloqueado}
              startIcon={<X className="size-4" />}
              onClick={() => abrirConfirmacion("rechazar")}
            >
              {t("rechazarPropuesta")}
            </Button>
          )}
          {documento?.estado === "propuesta" && permisos.aceptar && (
            <Button
              disabled={bloqueado}
              startIcon={<Check className="size-4" />}
              onClick={() => establecerRevision("aceptar")}
            >
              {t("aceptarPrecios")}
            </Button>
          )}
          {documento?.estado === "aceptado" &&
            documento.es_actual &&
            permisos.crear && (
              <Button
                variant="outline"
                disabled={bloqueado}
                startIcon={<CopyPlus className="size-4" />}
                onClick={() => abrirConfirmacion("nueva_version")}
              >
                {t("nuevaVersion")}
              </Button>
            )}
        </div>
      </footer>
      {selector && (
        <SelectorOpcionesPrecio
          tipo={selector}
          cliente={formulario.cliente?.id}
          seleccionados={
            selector === "clientes"
              ? formulario.cliente
                ? [formulario.cliente.id]
                : []
              : selector === "productos"
                ? formulario.lineas.map((f) => f.producto)
                : formulario.entregas
          }
          bloqueado={bloqueado}
          soloConsulta={
            selector === "entregas" && (!editable || !!documento?.anterior)
          }
          alElegir={elegir}
          alCerrar={() => establecerSelector(null)}
        />
      )}
      {revision && (
        <RevisionPrecio
          formulario={formulario}
          aceptar={revision === "aceptar"}
          ocupado={ocupado}
          alCerrar={() => establecerRevision(null)}
          alConfirmar={() => {
            const accion = revision;
            establecerRevision(null);
            void actuar(accion);
          }}
        />
      )}
      {confirmacion && (
        <ConfirmacionLogistica
          titulo={t("confirmaciones." + confirmacion + ".titulo")}
          descripcion={t("confirmaciones." + confirmacion + ".ayuda")}
          accion={t("confirmaciones." + confirmacion + ".accion")}
          ocupado={ocupado}
          deshabilitado={
            ["rechazar", "nueva_version"].includes(confirmacion) &&
            !motivo.trim()
          }
          alCerrar={() => establecerConfirmacion(null)}
          alConfirmar={() => {
            const accion = confirmacion;
            establecerConfirmacion(null);
            if (accion === "salir") navegador.push("/precios-acordados");
            else if (accion === "cambiarCliente" && clientePendiente) {
              gestion.cambiar((f) => ({
                ...f,
                cliente: clientePendiente,
                lineas: [],
                entregas: [],
              }));
              establecerPagina(1);
              establecerBuscar("");
            } else if (
              accion === "cancelar" ||
              accion === "rechazar" ||
              accion === "nueva_version"
            )
              void actuar(accion, motivo);
          }}
        >
          {["rechazar", "nueva_version"].includes(confirmacion) && (
            <label className="mt-4 block text-sm text-gray-900 dark:text-white">
              {t("motivo")}
              <textarea
                className={campoPrecio + " mt-2 min-h-24"}
                value={motivo}
                maxLength={500}
                onChange={(e) => establecerMotivo(e.target.value)}
                disabled={ocupado}
              />
            </label>
          )}
        </ConfirmacionLogistica>
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}

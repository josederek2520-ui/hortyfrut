"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { useModal } from "@/hooks/useModal";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import MigasPagina from "@/components/common/PageBreadCrumb";
import { clasePanel } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import type { Session as Sesion } from "@/components/users/types";
import FormularioPreparacion from "./FormularioPreparacion";
import DetallePreparacion from "./DetallePreparacion";
import ConfirmarPreparacion from "./ConfirmarPreparacion";
import useAvisosPreparaciones from "./useAvisosPreparaciones";
import type { HojaConsolidada, Preparacion } from "./tipos";

export default function FichaPreparacion({
  sesion,
  modo,
  identificador,
  fecha,
  cliente,
  confirmarInicial = false,
}: {
  sesion: Sesion;
  modo: "nuevo" | "editar" | "detalle";
  identificador?: string;
  fecha?: string;
  cliente?: number;
  confirmarInicial?: boolean;
}) {
  const t = useTranslations("preparaciones");
  const { avisos, cerrarAviso, notificar, tratarError } =
    useAvisosPreparaciones();
  const permisos = sesion.permisos_preparaciones;
  const permitido =
    !!permisos?.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "editar"
        ? permisos.editar
        : true);
  const modal = useModal(confirmarInicial && !!permisos?.confirmar);
  const [accion, establecerAccion] = useState<"confirmar" | "cancelar">(
    "confirmar",
  );
  const [preparacion, establecerPreparacion] = useState<Preparacion>();
  const [hoja, establecerHoja] = useState<HojaConsolidada>();
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const recargar = () => {
    modal.closeModal();
    establecerFallo(false);
    establecerPreparacion(undefined);
    establecerHoja(undefined);
    establecerRevision((valor) => valor + 1);
  };
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    const cargar = async () => {
      try {
        if (modo === "nuevo") {
          const datos = await api<HojaConsolidada>(
            `preparaciones/consolidado/?${new URLSearchParams({ cliente: String(cliente || ""), fecha_pedidos: fecha || "" })}`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) establecerHoja(datos);
        } else {
          const datos = await api<Preparacion>(
            `preparaciones/${identificador}/`,
            { signal: controlador.signal },
          );
          if (!controlador.signal.aborted) establecerPreparacion(datos);
        }
      } catch (error) {
        if (!controlador.signal.aborted) {
          establecerFallo(true);
          tratarError(error);
        }
      }
    };
    void cargar();
    return () => controlador.abort();
  }, [permitido, modo, identificador, cliente, fecha, revision, tratarError]);
  useEffect(() => {
    if (modo !== "detalle") return;
    const temporizador = window.setTimeout(() => {
      try {
        const aviso = sessionStorage.getItem("preparaciones:aviso");
        if (aviso === "guardada" || aviso === "confirmada") {
          sessionStorage.removeItem("preparaciones:aviso");
          notificar(t(aviso));
        }
      } catch {
        /* La navegación no depende del almacenamiento local. */
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [modo, notificar, t]);
  return (
    <div
      className={`min-w-0 space-y-6 ${modo === "detalle" ? "mx-auto max-w-6xl" : ""}`}
    >
      {modo === "detalle" && (
        <Link
          href="/preparaciones?historial=1"
          className={claseEnlaceInventario}
        >
          {t("volverPreparaciones")}
        </Link>
      )}
      <MigasPagina
        ocultarTitulo={modo !== "detalle"}
        pageTitle={t(
          modo === "nuevo"
            ? "nuevaPreparacion"
            : modo === "editar"
              ? "editarPreparacion"
              : "detalle",
        )}
      />
      {!permitido ? (
        <p role="alert" className={`${clasePanel} p-8`}>
          {t("restringido")}
        </p>
      ) : fallo ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p>{t("errorCarga")}</p>
          <Button variant="outline" onClick={recargar}>
            {t("recargar")}
          </Button>
          <Link href="/preparaciones" className={claseEnlaceInventario}>
            {t("volverHoja")}
          </Link>
        </div>
      ) : modo === "nuevo" && hoja ? (
        <FormularioPreparacion
          key={`nueva-${revision}`}
          cliente={hoja.cliente}
          fecha={hoja.fecha_pedidos}
          puedeConfirmar={permisos.confirmar}
          puedeEditar={permisos.editar}
          alError={tratarError}
          alRecargar={recargar}
        />
      ) : preparacion ? (
        modo === "detalle" ? (
          <DetallePreparacion
            preparacion={preparacion}
            sesion={sesion}
            alAccion={(valor) => {
              establecerAccion(valor);
              modal.openModal();
            }}
          />
        ) : preparacion.estado === "borrador" ? (
          <FormularioPreparacion
            key={preparacion.version}
            preparacion={preparacion}
            cliente={{
              id: preparacion.cliente,
              nombre: preparacion.cliente_nombre,
            }}
            fecha={preparacion.fecha_pedidos}
            puedeConfirmar={permisos.confirmar}
            puedeEditar={permisos.editar}
            alError={tratarError}
            alRecargar={recargar}
          />
        ) : (
          <div className={`${clasePanel} space-y-4 p-8`}>
            <p>{t("soloBorrador")}</p>
            <Link
              href={`/preparaciones/${preparacion.id}`}
              className={claseEnlaceInventario}
            >
              {t("verPreparacion")}
            </Link>
          </div>
        )
      ) : (
        <p
          role="status"
          className={`${clasePanel} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </p>
      )}
      {modal.isOpen && preparacion?.estado === "borrador" && (
        <ConfirmarPreparacion
          key={`${preparacion.version}-${accion}`}
          preparacion={preparacion}
          accion={accion}
          alCerrar={modal.closeModal}
          alError={tratarError}
          alRecargar={recargar}
          alGuardar={(datos) => {
            establecerPreparacion(datos);
            modal.closeModal();
            notificar(t(accion === "confirmar" ? "confirmada" : "cancelada"));
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

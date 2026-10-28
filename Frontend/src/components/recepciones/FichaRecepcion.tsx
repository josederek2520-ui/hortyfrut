"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import Button from "@/components/ui/button/Button";
import { clasePanel } from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import { useModal } from "@/hooks/useModal";
import useAvisosInventario from "@/components/inventario/useAvisosInventario";
import type { Session as Sesion } from "@/components/users/types";
import FormularioRecepcion from "./FormularioRecepcion";
import DetalleRecepcion from "./DetalleRecepcion";
import ConfirmarRecepcion from "./ConfirmarRecepcion";
import type { Recepcion, OrigenRecepcion } from "./tipos";

export default function FichaRecepcion({
  sesion,
  modo,
  identificador,
  compraInicial,
}: {
  sesion: Sesion;
  modo: "nuevo" | "editar" | "detalle";
  identificador?: string;
  compraInicial?: number;
}) {
  const t = useTranslations("recepciones");
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosInventario();
  const modal = useModal();
  const permitido =
    sesion.permisos_recepciones?.ver &&
    (modo === "detalle" ||
      (modo === "nuevo"
        ? sesion.permisos_recepciones.crear
        : sesion.permisos_recepciones.editar));
  const [recepcion, establecerRecepcion] = useState<Recepcion>();
  const [origen, establecerOrigen] = useState<OrigenRecepcion>();
  const [revision, establecerRevision] = useState(0);
  const [cargando, establecerCargando] = useState(
    modo !== "nuevo" || !!compraInicial,
  );
  const [fallo, establecerFallo] = useState(false);
  const [accion, establecerAccion] = useState<"confirmar" | "cancelar">(
    "confirmar",
  );
  const recargar = () => {
    modal.closeModal();
    establecerFallo(false);
    establecerCargando(modo !== "nuevo" || !!compraInicial);
    establecerRevision((valor) => valor + 1);
  };
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    if (modo !== "nuevo" || compraInicial) {
      const cargar = async () => {
        try {
          if (modo === "nuevo") {
            const respuesta = await api<OrigenRecepcion>(
              `recepciones/compra-origen/?compra=${compraInicial}`,
              { signal: controlador.signal },
            );
            if (!controlador.signal.aborted) establecerOrigen(respuesta);
          } else {
            const respuesta = await api<Recepcion>(
              `recepciones/${identificador}/`,
              { signal: controlador.signal },
            );
            if (!controlador.signal.aborted) establecerRecepcion(respuesta);
          }
        } catch (error) {
          if (!controlador.signal.aborted) {
            establecerFallo(true);
            tratarError(error);
          }
        } finally {
          if (!controlador.signal.aborted) establecerCargando(false);
        }
      };
      void cargar();
    }
    return () => controlador.abort();
  }, [permitido, modo, identificador, compraInicial, revision, tratarError]);
  useEffect(() => {
    const temporizador = window.setTimeout(() => {
      try {
        const aviso = sessionStorage.getItem("recepciones:aviso");
        if (aviso === "guardada" || aviso === "confirmada") {
          sessionStorage.removeItem("recepciones:aviso");
          notificar(t(aviso));
        }
      } catch {
        /* Los avisos no dependen del almacenamiento local. */
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [notificar, t]);
  return (
    <div
      className={`min-w-0 space-y-6 ${modo === "detalle" ? "mx-auto max-w-6xl" : ""}`}
    >
      {(modo === "detalle" ||
        !permitido ||
        fallo ||
        cargando ||
        (modo === "editar" && recepcion?.estado !== "borrador")) && (
        <>
          <Link href="/recepciones" className={claseEnlaceInventario}>
            {t("volverListado")}
          </Link>
          <MigasPagina
            pageTitle={t(
              modo === "nuevo"
                ? "nueva"
                : modo === "editar"
                  ? "editar"
                  : "detalle",
            )}
          />
        </>
      )}
      {!permitido ? (
        <p role="alert" className={`${clasePanel} p-8`}>
          {t("restringido")}
        </p>
      ) : fallo ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p>{t("errorCarga")}</p>
          <Button variant="outline" onClick={recargar}>
            {t("reintentar")}
          </Button>
        </div>
      ) : cargando ? (
        <p
          role="status"
          className={`${clasePanel} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </p>
      ) : modo === "editar" && recepcion?.estado !== "borrador" ? (
        <div className={`${clasePanel} p-8`}>
          <p>{t("soloBorrador")}</p>
          <Link
            href={`/recepciones/${identificador}`}
            className={claseEnlaceInventario}
          >
            {t("verDetalle")}
          </Link>
        </div>
      ) : modo === "detalle" && recepcion ? (
        <DetalleRecepcion
          recepcion={recepcion}
          sesion={sesion}
          alAccion={(valor) => {
            establecerAccion(valor);
            modal.openModal();
          }}
        />
      ) : (
        <FormularioRecepcion
          key={`${recepcion?.version || "nueva"}-${revision}`}
          recepcion={recepcion}
          compraInicial={origen}
          alError={tratarError}
          alRecargar={recargar}
          puedeConfirmar={!!sesion.permisos_recepciones?.confirmar}
          puedeEditar={!!sesion.permisos_recepciones?.editar}
        />
      )}
      {modal.isOpen && recepcion && (
        <ConfirmarRecepcion
          key={`${accion}-${recepcion.version}`}
          recepcion={recepcion}
          accion={accion}
          alCerrar={modal.closeModal}
          alError={tratarError}
          alRecargar={recargar}
          alGuardar={(respuesta) => {
            establecerRecepcion(respuesta);
            modal.closeModal();
            notificar(t(accion === "confirmar" ? "confirmada" : "cancelada"));
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

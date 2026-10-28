"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { useModal } from "@/hooks/useModal";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import FormularioCompra from "./FormularioCompra";
import DetalleCompra from "./DetalleCompra";
import ConfirmarAccionCompra from "./ConfirmarAccionCompra";
import useAvisosCompras from "./useAvisosCompras";
import { clasePanel, type Compra } from "./tipos";

export default function FichaCompra({
  sesion,
  identificador,
  modo,
}: {
  sesion: Sesion;
  identificador?: string;
  modo: "nuevo" | "editar" | "detalle";
}) {
  const t = useTranslations("compras");
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosCompras(
    modo === "detalle",
  );
  const [compra, establecerCompra] = useState<Compra | null>(null);
  const [cargando, establecerCargando] = useState(!!identificador);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const [accion, establecerAccion] = useState<"registrar" | "cancelar">(
    "registrar",
  );
  const modal = useModal();
  const permisos = sesion.permisos_compras;
  const permitido =
    permisos.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "editar"
        ? permisos.editar
        : true);
  useEffect(() => {
    if (!identificador || !permitido) return;
    const controlador = new AbortController();
    void api<Compra>(`compras/${identificador}/`, {
      signal: controlador.signal,
    })
      .then((respuesta) => {
        if (!controlador.signal.aborted) {
          establecerCompra(respuesta);
          establecerFallo("");
          establecerCargando(false);
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          establecerFallo(
            t(
              error instanceof ErrorApi && error.status === 404
                ? "noEncontrada"
                : "errorCarga",
            ),
          );
          establecerCargando(false);
          tratarError(error);
        }
      });
    return () => controlador.abort();
  }, [identificador, permitido, revision, t, tratarError]);
  const recargar = () => {
    modal.closeModal();
    establecerFallo("");
    establecerCargando(true);
    establecerRevision((valor) => valor + 1);
  };
  return (
    <>
      {!permitido ? (
        <div role="alert" className={`${clasePanel} p-8 text-center`}>
          <h1 className="font-semibold text-gray-900 dark:text-white">
            {t("restringido")}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {t("accesoDenegado")}
          </p>
        </div>
      ) : fallo ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p className="text-sm text-error-600 dark:text-error-400">{fallo}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="outline" onClick={recargar}>
              {t("reintentar")}
            </Button>
            <Link
              href="/compras"
              className="text-sm text-brand-600 dark:text-brand-300"
            >
              {t("volver")}
            </Link>
          </div>
        </div>
      ) : cargando ? (
        <p
          role="status"
          className={`${clasePanel} p-10 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </p>
      ) : modo === "editar" && compra?.estado !== "borrador" ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p className="text-sm text-gray-700 dark:text-gray-200">
            {t("soloBorrador")}
          </p>
          <Link
            href={`/compras/${identificador}`}
            className="text-sm text-brand-600 dark:text-brand-300"
          >
            {t("verCompra")}
          </Link>
        </div>
      ) : modo === "detalle" && compra ? (
        <DetalleCompra
          compra={compra}
          permisos={permisos}
          permisosRecepciones={sesion.permisos_recepciones}
          alAccion={(valor) => {
            establecerAccion(valor);
            modal.openModal();
          }}
        />
      ) : (
        <FormularioCompra
          key={compra?.version || "nueva"}
          compra={compra}
          alError={tratarError}
          alRecargar={recargar}
          puedeRegistrar={permisos.registrar}
          puedeEditar={permisos.editar}
        />
      )}
      {modal.isOpen && compra && (
        <ConfirmarAccionCompra
          key={`${accion}-${compra.version}`}
          compra={compra}
          accion={accion}
          alCerrar={modal.closeModal}
          alRecargar={recargar}
          alError={tratarError}
          alGuardar={(respuesta) => {
            establecerCompra(respuesta);
            modal.closeModal();
            notificar(t(accion === "registrar" ? "registrada" : "cancelada"));
          }}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}

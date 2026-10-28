"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { clasePanel } from "@/components/compras/tipos";
import type { Session as Sesion } from "@/components/users/types";
import {
  claseEnlaceInventario,
  type Lote,
  type MovimientoInventario,
} from "./tipos";
import useAvisosInventario from "./useAvisosInventario";
import DetalleLote from "./DetalleLote";
import DetalleMovimiento from "./DetalleMovimiento";

export default function FichaInventario({
  sesion,
  tipo,
  identificador,
}: {
  sesion: Sesion;
  tipo: "lotes" | "movimientos";
  identificador: string;
}) {
  const t = useTranslations("inventario");
  const { avisos, notificar, cerrarAviso, tratarError } = useAvisosInventario();
  const [registro, establecerRegistro] = useState<
    Lote | MovimientoInventario
  >();
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  const permitido =
    tipo === "lotes"
      ? sesion.permisos_inventario?.ver_lotes
      : sesion.permisos_inventario?.ver_movimientos;
  const recargar = () => {
    establecerRegistro(undefined);
    establecerFallo(false);
    establecerRevision((valor) => valor + 1);
  };
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    api<Lote | MovimientoInventario>(`inventario/${tipo}/${identificador}/`, {
      signal: controlador.signal,
    })
      .then((datos) => {
        if (!controlador.signal.aborted) establecerRegistro(datos);
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          establecerFallo(true);
          tratarError(error);
        }
      });
    return () => controlador.abort();
  }, [tipo, identificador, permitido, revision, tratarError]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href={tipo === "lotes" ? "/lotes" : "/movimientos-inventario"}
        className={claseEnlaceInventario}
      >
        {t("volverListado")}
      </Link>
      <MigasPagina
        pageTitle={
          registro?.codigo ||
          t(tipo === "lotes" ? "lotesTitulo" : "movimientosTitulo")
        }
      />
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
      ) : !registro ? (
        <p
          role="status"
          className={`${clasePanel} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </p>
      ) : "saldo" in registro ? (
        <DetalleLote
          key={registro.version}
          lote={registro}
          sesion={sesion}
          alGuardar={(datos) => {
            establecerRegistro(datos);
            notificar(t("estadoGuardado"));
          }}
          alError={tratarError}
          alRecargar={recargar}
        />
      ) : (
        <DetalleMovimiento movimiento={registro} sesion={sesion} />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

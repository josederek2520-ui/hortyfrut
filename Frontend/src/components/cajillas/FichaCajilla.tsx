"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import {
  clasePanel,
  type PaginaCompra as Pagina,
} from "@/components/compras/tipos";
import { claseEnlaceInventario } from "@/components/inventario/tipos";
import type { Session as Sesion } from "@/components/users/types";
import useAvisosCajillas from "./useAvisosCajillas";
import DetalleCajilla from "./DetalleCajilla";
import FormularioColorCajilla from "./FormularioColorCajilla";
import FormularioMovimientoCajilla from "./FormularioMovimientoCajilla";
import {
  puedeMoverCajillas,
  type Cajilla,
  type TipoMovimientoCajilla,
  type UbicacionCajillas,
} from "./tipos";

export default function FichaCajilla({
  sesion,
  modo,
  identificador,
  tipo = "ingreso",
  sucursalInicial,
}: {
  sesion: Sesion;
  modo: "nuevo" | "detalle" | "movimiento";
  identificador?: string;
  tipo?: TipoMovimientoCajilla;
  sucursalInicial?: number;
}) {
  const t = useTranslations("cajillas");
  const { avisos, cerrarAviso, notificar, tratarError } = useAvisosCajillas();
  const permisos = sesion.permisos_cajillas;
  const permitido =
    !!permisos?.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "movimiento"
        ? puedeMoverCajillas(permisos, tipo)
        : true);
  const [cajilla, establecerCajilla] = useState<Cajilla>();
  const [sucursal, establecerSucursal] = useState<UbicacionCajillas>();
  const [fallo, establecerFallo] = useState(false);
  const [revision, establecerRevision] = useState(0);
  useEffect(() => {
    if (!permitido || modo === "nuevo") return;
    const controlador = new AbortController();
    const cargar = async () => {
      try {
        const [color, opciones] = await Promise.all([
          api<Cajilla>(`cajillas/${identificador}/`, {
            signal: controlador.signal,
          }),
          modo === "movimiento" && tipo === "devolucion" && sucursalInicial
            ? api<Pagina<UbicacionCajillas>>(
                `cajillas/sucursales/?operacion=devolucion&cajilla=${identificador}&sucursal=${sucursalInicial}`,
                { signal: controlador.signal },
              )
            : Promise.resolve(undefined),
        ]);
        if (!controlador.signal.aborted) {
          establecerCajilla(color);
          establecerSucursal(opciones?.results[0]);
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
  }, [
    permitido,
    modo,
    identificador,
    tipo,
    sucursalInicial,
    revision,
    tratarError,
  ]);
  useEffect(() => {
    if (modo !== "detalle") return;
    const temporizador = window.setTimeout(() => {
      const aviso = sessionStorage.getItem("cajillas:aviso");
      if (aviso === "colorGuardado" || aviso === "movimientoGuardado") {
        sessionStorage.removeItem("cajillas:aviso");
        notificar(t(aviso));
      }
    }, 0);
    return () => window.clearTimeout(temporizador);
  }, [modo, notificar, t]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {modo === "detalle" && (
        <Link href="/cajillas" className={claseEnlaceInventario}>
          {t("volverListado")}
        </Link>
      )}
      <MigasPagina
        pageTitle={t(
          modo === "nuevo"
            ? "nuevoColor"
            : modo === "movimiento"
              ? "nuevoMovimiento"
              : "detalle",
        )}
      />
      {!permitido ? (
        <p role="alert" className={`${clasePanel} p-8`}>
          {t("restringido")}
        </p>
      ) : modo === "nuevo" ? (
        <FormularioColorCajilla
          puedeIngresar={permisos.ingresar}
          alError={tratarError}
        />
      ) : fallo ? (
        <div role="alert" className={`${clasePanel} space-y-4 p-8`}>
          <p>{t("errorCarga")}</p>
          <Button
            variant="outline"
            onClick={() => {
              establecerFallo(false);
              establecerCajilla(undefined);
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentar")}
          </Button>
        </div>
      ) : !cajilla ? (
        <p
          role="status"
          className={`${clasePanel} p-8 text-center text-sm text-gray-500 dark:text-gray-400`}
        >
          {t("cargando")}
        </p>
      ) : modo === "movimiento" ? (
        <FormularioMovimientoCajilla
          key={`${cajilla.version}-${tipo}`}
          cajilla={cajilla}
          tipo={tipo}
          sucursalInicial={sucursal}
          alError={tratarError}
        />
      ) : (
        <DetalleCajilla
          key={cajilla.version}
          cajilla={cajilla}
          permisos={permisos}
          alError={tratarError}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

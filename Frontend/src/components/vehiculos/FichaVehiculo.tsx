"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft as IconoVolver } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Session as Sesion } from "@/components/users/types";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import useAvisosLogistica from "@/components/logistica/useAvisosLogistica";
import useConsultaLogistica from "@/components/logistica/useConsultaLogistica";
import EstadoConsulta from "@/components/logistica/EstadoConsultaLogistica";
import Confirmacion from "@/components/logistica/ConfirmacionLogistica";
import { api, ApiError as ErrorApi } from "@/lib/api";
import FormularioVehiculo from "./FormularioVehiculo";
import DetalleVehiculo from "./DetalleVehiculo";
import type { Vehiculo } from "./tipos";

export default function FichaVehiculo({
  sesion,
  modo,
  identificador,
}: {
  sesion: Sesion;
  modo: "nuevo" | "editar" | "detalle";
  identificador?: string;
}) {
  const t = useTranslations("vehiculos");
  const comun = useTranslations("logistica");
  const avisos = useAvisosLogistica();
  const permisos = sesion.permisos_vehiculos;
  const consulta = useConsultaLogistica<Vehiculo>(
    identificador && permisos.ver ? `vehiculos/${identificador}/` : null,
    avisos.tratarError,
  );
  const [confirmar, establecerConfirmar] = useState(false);
  const [ocupado, establecerOcupado] = useState(false);
  const [error, establecerError] = useState("");
  const vehiculo = consulta.datos;
  const autorizado =
    permisos.ver &&
    (modo === "nuevo"
      ? permisos.crear
      : modo === "editar"
        ? permisos.editar
        : true);
  const cambiarEstado = async () => {
    if (!vehiculo || ocupado) return;
    establecerOcupado(true);
    try {
      consulta.establecerDatos(
        await api<Vehiculo>(`vehiculos/${vehiculo.id}/estado/`, {
          method: "POST",
          body: JSON.stringify({
            activo: !vehiculo.activo,
            version: vehiculo.version,
          }),
        }),
      );
      establecerConfirmar(false);
      avisos.notificar(comun("guardado"));
    } catch (problema) {
      establecerError(
        comun(
          problema instanceof ErrorApi && problema.status === 409
            ? "conflicto"
            : "errorOperacion",
        ),
      );
      avisos.tratarError(problema);
    } finally {
      establecerOcupado(false);
    }
  };
  return (
    <>
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/vehiculos"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-gray-500 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {t("volver")}
        </Link>
        <div>
          <MigasPagina
            pageTitle={
              modo === "nuevo"
                ? t("nuevo")
                : modo === "editar"
                  ? t("editar")
                  : t("ficha")
            }
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t(modo === "detalle" ? "subtituloDetalle" : "subtituloFormulario")}
          </p>
        </div>
        {!autorizado ? (
          <p role="alert">{comun("sinPermiso")}</p>
        ) : modo !== "nuevo" &&
          (consulta.cargando || consulta.fallo || !vehiculo) ? (
          <EstadoConsulta
            cargando={consulta.cargando}
            fallo={consulta.fallo}
            alRecargar={consulta.recargar}
          />
        ) : modo !== "detalle" ? (
          <FormularioVehiculo
            key={vehiculo?.version || "nuevo"}
            vehiculo={vehiculo || undefined}
            alError={avisos.tratarError}
          />
        ) : (
          vehiculo && (
            <DetalleVehiculo
              vehiculo={vehiculo}
              puedeEditar={permisos.editar}
              puedeCambiarEstado={permisos.cambiar_estado}
              alCambiarEstado={() => {
                establecerError("");
                establecerConfirmar(true);
              }}
            />
          )
        )}
        {error && !confirmar && (
          <Button size="sm" variant="outline" onClick={consulta.recargar}>
            {comun("recargar")}
          </Button>
        )}
      </div>
      {confirmar && vehiculo && (
        <Confirmacion
          titulo={t(vehiculo.activo ? "desactivar" : "activar")}
          descripcion={t("confirmarEstado", { placa: vehiculo.placa })}
          accion={t(vehiculo.activo ? "desactivar" : "activar")}
          ocupado={ocupado}
          error={error}
          alCerrar={() => {
            establecerConfirmar(false);
            if (error) consulta.recargar();
          }}
          alConfirmar={() => void cambiarEstado()}
        />
      )}
      <Notificaciones toasts={avisos.avisos} onDismiss={avisos.cerrarAviso} />
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft as IconoVolver, Plus as IconoAgregar } from "lucide-react";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import { clasePanel } from "@/components/compras/tipos";
import type { Session as Sesion } from "@/components/users/types";
import useAvisosPreparaciones from "./useAvisosPreparaciones";
import JornadaPreparacion from "./JornadaPreparacion";
import ListadoJornadasPreparacion from "./ListadoJornadasPreparacion";
import DetalleJornadaPreparacion from "./DetalleJornadaPreparacion";
import DialogoTrabajoPreparacion from "./DialogoTrabajoPreparacion";
import VistaAnimadaPreparacion from "./VistaAnimadaPreparacion";
import type {
  EstadoTrabajoPreparacion,
  JornadaAgrupadaPreparacion,
} from "./tipos";
import estilos from "./estilosTrabajo.module.css";

export default function GestionPreparaciones({
  sesion,
  clienteInicial,
  fechaInicial,
}: {
  sesion: Sesion;
  historial?: boolean;
  clienteInicial?: number;
  fechaInicial?: string;
}) {
  const t = useTranslations("preparaciones");
  const { avisos, cerrarAviso, tratarError, notificar } =
    useAvisosPreparaciones();
  const [vista, establecerVista] = useState<"listado" | "grupo" | "jornada">(
    clienteInicial && fechaInicial ? "grupo" : "listado",
  );
  const [seleccion, establecerSeleccion] = useState<{
    cliente: number;
    fecha: string;
  } | null>(
    clienteInicial && fechaInicial
      ? { cliente: clienteInicial, fecha: fechaInicial }
      : null,
  );
  const [revision, establecerRevision] = useState(0);
  const [estadoTrabajo, establecerEstadoTrabajo] =
    useState<EstadoTrabajoPreparacion>({ modificado: false, guardando: false });
  const [confirmarSalida, establecerConfirmarSalida] = useState(false);
  const permisos = sesion.permisos_preparaciones;
  useEffect(() => {
    try {
      const aviso = sessionStorage.getItem("preparaciones:aviso");
      if (aviso === "confirmada" || aviso === "guardada") {
        sessionStorage.removeItem("preparaciones:aviso");
        notificar(t(aviso));
      }
    } catch {
      /* Las notificaciones no bloquean el listado. */
    }
  }, [notificar, t]);
  useEffect(() => {
    const cuadro = requestAnimationFrame(() => {
      const id =
        vista === "listado"
          ? "titulo-listado-jornadas"
          : vista === "grupo"
            ? "titulo-grupo-preparacion"
            : "titulo-iniciar-preparacion";
      document.getElementById(id)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [vista]);
  const regresar = () => {
    establecerVista("listado");
    establecerRevision((valor) => valor + 1);
    establecerEstadoTrabajo({ modificado: false, guardando: false });
    establecerConfirmarSalida(false);
  };
  const volver = () => {
    if (estadoTrabajo.guardando) return;
    if (vista === "jornada" && estadoTrabajo.modificado)
      establecerConfirmarSalida(true);
    else regresar();
  };
  const abrirGrupo = (grupo: JornadaAgrupadaPreparacion) => {
    establecerSeleccion({ cliente: grupo.cliente, fecha: grupo.fecha_pedidos });
    establecerVista("grupo");
  };
  const preparar = (grupo?: JornadaAgrupadaPreparacion) => {
    establecerSeleccion(
      grupo ? { cliente: grupo.cliente, fecha: grupo.fecha_pedidos } : null,
    );
    establecerEstadoTrabajo({ modificado: false, guardando: false });
    establecerVista("jornada");
  };
  if (!permisos?.ver)
    return (
      <p role="alert" className={`${clasePanel} p-8`}>
        {t("restringido")}
      </p>
    );
  return (
    <div className={`${estilos.trabajo} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {vista === "jornada" ? (
          <h1
            id="titulo-iniciar-preparacion"
            tabIndex={-1}
            className="text-xl font-semibold text-gray-900 outline-none dark:text-white"
          >
            {t("titulo")}
          </h1>
        ) : (
          <div className="[&>div]:mb-0">
            <MigasPagina pageTitle={t("titulo")} />
          </div>
        )}
        {vista !== "listado" && (
          <button
            type="button"
            disabled={estadoTrabajo.guardando}
            onClick={volver}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 disabled:opacity-50 dark:text-brand-300"
          >
            <IconoVolver className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t("volverListadoJornadas")}
          </button>
        )}
        {vista === "listado" && permisos.crear && (
          <Button
            size="sm"
            onClick={() => preparar()}
            startIcon={<IconoAgregar className="size-4" aria-hidden="true" />}
          >
            {t("prepararPedidosJornada")}
          </Button>
        )}
      </div>
      <VistaAnimadaPreparacion
        visible={vista === "listado"}
        clave="listado-jornadas"
      >
        <ListadoJornadasPreparacion
          permisos={permisos}
          activo={vista === "listado"}
          revision={revision}
          alAbrir={abrirGrupo}
          alPreparar={preparar}
          alError={tratarError}
        />
      </VistaAnimadaPreparacion>
      {vista === "grupo" && seleccion && (
        <VistaAnimadaPreparacion
          visible
          clave={`grupo-${seleccion.cliente}-${seleccion.fecha}`}
        >
          <DetalleJornadaPreparacion
            cliente={seleccion.cliente}
            fecha={seleccion.fecha}
            permisos={permisos}
            alPreparar={preparar}
            alError={tratarError}
          />
        </VistaAnimadaPreparacion>
      )}
      {vista === "jornada" && (
        <VistaAnimadaPreparacion visible clave="preparar-jornada">
          <JornadaPreparacion
            clienteInicial={seleccion?.cliente}
            fechaInicial={seleccion?.fecha}
            puedeCrear={permisos.crear}
            puedeEditar={permisos.editar}
            puedeConfirmar={permisos.confirmar}
            alEstadoTrabajo={establecerEstadoTrabajo}
            alVolverListado={regresar}
            alConfirmada={() => {
              notificar(t("confirmada"));
              regresar();
            }}
            alError={tratarError}
          />
        </VistaAnimadaPreparacion>
      )}
      {confirmarSalida && (
        <DialogoTrabajoPreparacion
          tipo="volver"
          ocupado={estadoTrabajo.guardando}
          alCerrar={() => establecerConfirmarSalida(false)}
          alConfirmar={regresar}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

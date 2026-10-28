"use client";
import { useTranslations } from "next-intl";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import type { Session as Sesion } from "@/components/users/types";
import GestionDirectorio from "./GestionDirectorio";
import useAvisosClientes from "./useAvisosClientes";

export default function GestionClientes({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("clientes");
  const { avisos, notificar, cerrarAviso, tratarError } =
    useAvisosClientes(true);
  return (
    <>
      <div className="space-y-6">
        <div>
          <MigasPagina pageTitle={t("titulo")} />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        <GestionDirectorio
          permisos={sesion.permisos_clientes}
          alError={tratarError}
          alNotificar={notificar}
        />
      </div>
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </>
  );
}

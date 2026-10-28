"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { useToast as useNotificaciones } from "@/hooks/useToast";
import Notificaciones from "@/components/ui/toast/ToastViewport";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import {
  ChevronLeftIcon as IconoVolver,
  LockIcon as IconoCandado,
} from "@/icons";
import FormularioRol from "./FormularioRol";
import type { Session as Sesion } from "@/components/users/types";
import type {
  RoleDetail as DatosRol,
  PermissionModule as ModuloPermisos,
} from "./types";

export default function VistaRol({
  sesion,
  identificador,
}: {
  sesion: Sesion;
  identificador?: string;
}) {
  const t = useTranslations("roles");
  const textos = useTranslations("editorRoles");
  const navegador = useRouter();
  const {
    toasts: avisos,
    notify: notificar,
    dismiss: cerrarAviso,
  } = useNotificaciones();
  const [datos, establecerDatos] = useState<{
    rol: DatosRol | null;
    modulos: ModuloPermisos[];
  } | null>(null);
  const [fallo, establecerFallo] = useState("");
  const [revision, establecerRevision] = useState(0);
  const permitido = identificador
    ? sesion.role_capabilities.edit && sesion.role_capabilities.view
    : sesion.role_capabilities.create;
  const tratarError = useCallback(
    (error: unknown) => {
      if (error instanceof ErrorApi && error.status === 401) {
        navegador.replace("/signin");
        navegador.refresh();
        return;
      }
      notificar(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflict"
            : error instanceof ErrorApi && error.status === 403
              ? "forbiddenDescription"
              : error instanceof ErrorApi && error.status === 400
                ? "validationError"
                : "requestError",
        ),
        "error",
      );
    },
    [navegador, notificar, t],
  );
  useEffect(() => {
    if (!permitido) return;
    const controlador = new AbortController();
    Promise.all([
      api<ModuloPermisos[]>("permisos/", { signal: controlador.signal }),
      identificador
        ? api<DatosRol>(`roles/${identificador}/`, {
            signal: controlador.signal,
          })
        : Promise.resolve(null),
    ])
      .then(([modulos, rol]) => {
        if (!controlador.signal.aborted) {
          establecerFallo("");
          establecerDatos({ modulos, rol });
        }
      })
      .catch((error) => {
        if (!controlador.signal.aborted) {
          establecerFallo(
            error instanceof ErrorApi && error.status === 404
              ? textos("noEncontrado")
              : t("loadError"),
          );
          tratarError(error);
        }
      });
    return () => controlador.abort();
  }, [identificador, permitido, revision, t, textos, tratarError]);
  const guardar = () => {
    sessionStorage.setItem(
      "roles:notificacion",
      identificador ? "updated" : "created",
    );
    window.dispatchEvent(new Event("hortyfru:session-changed"));
    navegador.push("/roles");
    navegador.refresh();
  };
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/roles"
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {textos("volver")}
        </Link>
        <MigasPagina pageTitle={t(identificador ? "editTitle" : "newRole")} />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {textos("subtitulo")}
        </p>
      </div>
      {!permitido || (datos?.rol && !datos.rol.gestion.edit) ? (
        <div className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-800 dark:bg-gray-900">
          <IconoCandado className="mx-auto mb-4 size-8 text-gray-400" />
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {t("forbidden")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {datos?.rol?.gestion.reason
              ? t(`reasons.${datos.rol.gestion.reason}`)
              : t("forbiddenDescription")}
          </p>
        </div>
      ) : fallo ? (
        <div
          role="alert"
          className="space-y-4 rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
        >
          <p>{fallo}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => establecerRevision((valor) => valor + 1)}
          >
            {t("retry")}
          </Button>
        </div>
      ) : !datos ? (
        <p
          role="status"
          className="superficie-cristal rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
        >
          {t("loading")}
        </p>
      ) : (
        <FormularioRol
          key={identificador || "nuevo"}
          rol={datos.rol}
          modulos={datos.modulos}
          alCancelar={() => navegador.push("/roles")}
          alGuardar={guardar}
          alRecargar={() => {
            establecerDatos(null);
            establecerRevision((valor) => valor + 1);
          }}
          alError={tratarError}
        />
      )}
      <Notificaciones toasts={avisos} onDismiss={cerrarAviso} />
    </div>
  );
}

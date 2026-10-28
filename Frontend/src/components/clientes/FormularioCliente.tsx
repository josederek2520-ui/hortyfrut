"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import { IconoCliente, ChevronLeftIcon as IconoVolver } from "@/icons";
import { api, ApiError as ErrorApi } from "@/lib/api";
import { useFormValidation as useValidacion } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarInvalido } from "@/lib/form-validation";
import CampoDirectorio from "./CampoDirectorio";
import type { Cliente } from "./tipos";

export default function FormularioCliente({
  cliente,
  alError,
  alRecargar,
}: {
  cliente: Cliente | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("clientes");
  const navegador = useRouter();
  const iniciales = {
    razon_social: cliente?.razon_social || "",
    nit: cliente?.nit || "",
    telefono: cliente?.telefono || "",
    email: cliente?.email || "",
  };
  const [datos, establecerDatos] = useState(iniciales);
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacion();
  const modificado = Object.keys(datos).some(
    (clave) =>
      datos[clave as keyof typeof datos] !==
      iniciales[clave as keyof typeof iniciales],
  );
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const cancelar = () => {
    if (!modificado || window.confirm(t("descartar")))
      navegador.push(cliente ? `/clientes/${cliente.id}` : "/clientes");
  };
  const cambiar = (entrada: HTMLInputElement) => {
    establecerDatos((actual) => ({ ...actual, [entrada.name]: entrada.value }));
    cambiarCampo(entrada);
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    const formulario = evento.currentTarget;
    if (!validarFormulario(formulario)) {
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    try {
      const guardado = await api<Cliente>(
        cliente ? `clientes/${cliente.id}/` : "clientes/",
        {
          method: cliente ? "PATCH" : "POST",
          body: JSON.stringify({
            ...datos,
            ...(cliente ? { version: cliente.version } : {}),
          }),
        },
      );
      try {
        sessionStorage.setItem(
          "clientes:aviso",
          cliente ? "clienteEditado" : "clienteCreado",
        );
      } catch {
        /* El registro ya se guardó. */
      }
      navegador.push(`/clientes/${guardado.id}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarInvalido(formulario);
      }
      establecerConflicto(error instanceof ErrorApi && error.status === 409);
      establecerFallo(
        t(
          error instanceof ErrorApi && error.status === 409
            ? "conflicto"
            : error instanceof ErrorApi && error.status === 400
              ? "validacion"
              : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      establecerGuardando(false);
    }
  };
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={cancelar}
          className="mb-5 inline-flex min-h-10 items-center gap-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4 rtl:rotate-180" />
          {t(cliente ? "volverFicha" : "volver")}
        </button>
        <MigasPagina
          pageTitle={t(cliente ? "editarCliente" : "nuevoCliente")}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("ayudaFormularioCliente")}
        </p>
      </div>
      <form
        noValidate
        onSubmit={enviar}
        aria-busy={guardando}
        className="superficie-cristal rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-800">
          <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
            <IconoCliente className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("datosCliente")}
            </h2>
            <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("obligatorios")}
            </p>
          </div>
        </div>
        <div className="space-y-6 p-6 sm:p-8">
          {fallo && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-4 text-sm text-error-600 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400"
            >
              <p>{fallo}</p>
              {conflicto && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    if (window.confirm(t("confirmarRecarga"))) alRecargar();
                  }}
                >
                  {t("recargar")}
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <CampoDirectorio
                id="cliente-razon"
                etiqueta={t("razonSocial")}
                name="razon_social"
                required
                maxLength={150}
                value={datos.razon_social}
                disabled={guardando}
                errores={errores.razon_social}
                autoComplete="organization"
                placeholder={t("ejemploRazonSocial")}
                onChange={(evento) => cambiar(evento.currentTarget)}
                onBlur={(evento) => salirCampo(evento.currentTarget)}
              />
            </div>
            <CampoDirectorio
              id="cliente-nit"
              etiqueta={t("nit")}
              name="nit"
              required
              maxLength={20}
              value={datos.nit}
              disabled={guardando}
              errores={errores.nit}
              inputMode="numeric"
              pattern="[0-9]+"
              ayuda={t("ayudaNit")}
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <CampoDirectorio
              id="cliente-telefono"
              etiqueta={t("telefono")}
              name="telefono"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={30}
              value={datos.telefono}
              disabled={guardando}
              errores={errores.telefono}
              ayuda={t("ayudaTelefono")}
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
            <CampoDirectorio
              id="cliente-email"
              etiqueta={t("email")}
              name="email"
              type="email"
              maxLength={150}
              autoComplete="email"
              value={datos.email}
              disabled={guardando}
              errores={errores.email}
              placeholder="contacto@empresa.com"
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
          </div>
          <p className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
            {t(cliente ? "estadoDesdeListado" : "sucursalesDespues")}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 px-6 py-5 dark:border-gray-800">
          <Button
            size="sm"
            variant="outline"
            disabled={guardando}
            onClick={cancelar}
          >
            {t("cancelar")}
          </Button>
          <Button size="sm" type="submit" disabled={guardando || conflicto}>
            {t(
              guardando
                ? "guardando"
                : cliente
                  ? "guardarCambios"
                  : "crearCliente",
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

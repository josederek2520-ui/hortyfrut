"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Store as IconoProveedor,
  CalendarDays as IconoFecha,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import { focusInvalidField as enfocarCampoInvalido } from "@/lib/form-validation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import SelectorCategoriaProveedor from "./SelectorCategoriaProveedor";
import { clasePanel, type Proveedor, type CategoriaProveedor } from "./tipos";

export default function FormularioProveedor({
  proveedor,
  alError,
  alRecargar,
}: {
  proveedor: Proveedor | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("proveedores");
  const idioma = useLocale();
  const navegador = useRouter();
  const [datos, establecerDatos] = useState({
    nombre: proveedor?.nombre || "",
    telefono: proveedor?.telefono || "",
    direccion: proveedor?.direccion || "",
  });
  const [categoria, establecerCategoria] = useState<CategoriaProveedor | null>(
    proveedor?.categoria || null,
  );
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const modificado =
    datos.nombre !== (proveedor?.nombre || "") ||
    datos.telefono !== (proveedor?.telefono || "") ||
    datos.direccion !== (proveedor?.direccion || "") ||
    (categoria?.id || null) !== (proveedor?.categoria?.id || null);
  useEffect(() => {
    if (!modificado) return;
    const avisarSalida = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisarSalida);
    return () => window.removeEventListener("beforeunload", avisarSalida);
  }, [modificado]);
  const cancelar = () => {
    if (!modificado || window.confirm(t("descartar")))
      navegador.push(
        proveedor ? `/proveedores/${proveedor.id}` : "/proveedores",
      );
  };
  const cambiar = (control: HTMLInputElement) => {
    establecerDatos((anteriores) => ({
      ...anteriores,
      [control.name]: control.value,
    }));
    cambiarCampo(control);
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    const formulario = evento.currentTarget;
    if (!validarFormulario(formulario)) {
      enfocarCampoInvalido(formulario);
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    try {
      const guardado = await api<Proveedor>(
        proveedor ? `proveedores/${proveedor.id}/` : "proveedores/",
        {
          method: proveedor ? "PATCH" : "POST",
          body: JSON.stringify({
            nombre: datos.nombre.trim(),
            telefono: datos.telefono.trim(),
            direccion: datos.direccion.trim(),
            categoria: categoria?.id || null,
            ...(proveedor ? { version: proveedor.version } : {}),
          }),
        },
      );
      try {
        sessionStorage.setItem(
          "proveedores:aviso",
          proveedor ? "editado" : "creado",
        );
      } catch {
        /* La ficha sigue disponible sin almacenamiento local. */
      }
      navegador.push(`/proveedores/${guardado.id}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        enfocarCampoInvalido(formulario);
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
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button
          type="button"
          disabled={guardando}
          onClick={cancelar}
          className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
        >
          <IconoVolver className="size-4" aria-hidden="true" />
          {t(proveedor ? "volverFicha" : "volver")}
        </button>
        <MigasPagina
          pageTitle={t(proveedor ? "editarProveedor" : "nuevoProveedor")}
        />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t("subtituloFormulario")}
        </p>
      </div>
      <form
        noValidate
        onSubmit={enviar}
        aria-busy={guardando}
        className={clasePanel}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-800">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            <IconoProveedor className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("datosProveedor")}
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
          <CampoDirectorio
            id="proveedor-nombre"
            etiqueta={t("nombre")}
            name="nombre"
            required
            maxLength={150}
            value={datos.nombre}
            disabled={guardando}
            errores={errores.nombre}
            autoComplete="organization"
            placeholder={t("ejemploNombre")}
            onChange={(evento) => cambiar(evento.currentTarget)}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <SelectorCategoriaProveedor
                valor={categoria}
                alCambiar={(valor) => {
                  establecerCategoria(valor);
                  establecerErrores((anteriores) => ({
                    ...anteriores,
                    categoria: [],
                  }));
                }}
                deshabilitado={guardando}
                error={errores.categoria?.join(" ")}
                alError={alError}
              />
              <p className="mt-1.5 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
                {t("categoriaOpcional")}
              </p>
            </div>
            <CampoDirectorio
              id="proveedor-telefono"
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
              autoComplete="tel"
              onChange={(evento) => cambiar(evento.currentTarget)}
              onBlur={(evento) => salirCampo(evento.currentTarget)}
            />
          </div>
          <CampoDirectorio
            id="proveedor-direccion"
            etiqueta={t("direccion")}
            name="direccion"
            maxLength={255}
            value={datos.direccion}
            disabled={guardando}
            errores={errores.direccion}
            autoComplete="street-address"
            placeholder={t("ejemploDireccion")}
            onChange={(evento) => cambiar(evento.currentTarget)}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
          />
          {proveedor ? (
            <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
              <IconoFecha
                className="mt-0.5 size-4 shrink-0 text-gray-400"
                aria-hidden="true"
              />
              <div>
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  {t("fechaCreacion")}
                </p>
                <time
                  dateTime={proveedor.creado_en}
                  className="mt-1 block text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/La_Paz",
                  }).format(new Date(proveedor.creado_en))}
                </time>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-brand-50 p-4 text-sm leading-6 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {t("ayudaCreacion")}
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-5 sm:flex-row sm:justify-end dark:border-gray-800">
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
                : proveedor
                  ? "guardarCambios"
                  : "crearProveedor",
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

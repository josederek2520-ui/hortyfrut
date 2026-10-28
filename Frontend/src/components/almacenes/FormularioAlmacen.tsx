"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowLeft as IconoVolver,
  Warehouse as IconoAlmacen,
  MapPin as IconoUbicacion,
  CalendarDays as IconoFecha,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import MigasPagina from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import { useModal } from "@/hooks/useModal";
import { useFormValidation as useValidacionFormulario } from "@/hooks/useFormValidation";
import {
  focusInvalidField as enfocarCampoInvalido,
  type FieldErrors as ErroresCampos,
} from "@/lib/form-validation";
import { api, ApiError as ErrorApi } from "@/lib/api";
import ConfirmarDescartarAlmacen from "./ConfirmarDescartarAlmacen";
import UbicacionAlmacen from "./UbicacionAlmacen";
import { enlaceMapa } from "./ubicacion";
import { clasePanel, type Almacen } from "./tipos";

export default function FormularioAlmacen({
  almacen,
  alError,
  alRecargar,
}: {
  almacen: Almacen | null;
  alError: (error: unknown) => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("almacenes"),
    idioma = useLocale();
  const navegador = useRouter();
  const [datos, establecerDatos] = useState({
    nombre: almacen?.nombre || "",
    direccion: almacen?.direccion || "",
    latitud: almacen?.latitud ?? "",
    longitud: almacen?.longitud ?? "",
  });
  const [guardando, establecerGuardando] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const [modoSalida, establecerModoSalida] = useState<"salir" | "recargar">(
    "salir",
  );
  const modalSalida = useModal();
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validarFormulario,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useValidacionFormulario();
  const modificado =
    datos.nombre !== (almacen?.nombre || "") ||
    datos.direccion !== (almacen?.direccion || "") ||
    datos.latitud !== (almacen?.latitud ?? "") ||
    datos.longitud !== (almacen?.longitud ?? "");
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const volver = () =>
    navegador.push(almacen ? `/almacenes/${almacen.id}` : "/almacenes");
  const descartar = (modo: "salir" | "recargar") => {
    establecerModoSalida(modo);
    modalSalida.openModal();
  };
  const cancelar = () => {
    if (modificado) descartar("salir");
    else volver();
  };
  const cambiar = (control: HTMLInputElement) => {
    const siguientes = { ...datos, [control.name]: control.value };
    establecerDatos((anteriores) => ({
      ...anteriores,
      [control.name]: control.value,
    }));
    cambiarCampo(control);
    if (
      (control.name === "latitud" || control.name === "longitud") &&
      !!siguientes.latitud.trim() === !!siguientes.longitud.trim()
    ) {
      establecerErrores((anteriores) => ({
        ...anteriores,
        latitud:
          anteriores.latitud?.filter(
            (mensaje) => mensaje !== t("coordenadasCompletas"),
          ) || [],
        longitud:
          anteriores.longitud?.filter(
            (mensaje) => mensaje !== t("coordenadasCompletas"),
          ) || [],
      }));
    }
  };
  const enviar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    const formulario = evento.currentTarget;
    const problemas: ErroresCampos = {};
    if (!!datos.latitud.trim() !== !!datos.longitud.trim()) {
      problemas.latitud = [t("coordenadasCompletas")];
      problemas.longitud = [t("coordenadasCompletas")];
    }
    for (const campo of ["latitud", "longitud"] as const) {
      if (!datos[campo].trim()) continue;
      const numero = Number(datos[campo]),
        limite = campo === "latitud" ? 90 : 180;
      if (!Number.isFinite(numero) || numero < -limite || numero > limite)
        problemas[campo] = [
          t(campo === "latitud" ? "latitudInvalida" : "longitudInvalida"),
        ];
    }
    if (!validarFormulario(formulario, problemas)) {
      enfocarCampoInvalido(formulario);
      alError(new ErrorApi(400));
      return;
    }
    establecerGuardando(true);
    establecerFallo("");
    try {
      const guardado = await api<Almacen>(
        almacen ? `almacenes/${almacen.id}/` : "almacenes/",
        {
          method: almacen ? "PATCH" : "POST",
          body: JSON.stringify({
            nombre: datos.nombre.trim(),
            direccion: datos.direccion.trim(),
            latitud: datos.latitud || null,
            longitud: datos.longitud || null,
            ...(almacen ? { version: almacen.version } : {}),
          }),
        },
      );
      try {
        sessionStorage.setItem(
          "almacenes:aviso",
          almacen ? "editado" : "creado",
        );
      } catch {
        /* La navegación sigue disponible sin almacenamiento local. */
      }
      navegador.push(`/almacenes/${guardado.id}`);
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
          {t(almacen ? "volverFicha" : "volver")}
        </button>
        <MigasPagina
          pageTitle={t(almacen ? "editarAlmacen" : "nuevoAlmacen")}
        />
        <p className="text-sm leading-6 text-gray-500 dark:text-gray-400">
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
            <IconoAlmacen className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">
              {t("datosAlmacen")}
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
                  onClick={() => descartar("recargar")}
                >
                  {t("recargar")}
                </Button>
              )}
            </div>
          )}
          <CampoDirectorio
            id="almacen-nombre"
            name="nombre"
            etiqueta={t("nombre")}
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
          <CampoDirectorio
            id="almacen-direccion"
            name="direccion"
            etiqueta={t("direccion")}
            required
            maxLength={255}
            value={datos.direccion}
            disabled={guardando}
            errores={errores.direccion}
            autoComplete="street-address"
            placeholder={t("ejemploDireccion")}
            onChange={(evento) => cambiar(evento.currentTarget)}
            onBlur={(evento) => salirCampo(evento.currentTarget)}
          />
          <section
            className="rounded-xl border border-gray-200 p-4 sm:p-5 dark:border-gray-800"
            aria-labelledby="titulo-ubicacion-almacen"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3
                id="titulo-ubicacion-almacen"
                className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"
              >
                <IconoUbicacion
                  className="size-4 text-brand-500"
                  aria-hidden="true"
                />
                {t("ubicacionGeografica")}
                <span className="text-theme-xs font-normal text-gray-500 dark:text-gray-400">
                  {t("opcional")}
                </span>
              </h3>
              {!!(datos.latitud || datos.longitud) && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => {
                    establecerDatos((anteriores) => ({
                      ...anteriores,
                      latitud: "",
                      longitud: "",
                    }));
                    establecerErrores((anteriores) => ({
                      ...anteriores,
                      latitud: [],
                      longitud: [],
                    }));
                  }}
                  className="min-h-9 rounded text-theme-xs font-medium text-gray-500 hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:text-brand-300"
                >
                  {t("quitarCoordenadas")}
                </button>
              )}
            </div>
            <p className="mt-2 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
              {t("ayudaUbicacion")}
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {(["latitud", "longitud"] as const).map((campo) => (
                <CampoDirectorio
                  key={campo}
                  id={`almacen-${campo}`}
                  name={campo}
                  etiqueta={t(campo)}
                  type="number"
                  inputMode="decimal"
                  step={0.0000001}
                  min={campo === "latitud" ? -90 : -180}
                  max={campo === "latitud" ? 90 : 180}
                  value={datos[campo]}
                  disabled={guardando}
                  required={
                    !!datos[campo === "latitud" ? "longitud" : "latitud"]
                  }
                  errores={errores[campo]}
                  ayuda={t(
                    campo === "latitud" ? "ayudaLatitud" : "ayudaLongitud",
                  )}
                  onChange={(evento) => cambiar(evento.currentTarget)}
                  onBlur={(evento) => salirCampo(evento.currentTarget)}
                />
              ))}
            </div>
            {enlaceMapa(datos.latitud, datos.longitud) && (
              <div className="mt-4 rounded-lg bg-brand-50 p-3 dark:bg-brand-500/10">
                <UbicacionAlmacen
                  nombre={datos.nombre || t("esteAlmacen")}
                  latitud={datos.latitud}
                  longitud={datos.longitud}
                  compacta
                />
              </div>
            )}
          </section>
          {almacen ? (
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
                  dateTime={almacen.creado_en}
                  className="mt-1 block text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {new Intl.DateTimeFormat(idioma, {
                    dateStyle: "long",
                    timeStyle: "short",
                    timeZone: "America/La_Paz",
                  }).format(new Date(almacen.creado_en))}
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
                : almacen
                  ? "guardarCambios"
                  : "crearAlmacen",
            )}
          </Button>
        </div>
      </form>
      {modalSalida.isOpen && (
        <ConfirmarDescartarAlmacen
          recargar={modoSalida === "recargar"}
          alCerrar={modalSalida.closeModal}
          alConfirmar={() => {
            if (modoSalida === "recargar") alRecargar();
            else volver();
          }}
        />
      )}
    </div>
  );
}

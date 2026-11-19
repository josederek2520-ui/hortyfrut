"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Building2, Save, ImagePlus } from "lucide-react";
import Button from "@/components/ui/button/Button";
import ConfirmacionLogistica from "@/components/logistica/ConfirmacionLogistica";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { useToast } from "@/hooks/useToast";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";
import { campoVenta, panelVenta } from "@/components/ventas/tipos";
import useOperacionComercial from "@/components/comercial/useOperacionComercial";
import useProteccionComercial from "@/components/comercial/useProteccionComercial";
import type { DatosEmpresa } from "./tipos";

export default function FormularioDatosEmpresa({
  inicial,
  editable,
  alRecargar,
}: {
  inicial: DatosEmpresa;
  editable: boolean;
  alRecargar: () => void;
}) {
  const t = useTranslations("empresa"),
    tc = useTranslations("comercialComun");
  const [datos, establecerDatos] = useState(inicial),
    [modificado, establecerModificado] = useState(false);
  const [leyendo, establecerLeyendo] = useState(false),
    [falloLogo, establecerFalloLogo] = useState(false);
  const [pedirRecarga, establecerPedirRecarga] = useState(false);
  const operacion = useOperacionComercial(),
    bloqueado = operacion.ocupado || operacion.incierto || leyendo;
  const proteccion = useProteccionComercial(
    modificado || operacion.incierto,
    operacion.ocupado || leyendo,
  );
  const lector = useRef<FileReader | null>(null),
    vigente = useRef(true);
  const { toasts, notify, dismiss } = useToast();
  useEffect(() => {
    vigente.current = true;
    const retirar = () => {
      vigente.current = false;
      lector.current?.abort();
    };
    const almacenamiento = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") retirar();
    };
    window.addEventListener("hortyfru:session-changed", retirar);
    window.addEventListener("storage", almacenamiento);
    return () => {
      retirar();
      window.removeEventListener("hortyfru:session-changed", retirar);
      window.removeEventListener("storage", almacenamiento);
    };
  }, []);
  function cambiar(campo: keyof DatosEmpresa, valor: string) {
    if (!editable || bloqueado) return;
    establecerDatos((anterior) => ({ ...anterior, [campo]: valor }));
    establecerModificado(true);
  }
  async function guardar(reintentar = false) {
    const {
      razon_social,
      nit,
      direccion,
      telefono,
      ciudad,
      logo_base64,
      version,
    } = datos;
    const resultado = await operacion.enviar<DatosEmpresa>(
      reintentar ? undefined : "datos-empresa/",
      reintentar
        ? undefined
        : {
            razon_social,
            nit,
            direccion,
            telefono,
            ciudad,
            logo_base64,
            version,
            clave_operacion: crearClaveOperacion(),
          },
    );
    if (resultado) {
      establecerDatos(resultado.datos);
      establecerModificado(false);
      notify(t("guardado"), "success");
    }
  }
  function elegirLogo(archivo?: File) {
    if (!archivo || bloqueado || !editable) return;
    establecerFalloLogo(false);
    if (
      archivo.size > 1024 * 1024 ||
      !["image/png", "image/jpeg", "image/webp"].includes(archivo.type)
    ) {
      establecerFalloLogo(true);
      return;
    }
    const nuevoLector = new FileReader();
    lector.current = nuevoLector;
    establecerLeyendo(true);
    nuevoLector.onload = () => {
      if (!vigente.current) return;
      establecerDatos((anterior) => ({
        ...anterior,
        logo_base64: String(nuevoLector.result),
      }));
      establecerModificado(true);
      establecerLeyendo(false);
    };
    nuevoLector.onerror = () => {
      if (vigente.current) {
        establecerFalloLogo(true);
        establecerLeyendo(false);
      }
    };
    nuevoLector.readAsDataURL(archivo);
  }
  if (!operacion.autorizado) return <p role="alert">{tc("sinAcceso")}</p>;
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header>
        <h1 className="flex items-center gap-3 text-2xl font-semibold">
          <Building2
            aria-hidden="true"
            className="size-6 text-brand-700 dark:text-brand-300"
          />
          {t("titulo")}
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("subtitulo")}
        </p>
      </header>
      {operacion.fallo && (
        <div
          role="alert"
          className="rounded-xl bg-error-50 p-4 text-error-700 dark:bg-error-950 dark:text-error-200"
        >
          <p>{tc(operacion.fallo)}</p>
          {operacion.errores.map((error, i) => (
            <p key={i} className="mt-2 text-sm">
              {error}
            </p>
          ))}
          {operacion.incierto && (
            <Button
              onClick={() => void guardar(true)}
              disabled={operacion.ocupado}
            >
              {tc("reintentar")}
            </Button>
          )}
          {operacion.fallo === "conflicto" && (
            <Button
              onClick={() =>
                modificado ? establecerPedirRecarga(true) : alRecargar()
              }
            >
              {tc("recargar")}
            </Button>
          )}
        </div>
      )}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className={panelVenta + " space-y-5 p-5 sm:p-6"}>
          <div className="grid gap-5 sm:grid-cols-2">
            {(
              [
                "razon_social",
                "nit",
                "direccion",
                "telefono",
                "ciudad",
              ] as const
            ).map((campo) => (
              <div
                key={campo}
                className={
                  campo === "direccion" || campo === "razon_social"
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <label
                  htmlFor={"empresa-" + campo}
                  className="mb-2 block text-sm font-medium"
                >
                  {t(campo)}
                </label>
                <input
                  id={"empresa-" + campo}
                  className={campoVenta}
                  value={datos[campo]}
                  disabled={!editable || bloqueado}
                  maxLength={
                    campo === "direccion"
                      ? 250
                      : campo === "razon_social"
                        ? 150
                        : campo === "nit"
                          ? 20
                          : campo === "telefono"
                            ? 30
                            : 100
                  }
                  inputMode={
                    campo === "nit"
                      ? "numeric"
                      : campo === "telefono"
                        ? "tel"
                        : "text"
                  }
                  pattern={campo === "nit" ? "[0-9]*" : undefined}
                  onChange={(evento) => cambiar(campo, evento.target.value)}
                />
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {t("datosHistoricos")}
          </p>
        </div>
        <aside className={panelVenta + " space-y-4 p-5"}>
          <h2 className="font-semibold">{t("logo")}</h2>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700">
            <Image
              src={
                datos.logo_base64 ||
                "/images/marca/logo-hortyfru-claro-transparente.png"
              }
              alt={t("logo")}
              width={280}
              height={140}
              unoptimized
              className="h-28 w-full object-contain"
            />
          </div>
          {editable && (
            <>
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
                <ImagePlus className="size-4" aria-hidden="true" />
                {t("elegirLogo")}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={bloqueado}
                  onChange={(evento) => {
                    elegirLogo(evento.target.files?.[0]);
                    evento.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("ayudaLogo")}
              </p>
              {datos.logo_base64 && (
                <Button
                  variant="outline"
                  disabled={bloqueado}
                  onClick={() => cambiar("logo_base64", "")}
                >
                  {t("usarLogoMarca")}
                </Button>
              )}
            </>
          )}
          {falloLogo && (
            <p
              role="alert"
              className="text-sm text-error-600 dark:text-error-300"
            >
              {t("errorLogo")}
            </p>
          )}
        </aside>
        <footer
          className={
            panelVenta +
            " flex flex-wrap items-center justify-between gap-3 p-4 lg:col-span-2"
          }
        >
          <p role="status" className="text-sm text-gray-500 dark:text-gray-400">
            {tc(
              operacion.ocupado
                ? "procesando"
                : modificado
                  ? "sinGuardar"
                  : "sinCambios",
            )}
          </p>
          {editable && (
            <Button
              type="submit"
              disabled={bloqueado || !modificado}
              startIcon={<Save className="size-4" />}
            >
              {tc("guardar")}
            </Button>
          )}
        </footer>
      </form>
      {pedirRecarga && (
        <ConfirmacionLogistica
          titulo={tc("recargar")}
          descripcion={tc("salirAyuda")}
          accion={tc("continuar")}
          alCerrar={() => establecerPedirRecarga(false)}
          alConfirmar={alRecargar}
        />
      )}
      {proteccion.destino && (
        <ConfirmacionLogistica
          titulo={tc("salirTitulo")}
          descripcion={tc("salirAyuda")}
          accion={tc("salir")}
          alCerrar={proteccion.cerrar}
          alConfirmar={proteccion.confirmar}
        />
      )}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </section>
  );
}

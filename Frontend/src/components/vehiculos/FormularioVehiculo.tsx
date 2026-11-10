"use client";
import Imagen from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Truck as IconoVehiculo, ImagePlus as IconoImagen } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import Campo from "@/components/clientes/CampoDirectorio";
import Button from "@/components/ui/button/Button";
import Confirmacion from "@/components/logistica/ConfirmacionLogistica";
import { clasePanel } from "@/components/logistica/tipos";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type { Vehiculo } from "./tipos";
import {
  kilogramosAToneladas,
  toneladasAKilogramos,
} from "./capacidadVehiculo";

export default function FormularioVehiculo({
  vehiculo,
  alError,
}: {
  vehiculo?: Vehiculo;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("vehiculos");
  const comun = useTranslations("logistica");
  const navegador = useRouter();
  const referencia = useRef<HTMLFormElement>(null);
  const [datos, establecerDatos] = useState({
    placa: vehiculo?.placa || "",
    tipo: vehiculo?.tipo || "",
    marca: vehiculo?.marca || "",
    capacidadToneladas: kilogramosAToneladas(vehiculo?.capacidad_kg),
  });
  const [imagen, establecerImagen] = useState<File | null>(null);
  const [vistaPrevia, establecerVistaPrevia] = useState(vehiculo?.imagen || "");
  const [quitarImagen, establecerQuitarImagen] = useState(false);
  const [modificado, establecerModificado] = useState(false);
  const [salir, establecerSalir] = useState(false);
  const [guardando, establecerGuardando] = useState(false);
  const [errores, establecerErrores] = useState<Record<string, string[]>>({});
  const [conflicto, establecerConflicto] = useState(false);
  const [fallo, establecerFallo] = useState(false);
  useEffect(() => {
    if (!imagen) return;
    const enlace = URL.createObjectURL(imagen);
    establecerVistaPrevia(enlace);
    return () => URL.revokeObjectURL(enlace);
  }, [imagen]);
  useEffect(() => {
    const proteger = (evento: BeforeUnloadEvent) => {
      if (modificado) evento.preventDefault();
    };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [modificado]);
  const volver = () =>
    navegador.push(vehiculo ? `/vehiculos/${vehiculo.id}` : "/vehiculos");
  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (guardando || conflicto) return;
    if (!referencia.current?.reportValidity()) return;
    const capacidadKg = toneladasAKilogramos(datos.capacidadToneladas);
    if (capacidadKg === null) {
      establecerErrores({ ...errores, capacidad_kg: [t("capacidadInvalida")] });
      referencia.current
        ?.querySelector<HTMLElement>("#vehiculo-capacidad-toneladas")
        ?.focus();
      return;
    }
    establecerGuardando(true);
    establecerErrores({});
    establecerFallo(false);
    const cuerpo = new FormData();
    (["placa", "tipo", "marca"] as const).forEach((campo) =>
      cuerpo.set(campo, datos[campo].trim()),
    );
    cuerpo.set("capacidad_kg", capacidadKg);
    if (vehiculo) cuerpo.set("version", vehiculo.version);
    if (imagen) cuerpo.set("imagen", imagen);
    cuerpo.set("quitar_imagen", String(quitarImagen));
    try {
      const guardado = await api<Vehiculo>(
        vehiculo ? `vehiculos/${vehiculo.id}/` : "vehiculos/",
        { method: vehiculo ? "PATCH" : "POST", body: cuerpo },
      );
      establecerModificado(false);
      navegador.push(`/vehiculos/${guardado.id}`);
      navegador.refresh();
    } catch (error) {
      establecerFallo(true);
      if (error instanceof ErrorApi) {
        establecerErrores(error.errors);
        establecerConflicto(error.status === 409);
      }
      alError(error);
      setTimeout(
        () =>
          referencia.current
            ?.querySelector<HTMLElement>('[aria-invalid="true"]')
            ?.focus(),
        0,
      );
    } finally {
      establecerGuardando(false);
    }
  };
  return (
    <>
      <form
        ref={referencia}
        onSubmit={guardar}
        className="grid items-start gap-6 xl:grid-cols-3"
        aria-busy={guardando}
      >
        <section className={`${clasePanel} xl:col-span-2`}>
          <div className="flex items-center gap-3 border-b border-gray-100 p-6 dark:border-gray-800">
            <span className="rounded-xl bg-brand-50 p-3 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
              <IconoVehiculo className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">
                {t("datos")}
              </h2>
              <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">
                {comun("obligatorios")}
              </p>
            </div>
          </div>
          <fieldset
            disabled={guardando}
            className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8"
          >
            {(["placa", "tipo", "marca"] as const).map((campo) => (
              <Campo
                key={campo}
                id={`vehiculo-${campo}`}
                etiqueta={t(campo)}
                required={campo === "placa" || campo === "tipo"}
                maxLength={campo === "placa" ? 20 : campo === "tipo" ? 60 : 100}
                value={datos[campo]}
                errores={errores[campo]}
                ayuda={t(`ayuda_${campo}`)}
                onChange={(evento) => {
                  establecerDatos({
                    ...datos,
                    [campo]:
                      campo === "placa"
                        ? evento.target.value.toUpperCase()
                        : evento.target.value,
                  });
                  establecerModificado(true);
                  establecerErrores({ ...errores, [campo]: [] });
                }}
              />
            ))}
            <Campo
              id="vehiculo-capacidad-toneladas"
              name="capacidadToneladas"
              etiqueta={t("capacidadToneladas")}
              type="number"
              inputMode="decimal"
              min="0.000001"
              max="999999.999999"
              step={0.000001}
              placeholder={t("ejemploCapacidad")}
              value={datos.capacidadToneladas}
              errores={errores.capacidad_kg}
              ayuda={t("ayudaCapacidadToneladas")}
              onChange={(evento) => {
                establecerDatos({
                  ...datos,
                  capacidadToneladas: evento.target.value,
                });
                establecerModificado(true);
                establecerErrores({ ...errores, capacidad_kg: [] });
              }}
            />
          </fieldset>
          {fallo && (
            <div
              role="alert"
              className="mx-6 mb-6 rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
            >
              {comun(conflicto ? "conflicto" : "validacion")}
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 p-5 dark:border-gray-800">
            <Button
              size="sm"
              variant="outline"
              disabled={guardando}
              onClick={() => (modificado ? establecerSalir(true) : volver())}
            >
              {comun("cancelar")}
            </Button>
            <Button size="sm" type="submit" disabled={guardando || conflicto}>
              {comun(guardando ? "guardando" : "guardar")}
            </Button>
          </div>
        </section>
        <aside className={`${clasePanel} p-6`}>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {t("imagen")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
            {t("ayudaImagen")}
          </p>
          <div className="my-5 flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            {vistaPrevia && !quitarImagen ? (
              <Imagen
                width={640}
                height={360}
                unoptimized
                src={vistaPrevia}
                alt={datos.placa || t("imagen")}
                className="h-full w-full object-contain p-4"
              />
            ) : (
              <IconoImagen className="size-10 text-gray-300 dark:text-gray-600" />
            )}
          </div>
          <label className="block">
            <span className="sr-only">{t("imagen")}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={guardando}
              className="w-full text-theme-xs text-gray-500 file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-700 dark:text-gray-400 dark:file:bg-brand-500/10 dark:file:text-brand-300"
              onChange={(evento) => {
                const archivo = evento.target.files?.[0];
                if (!archivo) return;
                if (archivo.size > 5 * 1024 * 1024) {
                  establecerErrores({
                    ...errores,
                    imagen: [t("imagenGrande")],
                  });
                  return;
                }
                establecerImagen(archivo);
                establecerQuitarImagen(false);
                establecerModificado(true);
                establecerErrores({ ...errores, imagen: [] });
              }}
            />
          </label>
          {errores.imagen?.length ? (
            <p role="alert" className="mt-2 text-sm text-error-500">
              {errores.imagen.join(" ")}
            </p>
          ) : null}
          {vistaPrevia && !quitarImagen && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                establecerImagen(null);
                establecerQuitarImagen(true);
                establecerVistaPrevia("");
                establecerModificado(true);
              }}
              className="mt-4 min-h-10 rounded-lg text-sm text-error-600 focus-visible:ring-2 focus-visible:ring-error-400 dark:text-error-400"
            >
              {t("quitarImagen")}
            </button>
          )}
        </aside>
      </form>
      {salir && (
        <Confirmacion
          titulo={comun("descartarTitulo")}
          descripcion={comun("descartarAyuda")}
          accion={comun("descartar")}
          alCerrar={() => establecerSalir(false)}
          alConfirmar={volver}
        />
      )}
    </>
  );
}

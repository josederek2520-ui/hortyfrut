"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import CampoDirectorio from "@/components/clientes/CampoDirectorio";
import SelectorCompra from "@/components/compras/SelectorCompra";
import { clasePanel, type OpcionCompra } from "@/components/compras/tipos";
import { api, ApiError } from "@/lib/api";
import { useFormValidation } from "@/hooks/useFormValidation";
import { useModal } from "@/hooks/useModal";
import type { FieldErrors as ErroresCampos } from "@/lib/form-validation";
import ColorCajilla from "./ColorCajilla";
import ConfirmarSalidaCajillas from "./ConfirmarSalidaCajillas";
import type { Cajilla } from "./tipos";

export default function FormularioColorCajilla({
  puedeIngresar,
  alError,
}: {
  puedeIngresar: boolean;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("cajillas");
  const navegador = useRouter();
  const modalSalida = useModal();
  const [color, establecerColor] = useState("");
  const [cantidad, establecerCantidad] = useState("0");
  const [almacen, establecerAlmacen] = useState<OpcionCompra | null>(null);
  const [claveOperacion] = useState(() => crypto.randomUUID());
  const [ocupado, establecerOcupado] = useState(false);
  const [fallo, establecerFallo] = useState("");
  const [conflicto, establecerConflicto] = useState(false);
  const {
    errors: errores,
    setErrors: establecerErrores,
    validateForm: validar,
    changeField: cambiarCampo,
    blurField: salirCampo,
  } = useFormValidation();
  const modificado = !!color.trim() || !!Number(cantidad);
  useEffect(() => {
    if (!modificado) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modificado]);
  const guardar = async (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (ocupado || conflicto) return;
    const problemas: ErroresCampos = {};
    if (!/^\d{1,10}$/.test(cantidad || "0") || Number(cantidad) > 2147483647)
      problemas.cantidad_inicial = [t("cantidadInvalida")];
    if (Number(cantidad) > 0 && !almacen)
      problemas.almacen = [t("seleccionarAlmacen")];
    if (!validar(evento.currentTarget, problemas)) return;
    establecerOcupado(true);
    establecerFallo("");
    try {
      const respuesta = await api<Cajilla>("cajillas/", {
        method: "POST",
        body: JSON.stringify({
          color: color.trim(),
          cantidad_inicial: Number(cantidad || "0"),
          almacen: Number(cantidad) > 0 ? almacen!.id : null,
          clave_operacion: claveOperacion,
        }),
      });
      sessionStorage.setItem("cajillas:aviso", "colorGuardado");
      navegador.replace(`/cajillas/${respuesta.id}`);
      navegador.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        establecerErrores(error.errors);
        establecerConflicto(error.status === 409);
      }
      establecerFallo(
        t(
          error instanceof ApiError && error.status === 409
            ? "conflictoCreacion"
            : "errorGuardar",
        ),
      );
      alError(error);
    } finally {
      establecerOcupado(false);
    }
  };
  return (
    <form noValidate onSubmit={guardar} className="space-y-6">
      <section className={`${clasePanel} p-5 sm:p-6`}>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("nuevoColor")}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-gray-400">
          {t("nuevoColorAyuda")}
        </p>
        <fieldset
          disabled={ocupado}
          className="mt-6 grid items-start gap-5 sm:grid-cols-2"
        >
          <legend className="sr-only">{t("datosColor")}</legend>
          <CampoDirectorio
            id="color"
            name="color"
            etiqueta={t("color")}
            value={color}
            required
            maxLength={60}
            placeholder={t("colorEjemplo")}
            errores={errores.color}
            onChange={(evento) => {
              establecerColor(evento.target.value);
              cambiarCampo(evento.target);
            }}
            onBlur={(evento) => salirCampo(evento.target)}
          />
          <CampoDirectorio
            id="cantidad_inicial"
            name="cantidad_inicial"
            etiqueta={t("cantidadInicial")}
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            max={2147483647}
            value={cantidad}
            disabled={!puedeIngresar}
            ayuda={t(
              puedeIngresar ? "cantidadInicialAyuda" : "soloRegistrarColor",
            )}
            errores={errores.cantidad_inicial}
            onChange={(evento) => {
              establecerCantidad(evento.target.value);
              cambiarCampo(evento.target);
            }}
            onBlur={(evento) => salirCampo(evento.target)}
          />
          {Number(cantidad) > 0 && (
            <SelectorCompra
              ruta="cajillas/almacenes/"
              etiqueta={t("almacenInicial")}
              valor={almacen}
              nombre="almacen"
              deshabilitado={ocupado}
              error={errores.almacen?.join(" ")}
              alError={alError}
              alElegir={(valor) => {
                establecerAlmacen(valor);
                establecerErrores((actuales) => ({ ...actuales, almacen: [] }));
              }}
            />
          )}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/30">
            <p className="mb-3 text-theme-xs text-gray-500 dark:text-gray-400">
              {t("vistaPrevia")}
            </p>
            <ColorCajilla color={color.trim() || t("colorPendiente")} />
          </div>
        </fieldset>
        <p className="mt-5 text-theme-xs leading-5 text-gray-500 dark:text-gray-400">
          {t("fechaAutomatica")}
        </p>
      </section>
      {fallo && (
        <p
          role="alert"
          className="rounded-xl bg-error-50 p-4 text-sm text-error-600 dark:bg-error-500/10 dark:text-error-400"
        >
          {fallo}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        <Button
          variant="outline"
          disabled={ocupado}
          onClick={() => {
            if (modificado) modalSalida.openModal();
            else navegador.push("/cajillas");
          }}
        >
          {t("volver")}
        </Button>
        <Button type="submit" disabled={ocupado || conflicto}>
          {t(
            ocupado
              ? "guardando"
              : Number(cantidad) > 0
                ? "guardarColorSaldo"
                : "guardarColor",
          )}
        </Button>
      </div>
      {modalSalida.isOpen && (
        <ConfirmarSalidaCajillas
          alCerrar={modalSalida.closeModal}
          alSalir={() => navegador.push("/cajillas")}
        />
      )}
    </form>
  );
}

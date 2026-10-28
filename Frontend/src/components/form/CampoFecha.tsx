"use client";

import { useEffect, useId, useRef, type InputHTMLAttributes } from "react";
import { useLocale, useTranslations } from "next-intl";
import flatpickr from "flatpickr";
import { Spanish as idiomaEspanol } from "flatpickr/dist/l10n/es";
import type { Instance as InstanciaCalendario } from "flatpickr/dist/types/instance";
import { IconoCalendario, CloseIcon as IconoLimpiar } from "@/icons";
import { cn } from "@/utils";
import posicionarCalendario from "./posicionarCalendario";

interface Propiedades extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  | "type"
  | "value"
  | "defaultValue"
  | "onChange"
  | "onBlur"
  | "min"
  | "max"
  | "readOnly"
> {
  value: string;
  min?: string;
  max?: string;
  error?: boolean;
  alCambiar: (fecha: string, control: HTMLInputElement) => void;
  alSalir?: (control: HTMLInputElement) => void;
}

function mostrarFecha(fecha: string) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "";
}

export default function CampoFecha({
  value,
  min,
  max,
  error = false,
  alCambiar,
  alSalir,
  id,
  name,
  disabled = false,
  required = false,
  className,
  placeholder,
  "aria-invalid": invalido,
  ...propiedades
}: Propiedades) {
  const idioma = useLocale();
  const t = useTranslations("calendarioFechas");
  const identificador = useId();
  const identificadorEntrada = id || `fecha-${identificador}`;
  const identificadorCalendario = `calendario-${identificador}`;
  const entrada = useRef<HTMLInputElement>(null);
  const control = useRef<HTMLInputElement>(null);
  const instancia = useRef<InstanciaCalendario | null>(null);
  const estado = useRef({
    value,
    min,
    max,
    alCambiar,
    alSalir,
    titulo: t("elegirFecha"),
  });
  const hayError = error || invalido === true || invalido === "true";

  useEffect(() => {
    estado.current = {
      value,
      min,
      max,
      alCambiar,
      alSalir,
      titulo: t("elegirFecha"),
    };
  });

  useEffect(() => {
    if (!entrada.current) return;
    const campo = entrada.current;
    const calendario = flatpickr(campo, {
      locale: idioma === "es" ? idiomaEspanol : "default",
      dateFormat: "d/m/Y",
      ariaDateFormat: "l, j F Y",
      defaultDate: estado.current.value
        ? flatpickr.parseDate(estado.current.value, "Y-m-d")
        : undefined,
      minDate: estado.current.min
        ? flatpickr.parseDate(estado.current.min, "Y-m-d")
        : undefined,
      maxDate: estado.current.max
        ? flatpickr.parseDate(estado.current.max, "Y-m-d")
        : undefined,
      monthSelectorType: "static",
      disableMobile: true,
      allowInput: false,
      animate: false,
      appendTo: campo.closest<HTMLElement>('[role="dialog"]') || document.body,
      position: posicionarCalendario,
      onReady: (_fechas, _texto, actual) => {
        campo.setAttribute("aria-expanded", "false");
        actual.calendarContainer.classList.add("calendario-hortyfru");
        actual.calendarContainer.id = identificadorCalendario;
        actual.calendarContainer.setAttribute("role", "dialog");
        actual.calendarContainer.setAttribute(
          "aria-label",
          estado.current.titulo,
        );
        // Conservar el valor visible incluso si un nuevo límite lo deja inválido.
        campo.value = mostrarFecha(estado.current.value);
      },
      onOpen: (_fechas, _texto, actual) => {
        if (campo.matches(":disabled")) {
          actual.close();
          return;
        }
        campo.setAttribute("aria-expanded", "true");
      },
      onClose: () => {
        campo.setAttribute("aria-expanded", "false");
        if (control.current) estado.current.alSalir?.(control.current);
      },
      onChange: (fechas, _texto, actual) => {
        const fecha = fechas[0] ? actual.formatDate(fechas[0], "Y-m-d") : "";
        if (control.current) {
          control.current.value = fecha;
          estado.current.alCambiar(fecha, control.current);
        }
      },
    });
    instancia.current = calendario;
    const escapar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && calendario.isOpen) {
        evento.preventDefault();
        evento.stopPropagation();
        campo.focus({ preventScroll: true });
        calendario.close();
      }
    };
    const recolocar = () => {
      if (calendario.isOpen) posicionarCalendario(calendario);
    };
    document.addEventListener("keydown", escapar, true);
    document.addEventListener("scroll", recolocar, true);
    window.addEventListener("resize", recolocar);
    window.visualViewport?.addEventListener("resize", recolocar);
    window.visualViewport?.addEventListener("scroll", recolocar);
    return () => {
      document.removeEventListener("keydown", escapar, true);
      document.removeEventListener("scroll", recolocar, true);
      window.removeEventListener("resize", recolocar);
      window.visualViewport?.removeEventListener("resize", recolocar);
      window.visualViewport?.removeEventListener("scroll", recolocar);
      calendario.destroy();
      instancia.current = null;
    };
  }, [idioma, identificadorCalendario]);

  useEffect(() => {
    const calendario = instancia.current;
    if (!calendario) return;
    calendario.set({
      minDate: min ? flatpickr.parseDate(min, "Y-m-d") : undefined,
      maxDate: max ? flatpickr.parseDate(max, "Y-m-d") : undefined,
    });
    calendario.setDate(value, false, "Y-m-d");
    calendario.input.value = mostrarFecha(value);
    if (disabled) calendario.close();
  }, [value, min, max, disabled, idioma]);

  return (
    <div className="relative">
      <input
        ref={control}
        type="date"
        name={name}
        value={value}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(evento) =>
          alCambiar(evento.target.value, evento.currentTarget)
        }
        onInvalid={(evento) => {
          evento.preventDefault();
          entrada.current?.focus();
        }}
      />
      <input
        {...propiedades}
        ref={entrada}
        id={identificadorEntrada}
        type="text"
        role="combobox"
        aria-autocomplete="none"
        value={mostrarFecha(value)}
        readOnly
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={hayError || undefined}
        aria-haspopup="dialog"
        aria-expanded="false"
        aria-controls={identificadorCalendario}
        placeholder={placeholder || t("formato")}
        onBlur={() => {
          if (control.current) alSalir?.(control.current);
        }}
        className={cn(
          "h-11 w-full cursor-pointer appearance-none rounded-lg border py-2.5 ps-4 pe-20 text-sm shadow-theme-xs transition-colors outline-none placeholder:text-gray-400 focus:ring-3 dark:placeholder:text-white/30",
          disabled
            ? "cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500 opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            : hayError
              ? "border-error-500 bg-error-50 text-gray-900 ring-1 ring-error-500/10 focus:border-error-600 focus:ring-error-500/20 dark:border-error-400 dark:bg-error-500/10 dark:text-gray-100"
              : "border-gray-300 bg-white text-gray-800 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100",
          className,
        )}
      />
      <div className="absolute inset-y-0 end-2 flex items-center gap-0.5">
        {value && (
          <button
            type="button"
            disabled={disabled}
            aria-label={t("limpiar")}
            title={t("limpiar")}
            className="inline-flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            onClick={() => {
              instancia.current?.clear();
              entrada.current?.focus({ preventScroll: true });
              instancia.current?.close();
            }}
          >
            <IconoLimpiar className="size-3.5" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={t("abrir")}
          title={t("abrir")}
          className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-brand-400"
          onClick={() => {
            entrada.current?.focus({ preventScroll: true });
            instancia.current?.open();
          }}
        >
          <IconoCalendario className="size-4.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

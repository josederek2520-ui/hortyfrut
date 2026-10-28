"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { IconoSubir, DeleteIcon as IconoQuitar } from "@/icons";
import ImagenProducto from "./ImagenProducto";

interface Propiedades {
  origen: string | null;
  nombre: string;
  archivo: File | null;
  quitar: boolean;
  alCambiar: (archivo: File | null, quitar: boolean) => void;
  alValidar: (mensaje: string) => void;
  error?: string;
  deshabilitado: boolean;
}

export default function CampoImagenProducto({
  origen,
  nombre,
  archivo,
  quitar,
  alCambiar,
  alValidar,
  error,
  deshabilitado,
}: Propiedades) {
  const t = useTranslations("productos");
  const entrada = useRef<HTMLInputElement>(null);
  const [vistaPrevia, establecerVistaPrevia] = useState<string | null>(null);
  useEffect(() => {
    if (!archivo) return;
    const direccion = URL.createObjectURL(archivo);
    const temporizador = window.setTimeout(
      () => establecerVistaPrevia(direccion),
      0,
    );
    return () => {
      window.clearTimeout(temporizador);
      URL.revokeObjectURL(direccion);
    };
  }, [archivo]);
  const origenVisible = archivo ? vistaPrevia : quitar ? null : origen;
  return (
    <section
      aria-labelledby="titulo-imagen-producto"
      className={`space-y-4 rounded-xl border p-5 ${error ? "border-error-500 bg-error-50/50 dark:border-error-400 dark:bg-error-500/5" : "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/30"}`}
    >
      <div>
        <h3
          id="titulo-imagen-producto"
          className="text-sm font-semibold text-gray-800 dark:text-gray-100"
        >
          {t("foto")}
        </h3>
        <p className="mt-1 text-theme-xs text-gray-400 dark:text-gray-500">
          {t("opcional")}
        </p>
      </div>
      <div className="mx-auto max-w-60">
        <ImagenProducto
          origen={origenVisible}
          nombre={nombre || t("foto")}
          grande
        />
      </div>
      <input
        ref={entrada}
        type="file"
        name="imagen"
        accept="image/jpeg,image/png,image/webp"
        disabled={deshabilitado}
        tabIndex={-1}
        className="sr-only"
        aria-label={t("subirImagen")}
        onChange={(evento) => {
          const nuevo = evento.target.files?.[0];
          evento.target.value = "";
          if (!nuevo) return;
          if (
            !["image/jpeg", "image/png", "image/webp"].includes(nuevo.type) ||
            nuevo.size > 5 * 1024 * 1024 ||
            !nuevo.size
          ) {
            alValidar(t("imagenInvalida"));
            return;
          }
          alValidar("");
          alCambiar(nuevo, false);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          startIcon={<IconoSubir className="size-4" />}
          disabled={deshabilitado}
          data-invalido={!!error}
          aria-describedby="ayuda-imagen-producto"
          onClick={() => entrada.current?.click()}
        >
          {t(origenVisible ? "cambiarImagen" : "subirImagen")}
        </Button>
        {(origenVisible || error) && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            startIcon={<IconoQuitar className="size-4" />}
            disabled={deshabilitado}
            onClick={() => {
              alCambiar(null, !!origen);
              alValidar("");
            }}
          >
            {t("quitarImagen")}
          </Button>
        )}
      </div>
      <p
        id="ayuda-imagen-producto"
        role={error ? "alert" : undefined}
        className={`text-theme-xs leading-5 ${error ? "text-error-500 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
      >
        {error || t("ayudaImagen")}
      </p>
    </section>
  );
}

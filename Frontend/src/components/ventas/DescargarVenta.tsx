"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download as IconoDescargar } from "lucide-react";
import Button from "@/components/ui/button/Button";
import type { Venta } from "./tipos";

export default function DescargarVenta({ venta }: { venta: Venta }) {
  const t = useTranslations("ventas"),
    idioma = useLocale();
  const [ocupado, establecerOcupado] = useState(false),
    [fallo, establecerFallo] = useState(false);
  const activo = useRef(true),
    controlador = useRef<AbortController | null>(null),
    ejecutando = useRef(false);
  useEffect(() => {
    activo.current = true;
    const retirar = () => {
      activo.current = false;
      controlador.current?.abort();
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
  async function descargar() {
    if (!activo.current || ejecutando.current) return;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo(false);
    controlador.current = new AbortController();
    try {
      const respuesta = await fetch(
        `/api/v1/ventas/${venta.id}/descargar/?idioma=${idioma}`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.current.signal,
        },
      );
      if (
        !respuesta.ok ||
        !respuesta.headers.get("content-type")?.includes("application/pdf")
      )
        throw new Error("pdf");
      const archivo = await respuesta.blob();
      if (!activo.current || controlador.current.signal.aborted) return;
      const direccion = URL.createObjectURL(archivo),
        enlace = document.createElement("a");
      enlace.href = direccion;
      enlace.download = venta.codigo + ".pdf";
      enlace.click();
      setTimeout(() => URL.revokeObjectURL(direccion), 1000);
    } catch {
      if (activo.current) establecerFallo(true);
    } finally {
      ejecutando.current = false;
      if (activo.current) establecerOcupado(false);
    }
  }
  return (
    <div>
      <Button
        variant="outline"
        onClick={() => void descargar()}
        disabled={ocupado}
        startIcon={<IconoDescargar className="size-4" aria-hidden="true" />}
      >
        {t(ocupado ? "descargando" : "descargar")}
      </Button>
      {fallo && (
        <p
          role="alert"
          className="mt-2 max-w-xs text-sm text-error-600 dark:text-error-400"
        >
          {t("errorDescarga")}
        </p>
      )}
    </div>
  );
}

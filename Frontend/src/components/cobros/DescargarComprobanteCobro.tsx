"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import Button from "@/components/ui/button/Button";
import type { Cobro } from "./tipos";

export default function DescargarComprobanteCobro({
  cobro,
  ruta = "cobros",
}: {
  cobro: Pick<Cobro, "id" | "codigo" | "comprobante">;
  ruta?: "cobros" | "mis-pagos" | "pagos-por-verificar";
}) {
  const t = useTranslations("cobros");
  const [ocupado, establecerOcupado] = useState(false),
    [fallo, establecerFallo] = useState(false);
  const activo = useRef(true),
    ejecutando = useRef(false),
    controlador = useRef<AbortController | null>(null);
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
    const comprobante = cobro.comprobante;
    if (!activo.current || ejecutando.current || !comprobante) return;
    ejecutando.current = true;
    establecerOcupado(true);
    establecerFallo(false);
    controlador.current = new AbortController();
    try {
      const respuesta = await fetch(
        `/api/v1/${ruta}/${cobro.id}/comprobante/`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.current.signal,
        },
      );
      if (
        !respuesta.ok ||
        respuesta.headers.get("content-type")?.split(";")[0] !==
          comprobante.tipo
      )
        throw new Error("comprobante");
      const archivo = await respuesta.blob();
      if (!activo.current || controlador.current.signal.aborted) return;
      if (archivo.size !== comprobante.tamano) throw new Error("tamano");
      const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "application/pdf": "pdf",
      }[comprobante.tipo];
      if (!extension) throw new Error("tipo");
      const direccion = URL.createObjectURL(archivo),
        enlace = document.createElement("a");
      enlace.href = direccion;
      enlace.download = cobro.codigo + "-comprobante." + extension;
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
        disabled={ocupado}
        startIcon={<Download className="size-4" />}
        onClick={() => void descargar()}
      >
        {t(ocupado ? "descargandoComprobante" : "descargarComprobante")}
      </Button>
      {fallo && (
        <p
          role="alert"
          className="mt-2 text-sm text-error-600 dark:text-error-300"
        >
          {t("errorDescargarComprobante")}
        </p>
      )}
    </div>
  );
}

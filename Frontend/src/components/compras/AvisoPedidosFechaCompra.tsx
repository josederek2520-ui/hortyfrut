"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Info, LoaderCircle, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginaNecesidades } from "./tipos";

export default function AvisoPedidosFechaCompra({ fecha }: { fecha: string }) {
  const t = useTranslations("compras");
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    estado: "con_pedidos" | "sin_pedidos" | "error";
  } | null>(null);
  const clave = `${fecha}|${revision}`;
  const estado = respuesta?.clave === clave ? respuesta.estado : "consultando";
  useEffect(() => {
    if (!fecha) return;
    const controlador = new AbortController();
    const consultar = async () => {
      try {
        const parametros = new URLSearchParams({ fecha_pedidos: fecha });
        const datos = await api<
          Pick<PaginaNecesidades<unknown>, "fecha_pedidos" | "resumen">
        >(`compras/necesidades/?${parametros}`, { signal: controlador.signal });
        if (
          datos.fecha_pedidos !== fecha ||
          !Number.isSafeInteger(datos.resumen?.pedidos) ||
          datos.resumen.pedidos < 0
        )
          throw new Error("Respuesta de pedidos invalida");
        if (!controlador.signal.aborted)
          establecerRespuesta({
            clave,
            estado: datos.resumen.pedidos > 0 ? "con_pedidos" : "sin_pedidos",
          });
      } catch {
        if (!controlador.signal.aborted)
          establecerRespuesta({ clave, estado: "error" });
      }
    };
    void consultar();
    return () => controlador.abort();
  }, [fecha, clave]);
  if (!fecha) return null;
  const Icono =
    estado === "consultando"
      ? LoaderCircle
      : estado === "con_pedidos"
        ? CheckCircle2
        : Info;
  return (
    <div
      id="compra-pedidos-disponibilidad"
      className={`mt-2 text-theme-xs ${estado === "con_pedidos" ? "text-brand-700 dark:text-brand-300" : estado === "error" ? "text-error-600 dark:text-error-400" : "text-gray-500 dark:text-gray-400"}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="flex items-start gap-1.5">
        <Icono
          className={`mt-0.5 size-3.5 shrink-0 ${estado === "consultando" ? "animate-spin motion-reduce:animate-none" : ""}`}
          aria-hidden="true"
        />
        <span>{t(`disponibilidadPedidos.${estado}`)}</span>
      </p>
      {estado === "error" && (
        <button
          type="button"
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded px-1 font-medium text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-300"
          onClick={() => establecerRevision((valor) => valor + 1)}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {t("reintentar")}
        </button>
      )}
    </div>
  );
}

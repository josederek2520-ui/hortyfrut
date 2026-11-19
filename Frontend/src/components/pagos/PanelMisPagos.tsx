"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import Button from "@/components/ui/button/Button";
import VentasSupermercado from "./VentasSupermercado";
import ListadoPagos from "./ListadoPagos";
export default function PanelMisPagos({
  puedeInformar,
}: {
  puedeInformar: boolean;
}) {
  const t = useTranslations("pagos");
  const [vista, establecerVista] = useState<"ventas" | "pagos">("ventas");
  return (
    <section className="space-y-5 text-gray-900 dark:text-white">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t("titulo")}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        {puedeInformar && (
          <Link
            href="/mis-pagos/nuevo"
            className="boton-principal-hortyfru inline-flex min-h-11 items-center gap-2 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t("informarPago")}
          </Link>
        )}
      </header>
      <div
        role="group"
        aria-label={t("titulo")}
        className="inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800"
      >
        {(["ventas", "pagos"] as const).map((valor) => (
          <Button
            key={valor}
            variant="outline"
            size="sm"
            aria-pressed={vista === valor}
            onClick={() => establecerVista(valor)}
          >
            {t(valor === "ventas" ? "ventasSaldos" : "pagosInformados")}
          </Button>
        ))}
      </div>
      {vista === "ventas" ? <VentasSupermercado /> : <ListadoPagos />}
    </section>
  );
}

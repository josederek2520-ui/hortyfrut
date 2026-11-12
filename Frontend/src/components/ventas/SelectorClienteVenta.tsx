"use client";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Store as IconoCliente, ArrowRight as IconoElegir } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import PaginadorPedidos from "@/components/pedidos/PaginadorPedidos";
import useConsultaPaginada from "@/hooks/useConsultaPaginada";
import { campoVenta, type ClienteVenta } from "./tipos";

export default function SelectorClienteVenta({
  alElegir,
  alCerrar,
}: {
  alElegir: (cliente: ClienteVenta) => void;
  alCerrar: () => void;
}) {
  const t = useTranslations("ventas"),
    identificador = useId();
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const consulta = useConsultaPaginada<ClienteVenta>(
    "ventas/clientes/?" +
      new URLSearchParams({ buscar, pagina: String(pagina) }),
    () => establecerPagina(1),
  );
  return (
    <Modal
      isOpen
      onClose={alCerrar}
      labelledBy={identificador}
      closeLabel={t("cerrar")}
      className="max-w-xl"
    >
      <div className="p-6 text-gray-900 dark:text-white">
        <h2 id={identificador} className="pe-8 text-xl font-semibold">
          {t("elegirSupermercado")}
        </h2>
        <label className="mt-5 block">
          <span className="sr-only">{t("buscarSupermercado")}</span>
          <input
            autoFocus
            type="search"
            maxLength={150}
            className={campoVenta}
            value={buscar}
            placeholder={t("buscarSupermercado")}
            onChange={(evento) => {
              establecerBuscar(evento.target.value);
              establecerPagina(1);
            }}
          />
        </label>
        <div className="mt-3 max-h-80 min-h-48 overflow-y-auto">
          {consulta.fallo ? (
            <div role="alert" className="space-y-3 py-5">
              <p>{t("errorConsulta")}</p>
              <Button onClick={consulta.recargar}>{t("reintentar")}</Button>
            </div>
          ) : !consulta.datos ? (
            <p role="status" className="py-8">
              {t("cargando")}
            </p>
          ) : !consulta.datos.count ? (
            <p className="py-8 text-sm text-gray-500">{t("sinResultados")}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {consulta.datos.results.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    onClick={() => alElegir(cliente)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-start hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800"
                  >
                    <span className="rounded-xl bg-brand-50 p-2 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                      <IconoCliente className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium break-words">
                        {cliente.nombre}
                      </span>
                      <span className="mt-1 block text-xs text-gray-500">
                        NIT {cliente.nit}
                      </span>
                    </span>
                    <IconoElegir
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {consulta.datos && consulta.datos.count > 10 && (
          <PaginadorPedidos
            pagina={pagina}
            total={consulta.datos.count}
            alCambiar={establecerPagina}
          />
        )}
      </div>
    </Modal>
  );
}

"use client";
import { useLocale, useTranslations } from "next-intl";
import { Search, Plus, RefreshCw } from "lucide-react";
import Button from "@/components/ui/button/Button";
import Paginador from "@/components/compras/PaginadorCompras";
import type { ConversacionChat, PaginaChat } from "@/lib/chat/tipos";
import AvatarChat from "./AvatarChat";

export default function ListaConversacionesChat({
  datos,
  cargando,
  error,
  buscar,
  pagina,
  seleccionada,
  alBuscar,
  alPagina,
  alElegir,
  alNuevo,
  alRecargar,
}: {
  datos: PaginaChat<ConversacionChat> | null;
  cargando: boolean;
  error: boolean;
  buscar: string;
  pagina: number;
  seleccionada: number | null;
  alBuscar: (valor: string) => void;
  alPagina: (valor: number) => void;
  alElegir: (valor: number) => void;
  alNuevo: () => void;
  alRecargar: () => void;
}) {
  const t = useTranslations("chat"),
    idioma = useLocale();
  return (
    <>
      <div className="space-y-4 border-b border-gray-100 p-4 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {t("conversaciones")}
          </h2>
          <Button
            size="sm"
            variant="outline"
            aria-label={t("nuevoChat")}
            onClick={alNuevo}
            startIcon={<Plus className="size-4" />}
          >
            {t("nuevo")}
          </Button>
        </div>
        <label className="relative block">
          <Search
            aria-hidden="true"
            className="absolute start-3 top-3 size-5 text-gray-400"
          />
          <span className="sr-only">{t("buscarConversacion")}</span>
          <input
            type="search"
            value={buscar}
            maxLength={150}
            onChange={(evento) => alBuscar(evento.target.value)}
            placeholder={t("buscarConversacion")}
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-transparent py-2 ps-10 pe-3 text-sm text-gray-900 focus:outline-brand-500 dark:border-gray-700 dark:text-white"
          />
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-busy={cargando}>
        {error ? (
          <div role="alert" className="space-y-3 p-4 text-sm">
            <p>{t("errorConsulta")}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={alRecargar}
              startIcon={<RefreshCw className="size-4" />}
            >
              {t("reintentar")}
            </Button>
          </div>
        ) : !datos && cargando ? (
          <p role="status" className="p-5 text-sm text-gray-500">
            {t("cargando")}
          </p>
        ) : !datos?.count ? (
          <p
            role="status"
            className="p-5 text-sm leading-6 text-gray-500 dark:text-gray-400"
          >
            {t(buscar.trim() ? "sinCoincidencias" : "sinConversaciones")}
          </p>
        ) : (
          <ul className="space-y-1">
            {datos.results.map((conversacion) => (
              <li key={conversacion.id}>
                <button
                  type="button"
                  aria-pressed={conversacion.id === seleccionada}
                  onClick={() => alElegir(conversacion.id)}
                  className={`flex min-h-20 w-full items-center gap-3 rounded-2xl p-3 text-start focus-visible:outline-2 focus-visible:outline-brand-500 ${seleccionada === conversacion.id ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}
                >
                  <AvatarChat nombre={conversacion.usuario.nombre} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {conversacion.usuario.nombre}
                      </span>
                      <time
                        className="shrink-0 text-xs text-gray-500 dark:text-gray-400"
                        dateTime={conversacion.actualizada_en}
                      >
                        {new Intl.DateTimeFormat(idioma, {
                          month: "short",
                          day: "numeric",
                          timeZone: "America/La_Paz",
                        }).format(new Date(conversacion.actualizada_en))}
                      </time>
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="block flex-1 truncate text-xs text-gray-500 dark:text-gray-400">
                        {conversacion.ultimo_mensaje?.texto ??
                          t("primerMensaje")}
                      </span>
                      {conversacion.no_leidos > 0 && (
                        <span className="inline-flex min-w-5 shrink-0 justify-center rounded-full bg-brand-600 px-1 text-xs leading-5 font-semibold text-white">
                          {conversacion.no_leidos > 99
                            ? "99+"
                            : conversacion.no_leidos}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!!datos?.count && (
        <div className="p-3">
          <Paginador
            pagina={pagina}
            total={datos.count}
            ocupado={cargando}
            alCambiar={alPagina}
          />
        </div>
      )}
    </>
  );
}

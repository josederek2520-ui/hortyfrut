"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Paginador from "@/components/compras/PaginadorCompras";
import { api } from "@/lib/api";
import type {
  ConversacionChat,
  PaginaChat,
  UsuarioChat,
} from "@/lib/chat/tipos";
import { useConsultaChat } from "./useConsultaChat";
import AvatarChat from "./AvatarChat";

export default function NuevoChat({
  usuario,
  alCerrar,
  alAbrir,
}: {
  usuario: number;
  alCerrar: () => void;
  alAbrir: (conversacion: ConversacionChat) => void;
}) {
  const t = useTranslations("chat");
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1);
  const [abriendo, establecerAbriendo] = useState<number | null>(null),
    [error, establecerError] = useState(false);
  const consulta = useConsultaChat<PaginaChat<UsuarioChat>>(
    `chat/usuarios/?pagina=${pagina}&buscar=${encodeURIComponent(buscar.trim())}`,
    usuario,
  );
  const elegir = async (identificador: number) => {
    if (abriendo) return;
    establecerAbriendo(identificador);
    establecerError(false);
    try {
      alAbrir(
        await api<ConversacionChat>("chat/conversaciones/", {
          method: "POST",
          body: JSON.stringify({ usuario: identificador }),
          headers: { "X-Usuario-Chat": String(usuario) },
        }),
      );
    } catch {
      establecerError(true);
      establecerAbriendo(null);
    }
  };
  return (
    <Modal
      isOpen
      onClose={() => {
        if (!abriendo) alCerrar();
      }}
      labelledBy="titulo-nuevo-chat"
      closeLabel={t("cerrar")}
      className="mx-3 w-full max-w-lg bg-white p-5 dark:bg-gray-900"
    >
      <h2
        id="titulo-nuevo-chat"
        className="pe-10 text-lg font-semibold text-gray-900 dark:text-white"
      >
        {t("nuevoChat")}
      </h2>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        {t("eligeUsuario")}
      </p>
      <label className="relative mt-5 block">
        <Search className="absolute start-3 top-3 size-5 text-gray-400" />
        <span className="sr-only">{t("buscarUsuario")}</span>
        <input
          data-foco-inicial
          type="search"
          value={buscar}
          disabled={!!abriendo}
          onChange={(evento) => {
            establecerBuscar(evento.target.value);
            establecerPagina(1);
          }}
          placeholder={t("buscarUsuario")}
          className="min-h-11 w-full rounded-xl border border-gray-200 bg-transparent py-2 ps-10 pe-3 text-sm text-gray-900 focus:outline-brand-500 dark:border-gray-700 dark:text-white"
        />
      </label>
      <div className="my-4 max-h-96 min-h-48 overflow-auto">
        {consulta.error || error ? (
          <p
            role="alert"
            className="p-4 text-sm text-error-600 dark:text-error-300"
          >
            {t("errorConsulta")}
          </p>
        ) : consulta.cargando ? (
          <p role="status" className="p-4 text-sm text-gray-500">
            {t("cargando")}
          </p>
        ) : !consulta.datos?.count ? (
          <p role="status" className="p-4 text-sm text-gray-500">
            {t("sinUsuarios")}
          </p>
        ) : (
          <ul className="space-y-1">
            {consulta.datos.results.map((persona) => (
              <li key={persona.id}>
                <button
                  type="button"
                  disabled={!!abriendo}
                  onClick={() => {
                    void elegir(persona.id);
                  }}
                  className="flex min-h-16 w-full items-center gap-3 rounded-xl p-3 text-start text-sm font-medium text-gray-900 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-white dark:hover:bg-brand-500/10"
                >
                  <AvatarChat nombre={persona.nombre} />
                  <span>{persona.nombre}</span>
                  {abriendo === persona.id && (
                    <span className="ms-auto text-xs text-gray-500">
                      {t("abriendo")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!!consulta.datos?.count && (
        <Paginador
          pagina={pagina}
          total={consulta.datos.count}
          alCambiar={establecerPagina}
          ocupado={consulta.cargando || !!abriendo}
        />
      )}
    </Modal>
  );
}

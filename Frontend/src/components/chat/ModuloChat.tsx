"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Session as Sesion } from "@/components/users/types";
import Button from "@/components/ui/button/Button";
import type { ConversacionChat, PaginaChat } from "@/lib/chat/tipos";
import { useChat } from "./ProveedorChat";
import { useConsultaChat } from "./useConsultaChat";
import ControlSonidoChat from "./ControlSonidoChat";
import ListaConversacionesChat from "./ListaConversacionesChat";
import PanelConversacionChat from "./PanelConversacionChat";
import NuevoChat from "./NuevoChat";
import estilos from "./estilosChat.module.css";

const suscribirVista = (avisar: () => void) => {
  const consulta = window.matchMedia("(min-width: 1024px)");
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
};
const vistaEscritorio = () => window.matchMedia("(min-width: 1024px)").matches;
const vistaServidor = () => false;

export default function ModuloChat({ sesion }: { sesion: Sesion }) {
  const t = useTranslations("chat"),
    { cliente, resumen, fase, sonido } = useChat();
  const escritorio = useSyncExternalStore(
    suscribirVista,
    vistaEscritorio,
    vistaServidor,
  );
  const zonaChat = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ajustar = () => {
      const zona = zonaChat.current;
      if (!zona) return;
      const vista = window.visualViewport;
      const inicio = zona.getBoundingClientRect().top - (vista?.offsetTop ?? 0);
      const altura = Math.max(
        240,
        (vista?.height ?? window.innerHeight) - Math.max(0, inicio) - 16,
      );
      zona.style.setProperty("--altura-chat", `${altura}px`);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    window.visualViewport?.addEventListener("resize", ajustar);
    return () => {
      window.removeEventListener("resize", ajustar);
      window.visualViewport?.removeEventListener("resize", ajustar);
    };
  }, [cliente]);
  const [buscar, establecerBuscar] = useState(""),
    [pagina, establecerPagina] = useState(1),
    [seleccion, establecerSeleccion] = useState<number | null>(null);
  const [nuevo, establecerNuevo] = useState(false),
    [borradores, establecerBorradores] = useState<Record<number, string>>({});
  const consulta = useConsultaChat<PaginaChat<ConversacionChat>>(
    cliente?.usuario === sesion.user.id
      ? `chat/conversaciones/?pagina=${pagina}&buscar=${encodeURIComponent(buscar.trim())}`
      : null,
    sesion.user.id,
    resumen?.revision ?? 0,
  );
  const identificador =
    seleccion ?? (escritorio ? (consulta.datos?.results[0]?.id ?? null) : null);
  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t("titulo")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("subtitulo")}
          </p>
        </div>
        <ControlSonidoChat />
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <p
          role="status"
          className={
            fase === "en_vivo"
              ? "text-brand-700 dark:text-brand-300"
              : "text-gray-500 dark:text-gray-400"
          }
        >
          {t(`conexion.${fase}`)}
        </p>
        {["sin_conexion", "acceso_terminado"].includes(fase) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => cliente?.iniciar()}
            startIcon={<RefreshCw className="size-4" />}
          >
            {t("reconectar")}
          </Button>
        )}
        {sonido === "pendiente" && (
          <p className="text-gray-500 dark:text-gray-400">{t("ayudaSonido")}</p>
        )}
      </div>
      {!cliente ||
      cliente.usuario !== sesion.user.id ||
      fase === "acceso_terminado" ? (
        <div
          role="status"
          className="superficie-cristal p-8 text-sm text-gray-500"
        >
          <p>{t("verificandoSesion")}</p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.dispatchEvent(new Event("hortyfru:session-changed"))
              }
            >
              {t("reintentar")}
            </Button>
            <Link
              href="/signin"
              className="text-brand-600 hover:underline dark:text-brand-300"
            >
              {t("iniciarSesion")}
            </Link>
          </div>
        </div>
      ) : (
        <div ref={zonaChat} className={`superficie-cristal ${estilos.chat}`}>
          <aside
            className={`${estilos.lista} ${seleccion !== null ? estilos.ocultoMovil : ""}`}
            aria-label={t("conversaciones")}
          >
            <ListaConversacionesChat
              datos={consulta.datos}
              cargando={consulta.cargando}
              error={consulta.error}
              buscar={buscar}
              pagina={pagina}
              seleccionada={identificador}
              alBuscar={(valor) => {
                establecerBuscar(valor);
                establecerPagina(1);
              }}
              alPagina={establecerPagina}
              alElegir={establecerSeleccion}
              alNuevo={() => establecerNuevo(true)}
              alRecargar={() => {
                establecerPagina(1);
                consulta.recargar();
              }}
            />
          </aside>
          <section
            className={`${estilos.conversacion} ${seleccion === null ? estilos.ocultoMovil : ""}`}
            aria-label={t("mensajes")}
          >
            {identificador ? (
              <PanelConversacionChat
                key={`${cliente.usuario}:${identificador}`}
                identificador={identificador}
                cliente={cliente}
                revision={resumen?.revision ?? 0}
                borrador={borradores[identificador] ?? ""}
                alBorrador={(texto) =>
                  establecerBorradores((anteriores) => ({
                    ...anteriores,
                    [identificador]: texto,
                  }))
                }
                alVolver={() => establecerSeleccion(null)}
                alEnviado={consulta.recargar}
              />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-gray-500 dark:text-gray-400">
                <MessageCircle className="size-12 text-brand-500" />
                <p className="max-w-xs text-sm leading-6">
                  {t("seleccionaConversacion")}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
      {nuevo && cliente?.usuario === sesion.user.id && (
        <NuevoChat
          usuario={cliente.usuario}
          alCerrar={() => establecerNuevo(false)}
          alAbrir={(conversacion) => {
            establecerSeleccion(conversacion.id);
            establecerPagina(1);
            establecerBuscar("");
            establecerNuevo(false);
            consulta.recargar();
          }}
        />
      )}
    </main>
  );
}

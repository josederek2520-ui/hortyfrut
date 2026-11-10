"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Send, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { api } from "@/lib/api";
import type { ClienteChat } from "@/lib/chat/ClienteChat";
import type { PaginaMensajes } from "@/lib/chat/tipos";
import { useConsultaChat } from "./useConsultaChat";
import AvatarChat from "./AvatarChat";
import BurbujaMensajeChat from "./BurbujaMensajeChat";

export default function PanelConversacionChat({
  identificador,
  cliente,
  revision,
  borrador,
  alBorrador,
  alVolver,
  alEnviado,
}: {
  identificador: number;
  cliente: ClienteChat;
  revision: number;
  borrador: string;
  alBorrador: (texto: string) => void;
  alVolver: () => void;
  alEnviado: () => void;
}) {
  const t = useTranslations("chat");
  const [pagina, establecerPagina] = useState(1),
    [corte, establecerCorte] = useState<number | null>(null);
  const [errorEnvio, establecerErrorEnvio] = useState(false),
    [errorLectura, establecerErrorLectura] = useState(false);
  const pendientes = useSyncExternalStore(
    cliente.envios.suscribir,
    cliente.envios.obtenerEstado,
    cliente.envios.obtenerEstado,
  );
  const pendiente = pendientes.get(identificador);
  const ruta = `chat/conversaciones/${identificador}/mensajes/?pagina=${pagina}${pagina > 1 && corte !== null ? `&corte=${corte}` : ""}`;
  const consulta = useConsultaChat<PaginaMensajes>(
    ruta,
    cliente.usuario,
    revision,
  );
  const datos = consulta.datos;
  const panel = useRef<HTMLDivElement>(null),
    anclado = useRef(true);
  const lecturaEnviada = useRef("");
  const mensajes = datos?.results;
  const ultimo = mensajes?.[0]?.id;
  useEffect(() => {
    if (pagina === 1 && anclado.current && panel.current)
      panel.current.scrollTop = panel.current.scrollHeight;
  }, [ultimo, pagina]);
  useEffect(() => {
    if (!mensajes) return;
    const ids = mensajes
      .filter(
        (mensaje) => mensaje.autor !== cliente.usuario && !mensaje.leido_en,
      )
      .map((mensaje) => mensaje.id);
    if (!ids.length) return;
    const clave = ids.join(",");
    const controlador = new AbortController();
    const marcar = () => {
      if (
        document.visibilityState !== "visible" ||
        lecturaEnviada.current === clave
      )
        return;
      lecturaEnviada.current = clave;
      void api(`chat/conversaciones/${identificador}/lectura/`, {
        method: "POST",
        body: JSON.stringify({ mensajes: ids }),
        headers: { "X-Usuario-Chat": String(cliente.usuario) },
        signal: controlador.signal,
      }).catch(() => {
        if (!controlador.signal.aborted) {
          lecturaEnviada.current = "";
          establecerErrorLectura(true);
        }
      });
    };
    marcar();
    document.addEventListener("visibilitychange", marcar);
    return () => {
      controlador.abort();
      if (lecturaEnviada.current === clave) lecturaEnviada.current = "";
      document.removeEventListener("visibilitychange", marcar);
    };
  }, [mensajes, cliente.usuario, identificador]);
  const enviar = async () => {
    establecerErrorEnvio(false);
    try {
      if (pendiente) await cliente.envios.reintentar(identificador);
      else await cliente.envios.enviar(identificador, borrador);
      alBorrador("");
      establecerPagina(1);
      establecerCorte(null);
      anclado.current = true;
      consulta.recargar();
      alEnviado();
    } catch {
      establecerErrorEnvio(true);
    }
  };
  const cambiarPagina = (valor: number) => {
    establecerCorte(datos?.corte ?? null);
    establecerPagina(valor);
    anclado.current = true;
    lecturaEnviada.current = "";
  };
  if (!datos)
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-gray-500"
        role={consulta.error ? "alert" : "status"}
      >
        <p>{t(consulta.error ? "errorConsulta" : "cargando")}</p>
        {consulta.error && (
          <Button size="sm" variant="outline" onClick={consulta.recargar}>
            {t("reintentar")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="lg:hidden"
          onClick={alVolver}
        >
          {t("volver")}
        </Button>
      </div>
    );
  const texto = pendiente?.documento.texto ?? borrador;
  return (
    <>
      <header className="flex min-h-20 items-center gap-3 border-b border-gray-100 px-3 py-3 sm:px-5 dark:border-gray-800">
        <button
          type="button"
          aria-label={t("volver")}
          onClick={alVolver}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-600 focus-visible:outline-brand-500 lg:hidden dark:text-gray-300"
        >
          <ArrowLeft className="size-5 rtl:rotate-180" />
        </button>
        <AvatarChat nombre={datos.conversacion.usuario.nombre} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
            {datos.conversacion.usuario.nombre}
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t(
              datos.conversacion.usuario.activo
                ? "conversacionPrivada"
                : "cuentaInactiva",
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("actualizar")}
          onClick={consulta.recargar}
          className="inline-flex size-11 items-center justify-center rounded-xl text-gray-500 focus-visible:outline-brand-500 dark:text-gray-300"
        >
          <RefreshCw className="size-4" />
        </button>
      </header>
      <div
        ref={panel}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"
        onScroll={() => {
          const zona = panel.current;
          if (zona)
            anclado.current =
              zona.scrollHeight - zona.scrollTop - zona.clientHeight < 100;
        }}
      >
        {datos.count ? (
          <ul className="space-y-5" aria-label={t("mensajes")}>
            {[...datos.results].reverse().map((mensaje) => (
              <BurbujaMensajeChat
                key={mensaje.id}
                mensaje={mensaje}
                propio={mensaje.autor === cliente.usuario}
              />
            ))}
          </ul>
        ) : (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("primerMensaje")}
          </p>
        )}
        {pendiente &&
          !datos.results.some(
            (mensaje) =>
              mensaje.clave_cliente === pendiente.documento.clave_cliente,
          ) && (
            <div className="mt-5 flex justify-end">
              <div className="max-w-[88%] rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-100">
                <p className="wrap-anywhere whitespace-pre-wrap">
                  {pendiente.documento.texto}
                </p>
                <p role="status" className="mt-1 text-xs">
                  {t(
                    pendiente.fase === "enviando" ? "enviando" : "porComprobar",
                  )}
                </p>
              </div>
            </div>
          )}
      </div>
      {datos.count > 10 && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <Button
            size="sm"
            variant="outline"
            disabled={
              consulta.cargando || pagina >= Math.ceil(datos.count / 10)
            }
            onClick={() => cambiarPagina(pagina + 1)}
          >
            {t("mensajesAnteriores")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={consulta.cargando || pagina <= 1}
            onClick={() => cambiarPagina(pagina - 1)}
          >
            {t("mensajesRecientes")}
          </Button>
        </div>
      )}
      {(errorEnvio ||
        (errorLectura &&
          datos.results.some(
            (mensaje) => mensaje.autor !== cliente.usuario && !mensaje.leido_en,
          ))) && (
        <p
          role="alert"
          className="px-4 py-2 text-xs text-error-600 dark:text-error-300"
        >
          {t(
            errorEnvio
              ? pendiente
                ? "envioIncierto"
                : "errorEnvio"
              : "errorLectura",
          )}
        </p>
      )}
      <form
        className="border-t border-gray-100 p-3 sm:p-4 dark:border-gray-800"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("escribeMensaje")}</span>
            <textarea
              value={texto}
              rows={2}
              maxLength={2000}
              disabled={!datos.conversacion.usuario.activo || !!pendiente}
              onChange={(evento) => alBorrador(evento.target.value)}
              placeholder={t("escribeMensaje")}
              className="max-h-32 min-h-12 w-full resize-none rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm leading-6 text-gray-900 focus:outline-brand-500 disabled:opacity-60 dark:border-gray-700 dark:text-white"
            />
          </label>
          <Button
            type="submit"
            size="sm"
            disabled={
              !datos.conversacion.usuario.activo ||
              pendiente?.fase === "enviando" ||
              !texto.trim()
            }
            aria-label={t(
              pendiente?.fase === "pendiente" ? "comprobarEnvio" : "enviar",
            )}
            startIcon={
              pendiente?.fase === "pendiente" ? (
                <RefreshCw className="size-5" />
              ) : (
                <Send className="size-5 rtl:rotate-180" />
              )
            }
          >
            <span className="hidden sm:inline">
              {t(pendiente?.fase === "pendiente" ? "comprobarEnvio" : "enviar")}
            </span>
          </Button>
        </div>
        <p className="mt-1 text-end text-xs text-gray-400">
          {texto.length}/2000
        </p>
      </form>
    </>
  );
}

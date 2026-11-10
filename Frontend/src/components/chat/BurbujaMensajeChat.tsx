"use client";
import { Check, CheckCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MensajeChat } from "@/lib/chat/tipos";
export default function BurbujaMensajeChat({
  mensaje,
  propio,
}: {
  mensaje: MensajeChat;
  propio: boolean;
}) {
  const idioma = useLocale(),
    t = useTranslations("chat");
  const hora = new Intl.DateTimeFormat(idioma, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/La_Paz",
  }).format(new Date(mensaje.creado_en));
  return (
    <li className={`flex ${propio ? "justify-end" : "justify-start"}`}>
      <div className="max-w-[88%] sm:max-w-[75%]">
        <p
          className={`rounded-2xl px-4 py-3 text-sm leading-6 wrap-anywhere whitespace-pre-wrap ${propio ? "rounded-ee-md bg-brand-600 text-white" : "rounded-es-md bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"}`}
        >
          {mensaje.texto}
        </p>
        <div
          className={`mt-1 flex items-center gap-1.5 px-1 text-xs text-gray-500 dark:text-gray-400 ${propio ? "justify-end" : ""}`}
        >
          <time dateTime={mensaje.creado_en}>{hora}</time>
          {propio && (
            <span
              title={t(mensaje.leido_en ? "leido" : "enviado")}
              aria-label={t(mensaje.leido_en ? "leido" : "enviado")}
            >
              {mensaje.leido_en ? (
                <CheckCheck className="size-4 text-brand-600 dark:text-brand-300" />
              ) : (
                <Check className="size-4" />
              )}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

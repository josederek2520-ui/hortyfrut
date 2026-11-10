"use client";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useChat } from "./ProveedorChat";
export default function IndicadorChat() {
  const t = useTranslations("chat");
  const { cliente, resumen } = useChat();
  if (!cliente) return null;
  const cantidad = resumen?.no_leidos ?? 0;
  return (
    <Link
      href="/chat"
      aria-label={t("abrirConCantidad", { cantidad })}
      className="control-suave-hortyfru relative inline-flex size-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
    >
      <MessageCircle className="size-5" />
      {cantidad > 0 && (
        <span className="absolute -end-1 -top-1 min-w-5 rounded-full bg-brand-600 px-1 text-center text-xs leading-5 font-semibold text-white">
          {cantidad > 99 ? "99+" : cantidad}
        </span>
      )}
    </Link>
  );
}

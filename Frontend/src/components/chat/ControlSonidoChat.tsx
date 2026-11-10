"use client";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { useChat } from "./ProveedorChat";
export default function ControlSonidoChat() {
  const t = useTranslations("chat"),
    { cliente, sonido } = useChat();
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={!cliente}
        aria-pressed={sonido === "activo"}
        startIcon={
          sonido === "activo" ? (
            <Volume2 className="size-4" />
          ) : (
            <VolumeX className="size-4" />
          )
        }
        onClick={() => {
          if (sonido === "activo") cliente?.sonido.silenciar();
          else void cliente?.sonido.activar();
        }}
      >
        {t(sonido === "activo" ? "silenciar" : "activarSonido")}
      </Button>
      {sonido === "pendiente" && (
        <button
          type="button"
          disabled={!cliente}
          aria-label={t("silenciar")}
          title={t("silenciar")}
          onClick={() => cliente?.sonido.silenciar()}
          className="inline-flex size-11 items-center justify-center rounded-xl text-gray-500 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-gray-300"
        >
          <VolumeX className="size-4" />
        </button>
      )}
    </div>
  );
}

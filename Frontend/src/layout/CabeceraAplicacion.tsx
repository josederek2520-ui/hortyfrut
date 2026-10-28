"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import CuentaSesion from "@/components/auth/SessionAccount";
import {
  IconoPanelLateral,
  IconoMasOpciones,
  CloseIcon,
  SearchIcon,
} from "@/icons";
import { cn } from "@/utils";

export default function CabeceraAplicacion() {
  const t = useTranslations("header");
  const entradaBusqueda = useRef<HTMLInputElement>(null);
  const [cuentaAbierta, establecerCuentaAbierta] = useState(false);
  const {
    isExpanded: expandido,
    isMobileOpen: movilAbierto,
    toggleSidebar: alternarPanel,
    toggleMobileSidebar: alternarPanelMovil,
  } = useSidebar();
  const alternarNavegacion = () => {
    if (window.innerWidth >= 1280) alternarPanel();
    else alternarPanelMovil();
  };
  useEffect(() => {
    const enfocarBusqueda = (evento: KeyboardEvent) => {
      if (
        (evento.metaKey || evento.ctrlKey) &&
        evento.key.toLowerCase() === "k"
      ) {
        evento.preventDefault();
        entradaBusqueda.current?.focus();
      }
    };
    document.addEventListener("keydown", enfocarBusqueda);
    return () => document.removeEventListener("keydown", enfocarBusqueda);
  }, []);
  return (
    <header className="superficie-cristal barra-superior-hortyfru sticky z-30 flex w-full">
      <div className="flex min-w-0 grow flex-col items-center justify-between xl:flex-row xl:px-5">
        <div className="flex w-full min-w-0 items-center justify-between gap-3 px-3 py-2.5 sm:gap-4 xl:justify-start xl:px-0 xl:py-3">
          {[
            { movil: true, abierto: movilAbierto },
            { movil: false, abierto: expandido },
          ].map(({ movil, abierto }) => (
            <button
              key={movil ? "movil" : "escritorio"}
              type="button"
              className={cn(
                "size-11 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/40 text-gray-700 transition-colors hover:bg-white/80 focus-visible:outline-2 focus-visible:outline-brand-400 dark:border-gray-700 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10",
                movil ? "inline-flex xl:hidden" : "hidden xl:inline-flex",
              )}
              onClick={alternarNavegacion}
              aria-label={t("toggleSidebar")}
              aria-controls="navegacion-principal"
              aria-expanded={abierto}
            >
              {movil && abierto ? (
                <CloseIcon className="size-5" />
              ) : (
                <IconoPanelLateral className="size-5 rtl:-scale-x-100" />
              )}
            </button>
          ))}
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-brand-400 xl:hidden"
            aria-label="HortyFru"
          >
            <MarcaHortyfru pequena />
          </Link>
          <button
            type="button"
            onClick={() => establecerCuentaAbierta(!cuentaAbierta)}
            aria-label={t("mostrarCuenta")}
            aria-expanded={cuentaAbierta}
            aria-controls="cuenta-cabecera"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-700 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-brand-400 xl:hidden dark:text-gray-200 dark:hover:bg-white/10"
          >
            <IconoMasOpciones className="size-5" />
          </button>
          <form
            role="search"
            onSubmit={(evento) => evento.preventDefault()}
            className="hidden min-w-0 flex-1 xl:block"
          >
            <div className="relative max-w-md">
              <SearchIcon className="pointer-events-none absolute start-3.5 top-3.5 size-4.5 text-gray-500 dark:text-gray-400" />
              <input
                ref={entradaBusqueda}
                type="search"
                aria-label={t("searchPlaceholder")}
                placeholder={t("searchPlaceholder")}
                className="h-11 w-full rounded-xl border border-white/70 bg-white/40 py-2.5 ps-11 pe-16 text-sm text-gray-800 outline-none placeholder:text-gray-500 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-white/5 dark:text-gray-100 dark:placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => entradaBusqueda.current?.focus()}
                tabIndex={-1}
                aria-label={t("searchPlaceholder")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-lg border border-gray-200/70 bg-white/50 px-2 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-white/5 dark:text-gray-400"
              >
                Ctrl K
              </button>
            </div>
          </form>
        </div>
        <div
          id="cuenta-cabecera"
          className={cn(
            "w-full shrink-0 items-center justify-between gap-5 border-t border-white/50 px-4 py-3 xl:flex xl:w-auto xl:justify-end xl:border-0 xl:ps-6 xl:pe-0 dark:border-gray-700",
            cuentaAbierta ? "flex" : "hidden",
          )}
        >
          <div className="flex items-center gap-3">
            <ThemeToggleButton />
            <NotificationDropdown />
          </div>
          <CuentaSesion />
        </div>
      </div>
    </header>
  );
}

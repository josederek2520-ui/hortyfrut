"use client";

import { useSidebar } from "@/context/SidebarContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";

export default function DisposicionAplicacion({
  children,
  modoChofer = false,
  alSalir,
  rutaInicio,
}: {
  children: React.ReactNode;
  modoChofer?: boolean;
  alSalir?: () => Promise<void>;
  rutaInicio?: string;
}) {
  const {
    isExpanded: expandido,
    isHovered: conCursor,
    isMobileOpen: menuMovilAbierto,
  } = useSidebar();

  const margenContenido = menuMovilAbierto
    ? "ms-0"
    : expandido || conCursor
      ? "xl:ms-76"
      : "xl:ms-26";

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      <div
        className={`min-w-0 flex-1 px-3 transition-all duration-300 ease-in-out motion-reduce:transition-none sm:px-4 ${margenContenido}`}
      >
        <AppHeader
          modoChofer={modoChofer}
          alSalir={alSalir}
          rutaInicio={rutaInicio}
        />
        <div className="mx-auto max-w-(--breakpoint-2xl) py-6 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}

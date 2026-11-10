"use client";
import type { ReactNode } from "react";
import DisposicionAplicacion from "@/layout/DisposicionAplicacion";
import { useChofer } from "./ProveedorChofer";

export default function NavegacionChofer({
  children,
}: {
  children: ReactNode;
}) {
  const { salir } = useChofer();
  return (
    <DisposicionAplicacion modoChofer alSalir={salir}>
      {children}
    </DisposicionAplicacion>
  );
}

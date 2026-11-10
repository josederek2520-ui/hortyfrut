"use client";

import type { ReactNode } from "react";
import DisposicionAplicacion from "@/layout/DisposicionAplicacion";

export default function DisposicionAdministracion({
  children,
}: {
  children: ReactNode;
}) {
  return <DisposicionAplicacion>{children}</DisposicionAplicacion>;
}

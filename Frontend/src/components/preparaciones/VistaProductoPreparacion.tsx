import type { ReactNode } from "react";
import VistaAnimadaPreparacion from "./VistaAnimadaPreparacion";
import estilos from "./estilosTrabajo.module.css";

export default function VistaProductoPreparacion({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <VistaAnimadaPreparacion visible clave="preparar-producto">
      <section
        id="vista-producto-preparacion"
        aria-labelledby="nombre-producto-preparacion"
        className={`${estilos.vistaProducto} overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700`}
      >
        {children}
      </section>
    </VistaAnimadaPreparacion>
  );
}

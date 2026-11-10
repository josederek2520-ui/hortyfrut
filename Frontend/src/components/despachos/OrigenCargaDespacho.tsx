"use client";
import TransporteFormulario, {
  type DatosTransporteDespacho,
} from "./TransporteFormularioDespacho";
export default function OrigenCargaDespacho(props: {
  datos: DatosTransporteDespacho;
  bloqueado: boolean;
  errores: Record<string, string[]>;
  alCambiar: (cambios: Partial<DatosTransporteDespacho>) => void;
  alError: (error: unknown) => void;
}) {
  return <TransporteFormulario {...props} seccion="origen" />;
}

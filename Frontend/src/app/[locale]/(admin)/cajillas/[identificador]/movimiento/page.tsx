import PaginaCajillas, {metadatosCajillas} from "@/components/cajillas/PaginaCajillas";
export const generateMetadata = () => metadatosCajillas("nuevoMovimiento");
export default async function PaginaMovimientoCajilla({params, searchParams}: {
  params: Promise<{locale: string; identificador: string}>;
  searchParams: Promise<{tipo?: string | string[]; sucursal?: string | string[]}>;
}) {
  const {locale: idioma, identificador} = await params;
  const {tipo, sucursal} = await searchParams;
  const tipoMovimiento = tipo === "salida" || tipo === "devolucion" ? tipo : "ingreso";
  const sucursalInicial = typeof sucursal === "string" && /^[0-9]{1,15}$/.test(sucursal) && Number(sucursal) > 0 ? Number(sucursal) : undefined;
  return <PaginaCajillas idioma={idioma} modo="movimiento" identificador={identificador} tipo={tipoMovimiento} sucursalInicial={sucursalInicial} />;
}

import PaginaCompras, {
  metadatosCompras,
} from "@/components/compras/PaginaCompras";
export const generateMetadata = () => metadatosCompras("titulo");
export default async function PaginaListadoCompras({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ fecha_pedidos?: string | string[] }>;
}) {
  const { locale: idioma } = await params;
  const { fecha_pedidos: fecha } = await searchParams;
  const fechaInicial =
    typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
      ? fecha
      : undefined;
  return <PaginaCompras idioma={idioma} fechaInicial={fechaInicial} />;
}

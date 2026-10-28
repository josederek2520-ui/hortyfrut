import PaginaPreparaciones, {metadatosPreparaciones} from "@/components/preparaciones/PaginaPreparaciones";
export const generateMetadata = () => metadatosPreparaciones("titulo");
export default async function PaginaListadoPreparaciones({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {locale: idioma} = await params;
  const valores = await searchParams;
  const cliente = typeof valores.cliente === "string" ? Number(valores.cliente) : undefined;
  const fecha = typeof valores.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valores.fecha)
    ? valores.fecha : undefined;
  return <PaginaPreparaciones idioma={idioma} modo="listado" historial={valores.historial === "1"}
    cliente={cliente !== undefined && Number.isSafeInteger(cliente) && cliente > 0 ? cliente : undefined}
    fecha={fecha} />;
}

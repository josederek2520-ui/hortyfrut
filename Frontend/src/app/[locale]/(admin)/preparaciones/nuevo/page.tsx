import PaginaPreparaciones, {metadatosPreparaciones} from "@/components/preparaciones/PaginaPreparaciones";
export const generateMetadata = () => metadatosPreparaciones("nuevaPreparacion");
export default async function PaginaNuevoPreparaciones({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {locale: idioma} = await params;
  const valores = await searchParams;
  const cliente = typeof valores.cliente === "string" && /^[0-9]{1,15}$/.test(valores.cliente) ? Number(valores.cliente) : undefined;
  const fecha = typeof valores.fecha_pedidos === "string" ? valores.fecha_pedidos : undefined;
  return <PaginaPreparaciones idioma={idioma} modo="nuevo"  cliente={cliente} fecha={fecha} />;
}

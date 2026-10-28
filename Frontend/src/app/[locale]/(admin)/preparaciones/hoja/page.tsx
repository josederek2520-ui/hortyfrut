import PaginaPreparaciones, {metadatosPreparaciones} from "@/components/preparaciones/PaginaPreparaciones";
export const generateMetadata = () => metadatosPreparaciones("imprimirHoja");
export default async function PaginaHojaPreparaciones({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {locale: idioma} = await params;
  const valores = await searchParams;
  const consulta = new URLSearchParams();
  for (const campo of ["cliente", "fecha_pedidos", "categoria", "buscar", "vista"]) { const valor = valores[campo]; if (typeof valor === "string") consulta.set(campo, valor); }
  return <PaginaPreparaciones idioma={idioma} modo="hoja"  consulta={consulta.toString()} />;
}

import PaginaPreparaciones, {metadatosPreparaciones} from "@/components/preparaciones/PaginaPreparaciones";
export const generateMetadata = () => metadatosPreparaciones("detalle");
export default async function PaginaDetallePreparaciones({params, searchParams}: {params: Promise<{locale: string; identificador: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {locale: idioma, identificador} = await params;
  const valores = await searchParams;
  return <PaginaPreparaciones idioma={idioma} modo="detalle" identificador={identificador} confirmarInicial={valores.confirmar === "1"} />;
}

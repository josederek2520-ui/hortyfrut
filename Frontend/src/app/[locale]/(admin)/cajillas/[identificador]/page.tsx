import PaginaCajillas, {metadatosCajillas} from "@/components/cajillas/PaginaCajillas";
export const generateMetadata = () => metadatosCajillas("detalle");
export default async function PaginaDetalleCajilla({params}: {params: Promise<{locale: string; identificador: string}>}) {
  const {locale: idioma, identificador} = await params;
  return <PaginaCajillas idioma={idioma} modo="detalle" identificador={identificador} />;
}

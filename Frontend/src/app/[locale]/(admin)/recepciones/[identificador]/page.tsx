import PaginaRecepciones, {metadatosRecepciones} from "@/components/recepciones/PaginaRecepciones";
export const generateMetadata = () => metadatosRecepciones("detalle");
export default async function PaginaDetalleRecepciones({params}: {params: Promise<{locale: string; identificador: string}>}) {
  const {locale: idioma, identificador} = await params;
  return <PaginaRecepciones idioma={idioma} modo="detalle" identificador={identificador} />;
}

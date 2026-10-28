import PaginaRecepciones, {metadatosRecepciones} from "@/components/recepciones/PaginaRecepciones";
export const generateMetadata = () => metadatosRecepciones("editar");
export default async function PaginaEditarRecepciones({params}: {params: Promise<{locale: string; identificador: string}>}) {
  const {locale: idioma, identificador} = await params;
  return <PaginaRecepciones idioma={idioma} modo="editar" identificador={identificador} />;
}

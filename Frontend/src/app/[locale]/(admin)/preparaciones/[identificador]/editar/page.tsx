import PaginaPreparaciones, {metadatosPreparaciones} from "@/components/preparaciones/PaginaPreparaciones";
export const generateMetadata = () => metadatosPreparaciones("editarPreparacion");
export default async function PaginaEditarPreparaciones({params}: {params: Promise<{locale: string; identificador: string}>}) {
  const {locale: idioma, identificador} = await params;
  return <PaginaPreparaciones idioma={idioma} modo="editar" identificador={identificador} />;
}

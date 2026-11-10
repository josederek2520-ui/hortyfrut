import PaginaLogistica, {
  metadatosLogistica,
} from "@/components/logistica/PaginaLogistica";
export const generateMetadata = () => metadatosLogistica("despachos");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaLogistica
      idioma={idioma}
      modulo="despachos"
      modo="editar"
      identificador={identificador}
    />
  );
}

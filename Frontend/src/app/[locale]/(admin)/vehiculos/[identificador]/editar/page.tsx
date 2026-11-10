import PaginaLogistica, {
  metadatosLogistica,
} from "@/components/logistica/PaginaLogistica";
export const generateMetadata = () => metadatosLogistica("vehiculos");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale: idioma, identificador } = await params;
  return (
    <PaginaLogistica
      idioma={idioma}
      modulo="vehiculos"
      modo="editar"
      identificador={identificador}
    />
  );
}

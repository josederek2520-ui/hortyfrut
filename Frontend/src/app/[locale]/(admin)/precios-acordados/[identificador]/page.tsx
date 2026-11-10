import PaginaPrecios, {
  metadatosPrecios,
} from "@/components/precios/PaginaPrecios";
export const generateMetadata = metadatosPrecios;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale, identificador } = await params;
  return (
    <PaginaPrecios
      idioma={locale}
      modo="detalle"
      identificador={identificador}
    />
  );
}

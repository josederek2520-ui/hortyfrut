import PaginaCobros, {
  metadatosCobros,
} from "@/components/cobros/PaginaCobros";
export const generateMetadata = metadatosCobros;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale, identificador } = await params;
  return (
    <PaginaCobros
      idioma={locale}
      modo="detalle"
      identificador={identificador}
    />
  );
}

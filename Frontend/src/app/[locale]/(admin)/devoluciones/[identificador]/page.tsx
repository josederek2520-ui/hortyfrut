import PaginaDevoluciones, {
  metadatosDevoluciones,
} from "@/components/devoluciones/PaginaDevoluciones";
export const generateMetadata = metadatosDevoluciones;
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale, identificador } = await params;
  return (
    <PaginaDevoluciones
      idioma={locale}
      modo="detalle"
      identificador={identificador}
    />
  );
}

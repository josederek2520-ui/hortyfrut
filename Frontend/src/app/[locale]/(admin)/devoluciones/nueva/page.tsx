import PaginaDevoluciones, {
  metadatosDevoluciones,
} from "@/components/devoluciones/PaginaDevoluciones";
export const generateMetadata = metadatosDevoluciones;
export default async function Pagina({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ entrega?: string | string[] }>;
}) {
  const [{ locale }, { entrega }] = await Promise.all([params, searchParams]);
  return <PaginaDevoluciones idioma={locale} modo="nueva" entrega={entrega} />;
}

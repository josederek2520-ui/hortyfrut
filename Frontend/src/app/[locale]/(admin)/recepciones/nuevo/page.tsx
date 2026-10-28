import PaginaRecepciones, {metadatosRecepciones} from "@/components/recepciones/PaginaRecepciones";
export const generateMetadata = () => metadatosRecepciones("nueva");
export default async function PaginaNuevoRecepciones({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{compra?: string | string[]}>}) {
  const {locale: idioma} = await params;
  const {compra} = await searchParams;
  const compraInicial = typeof compra === "string" && /^[0-9]{1,15}$/.test(compra) && Number(compra) > 0 ? Number(compra) : undefined;
  return <PaginaRecepciones idioma={idioma} modo="nuevo" compraInicial={compraInicial} />;
}

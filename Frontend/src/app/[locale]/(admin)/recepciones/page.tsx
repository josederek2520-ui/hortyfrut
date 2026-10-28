import PaginaRecepciones, {metadatosRecepciones} from "@/components/recepciones/PaginaRecepciones";
export const generateMetadata = () => metadatosRecepciones("titulo");
export default async function PaginaListadoRecepciones({params, searchParams}: {params: Promise<{locale: string}>; searchParams: Promise<{compra?: string | string[]}>}) {
  const {locale: idioma} = await params;
  const {compra} = await searchParams;
  const compraInicial = typeof compra === "string" && /^[0-9]{1,15}$/.test(compra) && Number(compra) > 0 ? Number(compra) : undefined;
  return <PaginaRecepciones idioma={idioma} modo="listado" compraInicial={compraInicial} />;
}

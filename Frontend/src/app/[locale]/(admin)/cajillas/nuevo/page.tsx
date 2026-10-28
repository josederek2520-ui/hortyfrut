import PaginaCajillas, {metadatosCajillas} from "@/components/cajillas/PaginaCajillas";
export const generateMetadata = () => metadatosCajillas("nuevoColor");
export default async function PaginaNuevoColorCajilla({params}: {params: Promise<{locale: string}>}) {
  const {locale: idioma} = await params;
  return <PaginaCajillas idioma={idioma} modo="nuevo" />;
}

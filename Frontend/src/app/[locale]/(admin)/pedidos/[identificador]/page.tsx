import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { metadatosPedidos } from "@/components/pedidos/PaginaPedidos";
export const generateMetadata = () => metadatosPedidos("titulo");
export default async function Pagina({
  params,
}: {
  params: Promise<{ locale: string; identificador?: string }>;
}) {
  const { locale: idioma } = await params;
  setRequestLocale(idioma);
  redirect({ href: "/pedidos", locale: idioma });
}

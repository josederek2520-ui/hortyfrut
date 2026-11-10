import { setRequestLocale, getTranslations } from "next-intl/server";
import ListaViajesChofer from "@/components/chofer/ListaViajesChofer";
import NavegacionChofer from "@/components/chofer/NavegacionChofer";
export async function generateMetadata() {
  const t = await getTranslations("chofer");
  return { title: `${t("titulo")} | HortyFru` };
}
export default async function PaginaViajes({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return (
    <NavegacionChofer>
      <ListaViajesChofer />
    </NavegacionChofer>
  );
}

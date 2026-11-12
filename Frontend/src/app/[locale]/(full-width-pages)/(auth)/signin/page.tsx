import FormularioInicioSesion from "@/components/auth/FormularioInicioSesion";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("users.auth");
  return { title: `${t("signIn")} | HortyFru`, description: t("subtitle") };
}

export default function PaginaInicioSesion() {
  return <FormularioInicioSesion />;
}

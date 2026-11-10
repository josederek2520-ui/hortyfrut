import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import PantallaMapaChofer from "@/components/chofer/PantallaMapaChofer";
export default async function PaginaMapa({
  params,
}: {
  params: Promise<{ locale: string; identificador: string }>;
}) {
  const { locale, identificador } = await params;
  setRequestLocale(locale);
  if (
    !/^[1-9]\d*$/.test(identificador) ||
    !Number.isSafeInteger(Number(identificador))
  )
    notFound();
  return (
    <PantallaMapaChofer
      key={identificador}
      identificador={Number(identificador)}
    />
  );
}

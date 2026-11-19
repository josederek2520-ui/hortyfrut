"use client";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import useConsultaComercial from "@/components/comercial/useConsultaComercial";
import FormularioDatosEmpresa from "./FormularioDatosEmpresa";
import type { DatosEmpresa } from "./tipos";

export default function GestionDatosEmpresa({
  editable,
}: {
  editable: boolean;
}) {
  const t = useTranslations("comercialComun"),
    consulta = useConsultaComercial<DatosEmpresa>("datos-empresa/");
  if (!consulta.sesionValida) return <p role="alert">{t("sinAcceso")}</p>;
  if (consulta.fallo)
    return (
      <div role="alert">
        <p>{t("errorConsulta")}</p>
        <Button onClick={consulta.recargar}>{t("reintentar")}</Button>
      </div>
    );
  if (!consulta.datos) return <p role="status">{t("cargando")}</p>;
  return (
    <FormularioDatosEmpresa
      key={consulta.datos.version}
      inicial={consulta.datos}
      editable={editable}
      alRecargar={consulta.recargar}
    />
  );
}

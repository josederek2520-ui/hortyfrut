import FormularioInicioSesion from "@/components/auth/FormularioInicioSesion";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "HortyFru",
  description: "HortyFru",
};

export default function PaginaInicioSesion() {
  return <FormularioInicioSesion />;
}

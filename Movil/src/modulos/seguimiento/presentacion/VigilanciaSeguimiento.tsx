import { useEffect } from "react";
import { AppState } from "react-native";
import { gestorSeguimiento } from "@/composicion/dependencias";

export default function VigilanciaSeguimiento() {
  useEffect(() => {
    gestorSeguimiento.establecerPrimerPlano(AppState.currentState === "active");
    const escucha = AppState.addEventListener("change", (estado) => {
      gestorSeguimiento.establecerPrimerPlano(estado === "active");
    });
    return () => {
      escucha.remove();
      gestorSeguimiento.establecerPrimerPlano(false);
    };
  }, []);
  return null;
}

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { servicioSesion } from "@/composicion/dependencias";
import type { EstadoSesion } from "../dominio/Sesion";

const Contexto = createContext<EstadoSesion | null>(null);
export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const estado = useSyncExternalStore(
    servicioSesion.suscribir,
    servicioSesion.obtenerEstado,
    servicioSesion.obtenerEstado,
  );
  useEffect(() => {
    void servicioSesion.restaurar();
  }, []);
  useEffect(() => {
    if (!estado.sesion) return;
    const vence = Date.parse(estado.sesion.venceEn);
    const expirar = () => {
      if (Date.now() >= vence) void servicioSesion.expirar().catch(() => {});
    };
    const temporizador = setTimeout(
      expirar,
      Math.max(0, vence - Date.now()) + 25,
    );
    const escucha = AppState.addEventListener("change", (valor) => {
      if (valor === "active") expirar();
    });
    return () => {
      clearTimeout(temporizador);
      escucha.remove();
    };
  }, [estado.sesion]);
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}
export function usarSesion() {
  const valor = useContext(Contexto);
  if (!valor) throw Error("Falta ProveedorSesion");
  return { ...valor, servicio: servicioSesion };
}

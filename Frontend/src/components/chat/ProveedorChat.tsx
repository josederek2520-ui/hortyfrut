"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { Session as Sesion } from "@/components/users/types";
import { useToast } from "@/hooks/useToast";
import ToastViewport from "@/components/ui/toast/ToastViewport";
import { ClienteChat } from "@/lib/chat/ClienteChat";
import type { EstadoChat } from "@/lib/chat/tipos";

const estadoVacio: EstadoChat = {
  fase: "inactivo",
  resumen: null,
  sonido: "pendiente",
};
const sinCambios = () => () => {};
const ContextoChat = createContext<ClienteChat | null>(null);

export default function ProveedorChat({ children }: { children: ReactNode }) {
  const t = useTranslations("chat");
  const { toasts, notify, dismiss } = useToast();
  const [cliente, establecerCliente] = useState<ClienteChat | null>(null);
  const clienteActual = useRef<ClienteChat | null>(null);
  const avisar = useRef((nombre: string) =>
    notify(t("nuevoMensaje", { nombre }), "info"),
  );
  useEffect(() => {
    avisar.current = (nombre) => notify(t("nuevoMensaje", { nombre }), "info");
  }, [t, notify]);
  useEffect(() => {
    let vigente = true,
      generacion = 0,
      ultimoControl = 0;
    let controlador: AbortController | null = null;
    const verificar = async (forzar = false) => {
      if (!forzar && Date.now() - ultimoControl < 5000) return;
      ultimoControl = Date.now();
      const turno = ++generacion;
      controlador?.abort();
      controlador = new AbortController();
      try {
        const sesion = await api<Sesion>("auth/me/", {
          signal: controlador.signal,
        });
        if (!vigente || turno !== generacion) return;
        if (!sesion.user.is_active) throw new ApiError(403);
        if (!forzar && clienteActual.current?.usuario === sesion.user.id) {
          if (
            ["sin_conexion", "acceso_terminado"].includes(
              clienteActual.current.obtenerEstado().fase,
            )
          )
            clienteActual.current.iniciar();
          return;
        }
        clienteActual.current?.cerrar();
        const nuevo = new ClienteChat(sesion.user.id, (aviso) =>
          avisar.current(aviso.autor.nombre),
        );
        clienteActual.current = nuevo;
        establecerCliente(nuevo);
        nuevo.iniciar();
      } catch (error) {
        if (!vigente || turno !== generacion || controlador?.signal.aborted)
          return;
        if (!(error instanceof ApiError && [401, 403].includes(error.status)))
          return;
        clienteActual.current?.cerrar();
        clienteActual.current = null;
        establecerCliente(null);
      }
    };
    const enfocar = () => {
      void verificar();
    };
    const cambiar = () => {
      clienteActual.current?.cerrar();
      clienteActual.current = null;
      establecerCliente(null);
      void verificar(true);
    };
    const otraCuenta = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") cambiar();
    };
    void verificar();
    window.addEventListener("focus", enfocar);
    window.addEventListener("online", enfocar);
    window.addEventListener("hortyfru:session-changed", cambiar);
    window.addEventListener("storage", otraCuenta);
    return () => {
      vigente = false;
      ++generacion;
      controlador?.abort();
      clienteActual.current?.cerrar();
      window.removeEventListener("focus", enfocar);
      window.removeEventListener("online", enfocar);
      window.removeEventListener("hortyfru:session-changed", cambiar);
      window.removeEventListener("storage", otraCuenta);
    };
  }, []);
  return (
    <ContextoChat.Provider value={cliente}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ContextoChat.Provider>
  );
}
export function useChat() {
  const cliente = useContext(ContextoChat);
  const estado = useSyncExternalStore(
    cliente?.suscribir ?? sinCambios,
    cliente?.obtenerEstado ?? (() => estadoVacio),
    () => estadoVacio,
  );
  return { cliente, ...estado };
}

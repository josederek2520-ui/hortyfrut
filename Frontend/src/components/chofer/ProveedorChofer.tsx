"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import type { Session } from "@/components/users/types";
import Button from "@/components/ui/button/Button";
import { ClienteApi } from "@/lib/chofer/infraestructura/api/ClienteApi";
import { RepositorioDespachosHttp } from "@/lib/chofer/modulos/despachos/datos/RepositorioDespachosHttp";
import { RepositorioRutasHttp } from "@/lib/chofer/modulos/recorrido/datos/RepositorioRutasHttp";
import { GestorRutas } from "@/lib/chofer/modulos/recorrido/aplicacion/GestorRutas";
import { GestorOperaciones } from "@/lib/chofer/modulos/recorrido/aplicacion/GestorOperaciones";
import { GestorSeguimiento } from "@/lib/chofer/modulos/seguimiento/aplicacion/GestorSeguimiento";
import { RepositorioSeguimientoHttp } from "@/lib/chofer/modulos/seguimiento/datos/RepositorioSeguimientoHttp";
import { LocalizadorNavegador } from "@/lib/chofer/modulos/seguimiento/datos/LocalizadorNavegador";
import { crearClaveOperacion } from "@/lib/chofer/infraestructura/crearClaveOperacion";

function crearServicios() {
  const cliente = new ClienteApi();
  const repositorio = new RepositorioDespachosHttp(cliente);
  const rutas = new RepositorioRutasHttp(cliente);
  const seguimiento = new GestorSeguimiento(
    new RepositorioSeguimientoHttp(cliente),
    new LocalizadorNavegador(),
    crearClaveOperacion,
  );
  const gestorRutas: GestorRutas = new GestorRutas(
    rutas,
    crearClaveOperacion,
    (viaje) => operaciones.tieneOperacion(viaje),
  );
  const operaciones: GestorOperaciones = new GestorOperaciones(
    repositorio,
    crearClaveOperacion,
    (viaje) => gestorRutas.tieneOperacion(viaje),
    () => {
      void seguimiento.detener();
    },
  );
  return { cliente, repositorio, rutas, gestorRutas, operaciones, seguimiento };
}
type Servicios = ReturnType<typeof crearServicios>;
type FiltroViajes = { vista: string; pagina: number };
const ContextoChofer = createContext<
  | (Servicios & {
      sesion: Session;
      salir: () => Promise<void>;
      filtroViajes: FiltroViajes;
      establecerFiltroViajes: (filtro: FiltroViajes) => void;
    })
  | null
>(null);

export default function ProveedorChofer({
  sesion,
  children,
}: {
  sesion: Session;
  children: ReactNode;
}) {
  const t = useTranslations("chofer");
  const navegador = useRouter();
  const [servicios] = useState(crearServicios);
  const [estado, establecerEstado] = useState("cargando");
  const [revision, establecerRevision] = useState(0);
  const [filtroViajes, establecerFiltroViajes] = useState<FiltroViajes>({
    vista: "en_curso",
    pagina: 1,
  });
  useEffect(() => {
    let activo = true;
    const limpiar = () => {
      servicios.seguimiento.limpiar();
      servicios.operaciones.limpiar();
      servicios.gestorRutas.limpiar();
    };
    servicios.cliente.establecerAlNoAutorizado(() => {
      limpiar();
      if (activo) establecerEstado("acceso");
    });
    void api("chofer/acceso/", { method: "POST", body: "{}" })
      .then(() => {
        if (activo) establecerEstado("listo");
      })
      .catch((error: unknown) => {
        if (activo)
          establecerEstado(
            error instanceof ApiError && [401, 403].includes(error.status)
              ? "acceso"
              : "error",
          );
      });
    const verificarCuenta = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const actual = await api<Session>("auth/me/");
        if (
          activo &&
          (actual.user.id !== sesion.user.id || !actual.permisos_chofer?.ver)
        ) {
          limpiar();
          establecerEstado("acceso");
        }
      } catch (error) {
        if (
          activo &&
          error instanceof ApiError &&
          [401, 403].includes(error.status)
        ) {
          limpiar();
          establecerEstado("acceso");
        }
      }
    };
    const visibilidad = () => {
      servicios.seguimiento.establecerPrimerPlano(
        document.visibilityState === "visible",
      );
      if (document.visibilityState === "visible") void verificarCuenta();
    };
    const ocultar = () => {
      servicios.seguimiento.establecerPrimerPlano(false);
    };
    const cambioCuenta = (evento: StorageEvent) => {
      if (evento.key === "hortyfru-cambio-sesion") {
        void servicios.seguimiento.detener("cuenta");
        limpiar();
        if (activo) establecerEstado("acceso");
      }
    };
    visibilidad();
    document.addEventListener("visibilitychange", visibilidad);
    window.addEventListener("pagehide", ocultar);
    window.addEventListener("storage", cambioCuenta);
    const intervalo = setInterval(verificarCuenta, 30000);
    return () => {
      activo = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", visibilidad);
      window.removeEventListener("pagehide", ocultar);
      window.removeEventListener("storage", cambioCuenta);
      void servicios.seguimiento.detener("cuenta");
      limpiar();
    };
  }, [servicios, sesion.user.id, revision]);
  const salir = async () => {
    // La retirada local ocurre antes de esperar al cierre remoto.
    void servicios.seguimiento.detener("cuenta");
    await api("auth/logout/", { method: "POST", body: "{}" });
    navegador.replace("/signin");
    navegador.refresh();
  };
  if (estado !== "listo")
    return (
      <main
        className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6 text-gray-900 dark:text-white"
        aria-busy={estado === "cargando"}
      >
        <h1 className="text-2xl font-semibold">{t("titulo")}</h1>
        <p role="status">
          {t(
            estado === "cargando"
              ? "cargando"
              : estado === "acceso"
                ? "accesoTerminado"
                : "errorConsulta",
          )}
        </p>
        {estado === "error" && (
          <Button
            onClick={() => {
              establecerEstado("cargando");
              establecerRevision((valor) => valor + 1);
            }}
          >
            {t("reintentar")}
          </Button>
        )}
        {estado === "acceso" && (
          <Button
            onClick={() => {
              void salir().catch(() => navegador.replace("/signin"));
            }}
          >
            {t("salir")}
          </Button>
        )}
        <Link href="/profile">{t("cuenta")}</Link>
      </main>
    );
  return (
    <ContextoChofer.Provider
      value={{
        ...servicios,
        sesion,
        salir,
        filtroViajes,
        establecerFiltroViajes,
      }}
    >
      {children}
    </ContextoChofer.Provider>
  );
}
export function useChofer() {
  const contexto = useContext(ContextoChofer);
  if (!contexto) throw new Error("Falta el contexto del chofer");
  return contexto;
}
export function useSeguimiento() {
  const { seguimiento } = useChofer();
  return useSyncExternalStore(
    seguimiento.suscribir,
    seguimiento.obtenerEstado,
    seguimiento.obtenerEstado,
  );
}

"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/utils";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSidebar } from "@/context/SidebarContext";
import { api } from "@/lib/api";
import { rutaInicial } from "@/lib/navegacion-sesion";
import MarcaHortyfru from "@/components/common/MarcaHortyfru";
import {
  Store as IconoProveedor,
  ShoppingCart as IconoCompra,
  Warehouse as IconoAlmacen,
  PackageCheck as IconoRecepcion,
  Boxes as IconoLotes,
  ArrowLeftRight as IconoMovimiento,
  Container as IconoCajilla,
  ClipboardCheck as IconoPreparacion,
} from "lucide-react";
import type { Session as Sesion } from "@/components/users/types";
import {
  UserCircleIcon as IconoUsuario,
  ShieldIcon as IconoRol,
  TimeIcon as IconoActividad,
  IconoRegla,
  IconoCategorias,
  IconoProducto,
  IconoCliente,
  IconoPedidos,
  CloseIcon as IconoCerrar,
} from "@/icons";

type ElementoNavegacion = {
  clave: string;
  icono: ReactNode;
  ruta: string;
  puedeVer: (sesion: Sesion) => boolean;
};

type GrupoNavegacion = {
  clave: string;
  elementos: ElementoNavegacion[];
};

const gruposNavegacion: GrupoNavegacion[] = [
  {
    clave: "operacion",
    elementos: [
      {
        clave: "pedidos",
        ruta: "/pedidos",
        icono: <IconoPedidos />,
        puedeVer: (sesion) => !!sesion.permisos_pedidos?.ver,
      },
      {
        clave: "compras",
        ruta: "/compras",
        icono: <IconoCompra className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_compras?.ver,
      },
      {
        clave: "recepciones",
        ruta: "/recepciones",
        icono: <IconoRecepcion className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_recepciones?.ver,
      },
      {
        clave: "preparaciones",
        ruta: "/preparaciones",
        icono: <IconoPreparacion className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_preparaciones?.ver,
      },
    ],
  },
  {
    clave: "inventario",
    elementos: [
      {
        clave: "lotes",
        ruta: "/lotes",
        icono: <IconoLotes className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_inventario?.ver_lotes,
      },
      {
        clave: "movimientos_inventario",
        ruta: "/movimientos-inventario",
        icono: <IconoMovimiento className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_inventario?.ver_movimientos,
      },
      {
        clave: "cajillas",
        ruta: "/cajillas",
        icono: <IconoCajilla className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_cajillas?.ver,
      },
      {
        clave: "almacenes",
        ruta: "/almacenes",
        icono: <IconoAlmacen className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_almacenes?.ver,
      },
    ],
  },
  {
    clave: "catalogos",
    elementos: [
      {
        clave: "clientes",
        ruta: "/clientes",
        icono: <IconoCliente />,
        puedeVer: (sesion) => !!sesion.permisos_clientes?.ver,
      },
      {
        clave: "proveedores",
        ruta: "/proveedores",
        icono: <IconoProveedor className="size-5" />,
        puedeVer: (sesion) => !!sesion.permisos_proveedores?.ver,
      },
      {
        clave: "productos",
        ruta: "/productos",
        icono: <IconoProducto />,
        puedeVer: (sesion) => !!sesion.permisos_productos?.ver,
      },
      {
        clave: "categorias_productos",
        ruta: "/categorias-productos",
        icono: <IconoCategorias />,
        puedeVer: (sesion) =>
          !!sesion.permisos_catalogos?.categorias_productos.ver,
      },
      {
        clave: "unidades_medida",
        ruta: "/unidades-medida",
        icono: <IconoRegla />,
        puedeVer: (sesion) => !!sesion.permisos_catalogos?.unidades_medida.ver,
      },
    ],
  },
  {
    clave: "administracion",
    elementos: [
      {
        clave: "users",
        ruta: "/usuarios",
        icono: <IconoUsuario />,
        puedeVer: (sesion) => !!sesion.capabilities?.view,
      },
      {
        clave: "roles",
        ruta: "/roles",
        icono: <IconoRol />,
        puedeVer: (sesion) => !!sesion.role_capabilities?.view,
      },
      {
        clave: "actividad",
        ruta: "/actividad",
        icono: <IconoActividad />,
        puedeVer: (sesion) => !!sesion.permisos_actividad?.ver,
      },
    ],
  },
];

export default function AppSidebar() {
  const {
    isExpanded: expandido,
    isMobileOpen: movilAbierto,
    isHovered: conCursor,
    setIsHovered: establecerConCursor,
    toggleMobileSidebar: alternarMenuMovil,
  } = useSidebar();
  const cierreMovil = useRef<HTMLButtonElement>(null);
  const rutaActual = usePathname();
  const t = useTranslations("sidebar");
  const [consultaSesion, establecerConsultaSesion] = useState<{
    sesion: Sesion | null;
    lista: boolean;
  }>({ sesion: null, lista: false });
  const sesion = consultaSesion.sesion;
  const mostrarTexto = expandido || conCursor || movilAbierto;
  const gruposVisibles = sesion
    ? gruposNavegacion
        .map((grupo) => ({
          ...grupo,
          elementos: grupo.elementos.filter((elemento) =>
            elemento.puedeVer(sesion),
          ),
        }))
        .filter((grupo) => grupo.elementos.length)
    : [];

  useEffect(() => {
    if (!movilAbierto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const desbordamientoAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cierreMovil.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = desbordamientoAnterior;
      focoAnterior?.focus({ preventScroll: true });
    };
  }, [movilAbierto]);

  useEffect(() => {
    const controlador = new AbortController();
    const actualizar = () => {
      void api<Sesion>("auth/me/", { signal: controlador.signal })
        .then((datos) => {
          if (!controlador.signal.aborted)
            establecerConsultaSesion({ sesion: datos, lista: true });
        })
        .catch(() => {
          if (!controlador.signal.aborted)
            establecerConsultaSesion({ sesion: null, lista: true });
        });
    };
    actualizar();
    window.addEventListener("focus", actualizar);
    window.addEventListener("hortyfru:session-changed", actualizar);
    return () => {
      controlador.abort();
      window.removeEventListener("focus", actualizar);
      window.removeEventListener("hortyfru:session-changed", actualizar);
    };
  }, [rutaActual]);

  const estaActivo = (ruta: string) =>
    rutaActual === ruta || rutaActual.startsWith(`${ruta}/`);

  const mostrarEnlace = (elemento: Omit<ElementoNavegacion, "puedeVer">) => {
    const activo = estaActivo(elemento.ruta);
    const etiqueta = t(`items.${elemento.clave}`);
    return (
      <Link
        href={elemento.ruta}
        aria-label={etiqueta}
        aria-current={
          activo
            ? rutaActual === elemento.ruta
              ? "page"
              : "location"
            : undefined
        }
        title={!mostrarTexto ? etiqueta : undefined}
        className={cn(
          "group menu-item min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
          activo ? "menu-item-active" : "menu-item-inactive",
          !mostrarTexto && "xl:justify-center",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "shrink-0",
            activo ? "menu-item-icon-active" : "menu-item-icon-inactive",
          )}
        >
          {elemento.icono}
        </span>
        {mostrarTexto && <span className="menu-item-text">{etiqueta}</span>}
      </Link>
    );
  };

  return (
    <aside
      id="navegacion-principal"
      onKeyDown={(evento) => {
        if (!movilAbierto) return;
        if (evento.key === "Escape") {
          evento.preventDefault();
          alternarMenuMovil();
        }
        if (evento.key === "Tab") {
          const elementos = Array.from(
            evento.currentTarget.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled])",
            ),
          ).filter((elemento) => elemento.getClientRects().length);
          const primero = elementos[0],
            ultimo = elementos[elementos.length - 1];
          if (evento.shiftKey && document.activeElement === primero) {
            evento.preventDefault();
            ultimo?.focus();
          } else if (!evento.shiftKey && document.activeElement === ultimo) {
            evento.preventDefault();
            primero?.focus();
          }
        }
      }}
      className={`superficie-cristal panel-lateral-hortyfru fixed inset-s-0 top-0 z-50 flex h-full flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out motion-reduce:transition-none xl:mt-0 dark:border-gray-800 dark:bg-gray-900 ${
        expandido || movilAbierto ? "w-72.5" : conCursor ? "w-72.5" : "w-22.5"
      } ${
        movilAbierto
          ? "translate-x-0"
          : "-translate-x-[calc(100%+2rem)] rtl:translate-x-[calc(100%+2rem)]"
      } xl:translate-x-0 xl:rtl:translate-x-0`}
      onMouseEnter={() => !expandido && establecerConCursor(true)}
      onMouseLeave={() => establecerConCursor(false)}
    >
      <div
        className={cn(
          "flex min-h-28 shrink-0 items-center py-5",
          !mostrarTexto && "xl:justify-center",
        )}
      >
        <Link
          href={rutaInicial(sesion)}
          className="inline-flex items-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
          aria-label="HortyFru"
        >
          <MarcaHortyfru compacta={!mostrarTexto} pequena={movilAbierto} />
        </Link>
        {movilAbierto && (
          <button
            ref={cierreMovil}
            type="button"
            aria-label={t("cerrarMenu")}
            onClick={alternarMenuMovil}
            className="ms-auto inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-brand-600 xl:hidden dark:text-gray-200 dark:hover:bg-white/10"
          >
            <IconoCerrar className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <nav
        aria-label={t("navegacionPrincipal")}
        aria-busy={!consultaSesion.lista}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-5"
      >
        <div className="space-y-6">
          {!consultaSesion.lista ? (
            <p
              role="status"
              className={cn(
                "px-3 text-sm text-gray-500 dark:text-gray-400",
                !mostrarTexto && "sr-only",
              )}
            >
              {t("cargandoMenu")}
            </p>
          ) : !sesion ? (
            <p
              role="status"
              className={cn(
                "px-3 text-sm text-gray-500 dark:text-gray-400",
                !mostrarTexto && "sr-only",
              )}
            >
              {t("menuNoDisponible")}
            </p>
          ) : (
            gruposVisibles.map((grupo) => (
              <section
                key={grupo.clave}
                aria-labelledby={`grupo-menu-${grupo.clave}`}
              >
                <h2
                  id={`grupo-menu-${grupo.clave}`}
                  className={
                    mostrarTexto
                      ? "mb-2 px-3 text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
                      : "sr-only"
                  }
                >
                  {t(`groups.${grupo.clave}`)}
                </h2>
                {!mostrarTexto && (
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-2 h-px w-5 bg-gray-200 dark:bg-gray-700"
                  />
                )}
                <ul className="space-y-1">
                  {grupo.elementos.map((elemento) => (
                    <li key={elemento.clave}>{mostrarEnlace(elemento)}</li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </nav>
      <div className="shrink-0 border-t border-gray-200 py-3 dark:border-gray-800">
        {mostrarEnlace({
          clave: "userProfile",
          ruta: "/profile",
          icono: <IconoUsuario />,
        })}
      </div>
    </aside>
  );
}

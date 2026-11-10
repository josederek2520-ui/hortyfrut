"use client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  Check as IconoElegido,
  LoaderCircle as IconoCargando,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import PaginadorOpciones from "@/components/compras/PaginadorOpcionesCompra";
import usePanelDesplegable from "@/components/compras/usePanelDesplegable";
import { api, ApiError as ErrorApi } from "@/lib/api";
import type {
  OpcionLogistica,
  PaginaLogistica,
} from "@/components/logistica/tipos";

export default function SelectorTransporteDespacho<
  T extends OpcionLogistica = OpcionLogistica,
>({
  nombre,
  ruta,
  etiqueta,
  valor,
  opcionVacia,
  deshabilitado = false,
  error,
  descripcion,
  alElegir,
  alError,
}: {
  nombre: string;
  ruta: string;
  etiqueta: string;
  valor: T | null;
  opcionVacia: string;
  deshabilitado?: boolean;
  error?: string;
  descripcion?: (opcion: T) => ReactNode;
  alElegir: (opcion: T) => void;
  alError: (error: unknown) => void;
}) {
  const t = useTranslations("compras");
  const textos = useTranslations("despachos");
  const identificador = useId();
  const [abierto, establecerAbierto] = useState(false);
  const [pagina, establecerPagina] = useState(1);
  const [revision, establecerRevision] = useState(0);
  const [indice, establecerIndice] = useState(-1);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: PaginaLogistica<T>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const ancla = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // El foco permanece en el control; este panel no contiene una entrada de búsqueda.
  const entrada = useRef<HTMLInputElement>(null);
  const desdeUltima = useRef(false);
  const cerrar = useCallback(() => establecerAbierto(false), []);
  const visible = abierto && !deshabilitado;
  const [base, consultaBase] = ruta.split("?");
  const parametros = new URLSearchParams(consultaBase);
  parametros.delete("buscar");
  parametros.set("pagina", String(pagina));
  const consulta = `${base}?${parametros}`;
  const clave = `${consulta}|${revision}`;
  const datos = respuesta?.clave === clave ? respuesta.datos : null;
  const fallo = !datos && consultaFallida === clave;
  const cargando = !datos && !fallo;
  const opciones = datos?.results || [];
  const indiceVisible =
    !cargando && !fallo && indice >= 0 && indice < opciones.length
      ? indice
      : -1;

  usePanelDesplegable({
    abierto: visible,
    ancla,
    panel,
    entrada,
    alCerrar: cerrar,
    anchoRem: 18,
  });
  useLayoutEffect(() => {
    const elemento = panel.current;
    const boton = ancla.current;
    if (
      !visible ||
      !elemento ||
      !boton ||
      typeof elemento.animate !== "function"
    )
      return;
    const preferencia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const arriba =
      elemento.getBoundingClientRect().bottom <=
      boton.getBoundingClientRect().top;
    const animacion = elemento.animate(
      preferencia.matches
        ? [{ opacity: 0.75 }, { opacity: 1 }]
        : [
            {
              opacity: 0.5,
              transform: `translateY(${arriba ? 4 : -4}px) scale(0.99)`,
            },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
      {
        duration: preferencia.matches ? 80 : 180,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
    );
    const detener = () => animacion.cancel();
    preferencia.addEventListener("change", detener);
    return () => {
      animacion.cancel();
      preferencia.removeEventListener("change", detener);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const controlador = new AbortController();
    void api<PaginaLogistica<T>>(consulta, { signal: controlador.signal })
      .then((resultado) => {
        if (controlador.signal.aborted) return;
        establecerRespuesta({ clave, datos: resultado });
        const seleccionado = resultado.results.findIndex(
          (opcion) => opcion.id === valor?.id,
        );
        establecerIndice(
          seleccionado >= 0
            ? seleccionado
            : desdeUltima.current
              ? resultado.results.length - 1
              : resultado.results.length
                ? 0
                : -1,
        );
      })
      .catch((problema) => {
        if (controlador.signal.aborted) return;
        if (
          problema instanceof ErrorApi &&
          problema.status === 404 &&
          pagina > 1
        )
          establecerPagina(1);
        else {
          establecerConsultaFallida(clave);
          alError(problema);
        }
      });
    return () => controlador.abort();
  }, [visible, consulta, clave, pagina, valor?.id, alError]);
  useEffect(() => {
    if (visible && indiceVisible >= 0)
      document
        .getElementById(`${identificador}-opcion-${indiceVisible}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [visible, indiceVisible, identificador]);

  const abrir = (ultima = false) => {
    if (deshabilitado) return;
    ancla.current?.focus({ preventScroll: true });
    desdeUltima.current = ultima;
    establecerPagina(1);
    establecerIndice(-1);
    establecerRevision((anterior) => anterior + 1);
    establecerAbierto(true);
  };
  const elegir = (opcion: T) => {
    if (deshabilitado) return;
    cerrar();
    ancla.current?.focus({ preventScroll: true });
    alElegir(opcion);
  };
  const cambiarPagina = (nueva: number) => {
    desdeUltima.current = false;
    establecerIndice(-1);
    establecerPagina(nueva);
    ancla.current?.focus({ preventScroll: true });
  };
  const alTecla = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (evento.nativeEvent.isComposing || deshabilitado) return;
    if (evento.key === "Escape" && visible) {
      evento.preventDefault();
      cerrar();
      return;
    }
    if (evento.key === "Tab" && visible) {
      cerrar();
      return;
    }
    if (!visible) {
      if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        evento.preventDefault();
        abrir(evento.key === "ArrowUp");
      }
      return;
    }
    if (
      [
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
        "Enter",
        " ",
        "PageDown",
        "PageUp",
      ].includes(evento.key)
    )
      evento.preventDefault();
    if (cargando || fallo) return;
    if ((evento.key === "Enter" || evento.key === " ") && indiceVisible >= 0)
      elegir(opciones[indiceVisible]);
    else if (evento.key === "ArrowDown" && opciones.length)
      establecerIndice((indiceVisible + 1) % opciones.length);
    else if (evento.key === "ArrowUp" && opciones.length)
      establecerIndice(
        indiceVisible <= 0 ? opciones.length - 1 : indiceVisible - 1,
      );
    else if (evento.key === "Home") establecerIndice(opciones.length ? 0 : -1);
    else if (evento.key === "End") establecerIndice(opciones.length - 1);
    else if (evento.key === "PageDown" && pagina * 10 < (datos?.count || 0))
      cambiarPagina(pagina + 1);
    else if (evento.key === "PageUp" && pagina > 1) cambiarPagina(pagina - 1);
  };
  return (
    <div className="min-w-0">
      <label
        id={`${identificador}-etiqueta`}
        htmlFor={identificador}
        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {etiqueta}
      </label>
      <button
        ref={ancla}
        id={identificador}
        name={nombre}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-autocomplete="none"
        aria-expanded={visible}
        aria-controls={visible ? `${identificador}-lista` : undefined}
        aria-activedescendant={
          visible && indiceVisible >= 0
            ? `${identificador}-opcion-${indiceVisible}`
            : undefined
        }
        aria-labelledby={`${identificador}-etiqueta ${identificador}-valor`}
        aria-describedby={
          [
            error ? `${identificador}-error` : "",
            visible ? `${identificador}-ayuda` : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={!!error}
        data-invalido={!!error}
        disabled={deshabilitado}
        onClick={() => (visible ? cerrar() : abrir())}
        onKeyDown={alTecla}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-gray-900 dark:text-gray-100 ${error ? "border-error-500 dark:border-error-400" : visible ? "border-brand-400 dark:border-brand-400" : "border-gray-300 dark:border-gray-700"}`}
      >
        <span id={`${identificador}-valor`} className="min-w-0 truncate">
          {valor?.nombre || opcionVacia}
        </span>
        <IconoDesplegar
          className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${visible ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {error && (
        <p
          id={`${identificador}-error`}
          className="mt-1.5 text-theme-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      )}
      {visible && (
        <span id={`${identificador}-ayuda`} className="sr-only">
          {textos("tecladoSelectorTransporte")}
        </span>
      )}
      {visible &&
        createPortal(
          <div
            ref={panel}
            style={{ visibility: "hidden" }}
            className="superficie-cristal fixed z-999999 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="custom-scrollbar min-h-0 overflow-y-auto p-1.5">
              <div
                id={`${identificador}-lista`}
                role="listbox"
                aria-label={etiqueta}
                aria-busy={cargando}
                className="max-h-64"
              >
                {!cargando &&
                  !fallo &&
                  opciones.map((opcion, posicion) => (
                    <div
                      key={opcion.id}
                      id={`${identificador}-opcion-${posicion}`}
                      role="option"
                      aria-selected={opcion.id === valor?.id}
                      onMouseDown={(evento) => evento.preventDefault()}
                      onMouseEnter={() => establecerIndice(posicion)}
                      onClick={() => elegir(opcion)}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${indiceVisible === posicion ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium break-words text-gray-900 dark:text-gray-100">
                          {opcion.nombre}
                        </span>
                        {descripcion && (
                          <span className="mt-1 block text-theme-xs text-gray-600 dark:text-gray-300">
                            {descripcion(opcion)}
                          </span>
                        )}
                      </span>
                      {opcion.id === valor?.id && (
                        <IconoElegido
                          className="size-4 shrink-0 text-brand-600 dark:text-brand-400"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  ))}
              </div>
              {cargando ? (
                <p
                  role="status"
                  className="flex items-center gap-2 px-3 py-5 text-sm text-gray-600 dark:text-gray-300"
                >
                  <IconoCargando
                    className="size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {t("cargandoOpciones")}
                </p>
              ) : fallo ? (
                <div
                  role="alert"
                  className="space-y-3 px-3 py-4 text-sm text-error-600 dark:text-error-400"
                >
                  <p>{t("errorOpciones")}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      establecerRevision((anterior) => anterior + 1)
                    }
                  >
                    {t("reintentar")}
                  </Button>
                </div>
              ) : (
                !opciones.length && (
                  <p
                    role="status"
                    className="px-3 py-5 text-sm text-gray-600 dark:text-gray-300"
                  >
                    {t("sinOpciones")}
                  </p>
                )
              )}
            </div>
            {datos && datos.count > 10 && (
              <div className="[&_button]:min-h-11 [&_button]:min-w-11">
                <PaginadorOpciones
                  pagina={pagina}
                  total={datos.count}
                  ocupado={cargando || fallo}
                  alCambiar={cambiarPagina}
                />
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  ChevronDown as IconoDesplegar,
  Plus as IconoAgregar,
  Check as IconoElegido,
  Search as IconoBuscar,
  X as IconoLimpiar,
  ArrowLeft as IconoVolver,
  ListFilter as IconoFiltrar,
  LoaderCircle as IconoCargando,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import { api, ApiError as ErrorApi } from "@/lib/api";
import PaginadorOpcionesCompra from "./PaginadorOpcionesCompra";
import usePanelDesplegable from "./usePanelDesplegable";
import type { OpcionCompra, PaginaCompra } from "./tipos";

interface PaginaOpciones<T extends OpcionCompra> extends PaginaCompra<T> {
  categoria_producto?: { id: number; nombre: string } | null;
}

export default function DesplegableCompra<
  T extends OpcionCompra = OpcionCompra,
>({
  ruta,
  etiqueta,
  valor,
  alElegir,
  alError,
  opcionVacia,
  deshabilitado = false,
  error,
  agregar = false,
  nombre,
  tipo,
  descripcion,
}: {
  ruta: string;
  etiqueta: string;
  valor: T | null;
  alElegir: (opcion: T | null) => void;
  alError: (error: unknown) => void;
  opcionVacia?: string;
  deshabilitado?: boolean;
  error?: string;
  agregar?: boolean;
  nombre?: string;
  tipo: "producto" | "proveedor" | "presentacion" | "general";
  descripcion?: (opcion: T) => ReactNode;
}) {
  const t = useTranslations("compras");
  const identificador = useId();
  const [abierto, establecerAbierto] = useState(false);
  const [buscar, establecerBuscar] = useState("");
  const [pagina, establecerPagina] = useState(1);
  const [categoria, establecerCategoria] = useState<OpcionCompra | null>(null);
  const [eligiendoCategoria, establecerEligiendoCategoria] = useState(false);
  const [buscarCategoria, establecerBuscarCategoria] = useState("");
  const [paginaCategoria, establecerPaginaCategoria] = useState(1);
  const [todos, establecerTodos] = useState(false);
  const [indiceActivo, establecerIndiceActivo] = useState(-1);
  const [revision, establecerRevision] = useState(0);
  const [respuesta, establecerRespuesta] = useState<{
    clave: string;
    datos: PaginaOpciones<T>;
  } | null>(null);
  const [consultaFallida, establecerConsultaFallida] = useState("");
  const ancla = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const cerrar = useCallback(() => establecerAbierto(false), []);
  const paginaActual = eligiendoCategoria ? paginaCategoria : pagina;
  const busquedaActual = eligiendoCategoria ? buscarCategoria : buscar;
  const [base, consultaBase] = (
    eligiendoCategoria ? "compras/categorias/" : ruta
  ).split("?");
  const parametros = new URLSearchParams(consultaBase);
  parametros.set("pagina", String(paginaActual));
  parametros.set("buscar", busquedaActual);
  if (!eligiendoCategoria && tipo === "producto" && categoria)
    parametros.set("categoria", String(categoria.id));
  if (tipo === "proveedor") parametros.set("todos", String(todos));
  const consulta = `${base}?${parametros}`;
  const claveConsulta = `${consulta}|${revision}`;
  const datos = respuesta?.clave === claveConsulta ? respuesta.datos : null;
  const fallo = !datos && consultaFallida === claveConsulta;
  const cargando = !datos && !fallo;
  const categoriaProducto = respuesta?.datos.categoria_producto;
  const etiquetaVacia = eligiendoCategoria ? t("todasCategorias") : opcionVacia;
  const opciones: (T | null)[] = [
    ...(etiquetaVacia ? [null] : []),
    ...(datos?.results || []),
  ];
  const indiceVisible =
    !cargando && !fallo && indiceActivo < opciones.length ? indiceActivo : -1;
  const seleccionado = eligiendoCategoria ? categoria : valor;
  usePanelDesplegable({
    abierto,
    ancla,
    panel,
    entrada,
    alCerrar: cerrar,
    anchoRem: tipo === "producto" ? 24 : 21,
  });
  useEffect(() => {
    if (!abierto) return;
    const controlador = new AbortController();
    const temporizador = window.setTimeout(
      async () => {
        establecerConsultaFallida("");
        try {
          const resultado = await api<PaginaOpciones<T>>(consulta, {
            signal: controlador.signal,
          });
          if (!controlador.signal.aborted)
            establecerRespuesta({ clave: claveConsulta, datos: resultado });
        } catch (problema) {
          if (controlador.signal.aborted) return;
          if (
            problema instanceof ErrorApi &&
            problema.status === 404 &&
            paginaActual > 1
          ) {
            if (eligiendoCategoria) establecerPaginaCategoria(1);
            else establecerPagina(1);
          } else {
            establecerConsultaFallida(claveConsulta);
            alError(problema);
          }
        }
      },
      busquedaActual ? 250 : 0,
    );
    return () => {
      controlador.abort();
      window.clearTimeout(temporizador);
    };
  }, [
    abierto,
    consulta,
    claveConsulta,
    paginaActual,
    busquedaActual,
    eligiendoCategoria,
    alError,
  ]);
  useEffect(() => {
    if (abierto && indiceVisible >= 0)
      document
        .getElementById(`${identificador}-opcion-${indiceVisible}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [abierto, indiceVisible, identificador]);
  const abrir = () => {
    if (deshabilitado) return;
    establecerBuscar("");
    establecerBuscarCategoria("");
    establecerPagina(1);
    establecerPaginaCategoria(1);
    establecerEligiendoCategoria(false);
    establecerIndiceActivo(-1);
    establecerRevision((actual) => actual + 1);
    establecerAbierto(true);
  };
  const elegir = (opcion: T | null) => {
    if (eligiendoCategoria) {
      establecerCategoria(opcion);
      establecerPagina(1);
      establecerEligiendoCategoria(false);
      establecerIndiceActivo(-1);
      entrada.current?.focus({ preventScroll: true });
      return;
    }
    alElegir(opcion);
    cerrar();
    ancla.current?.focus({ preventScroll: true });
  };
  const alTeclaBusqueda = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.nativeEvent.isComposing) return;
    if (["ArrowDown", "ArrowUp"].includes(evento.key)) {
      evento.preventDefault();
      if (cargando || fallo || !opciones.length) return;
      const siguiente =
        evento.key === "ArrowDown"
          ? (indiceVisible + 1) % opciones.length
          : indiceVisible <= 0
            ? opciones.length - 1
            : indiceVisible - 1;
      establecerIndiceActivo(siguiente);
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (indiceVisible >= 0) elegir(opciones[indiceVisible]);
    }
  };
  const cambiarPagina = (nueva: number) => {
    if (eligiendoCategoria) establecerPaginaCategoria(nueva);
    else establecerPagina(nueva);
    establecerIndiceActivo(-1);
    entrada.current?.focus({ preventScroll: true });
  };
  return (
    <div className="min-w-0">
      {!agregar && (
        <label
          id={`${identificador}-etiqueta`}
          htmlFor={identificador}
          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {etiqueta}
        </label>
      )}
      {agregar ? (
        <Button
          ref={ancla}
          size="sm"
          variant="outline"
          disabled={deshabilitado}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls={abierto ? `${identificador}-panel` : undefined}
          startIcon={<IconoAgregar className="size-4" />}
          onClick={() => (abierto ? cerrar() : abrir())}
        >
          {etiqueta}
        </Button>
      ) : (
        <button
          ref={ancla}
          type="button"
          id={identificador}
          name={nombre}
          disabled={deshabilitado}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls={abierto ? `${identificador}-panel` : undefined}
          aria-labelledby={`${identificador}-etiqueta ${identificador}-valor`}
          data-invalido={!!error}
          aria-describedby={error ? `${identificador}-error` : undefined}
          title={valor?.nombre || opcionVacia}
          onClick={() => (abierto ? cerrar() : abrir())}
          onKeyDown={(evento) => {
            if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
              evento.preventDefault();
              abrir();
            }
          }}
          className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2.5 text-start text-sm text-gray-800 shadow-theme-xs focus-visible:ring-3 focus-visible:ring-brand-500/20 focus-visible:outline-none disabled:opacity-60 dark:bg-gray-900 dark:text-gray-100 ${error ? "border-error-500 dark:border-error-400" : abierto ? "border-brand-400 dark:border-brand-400" : "border-gray-300 dark:border-gray-700"}`}
        >
          <span id={`${identificador}-valor`} className="truncate">
            {valor?.nombre || opcionVacia || t("seleccionar")}
          </span>
          <IconoDesplegar
            className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${abierto ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
      )}
      {error && (
        <p
          id={`${identificador}-error`}
          className="mt-1.5 text-theme-xs text-error-500 dark:text-error-400"
        >
          {error}
        </p>
      )}
      {abierto &&
        createPortal(
          <div
            ref={panel}
            id={`${identificador}-panel`}
            role="dialog"
            aria-label={etiqueta}
            style={{ visibility: "hidden" }}
            className="superficie-cristal fixed z-999999 flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="shrink-0 space-y-3 border-b border-gray-100 p-3 dark:border-gray-800">
              <div className="flex items-center justify-between gap-2">
                {eligiendoCategoria ? (
                  <button
                    type="button"
                    onClick={() => {
                      establecerEligiendoCategoria(false);
                      establecerIndiceActivo(-1);
                      entrada.current?.focus();
                    }}
                    className="flex min-h-8 items-center gap-1 rounded text-sm font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200"
                  >
                    <IconoVolver
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                    {t("volverProductos")}
                  </button>
                ) : (
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {etiqueta}
                  </p>
                )}
                <button
                  type="button"
                  aria-label={t("cerrar")}
                  onClick={() => {
                    cerrar();
                    ancla.current?.focus();
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:bg-gray-800"
                >
                  <IconoLimpiar className="size-4" aria-hidden="true" />
                </button>
              </div>
              <div className="relative">
                <IconoBuscar
                  className="pointer-events-none absolute start-3 top-3.5 z-1 size-4 text-gray-400"
                  aria-hidden="true"
                />
                <Input
                  ref={entrada}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded="true"
                  aria-controls={`${identificador}-lista`}
                  aria-activedescendant={
                    indiceVisible >= 0
                      ? `${identificador}-opcion-${indiceVisible}`
                      : undefined
                  }
                  type="text"
                  autoComplete="off"
                  maxLength={150}
                  value={busquedaActual}
                  placeholder={t(
                    eligiendoCategoria ? "buscarCategoria" : "buscarOpciones",
                  )}
                  aria-label={t(
                    eligiendoCategoria ? "buscarCategoria" : "buscarOpciones",
                  )}
                  className="ps-9!"
                  onKeyDown={alTeclaBusqueda}
                  onChange={(evento) => {
                    if (eligiendoCategoria) {
                      establecerBuscarCategoria(evento.target.value);
                      establecerPaginaCategoria(1);
                    } else {
                      establecerBuscar(evento.target.value);
                      establecerPagina(1);
                    }
                    establecerIndiceActivo(-1);
                  }}
                />
              </div>
              {tipo === "proveedor" && (
                <div className="space-y-2">
                  {categoriaProducto && (
                    <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                      {t("categoriaProducto", {
                        categoria: categoriaProducto.nombre,
                      })}
                    </p>
                  )}
                  <div
                    role="group"
                    aria-label={t("filtrarProveedores")}
                    className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
                  >
                    {[false, true].map((mostrarTodos) => (
                      <button
                        key={String(mostrarTodos)}
                        type="button"
                        aria-pressed={todos === mostrarTodos}
                        onClick={() => {
                          establecerTodos(mostrarTodos);
                          establecerPagina(1);
                          establecerIndiceActivo(-1);
                          entrada.current?.focus();
                        }}
                        className="pestana-hortyfru min-h-9 flex-1 rounded-md px-2 text-theme-xs font-medium text-gray-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-200"
                      >
                        {t(
                          mostrarTodos ? "todosProveedores" : "deEstaCategoria",
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tipo === "producto" && !eligiendoCategoria && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-expanded={eligiendoCategoria}
                    onClick={() => {
                      establecerEligiendoCategoria(true);
                      establecerIndiceActivo(-1);
                      entrada.current?.focus();
                    }}
                    className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 px-2.5 text-start text-theme-xs text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <IconoFiltrar
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {categoria?.nombre || t("todasCategorias")}
                    </span>
                    <IconoDesplegar
                      className="ms-auto size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                  {categoria && (
                    <button
                      type="button"
                      aria-label={t("limpiarCategoria")}
                      onClick={() => {
                        establecerCategoria(null);
                        establecerPagina(1);
                        establecerIndiceActivo(-1);
                        entrada.current?.focus();
                      }}
                      className="flex size-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      <IconoLimpiar className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="custom-scrollbar min-h-0 overflow-y-auto p-1.5">
              <div
                id={`${identificador}-lista`}
                role="listbox"
                aria-label={
                  eligiendoCategoria ? t("categoriasProductos") : etiqueta
                }
                aria-busy={cargando}
                className="max-h-64"
              >
                {!cargando &&
                  !fallo &&
                  opciones.map((opcion, indice) => (
                    <div
                      key={opcion?.id || "vacia"}
                      id={`${identificador}-opcion-${indice}`}
                      role="option"
                      aria-selected={
                        (opcion?.id || null) === (seleccionado?.id || null)
                      }
                      onMouseDown={(evento) => evento.preventDefault()}
                      onMouseEnter={() => establecerIndiceActivo(indice)}
                      onClick={() => elegir(opcion)}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${indiceVisible === indice ? "bg-brand-50 dark:bg-brand-500/10" : ""}`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block text-sm break-words ${opcion ? "font-medium text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {opcion?.nombre || etiquetaVacia}
                        </span>
                        {opcion && tipo === "proveedor" && (
                          <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                            {opcion.categoria?.nombre || t("sinCategoria")}
                            {opcion.subtitulo ? ` · ${opcion.subtitulo}` : ""}
                          </span>
                        )}
                        {(opcion?.subtitulo || descripcion) &&
                          tipo !== "proveedor" &&
                          !eligiendoCategoria && (
                            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
                              {opcion && descripcion
                                ? descripcion(opcion)
                                : opcion?.subtitulo}
                            </span>
                          )}
                      </span>
                      {(opcion?.id || null) === (seleccionado?.id || null) && (
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
                  className="flex items-center gap-2 px-3 py-5 text-sm text-gray-500 dark:text-gray-400"
                >
                  <IconoCargando
                    className="size-4 motion-safe:animate-spin"
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
                    onClick={() => establecerRevision((actual) => actual + 1)}
                  >
                    {t("reintentar")}
                  </Button>
                </div>
              ) : (
                !datos?.results.length && (
                  <div
                    role="status"
                    className="space-y-2 px-3 py-4 text-sm text-gray-500 dark:text-gray-400"
                  >
                    <p>
                      {t(
                        tipo === "proveedor" && !todos
                          ? "sinProveedoresCategoria"
                          : "sinOpciones",
                      )}
                    </p>
                    {tipo === "proveedor" && !todos && (
                      <button
                        type="button"
                        onClick={() => {
                          establecerTodos(true);
                          establecerPagina(1);
                          establecerIndiceActivo(-1);
                          entrada.current?.focus();
                        }}
                        className="min-h-9 rounded font-medium text-brand-700 focus-visible:ring-2 focus-visible:ring-brand-400 dark:text-brand-300"
                      >
                        {t("verTodosProveedores")}
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
            <PaginadorOpcionesCompra
              pagina={paginaActual}
              total={datos?.count || 0}
              ocupado={cargando || fallo}
              alCambiar={cambiarPagina}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}

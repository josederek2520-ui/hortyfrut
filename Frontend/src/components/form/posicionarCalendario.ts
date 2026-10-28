import type { Instance as InstanciaCalendario } from "flatpickr/dist/types/instance";

export default function posicionarCalendario(calendario: InstanciaCalendario) {
  const entrada = calendario.input.getBoundingClientRect();
  const ventana = window.visualViewport;
  const anchoVentana = ventana?.width || document.documentElement.clientWidth;
  const altoVentana = ventana?.height || window.innerHeight;
  const inicioVentana = ventana?.offsetLeft || 0;
  const superiorVentana = ventana?.offsetTop || 0;
  const margen = 8;
  const contenedor = calendario.calendarContainer;
  contenedor.style.setProperty(
    "width",
    `${Math.min(350, anchoVentana - margen * 2)}px`,
    "important",
  );
  contenedor.style.maxHeight = `${altoVentana - margen * 2}px`;
  const ancho = contenedor.offsetWidth;
  const alto = contenedor.offsetHeight;
  const limiteInferior = superiorVentana + altoVentana - margen;
  const arriba =
    entrada.bottom + margen + alto > limiteInferior &&
    entrada.top - superiorVentana > limiteInferior - entrada.bottom;
  const superior = Math.max(
    superiorVentana + margen,
    Math.min(
      arriba ? entrada.top - alto - margen : entrada.bottom + margen,
      limiteInferior - alto,
    ),
  );
  const derechaIzquierda =
    getComputedStyle(calendario.input).direction === "rtl";
  const izquierda = Math.max(
    inicioVentana + margen,
    Math.min(
      derechaIzquierda ? entrada.right - ancho : entrada.left,
      inicioVentana + anchoVentana - ancho - margen,
    ),
  );
  contenedor.style.top = `${superior}px`;
  contenedor.style.insetInlineStart = `${derechaIzquierda ? document.documentElement.clientWidth - izquierda - ancho : izquierda}px`;
}

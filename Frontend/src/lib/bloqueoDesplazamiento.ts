type BloqueoDesplazamiento = {
  cantidad: number;
  desbordamientoAnterior: string;
};

const bloqueos = new WeakMap<HTMLElement, BloqueoDesplazamiento>();

export function bloquearDesplazamiento(documento: Document = document) {
  const cuerpo = documento.body;
  let bloqueo = bloqueos.get(cuerpo);
  if (!bloqueo) {
    bloqueo = {
      cantidad: 0,
      desbordamientoAnterior: cuerpo.style.overflow,
    };
    bloqueos.set(cuerpo, bloqueo);
    cuerpo.style.overflow = "hidden";
  }
  bloqueo.cantidad += 1;

  // Menú, panel y confirmación pueden cerrarse en cualquier orden al navegar.
  let liberado = false;
  return () => {
    if (liberado) return;
    liberado = true;
    bloqueo.cantidad -= 1;
    if (bloqueo.cantidad > 0) return;
    cuerpo.style.overflow = bloqueo.desbordamientoAnterior;
    bloqueos.delete(cuerpo);
  };
}

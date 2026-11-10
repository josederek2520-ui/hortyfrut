/** Entrada discreta; cancelar siempre devuelve el control a los estilos del tema. */
export function animarEntradaPreparacion(
  elemento: HTMLElement,
  preferencia: MediaQueryList,
) {
  if (typeof elemento.animate !== "function") return () => {};
  const reducida = preferencia.matches;
  const animacion = elemento.animate(
    reducida
      ? [{ opacity: 0.75 }, { opacity: 1 }]
      : [
          { opacity: 0.5, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
    {
      duration: reducida ? 80 : 240,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    },
  );
  // Una preferencia que cambie durante la entrada se respeta inmediatamente.
  const detener = () => animacion.cancel();
  preferencia.addEventListener("change", detener);
  return () => {
    animacion.cancel();
    preferencia.removeEventListener("change", detener);
  };
}

export function animarVistaAgregarCompra(
  elemento: HTMLElement,
  preferencia: MediaQueryList,
) {
  if (typeof elemento.animate !== "function") return () => {};
  const animacion = elemento.animate(
    preferencia.matches
      ? [{ opacity: 0.75 }, { opacity: 1 }]
      : [
          { opacity: 0.5, transform: "translateY(6px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
    {
      duration: preferencia.matches ? 80 : 200,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
    },
  );
  const detener = () => animacion.cancel();
  preferencia.addEventListener("change", detener);
  return () => {
    animacion.cancel();
    preferencia.removeEventListener("change", detener);
  };
}

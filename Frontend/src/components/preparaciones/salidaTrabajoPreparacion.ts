/** Solo una navegación interna que abandona la hoja necesita confirmación. */
export function destinoSalidaPreparacion(
  evento: Pick<
    MouseEvent,
    | "defaultPrevented"
    | "button"
    | "metaKey"
    | "ctrlKey"
    | "shiftKey"
    | "altKey"
  >,
  enlace: Pick<HTMLAnchorElement, "href" | "target" | "hasAttribute"> | null,
  ubicacion: Pick<Location, "href">,
): string | null {
  if (
    !enlace ||
    evento.defaultPrevented ||
    evento.button !== 0 ||
    evento.metaKey ||
    evento.ctrlKey ||
    evento.shiftKey ||
    evento.altKey ||
    (enlace.target && enlace.target !== "_self") ||
    enlace.hasAttribute("download")
  )
    return null;
  try {
    const actual = new URL(ubicacion.href);
    const destino = new URL(enlace.href, actual);
    if (
      destino.origin !== actual.origin ||
      (destino.pathname === actual.pathname && destino.search === actual.search)
    )
      return null;
    return destino.pathname + destino.search + destino.hash;
  } catch {
    return null;
  }
}

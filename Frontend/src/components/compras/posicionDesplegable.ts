interface CajaVisible {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

interface MedidasDesplegable {
  ancla: CajaVisible;
  anchoVentana: number;
  altoVentana: number;
  inicioVentana: number;
  superiorVentana: number;
  anchoPreferido: number;
  altoPanel: number;
  anchoDocumento: number;
  derechaIzquierda: boolean;
}

export function posicionDesplegable({
  ancla,
  anchoVentana,
  altoVentana,
  inicioVentana,
  superiorVentana,
  anchoPreferido,
  altoPanel,
  anchoDocumento,
  derechaIzquierda,
}: MedidasDesplegable) {
  const margen = 8;
  const ancho = Math.max(
    0,
    Math.min(Math.max(ancla.width, anchoPreferido), anchoVentana - margen * 2),
  );
  const limiteInferior = superiorVentana + altoVentana - margen;
  const espacioArriba = Math.max(0, ancla.top - superiorVentana - margen * 2);
  const espacioAbajo = Math.max(0, limiteInferior - ancla.bottom - margen);
  const arriba = espacioAbajo < altoPanel && espacioArriba > espacioAbajo;
  const altoMaximo = arriba ? espacioArriba : espacioAbajo;
  const alto = Math.min(altoPanel, altoMaximo);
  const superior = Math.max(
    superiorVentana + margen,
    Math.min(
      arriba ? ancla.top - alto - margen : ancla.bottom + margen,
      limiteInferior - alto,
    ),
  );
  const izquierda = Math.max(
    inicioVentana + margen,
    Math.min(
      derechaIzquierda ? ancla.right - ancho : ancla.left,
      inicioVentana + anchoVentana - ancho - margen,
    ),
  );
  return {
    ancho,
    altoMaximo,
    superior,
    inicio: derechaIzquierda ? anchoDocumento - izquierda - ancho : izquierda,
  };
}

from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP, localcontext

CENTAVO = Decimal('0.01')
MAXIMO_IMPORTE = Decimal('9999999999999999.99')


def calcular_importes(pesos, precio):
    """Redondear una vez por producto/entrega; distribuir centavos por resto mayor.

    Los pesos vienen de aportes medidos. Solo los centavos monetarios se reparten.
    El orden estable por aporte desempata, sin modificar los kilos originales.
    """
    with localcontext() as contexto:
        contexto.prec = 40
        exactos = [peso * precio for peso in pesos]
        total = sum(exactos, Decimal(0)).quantize(CENTAVO, rounding=ROUND_HALF_UP)
        importes = [valor.quantize(CENTAVO, rounding=ROUND_DOWN) for valor in exactos]
        restantes = int((total - sum(importes, Decimal(0))) / CENTAVO)
        orden = sorted(range(len(pesos)), key=lambda i: (-(exactos[i] - importes[i]), i))
        for indice in orden[:restantes]:
            importes[indice] += CENTAVO
        return total, importes

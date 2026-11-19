from decimal import Decimal

UNIDADES = ('cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
    'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
    'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve')
DECENAS = ('', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa')
CENTENAS = ('', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos')
UNIDADES_EN = ('zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen')
DECENAS_EN = ('', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety')


def apocopar(texto):
    if texto.endswith('veintiuno'):
        return texto[:-9] + 'veintiún'
    return texto[:-3] + 'un' if texto.endswith('uno') else texto


def entero_es(numero):
    if numero < 30:
        return UNIDADES[numero]
    if numero < 100:
        decena, unidad = divmod(numero, 10)
        return DECENAS[decena] + (' y ' + UNIDADES[unidad] if unidad else '')
    if numero == 100:
        return 'cien'
    if numero < 1000:
        centena, resto = divmod(numero, 100)
        return CENTENAS[centena] + (' ' + entero_es(resto) if resto else '')
    for escala, singular, plural in [(10**12, 'un billón', 'billones'), (10**6, 'un millón', 'millones'), (1000, 'mil', 'mil')]:
        if numero >= escala:
            grupo, resto = divmod(numero, escala)
            texto = singular if grupo == 1 else apocopar(entero_es(grupo)) + ' ' + plural
            return texto + (' ' + entero_es(resto) if resto else '')


def entero_en(numero):
    if numero < 20:
        return UNIDADES_EN[numero]
    if numero < 100:
        decena, unidad = divmod(numero, 10)
        return DECENAS_EN[decena] + ('-' + UNIDADES_EN[unidad] if unidad else '')
    if numero < 1000:
        centena, resto = divmod(numero, 100)
        return UNIDADES_EN[centena] + ' hundred' + (' ' + entero_en(resto) if resto else '')
    for escala, nombre in [(10**15, 'quadrillion'), (10**12, 'trillion'), (10**9, 'billion'), (10**6, 'million'), (1000, 'thousand')]:
        if numero >= escala:
            grupo, resto = divmod(numero, escala)
            return entero_en(grupo) + ' ' + nombre + (' ' + entero_en(resto) if resto else '')


def importe_en_letras(importe, idioma='es'):
    centavos = int(Decimal(importe) * 100)
    entero, fraccion = divmod(centavos, 100)
    texto = apocopar(entero_es(entero)) if idioma == 'es' else entero_en(entero)
    return f'{texto.capitalize()} {fraccion:02d}/100 Bolivianos'

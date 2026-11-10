"""Colores por destino, independientes de su orden, con el almacén en verde."""
from colorsys import hls_to_rgb


COLOR_ALMACEN = '#16803c'
PALETA_DESTINOS = ('#2563eb', '#9333ea', '#c2410c', '#0f766e', '#be185d', '#4f46e5',
                    '#a16207', '#0e7490', '#b91c1c', '#7c3aed', '#047857', '#9d174d')


def contraste_blanco(componentes):
    lineales = [valor / 12.92 if valor <= 0.04045 else ((valor + 0.055) / 1.055) ** 2.4 for valor in componentes]
    luminancia = sum(valor * peso for valor, peso in zip(lineales, (0.2126, 0.7152, 0.0722)))
    return 1.05 / (luminancia + 0.05)


def colorear_puntos(puntos):
    sucursales = sorted({punto['sucursal'] for punto in puntos if punto['tipo'] == 'sucursal'})
    colores = {}
    for indice, sucursal in enumerate(sucursales):
        if indice < len(PALETA_DESTINOS):
            color = PALETA_DESTINOS[indice]
        else:
            luminosidad = 0.39
            componentes = hls_to_rgb(((indice * 137.507764) % 360) / 360, luminosidad, 0.72)
            while contraste_blanco(componentes) < 4.7:
                luminosidad -= 0.01
                componentes = hls_to_rgb(((indice * 137.507764) % 360) / 360, luminosidad, 0.72)
            color = '#' + ''.join(f'{round(componente * 255):02x}' for componente in componentes)
        colores[sucursal] = color
    return [{**punto, 'color': colores.get(punto.get('sucursal'), COLOR_ALMACEN)} for punto in puntos]


def colorear_tramos(tramos, puntos):
    return [{**tramo, 'color': puntos[indice + 1]['color'],
             'destino_parada': puntos[indice + 1]['parada']}
            for indice, tramo in enumerate(tramos)]

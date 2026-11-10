"""Actualiza adaptadores web/Android desde los SVG canónicos del proyecto."""
import json
from pathlib import Path
from xml.etree import ElementTree

raiz = Path(__file__).resolve().parents[1]
constantes = []
for nombre, constante in [('almacen', 'iconoAlmacenMapa'), ('sucursales', 'iconoSucursalMapa'), ('camion', 'iconoCamionMapa')]:
    archivo = raiz / 'recursos/mapas' / (nombre + '.svg')
    contenido = archivo.read_text(encoding='utf-8').strip()
    arbol = ElementTree.fromstring(contenido)
    for elemento in arbol.iter():
        if elemento.tag.split('}')[-1] not in ('svg', 'g', 'path', 'polygon', 'circle', 'rect', 'ellipse', 'polyline', 'line'):
            raise ValueError('El icono contiene elementos no admitidos.')
        if any(atributo.lower().startswith('on') for atributo in elemento.attrib):
            raise ValueError('El icono contiene atributos no admitidos.')
    (raiz / 'Frontend/src/icons' / (nombre + '-mapa.svg')).write_text(contenido + '\n', encoding='utf-8')
    constantes.append('export const ' + constante + ' =\n  ' + json.dumps(contenido, ensure_ascii=False) + ';')
salida = '// Generado desde los SVG entregados por el usuario en recursos/mapas.\n' + '\n'.join(constantes) + '''
export function iconoMapaDestino(esAlmacen: boolean, color: string): string {
  if (esAlmacen) return iconoAlmacenMapa;
  const seguro = /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb';
  return iconoSucursalMapa.replaceAll('#FF507D', seguro).replaceAll('#D23C69', seguro);
}
'''
for archivo in ['Movil/src/modulos/recorrido/presentacion/iconosMapa.ts', 'Frontend/src/components/despachos/iconosMapa.ts']:
    (raiz / archivo).write_text(salida, encoding='utf-8')
print('Iconos del mapa sincronizados desde recursos/mapas.')

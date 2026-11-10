"""Reparto ficticio aislado: API del chofer, PostgreSQL y OSRM real, sin datos habituales."""
import os
import sys
from pathlib import Path
raiz = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(raiz / 'Backend'))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.pruebas_aisladas'
import django
django.setup()
from django.conf import settings
from django.test.utils import get_runner
from despachos.test_alternativas_ruta import PruebasAlternativasRuta
from despachos.rutas_carretera import calcular_ruta
from despachos.models import ConsultaAlternativasRuta
from despachos.servicios import version_despacho
from inventario.models import MovimientoInventario
from cajillas.models import MovimientoCajilla


class PruebaMotorReal(PruebasAlternativasRuta):
    def test_motor_real(self):
        viaje = self.crear_despacho(chofer=self.chofer.pk)
        self.operar(viaje, 'enviar')
        calcular_ruta(self.chofer, viaje.pk, self.datos_ruta(viaje), como_chofer=True)
        cliente = self.navegador()
        base = viaje.planes_ruta.first()
        version = self.datos_ruta(viaje)['version']
        cantidades = (MovimientoInventario.objects.count(), MovimientoCajilla.objects.count())
        opciones = []
        elegida = False
        for tramo in range(1, len(base.tramos)+1):
            respuesta = cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/consultar-alternativas/',
                self.datos_ruta(viaje, plan=base.pk, tramo=tramo), format='json', secure=True)
            self.assertEqual(respuesta.status_code, 200, respuesta.data)
            opciones.append(len(respuesta.data['opciones']))
            if len(respuesta.data['opciones']) > 1:
                resultado, _ = self.elegir(viaje, cliente, respuesta.data['consulta'])
                self.assertEqual(resultado.status_code, 200, resultado.data)
                self.assertEqual(resultado.data['estado'], 'pendiente_aprobacion')
                nuevo = viaje.planes_ruta.first()
                self.assertEqual(nuevo.puntos, base.puntos)
                self.assertEqual(nuevo.tramos[tramo-1]['geometria'], respuesta.data['opciones'][1]['geometria'])
                self.aprobar(viaje)
                self.assertEqual(cliente.post(f'/api/v1/chofer/mis-viajes/{viaje.pk}/iniciar/', self.datos_ruta(viaje), format='json', secure=True).status_code, 200)
                elegida = True
                break
        self.assertEqual(MovimientoInventario.objects.count(), cantidades[0])
        if not elegida:
            viaje.refresh_from_db()
            self.assertEqual(version_despacho(viaje), version)
            self.assertEqual(MovimientoCajilla.objects.count(), cantidades[1])
        self.assertTrue(ConsultaAlternativasRuta.objects.exists())
        print({'motor_real': True, 'opciones_por_tramo': opciones, 'alternativa_real_elegida': elegida,
            'sin_operaciones_habituales': True})


if __name__ == '__main__':
    if not settings.ENTORNO_PRUEBAS_AISLADAS:
        raise RuntimeError('Se requiere la base aislada.')
    raise SystemExit(bool(get_runner(settings)(interactive=False, keepdb=True, verbosity=1).run_tests(['__main__.PruebaMotorReal.test_motor_real'])))

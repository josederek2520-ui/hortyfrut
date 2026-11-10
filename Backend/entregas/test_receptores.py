import uuid
from django.test import TestCase
from django.contrib.auth.models import Permission
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.test import APIClient
from usuarios.models import Usuario
from despachos.test_descarga_pedidos import DatosDescargaPedidos
from .models import Entrega, OperacionEntrega
from .vistas import representar
from .consultas import version_entrega
from .servicios import guardar_hoja, ejecutar_accion, ConflictoEntrega


class PruebasReceptorPedidos(DatosDescargaPedidos, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_descargas()
        cls.receptor = Usuario.objects.create_user(email='receptor@pruebas.test', cedula_identidad='987120', first_name='Ana', last_name='Rojas')
        cls.receptor.user_permissions.set(Permission.objects.filter(content_type__app_label='entregas', codename__in=['view_entrega', 'add_entrega', 'change_entrega', 'enviar_entrega']))
        cls.centro.encargado_pedidos = cls.receptor
        cls.centro.save(update_fields=['encargado_pedidos'])

    def preparar(self):
        despacho, _ = self.iniciar_descarga()
        self.confirmar_pedido(despacho, self.pedido_centro)
        return despacho

    def datos(self, despacho):
        hoja = representar(self.actor, despacho.pk, self.pedido_centro.pk)
        return {'clave_operacion': str(uuid.uuid4()), 'version': hoja['version'], 'fecha_recepcion': str(self.hoy),
                'recibido_por': 'Nombre ajeno enviado desde un cliente',
                'lineas': [{'producto': p['producto'], 'cajas_recibidas': p['cajas'], 'unidades_recibidas': p['unidades'],
                            'peso_recibido_kg': p['peso_kg']} for p in hoja['origen']['productos']],
                'aportes': [{'carga': a['carga'], 'lote': a['lote'], 'peso_recibido_kg': a['peso_kg']}
                            for p in hoja['origen']['productos'] for a in p['aportes']]}

    def actuar(self, despacho, entrega, accion):
        entrega.refresh_from_db()
        return ejecutar_accion(self.actor, despacho.pk, self.pedido_centro.pk, accion,
                               {'clave_operacion': str(uuid.uuid4()), 'version': version_entrega(entrega, entrega.origen)})

    def test_receptor_es_usuario_de_pedidos_y_nombre_no_se_puede_suplantar(self):
        despacho = self.preparar()
        hoja = representar(self.actor, despacho.pk, self.pedido_centro.pk)
        self.assertEqual(hoja['recibido_por'], 'Ana Rojas')
        self.assertEqual(Entrega.objects.count(), 0)
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        self.assertEqual(entrega.recibido_por_usuario_id, self.receptor.pk)
        self.assertEqual(entrega.recibido_por, 'Ana Rojas')
        self.assertEqual(entrega.responsable_id, self.actor.pk)

    def test_sin_encargado_activo_admite_borrador_y_bloquea_envio(self):
        despacho = self.preparar()
        self.receptor.is_active = False
        self.receptor.save(update_fields=['is_active'])
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        self.assertEqual(entrega.recibido_por, '')
        self.assertIsNone(entrega.recibido_por_usuario_id)
        with self.assertRaises(ValidationError):
            self.actuar(despacho, entrega, 'enviar')

    def test_cambio_de_asignacion_antes_de_guardar_exige_nueva_version(self):
        despacho = self.preparar()
        datos = self.datos(despacho)
        self.centro.encargado_pedidos = self.actor
        self.centro.save(update_fields=['encargado_pedidos'])
        with self.assertRaises(ConflictoEntrega):
            guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.assertEqual(Entrega.objects.count(), 0)

    def test_reintento_y_cambio_posterior_conservan_identidad_original(self):
        despacho = self.preparar()
        datos = self.datos(despacho)
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.centro.encargado_pedidos = self.actor
        self.centro.save(update_fields=['encargado_pedidos'])
        repetida = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, datos)
        self.assertEqual(repetida.pk, entrega.pk)
        self.assertEqual(OperacionEntrega.objects.count(), 1)
        self.actuar(despacho, entrega, 'enviar')
        confirmada = self.actuar(despacho, entrega, 'confirmar')
        self.assertEqual(confirmada.recibido_por, 'Ana Rojas')
        self.assertEqual(confirmada.recibido_por_usuario_id, self.receptor.pk)

    def test_historial_legado_no_infiere_usuario_a_partir_del_nombre(self):
        despacho = self.preparar()
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        Entrega.objects.filter(pk=entrega.pk).update(recibido_por_usuario=None, recibido_por='Nombre histórico')
        entrega = guardar_hoja(self.actor, despacho.pk, self.pedido_centro.pk, self.datos(despacho))
        self.assertEqual(entrega.recibido_por, 'Nombre histórico')
        self.assertIsNone(entrega.recibido_por_usuario_id)

    def test_contadores_respetan_alcance_y_no_dependen_de_la_pestana(self):
        despacho = self.preparar()
        cliente = APIClient()
        cliente.force_authenticate(self.receptor)
        respuesta = cliente.get('/api/v1/entregas/', {'estado': 'confirmada'})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data['count'], 0)
        self.assertEqual(respuesta.data['resumen_estados']['pendiente'], 1)
        fila = cliente.get('/api/v1/entregas/').data['results'][0]
        self.assertTrue(fila['acciones']['registrar'])
        self.assertFalse(fila['acciones']['revisar'])

    def test_consultar_todas_no_habilita_registrar_sucursal_ajena(self):
        despacho = self.preparar()
        lector = Usuario.objects.create_user(email='lector@pruebas.test', cedula_identidad='987121')
        lector.user_permissions.set(Permission.objects.filter(content_type__app_label='entregas', codename__in=['view_entrega', 'ver_todas_entregas', 'add_entrega']))
        cliente = APIClient()
        cliente.force_authenticate(lector)
        fila = cliente.get('/api/v1/entregas/').data['results'][0]
        self.assertFalse(fila['acciones']['registrar'])
        with self.assertRaises(PermissionDenied):
            guardar_hoja(lector, despacho.pk, self.pedido_centro.pk, self.datos(despacho))

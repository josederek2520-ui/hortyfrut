import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.contrib.auth.models import Permission, Group
from django.core.management import call_command
from django.db import close_old_connections
from django.test import TestCase, TransactionTestCase, skipUnlessDBFeature
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.test import APIClient
from usuarios.models import Usuario
from almacenes.models import Almacen
from clientes.models import Cliente, Sucursal
from auditoria.models import RegistroActividad
from .models import Cajilla, MovimientoCajilla
from .consultas import cajillas_con_saldos, version_cajilla, saldo_almacen, pendiente_sucursal
from .servicios import crear_cajilla, registrar_movimiento, ConflictoCajillas


class DatosCajillas:
    @classmethod
    def preparar_datos(cls):
        cls.actor = Usuario.objects.create_superuser(email='admin@cajillas.test', cedula_identidad='92001', password='Cajillas_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@cajillas.test', cedula_identidad='92002')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='cajillas', codename='view_cajilla'))
        cls.almacen = Almacen.objects.create(nombre='Central', direccion='Calle Uno')
        cls.otro_almacen = Almacen.objects.create(nombre='Norte', direccion='Calle Dos')
        cls.cliente = Cliente.objects.create(razon_social='Supermercado', nit='92001')
        cls.sucursal = Sucursal.objects.create(cliente=cls.cliente, nombre='Centro', direccion='Avenida Uno')
        cls.otra_sucursal = Sucursal.objects.create(cliente=cls.cliente, nombre='Sur', direccion='Avenida Dos')

    def crear(self, **cambios):
        return crear_cajilla(self.actor, self.datos_creacion(**cambios))[0]

    def datos_creacion(self, **cambios):
        return {'color': 'Verde', 'cantidad_inicial': 100, 'almacen': self.almacen.pk, 'clave_operacion': str(uuid.uuid4()), **cambios}

    def datos_movimiento(self, cajilla, tipo='salida', **cambios):
        return {'tipo': tipo, 'cantidad': 30, 'almacen': self.almacen.pk,
                'sucursal': self.sucursal.pk if tipo != 'ingreso' else None,
                'version': version_cajilla(cajilla), 'clave_operacion': str(uuid.uuid4()), **cambios}

    def mover(self, cajilla, tipo='salida', **cambios):
        return registrar_movimiento(self.actor, cajilla.pk, self.datos_movimiento(cajilla, tipo, **cambios))[0]


class PruebasCajillas(DatosCajillas, TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.preparar_datos()

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.actor)

    def test_ciclo_de_cien_treinta_salen_veinte_regresan(self):
        cajilla = self.crear()
        self.mover(cajilla, cantidad=30)
        self.mover(cajilla, 'devolucion', cantidad=20)
        saldo = cajillas_con_saldos().get()
        self.assertEqual((saldo.total, saldo.en_almacen, saldo.en_sucursales), (100, 90, 10))
        self.assertEqual(pendiente_sucursal(cajilla.pk, self.sucursal.pk), 10)
        self.assertEqual(saldo_almacen(cajilla.pk, self.almacen.pk), 90)

    def test_flujo_http_completo_expone_saldos_fechas_y_trazabilidad(self):
        alta = self.client.post('/api/v1/cajillas/', self.datos_creacion(), format='json')
        self.assertEqual(alta.status_code, 201, alta.data)
        self.assertEqual(alta.data['en_almacen'], 100)
        self.assertTrue(alta.data['creado_en'])
        cajilla = Cajilla.objects.get(pk=alta.data['id'])
        salida = self.client.post(f'/api/v1/cajillas/{cajilla.pk}/movimientos/', self.datos_movimiento(cajilla), format='json')
        self.assertEqual(salida.status_code, 201, salida.data)
        self.assertEqual(salida.data['cajilla']['en_almacen'], 70)
        self.assertEqual(salida.data['movimiento']['responsable_nombre'], cajilla.responsable_nombre)
        pendientes = self.client.get(f'/api/v1/cajillas/{cajilla.pk}/saldos-sucursales/')
        self.assertEqual(pendientes.data['results'][0]['cantidad'], 30)
        self.assertEqual(pendientes.data['results'][0]['cliente'], self.cliente.razon_social)
        devolucion = self.client.post(f'/api/v1/cajillas/{cajilla.pk}/movimientos/', self.datos_movimiento(cajilla, 'devolucion', cantidad=20), format='json')
        self.assertEqual(devolucion.status_code, 201, devolucion.data)
        self.assertEqual(devolucion.data['cajilla']['en_sucursales'], 10)
        self.assertEqual(devolucion.data['cajilla']['total'], 100)

    def test_saldos_vacios_y_selector_salida_excluye_almacen_inactivo(self):
        self.assertEqual(self.client.get('/api/v1/cajillas/resumen/').data, {'total': 0, 'en_almacen': 0, 'en_sucursales': 0, 'colores': 0})
        cajilla = self.crear()
        self.almacen.activo = False
        self.almacen.save()
        consulta = f'/api/v1/cajillas/{cajilla.pk}/saldos-almacenes/'
        self.assertEqual(self.client.get(consulta).data['results'][0]['cantidad'], 100)
        self.assertEqual(self.client.get(consulta, {'operacion': 'salida'}).data['count'], 0)

    def test_color_normalizado_unico_sin_mayusculas(self):
        self.crear(color='  VERDE  ')
        self.assertEqual(Cajilla.objects.get().color, 'Verde')
        with self.assertRaises(ValidationError):
            self.crear(color='verde')

    def test_cero_inicial_no_crea_movimiento(self):
        cajilla = self.crear(cantidad_inicial=0, almacen=None)
        self.assertFalse(cajilla.movimientos.exists())
        self.mover(cajilla, 'ingreso', cantidad=12)
        self.assertEqual(cajillas_con_saldos().get().total, 12)

    def test_cantidad_inicial_requiere_almacen_activo(self):
        with self.assertRaises(ValidationError):
            self.crear(almacen=None)
        self.almacen.activo = False
        self.almacen.save()
        with self.assertRaises(ValidationError):
            self.crear()
        self.assertFalse(Cajilla.objects.exists())

    def test_cantidades_solo_enteras_positivas(self):
        cajilla = self.crear()
        for cantidad in (0, -1, '1.5', True, 2147483648):
            with self.subTest(cantidad=cantidad), self.assertRaises(ValidationError):
                self.mover(cajilla, cantidad=cantidad)

    def test_no_permite_salida_mayor_que_el_saldo_del_almacen(self):
        cajilla = self.crear()
        with self.assertRaises(ValidationError):
            self.mover(cajilla, cantidad=101)
        with self.assertRaises(ValidationError):
            self.mover(cajilla, almacen=self.otro_almacen.pk, cantidad=1)
        self.assertEqual(cajillas_con_saldos().get().en_almacen, 100)

    def test_devolucion_mayor_o_de_otra_sucursal_no_es_aceptada(self):
        cajilla = self.crear()
        self.mover(cajilla, cantidad=30)
        with self.assertRaises(ValidationError):
            self.mover(cajilla, 'devolucion', cantidad=31)
        with self.assertRaises(ValidationError):
            self.mover(cajilla, 'devolucion', sucursal=self.otra_sucursal.pk, cantidad=1)

    def test_devolucion_puede_llegar_a_otro_almacen(self):
        cajilla = self.crear()
        self.mover(cajilla, cantidad=30)
        self.mover(cajilla, 'devolucion', almacen=self.otro_almacen.pk, cantidad=20)
        self.assertEqual(saldo_almacen(cajilla.pk, self.almacen.pk), 70)
        self.assertEqual(saldo_almacen(cajilla.pk, self.otro_almacen.pk), 20)
        self.assertEqual(cajillas_con_saldos().get().total, 100)

    def test_sucursal_y_cliente_inactivos_conservan_deuda_y_admiten_devolucion(self):
        cajilla = self.crear()
        self.mover(cajilla, cantidad=30)
        self.sucursal.activo = False
        self.sucursal.save()
        self.cliente.activo = False
        self.cliente.save()
        with self.assertRaises(ValidationError):
            self.mover(cajilla, cantidad=1)
        opciones = self.client.get('/api/v1/cajillas/sucursales/', {'operacion': 'devolucion', 'cajilla': cajilla.pk})
        self.assertEqual(opciones.status_code, 200, opciones.data)
        self.assertEqual(opciones.data['results'][0]['pendiente'], 30)
        self.assertFalse(opciones.data['results'][0]['activo'])
        self.mover(cajilla, 'devolucion', cantidad=30)
        self.assertEqual(pendiente_sucursal(cajilla.pk, self.sucursal.pk), 0)

    def test_reintento_creacion_idempotente_y_otro_cuerpo_no_reutiliza_clave(self):
        datos = self.datos_creacion()
        primero, _ = crear_cajilla(self.actor, datos)
        segundo, creada = crear_cajilla(self.actor, datos)
        self.assertFalse(creada)
        self.assertEqual(primero.pk, segundo.pk)
        self.assertEqual(MovimientoCajilla.objects.count(), 1)
        with self.assertRaises(ConflictoCajillas):
            crear_cajilla(self.actor, {**datos, 'cantidad_inicial': 99})

    def test_reintento_movimiento_no_duplica_saldo_ni_auditoria(self):
        cajilla = self.crear()
        datos = self.datos_movimiento(cajilla)
        primero, _ = registrar_movimiento(self.actor, cajilla.pk, datos)
        segundo, creado = registrar_movimiento(self.actor, cajilla.pk, datos)
        self.assertFalse(creado)
        self.assertEqual(primero.pk, segundo.pk)
        self.assertEqual(cajillas_con_saldos().get().en_sucursales, 30)
        self.assertEqual(RegistroActividad.objects.filter(modulo='cajillas', accion='registrar_salida').count(), 1)
        with self.assertRaises(ConflictoCajillas):
            registrar_movimiento(self.actor, cajilla.pk, {**datos, 'cantidad': 29})

    def test_version_obsoleta_exige_recarga(self):
        cajilla = self.crear()
        datos = self.datos_movimiento(cajilla)
        self.mover(cajilla, 'ingreso', cantidad=1)
        with self.assertRaises(ConflictoCajillas):
            registrar_movimiento(self.actor, cajilla.pk, datos)

    def test_clave_de_movimiento_reutilizada_para_otro_inicial_revierte_el_color(self):
        cajilla = self.crear()
        movimiento = self.mover(cajilla)
        with self.assertRaises(ConflictoCajillas):
            self.crear(color='Azul', clave_operacion=str(movimiento.clave_operacion))
        self.assertFalse(Cajilla.objects.filter(color='Azul').exists())
        self.assertEqual(MovimientoCajilla.objects.count(), 2)

    def test_permiso_crear_color_no_permite_agregar_existencias(self):
        self.lector.user_permissions.add(Permission.objects.get(content_type__app_label='cajillas', codename='add_cajilla'))
        usuario = Usuario.objects.get(pk=self.lector.pk)
        cajilla, _ = crear_cajilla(usuario, self.datos_creacion(cantidad_inicial=0))
        with self.assertRaises(PermissionDenied):
            crear_cajilla(usuario, self.datos_creacion(color='Azul'))
        with self.assertRaises(PermissionDenied):
            registrar_movimiento(usuario, cajilla.pk, self.datos_movimiento(cajilla, 'ingreso', cantidad=1))

    def test_cada_accion_tiene_permiso_y_ver_es_necesario(self):
        cajilla = self.crear()
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/cajillas/').status_code, 200)
        self.assertEqual(self.client.get('/api/v1/almacenes/').status_code, 403)
        self.assertEqual(self.client.get('/api/v1/cajillas/almacenes/').status_code, 200)
        self.assertEqual(self.client.post('/api/v1/cajillas/', self.datos_creacion(color='Azul'), format='json').status_code, 403)
        for tipo in ('ingreso', 'salida', 'devolucion'):
            self.assertEqual(self.client.post(f'/api/v1/cajillas/{cajilla.pk}/movimientos/', self.datos_movimiento(cajilla, tipo), format='json').status_code, 403)

    def test_auditoria_fallida_revierte_creacion_y_movimientos(self):
        with patch('cajillas.servicios.registrar_actividad', side_effect=RuntimeError('sin evidencia')):
            with self.assertRaises(RuntimeError):
                self.crear()
        self.assertFalse(Cajilla.objects.exists())
        cajilla = self.crear()
        with patch('cajillas.servicios.registrar_actividad', side_effect=RuntimeError('sin evidencia')):
            with self.assertRaises(RuntimeError):
                self.mover(cajilla)
        self.assertEqual(cajilla.movimientos.count(), 1)
        self.assertEqual(cajillas_con_saldos().get().en_almacen, 100)

    def test_campos_controlados_y_movimientos_inmutables(self):
        cajilla = self.crear()
        for campo, valor in [('responsable', 1), ('creado_en', '2026-01-01'), ('total', 5), ('tipo', 'inicial')]:
            datos = self.datos_movimiento(cajilla)
            datos[campo] = valor
            self.assertEqual(self.client.post(f'/api/v1/cajillas/{cajilla.pk}/movimientos/', datos, format='json').status_code, 400)
        self.assertEqual(self.client.patch(f'/api/v1/cajillas/{cajilla.pk}/', {'color': 'Azul'}, format='json').status_code, 405)
        self.assertEqual(self.client.delete(f'/api/v1/cajillas/{cajilla.pk}/').status_code, 405)

    def test_resumen_consulta_trazabilidad_y_paginacion_diez(self):
        cajilla = self.crear()
        for indice in range(11):
            self.crear(color=f'Color {indice}', cantidad_inicial=0)
            self.mover(cajilla, 'ingreso', cantidad=1)
            Almacen.objects.create(nombre=f'Otro {indice}', direccion='Calle')
        for ruta in ('cajillas/', 'cajillas/movimientos/', 'cajillas/almacenes/'):
            datos = self.client.get(f'/api/v1/{ruta}', {'page_size': 100})
            self.assertEqual(datos.status_code, 200, datos.data)
            self.assertEqual(len(datos.data['results']), 10)
        resumen = self.client.get('/api/v1/cajillas/resumen/')
        self.assertEqual(resumen.status_code, 200, resumen.data)
        self.assertEqual(resumen.data, {'total': 111, 'en_almacen': 111, 'en_sucursales': 0, 'colores': 12})
        self.assertEqual(self.client.get(f'/api/v1/cajillas/{cajilla.pk}/saldos-almacenes/').data['results'][0]['cantidad'], 111)

    def test_rol_inicial_no_amplia_roles_existentes(self):
        grupo = Group.objects.create(name='Administrador de cajillas')
        permiso = Permission.objects.get(content_type__app_label='cajillas', codename='view_cajilla')
        grupo.permissions.set([permiso])
        call_command('preparar_roles', verbosity=0)
        self.assertEqual(list(grupo.permissions.all()), [permiso])


@skipUnlessDBFeature('has_select_for_update')
class PruebasConcurrenciaCajillas(DatosCajillas, TransactionTestCase):
    def setUp(self):
        self.preparar_datos()

    def ejecutar(self, funcion):
        barrera = Barrier(2)
        def trabajo(indice):
            close_old_connections()
            try:
                actor = Usuario.objects.get(pk=self.actor.pk)
                barrera.wait(timeout=10)
                try:
                    return funcion(actor, indice)
                except (ConflictoCajillas, ValidationError):
                    return 'rechazado'
            finally:
                close_old_connections()
        with ThreadPoolExecutor(max_workers=2) as ejecutor:
            return list(ejecutor.map(trabajo, [0, 1]))

    def test_salidas_simultaneas_no_agotan_dos_veces_el_saldo(self):
        cajilla = self.crear()
        datos = self.datos_movimiento(cajilla, cantidad=80)
        def salida(actor, indice):
            registrar_movimiento(actor, cajilla.pk, {**datos, 'clave_operacion': str(uuid.uuid4())})
            return 'registrado'
        self.assertCountEqual(self.ejecutar(salida), ['registrado', 'rechazado'])
        self.assertEqual(saldo_almacen(cajilla.pk, self.almacen.pk), 20)

    def test_devoluciones_simultaneas_no_superan_el_pendiente(self):
        cajilla = self.crear()
        self.mover(cajilla, cantidad=30)
        datos = self.datos_movimiento(cajilla, 'devolucion', cantidad=20)
        def devolver(actor, indice):
            registrar_movimiento(actor, cajilla.pk, {**datos, 'clave_operacion': str(uuid.uuid4())})
            return 'registrado'
        self.assertCountEqual(self.ejecutar(devolver), ['registrado', 'rechazado'])
        self.assertEqual(pendiente_sucursal(cajilla.pk, self.sucursal.pk), 10)

    def test_reintento_concurrente_solo_registra_una_salida(self):
        cajilla = self.crear()
        datos = self.datos_movimiento(cajilla)
        def salida(actor, indice):
            registrar_movimiento(actor, cajilla.pk, datos)
            return 'registrado'
        self.assertEqual(self.ejecutar(salida), ['registrado', 'registrado'])
        self.assertEqual(pendiente_sucursal(cajilla.pk, self.sucursal.pk), 30)

    def test_creaciones_concurrentes_con_misma_clave_no_duplican_inicial(self):
        datos = self.datos_creacion()
        def crear(actor, indice):
            crear_cajilla(actor, datos)
            return 'registrado'
        self.assertEqual(self.ejecutar(crear), ['registrado', 'registrado'])
        self.assertEqual(MovimientoCajilla.objects.count(), 1)

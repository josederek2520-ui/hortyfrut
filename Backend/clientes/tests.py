import json
from decimal import Decimal
from unittest.mock import patch
from django.contrib.auth.models import Permission, Group
from django.core.management import call_command
from django.db import IntegrityError, transaction, connection
from django.db.models.deletion import ProtectedError
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework.exceptions import ValidationError
from auditoria.models import RegistroActividad
from usuarios.models import Usuario
from .models import Cliente, Sucursal
from .servicios import guardar_registro, obtener_version


class PruebasClientes(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.administrador = Usuario.objects.create_superuser(email='admin@clientes.test', cedula_identidad='650001', password='ClientesSeguros_2026!')
        cls.lector = Usuario.objects.create_user(email='lector@clientes.test', cedula_identidad='650002')
        cls.editor_cliente = Usuario.objects.create_user(email='editor@clientes.test', cedula_identidad='650003')
        cls.editor_sucursal = Usuario.objects.create_user(email='sucursal@clientes.test', cedula_identidad='650004')
        cls.sin_cliente = Usuario.objects.create_user(email='sincliente@clientes.test', cedula_identidad='650005')
        cls.lector.user_permissions.set(Permission.objects.filter(content_type__app_label='clientes', codename__in=['view_cliente','view_sucursal']))
        cls.editor_cliente.user_permissions.set(Permission.objects.filter(content_type__app_label='clientes', codename__in=['view_cliente','change_cliente']))
        cls.editor_sucursal.user_permissions.set(Permission.objects.filter(content_type__app_label='clientes', codename__in=['view_cliente','view_sucursal','change_sucursal']))
        cls.sin_cliente.user_permissions.set(Permission.objects.filter(content_type__app_label='clientes', content_type__model='sucursal'))
        cls.cliente = Cliente.objects.create(razon_social='Supermercados Central', nit='000123')
        cls.otro_cliente = Cliente.objects.create(razon_social='Mercado Norte', nit='000124')
        cls.sucursal = Sucursal.objects.create(cliente=cls.cliente, nombre='Centro', direccion='Av. Principal 123')

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.administrador)

    def ruta_sucursales(self, sufijo='', cliente=None):
        return f'/api/v1/clientes/{cliente or self.cliente.pk}/sucursales/{sufijo}'

    def datos_cliente(self, **adicionales):
        return {'razon_social':'  Mercado   Sur  ', 'nit':'000125', **adicionales}

    def datos_sucursal(self, **adicionales):
        return {'nombre':'  Zona   Sur  ', 'direccion':'Av. Central 456', **adicionales}

    def editar_cliente(self, datos):
        return self.client.patch(f'/api/v1/clientes/{self.cliente.pk}/', {**datos,'version':obtener_version(self.cliente)},format='json')

    def editar_sucursal(self, datos):
        return self.client.patch(self.ruta_sucursales(f'{self.sucursal.pk}/'), {**datos,'version':obtener_version(self.sucursal)},format='json')

    def test_crear_cliente_normaliza_contacto_y_conserva_ceros(self):
        respuesta = self.client.post('/api/v1/clientes/',self.datos_cliente(email=' Contacto@Empresa.TEST ',telefono='070123456'),format='json')
        self.assertEqual(respuesta.status_code,201,respuesta.data)
        self.assertEqual(respuesta.data['razon_social'],'Mercado Sur')
        self.assertEqual(respuesta.data['nit'],'000125')
        self.assertEqual(respuesta.data['telefono'],'070123456')
        self.assertEqual(respuesta.data['email'],'contacto@empresa.test')
        self.assertTrue(respuesta.data['activo'])
        self.assertEqual(respuesta.data['cantidad_sucursales'],0)
        self.assertNotIn('actualizado_en',respuesta.data)

    def test_cliente_exige_razon_social_y_nit_validos(self):
        for datos,campo in [(dict(razon_social='  '),'razon_social'),(dict(razon_social='x'*151),'razon_social'),
                            *[(dict(nit=valor),'nit') for valor in ('',None,'12-3','١٢٣','1'*21)],
                            (dict(telefono='+591 777'),'telefono'),(dict(telefono='1'*31),'telefono'),(dict(email='incorrecto'),'email')]:
            with self.subTest(campo=campo,datos=datos):
                respuesta = self.client.post('/api/v1/clientes/',self.datos_cliente(**datos),format='json')
                self.assertEqual(respuesta.status_code,400,respuesta.data)
                self.assertIn(campo,respuesta.data['errors'])

    def test_nit_unico_incluso_inactivo_y_constraint_de_base(self):
        self.cliente.activo=False
        self.cliente.save()
        respuesta = self.client.post('/api/v1/clientes/',self.datos_cliente(nit=self.cliente.nit),format='json')
        self.assertEqual(respuesta.status_code,400)
        self.assertIn('nit',respuesta.data['errors'])
        with self.assertRaises(IntegrityError), transaction.atomic():
            Cliente.objects.create(razon_social='Duplicado',nit=self.cliente.nit)
        with self.assertRaises(ValidationError) as contexto:
            guardar_registro(Cliente,self.administrador,self.datos_cliente(nit=self.cliente.nit))
        self.assertIn('nit',contexto.exception.detail)

    def test_postgres_rechaza_identificadores_y_telefonos_no_numericos(self):
        for datos in [dict(nit='12A'),dict(nit=''),dict(nit='999',telefono='12 34')]:
            with self.subTest(datos=datos), self.assertRaises(IntegrityError), transaction.atomic():
                Cliente.objects.create(razon_social='Invalido',**datos)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Sucursal.objects.create(cliente=self.cliente,nombre='Telefono invalido',direccion='Direccion',telefono='12+34')

    def test_crear_sucursal_con_direccion_y_coordenadas_opcionales(self):
        respuesta = self.client.post(self.ruta_sucursales(),self.datos_sucursal(referencia='  Puerta   verde  '),format='json')
        self.assertEqual(respuesta.status_code,201,respuesta.data)
        self.assertEqual(respuesta.data['nombre'],'Zona Sur')
        self.assertEqual(respuesta.data['referencia'],'Puerta verde')
        self.assertEqual(respuesta.data['cliente'],self.cliente.pk)
        self.assertIsNone(respuesta.data['latitud'])
        self.assertIsNone(respuesta.data['longitud'])
        self.assertNotIn('actualizado_en',respuesta.data)
        self.assertEqual(self.client.get(f'/api/v1/clientes/{self.cliente.pk}/').data['cantidad_sucursales'],2)

    def test_nombre_sucursal_unico_por_cliente_sin_distinguir_mayusculas(self):
        respuesta = self.client.post(self.ruta_sucursales(),self.datos_sucursal(nombre='CENTRO'),format='json')
        self.assertEqual(respuesta.status_code,400)
        self.assertIn('nombre',respuesta.data['errors'])
        respuesta = self.client.post(self.ruta_sucursales(cliente=self.otro_cliente.pk),self.datos_sucursal(nombre='Centro'),format='json')
        self.assertEqual(respuesta.status_code,201)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Sucursal.objects.create(cliente=self.cliente,nombre='CENTRO',direccion='Otra direccion')

    def test_sucursal_exige_nombre_y_direccion_y_telefono_valido(self):
        for campo,valor in [('nombre',' '),('nombre','x'*151),('direccion',''),('direccion','x'*256),('referencia','x'*256),('telefono','(777)')]:
            respuesta = self.client.post(self.ruta_sucursales(),self.datos_sucursal(**{campo:valor}),format='json')
            self.assertEqual(respuesta.status_code,400,respuesta.data)
            self.assertIn(campo,respuesta.data['errors'])

    def test_coordenadas_admiten_cero_y_preservan_precision_y_version(self):
        respuesta = self.client.post(self.ruta_sucursales(),self.datos_sucursal(latitud='-0.0000000',longitud='-68.1234567'),format='json')
        self.assertEqual(respuesta.status_code,201,respuesta.data)
        self.assertEqual(respuesta.data['latitud'],'0.0000000')
        registro = Sucursal.objects.get(pk=respuesta.data['id'])
        self.assertEqual(registro.longitud,Decimal('-68.1234567'))
        self.assertEqual(respuesta.data['version'],obtener_version(registro))
        editada = self.client.patch(self.ruta_sucursales(f'{registro.pk}/'),{'referencia':'Otra puerta','version':respuesta.data['version']},format='json')
        self.assertEqual(editada.status_code,200,editada.data)

    def test_coordenadas_incompletas_fuera_de_rango_y_no_finitas(self):
        for datos in [dict(latitud='-16'),dict(longitud='-68'),dict(latitud='91',longitud='0'),dict(latitud='0',longitud='181'),
                      dict(latitud='NaN',longitud='0'),dict(latitud='Infinity',longitud='0'),dict(latitud='1.12345678',longitud='0')]:
            with self.subTest(datos=datos):
                respuesta = self.client.post(self.ruta_sucursales(),self.datos_sucursal(**datos),format='json')
                self.assertEqual(respuesta.status_code,400,respuesta.data)
                self.assertTrue({'latitud','longitud'} & respuesta.data['errors'].keys())

    def test_postgres_valida_par_de_coordenadas_y_rangos(self):
        for indice,datos in enumerate([dict(latitud=Decimal('1')),dict(latitud=Decimal('91'),longitud=Decimal('0')),dict(latitud=Decimal('0'),longitud=Decimal('-181'))]):
            with self.subTest(datos=datos),self.assertRaises(IntegrityError),transaction.atomic():
                Sucursal.objects.create(cliente=self.cliente,nombre=f'Invalida {indice}',direccion='Direccion',**datos)
        with self.assertRaises(IntegrityError),transaction.atomic(),connection.cursor() as cursor:
            cursor.execute("UPDATE sucursales SET latitud = 'NaN'::numeric, longitud = 0 WHERE id = %s",[self.sucursal.pk])

    def test_edicion_parcial_de_coordenadas_valida_el_par_y_permite_borrarlo(self):
        respuesta=self.editar_sucursal({'latitud':'-16.5','longitud':'-68.1'})
        self.assertEqual(respuesta.status_code,200)
        self.sucursal.refresh_from_db()
        self.assertEqual(self.editar_sucursal({'latitud':None}).status_code,400)
        self.assertEqual(self.editar_sucursal({'latitud':None,'longitud':None}).status_code,200)

    def test_no_se_puede_mover_sucursal_ni_acceder_desde_otro_cliente(self):
        ruta=self.ruta_sucursales(f'{self.sucursal.pk}/',cliente=self.otro_cliente.pk)
        self.assertEqual(self.client.get(ruta).status_code,404)
        self.assertEqual(self.client.patch(ruta,{'nombre':'No mover','version':obtener_version(self.sucursal)},format='json').status_code,404)
        self.assertEqual(self.editar_sucursal({'cliente':self.otro_cliente.pk}).status_code,400)
        self.assertEqual(self.client.get(self.ruta_sucursales(cliente=999999)).status_code,404)

    def test_campos_de_estado_y_fechas_no_se_modifican_desde_formulario(self):
        for ruta,datos in [('/api/v1/clientes/',self.datos_cliente()),(self.ruta_sucursales(),self.datos_sucursal())]:
            for campo in ('activo','creado_en','actualizado_en'):
                respuesta=self.client.post(ruta,{**datos,campo:False},format='json')
                self.assertEqual(respuesta.status_code,400)
                self.assertIn(campo,respuesta.data['errors'])

    def test_lectores_no_pueden_escribir_y_edicion_no_otorga_cambio_de_estado(self):
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.get('/api/v1/clientes/').status_code,200)
        self.assertEqual(self.client.get(self.ruta_sucursales()).status_code,200)
        self.assertEqual(self.client.post('/api/v1/clientes/',self.datos_cliente(),format='json').status_code,403)
        self.assertEqual(self.editar_cliente({'razon_social':'No autorizado'}).status_code,403)
        self.assertEqual(self.editar_sucursal({'nombre':'No autorizado'}).status_code,403)
        self.client.force_authenticate(self.editor_cliente)
        self.assertEqual(self.editar_cliente({'razon_social':'Cliente editado'}).status_code,200)
        self.assertEqual(self.client.get(self.ruta_sucursales()).status_code,403)
        self.assertEqual(self.client.post(f'/api/v1/clientes/{self.cliente.pk}/estado/',{},format='json').status_code,403)
        self.client.force_authenticate(self.editor_sucursal)
        self.assertEqual(self.editar_sucursal({'nombre':'Sucursal editada'}).status_code,200)
        self.assertEqual(self.client.post(self.ruta_sucursales(f'{self.sucursal.pk}/estado/'),{},format='json').status_code,403)

    def test_sucursales_exigen_lectura_del_cliente(self):
        self.client.force_authenticate(self.sin_cliente)
        self.assertEqual(self.client.get(self.ruta_sucursales()).status_code,403)
        self.assertEqual(self.client.post(self.ruta_sucursales(),self.datos_sucursal(),format='json').status_code,403)

    def test_anonimos_y_borrado_fisico_restringidos(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get('/api/v1/clientes/').status_code,401)
        self.client.force_authenticate(self.administrador)
        self.assertEqual(self.client.delete(f'/api/v1/clientes/{self.cliente.pk}/').status_code,405)
        self.assertEqual(self.client.delete(self.ruta_sucursales(f'{self.sucursal.pk}/')).status_code,405)
        self.assertFalse(Permission.objects.filter(content_type__app_label='clientes',codename__startswith='delete_').exists())
        with self.assertRaises(ProtectedError):
            self.cliente.delete()

    def test_version_exigida_y_conflictos_en_cliente_y_sucursal(self):
        for registro,ruta,datos in [(self.cliente,f'/api/v1/clientes/{self.cliente.pk}/',{'razon_social':'Primero'}),(self.sucursal,self.ruta_sucursales(f'{self.sucursal.pk}/'),{'nombre':'Primera'})]:
            version=obtener_version(registro)
            self.assertEqual(self.client.patch(ruta,datos,format='json').status_code,400)
            respuesta=self.client.patch(ruta,{**datos,'version':version},format='json')
            self.assertEqual(respuesta.status_code,200,respuesta.data)
            self.assertEqual(self.client.patch(ruta,{**datos,'version':version},format='json').status_code,409)
            self.assertEqual(self.client.post(ruta+'estado/',{'activo':False,'version':version},format='json').status_code,409)

    def test_cliente_inactivo_conserva_sucursales_y_bloquea_creacion_y_reactivacion(self):
        respuesta=self.client.post(f'/api/v1/clientes/{self.cliente.pk}/estado/',{'activo':False,'version':obtener_version(self.cliente)},format='json')
        self.assertEqual(respuesta.status_code,200)
        self.sucursal.refresh_from_db()
        self.assertTrue(self.sucursal.activo)
        self.assertEqual(self.client.post(self.ruta_sucursales(),self.datos_sucursal(),format='json').status_code,400)
        self.assertEqual(self.editar_sucursal({'nombre':'Conservada'}).status_code,200)
        self.sucursal.refresh_from_db()
        ruta=self.ruta_sucursales(f'{self.sucursal.pk}/estado/')
        self.assertEqual(self.client.post(ruta,{'activo':False,'version':obtener_version(self.sucursal)},format='json').status_code,200)
        self.sucursal.refresh_from_db()
        self.assertEqual(self.client.post(ruta,{'activo':True,'version':obtener_version(self.sucursal)},format='json').status_code,400)
        self.assertEqual(Sucursal.objects.count(),1)

    def test_listados_fijos_de_diez_busqueda_orden_y_contadores(self):
        Cliente.objects.bulk_create([Cliente(razon_social=f'Cliente {indice:02}',nit=str(90000+indice),activo=indice%2==0) for indice in range(12)])
        Sucursal.objects.bulk_create([Sucursal(cliente=self.cliente,nombre=f'Sucursal {indice:02}',direccion='Zona Norte',activo=indice%2==0) for indice in range(12)])
        respuesta=self.client.get('/api/v1/clientes/?page_size=100&tamano=100')
        self.assertEqual(respuesta.data['count'],14)
        self.assertEqual(len(respuesta.data['results']),10)
        self.assertEqual(len(self.client.get('/api/v1/clientes/?pagina=2').data['results']),4)
        self.assertEqual(self.client.get('/api/v1/clientes/?buscar=000123').data['count'],1)
        self.assertEqual(self.client.get('/api/v1/clientes/resumen/?activo=false').data,{'total':14,'activos':8,'inactivos':6})
        self.assertEqual(self.client.get(self.ruta_sucursales()).data['count'],13)
        self.assertEqual(len(self.client.get(self.ruta_sucursales('?pagina=2')).data['results']),3)
        self.assertEqual(self.client.get(self.ruta_sucursales('?buscar=Norte')).data['count'],12)
        self.assertEqual(self.client.get(self.ruta_sucursales('resumen/?activo=false')).data,{'total':13,'activos':7,'inactivos':6})
        self.assertEqual(self.client.get('/api/v1/clientes/?orden=nit').status_code,400)
        self.assertEqual(self.client.get(self.ruta_sucursales('?activo=incorrecto')).status_code,400)

    def test_editar_no_cambia_el_numero_de_sucursales_ni_expone_fecha_interna(self):
        respuesta=self.editar_cliente({'email':'nuevo@empresa.test'})
        self.assertEqual(respuesta.status_code,200)
        self.assertEqual(respuesta.data['cantidad_sucursales'],1)
        self.assertNotIn('actualizado_en',respuesta.data)
        self.assertNotIn('actualizado_en',self.editar_sucursal({'referencia':'Nueva puerta'}).data)

    def test_auditoria_de_negocio_y_http_sin_datos_de_contacto_ni_ubicacion(self):
        respuesta=self.client.post(self.ruta_sucursales(),self.datos_sucursal(telefono='070998877',latitud='-16.1234567',longitud='-68.7654321'),format='json')
        self.assertEqual(respuesta.status_code,201)
        evento=RegistroActividad.objects.get(modulo='sucursales',accion='crear',resultado='exito')
        self.assertEqual(evento.cambios['cliente']['id'],self.cliente.pk)
        for campo in ('telefono','direccion','latitud','longitud'):
            self.assertEqual(evento.cambios[campo],'[dato protegido]')
        contenido=json.dumps(evento.cambios)
        self.assertNotIn('070998877',contenido)
        self.assertNotIn('-16.1234567',contenido)
        self.client.get(self.ruta_sucursales())
        self.assertTrue(RegistroActividad.objects.filter(modulo='sucursales',accion='listar').exists())
        self.client.force_authenticate(self.lector)
        self.assertEqual(self.client.post(self.ruta_sucursales(),self.datos_sucursal(),format='json').status_code,403)
        self.assertTrue(RegistroActividad.objects.filter(modulo='sucursales',resultado='rechazado',codigo_http=403).exists())

    def test_servicios_fuera_de_http_normalizan_y_revierten_si_falla_auditoria(self):
        registro=guardar_registro(Cliente,self.administrador,self.datos_cliente(email='Contacto@Empresa.TEST'))
        self.assertEqual(registro.razon_social,'Mercado Sur')
        self.assertEqual(registro.email,'contacto@empresa.test')
        evento=RegistroActividad.objects.get(modulo='clientes',objeto_id=str(registro.pk),accion='crear')
        self.assertEqual(evento.origen,'sistema')
        self.assertEqual(evento.cambios['nit'],'[dato protegido]')
        with patch('clientes.servicios.registrar_actividad',side_effect=RuntimeError('Sin evidencia')):
            with self.assertRaises(RuntimeError):
                guardar_registro(Sucursal,self.administrador,self.datos_sucursal(),cliente_id=self.cliente.pk)
        self.assertFalse(Sucursal.objects.filter(nombre='Zona Sur').exists())

    def test_servicio_rechaza_coordenadas_incompletas_y_campos_ajenos(self):
        with self.assertRaises(ValidationError):
            guardar_registro(Sucursal,self.administrador,self.datos_sucursal(latitud=Decimal('10')),cliente_id=self.cliente.pk)
        with self.assertRaises(ValidationError):
            guardar_registro(Cliente,self.administrador,self.datos_cliente(activo=False))

    def test_sesion_roles_y_catalogo_de_permisos_sin_ampliar_roles(self):
        self.client.force_authenticate(self.editor_sucursal)
        sesion=self.client.get('/api/v1/auth/me/').data
        self.assertEqual(sesion['permisos_clientes'],{'ver':True,'crear':False,'editar':False,'cambiar_estado':False})
        self.assertEqual(sesion['permisos_sucursales'],{'ver':True,'crear':False,'editar':True,'cambiar_estado':False})
        self.client.force_authenticate(self.administrador)
        modulos=self.client.get('/api/v1/permisos/').data
        for clave in ('clientes','sucursales'):
            self.assertEqual(len(next(modulo for modulo in modulos if modulo['key']==clave)['permissions']),5 if clave == 'sucursales' else 4)
        rol=Group.objects.create(name='Administrador de clientes')
        call_command('preparar_roles',verbosity=0)
        self.assertEqual(rol.permissions.count(),0)

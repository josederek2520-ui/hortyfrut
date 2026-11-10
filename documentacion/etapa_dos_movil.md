# Etapa 2: enviar despachos al chofer y preparar su acceso móvil

30 de octubre de 2026

## Resultado

La web ofrece **Enviar al chofer** desde la revisión o el detalle del despacho. Después muestra **Pendiente de salida**. El envío tiene un permiso propio, exige la versión vigente, valida la carga preparada y la capacidad, y conserva responsable, fecha y evidencia de las versiones y del peso comprobado.

Enviar no inicia el viaje ni mueve productos o cajillas. El inicio real utiliza la operación existente. El servidor vuelve a comprobar disponibilidad y capacidad antes de salir. La edición de carga y transporte queda bloqueada después del envío; cancelar continúa sujeto a su permiso. Los reintentos válidos de una misma operación no duplican sus efectos.

La API administrativa conserva sus estados y contratos: `borrador`, `en_ruta`, `finalizado` y `cancelado`. `enviado_en` y `enviado_por_nombre` son datos adicionales de solo lectura. Un borrador con `enviado_en` se presenta como «Pendiente de salida»; el filtro «Sin iniciar» incluye borradores y despachos enviados. Los clientes administrativos anteriores conservan la posibilidad de iniciar por su endpoint existente, con permiso de iniciar y las validaciones de capacidad. El acceso móvil solo permite iniciar viajes enviados.

## Acceso por dispositivo

Se implementó autenticación Bearer específica de las rutas móviles, utilizando Django, DRF y la biblioteca estándar; no se instalaron dependencias. Las sesiones de la web y sus controles CSRF se mantienen independientes.

- Cada acceso recibe una credencial aleatoria con 256 bits de secreto y un identificador de sesión. La respuesta de inicio de sesión es el único lugar donde se entrega la credencial completa.
- La base almacena únicamente su resumen SHA-256. La comprobación utiliza comparación en tiempo constante.
- Vence a las 12 horas. Esta versión pide volver a iniciar sesión al vencer; no implementa renovación automática.
- Volver a ingresar desde el mismo identificador de dispositivo revoca su credencial anterior. Otros dispositivos conservan sus sesiones.
- Se puede cerrar la sesión actual o revocar un dispositivo propio. La lista es de diez registros por página y no expone resúmenes ni credenciales.
- Una cuenta inactiva o un cambio de contraseña invalida el acceso. Los permisos vigentes se vuelven a consultar en cada petición.
- Fuera de DEBUG se exige HTTPS. En despliegues con proxy debe configurarse correctamente la terminación TLS y el reconocimiento seguro del protocolo por Django.
- El acceso conserva el límite existente de diez intentos por minuto. Para el despliegue público se debe acompañar con el control de tráfico de la infraestructura.
- Las respuestas móviles usan `Cache-Control: no-store`. La auditoría no almacena contraseñas ni credenciales. Las escrituras de negocio y su evidencia son atómicas.

En la aplicación Android futura la credencial deberá guardarse en el almacenamiento seguro del sistema, por ejemplo mediante Expo SecureStore, y eliminarse al cerrar sesión. Ese trabajo corresponde a la etapa 4; no se creó una aplicación ni un APK en esta etapa.

## Permisos separados

| Capacidad | Permiso |
| --- | --- |
| Enviar desde la web | `despachos.view_despacho` + `despachos.enviar_despacho` |
| Acceder como chofer y consultar viajes propios | `despachos.conducir_despacho` + `despachos.ver_despachos_propios` |
| Registrar operaciones propias | Los dos anteriores + `despachos.operar_despachos_propios` |

El chofer sigue siendo un Usuario. No necesita permisos administrativos de Despachos, Productos, Vehículos o Inventario. Las comprobaciones se realizan también en el servicio de negocio, sin depender únicamente de la vista HTTP.

`preparar_acceso_movil` agrega los permisos nuevos exclusivamente a los roles existentes «Administrador de despachos» y «Chofer de despachos». Conserva sus otros permisos, no asigna usuarios ni modifica roles personalizados, y registra cada cambio en Auditoría. Es idempotente. `preparar_roles` continúa sin modificar roles existentes; los nuevos roles de chofer incluyen los permisos móviles desde su creación.

## Rutas de la API

Todas usan el prefijo `/api/v1/`:

| Método y ruta | Uso |
| --- | --- |
| POST `despachos/{id}/enviar/` | Enviar al chofer con la sesión administrativa web |
| POST `movil/iniciar-sesion/` | Obtener una credencial por dispositivo |
| GET `movil/sesion/` | Consultar usuario, vencimiento y permiso de operar |
| POST `movil/sesion/` | Cerrar la sesión móvil actual |
| GET `movil/dispositivos/` | Listar dispositivos propios, diez por página |
| DELETE `movil/dispositivos/{uuid}/` | Revocar un dispositivo propio |
| GET `movil/mis-despachos/` | Listar únicamente viajes asignados y autorizados, diez por página |
| GET `movil/mis-despachos/{id}/` | Consultar carga, lotes y paradas del viaje propio |
| POST `movil/mis-despachos/{id}/iniciar/` | Registrar salida real |
| POST `movil/mis-despachos/{id}/llegar/` | Registrar llegada a la siguiente parada |
| POST `movil/mis-despachos/{id}/descargar/` | Confirmar la descarga actual por parada |
| POST `movil/mis-despachos/{id}/finalizar/` | Finalizar tras completar todas las descargas |

El inicio móvil recibe `email`, `password`, `identificador_dispositivo` (UUID de la instalación) y `nombre_dispositivo`. Las peticiones siguientes envían `Authorization: Bearer <credencial>`. No se permite usar la credencial móvil para abrir la API administrativa ni sustituirla por una cookie web en las rutas móviles.

Las acciones de viaje reciben `version` y `clave_operacion` (UUID nuevo por operación, conservado en los reintentos). Llegada y descarga también reciben `parada`. El listado permite filtrar por `estado`; el alcance por chofer y autorización se aplica antes del filtro, los conteos y la paginación. Pasar otro identificador no permite acceder a un viaje ajeno. Los viajes anteriores que ya estaban en ruta o finalizados siguen disponibles para su chofer asignado; los borradores anteriores sin envío permanecen privados del administrador.

Los viajes enviados que se cancelen conservan el estado cancelado en el historial del chofer. Ninguna acción móvil permite cambiar vehículo, chofer, carga ni el orden de las paradas.

## Adaptación y datos reales

Se añadieron las migraciones `despachos/0002_acceso_movil_envio.py` y `usuarios/0004_acceso_movil_envio.py`. Incorporan metadatos de envío y la tabla de sesiones móviles, sin generar viajes, ubicaciones, envíos ni movimientos de prueba en la base habitual.

Después de verificar el código:

```powershell
.venv/Scripts/python.exe manage.py migrate
.venv/Scripts/python.exe manage.py preparar_acceso_movil
```

Estos dos pasos ya se aplicaron en el entorno local. Los dos cambios de permisos quedaron auditados. La comprobación posterior conservó los dos viajes existentes (uno en ruta y otro finalizado), los ocho movimientos de cajillas y los cinco movimientos de productos. No se enviaron viajes ni se crearon sesiones móviles reales.

Para las pruebas reales se elegirá o creará una cuenta de Usuario para cada chofer, se le asignará el rol de chofer y se la seleccionará en el despacho. No se crearon cuentas ni contraseñas de demostración en el sistema habitual.

Las coordenadas del almacén y las sucursales siguen pendientes por decisión del usuario. No bloquean estas pruebas de permisos y flujo manual. Se completarán antes de las pruebas de mapas.

## Comprobaciones

Se verifican dos choferes con viajes distintos, acceso directo a identificadores ajenos, borradores privados, permisos separados, flujo manual completo, capacidad, reintentos, envío sin movimientos, concurrencia entre enviar y editar, y accesos simultáneos del mismo dispositivo. También caducidad, baja, cambio de contraseña, rotación, revocación, HTTPS, cabeceras inválidas, límite de intentos, paginación y reversión ante un fallo de auditoría.

Las pruebas usan exclusivamente la base PostgreSQL aislada de la etapa cero. Se ajustó la restauración del esquema en la prueba histórica de migración de correos para que reponga también las migraciones nuevas al finalizar.

Resultado: 470 pruebas de backend y 150 de frontend aprobadas, compilación de producción y TypeScript correctos, ESLint sin errores en Despachos y ninguna migración de modelo pendiente. Los diagnósticos de Next.js no informaron errores de configuración o sesión. No se automatizó el navegador ni se probó un teléfono en esta etapa.

## Qué sigue

La etapa 3 incorporará descarga por pedido dentro de cada parada y contabilización consolidada de cajillas. La descarga disponible ahora conserva su contrato anterior por parada. Después se construye la aplicación Android en la etapa 4 y se añaden mapas en la etapa 5. La interfaz web continúa sin generar GPS ni confirmar operaciones automáticamente.

Referencias técnicas utilizadas: [autenticación personalizada de DRF](https://www.django-rest-framework.org/api-guide/authentication/#custom-authentication) e [invalidación de sesiones por cambio de contraseña en Django](https://docs.djangoproject.com/en/5.2/topics/auth/default/#session-invalidation-on-password-change).

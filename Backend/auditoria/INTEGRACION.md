# Registro de actividad

La auditoría central está en `auditoria.RegistroActividad`. La API y la
administración ofrecen acceso de lectura con el permiso independiente
`auditoria.ver_registroactividad`. No existe una operación HTTP para editar,
crear manualmente ni eliminar eventos. El rol inicial `Auditor del sistema`
solo recibe ese permiso. Las asignaciones existentes no se amplían.

## Cobertura

- Usuarios: creación, edición, roles asignados, activación, desactivación y
  cambios de contraseña. Los valores de campos públicos se comparan antes y
  después. Los datos personales sensibles se sustituyen por una marca.
- Roles: creación, edición de nombre/permisos y eliminación, conservando el
  nombre y el identificador aunque se elimine el objeto.
- Autenticación: inicio/cierre de sesión e intentos rechazados, incluidos
  CSRF, falta de permisos, validaciones y límites de intentos.
- Consultas de la API: listados y detalles, incluido el acceso a la auditoría.
- Administración técnica: operaciones que Django registra con `LogEntry`.
- Procesos automáticos: servicio central invocado explícitamente.

La capa HTTP cubre cualquier módulo futuro bajo `/api/v1/` sin agregar un
modelo a una lista. Detecta operaciones estándar y acciones personalizadas
de los ViewSets de DRF, por ejemplo `exportar` o `confirmar`. Conserva
resultado, referencia de solicitud, patrón de ruta y responsable.

Los sondeos de sesión y CSRF y los metadatos de filtros/resúmenes exitosos
se excluyen para evitar que las solicitudes auxiliares llenen el historial.
Los errores de acciones de negocio se registran por resultado HTTP sin
persistir el cuerpo de la petición ni de la respuesta. La capa HTTP no
inventa cambios de campos de módulos que aún no existen.

## Integrar un módulo nuevo

La acción HTTP queda registrada automáticamente. Para añadir diferencias
de campos, acciones de negocio precisas o procesos fuera de HTTP, usar el
servicio dentro de la misma transacción que modifica el objeto:

```python
from django.db import transaction
from auditoria.servicios import registrar_actividad, diferencias

@transaction.atomic
def actualizar_registro(actor, instancia, datos):
    anterior = {"cantidad": instancia.cantidad}
    instancia.cantidad = datos["cantidad"]
    instancia.save(update_fields=["cantidad"])
    registrar_actividad(
        "inventario", "ajustar_existencia", actor=actor, objeto=instancia,
        objeto_nombre=f"Lote #{instancia.pk}",
        cambios=diferencias(anterior, {"cantidad": instancia.cantidad}),
    )
    return instancia
```

El ejemplo es una guía para un módulo futuro; no crea endpoints ni tablas
de inventario. Seleccionar expresamente campos de negocio. No pasar
`request.data`, cuerpos completos, representaciones de objetos sensibles
ni credenciales. La limpieza es recursiva y excluye claves de secretos;
el llamador debe proporcionar descripciones y nombres seguros.

El contexto de solicitud usa `ContextVar` y se restaura al terminar cada
petición. El servicio marca el evento para evitar que el middleware
duplique la misma operación exitosa. Una reversión de la transacción
también revierte sus eventos de éxito; el rechazo HTTP se registra aparte.
Si falla la escritura de auditoría de una operación instrumentada, también
se revierte la operación. Los fallos de auditoría de lectura se envían al
logger `auditoria.middleware` con la referencia de solicitud.

En un comando o tarea automática puede invocarse el servicio sin solicitud;
se identifica como origen `sistema` y se puede indicar un actor explícito.
Cambios por SQL directo o código que no use el servicio fuera de HTTP
requieren instrumentación específica: no quedan cubiertos por middleware.

Al implementar permisos nuevos, agregarlos al catálogo de `roles/catalogo.py`
y añadir las etiquetas a `actividad.modulos`, `actividad.acciones` y
`roles.permissionLabels` en los idiomas habilitados. Las opciones de filtro
de actividad se obtienen de los eventos reales, incluidos los módulos nuevos.

## Consulta y conservación

La pantalla `/actividad` muestra y cuenta las operaciones principales de los
módulos: altas, cambios, estados, confirmaciones y acciones explícitas como
descargar un respaldo. `consultas.actividad_modulos` aplica una lista de pares
módulo/acción antes de filtrar, contar o paginar. Listado, resumen y opciones
comparten este alcance; consultar el historial no aumenta esos contadores.

Las lecturas, búsquedas, selectores (también por POST), sesiones, Chat, GPS,
canales y pasos automáticos se conservan como evidencia interna. Confirmar una
recepción cuenta una operación; los lotes y movimientos que genera siguen
auditados sin contarse aparte. El mismo criterio se aplica a la preparación de
pedidos, cajillas del despacho y retornos físicos. Crear una cajilla incluye
su saldo inicial en una sola operación; ingresos y devoluciones posteriores
son operaciones independientes. Solicitar un respaldo o una optimización
cuenta la solicitud explícita; el progreso y resultado automático se conservan
internamente y en el módulo correspondiente.

Los éxitos visibles requieren evidencia central con tipo de objeto y sin
código HTTP de respaldo. Los eventos HTTP exitosos pueden ser reintentos o
guardados sin cambios y no vuelven a contar; también se omiten las ediciones
centrales sin diferencias (`cambios={}`), excepto el historial importado y la
administración técnica, que no siempre conservaron ese detalle. Los rechazos
y errores de escrituras de negocio sí aparecen, incluyendo los nombres de
sus acciones HTTP; las consultas fallidas quedan en la evidencia técnica.
No se agrupan eventos por usuario, objeto o fecha, por lo que dos cambios
reales sobre el mismo objeto mantienen sus dos actividades.

Este filtro se aplica también a los datos anteriores, sin borrar ni modificar
registros de auditoría. El detalle por ID y el administrador técnico conservan
el acceso de solo lectura a la evidencia completa con el permiso existente.
Al incorporar operaciones nuevas, añadir sus acciones principales a
`ACCIONES_MODULOS` y, si difieren, sus nombres HTTP a
`ACCIONES_HTTP_ADICIONALES`. Las acciones derivadas deben quedar fuera del
listado operativo aunque sigan usando obligatoriamente el servicio central.

`GET /api/v1/actividad/` admite `buscar`, `modulo`, `accion`, `resultado`,
`responsable`, `actor`, `desde`, `hasta` y `page`, con páginas fijas de 10 registros.
El listado devuelve `corte` y `resumen` dentro del mismo límite;
reenviar `corte` al paginar mantiene estable la consulta frente a eventos
nuevos. Actualizar o cambiar filtros inicia un corte nuevo. Las fechas son
inclusivas en America/La_Paz. El detalle está en
`/actividad/{id}/`; `/actividad/resumen/` cuenta por resultado dentro del
resto de filtros y `/actividad/opciones/` entrega módulos y acciones de las
operaciones visibles. Las pestañas de resultado conservan sus contadores
dentro del resto de filtros y del mismo corte.

La migración `0002_importar_historial` incorpora una sola vez los eventos
previos de Usuarios y Roles con su fecha original. No recupera eventos que
nunca se guardaron ni inventa valores anteriores. Las tablas originales se
conservan para los detalles existentes. Los registros nuevos centrales
conservan el nombre del responsable aunque se elimine su cuenta.

No se ha programado una purga ni un mecanismo criptográfico antimanipulación.
Las credenciales de base de datos de producción deben limitarse conforme a
la política de conservación de la organización; el permiso de la interfaz
no reemplaza los controles de administración de PostgreSQL.

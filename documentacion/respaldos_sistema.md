# Respaldos manuales de HortyFru

Implementado el 8 de noviembre de 2026. Administración → Respaldos (`/respaldos`)
permite solicitar una copia en segundo plano, consultar su historial de diez
registros por página y descargarla. Las copias usan ZIP común, sin contraseña.

El nombre usa día-mes-año de Bolivia y un consecutivo diario persistido:
`hortyfru_08-11-2026_001.zip`, `hortyfru_08-11-2026_002.zip`. Cada día comienza en
001 y los fallidos también consumen su número. A partir de mil se conservan
todas las cifras. El número se asigna en transacción, también ante solicitudes
simultáneas, sin depender del idioma o de la zona horaria del navegador.

La pantalla conserva cabecera e historial, sin tarjetas explicativas inferiores.
Las copias anteriores reciben su consecutivo según su fecha y orden de creación:
se muestran y descargan con el nombre nuevo, conservando su archivo privado,
contenido, UUID, auditoría histórica y comprobación de integridad.

## Contenido y conservación

- `base_de_datos.dump`: exportación completa de la base de la aplicación mediante
  `pg_dump`, en formato personalizado que se recupera con `pg_restore`. Incluye
  los registros de todos los módulos, usuarios, roles de la aplicación, Chat y GPS.
- `fotos/`: archivos referenciados por campos FileField/ImageField, con su ruta
  relativa de almacenamiento. Actualmente son fotos de productos y vehículos.
- `comprobantes/`: comprobantes privados referenciados por Entregas.
- `informacion.json`: fecha ISO con desplazamiento de Bolivia, versión del
  formato, versión de PostgreSQL, migraciones, tamaños y SHA-256 por archivo.

No se incluyen archivos huérfanos, `.env`, secretos de infraestructura, código,
binarios ni otras copias. La configuración privada y el código necesitan una
conservación aparte. Un respaldo de esta base no exporta usuarios técnicos de
PostgreSQL ni tablespaces globales: al reconstruir otro servidor, preparar la
cuenta de conexión y su configuración por separado. Los roles comerciales de
HortyFru sí son registros de esta base.

La carpeta privada predeterminada es `.local/respaldos/<uuid>/`, ignorada por Git.
Puede configurarse `RESPALDOS_DIRECTORIO` fuera del proyecto. No puede ser una
carpeta pública ni contener fotos/comprobantes. No se publica por Cloudflare.
Después de descargar, conservar otra copia en un dispositivo independiente.
La aplicación no elimina automáticamente copias anteriores ni ofrece restaurar.

## Captura y comprobación

La solicitud se confirma en PostgreSQL y un proceso Python independiente del
servidor HTTP la ejecuta, sin ventanas ni paquetes nuevos. Utiliza el mismo
entorno y configuración de Django. En Windows encuentra las herramientas de la
versión de PostgreSQL instalada; `RESPALDOS_PG_BIN` permite indicar otra carpeta.
Este trabajo no necesita Celery ni un contenedor con acceso a los adjuntos.

Solo se admite una solicitud activa. El UUID de solicitud es idempotente y los
reintentos del navegador mantienen su cuerpo en memoria. Se revalidan la cuenta
activa y los permisos al solicitar, antes de capturar y antes de publicar el ZIP.
El proceso usa además un candado PostgreSQL para impedir ejecuciones simultáneas.

Durante la captura se toman bloqueos SHARE de las tablas visibles con NOWAIT,
se exporta una instantánea PostgreSQL compartida con `pg_dump` y se copian sus
adjuntos referenciados. Las escrituras nuevas pueden esperar brevemente; si ya
hay una escritura activa, el trabajo falla con un mensaje de reintento, sin
cancelarla. Tras copiar y exportar se liberan los bloqueos antes de comprimir.
No se modifican existencias, pedidos, viajes ni otros registros de negocio.

Se comprueba el archivo de PostgreSQL con `pg_restore --list`, el CRC del ZIP y
los SHA-256. La descarga verifica tamaño y SHA-256 antes de entregar el mismo
archivo abierto mediante sesión. Esto comprueba integridad; no equivale a una
restauración probada de cada copia en otra base. La prueba técnica del módulo sí
restaura un respaldo real en una base temporal independiente y comprueba datos.

Los errores no publican salidas de comandos, contraseñas ni rutas internas.
Los archivos incompletos se retiran. Las solicitudes interrumpidas vencen tras
`RESPALDOS_TIEMPO_MAXIMO_S` (900 por defecto); una nueva solicitud registra el
fallo de la anterior antes de reintentarlo. Conservar la computadora encendida.

## Permisos y auditoría

Permisos independientes: `view_respaldo`, `add_respaldo` y `descargar_respaldo`.
Crear y descargar exigen también consultar. No se otorgan a roles ni cuentas
existentes. Los superusuarios activos conservan su acceso habitual. Estas
copias contienen toda la información privada de la aplicación.

La API solo existe en el URLconf administrativo habitual. El URLconf público y
la pasarela no incluyen el módulo, incluso para superusuarios. Las sesiones
públicas presentan estos permisos desactivados. Consultas y rechazos mantienen
auditoría HTTP; solicitudes, finalizaciones, fallos y descargas usan el servicio
central. La auditoría no guarda contenido de Chat, adjuntos ni contraseñas.

## Recuperación manual

Antes de recuperar una copia, verificar el manifiesto y sus sumas, disponer de
la versión compatible del código y PostgreSQL y ensayar en una base nueva.
Preparar por separado la cuenta técnica de PostgreSQL y la configuración.
Recuperar `base_de_datos.dump` con `pg_restore --exit-on-error` en la base nueva;
restablecer `fotos/` bajo `MEDIA_ROOT` y `comprobantes/` en el almacenamiento
privado de Entregas, conservando las rutas relativas. Confirmar permisos y datos
antes de cambiar el sistema habitual a esa base. La recuperación operativa
requiere detener escrituras y respaldar antes el estado actual.

Un historial restaurado puede referenciar ZIP que no estén presentes; no se
simulan copias ni se vuelven a exportar automáticamente. Las solicitudes que
estaban preparando caducan y pueden sustituirse mediante una solicitud nueva.

## Comprobaciones

```bash
cd Backend
./.venv/Scripts/python.exe manage.py test respaldos --settings=config.pruebas_aisladas --keepdb --noinput
```

Las pruebas utilizan la base aislada y directorios temporales. Cubren permisos,
sesión/CSRF, URLconf público, paginación, UUID y reintentos, exclusión de solicitudes
simultáneas, autorización revocada, procesos interrumpidos, integridad, nombres
en horario boliviano, archivos faltantes y conservación de escrituras activas.
La exportación y recuperación usan herramientas PostgreSQL reales.

Validación del 8 de noviembre: 39 pruebas de Respaldos/Roles, 281 web y siete de
pasarela correctas; TypeScript, ESLint y compilación de producción correctos.
La migración local se aplicó tras una copia de PostgreSQL y se conservaron los
conteos de los 50 modelos operativos comprobados. No se asignaron permisos nuevos
a usuarios o roles existentes. La revisión visual de la pantalla es manual.

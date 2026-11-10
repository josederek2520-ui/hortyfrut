# HTTPS del chofer y Chat con Cloudflare

Prueba local preparada el 4 de noviembre de 2026. El administrador sigue en
`http://localhost:3000`. El chofer entra por una dirección temporal
`https://...trycloudflare.com/mis-viajes`, desde datos móviles u otra red.
Chat está disponible para todos los Usuarios activos en
`https://...trycloudflare.com/chat`. La raíz del enlace lleva a Chat.

Desde la raíz, en Git Bash o PowerShell:

```bash
node infraestructura/chofer_https/iniciar_tunel.mjs
```

El comando muestra el progreso y la dirección. Si el acceso ya está listo,
devuelve la dirección existente. Los procesos quedan en segundo plano, sin abrir
ventanas ni controlar el escritorio. La computadora, PostgreSQL y la conexión a
Internet deben seguir disponibles. OSRM y Celery/Redis se conservan como en etapa 6.
El arranque comprueba o inicia el proceso local de canales de etapa 9 para Chat;
Redis debe estar disponible. No instala dependencias.

Para detener únicamente este acceso:

```bash
node infraestructura/chofer_https/detener_tunel.mjs
```

No detiene Django/Next.js de la administración. Para recoger cambios de código,
detener y volver a iniciar el acceso; se genera otra dirección temporal.
El enlace actual se conserva en `.local/chofer_https/enlace.txt`.

## Cómo probar

1. Abrir el enlace HTTPS en el teléfono y entrar con el Usuario del chofer al que
   se envió el viaje. Se usan las mismas credenciales de HortyFru.
2. Abrir el viaje, contraer la tarjeta, cambiar el tema y comprobar el mapa.
3. Revisar el recorrido desde **Ver viaje → Recorrido**. La optimización conserva
   sus reglas y servicios existentes.
4. En un viaje iniciado, abrir **Ubicación → Compartir mi ubicación** y aceptar el
   permiso del navegador. Comprobar el camión, su precisión y el centrado.
5. Dejar de compartir y cambiar de pestaña: la captura local debe detenerse; volver
   no la reactiva. El reparto completo se prueba con datos destinados a pruebas,
   porque iniciar/descargar/finalizar registran operaciones reales.

La ubicación del teléfono sigue pendiente de la validación física del usuario.
La app Android permanece conservada. La etapa 9 administrativa se consulta
localmente. La [guía de Chat](../../documentacion/chat_web.md) explica cómo probar
mensajes y audio entre dos cuentas independientes.

## Separación del acceso

```text
Teléfono → HTTPS Cloudflare → 127.0.0.1:8787 (pasarela)
                                  ├─ páginas → localhost:3001 (Next producción, loopback)
                                  ├─ API     → 127.0.0.1:8001 (Django público)
                                  └─ /ws/chat/ → 127.0.0.1:8002 (Daphne)

Administrador → localhost:3000 → Django habitual :8000
```

- La pasarela tiene una lista explícita de páginas, recursos y métodos. Permite
  Chat, su audio, Mis viajes, acceso y cuenta propia; bloquea usuarios, roles, despachos/pedidos
  administrativos, `/admin`, API móviles Bearer, endpoints de desarrollo y descarga
  completa por parada. Las rutas administrativas tampoco existen en el URLconf
  dedicado de Django. Solo el selector de Chat permite consultar nombres de otros
  Usuarios activos; no publica la administración de Usuarios.
- El inicio de sesión público admite cualquier Usuario activo para Chat. Mis
  viajes conserva sus permisos de chofer. La respuesta mantiene el contrato de
  sesión y oculta controles administrativos, incluso cuando el Usuario tiene otros
  permisos para usar localmente. Los permisos reales no cambian.
- El proceso dedicado usa `DEBUG=False`, host/origen exactos, CSRF y cookies
  Secure/HttpOnly/SameSite=Lax. La pasarela sobrescribe encabezados de proxy.
  Django recibe el origen público HTTPS; Next usa HTTP loopback para sus
  reescrituras internas. Los dos tramos permanecen en la misma computadora.
- Comparte PostgreSQL y los servicios existentes. No copia usuarios, no modifica
  inventario/cajillas por arrancar y no ejecuta migraciones. No modifica `.env` ni
  instala dependencias de npm/Python.
- Next se compila por separado en `Frontend/.next-chofer`, en modo producción para
  el acceso externo. La compilación normal y el servidor de desarrollo local se
  conservan. TypeScript incluye los tipos generados de ambas compilaciones.
- `cloudflared` portátil 2026.10.7 se descarga del lanzamiento oficial en GitHub y
  se verifica contra SHA-256
  `2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343`
  antes de ejecutarse. Binario, estado, control local y registros están en `.local/`,
  excluido de Git. El control de apagado requiere una clave local y no se publica.

Quick Tunnels está pensado para pruebas: no requiere cuenta ni dominio, la URL
termina al detener el proceso y no ofrece una dirección permanente ni SLA de
producción. No usar esta dirección temporal como despliegue definitivo.
La pasarela permite únicamente el WebSocket `/ws/chat/`, con origen HTTPS exacto
y acceso efímero ligado a sesión/origen en el primer mensaje. No publica
`/ws/seguimiento/`: la [etapa 9](../../documentacion/etapa_nueve_web.md) mantiene su
canal GPS local para el administrador. El chofer envía GPS mediante su API HTTPS
existente. Detener el túnel no detiene la supervisión local.

## Comprobaciones

Corrección de navegación del 4 de noviembre: se conserva la cabecera `next-url`
junto con el contexto RSC de Next. Sin ella la pasarela cambiaba la huella `_rsc`
y las navegaciones a Chat y al viaje recibían redirecciones adicionales. La
comprobación con Next de producción y una cuenta ficticia valida `/mis-viajes`,
`/chat` y `/mis-viajes/5` mediante HTML y navegación RSC, sin PostgreSQL ni cambios
de negocio. Se ejecuta desde la raíz con
`node herramientas/comprobar_navegacion_https.mjs` después de tener la compilación
pública. La comprobación también cubre `/entregas` y `/entregas/5/7` con permisos
ficticios de recepción propia. Las siete pruebas de pasarela incluyen navegación y precarga, mantienen
el contexto intacto y siguen bloqueando administración.

```bash
node --test infraestructura/chofer_https/pruebas_pasarela.mjs
cd Backend
.venv/Scripts/python.exe manage.py test usuarios.test_chofer_https --settings=config.pruebas_aisladas --keepdb --noinput
```

Se verifican alcance de rutas/métodos, codificaciones, cookies y CSRF, encabezados,
sesión limitada, compatibilidad administrativa y viajes propios. Los errores
internos del servicio se presentan de forma genérica por la pasarela.

Validación del 4 de noviembre, incluido Chat: 601 pruebas de backend, 201 web y 4 de pasarela
correctas; TypeScript, ESLint del cambio y compilación de producción correctos.
La comprobación HTTP externa validó el certificado HTTPS, formulario y sus 19
recursos, cookies CSRF seguras, rechazo de POST sin CSRF y seis rutas ajenas
bloqueadas. La administración local siguió respondiendo. No se inició un viaje ni
se confirmó una descarga ni se enviaron mensajes a cuentas reales durante estas
comprobaciones. La prueba aislada de Chat también verificó la entrega mediante
PostgreSQL, Redis, Daphne, pasarela y un cliente WebSocket real.

Referencias oficiales:

- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
- [Lanzamiento del binario utilizado](https://github.com/cloudflare/cloudflared/releases/tag/2026.10.7).
- [Encabezados de proxy en Django](https://docs.djangoproject.com/en/5.2/ref/settings/#secure-proxy-ssl-header).
# Recepción de sucursales

El mismo origen temporal permite `/entregas` para el encargado de recepción.
Publica exclusivamente consultas y registro de sus sucursales asignadas, incluso
si la cuenta posee permisos globales. Enviar a revisión se admite por HTTPS;
confirmar y devolver a borrador permanecen en la administración local. Se
conservan sesión/CSRF, origen exacto y lista de rutas/métodos. Solo el endpoint de
comprobante admite multipart, hasta 8 MB de archivo; el resto mantiene JSON y sus
límites de cuerpo. No se amplían Pedidos, Clientes ni los demás módulos públicos.

Validación del 5 de noviembre de 2026: acceso recompilado y reiniciado con
Entregas. Las cinco páginas comprobadas responden mediante HTML y RSC con una
cuenta ficticia, sin redirecciones de navegación. El enlace HTTPS real exige
sesión para Entregas, Chat y Mis viajes, conserva la cookie CSRF segura y bloquea
administración, confirmación/devolución de Entregas y supervisión GPS. Las siete
pruebas de pasarela pasan. La administración local continúa disponible.


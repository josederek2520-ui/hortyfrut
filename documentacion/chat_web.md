# Chat de HortyFru

Implementado el 4 de noviembre de 2026. **Chat** aparece en el menú lateral y en
la barra superior para todos los Usuarios activos. Son conversaciones privadas
entre dos usuarios, con texto, historial guardado, contadores de mensajes sin leer
y confirmación de lectura. El diseño muestra conversaciones a la izquierda y
mensajes a la derecha; en celular alterna ambas vistas y conserva la navegación
del sistema. No muestra estados «en línea» supuestos ni botones de llamadas o
adjuntos sin implementar.

## Probar entre dos cuentas

1. Mantener PostgreSQL, Redis y los servidores disponibles. Para el acceso externo:

   ```bash
   node infraestructura/chofer_https/iniciar_tunel.mjs
   ```

2. Abrir `http://localhost:3000/chat` en la computadora. En otro dispositivo o
   navegador independiente, abrir el enlace HTTPS mostrado, terminado en `/chat`.
   El enlace vigente también está en `.local/chofer_https/enlace.txt`.
3. Entrar con **dos Usuarios activos distintos**. Dos pestañas del mismo navegador
   comparten la sesión; para dos cuentas usar dispositivos, perfiles o una ventana
   privada independientes.
4. En la cuenta receptora, entrar a Chat y pulsar **Activar sonido**. Se escucha
   una muestra. Revisar que el teléfono no esté silenciado y dejar la web abierta.
5. En la otra cuenta, pulsar **Nuevo**, buscar al usuario, abrir la conversación y
   enviar un texto. Debe aparecer sin recargar, aumentar el contador y sonar en el
   receptor. Al abrir los mensajes recibidos se marca su lectura.
6. Comprobar la respuesta en sentido inverso, **Silenciar**, volver a activar,
   historial, búsqueda y las vistas de celular. Reabrir una conversación o
   recargar no debe reproducir avisos de mensajes antiguos.
7. Desconectar brevemente la red. Se informa la pérdida del canal y se intenta
   reconectar. Si un envío queda incierto, **Comprobar envío** reutiliza su misma
   clave y texto; no debe crear un duplicado.
8. Cerrar sesión o cambiar de cuenta. El canal y los envíos pendientes de la cuenta
   anterior deben retirarse. No se pueden consultar conversaciones ajenas,
   incluso usando una cuenta administradora.

Los mensajes de esta prueba sí se guardan en la base habitual. El chat no inicia
viajes ni descarga productos o cajillas.

## Audio y alcance del aviso

Se incorporó sin modificar el archivo proporcionado:

- Origen: `C:\Users\Usuario\Downloads\universfield-new-notification-07-210334.mp3`.
- Recurso: `Frontend/public/sonidos/notificacion-chat.mp3` (56 842 bytes).
- SHA-256: `748e6d03a559ac909d04b9fa907fca3424c6bf00aa45bcad3f6a07238e58f6cb`.

El aviso corresponde a mensajes nuevos recibidos, también al estar en otras
secciones de la web. No suena por el mensaje propio, la lectura, el historial o
avisos repetidos. Las ráfagas pueden agruparse en un aviso. Se coordina entre
pestañas mediante Web Locks cuando está disponible. Solo se guardan en el
navegador la preferencia y el identificador del último aviso; los textos y los
envíos pendientes no se guardan en localStorage.

Los navegadores pueden bloquear reproducción automática: **Activar sonido**
proporciona la interacción necesaria y el rechazo no interrumpe los mensajes.
Una pestaña cerrada, el navegador suspendido o el bloqueo del teléfono no
garantizan avisos. No se implementaron Web Push, funcionamiento sin conexión,
audio grabado, adjuntos ni grupos. La reproducción física y el diseño en el
teléfono requieren la prueba del usuario; no se automatizó su navegador.

## Persistencia, autorización y canal

- `Backend/chat` guarda la pareja única de participantes, mensajes y revisión del
  buzón en PostgreSQL. La migración `chat.0001_initial` se aplicó tras un respaldo
  completo en `.local/respaldos_chat/`; las cantidades de registros operativos se
  conservaron. No se enviaron mensajes a usuarios reales durante las pruebas.
- Los listados se filtran por participante antes de paginar de **10**. El selector
  ofrece otros Usuarios activos; no crea un módulo de Empleados ni altera roles.
- Las acciones usan sesión Django y CSRF. La cabecera `X-Usuario-Chat` del cliente
  debe coincidir con la sesión actual. Una cuenta inactiva no abre ni envía.
- Enviar exige UUID y texto de hasta 2000 caracteres. Repetir exactamente un envío
  devuelve el mismo registro; reutilizar la clave con otro cuerpo devuelve 409.
  Hay un límite de 30 mensajes nuevos por minuto y autor. La lectura confirma solo
  los mensajes recibidos mostrados, hasta 10 por solicitud.
- La auditoría HTTP existente y el servicio central registran cambios y conexión
  del canal. No se incluye texto privado ni credenciales en la auditoría.
- Channels/Daphne y Redis reutilizan la infraestructura de etapa 9. Después del
  commit se publica un aviso por usuario, sin texto privado. Cada conexión consulta
  un resumen autorizado y recibe revisiones y contadores; los textos se leen por
  la API. No hay consultas HTTP periódicas para buscar mensajes.
- `POST /api/v1/chat/acceso/` entrega una credencial efímera, de 30 segundos y un
  solo uso, vinculada a la sesión, usuario y origen exacto. Viaja en el primer
  mensaje de `/ws/chat/`, nunca en la URL. No hay datos antes de autorizar.
  El canal revalida sesión, vigencia y cuenta cada 15 segundos y en los avisos.
- La interfaz mantiene los intentos inciertos solo en memoria, por usuario y
  conversación. No inventa una confirmación ante un corte; descarta respuestas
  tardías de una cuenta anterior y conserva la misma clave al comprobar el envío.

## HTTPS y servicios

La [pasarela de pruebas](../infraestructura/chofer_https/README.md) ahora permite
Chat para cualquier Usuario activo, además de Mis viajes para quien tenga sus
permisos. La sesión pública mantiene ocultos los controles administrativos sin
cambiar los roles reales. El administrador conserva su sistema local.

```text
Local:    localhost:3000/chat → Django :8000 → PostgreSQL / Redis
Público:  HTTPS Cloudflare → pasarela :8787 → Next :3001 / Django :8001
Canal:    /ws/chat/ → pasarela o Next → Daphne loopback :8002 → Redis
GPS:      /ws/seguimiento/ → solo administración local
```

El arranque del túnel comprueba/inicia el servidor de canales existente. El
supervisor mantiene al proceso Python como hijo y verifica su control privado;
no instala dependencias. Detener el túnel no detiene la supervisión local. Para
recoger cambios del canal se detiene y se vuelve a iniciar su proceso propio:

```bash
node infraestructura/supervision/detener_supervision.mjs
node infraestructura/supervision/iniciar_supervision.mjs
```

## Comprobaciones reproducibles

Con Redis disponible y las dependencias existentes:

```bash
cd Backend
.venv/Scripts/python.exe manage.py test --settings=config.pruebas_aisladas --keepdb --noinput
cd ..
Backend/.venv/Scripts/python.exe herramientas/comprobar_chat_red.py
node --test infraestructura/chofer_https/pruebas_pasarela.mjs
cd Frontend
node --test pruebas/*.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Las pruebas de Django y de red usan la base aislada. La de red levanta sus propios
procesos temporales y un prefijo Redis exclusivo; comprueba PostgreSQL → Redis →
Daphne → pasarela → WebSocket sin mensajes a cuentas reales. La interfaz prueba
sonido, bloqueo de autoplay, deduplicación, cambio de cuenta, envíos inciertos,
reconexión, traducciones y escape de texto.

Resultado técnico: 601 pruebas de backend, 201 de frontend, 4 de pasarela y la
prueba distribuida de Chat correctas. TypeScript, ESLint del cambio y la
compilación de producción pasaron. La revisión externa comprobó el formulario y
20 recursos, CSRF seguro, siete rutas administrativas bloqueadas, redirección de
Chat a inicio de sesión y el MP3 idéntico al original por HTTPS. El WebSocket
público de Chat negoció la conexión y rechazó una credencial inválida sin enviar
datos; el WebSocket GPS administrativo no pudo abrirse públicamente. Next no
informó errores de compilación ni de sesiones activas en la consulta final.

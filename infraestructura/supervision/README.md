# Supervisión local de los viajes

El administrador utiliza `http://localhost:3000/seguimiento-camiones`; el canal viaja por
Next a Daphne en `127.0.0.1:8002`. El chofer continúa entrando por su enlace HTTPS
de Cloudflare, desde otra red. El WebSocket administrativo no necesita publicarse.

Preparación, desde la raíz, con PostgreSQL y el Redis existente encendidos:

```powershell
Backend/.venv/Scripts/python.exe -m pip install -r Backend/requirements-supervision.txt
node infraestructura/supervision/iniciar_supervision.mjs
```

El primer comando instala las dependencias de esta función; ya se ejecutó en
este entorno. El segundo inicia o comprueba el proceso, sin ventanas. No hay
migraciones nuevas ni cambios necesarios en `.env` para los puertos actuales.
Además deben estar en marcha Django local en 8000, Next local en 3000 y el
[túnel del chofer](../chofer_https/README.md).
`npm run dev` en Frontend inicia también este servicio mediante `predev`.

Para detener únicamente el servidor de supervisión:

```powershell
node infraestructura/supervision/detener_supervision.mjs
```

Su estado, clave de control y registros están en `.local/supervision/`, ignorado
por Git. El apagado comprueba el proceso mediante una respuesta autenticada
local antes de detenerlo. No detiene el túnel, Redis, Django administrativo ni
Next. Reiniciar este proceso recoge cambios Python del canal.

Valores opcionales del backend: `SUPERVISION_HABILITADA`,
`SUPERVISION_REDIS_URL` (Redis DB 1), `SUPERVISION_ACCESOS_REDIS_URL` (DB 2) y
`SUPERVISION_ORIGENES` (por defecto los dos orígenes locales de Next en 3000).
Celery mantiene DB 0. Cambiar el puerto/origen administrativo requiere actualizar
la configuración del canal y su origen permitido.

La prueba física y los comandos de verificación están en
[etapa 9](../../documentacion/etapa_nueve_web.md).

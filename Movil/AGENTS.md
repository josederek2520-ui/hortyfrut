# Aplicacion movil HortyFru

- Aplicar las convenciones del AGENTS.md de la raiz. Mantener nombres propios en espanol sin tildes; los contratos de Expo Router y la API se conservan.
- `src/app` contiene exclusivamente rutas y layouts de Expo Router. Pantallas, hooks y componentes viven fuera.
- Dominio y aplicacion no importan React Native, Expo ni implementaciones HTTP. Las dependencias se conectan en `src/composicion`.
- Django decide autorizacion, versiones y movimientos. La app consulta la API movil, mantiene CANT/UNI separadas y nunca recalcula existencias.
- Una operacion con resultado desconocido conserva el UUID y el cuerpo para reintentar. Un conflicto exige actualizar los datos y revisar nuevamente.
- Listados de diez; comprobar todas las filas del pedido entre paginas antes de confirmar. Abortar consultas anteriores y ocultar respuestas de otras rutas.
- Guardar credenciales unicamente mediante almacenamiento seguro nativo. No registrar claves ni credenciales. Los cambios de cuenta limpian el estado anterior.
- Respetar zonas seguras, teclado, tamano de fuente del sistema, contraste, oscuro y movimiento reducido. Controles de al menos 48 puntos.
- El tema claro/oscuro se elige y guarda dentro de la aplicacion; no seguir automaticamente el sistema. El chofer prepara, ordena, calcula y confirma el recorrido recibido; al iniciar se fija. MapLibre distingue la propuesta de la ruta confirmada, sin trafico ni GPS supuesto. Conservar planes historicos fijados, atribuciones y alternativa manual. Coordinar los cambios de ruta con las operaciones del viaje: un resultado incierto conserva UUID/cuerpo y bloquea otra escritura del mismo viaje. Usar textos breves.
- No instalar paquetes sin la autorizacion solicitada al usuario. No automatizar dispositivos ni navegador.
- La etapa 7 obtiene GPS solo con consentimiento y en primer plano mediante Expo Location. Detener la captura local antes de esperar cierres HTTP, al cerrar sesion, cambiar cuenta, intentar finalizar o salir de primer plano. Respuestas/suscripciones tardias no la reactivan. Mantener UUID y cuerpo inciertos en memoria, cola acotada, precision y hora visibles y camion solo en coordenadas medidas. La persistencia offline y el fondo se implementan en etapa 8; no prometerlos con el APK de etapa 7.

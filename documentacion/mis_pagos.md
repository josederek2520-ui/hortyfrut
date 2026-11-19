# Mis pagos del supermercado y verificación de HortyFru

El supermercado informa una transferencia o un depósito ya realizado; la página
no ejecuta pagos bancarios. HortyFru comprueba el ingreso en su banco antes de
registrar el cobro. El portal propio y la verificación local son accesos separados.

## Flujo

1. El supermercado abre **Comercial → Mis pagos**. Consulta únicamente sus ventas
   emitidas, lo cobrado, el saldo real y los importes informados por verificar.
2. En **Informar pago** indica fecha, importe, Transferencia o Depósito y adjunta
   comprobante JPG/PNG/WebP/PDF validado de hasta 8 MB. Elige una o varias ventas
   propias y escribe exactamente cuánto aplica a cada una. Admite pagos parciales.
3. Revisa y envía. El aviso queda **Por verificar**: no crea un cobro, no reduce
   deuda ni reserva saldo. El comprobante, importes y responsable quedan inmutables.
4. La oficina abre **Comercial → Pagos por verificar**, descarga el comprobante y
   contrasta el ingreso bancario. **Confirmar ingreso** abre una revisión actual de
   los saldos; confirmar registra el cobro y sus aplicaciones en una transacción.
5. Si no corresponde, la oficina elige **Observar pago** e indica un motivo.
   No cambia la deuda. El supermercado conserva el historial y puede informar
   nuevamente los datos corregidos mediante un aviso nuevo.

Ejemplo: una venta de 109,50 Bs conserva ese saldo al informar 100 Bs. Mientras
espera muestra 100 Bs por verificar. Al confirmarse queda cobrada en 100 Bs y con
9,50 Bs pendientes. Un segundo pago confirmado de 9,50 Bs la deja Pagada.

Efectivo y Otro siguen en el registro manual de **Cobros** de HortyFru. El portal
no ofrece Cheque, anticipos, anulaciones, edición de avisos ni marcado manual de
ventas pagadas. No modifica ventas/PDF, inventario, entregas ni operaciones físicas.

## Configuración explícita de accesos

- Rol preparado **Responsable de pagos de supermercado**: permisos
  `pagos.consultar_pagos_propios` e `informar_pagos_propios`.
- Asignar ese rol a la cuenta elegida y seleccionarla en **Clientes → Editar →
  Responsable de pagos** (`Cliente.encargado_pagos`). Puede ser la misma cuenta
  de precios, con ambos roles limitados, sin conceder permisos comerciales globales.
  El selector admite Usuarios activos no superusuarios con ambos permisos propios.
  La asignación se guarda con los permisos, versión y auditoría de Clientes.
- Rol preparado **Verificador de pagos**: `pagos.view_avisopago`,
  `confirmar_avisopago`, `observar_avisopago` y los permisos existentes
  `cobros.view_cobro`/`add_cobro`. Confirmar necesita estos dos últimos para usar el
  servicio canónico de Cobros. Consultar y observar se pueden conceder por separado.
- No se asignan roles ni responsables automáticamente. La sesión incorpora
  `permisos_mis_pagos`, `cliente_pagos` y `permisos_pagos`; una cuenta con un único
  supermercado asignado lo tiene seleccionado al informar.
- Una cuenta propia no puede entrar a Ventas, Cobros o verificación global aunque
  reciba permisos globales por error. Tampoco puede verificar un aviso informado
  por ella si posteriormente cambia de función. Otra persona debe revisarlo.
- Un cliente inactivo con deuda conserva la posibilidad de informar su pago.

## Contrato e integridad

API propia `/api/v1/mis-pagos/`: GET listado/detalle/clientes/ventas/aplicaciones/
comprobante; POST `revisar/` y raíz para informar. Las ventas pagadas se incluyen
con `historial=1`. Alcance propio antes de filtros, agregados y paginación fija de
10. API de oficina `/api/v1/pagos-por-verificar/`: GET listado/detalle/aplicaciones/
comprobante y POST `{id}/revisar/`, `confirmar/`, `observar/`. No hay actualización
ni eliminación. Sesión Django/CSRF, respuestas privadas sin caché.

`AvisoPago`, `AplicacionAvisoPago`, `ComprobanteAvisoPago` y `OperacionPago`
conservan evidencia. Archivo privado en PostgreSQL con hash/tamaño/tipo/nombre;
descarga verifica integridad y autorización fresca. No publica Media ni bytes en
auditoría/Redis. El dump de PostgreSQL incluye los comprobantes sin archivos externos.

Informar y decidir bloquean cliente, ventas ordenadas y, para oficina, aviso.
Revalidan permisos y alcance tras bloquear. Importe positivo con dos decimales y
aplicaciones exactas, sin excesos ni reparto supuesto. La revisión incluye versiones
de saldo y huella del archivo; si cambian, se debe revisar otra vez. UUID/cuerpo/
archivo/responsable son inmutables al reintentar. La decisión usa un UUID propio y
el cobro una clave interna única. Confirmar invoca `cobros.registrar_cobro`, copia
el comprobante privado, enlaza el aviso y audita todo atómicamente. Un fallo de
auditoría revierte también el cobro. Competir por el mismo saldo o decidir dos veces
no duplica cobros. Actividad cuenta una confirmación como Cobros/Registrar; conserva
el detalle técnico de Pagos/Confirmar sin duplicar la operación principal.

La interfaz conserva cuerpo y File en memoria ante respuesta incierta, bloquea
cambios y reintenta lo mismo. Cambiar sesión o salir descarta respuestas tardías.
Actualizar saldos mantiene los importes escritos y no aplica páginas incompletas.

## HTTPS y comprobaciones

La pasarela y `config.rutas_chofer_https` publican solo `/mis-pagos` y su API propia.
Multipart se admite exclusivamente al revisar/informar, con límite de 8 MB más
cabeceras/campos. Verificación, Ventas, Cobros y Empresa permanecen locales. La
política usa rutas y métodos explícitos, origen exacto, cookies/CSRF y cabeceras
RSC de Next conservadas. El código no reinicia el túnel automáticamente ni crea
un despliegue permanente; reiniciar el acceso genera otra dirección temporal.

Migraciones: `clientes.0005_cliente_encargado_pagos`, `pagos.0001_initial`.
Antes de aplicarlas se creó y verificó el respaldo privado
`.local/pagos/20261113-132414/base_antes_de_mis_pagos.dump` y la instantánea de
asignaciones. `preparar_roles` crea las dos plantillas nuevas sin tocar las
asignaciones existentes.

Por solicitud explícita del usuario se habilitó la cuenta existente de Andres
Carvajal para Hipermaxi: se conservó su rol de precios, se agregó únicamente el
rol limitado de pagos y se fijó `encargado_pagos`. Ambas modificaciones quedaron
auditadas mediante los servicios de Usuarios/Clientes. Se comprobó que conserva
Precios, puede consultar/informar sus pagos y no accede a la verificación global.
Los permisos de los 22 roles anteriores y las asignaciones de las otras cuatro
cuentas permanecieron intactos.

Pruebas: flujo parcial/completo, alcance e integridad del archivo, CSRF/multipart,
rechazo de acceso global y HTTPS administrativo, permisos separados/revocación,
reintentos, reversión transaccional y concurrencia PostgreSQL. La interfaz comprueba
API propia, archivo/cuerpo exactos al reintentar, opciones bancarias y acciones por
permiso en español/inglés. `herramientas/comprobar_navegacion_https.mjs` comprueba
HTML y navegación RSC con cuenta ficticia, sin operar datos de producción.

Validación del 13/11/2026: 176 pruebas relacionadas de backend y, tras agregar
casos de permisos y concurrencia, las 15 de Pagos; 406 pruebas de interfaz y nueve
de pasarela. Compilación de producción y TypeScript correctos, traducciones UTF-8,
ESLint de los componentes modificados y once páginas comprobadas mediante HTML/RSC.
Se reinició el acceso externo para cargar el portal. En el enlace real se comprobó
redirección al ingreso para `/mis-pagos`, 401 sin sesión en su API y 404 para las
API de verificación, Cobros y Ventas; la administración local permaneció disponible.

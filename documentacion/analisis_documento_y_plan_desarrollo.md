# Análisis funcional y plan de desarrollo de HortyFru

Fecha de revisión: 25 de octubre de 2026.

Este informe reúne el resumen del documento de referencia, su comparación con el proyecto actual y el orden recomendado de desarrollo. Es un diagnóstico y una propuesta; no incorpora módulos nuevos ni cambia las operaciones del sistema.

Actualización posterior: Proveedores se incorporó al proyecto con nombre, categoría
opcional, teléfono, dirección, estado y fecha de creación automática. Se excluyó
mercado/lugar de compra. Por decisión del usuario, no se desarrollará Empleados:
los responsables se vincularán directamente a Usuarios. El diagnóstico y las
comprobaciones de las secciones siguientes describen la revisión inicial; el
contrato vigente está en [Proveedores](../Backend/proveedores/README.md).

Actualización del 26 de octubre de 2026: [Compras](../Backend/compras/README.md)
incorpora fecha de pedidos a atender y fecha de compra independientes, consulta
de pendientes por fecha requerida, CANT/UNI separadas, proveedores por línea,
borradores, registro/cancelación y auditoría. El siguiente bloque funcional es
Almacenes y la base de inventario/Recepciones.

Actualización del 26 de octubre de 2026: [Almacenes](../Backend/almacenes/README.md)
incorpora nombre, dirección, latitud/longitud opcionales, estado y fecha de creación.
El siguiente bloque pendiente es inventario y Recepciones.

## Alcance y fuentes

- Referencia: `C:\Users\Usuario\Downloads\documentacion_completa_hortyfru_modulos_tablas_flujo_sin_dw.txt`, revisada el 24 de octubre de 2026. Se consultaron su inventario de módulos, diccionario, flujo F01–F21, reglas y alcance.
- Proyecto: código y configuración de Django y Next.js, modelos, migraciones, rutas, permisos, servicios, componentes y documentación local.
- Verificación: consulta de metadatos del esquema PostgreSQL local y ejecución de las comprobaciones indicadas al final.
- Convenciones vigentes: [AGENTS.md](../AGENTS.md) y [Frontend/AGENTS.md](../Frontend/AGENTS.md).

El documento describe un sistema PHP con MySQL y 74 tablas. El proyecto revisado utiliza Django REST Framework, Next.js y PostgreSQL. El documento se toma como referencia funcional; las decisiones actuales del proyecto conservan prioridad. Los nombres y las estructuras del sistema anterior no se trasladan automáticamente.

El análisis excluye Data Warehouse, datamarts y ETL, conforme al alcance solicitado en el documento.

## 1. Resumen de módulos y flujo del negocio

El sistema organiza seis bloques de trabajo:

| Bloque | Funciones |
| --- | --- |
| Acceso y administración | Usuarios, empleados, roles, permisos y registro de actividad. |
| Catálogos y destinos | Productos, categorías, unidades, presentaciones, clientes, sucursales, proveedores, almacenes, vehículos, cajillas e insumos de empaque. |
| Abastecimiento e inventario | Pedidos, compras, recepciones, lotes, movimientos, disponibilidad y mermas. |
| Preparación y distribución | Preparaciones, carga, despachos, recorrido del chofer, descargas y seguimiento de flota. |
| Entregas y gestión comercial | Pesos aceptados, devoluciones, precios acordados, liquidaciones, cobros y saldos. |
| Comunicación y consulta | Portal del supermercado, pagos reportados, chat, notificaciones, catálogo público, reportes y dashboard. |

El documento enumera 36 opciones principales, 4 accesos del portal y funciones complementarias. Algunas opciones comparten datos y servicios; no representan necesariamente aplicaciones o tablas independientes.

El recorrido operativo es:

1. Configurar catálogos, destinos, responsables y permisos.
2. Registrar un pedido por sucursal con fecha requerida, presentaciones y cantidades.
3. Revisar necesidades y existencias aptas disponibles.
4. Comprar lo necesario cuando falte producto.
5. Registrar y confirmar el ingreso físico al almacén.
6. Preparar los pedidos utilizando lotes disponibles, medir cantidades y pesos reales y separar pérdidas o producto aprovechable.
7. Confirmar la preparación y registrar la salida del inventario.
8. Organizar el despacho con vehículo, chofer, carga, cajillas y paradas.
9. Registrar salida, llegada y descarga; finalizar el recorrido cuando se cumplan sus condiciones.
10. Conciliar y confirmar los pesos aceptados por las sucursales desde Entregas.
11. Emitir la liquidación con precios aceptados aplicables.
12. Registrar o confirmar el cobro y aplicarlo a los documentos del cliente.
13. Consultar saldos, trazabilidad y resultados.

Los precios pueden acordarse antes o durante la operación, pero deben estar aceptados antes de liquidar. Una compra nueva es opcional si existe producto apto suficiente. Las devoluciones son una rama adicional cuando el producto vuelve físicamente.

Las separaciones esenciales del flujo son:

- **Pedido:** expresa lo solicitado; CANT y UNI son cantidades independientes.
- **Compra:** registra la adquisición comercial; no crea stock por sí sola.
- **Recepción de almacén:** reconoce el ingreso físico y genera lotes y movimientos al confirmar.
- **Preparación:** registra lo que se medirá y enviará; su confirmación descuenta el producto una sola vez.
- **Despacho y descarga:** registran transporte y entrega física por el chofer; no repiten la salida de inventario ni confirman automáticamente los pesos aceptados.
- **Entrega:** concilia los pesos comunicados por la sucursal; puede confirmarse después del cierre del viaje.
- **Devolución:** exige retorno físico y revisión; un rechazo comunicado no aumenta las existencias.
- **Liquidación:** calcula kilos aceptados por precio acordado por kilogramo y conserva sus datos históricos. El documento de referencia la identifica como liquidación comercial sin valor fiscal.
- **Reporte de pago:** es una declaración pendiente del supermercado; solo un cobro reconocido y aplicado reduce el saldo.
- **Cajillas:** mantienen cantidades y movimientos propios, independientes de los kilos de producto.

## 2. Comparación con el sistema actual

### Criterio de estado

- **Con implementación:** se encontraron modelos o servicios de negocio, API y pantallas relacionadas. No implica equivalencia completa con el sistema anterior.
- **Parcial:** existe una base funcional, pero faltan funciones expresamente descritas en la referencia.
- **Plantilla:** existe interfaz de demostración, sin la operación de negocio descrita.
- **Pendiente:** no se encontró implementación funcional en el código revisado.

### Las 36 opciones de la referencia

| N.º | Opción del documento | Estado y alcance encontrado |
| --- | --- | --- |
| 01 | Dashboard | Plantilla. La página inicial y sus tarjetas utilizan componentes de comercio electrónico con cifras de ejemplo; falta el dashboard ejecutivo con datos de HortyFru. |
| 02 | Chat | Pendiente. No se encontró el módulo de conversaciones, mensajes y adjuntos autorizados. |
| 03 | Pedidos | Parcial. Existen alta, consulta, edición, cancelación, hoja por pedido/sucursal, cantidades CANT/UNI, controles de alcance, historial e idempotencia. No se encontró la hoja general consolidada entre sucursales. |
| 04 | Compras | Pendiente. |
| 05 | Recepciones | Pendiente. Se refiere a ingresos en almacén. |
| 06 | Preparaciones de pedidos | Pendiente. El estado preparado existe en Pedidos, pero no hay servicio de preparación ni salida de inventario. |
| 07 | Despachos | Pendiente. |
| 08 | Mis despachos | Pendiente. |
| 09 | Entregas | Pendiente. Aquí corresponde la recepción y conciliación de la sucursal. |
| 10 | Devoluciones de productos | Pendiente. |
| 11 | Almacenes | Pendiente. |
| 12 | Insumos de empaque | Pendiente. |
| 13 | Tipos de cajilla | Pendiente. |
| 14 | Movimientos de cajillas | Pendiente. |
| 15 | Lotes | Pendiente. |
| 16 | Movimientos de inventario | Pendiente. |
| 17 | Mermas | Pendiente. |
| 18 | Categorías de productos | Con implementación: catálogo, estados, validaciones, permisos y auditoría. |
| 19 | Unidades de medida | Con implementación ajustada: nombre, abreviatura y estado; el catálogo actual no incluye permite_fraccion. |
| 20 | Productos | Parcial respecto de la referencia: catálogo, categoría, unidad base, imagen y presentaciones. Falta habilitar varias unidades de inventario por producto. |
| 21 | Presentaciones para compras | Con implementación ajustada: se administran en la ficha del producto, mediante su uso en compras; sin equivalencias. |
| 22 | Presentaciones para pedidos | Con implementación ajustada: comparten catálogo con las de compras y se vinculan a las columnas CANT/UNI; sin equivalencias. |
| 23 | Precios acordados | Pendiente. |
| 24 | Facturación y saldos | Pendiente. La referencia describe liquidaciones comerciales. |
| 25 | Cobros | Pendiente. |
| 26 | Accesos de supermercados | Pendiente. La asignación actual de encargados de pedidos no equivale al portal comercial del cliente. |
| 27 | Clientes | Con implementación: datos comerciales, NIT, contacto, estado, permisos y auditoría. |
| 28 | Sucursales | Con implementación: se administran dentro del cliente, con dirección, referencia, coordenadas y encargado de pedidos. |
| 29 | Proveedores | Pendiente. Es el siguiente módulo recomendado. |
| 30 | Reportes del negocio | Pendiente. Las consultas de cada módulo no sustituyen los reportes operativos y comerciales de la referencia. |
| 31 | Vehículos | Pendiente. |
| 32 | Seguimiento de flota | Pendiente. Los componentes de mapas de la plantilla no implementan seguimiento operativo. |
| 33 | Usuarios | Con implementación: acceso por correo, administración, estados, roles, validaciones y perfil propio. |
| 34 | Empleados | Excluido por decisión del usuario. Las responsabilidades operativas se vinculan directamente a Usuarios. |
| 35 | Roles y permisos | Con implementación ajustada: utiliza grupos y permisos nativos de Django y roles por función. |
| 36 | Registro de actividad | Parcial respecto de la referencia: auditoría central, filtros, detalle, permisos e integración transaccional. No se encontró exportación. |

Hay código de negocio relacionado con 11 de las 36 opciones, con los alcances y pendientes indicados. Ambas opciones de presentaciones comparten implementación y varias fichas se integran dentro de otros módulos. Este conteo no representa un porcentaje de finalización.

### Portal y funciones complementarias

| Función | Situación actual |
| --- | --- |
| P1. Mis precios | Pendiente; depende de acuerdos y acceso vinculado al cliente. |
| P2. Liquidaciones y saldos | Pendiente; depende de liquidaciones y cobros. |
| P3. Mis pagos | Pendiente; requiere reportes de pago, aplicaciones propuestas y revisión interna. |
| P4. Chat con HortyFru | Pendiente; comparte el futuro módulo de chat. |
| C1. Autenticación | Con implementación: sesión, CSRF, correo y contraseña, permisos en servidor y perfil. |
| C2. Notificaciones | La campana actual contiene ejemplos de la plantilla. Los avisos de éxito/error de formularios sí existen, pero no equivalen a notificaciones persistentes del negocio. |
| C3. Página pública y catálogo | Pendiente. El catálogo autenticado usado para crear pedidos no es un catálogo público. |
| C4. Perfil | Tiene implementación propia conectada a la cuenta, incluida edición de perfil y contraseña; supera la mera pantalla heredada mencionada en la referencia. |

### Esquema y equivalencias funcionales

La consulta de metadatos de la base local encontró **21 tablas físicas**. Los 12 modelos propios registrados tienen su tabla presente; además existen tablas del framework y relaciones auxiliares. Esto verifica presencia de esquema, no equivalencia con las 74 tablas de MySQL ni integridad de todos los datos de negocio.

| Referencia anterior | Implementación actual |
| --- | --- |
| users | usuarios_usuario |
| roles y permissions | Grupos y permisos nativos de Django. |
| activity_log | auditoria_registroactividad; se conservan también tablas de actividad previa de Usuarios y Roles. |
| articulos | productos |
| categorias_articulos | categorias_productos |
| unidades_medida | unidades_medida, con contrato actual simplificado. |
| presentaciones_articulos | presentaciones_producto, sin equivalencias configuradas. |
| clientes y sucursales | clientes y sucursales. |
| pedidos y detalles_pedidos | pedidos y detalles_pedidos, con contratos de cantidades y acceso propios del proyecto. |

No corresponde crear las tablas restantes solo para alcanzar 74. Cada módulo futuro debe introducir las estructuras que necesite y conservar los contratos públicos existentes.

### Diferencias que requieren atención

1. **Equivalencias de presentaciones.** La referencia conserva equivalencias en algunas descripciones y tablas. Las convenciones actuales las excluyen, y la migración de Productos ya eliminó sus cantidades. Se mantienen las presentaciones como nombre y uso; las mediciones pertenecen al inventario.
2. **Unidades de inventario.** Producto tiene una unidad base. Antes de Recepciones debe diseñarse la habilitación de unidades por producto y la separación entre presentación comprada, cantidad recibida y peso real. Esto no exige reintroducir equivalencias en presentaciones.
3. **Estados de Pedidos.** El catálogo incluye pendiente, preparado y cancelado. La transición a preparado está reservada a la futura preparación; no es una acción manual que deba agregarse al editor de pedidos.
4. **Hoja general.** Falta el consolidado de pedidos de varias sucursales. Debe conservar la identificación de cada destino y mantener CANT/UNI separadas. No implica fusionar pedidos ni implementar copia de pedidos anteriores.
5. **Roles.** La referencia menciona cuatro roles de negocio. El proyecto usa roles por función, además del superusuario técnico. Es una diferencia de modelo de autorización; no justifica renombrar roles, ampliar permisos ni reasignar cuentas automáticamente.
6. **Responsables.** El encargado de la sucursal apunta a una cuenta. Se mantiene Usuarios como origen de los responsables de compras, recepciones, preparaciones y despachos; no se creará Empleados.
7. **Documentación local.** Los README generales todavía omiten Pedidos en algunos listados, comandos de pruebas y descripciones del catálogo de permisos. El README específico de Pedidos sí documenta su contrato. Conviene sincronizar los documentos generales.
8. **Demostraciones visibles.** Dashboard, campana y otras pantallas de la plantilla deben diferenciarse de módulos operativos para evitar interpretar cifras de ejemplo como información de HortyFru.

## 3. Orden recomendado de desarrollo

El primer módulo propuesto fue **Proveedores**, ya incorporado posteriormente. Resuelve una dependencia directa de Compras y reutiliza categorías, catálogos, permisos, formularios y auditoría existentes. La siguiente etapa de negocio es Compras.

| Orden | Entregable | Dependencias y criterio de cierre |
| --- | --- | --- |
| 1 | Proveedores | Incorporado: nombre, categoría opcional, teléfono, dirección, estado y fecha de creación. Alta, edición, consulta, búsqueda, permisos, auditoría y páginas de 10 registros. |
| 2 | Responsables con Usuarios | Reutilizar las cuentas activas y permisos existentes para identificar responsables operativos. No requiere un módulo de Empleados. |
| 3 | Compras y consolidado de necesidades | Proveedores, productos, presentaciones y responsables vinculados a Usuarios. Borrador, registro, cancelación controlada, cantidades, precios, total y relación de cobertura con pedidos cuando corresponda. Registrar no crea stock. El consolidado mantiene los pedidos originales. |
| 4 | Almacenes | Catálogo de ubicaciones, dirección, estado y coordenadas cuando se utilicen mapas. |
| 5 | Base de inventario y Recepciones | Diseñar conjuntamente unidades habilitadas por producto, lotes, cabeceras y detalles de movimientos, disponibilidad y recepciones. Confirmar un ingreso genera lotes y entradas una sola vez; guardar un borrador no genera existencias. |
| 6 | Cajillas, empaque y pérdidas | Tipos y movimientos de cajillas; insumos de empaque según su uso operativo; mermas con movimientos y validación de saldo. Los recipientes tienen su propio control físico. |
| 7 | Preparaciones | Pedidos, almacenes, lotes y disponibilidad. Cantidad solicitada, cantidad real y kilos; reservas, vencimiento y selección FEFO cuando aplique; cajillas y separaciones. Confirmar registra una sola salida y marca el pedido preparado en la misma transacción. |
| 8 | Vehículos, Despachos y Mis despachos | Usuarios/choferes autorizados, preparaciones y cajillas. Carga, orden de paradas, salida, llegada, descarga e incidencias; cierre del viaje conforme al proceso. No se repite el descuento del producto. |
| 9 | Entregas y devoluciones | Conciliación posterior de pesos aceptados/rechazados y comprobantes. Los retornos físicos quedan identificados y se revisan separando disponible, aprovechable y merma. |
| 10 | Precios acordados | Clientes, productos y pedidos. Alcances por vigencia o pedido, aceptación e historial de correcciones. Puede desarrollarse antes o en paralelo funcional al bloque logístico; debe estar listo antes de liquidar. |
| 11 | Liquidaciones y saldos | Entregas confirmadas y precios aceptados. Documentos históricos, cálculo y redondeo, prevención de liquidación duplicada y consulta de saldos. |
| 12 | Cobros y portal comercial | Cobros directos, aplicaciones, acceso vinculado al cliente, Mis precios, Liquidaciones y Mis pagos. Un reporte pendiente no reduce saldos; reconocer el ingreso sí. |
| 13 | Flota, comunicación y consultas globales | Seguimiento GPS sobre despachos operativos, chat, notificaciones persistentes, catálogo público, reportes y dashboard con datos reales. GPS es voluntario y no confirma operaciones. Estas funciones pueden adelantarse cuando sus dependencias existan. |

Este orden prioriza completar el circuito físico y comercial. No es necesario esperar al último bloque para implementar notificaciones de un módulo ya estable, el catálogo público o un reporte operativo con datos disponibles. Los reportes de ventas facturadas y cobros requieren sus fuentes comerciales terminadas.

### Primer hito verificable

**Pedido → compra → recepción → existencias.**

El hito estará disponible cuando se pueda registrar una adquisición para necesidades reales, recibir parcial o totalmente lo comprado, generar los lotes correspondientes y consultar sus saldos por almacén y unidad sin inferir kilos desde cajas.

Después, el segundo hito debe completar **preparación → despacho → descarga → entrega confirmada**, y el tercero **precio aceptado → liquidación → cobro → saldo**.

### Criterios comunes para módulos futuros

- Nombres propios nuevos en español y compatibilidad con los contratos existentes de las bibliotecas y la API.
- Permisos verificados en servidor, catálogo de permisos y alcance de datos por usuario/cliente cuando corresponda.
- Auditoría HTTP y servicio central para cambios de negocio y procesos fuera de HTTP, dentro de la transacción aplicable.
- Listados y selectores de negocio de 10 registros por página.
- Fechas nuevas con CampoFecha, idioma activo, valores ISO, límites y mensajes de validación.
- Diseño HortyFru, componentes compartidos, traducciones en español e inglés, modo oscuro y accesibilidad.
- Confirmaciones transaccionales, bloqueo y revalidación de estados/saldos cuando exista concurrencia, e idempotencia para operaciones reintentables.
- Historial conservado; cancelaciones o reversiones controladas en lugar de reescribir operaciones confirmadas.
- Pruebas de reglas y permisos con impacto real; revisión de interfaz cuando se implemente cada pantalla.

## 4. Comprobaciones realizadas

| Comprobación | Resultado |
| --- | --- |
| `python manage.py test usuarios roles auditoria catalogos productos clientes pedidos` | 188 pruebas correctas. Base de pruebas separada creada y eliminada por Django. |
| `python manage.py check --database default` | Sin incidencias. |
| `python manage.py makemigrations --check --dry-run` | Sin cambios de modelos pendientes de generar migraciones. |
| `tsc --noEmit --incremental false` | Correcto, sin errores de tipos. |
| Metadatos de PostgreSQL local | 21 tablas físicas; presentes las tablas de los 12 modelos propios registrados. |

Estas comprobaciones respaldan el estado técnico de la base actual. No certifican la cobertura funcional del documento completo, la presentación visual en navegador ni la ejecución integral de operaciones que todavía no están implementadas. No se ejecutó una compilación de producción en esta revisión.

## Referencias del proyecto

- [Configuración y aplicaciones registradas](../Backend/config/settings.py).
- [Rutas de la API](../Backend/config/urls.py).
- [Catálogo de permisos](../Backend/roles/catalogo.py).
- [Navegación del panel](../Frontend/src/layout/AppSidebar.tsx).
- [Contrato de Pedidos](../Backend/pedidos/README.md).
- [Modelos de Productos y Presentaciones](../Backend/productos/models.py).
- [Modelos de Clientes y Sucursales](../Backend/clientes/models.py).
- [Contrato de integración de auditoría](../Backend/auditoria/INTEGRACION.md).
- [Página inicial de la plantilla](../Frontend/src/app/[locale]/(admin)/page.tsx).
- [Notificaciones de ejemplo de la plantilla](../Frontend/src/components/header/NotificationDropdown.tsx).

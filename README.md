# Pixel Perfect Clone

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/9e7af2b8-018c-4cc3-89db-3a1d8a1351eb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Entregas y dashboards (12/11/2026)

En Administración → Pedidos, **Marcar como entregado** solicita fecha real y receptor. Solo acepta pedidos validados, no cancelados, con todas sus líneas físicas cubiertas por expediciones validadas o cerradas. La fecha no puede ser futura ni anterior al pedido o a su última expedición.

Los campos nativos de pedido `bimbo_fecha_entrega` y `bimbo_recibido_por` se crean con `php server/configure-delivery.php --apply NOMBRE_EXACTO_BD` (hacer respaldo antes). La confirmación utiliza métodos nativos de Dolibarr, una transacción y una nota privada de auditoría con administrador, momento e identificador de reintento. No cambia el estado nativo ni la fecha prevista; tampoco mueve stock, factura o cobros. Una vez entregado, la cancelación directa desde la web queda bloqueada: una devolución requiere su propio proceso. Los pedidos históricos quedan sin confirmación; no se inventan fechas. El cliente ve la fecha en Mi cuenta.

Administración → Reportes ofrece seis dashboards conectados al snapshot de Dolibarr:

- Ventas: facturación sin impuestos, margen bruto según costo guardado en líneas, evolución, canales B2B/B2C y rankings. Excluye borradores, abandonadas y proformas; conserva signos de abonos. No representa utilidad neta.
- Cobranza: cobros por fecha de pago y método; saldo vigente de facturas seleccionadas por fecha de emisión.
- Entregas: pedidos según fecha de creación, recepción confirmada y puntualidad solo cuando existen fecha prevista y real.
- Inventario: situación actual por almacén, faltantes y umbrales cuando están configurados. No reconstruye existencias históricas.
- Compras: facturas de proveedor validadas/cerradas por fecha de emisión; importes sin impuestos y principales proveedores.
- Producción: órdenes por inicio previsto, terminadas y cantidades registradas por producto/unidad. No supone que la fecha de importación sea la fecha real de fabricación.

Los filtros de canal se aplican a ventas, cobranza y entregas. La clasificación histórica inferida desde el cliente se identifica como tal. Un dato ausente se muestra como desconocido, no como cero de cumplimiento.

Validación: pruebas unitarias de contratos, KPIs de entregas y periodos; HTTP en copia aislada con control de acceso, fechas inválidas, cobertura incompleta, rollback ante fallo, concurrencia y reintentos; verificación de stock, facturas, pagos y fechas previstas sin alteraciones; TypeScript, compilación y revisión visual.

## Fecha prevista y puntualidad de entregas

En Pedidos → Programar entrega / Cambiar fecha, el administrador guarda la fecha nativa `llx_commande.date_livraison` mediante `Commande::setDeliveryDate`. El pedido conserva sus estados, expediciones, inventario y documentos financieros. La fecha no puede ser anterior al pedido. Se admiten fechas históricas para registrar compromisos previos y fechas futuras para programar entregas.

La edición exige sesión administrativa y permiso de pedidos, bloquea cancelados y recepciones ya confirmadas, verifica la fecha anterior para impedir sobrescrituras concurrentes y deja auditoría de fecha anterior/nueva y actor en la nota privada. La transacción y el identificador de solicitud permiten recuperar reintentos sin duplicar cambios.

Reportes → Entregas contiene indicadores, gráfico y listado paginado con búsqueda y filtro de cumplimiento. Se compara la fecha real con la prevista por días calendario: entregar antes o en la fecha cuenta como puntual; después, como retraso. Los pedidos vencidos sin recepción confirmada se muestran aparte y no se cuentan como entregados. Los entregados sin fecha prevista no entran en el porcentaje de puntualidad. Los borradores y cancelados quedan fuera. Se mantienen los filtros generales por fecha de creación del pedido y canal.

Pruebas: `node --experimental-strip-types --test tests/planned-delivery.test.mjs tests/delivery-reports.test.mjs`. Se verificaron además permisos, fecha imposible, anterior al pedido, cancelados, edición concurrente, reintentos, rollback y bloqueo tras recepción mediante HTTP contra una copia aislada de Dolibarr. No se programaron fechas ni recepciones de prueba en la base habitual.

## Seguimiento de entrega en Mi cuenta

El API de cuenta incluye `fechaPrevista` desde `commande.date_livraison`, junto con `fechaEntregaReal`. Ambas lecturas conservan el filtro por entidad y tercero vinculado a la sesión; el cliente no selecciona la identidad consultada. No se exponen notas privadas ni el receptor.

Cada pedido muestra un bloque de seguimiento con la fecha prevista, la recepción confirmada cuando existe y un estado legible: programada, con retraso sin confirmar, entregada a tiempo, entregada con retraso o fecha por confirmar. Usa el mismo cálculo de días calendario del dashboard, con la fecha actual de Lima; los cancelados y borradores no se presentan como atrasados. La cuenta vuelve a consultar los datos cada 30 segundos y mantiene el botón Actualizar.

Validado con las pruebas `customer-delivery.test.mjs`, `planned-delivery.test.mjs` y `store.test.mjs`, PHP lint, TypeScript, compilación, comprobación HTTP de las fechas frente al snapshot administrativo y aislamiento de los pedidos del cliente. Esta mejora solo lee datos y no crea fechas de prueba en Dolibarr.

## Notificaciones de entrega del cliente

La campana de la tienda muestra avisos persistentes al programar, cambiar la fecha prevista o confirmar la recepción **desde los flujos de administración de esta web**. Se usan las tablas adicionales `llx_bimbo_notification` y `llx_bimbo_notification_read` en la misma base de Dolibarr. La migración `php server/configure-notifications.php --apply NOMBRE_EXACTO_BD` debe ejecutarse antes de desplegar los escritores nuevos; no crea avisos históricos.

El evento se inserta dentro de la transacción del pedido, después del guardado nativo y su auditoría. La clave de evento es única por entidad y solicitud; los reintentos recuperados y guardar una fecha sin cambiarla no generan avisos nuevos. Un fallo de inserción revierte el cambio del pedido. El mensaje guarda el tipo de evento y las fechas anterior/nueva, no notas privadas ni el nombre del receptor.

GET /api/notificaciones usa paginación por cursor de 25 registros, cuenta global de no leídos y propiedad del pedido comprobada contra el cliente de la sesión y su entidad. PATCH admite identificadores concretos o el último identificador visible para marcar todo hasta ese punto; nuevos avisos posteriores siguen sin leer. La lectura se conserva por usuario, independientemente del navegador. Un lote con avisos ajenos se rechaza entero. Las escrituras exigen el mismo origen y JSON explícito.

El cliente consulta cada 15 segundos mientras la página está activa, recibe un aviso emergente si llegan eventos nuevos, y puede revisar los anteriores, marcar leídos y abrir el pedido en Mi cuenta. Los eventos que llegaron sin estar conectado quedan en la campana. No se necesita permiso de notificaciones del navegador. Esta implementación no instala un disparador para cambios realizados directamente en la interfaz nativa de Dolibarr.

Validación: tests unitarios notifications.test.mjs y seguimiento; HTTP en copia aislada para generación, rollback, reintentos concurrentes, fecha sin cambios, aislamiento por cliente, marcado individual y por límite, persistencia de lectura y paginación. Revisión visual del contador, los tres mensajes y Ver pedido; PHP lint, TypeScript y compilación. El buzón habitual no contiene los avisos generados en las pruebas.

### Notificaciones de administración

La campana del panel registra nuevos pedidos hechos por clientes B2B/B2C en la tienda y pagos de clientes desde la pasarela. Cada evento se guarda en la misma transacción nativa de Dolibarr; los reintentos con el mismo UUID no lo duplican. No se generan avisos retroactivos ni por operaciones hechas directamente en Dolibarr o por el administrador.

Aplicar una vez `php server/configure-admin-notifications.php --apply NOMBRE_EXACTO_BD` antes de desplegar los escritores. Las tablas `llx_bimbo_admin_notification` y `llx_bimbo_admin_notification_read` mantienen el historial y la lectura individual por administrador. `/api/admin-notificaciones` exige sesión de administrador y restringe los eventos a su entidad. Consulta cada 15 segundos con la página activa, permite leer uno/todos, paginar y abrir el pedido/factura. Los importes son los guardados en Dolibarr, con impuestos; los avisos conservan la información del momento del evento. La clasificación interna de pagos simulados se conserva.

### Delivery y recojo en tienda

En el carrito el cliente elige delivery o recojo. El punto de recojo es la dirección/ciudad de Empresa en Dolibarr y se conserva en cada pedido. Se requiere configurar una dirección para habilitar recojo. Aplicar `php server/configure-pickup.php --apply NOMBRE_EXACTO_BD` antes del despliegue. Campos nativos de commande: `bimbo_modalidad`, `bimbo_punto_recojo`, `bimbo_listo_recojo`; fecha final y receptor usan `bimbo_fecha_entrega`/`bimbo_recibido_por`. Pedidos históricos sin modalidad se consideran delivery.

Administración marca Listo para recoger y después confirma fecha/persona del retiro. `/api/recojos` exige administrador, entidad y pedido válidos; verifica salida completa y orden de estados, usa bloqueo compartido y transacción con aviso al cliente y auditoría. Los reintentos conservan UUID. Una vez retirado no se permite cancelar: corresponde devolución. Preparar/retirar no modifica stock, facturación ni pagos; la salida de stock sigue ocurriendo al comprar. El pago es independiente del recojo. Los KPI de puntualidad de delivery excluyen recojos.

### Pago obligatorio antes de la recepción

Las confirmaciones nuevas de entrega y retiro requieren todas las facturas de venta vinculadas al pedido pagadas en Dolibarr y con saldo efectivo cero. La comprobación usa los pagos y créditos/anticipos aplicados en moneda base; marcar manualmente pagada con saldo positivo no habilita la recepción. No tener factura, tenerla en borrador/anulada, un pago parcial o una factura de otro cliente/entidad bloquea la operación. Las notas de crédito solas no autorizan recepción.

La misma regla alimenta los botones deshabilitados y se vuelve a evaluar dentro de la transacción, con el bloqueo compartido de pedidos/pagos y bloqueos de filas. Una anulación de pago antes de confirmar vuelve a bloquear. Se permite programar y preparar recojos antes del pago. Los reintentos de una recepción ya guardada recuperan el resultado sin crear otra recepción; no se modifican entregas históricas.

### Pedidos, fichas y calidad de datos

Mi cuenta muestra el pago agregado de todas las facturas vinculadas al pedido (pagos y créditos), permite pagar su saldo con la pasarela del curso para B2B/B2C y repetir productos con catálogo y stock actuales. Repetir no crea un pedido: añade al carrito, avisa faltantes y vuelve a validar precios/stock al confirmar.

El detalle de pedidos está protegido por sesión/cliente/entidad. El historial combina fechas nativas, eventos de entrega, pagos vigentes y anulaciones auditadas; no inventa horas ni fechas de programación de pedidos importados. Administración ve productos, cantidades, modalidad y contacto guardado; en pedidos antiguos se identifica el uso de datos actuales del cliente.

Ejecutar `php server/configure-product-info.php --apply NOMBRE_BD` una vez en cada entorno. Presentación y contenido son atributos adicionales de Producto en Dolibarr, peso usa su campo nativo, fotos usan su directorio nativo. Packaging nativo significa múltiplo de venta y NO se reutiliza como unidades dentro de caja. No se fabrican valores. Calidad de datos identifica campos vacíos/precios cero y posibles duplicados por documento/correo/nombre sin fusionar ni borrar registros. Fotos públicas limitadas a productos en venta de la entidad y archivos raster verificados dentro del directorio del producto.

Las compras nuevas usan el calendario de Lima para fecha comercial de pedido, factura y salida. Esto evita que el cambio de día UTC impida pagar inmediatamente. No se reescriben fechas históricas. La creación y registro de pagos en el historial convierten timestamps nativos a la zona de Lima; las fechas sin hora permanecen como fechas.

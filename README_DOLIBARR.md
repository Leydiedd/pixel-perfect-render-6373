# Conexión local con Dolibarr

## Tienda B2B/B2C y administración

- `/`: tienda pública para personas y negocios; muestra únicamente catálogo, precios y disponibilidad del almacén de venta configurado.
- `/registro` y `/acceso`: registro e inicio de sesión. Las personas registran DNI o RUC; los negocios, RUC y razón social. El correo permite iniciar sesión; el identificador interno se genera automáticamente para respetar las reglas de Dolibarr.
- `/carrito`: cantidades enteras, datos de entrega, impuestos y total antes de confirmar. Los pedidos quedan pendientes de pago. Los clientes B2C pueden simular su pago desde Mi cuenta; no se ejecutan cobros ni transferencias reales. La entrega y cualquier cargo adicional se coordinan con administración.
- `/mi-cuenta`: pedidos, líneas, facturas, saldos, PDF e historial de pagos del cliente autenticado; pasarela ficticia para cuentas B2C.
- `/admin`: panel anterior, protegido con el usuario y contraseña de un administrador interno de Dolibarr. Conserva pedidos, cancelaciones, inventario, logística, pagos, anulaciones e historial. Las rutas antiguas redirigen a sus equivalentes bajo `/admin`.

El registro crea un tercero cliente y un usuario externo nativo dentro de una transacción. Las contraseñas se guardan mediante `User::setPassword()`. Se retiran permisos y grupos por defecto de los usuarios nuevos; el portal atiende sus compras con el actor de integración configurado y registra el usuario cliente en la operación. No se vinculan terceros existentes por correo o documento: administración debe crear y vincular su usuario externo en Dolibarr. Esto impide reclamar el historial de una empresa conociendo su RUC. La migración de tarifas asigna el nivel 2 a los clientes empresariales existentes; conserva su historial y documentos.

La cuenta determina el cliente del pedido en el servidor; el navegador no puede cambiarlo. Una cuenta B2B puede elegir hogar (tarifa normal nivel 1) o negocio (nivel asignado en Dolibarr, sujeto al mínimo mayorista). Una cuenta B2C no puede comprar como mayorista. La elección se guarda por usuario y cada envío pendiente conserva su canal para reintentos. B2C presenta precios con impuestos y B2B precios base con el total e impuestos en la confirmación; ambos usan el precio vigente de Dolibarr. El nivel de precio asignado al tercero en Dolibarr determina la tarifa; no hay descuentos por cantidad ni crédito automático. Los productos sin precio positivo, sin stock en el almacén configurado o que requieren selección de lote no se pueden comprar online.

`POST /api/compra` reutiliza la transacción nativa pedido + factura + expedición cerrada, con UUID persistido por cuenta y recuperación de reintentos. Guarda el canal, usuario y dirección como marcador JSON codificado `portal-store-v1` en las notas privadas del pedido y factura; la dirección de entrega también queda en la nota pública. El panel muestra el canal y los datos de entrega. Los registros anteriores conservan «Sin clasificar» cuando no tienen un canal registrado. La cancelación reconoce la huella que incluye estos datos y conserva las comprobaciones anteriores.

Las sesiones usan tokens aleatorios, cookie HttpOnly/SameSite y duración de ocho horas; solo se guarda el hash del token en `.local/sessions`. Se comprueban contra el usuario nativo en cada petición protegida y se invalidan al cerrar sesión, desactivar la cuenta, cambiar contraseña o modificar su vínculo/rol. Las rutas de administración rechazan clientes y visitantes; la descarga de PDF comprueba el tercero propietario en la consulta de la factura. El catálogo nunca devuelve bancos, otros clientes ni el snapshot administrativo. `.local` se excluye de Git y del servidor de archivos de desarrollo.

La aplicación sigue siendo local y rechaza orígenes y hosts externos. La cuenta de negocio no equivale a verificación de identidad comercial y no concede crédito. No se enviaron correos ni se añadió facturación electrónica SUNAT. El registro B2C produce el documento nativo configurado en Dolibarr.

Validación: pruebas de registro B2B/B2C, inicio y revocación de sesión, aislamiento de documentos, bloqueo de APIs administrativas, compra concurrente sin duplicados, stock, cobro, anulación y cancelación sobre una copia aislada de la base. Los clientes y pedidos de prueba no se agregan a la base de trabajo.

## Registrar cobros de facturas

En Facturas, **Registrar pago** permite anotar un cobro ya recibido, completo o parcial, con importe, fecha, medio y cuenta de destino. No es una pasarela ni ejecuta transferencias. La página muestra el saldo pendiente considerando pagos, anticipos y créditos aplicados. Solo ofrece cobros para facturas estándar/sustitutivas validadas en la moneda de la empresa; las anuladas, cerradas o ya pagadas no admiten nuevos cobros. Las cuentas deben estar abiertas en la entidad y moneda correctas. Efectivo requiere una cuenta configurada como caja; el nombre de la cuenta por sí solo no determina su tipo.

`POST /api/pagos` mantiene la restricción al origen local y JSON de la integración. El adaptador `server/dolibarr-payment.php` verifica el permiso `facture.paiement` y `banque.modifier`, calcula de nuevo el saldo con objetos nativos y bloquea la factura durante la operación. `Paiement::create()` y `addPaymentToBank()` generan el pago, su vínculo y el movimiento de cuenta dentro de la misma transacción; `Facture::setPaid()` cierra la factura solamente cuando queda saldada. La fecha no puede ser futura ni anterior a la emisión. Se rechazan excesos de pago, saldos desactualizados, cuentas cerradas, medios inactivos y cobros automáticos pendientes. No se modifica el stock al pagar.

El UUID se persiste antes de enviar y se guarda como `ref_ext` del pago, con huella del contenido. La factura conserva un marcador adicional para impedir que un reintento recree un pago eliminado o modificado fuera del portal. Reintentos y solicitudes simultáneas recuperan el mismo pago; el bloqueo compartido coordina también la cancelación de pedidos. Un fallo en el movimiento bancario o en el cierre revierte toda la operación. El PDF se actualiza después del commit; si falla, se informa sin repetir el cobro. Se probó el flujo en una copia de la base, incluidos pagos parciales/completos, créditos, reintentos, concurrencia, cuenta cerrada, rollback y cancelación concurrente.

La aplicación consulta la base configurada en Dolibarr (`dolibarr_bimbo` en este equipo) y permite guardar pedidos con su factura vinculada y una salida de almacén completada que descuenta stock. Selecciona productos, abre Pedidos, elige un cliente y confirma el resumen. El servidor devuelve las referencias definitivas del pedido y la factura, que queda pendiente de pago. Ambos historiales se actualizan y la confirmación incluye enlaces a sus fichas y al PDF.

## Ejecutar

Requiere Node 24, PHP CLI con mysqli y el servidor MySQL de Dolibarr encendido.

```powershell
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

El backend de TanStack expone `GET /api/dolibarr`. Invoca `server/dolibarr-read.php` mediante `execFile`, sin shell, y lee las credenciales directamente del archivo de configuración local. Todas las consultas se ejecutan en una transacción de solo lectura. El archivo PHP no debe colocarse en `public` ni en `htdocs`.

Rutas predeterminadas, configurables mediante variables de entorno del proceso:

- `DOLIBARR_PHP_BINARY`: `C:/xampp/php/php.exe`
- `DOLIBARR_CONFIG_PATH`: `C:/xampp/htdocs/Dolibar/Bimbo/htdocs/conf/conf.php`
- `DOLIBARR_ENTITY`: `1`
- `DOLIBARR_WAREHOUSE_ID`: `1`, Planta Lima (producción). Debe estar activo en la entidad. La revisión muestra este almacén y consulta su saldo, sin sumar otros almacenes.
- `DOLIBARR_USER_ID`: `1` (administrador local; debe estar activo y tener permisos de creación y validación de pedidos, facturas, expediciones y movimientos de stock)

No guardar credenciales en variables `VITE_*`, código cliente o Git. Se eliminó la antigua clave y el enlace al túnel de Cloudflare del módulo cliente. No se ha revocado la clave remota, cuyo servidor no se administra desde este proyecto.

## Alcance

- Productos, categorías, stock por almacén, precios y lotes registrados.
- Facturas con filtros y paginación. `GET /api/dolibarr?documento=ID` sirve exclusivamente el PDF asociado a una factura de la entidad, dentro de la carpeta de documentos. IDs y rutas se validan.
- Pedidos y expediciones con sus estados reales; no se interpreta «validada» como «entregada».
- Totales históricos, bancos y datos de empresa disponibles exclusivamente para administración. La tienda usa consultas separadas por cliente; no calcula una línea de crédito individual.
- Stock expresado en la unidad registrada; si falta, se indica. No se inventan conversiones a planchas o paletas, imágenes, GPS, fechas de entrega ni caducidades.
- Recarga cada 30 segundos, al recuperar el foco y con el botón Actualizar. Los errores iniciales bloquean el contenido y permiten reintentar; un error de actualización marca la última consulta como desactualizada.

Esta integración es local. Los endpoints rechazan hosts no locales y solicitudes de otros orígenes. Mantener el servidor ligado a `127.0.0.1`. La autenticación y separación de cuentas están implementadas para este entorno; un despliegue público necesita adaptar la infraestructura y configuración de acceso, HTTPS y runtime Node/PHP. El despliegue Cloudflare original no puede ejecutar este adaptador local.

## Guardar pedidos

`POST /api/pedidos` exige Origin del mismo sitio, JSON y `X-Bimbo-Request: order`. El adaptador CLI `server/dolibarr-order.php` usa `Commande::create()` y `Commande::valid()`; `server/dolibarr-invoice.php` utiliza `Facture::create()`, `Facture::validate()` y `Commande::classifyBilled()`. El pedido, la factura, las líneas, el vínculo y sus validaciones se confirman en una única transacción; cualquier error revierte todo. La factura toma las líneas persistidas del pedido, conserva cliente, condiciones de pago e importes, y verifica igualdad de totales antes de confirmar. Verifica cliente activo, productos vendibles, cantidades, precio e impuesto vigentes y existencia física. El cliente envía el precio e impuesto vistos solo para detectar cambios; el servidor determina los valores reales.

Cada envío tiene un UUID persistido en el navegador antes de enviar, guardado como `ref_ext` del pedido y de la factura. Un bloqueo en MySQL serializa los envíos del portal. Repetir la misma solicitud devuelve el mismo pedido y la misma factura; cambiar el contenido con el mismo UUID se rechaza. Ante un corte de conexión, usa Reintentar el mismo envío. El carrito permanece bloqueado mientras se desconozca el resultado. Un envío pendiente de la versión anterior puede recuperar su pedido y generar la factura faltante; si ya existe otra facturación vinculada se detiene para evitar duplicados. No se factura retroactivamente el historial.

Los pedidos quedan cerrados y facturados; las facturas quedan validadas y sin pagar. `server/dolibarr-stock.php` crea, valida y cierra una `Expedition` nativa vinculada al pedido. Dolibarr registra movimientos de salida con origen `shipping`; no se restan saldos con SQL manual. La salida, los movimientos y todos los documentos se confirman en la misma transacción. Se bloquean las filas de producto y del saldo del almacén con `FOR UPDATE`, se comprueba existencia suficiente y se verifica la cantidad descontada antes del commit. Las cantidades fraccionarias se conservan. Los productos sin control de stock no generan movimientos; los lotes y kits que necesitan asignación especial se rechazan para gestionarlos en Dolibarr.

La gestión por lotes de esta instalación establece el descuento al cerrar expediciones. El portal exige exactamente un punto de descuento: `STOCK_CALCULATE_ON_SHIPMENT` o `STOCK_CALCULATE_ON_SHIPMENT_CLOSE`. Rechaza descuento por pedido o factura para evitar duplicarlo. No altera la configuración global. Se omiten triggers de cabecera de pedido y factura; la creación y el cierre de la expedición usan los triggers nativos. El pedido se cierra sin `ORDER_CLOSE` antes del cierre de expedición para evitar una segunda factura de workflow. No se registran pagos.

La nota privada guarda el identificador de almacén, la expedición y la cantidad de movimientos. Los reintentos recuperan la misma expedición y sus movimientos sin volver a descontar. Si faltan movimientos o la expedición fue reabierta, se exige revisión en Dolibarr. Los pedidos anteriores a esta función se recuperan con un aviso y sin descuento retroactivo. Se utiliza el precio nativo del nivel asignado al cliente, sin descuentos adicionales por cantidad ni multidivisa.

El PDF se genera con la plantilla de factura configurada en Dolibarr después de confirmar la transacción. Si falla, el pedido y la factura permanecen guardados y la respuesta muestra un aviso, sin crear duplicados. Un reintento con la misma solicitud puede regenerar el PDF faltante; también se puede generar desde la ficha de la factura. La descarga utiliza el endpoint existente y verifica que el archivo esté dentro del directorio de documentos.

Antes de activar la escritura se guardó un respaldo local y se probaron creación, validación, reintentos simultáneos, errores de precio/stock y reversión ante fallo de numeración en una copia aislada de la base. La facturación automática se probó además con cantidades fraccionarias, vínculo pedido-factura, estado sin pagar, fallo de validación de factura, recuperación del PDF y envíos pendientes anteriores. Las pruebas no añaden pedidos ni facturas a la base real.

## Verificar

```powershell
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Los totales se pueden cotejar directamente con Dolibarr. Con el respaldo importado: 55 productos, 98 terceros, 1440 facturas, 1440 pedidos, 1440 expediciones y 6 almacenes.

El descuento de stock se verifica en una copia aislada: cierre de expedición, movimientos por producto, reintentos simultáneos, stock insuficiente, competencia por las últimas unidades y rollback ante un fallo posterior al movimiento.

## Cancelar pedidos del portal

En Pedidos, el botón **Cancelar pedido** permite indicar el motivo y confirmar la devolución. `PATCH /api/pedidos` exige el mismo origen local y cabecera explícita que la creación. `server/dolibarr-cancel.php` usa la misma exclusión mutua y una transacción para devolver exactamente los movimientos de salida al almacén original, cancelar la expedición y el pedido, y anular la factura mediante `Facture::setCanceled()` (estado nativo 3, abandonada/anulada). Las entradas se crean con `MouvementStock::reception()`, vinculadas a la expedición y agrupadas con `WEB-CANCEL-ID`.

Se conserva el historial, las líneas y los archivos originales. No se usa `Expedition::cancel()` porque esta versión elimina sus líneas y PDF: se actualiza su estado con el método nativo `setStatusCommon()` tras devolver las existencias. El pedido se marca no facturado y cancelado con los métodos nativos. El motivo, actor, fecha y resultado se guardan en las notas; la factura registra el motivo de cierre. La página no ofrece el PDF de una factura anulada como documento vigente.

Los reintentos, incluso simultáneos, recuperan los mismos movimientos de entrada. El navegador guarda una cancelación pendiente para recuperarla tras recargar. Un reenvío de creación sobre un pedido cancelado se rechaza; nunca lo recrea ni descuenta otra vez. Si falla un paso, se revierten stock y estados de todos los documentos.

Alcance: pedidos creados por el portal con el marcador de descuento trazable, una sola factura estándar validada sin pagos, créditos, anticipos, reemplazos, exportación o asientos contables. Se verifican las cantidades, importes, almacén y documentos originales. Las modificaciones externas, lotes/kits o entregas vinculadas requieren revisión en Dolibarr. Los pedidos históricos importados no se cancelan automáticamente. No se registran reembolsos ni se elimina información. Este flujo se ejecuta al cancelar **desde la página**; no instala triggers globales para cancelaciones hechas directamente en Dolibarr.

## Historial de pagos y PDF de factura

En Facturas, **Ver historial** abre los cobros de la factura (referencia, fecha, importe aplicado, medio, cuenta y número de operación), ordenados del más reciente al más antiguo. Muestra total, pagos recibidos, créditos aplicados y saldo pendiente. Los pagos que cubren varias facturas muestran solo la parte asignada a la factura consultada. No se exponen notas internas ni credenciales. La consulta se actualiza al abrir, cada 30 segundos y con Actualizar historial.

`GET /api/dolibarr?historial=ID` ejecuta una transacción de solo lectura y restringe factura, pagos y cuentas a la entidad configurada. Devuelve 404 si no existe, 400 para identificadores inválidos o modos incompatibles y conserva la restricción de origen local.

La pestaña **Ver PDF** muestra el PDF existente dentro de la página y ofrece abrirlo aparte. El adaptador primero busca `last_main_doc` y, para respaldos importados con rutas antiguas, busca exclusivamente `facture/REFERENCIA/REFERENCIA.pdf` bajo la carpeta configurada. Valida la ruta real, extensión y tamaño; no acepta rutas desde el navegador ni busca archivos por coincidencias parciales. Los PDF de facturas anuladas siguen sin ofrecerse como documentos vigentes. Este flujo no altera pagos, facturas ni archivos.

El visor usa PDF.js 6.5.438, cargado bajo demanda, con páginas, zoom y descarga. El worker se empaqueta localmente; fuentes, CMaps y WASM residen en public/pdfjs y deben actualizarse junto con pdfjs-dist. No usa servicios externos para procesar las facturas.


## Anular pagos

En el historial de cada factura, **Anular pago** exige un motivo y una confirmación. `PATCH /api/pagos` usa el mismo origen local, cabecera y mutex que pedidos y cobros. Verifica el identificador del pago, su huella, el saldo actual y los permisos antes de escribir. La transacción usa `Facture::setUnpaid()` y `Paiement::delete()` para retirar el cobro y su movimiento bancario nativo, sin alterar el stock. Reabre las facturas pagadas y comprueba el incremento exacto del saldo.

La nota privada de la factura guarda una constancia legible y el marcador `portal-payment-void-v1` con el pago original, fecha, usuario, motivo y solicitud. El historial muestra esos pagos como anulados, excluidos del total cobrado. La solicitud pendiente se conserva en el navegador y los reintentos no repiten la operación. Se mantienen los marcadores del cobro original para impedir que un reintento antiguo lo recree. El PDF se actualiza después del commit; un fallo de PDF se comunica sin repetir la anulación.

Se rechazan pagos repartidos entre varias facturas, validados/exportados, procedentes de pasarelas externas, en otra moneda, con cuenta cerrada, conciliados, contabilizados, incluidos en remesas o con vínculos bancarios ajenos. Se bloquean también facturas anuladas, cerradas sin pago, de tipos no admitidos o con asientos contables. Las comprobaciones se repiten dentro de la transacción, aunque el navegador haya mostrado el botón. Esta es una corrección del registro de cobro: no ejecuta un reembolso bancario.

## Tarifas normal B2C y mayorista B2B

Se habilita el modo nativo **precios por segmento**: `PRODUIT_MULTIPRICES=1`, con dos niveles. Nivel 1 **Normal B2C** conserva los importes anteriores. Nivel 2 **Mayorista B2B** se inicializa con el descuento del 10% aprobado por el usuario, calculado sobre el importe sin IGV y redondeado a dos decimales. Los 15 materiales sin precio siguen sin precio de venta online. No se alteran documentos anteriores ni se aplica otro 10% al crear el pedido.

Administración gestiona los importes en **Productos → ficha del producto → Precios de venta** y el nivel de cada tercero en su ficha comercial de Dolibarr. Los precios quedan guardados por producto y nivel; el 10% es solo la carga inicial, no una fórmula automática: cambiar el precio normal después no recalcula el mayorista. No se anuncia un porcentaje fijo en la tienda.

Los registros nuevos B2C reciben nivel 1; B2B, nivel 2, mediante `Societe::setPriceLevel()` y su historial nativo. La migración asigna nivel 2 a los clientes empresariales importados del proyecto; respeta particulares `TE_PRIVATE` y cuentas de tienda marcadas B2C. Posteriormente manda el nivel nativo asignado por administración, incluso si difiere del canal de registro. El canal B2B/B2C se conserva para la presentación y el análisis de procedencia.

`server/dolibarr-pricing.php` centraliza `Product::getSellPrice()`: catálogo, revisión del pedido de administración y creación de líneas consultan el mismo precio e impuesto. El catálogo de un visitante permite previsualizar cada segmento; al iniciar sesión usa el tercero de la sesión y aplica `portalCustomerForChannel()` tanto al catálogo como al pedido. Hogar usa nivel 1 sin modificar el tercero; negocio respeta su nivel asignado. Solo un administrador puede consultar `GET /api/tienda?clienteId=ID`. La caché de React distingue sesión, canal y nivel; se refresca cada 30 segundos y al recuperar el foco. El checkout vuelve a leer el nivel/precio bajo bloqueo transaccional y devuelve 409 si el precio visto ya no coincide. Un reintento de un pedido ya guardado recupera su importe original, aunque luego cambie la tarifa.

El modo soportado es precio único o por segmento. Si se activa una regla incompatible (por cantidad, por cliente o combinada), el adaptador detiene la compra y consulta en lugar de aplicar un importe incorrecto. La tarifa de nivel 2 aplica el mínimo monetario de la siguiente sección; no hay mínimos por número de unidades.

## Mínimo para acceder a la tarifa mayorista

El mínimo inicial aprobado es **S/ 100 sin IGV**, sumando las líneas del pedido a sus precios mayoristas vigentes y redondeando cada importe de línea a céntimos. La comparación es inclusiva: alcanzar exactamente el mínimo habilita el nivel 2. Por debajo se aplica el nivel 1 a todo el pedido, permitiendo comprar a precio normal. No se suman impuestos ni cargos de entrega. B2C no está sujeto a esta condición.

Se configura en **Dolibarr → Inicio → Configuración → Otros ajustes** (`admin/const.php`), en la constante visible **`BIMBO_B2B_MIN_SUBTOTAL_HT`**. El valor es un importe en la moneda de la empresa, con hasta dos decimales (punto o coma decimal, sin separadores de miles). `0` desactiva el mínimo. La página de pedidos de administración incluye un enlace al editor de Dolibarr. El portal solo lee esta configuración; no mantiene otra copia editable del importe. Los valores inválidos detienen las consultas y compras B2B hasta corregir la configuración.

La tienda muestra el precio normal mientras el carrito no alcance el mínimo y el precio mayorista condicionado como referencia. Un aviso indica cuánto falta; catálogo, carrito y revisión administrativa cambian la tarifa al añadir o retirar productos. El navegador calcula la presentación con los datos de Dolibarr; el adaptador vuelve a comprobar la regla, las cantidades y los precios antes de guardar. Nunca acepta del navegador un total, un mínimo o un nivel de tarifa como autoridad. Si cambió la condición y el importe visto ya no coincide, devuelve 409 y permite revisar antes de reenviar. Los reintentos de un pedido ya confirmado conservan sus importes originales.

El pedido y la factura guardan `portal-pricing-v1` con nivel asignado/aplicado, mínimo y subtotal mayorista usado. Los documentos históricos no se recalculan. La regla se aplica a pedidos creados desde esta web (tienda y panel); no modifica el núcleo de Dolibarr ni añade validaciones a documentos creados manualmente desde sus pantallas nativas.

El instalador CLI `server/configure-wholesale-minimum.php --apply NOMBRE_EXACTO_BD IMPORTE` usa `dolibarr_set_const()` y exige el administrador de integración; está bloqueado por HTTP. Las pruebas cubren pedidos debajo, iguales y encima del umbral, mezcla de productos, IGV excluido, cambios de configuración, manipulación de precios, facturación, cancelación y reintentos. Se ejecutan contra una copia aislada.

## Acceso de clientes importados

El 12/11/2026 se habilitaron, por solicitud del usuario, 80 usuarios externos vinculados individualmente a los 80 clientes importados. Sus logins son `cliente_` seguido del ID del tercero con al menos cuatro dígitos (por ejemplo, `cliente_0001`). No se duplicaron terceros ni se modificaron sus pedidos, facturas, tarifas, pagos o stock. Los 80 clientes importados tienen correos de demostración basados en su razón social, con dominio `clientes.bimbo.test`, guardados en `llx_user.email` y `llx_societe.email`. Pueden iniciar sesión por correo o con su login anterior. Estos correos no son buzones reales y no reciben mensajes; las contraseñas no cambiaron. Las cuentas nuevas creadas desde el registro público conservan su propio flujo de alta.

`server/configure-wholesale.php` es una migración CLI de una sola ejecución. Requiere respaldo previo, `--apply NOMBRE_EXACTO_BD 10`, y usa `Product::updatePrice()`, `Societe::setPriceLevel()` y constantes nativas. Guarda un marcador para no sobrescribir tarifas posteriores. Comprueba que el nivel 1 conserve su precio, mínimo e impuesto; usa transacción y el bloqueo de pedidos del portal. Nunca se invoca desde HTTP. Las pruebas en una copia aislada verifican ambos niveles, facturas, rechazo de precios manipulados u obsoletos, cambios desde Dolibarr, reintentos y ausencia de cambios en la base habitual.


La provisión se realiza con `server/provision-customer-users.php --apply NOMBRE_EXACTO_BD RUTA_PRIVADA_TXT`: genera una contraseña aleatoria individual, usa `User::create()` y `User::setPassword()`, vincula `fk_soc` y retira derechos/grupos por defecto. Verifica los 80 logins nativos antes de confirmar la transacción. No concede permisos administrativos, no envía correos ni reinicia contraseñas existentes. Rechaza usuarios ya vinculados y archivos de salida existentes, y está bloqueado por HTTP. La configuración exige almacenamiento de contraseñas hash. El portal autentica la cuenta externa y limita consultas y PDF al tercero de la sesión.

Las credenciales se entregaron en un archivo privado de Descargas, fuera de la web y del repositorio; no deben copiarse a este proyecto. La carpeta tiene acceso limitado al usuario local, administradores y SYSTEM. Si se requiere recuperar una contraseña posteriormente, se debe restablecer la de ese usuario de forma explícita; el instalador no sobrescribe las cuentas ni recupera contraseñas desde el hash. Las comprobaciones verificaron el historial completo de las 80 cuentas y accesos HTTP de muestra, incluyendo denegación del panel administrativo y de PDF ajenos.


El catálogo muestra el acceso a pedidos y facturas para clientes autenticados, administración para administradores y registro solo para visitantes con sesión comprobada. El selector permite hogar a cuentas de negocio; las facturas siguen a nombre del tercero registrado y el carrito lo informa. La asignación de correos no crea tablas, usuarios adicionales ni proveedores de correo. El archivo privado de credenciales se actualizó con los correos.

Validación de esta revisión: TypeScript, compilación Vite, pruebas de carrito y prueba aislada de pedidos/facturas hogar, negocio con mínimo, negocio bajo mínimo, reintentos idempotentes y rechazo de precio alterado o elevación B2C. Se verificó el login nativo de los 80 correos y la navegación autenticada en la web.


## Ventas B2B y B2C en administración

El panel permite filtrar por canal y fechas, comparar importes netos sin impuestos, ver series mensuales y consultar las últimas facturas. Las listas de facturas y pedidos incluyen el filtro y una etiqueta del canal. El filtro no modifica documentos ni precios. Los importes excluyen borradores, anuladas y proformas; las notas de crédito conservan el signo nativo. Las tarjetas de cada canal comparan el período completo y el total seleccionado, gráfico y lista responden al canal elegido.

`server/sales-channel.php` da prioridad al canal `portal-store-v1` guardado en el documento, después a documentos vinculados coherentes (pedido o factura origen), y finalmente al perfil actual del cliente (marcador de registro, particular/empresa o tarifa mayorista nivel 2). La respuesta expone `canal` y `fuenteCanal`. Los vínculos de distintos canales quedan sin clasificar. La inferencia desde el cliente se muestra como «Según cliente actual» y no pretende reconstruir un canal histórico no registrado. En la comprobación del 12/11/2026, las 1.440 facturas existentes carecían de canal; se clasificaron B2B según los 80 clientes con tarifa 2. B2C se muestra en cero hasta que existan ventas reales del canal. Una compra hogar de una cuenta empresarial conserva B2C por el marcador del documento.

Pruebas: `node --experimental-strip-types --test tests/sales.test.mjs tests/dolibarr.test.mjs` y `C:/xampp/php/php.exe tests/sales-channel.test.php`, además de TypeScript, compilación Vite y reconciliación de la lectura nativa.

## Pasarela ficticia B2C

En **Mi cuenta → Mis facturas → Pagar factura DEMO**, un cliente B2C puede simular el pago completo del saldo de una factura validada propia. Ofrece tarjeta de prueba precargada, Yape y Plin con QR ficticio y código `123456`, revisión del total, confirmación explícita y comprobante con la referencia nativa. El rechazo de demostración no registra un pago. No hay conexión a proveedores, cobros reales, datos bancarios del cliente ni webhooks. El QR solo codifica texto de demostración.

`POST /api/pago-cliente` requiere sesión B2C, origen local, JSON y cabecera de tienda. Solo recibe factura, método, saldo esperado y UUID; rechaza identidad, cuenta bancaria, importe arbitrario o datos de tarjeta. El servidor obtiene el usuario de la sesión y comprueba nuevamente usuario activo, cliente, entidad y propiedad de la factura dentro de la transacción. Reutiliza los métodos nativos y bloqueos de `dolibarr-payment.php` mediante el modo CLI `customer-demo`. La API administrativa conserva sus restricciones.

El pago, su vínculo a la factura y movimiento se registran nativamente en Dolibarr, identificados como **DEMO / SIMULACION SIN DINERO REAL**. La factura queda pagada al saldarse, su PDF se actualiza y el cliente ve su historial. Los movimientos usan exclusivamente la cuenta **WEB-DEMO — Pasarela DEMO - sin dinero** y los medios `DEMCB`, `DEMYAP`, `DEMPLN`. Administración puede anularlos con el flujo existente; un reintento antiguo nunca recrea un pago anulado. El UUID persistido por usuario evita duplicados por recarga, doble clic, concurrencia o respuesta perdida. No se modifica stock al pagar.

Configuración inicial idempotente: `C:/xampp/php/php.exe server/configure-demo-payments.php --apply NOMBRE_EXACTO_BD`. Crea la cuenta y medios de simulación sin modificar los existentes. En **Dolibarr → Configuración → Otros ajustes**, `BIMBO_DEMO_PAYMENTS_ENABLED=1` habilita el flujo; `0` lo deshabilita. `BIMBO_DEMO_PAYMENT_ACCOUNT_ID` señala la cuenta WEB-DEMO; el adaptador exige que esté abierta, sea de la entidad y moneda configuradas y conserve su referencia de simulación. No debe apuntar a cuentas reales.

Pruebas de contrato: `node --experimental-strip-types --test tests/customer-payments.test.mjs tests/payments.test.mjs`. Se verificaron además en una copia aislada los tres medios, concurrencia, reintentos, anulación y nuevo pago, saldo cero, historial, compatibilidad del cobro administrativo y rechazo de sesiones ajenas, B2B, orígenes distintos y parámetros manipulados. La revisión visual completó un pago Yape en esa copia. Se respaldó la base y se comprobó que la habilitación en la base habitual mantuviera intactos pedidos, facturas, pagos, stock y cuentas reales. La factura IN2611-1441 se dejó pendiente para la prueba del usuario.
## Presentación de pagos para el curso

Por decisión del usuario, la web presenta todos los pagos registrados juntos. Facturas conserva el filtro por método, resume los importes aplicados por método y muestra un único total de pagos vigentes. El historial mantiene método, fecha, cuenta, referencia, importe y anulación. Los pagos anulados se excluyen. La cuenta WEB-DEMO se presenta como «Pagos de la tienda»; las etiquetas y avisos de demostración se omiten en las vistas.

La pasarela muestra tarjeta, Yape y Plin, confirmación, pago aprobado, comprobante y saldo actualizado. Conserva tarjeta precargada de solo lectura y código local 123456; no solicita tarjetas reales ni se conecta a proveedores. Esto cambia la presentación académica, no convierte la simulación en una pasarela bancaria. Los códigos DEMO, notas, UUID, cuenta nativa e indicadores internos se conservan para trazabilidad e idempotencia. Los pagos históricos no se reescriben.

La presentación usa payment-presentation.ts para nombres e importes agrupados. Conserva la consulta administrativa protegida y todos los controles de propiedad, saldo y reintentos. TypeScript, compilación y consultas de reconciliación verifican que no se pierde ni duplica ningún importe.


## Asistente de tienda y administración (OpenAI)

Configuración: abre .local/openai.env en la raíz del proyecto y completa OPENAI_API_KEY= con tu clave, sin comillas ni espacios. No uses prefijos VITE_. Ya está excluido de Git y bloqueado por Vite. También se pueden usar variables de entorno del servidor (tienen prioridad). OPENAI_MODEL=gpt-4.1-mini y CHAT_DAILY_MESSAGES=60 son los valores iniciales. Se lee en cada consulta, sin reiniciar. Reinicia solo si cambias variables del proceso. No pegues la clave en el chat, código frontend o navegador.

La tienda requiere iniciar sesión para controlar consumo y consultar exclusivamente documentos de la cuenta. El asistente de administración permite productos, clientes por código/ID/nombre, pedidos/facturas y los 10 reportes. Las búsquedas y los reportes son de lectura; nunca recibe SQL ni comandos del modelo. Las búsquedas se acotan y los documentos muestran enlaces generados por el servidor. No se envían contraseñas, claves ni el volcado completo de la BD. Los mensajes y los resultados necesarios se envían a OpenAI para responder, usando Responses API con store:false (no implica ausencia total de retención del proveedor). El historial del chat se mantiene solo en memoria del navegador y se limpia al cambiar cuenta/canal o recargar.

La tarifa se determina con la sesión y el carrito: el cliente B2C no puede elevarse a B2B. Los pedidos y facturas del cliente se obtienen con el usuario autenticado. Los permisos se comprueban antes de cada consulta, además de limitar las herramientas por rol. Administración usa los mismos cálculos de reportes que el panel; no confundir cierre de pedido con entrega.

Consumo: máximo 1000 caracteres por pregunta, 6 mensajes de contexto, 900 tokens de salida por llamada, hasta 3 llamadas por pregunta, 6 preguntas por minuto/cuenta y 1 consulta simultánea/cuenta. CHAT_DAILY_MESSAGES=0 desactiva el límite diario local (configuración actual). Un valor de 1 a 1000 limita mensajes globales diarios, con contador compartido en .local/chat-usage.json y fecha de Lima, incluso después de reiniciar. No es un tope monetario; comprueba también Usage/Billing de tu proyecto OpenAI. Los errores consumen una reserva para evitar reintentos ilimitados. No hay reintentos automáticos de OpenAI.

Verificación: node --experimental-strip-types --test tests/chat.test.mjs. Pruebas con transporte simulado, sin gastar saldo, cubren permisos, alcance por cliente, tarifas, reportes, inyección de herramientas y límite diario. Para la prueba real añade tu clave y abre Asistente: consulta un SKU, un pedido propio, un código de cliente desde admin y el resumen del mes. Revisa los resultados contra los documentos y el reporte del panel.

Documentación oficial: https://developers.openai.com/api/docs/guides/function-calling y https://developers.openai.com/api/docs/models/gpt-4.1-mini .


## Medición del chatbot

Administración → Consumo del chatbot (/admin/chatbot). Endpoint /api/chat-metricas requiere sesión admin y POST con protección de origen para actualizar referencia de saldo. Registros en .local/chat-metrics.json, protegidos por bloqueo entre procesos y reemplazo atómico. No se guardan prompts, respuestas ni claves. Se contabiliza cada intento de consulta aceptado y cada llamada, incluidos tokens de respuestas incompletas y costos previos a errores. Los límites rechazados antes de ejecutar no son consultas procesadas.

Costo estimado USD: tarifa estándar GPT-4.1 mini / snapshot 2025-04-14, verificada 2026-11-13; entrada 0.40, caché 0.10, salida 1.60 USD por millón. Costo por llamada congelado en nanodólares. Entrada incluye caché; no se suma dos veces. Otros modelos/tarifas o errores sin usage quedan sin costo confirmado, nunca un cero confirmado. service_tier=default evita estimar tarifas Priority/Flex como estándar.

La medición empieza al activarse. El contador anterior del cupo se conserva como referencia, no se inventan tokens históricos. El saldo de OpenAI no se consulta con la clave normal: el admin puede registrar una referencia del portal y restar el gasto local posterior. Si hay llamadas sin precio/uso o cruzando el momento de la referencia, el saldo queda sin confirmar. Los filtros no alteran el saldo global. No incluye otras aplicaciones, impuestos, recargas o caducidad; consultar Usage/Billing oficial. Nunca se presume que la antigua recarga de USD 5 siga íntegra.

Fuente: https://developers.openai.com/api/docs/models/gpt-4.1-mini .

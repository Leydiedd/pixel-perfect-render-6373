# Plataforma mayorista Bimbo (prototipo)

Tienda B2B para gerentes de compras de supermercados, con datos de ejemplo. Estilo corporativo Bimbo: blanco dominante, rojo Bimbo, azul marino de contraste, mucho espacio libre y fotos reales de panadería (Unsplash/Pexels, sin clave).

## Pantallas

**1. Inicio / Catálogo (página principal)**
- Barra superior con el nombre del supermercado, crédito disponible y resumen de órdenes activas (en preparación, en tránsito, entregado).
- Buscador por nombre o código SKU, filtros por familia (pan de molde, bollería, integrales, tortillas).
- Tarjetas limpias: foto, nombre, SKU, precio por plancha/paleta, selector de cantidad. Sin ventanas emergentes de publicidad.
- Aviso en línea cuando la cantidad supera el stock de planta o no llega al mínimo por paleta.

**2. Ficha de producto**
- Galería, descripción, presentación (unidades por plancha, planchas por paleta), precios escalonados por volumen, lotes con fecha de caducidad y stock.
- Botón de añadir al pedido con la misma validación de mínimos y stock.

**3. Pedido en curso**
- Lista tipo hoja de cálculo: edición rápida de cantidades, totales por línea y aviso de "Deshacer" al quitar una línea.
- Resumen con importe, crédito restante y fecha estimada de entrega.

**4. Pedido rápido y plantillas**
- Formulario de entrada por teclado: pegar o escribir varias líneas "SKU, cantidad" y validarlas de golpe, mostrando cuáles no existen.
- Botón "Repetir último pedido" y plantillas de abastecimiento mensual (aplicar con un clic).
- Campo preparado para lector de código de barras (el lector escribe el SKU y salta a la siguiente línea).

**5. Soporte**
- Facturas y notas de crédito descargables (ejemplo), estado de pago.
- Ficha del ejecutivo de cuenta asignado y panel de chat simulado.
- Preguntas frecuentes sobre pedidos mínimos, entregas y devoluciones.

## Terminología
Se usa lenguaje del sector: SKU, plancha, paleta, lote, pedido mínimo, crédito. Nada de "carrito de compras".

## Detalles técnicos
- TanStack Start + Tailwind. Rutas: `/` (catálogo), `/producto/$sku`, `/pedido`, `/pedido-rapido`, `/soporte`; cabecera compartida en el layout raíz.
- Catálogo, plantillas, órdenes y facturas en un módulo de datos de ejemplo (`src/data/`), con URLs de fotos de Unsplash/Pexels por producto.
- Estado del pedido en un contexto de React con persistencia en el navegador; acción de deshacer con notificación (sonner).
- Colores Bimbo añadidos como tokens semánticos en `src/styles.css` (no colores sueltos en los componentes).
- Cada página con su propio título y descripción para compartir enlaces.

## Fuera de alcance
Sin inicio de sesión ni base de datos: es un prototipo navegable con datos simulados. Se puede añadir después.

export type Familia = "Pan de molde" | "Bollería" | "Integrales";

export type Lote = {
  lote: string;
  caducidad: string;
  planchas: number;
};

export type EscalaPrecio = {
  desdePlanchas: number;
  precio: number;
};

export type Producto = {
  sku: string;
  nombre: string;
  familia: Familia;
  descripcion: string;
  unidadesPorPlancha: number;
  planchasPorPaleta: number;
  minimoPlanchas: number;
  stockPlanchas: number;
  precios: EscalaPrecio[];
  lotes: Lote[];
  imagenes: string[];
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80`;

const todosLosProductos: Producto[] = [
  {
    sku: "BIM-PB-680",
    nombre: "Pan Blanco Grande 680 g",
    familia: "Pan de molde",
    descripcion:
      "Pan de molde blanco de rotación alta, formato familiar. Rebanada uniforme y miga suave, ideal para góndola principal.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 40,
    minimoPlanchas: 5,
    stockPlanchas: 320,
    precios: [
      { desdePlanchas: 1, precio: 28.9 },
      { desdePlanchas: 20, precio: 27.4 },
      { desdePlanchas: 40, precio: 26.1 },
    ],
    lotes: [
      { lote: "L-2409A", caducidad: "2026-10-12", planchas: 180 },
      { lote: "L-2409B", caducidad: "2026-10-18", planchas: 140 },
    ],
    imagenes: [img("photo-1509440159596-0249088772ff"), img("photo-1549931319-a545dcf3bc73")],
  },
  {
    sku: "BIM-PI-600",
    nombre: "Pan Integral 100% 600 g",
    familia: "Integrales",
    descripcion:
      "Harina integral de grano entero, alto en fibra. Producto de crecimiento sostenido en canal supermercado.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 40,
    minimoPlanchas: 5,
    stockPlanchas: 210,
    precios: [
      { desdePlanchas: 1, precio: 33.5 },
      { desdePlanchas: 20, precio: 31.8 },
      { desdePlanchas: 40, precio: 30.2 },
    ],
    lotes: [
      { lote: "L-2411C", caducidad: "2026-10-09", planchas: 90 },
      { lote: "L-2411D", caducidad: "2026-10-20", planchas: 120 },
    ],
    imagenes: [
      "/__l5e/assets-v1/0cd15cc2-9714-4bfa-b098-b31b23071199/pan-pita-integral-bimbo-300g.jpg",
      img("photo-1598373182133-52452f7691ef"),
    ],
  },
  {
    sku: "BIM-MN-240",
    nombre: "Medias Noches 8 unidades",
    familia: "Bollería",
    descripcion:
      "Pan suave para sándwich y refrigerio. Alta rotación en horarios de tarde y fechas escolares.",
    unidadesPorPlancha: 10,
    planchasPorPaleta: 36,
    minimoPlanchas: 4,
    stockPlanchas: 148,
    precios: [
      { desdePlanchas: 1, precio: 24.2 },
      { desdePlanchas: 15, precio: 23.1 },
      { desdePlanchas: 36, precio: 21.9 },
    ],
    lotes: [{ lote: "L-2402M", caducidad: "2026-10-07", planchas: 148 }],
    imagenes: [img("photo-1555507036-ab1f4038808a"), img("photo-1517686469429-8bdb88b9f907")],
  },
  {
    sku: "BIM-PL-500",
    nombre: "Pan Lactal Sándwich 500 g",
    familia: "Pan de molde",
    descripcion:
      "Formato sándwich sin corteza, orientado a foodservice y minimarkets con oferta de comida preparada.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 40,
    minimoPlanchas: 5,
    stockPlanchas: 260,
    precios: [
      { desdePlanchas: 1, precio: 26.8 },
      { desdePlanchas: 20, precio: 25.5 },
      { desdePlanchas: 40, precio: 24.3 },
    ],
    lotes: [
      { lote: "L-2420L", caducidad: "2026-10-14", planchas: 160 },
      { lote: "L-2420M", caducidad: "2026-10-22", planchas: 100 },
    ],
    imagenes: [
      "/__l5e/assets-v1/891fb3d5-619a-4575-9a90-5a1baf09a90c/pan-lactal-blanco-bimbo-610g.webp",
      img("photo-1608198093002-ad4e005484ec"),
    ],
  },
  {
    sku: "BIM-BD-300",
    nombre: "Bollos para Hamburguesa 6 unidades",
    familia: "Bollería",
    descripcion:
      "Bollo con ajonjolí, diámetro estándar 10 cm. Pico de demanda en fines de semana y campañas de parrilla.",
    unidadesPorPlancha: 8,
    planchasPorPaleta: 32,
    minimoPlanchas: 4,
    stockPlanchas: 74,
    precios: [
      { desdePlanchas: 1, precio: 22.9 },
      { desdePlanchas: 16, precio: 21.7 },
      { desdePlanchas: 32, precio: 20.4 },
    ],
    lotes: [{ lote: "L-2431H", caducidad: "2026-10-06", planchas: 74 }],
    imagenes: [
      "/__l5e/assets-v1/eb5bdfa0-9537-47d6-936c-406844c6887e/pan-hamburguesa-bimbo-8unid.jpg",
      img("photo-1571091718767-18b5b1457add"),
    ],
  },
  {
    sku: "BIM-PC-380",
    nombre: "Pan de Centeno Artesanal 380 g",
    familia: "Integrales",
    descripcion:
      "Masa madre con centeno, vida útil corta. Recomendado para tiendas con alta rotación de panificados premium.",
    unidadesPorPlancha: 10,
    planchasPorPaleta: 30,
    minimoPlanchas: 3,
    stockPlanchas: 48,
    precios: [
      { desdePlanchas: 1, precio: 41.5 },
      { desdePlanchas: 12, precio: 39.8 },
      { desdePlanchas: 30, precio: 37.9 },
    ],
    lotes: [{ lote: "L-2444R", caducidad: "2026-10-05", planchas: 48 }],
    imagenes: [
      "/__l5e/assets-v1/194bbbf1-f09b-4e04-a034-0bba9718d937/pan-artesano-integral-bimbo-560g.webp",
      img("photo-1595535873420-a599195b3f4a"),
    ],
  },
  {
    sku: "BIM-DN-250",
    nombre: "Donas Glaseadas 4 unidades",
    familia: "Bollería",
    descripcion:
      "Dona clásica glaseada en empaque individual por cuatro. Producto de impulso en zona de cajas.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 36,
    minimoPlanchas: 4,
    stockPlanchas: 132,
    precios: [
      { desdePlanchas: 1, precio: 27.3 },
      { desdePlanchas: 18, precio: 26.0 },
      { desdePlanchas: 36, precio: 24.8 },
    ],
    lotes: [{ lote: "L-2450D", caducidad: "2026-10-11", planchas: 132 }],
    imagenes: [img("photo-1551024601-bec78aea704b"), img("photo-1533134242443-d4fd215305ad")],
  },
  {
    sku: "BIM-NT-015",
    nombre: "Chocolate Nito 15 unidades",
    familia: "Bollería",
    descripcion:
      "Empaque individual de Nito, pan con cobertura de chocolate. Producto de impulso para caja, kioscos y refrigerios escolares.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 36,
    minimoPlanchas: 4,
    stockPlanchas: 186,
    precios: [
      { desdePlanchas: 1, precio: 34.9 },
      { desdePlanchas: 18, precio: 33.2 },
      { desdePlanchas: 36, precio: 31.5 },
    ],
    lotes: [
      { lote: "L-2462N", caducidad: "2026-11-08", planchas: 120 },
      { lote: "L-2462P", caducidad: "2026-11-22", planchas: 66 },
    ],
    imagenes: [
      "/__l5e/assets-v1/ba5e8d79-72a9-423d-a646-f80b9fb7fed3/bimbo-nito-2.19oz-15pack.jpg",
      img("photo-1549007994-cb92caebd54b"),
    ],
  },
  {
    sku: "BIM-PD-700",
    nombre: "Pan Doble Fibra 700 g",
    familia: "Integrales",
    descripcion:
      "Doble aporte de fibra, posicionamiento saludable. Buen desempeño en tiendas de perfil urbano.",
    unidadesPorPlancha: 12,
    planchasPorPaleta: 40,
    minimoPlanchas: 5,
    stockPlanchas: 154,
    precios: [
      { desdePlanchas: 1, precio: 35.9 },
      { desdePlanchas: 20, precio: 34.2 },
      { desdePlanchas: 40, precio: 32.5 },
    ],
    lotes: [{ lote: "L-2470F", caducidad: "2026-10-16", planchas: 154 }],
    imagenes: [img("photo-1534620808146-d33bb39128b2"), img("photo-1581929955747-1e0a8e05d2b7")],
  },
];

const nombresOficiales: Record<string, string> = {
  "BIM-PI-600": "Pan Pita Integral Bimbo 300 g",
  "BIM-PC-380": "Pan de Molde Bimbo Artesano Integral 560 g",
  "BIM-BD-300": "Pan para Hamburguesa Bimbo 8 unidades",
  "BIM-NT-015": "Chocolate Nito Bimbo 15 unidades",
};

export const productos: Producto[] = todosLosProductos
  .filter((p) => p.sku in nombresOficiales)
  .map((p) => ({ ...p, nombre: nombresOficiales[p.sku] ?? p.nombre }));

export const familias: Familia[] = ["Pan de molde", "Bollería", "Integrales"];

export function buscarProducto(sku: string) {
  const clave = sku.trim().toUpperCase();
  return productos.find((p) => p.sku.toUpperCase() === clave);
}

export function precioPorVolumen(producto: Producto, planchas: number) {
  const escala = [...producto.precios]
    .sort((a, b) => a.desdePlanchas - b.desdePlanchas)
    .filter((e) => planchas >= e.desdePlanchas)
    .pop();
  return escala?.precio ?? producto.precios[0]?.precio ?? 0;
}

export type Plantilla = {
  id: string;
  nombre: string;
  descripcion: string;
  lineas: { sku: string; planchas: number }[];
};

export const plantillas: Plantilla[] = [
  {
    id: "abastecimiento-mensual",
    nombre: "Abastecimiento mensual",
    descripcion: "Surtido base de rotación constante para tienda estándar.",
    lineas: [
      { sku: "BIM-PB-680", planchas: 40 },
      { sku: "BIM-PL-500", planchas: 20 },
      { sku: "BIM-PI-600", planchas: 20 },
      { sku: "BIM-MN-240", planchas: 12 },
    ],
  },
  {
    id: "fin-de-semana",
    nombre: "Refuerzo fin de semana",
    descripcion: "Parrilla, sándwich e impulso para viernes a domingo.",
    lineas: [
      { sku: "BIM-BD-300", planchas: 16 },
      { sku: "BIM-DN-250", planchas: 10 },
    ],
  },
  {
    id: "saludables",
    nombre: "Línea saludable",
    descripcion: "Integrales y fibra para tiendas de perfil urbano.",
    lineas: [
      { sku: "BIM-PI-600", planchas: 24 },
      { sku: "BIM-PD-700", planchas: 20 },
      { sku: "BIM-PC-380", planchas: 6 },
    ],
  },
];

export const ultimoPedido = {
  folio: "PD-20894",
  fecha: "2026-09-15",
  lineas: [
    { sku: "BIM-PB-680", planchas: 45 },
    { sku: "BIM-PL-500", planchas: 24 },
    { sku: "BIM-MN-240", planchas: 12 },
    { sku: "BIM-DN-250", planchas: 8 },
  ],
};

export type EstadoOrden = "En preparación" | "En tránsito" | "Entregado";

export const ordenesActivas: { folio: string; estado: EstadoOrden; planchas: number; total: number; entrega: string }[] =
  [
    { folio: "PD-20941", estado: "En preparación", planchas: 86, total: 2398.4, entrega: "2026-10-01" },
    { folio: "PD-20928", estado: "En tránsito", planchas: 132, total: 3612.7, entrega: "2026-09-30" },
    { folio: "PD-20894", estado: "Entregado", planchas: 101, total: 2854.1, entrega: "2026-09-16" },
  ];

export const cuenta = {
  cliente: "Supermercados La Rambla",
  sucursal: "CD Norte — Lima",
  lineaCredito: 45000,
  creditoUsado: 12865.2,
  ejecutivo: {
    nombre: "Marcela Ibáñez",
    cargo: "Ejecutiva de cuenta B2B",
    telefono: "+51 999 214 880",
    correo: "marcela.ibanez@bimbo-mayorista.com",
    horario: "Lunes a viernes, 8:00 a 18:00",
  },
};

export type Documento = {
  numero: string;
  tipo: "Factura" | "Nota de crédito";
  fecha: string;
  monto: number;
  estado: "Pagada" | "Pendiente" | "Aplicada";
};

export const documentos: Documento[] = [
  { numero: "F001-004512", tipo: "Factura", fecha: "2026-09-16", monto: 2854.1, estado: "Pagada" },
  { numero: "F001-004498", tipo: "Factura", fecha: "2026-09-02", monto: 3120.5, estado: "Pendiente" },
  { numero: "NC001-000218", tipo: "Nota de crédito", fecha: "2026-09-04", monto: 212.4, estado: "Aplicada" },
  { numero: "F001-004471", tipo: "Factura", fecha: "2026-08-19", monto: 2740.0, estado: "Pagada" },
];

export const preguntas = [
  {
    pregunta: "¿Cuál es el pedido mínimo por producto?",
    respuesta:
      "Cada SKU indica su mínimo en planchas dentro de la ficha de producto. El sistema avisa antes de confirmar si alguna línea no alcanza el mínimo.",
  },
  {
    pregunta: "¿Cómo se calcula el precio por volumen?",
    respuesta:
      "El precio baja automáticamente al alcanzar los tramos de planchas indicados en la ficha. No requiere solicitud manual.",
  },
  {
    pregunta: "¿Qué pasa si un lote llega próximo a caducar?",
    respuesta:
      "Cada entrega detalla lote y fecha de caducidad. Si la vida útil recibida es menor a la comprometida, se emite nota de crédito.",
  },
  {
    pregunta: "¿Cuándo se libera el crédito disponible?",
    respuesta:
      "El crédito se restituye al registrarse el pago de la factura, normalmente el día hábil siguiente a la conciliación bancaria.",
  },
];

export function formatoMoneda(valor: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(valor);
}

export function formatoFecha(iso: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${iso}T12:00:00`),
  );
}

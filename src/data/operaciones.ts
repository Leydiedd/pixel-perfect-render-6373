export const kpis = {
  pedidosActivos: 48,
  entregadosHoy: 31,
  pendientes: 17,
  rutasActivas: 9,
  alertasStock: 3,
};

export const entregasSemanales = [
  { dia: "Lun", entregas: 42, programadas: 46 },
  { dia: "Mar", entregas: 38, programadas: 40 },
  { dia: "Mié", entregas: 51, programadas: 52 },
  { dia: "Jue", entregas: 47, programadas: 50 },
  { dia: "Vie", entregas: 58, programadas: 60 },
  { dia: "Sáb", entregas: 63, programadas: 64 },
  { dia: "Dom", entregas: 29, programadas: 30 },
];

export const canales = [
  { canal: "Supermercados", valor: 46 },
  { canal: "Hipermercados", valor: 24 },
  { canal: "Tiendas de conveniencia", valor: 18 },
  { canal: "Mayoristas", valor: 12 },
];

export type Ruta = {
  id: string;
  destino: string;
  cadena: string;
  estado: "En ruta" | "Cargando" | "Entregado" | "Retraso";
  avance: number;
  eta: string;
  x: number;
  y: number;
};

export const centroDistribucion = { nombre: "CD Bimbo — Lima Norte", x: 30, y: 30 };

export const rutas: Ruta[] = [
  { id: "R-101", destino: "Miraflores", cadena: "Plaza Vea", estado: "En ruta", avance: 64, eta: "10:40", x: 58, y: 70 },
  { id: "R-102", destino: "San Isidro", cadena: "Tottus", estado: "En ruta", avance: 42, eta: "11:15", x: 52, y: 58 },
  { id: "R-103", destino: "Surco", cadena: "Metro", estado: "Retraso", avance: 28, eta: "12:30", x: 72, y: 78 },
  { id: "R-104", destino: "Los Olivos", cadena: "Plaza Vea", estado: "Entregado", avance: 100, eta: "08:50", x: 22, y: 18 },
  { id: "R-105", destino: "La Molina", cadena: "Wong", estado: "Cargando", avance: 5, eta: "13:10", x: 84, y: 54 },
  { id: "R-106", destino: "Callao", cadena: "Makro", estado: "En ruta", avance: 71, eta: "10:05", x: 8, y: 48 },
  { id: "R-107", destino: "San Miguel", cadena: "Tottus", estado: "En ruta", avance: 55, eta: "10:55", x: 26, y: 62 },
  { id: "R-108", destino: "Ate", cadena: "Metro", estado: "Entregado", avance: 100, eta: "09:20", x: 78, y: 36 },
  { id: "R-109", destino: "Chorrillos", cadena: "Plaza Vea", estado: "En ruta", avance: 33, eta: "12:05", x: 50, y: 88 },
];

export type Alerta = { id: string; nivel: "Crítica" | "Media" | "Baja"; titulo: string; detalle: string; hora: string };

export const alertas: Alerta[] = [
  { id: "A-1", nivel: "Crítica", titulo: "Stock bajo: Chocolate Nito Bimbo", detalle: "Cobertura menor a 3 días en CD Lima Norte.", hora: "09:12" },
  { id: "A-2", nivel: "Media", titulo: "Retraso en ruta R-103", detalle: "Tráfico en Panamericana Sur, ETA +45 min hacia Metro Surco.", hora: "09:40" },
  { id: "A-3", nivel: "Media", titulo: "Lote L-2462N próximo a caducar", detalle: "Priorizar despacho FEFO en próximas 72 h.", hora: "08:05" },
  { id: "A-4", nivel: "Baja", titulo: "Pedido mínimo no alcanzado", detalle: "Orden en borrador por debajo del mínimo de planchas.", hora: "07:30" },
];

export const servicios = [
  { nombre: "Planta Lima — producción", estado: "Operativo", uptime: "99.9%" },
  { nombre: "CD Lima Norte — almacén", estado: "Operativo", uptime: "99.7%" },
  { nombre: "Flota de distribución", estado: "Degradado", uptime: "96.4%" },
  { nombre: "Facturación electrónica", estado: "Operativo", uptime: "99.95%" },
  { nombre: "Integración EDI cadenas", estado: "Operativo", uptime: "99.8%" },
] as const;

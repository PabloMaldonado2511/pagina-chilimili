// ============================================================
// Aquí se editan productos, precios y datos del negocio.
// Precios en pesos mexicanos (MXN).
// Este archivo es público: nunca pongas aquí contraseñas ni claves.
// ============================================================

const CONFIG = {
  instagram: "chilimili_mty",
  diasRecomendados: "2 a 3",
  zona: "Monterrey y zona metropolitana",

  // Dirección de la hoja de pedidos (Google Apps Script), termina en /exec.
  // Vacío: la página manda el pedido como mensaje de Instagram.
  pedidosUrl: "",

  // WhatsApp del negocio que recibe los comprobantes: 10 dígitos, sin espacios.
  // Vacío: la pantalla final no muestra el botón de WhatsApp.
  whatsapp: "",

  // Datos para pagar por transferencia. Sin banco y CLABE no se muestra la caja de pago.
  pago: { banco: "", titular: "", clabe: "" },

  // Puntos de entrega, por ejemplo ["Gimnasio X · lunes y miércoles"].
  // Con la lista vacía, el cliente escribe dónde le queda bien.
  puntos: [],
};

// Un tamaño aparece en la página solo si "activo" es true
// Y el producto tiene precio para ese tamaño.
// Para vender 200 g: pon su precio en cada producto y cambia activo a true.
const TAMANOS = [
  { g: 80, activo: false },
  { g: 150, activo: true },
  { g: 200, activo: false },
];

const CATEGORIAS = [
  { id: "gomitas", nombre: "Gomitas" },
  { id: "xtremes", nombre: "Xtremes" },
  { id: "skittles", nombre: "Skittles" },
];

// precios: { tamaño en gramos: precio }. null = todavía sin precio.
const PRODUCTOS = [
  { id: "gusanitos", nombre: "Gusanitos", categoria: "gomitas", foto: "img/gusanitos.jpg", precios: { 80: 25, 150: 45, 200: null } },
  { id: "tiburones", nombre: "Tiburones", categoria: "gomitas", foto: null, precios: { 80: 25, 150: 45, 200: null } },
  { id: "panditas", nombre: "Panditas", categoria: "gomitas", foto: null, precios: { 80: 25, 150: 45, 200: null } },
  { id: "aros-manzana", nombre: "Aros de manzana", categoria: "gomitas", foto: "img/aros.jpg", precios: { 80: 25, 150: 45, 200: null } },
  { id: "aros-durazno", nombre: "Aros de durazno", categoria: "gomitas", foto: "img/aros.jpg", precios: { 80: 25, 150: 45, 200: null } },
  { id: "mixtas", nombre: "Mixtas", categoria: "gomitas", foto: null, precios: { 80: 30, 150: 55, 200: null } },
  { id: "sandias", nombre: "Sandías", categoria: "gomitas", foto: "img/sandias.jpg", precios: { 80: 30, 150: 55, 200: null } },
  { id: "xtremes", nombre: "Xtremes", categoria: "xtremes", foto: null, precios: { 80: 40, 150: 65, 200: null } },
  { id: "skittles-rojos", nombre: "Skittles rojos", categoria: "skittles", foto: null, precios: { 80: 40, 150: 65, 200: null } },
  { id: "skittles-morados", nombre: "Skittles morados", categoria: "skittles", foto: null, precios: { 80: 40, 150: 65, 200: null } },
];

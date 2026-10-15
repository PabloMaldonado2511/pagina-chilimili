// ============================================================
// Aquí se editan productos, precios y tamaños de Chilimili.
// Los precios son en pesos mexicanos (MXN).
// ============================================================

const CONFIG = {
  instagram: "chilimili_mty",
  diasRecomendados: "2 a 3",
  zona: "Monterrey y zona metropolitana",
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
  { id: "gomitas", nombre: "Gomitas", color: "#8e44e0" },
  { id: "xtremes", nombre: "Xtremes", color: "#3b8ee6" },
  { id: "skittles", nombre: "Skittles", color: "#1f9d45" },
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

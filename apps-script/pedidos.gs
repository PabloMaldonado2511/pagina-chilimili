/**
 * Chilimili · Receptor de pedidos (Google Apps Script)
 *
 * Qué hace: recibe cada pedido de la página, lo guarda en la hoja de cálculo
 * (pestañas "Pedidos" y "Partidas"), avisa por correo y deja listo el enlace
 * de WhatsApp para confirmarle al cliente.
 *
 * Cómo instalarlo (una sola vez):
 * 1. Crea una hoja de Google Sheets nueva y ábrela.
 * 2. Extensiones > Apps Script. Borra lo que haya y pega este archivo completo.
 * 3. Cambia AVISAR_A y DATOS_DE_PAGO aquí mismo, en el editor de Apps Script.
 *    No subas tus datos reales a GitHub: el repositorio es público.
 * 4. Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 * 5. Autoriza los permisos que pide Google y copia la URL que termina en /exec.
 *    Esa URL va en pedidosUrl dentro de productos.js.
 */

// ---- Edita estos dos datos en el editor de Apps Script ----
const AVISAR_A = ["correo1@ejemplo.com", "correo2@ejemplo.com"];
const DATOS_DE_PAGO = "Banco: (escribe el banco)\nTitular: (escribe el nombre)\nCLABE: (escribe la CLABE)";
// ------------------------------------------------------------

const HOJA_PEDIDOS = "Pedidos";
const HOJA_PARTIDAS = "Partidas";
const ENCABEZADOS_PEDIDOS = ["Folio", "Recibido", "Nombre", "WhatsApp", "Fecha de entrega", "Punto de entrega", "Productos", "Total", "Notas", "Estado", "Token"];
const ENCABEZADOS_PARTIDAS = ["Folio", "Fecha de entrega", "Producto", "Gramos", "Cantidad", "Precio", "Subtotal"];
const COLUMNA_TOKEN = 11;
const ESTADOS = ["Por pagar", "Pagado", "Entregado", "Cancelado"];

// Abrir la URL /exec en el navegador sirve para comprobar que el receptor está activo.
function doGet() {
  return salida({ ok: true, mensaje: "Receptor de pedidos Chilimili activo" });
}

function doPost(e) {
  const cerrojo = LockService.getScriptLock();
  let bloqueado = false;
  try {
    cerrojo.waitLock(20000);
    bloqueado = true;
    return salida(registrar(JSON.parse(e.postData.contents)));
  } catch (err) {
    console.error(err);
    return salida({ ok: false, error: "No se pudo registrar el pedido." });
  } finally {
    if (bloqueado) cerrojo.releaseLock();
  }
}

function registrar(d) {
  // Campo oculto para bots: si trae algo, se ignora sin avisar.
  if (d.web) return { ok: true, folio: "CM-0000" };

  const nombre = texto(d.nombre, 80);
  const whatsapp = String(d.whatsapp || "").replace(/\D/g, "");
  const fecha = String(d.fecha || "");
  const punto = texto(d.punto, 120);
  const notas = texto(d.notas, 300);
  const token = texto(d.token, 64);
  const items = Array.isArray(d.items) ? d.items.slice(0, 40) : [];
  if (!nombre || whatsapp.length !== 10 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !punto || !token || !items.length) {
    throw new Error("Datos incompletos");
  }

  const partidas = items.map(function (i) {
    const cant = Math.floor(Number(i.cant));
    const precio = Number(i.precio);
    const g = Number(i.g);
    if (!(cant >= 1 && cant <= 99) || !(precio >= 0 && precio <= 5000) || !(g > 0)) throw new Error("Partida inválida");
    return { producto: texto(i.producto, 60), g: g, cant: cant, precio: precio };
  });
  const total = partidas.reduce(function (s, p) { return s + p.cant * p.precio; }, 0);

  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPedidos = obtenerHoja(libro, HOJA_PEDIDOS, ENCABEZADOS_PEDIDOS, prepararPedidos);
  const hojaPartidas = obtenerHoja(libro, HOJA_PARTIDAS, ENCABEZADOS_PARTIDAS, prepararPartidas);

  // Si el cliente reintenta el mismo pedido, devolvemos el folio que ya existe.
  const previo = buscarToken(hojaPedidos, token);
  if (previo) return { ok: true, folio: previo };

  const propiedades = PropertiesService.getScriptProperties();
  const numero = Number(propiedades.getProperty("ultimoFolio") || 0) + 1;
  propiedades.setProperty("ultimoFolio", String(numero));
  const folio = "CM-" + ("0000" + numero).slice(-4);

  const resumen = partidas.map(function (p) { return p.cant + " × " + p.producto + " " + p.g + " g"; }).join("; ");
  hojaPedidos.appendRow([folio, new Date(), celda(nombre), "'" + whatsapp, fecha, celda(punto), celda(resumen), total, celda(notas), ESTADOS[0], token]);

  const filas = partidas.map(function (p) {
    return [folio, fecha, celda(p.producto), p.g, p.cant, p.precio, p.cant * p.precio];
  });
  hojaPartidas.getRange(hojaPartidas.getLastRow() + 1, 1, filas.length, ENCABEZADOS_PARTIDAS.length).setValues(filas);

  avisar({ folio: folio, nombre: nombre, whatsapp: whatsapp, fecha: fecha, punto: punto, notas: notas, partidas: partidas, total: total });
  return { ok: true, folio: folio };
}

// Si el correo falla, el pedido ya quedó guardado en la hoja.
function avisar(p) {
  try {
    const lineas = p.partidas.map(function (x) {
      return "• " + x.cant + " × " + x.producto + " " + x.g + " g — $" + (x.cant * x.precio);
    }).join("\n");
    const mensajeCliente =
      "Hola " + p.nombre + ", recibimos tu pedido " + p.folio + " por $" + p.total +
      " para el " + fechaLarga(p.fecha) + " en " + p.punto + ".\n" +
      "Para confirmarlo, haz tu transferencia por el monto exacto y mándanos tu comprobante:\n" + DATOS_DE_PAGO;
    const enlace = "https://wa.me/52" + p.whatsapp + "?text=" + encodeURIComponent(mensajeCliente);
    const cuerpo = [
      "Pedido " + p.folio + " por $" + p.total,
      "",
      lineas,
      "",
      "Cliente: " + p.nombre,
      "WhatsApp: " + p.whatsapp,
      "Entrega: " + fechaLarga(p.fecha) + " en " + p.punto,
      p.notas ? "Notas: " + p.notas : "",
      "",
      "Confirmar al cliente por WhatsApp (abre el mensaje ya escrito):",
      enlace,
    ].join("\n");
    MailApp.sendEmail({ to: AVISAR_A.join(","), subject: "Nuevo pedido " + p.folio + " · $" + p.total + " · " + p.nombre, body: cuerpo });
  } catch (err) {
    console.error("No se pudo enviar el aviso: " + err);
  }
}

function obtenerHoja(libro, nombre, encabezados, preparar) {
  let hoja = libro.getSheetByName(nombre);
  if (hoja) return hoja;
  const hojas = libro.getSheets();
  if (nombre === HOJA_PEDIDOS && hojas.length === 1 && hojas[0].getLastRow() === 0) {
    hoja = hojas[0].setName(nombre);
  } else {
    hoja = libro.insertSheet(nombre);
  }
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight("bold");
  hoja.setFrozenRows(1);
  preparar(hoja);
  return hoja;
}

function prepararPedidos(hoja) {
  hoja.getRange("B2:B").setNumberFormat("yyyy-mm-dd hh:mm");
  hoja.getRange("D2:D").setNumberFormat("@");
  hoja.getRange("E2:E").setNumberFormat("yyyy-mm-dd");
  hoja.getRange("H2:H").setNumberFormat("$#,##0");
  hoja.getRange("J2:J").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build());
}

function prepararPartidas(hoja) {
  hoja.getRange("B2:B").setNumberFormat("yyyy-mm-dd");
  hoja.getRange("F2:G").setNumberFormat("$#,##0");
}

function buscarToken(hoja, token) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return null;
  const tokens = hoja.getRange(2, COLUMNA_TOKEN, n, 1).getValues();
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i][0] === token) return hoja.getRange(i + 2, 1).getValue();
  }
  return null;
}

// Limpia saltos de línea y recorta el largo.
function texto(valor, max) {
  return String(valor == null ? "" : valor).replace(/[\r\n]+/g, " ").trim().slice(0, max);
}

// Evita que un texto escrito por un cliente se ejecute como fórmula en la hoja.
function celda(valor) {
  return /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function fechaLarga(iso) {
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const p = iso.split("-").map(Number);
  const f = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return dias[f.getUTCDay()] + " " + p[2] + " de " + meses[p[1] - 1];
}

function salida(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(ContentService.MimeType.JSON);
}

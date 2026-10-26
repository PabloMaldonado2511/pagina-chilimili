/**
 * Chilimili · Receptor de pedidos (Google Apps Script)
 *
 * Qué hace: recibe cada pedido de la página, lo guarda en la hoja de cálculo
 * (pestañas "Pedidos" y "Partidas") y avisa por correo. También recibe la
 * captura del comprobante de pago, la guarda en Google Drive (carpeta
 * "Comprobantes Chilimili"), la liga al pedido y cambia su estado.
 *
 * Cómo instalarlo (una sola vez):
 * 1. Crea una hoja de Google Sheets nueva y ábrela.
 * 2. Extensiones > Apps Script. Borra lo que haya y pega este archivo completo.
 * 3. Cambia AVISAR_A y DATOS_DE_PAGO aquí mismo, en el editor de Apps Script.
 *    No subas tus datos reales a GitHub: el repositorio es público.
 * 4. Implementar > Nueva implementación > Aplicación web.
 *    Ejecutar como: Yo. Quién tiene acceso: Cualquier persona.
 * 5. Autoriza los permisos que pide Google y copia la URL que termina en /exec.
 *    Si ya estaba instalado y pegas una versión nueva: elige la función
 *    "autorizar" arriba, dale Ejecutar una vez y acepta los permisos; luego
 *    Implementar > Gestionar implementaciones > lápiz > Nueva versión.
 *    Esa URL va en pedidosUrl dentro de productos.js.
 */

// ---- Edita estos datos en el editor de Apps Script, nunca en GitHub ----
const AVISAR_A = ["correo1@ejemplo.com", "correo2@ejemplo.com"];
const DATOS_DE_PAGO = {
  banco: "(escribe el banco)",
  titular: "(escribe el nombre)",
  etiqueta: "Tarjeta", // o "CLABE"
  cuenta: "(escribe el número)",
};
// La página muestra estos datos solo después de que el cliente hace su pedido.
// ------------------------------------------------------------------------

const HOJA_PEDIDOS = "Pedidos";
const HOJA_PARTIDAS = "Partidas";
const ENCABEZADOS_PEDIDOS = ["Folio", "Recibido", "Nombre", "Instagram", "Fecha de entrega", "Punto de entrega", "Productos", "Total", "Notas", "Estado", "Token", "Comprobante"];
const ENCABEZADOS_PARTIDAS = ["Folio", "Fecha de entrega", "Producto", "Gramos", "Cantidad", "Precio", "Subtotal"];
const COLUMNA_ESTADO = 10;
const COLUMNA_TOKEN = 11;
const COLUMNA_COMPROBANTE = 12;
const ESTADOS = ["Por pagar", "Comprobante recibido", "Pagado", "Entregado", "Cancelado"];
const TIPOS_COMPROBANTE = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic", "application/pdf": ".pdf" };
const MAX_BYTES_COMPROBANTE = 8 * 1024 * 1024;

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
    const d = JSON.parse(e.postData.contents);
    return salida(d.accion === "comprobante" ? recibirComprobante(d) : registrar(d));
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
  const instagram = String(d.instagram || "").trim().replace(/^@+/, "");
  const fecha = String(d.fecha || "");
  const punto = texto(d.punto, 120);
  const notas = texto(d.notas, 300);
  const token = texto(d.token, 64);
  const items = Array.isArray(d.items) ? d.items.slice(0, 40) : [];
  if (!nombre || !/^[A-Za-z0-9._]{1,30}$/.test(instagram) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !punto || !token || !items.length) {
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
  if (previo) return respuestaOk(previo, nombre);

  const propiedades = PropertiesService.getScriptProperties();
  // Con la hoja vacía (sin pedidos), el folio vuelve a empezar en CM-0001.
  if (hojaPedidos.getLastRow() <= 1) propiedades.setProperty("ultimoFolio", "0");
  const numero = Number(propiedades.getProperty("ultimoFolio") || 0) + 1;
  propiedades.setProperty("ultimoFolio", String(numero));
  const folio = "CM-" + ("0000" + numero).slice(-4);

  const resumen = partidas.map(function (p) { return p.cant + " × " + p.producto + " " + p.g + " g"; }).join("; ");
  hojaPedidos.appendRow([folio, new Date(), celda(nombre), "@" + instagram, fecha, celda(punto), celda(resumen), total, celda(notas), ESTADOS[0], token, ""]);

  const filas = partidas.map(function (p) {
    return [folio, fecha, celda(p.producto), p.g, p.cant, p.precio, p.cant * p.precio];
  });
  hojaPartidas.getRange(hojaPartidas.getLastRow() + 1, 1, filas.length, ENCABEZADOS_PARTIDAS.length).setValues(filas);

  avisar({ folio: folio, nombre: nombre, instagram: instagram, fecha: fecha, punto: punto, notas: notas, partidas: partidas, total: total });
  return respuestaOk(folio, nombre);
}

// Los datos de pago viajan solo en la respuesta de un pedido válido.
function respuestaOk(folio, nombre) {
  const primerNombre = nombre.split(" ")[0];
  return {
    ok: true,
    folio: folio,
    pago: {
      banco: DATOS_DE_PAGO.banco,
      titular: DATOS_DE_PAGO.titular,
      etiqueta: DATOS_DE_PAGO.etiqueta,
      cuenta: DATOS_DE_PAGO.cuenta,
      concepto: (folio + " " + primerNombre).slice(0, 30),
    },
  };
}

// Si el correo falla, el pedido ya quedó guardado en la hoja.
function avisar(p) {
  try {
    const lineas = p.partidas.map(function (x) {
      return "• " + x.cant + " × " + x.producto + " " + x.g + " g — $" + (x.cant * x.precio);
    }).join("\n");
    const perfil = "https://instagram.com/" + p.instagram;
    const cuerpo = [
      "Pedido " + p.folio + " por $" + p.total,
      "",
      lineas,
      "",
      "Cliente: " + p.nombre,
      "Instagram: @" + p.instagram + "  " + perfil,
      "Entrega: " + fechaLarga(p.fecha) + " en " + p.punto,
      p.notas ? "Notas: " + p.notas : "",
      "",
      "Referencia de pago: " + p.folio + " " + p.nombre.split(" ")[0],
      "Cuando el cliente suba su comprobante te llega otro correo.",
    ].join("\n");
    MailApp.sendEmail({ to: AVISAR_A.join(","), subject: "Nuevo pedido " + p.folio + " · $" + p.total + " · " + p.nombre, body: cuerpo });
  } catch (err) {
    console.error("No se pudo enviar el aviso: " + err);
  }
}

function obtenerHoja(libro, nombre, encabezados, preparar) {
  let hoja = libro.getSheetByName(nombre);
  if (hoja) {
    hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]);
    preparar(hoja);
    return hoja;
  }
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
  hoja.getRange("E2:E").setNumberFormat("yyyy-mm-dd");
  hoja.getRange("H2:H").setNumberFormat("$#,##0");
  hoja.getRange("J2:J").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ESTADOS, true).build());
}

function prepararPartidas(hoja) {
  hoja.getRange("B2:B").setNumberFormat("yyyy-mm-dd");
  hoja.getRange("F2:G").setNumberFormat("$#,##0");
}

// Recibe la captura del comprobante. Solo se acepta con el token del pedido,
// que únicamente conoce el celular que lo hizo.
function recibirComprobante(d) {
  const folio = String(d.folio || "");
  const token = texto(d.token, 64);
  const tipo = String(d.tipo || "");
  const archivo = String(d.archivo || "");
  if (!/^CM-\d{4,}$/.test(folio) || !token || !TIPOS_COMPROBANTE[tipo] || !archivo || archivo.length > MAX_BYTES_COMPROBANTE * 1.4) {
    throw new Error("Comprobante inválido");
  }
  const hoja = obtenerHoja(SpreadsheetApp.getActiveSpreadsheet(), HOJA_PEDIDOS, ENCABEZADOS_PEDIDOS, prepararPedidos);
  const fila = buscarFila(hoja, folio, token);
  if (!fila) throw new Error("Pedido no encontrado");
  const bytes = Utilities.base64Decode(archivo);
  if (!bytes.length || bytes.length > MAX_BYTES_COMPROBANTE) throw new Error("Archivo muy grande");

  const datos = hoja.getRange(fila, 1, 1, ENCABEZADOS_PEDIDOS.length).getValues()[0];
  const nombre = String(datos[2]).replace(/^'/, "");
  const nombreArchivo = folio + " " + nombre.split(" ")[0] + TIPOS_COMPROBANTE[tipo];
  const guardado = carpetaComprobantes().createFile(Utilities.newBlob(bytes, tipo, nombreArchivo));
  const enlace = guardado.getUrl();
  hoja.getRange(fila, COLUMNA_COMPROBANTE).setValue(enlace);
  if (datos[COLUMNA_ESTADO - 1] === ESTADOS[0]) hoja.getRange(fila, COLUMNA_ESTADO).setValue(ESTADOS[1]);

  try {
    MailApp.sendEmail({
      to: AVISAR_A.join(","),
      subject: "Comprobante " + folio + " · $" + datos[7] + " · " + nombre,
      body: [
        nombre + " subió su comprobante del pedido " + folio + " por $" + datos[7] + ".",
        "",
        "Ver comprobante: " + enlace,
        "",
        "Revisa en Banorte que llegó el dinero y cambia el Estado a Pagado en la hoja.",
      ].join("\n"),
    });
  } catch (err) {
    console.error("No se pudo enviar el aviso del comprobante: " + err);
  }
  return { ok: true, folio: folio };
}

function buscarFila(hoja, folio, token) {
  const n = hoja.getLastRow() - 1;
  if (n < 1) return 0;
  const filas = hoja.getRange(2, 1, n, COLUMNA_TOKEN).getValues();
  for (let i = filas.length - 1; i >= 0; i--) {
    if (filas[i][0] === folio && filas[i][COLUMNA_TOKEN - 1] === token) return i + 2;
  }
  return 0;
}

function carpetaComprobantes() {
  const propiedades = PropertiesService.getScriptProperties();
  const id = propiedades.getProperty("carpetaComprobantes");
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (err) { /* la borraron: se crea otra */ }
  }
  const carpeta = DriveApp.createFolder("Comprobantes Chilimili");
  propiedades.setProperty("carpetaComprobantes", carpeta.getId());
  return carpeta;
}

// Ejecútala una vez desde el editor para que Google pida los permisos (hoja, correo y Drive).
function autorizar() {
  SpreadsheetApp.getActiveSpreadsheet().getName();
  MailApp.getRemainingDailyQuota();
  carpetaComprobantes();
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

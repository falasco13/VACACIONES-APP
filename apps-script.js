// ═══════════════════════════════════════════════════════════════════════════
//  VACACIONES MANAGER — Google Apps Script
//  Pegá este código en tu Google Sheet:
//  Extensiones → Apps Script → borrar lo que hay → pegar esto → Guardar
//  Luego: Implementar → Nueva implementación → Aplicación web
//    · Ejecutar como: Yo
//    · Quién tiene acceso: Cualquier persona
//  → Copiá la URL generada y pegala en la app
// ═══════════════════════════════════════════════════════════════════════════

function doPost(e) {
  try {
    const raw  = e.parameter.data;
    const payload = JSON.parse(raw);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    writeSheet(ss, "📋 Resumen",     payload.resumen);
    writeSheet(ss, "✉️ Vacaciones",  payload.vacaciones);
    writeSheet(ss, "👤 Empleados",   payload.empleados);
    writeSheet(ss, "⚡ Conflictos",  payload.conflictos);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, ts: new Date().toISOString() }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeSheet(ss, name, rows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
  }

  if (!rows || rows.length === 0) return;

  // Write all data
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  // Format header row
  const header = sheet.getRange(1, 1, 1, rows[0].length);
  header.setBackground("#d4956a");
  header.setFontColor("#ffffff");
  header.setFontWeight("bold");
  header.setHorizontalAlignment("center");

  // Auto-resize columns
  for (let i = 1; i <= rows[0].length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Freeze header row
  sheet.setFrozenRows(1);

  // Alternate row colors
  for (let r = 2; r <= rows.length; r++) {
    const rowRange = sheet.getRange(r, 1, 1, rows[0].length);
    rowRange.setBackground(r % 2 === 0 ? "#f9f5ef" : "#fffcf8");
  }
}

// Test function — podés ejecutarla desde el editor para verificar que funciona
function testScript() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("📋 Resumen") || ss.insertSheet("📋 Resumen");
  sheet.clearContents();
  sheet.getRange("A1").setValue("✅ Script funcionando correctamente — " + new Date().toLocaleString());
  Logger.log("Test OK");
}

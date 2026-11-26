const SHEET_NAME = "Pit Scouting";
const PHOTO_FOLDER_NAME = "SuperNOVA 31742 Pit Scouting Photos";

const HEADERS = [
  "Entry ID",
  "Timestamp",
  "Team Number",
  "Team Name",
  "Game Elements Handled",
  "Scoring & Field Tasks",
  "Endgame Specs & Vision",
  "Extra Specs & Notes",
  "Auto Starting Positions",
  "Auto Actions & Scoring",
  "Auto Path Details",
  "Local Outreach",
  "Global Outreach",
  "Special Details",
  "Photo Permission",
  "Robot Photo",
  "Photo URL",
  "Synced At"
];

function doPost(request) {
  try {
    const data = JSON.parse(request.postData.contents);
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);

    let photoUrl = "";
    if (data.photoBase64) {
      photoUrl = savePhotoToDrive(data);
    }

    sheet.appendRow([
      data.entryId || "",
      data.timestamp || new Date(),
      data.teamNumber || "",
      data.teamName || "",
      data.gameElementsHandled || "",
      data.scoringFieldTasks || "",
      data.endgameSpecsVision || "",
      data.extraSpecs || "",
      data.autoStartingPositions || "",
      data.autoActionsScoring || "",
      data.autoPathDetails || "",
      data.localOutreach || "",
      data.globalOutreach || "",
      data.specialDetails || "",
      data.photoPermission || "",
      data.robotPhoto || "",
      photoUrl,
      new Date()
    ]);

    return jsonResponse({ ok: true, photoUrl: photoUrl });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.toString() });
  }
}

function doGet(request) {
  const callback = request && request.parameter ? request.parameter.callback : "";
  const action = request && request.parameter ? request.parameter.action : "";

  if (action === "test") {
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);
    return jsonpResponse({
      ok: true,
      service: "SuperNOVA 31742 Pit Scouting",
      sheetName: SHEET_NAME,
      rowCount: Math.max(sheet.getLastRow() - 1, 0)
    }, callback);
  }

  if (action === "entries") {
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return jsonpResponse({ ok: true, entries: [] }, callback);
    }

    const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
    const entries = values
      .filter((row) => row[2] || row[3])
      .map((row) => ({
        entryId: String(row[0] || ""),
        timestamp: row[1] instanceof Date ? row[1].toLocaleString() : String(row[1] || ""),
        teamNumber: String(row[2] || ""),
        teamName: String(row[3] || ""),
        gameElements: String(row[4] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        scoringCaps: String(row[5] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        endgameSpecs: String(row[6] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        capabilitiesNotes: String(row[7] || ""),
        autoStarts: String(row[8] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        autoActions: String(row[9] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        autoNotes: String(row[10] || ""),
        localOutreach: String(row[11] || ""),
        globalOutreach: String(row[12] || ""),
        specialInfo: String(row[13] || ""),
        photoPermission: String(row[14] || ""),
        hasPhoto: Boolean(row[16]),
        photoUrl: String(row[16] || ""),
        synced: true,
        syncStatus: "verified"
      }));

    return jsonpResponse({ ok: true, entries: entries }, callback);
  }

  return jsonpResponse({ ok: true, service: "SuperNOVA 31742 Pit Scouting" }, callback);
}

function getOrCreateSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function ensureHeaders(sheet) {
  const existing = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const headersMatch = existing.every((value, index) => value === HEADERS[index]);
  if (!headersMatch) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function savePhotoToDrive(data) {
  const folder = getOrCreatePhotoFolder();
  const base64 = data.photoBase64.split(",").pop();
  const mimeType = data.photoMimeType || "image/jpeg";
  const safeName = (data.photoName || `team-${data.teamNumber || "unknown"}-${Date.now()}.jpg`).replace(/[^A-Za-z0-9._-]/g, "-");
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, safeName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

function getOrCreatePhotoFolder() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function jsonpResponse(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse(data);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

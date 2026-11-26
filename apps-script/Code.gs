const SHEET_NAME = "Pit Scouting Data";
const PHOTO_FOLDER_NAME = "SuperNOVA 31742 Pit Scouting Photos";
const SCOUTING_SPREADSHEET_ID = "1uxxjEoRYpS1YpkFnztJhX04xxVE3xNB92xFkl--5Jfc";
const ADMIN_SPREADSHEET_ID = "1ns9RLojmf8AaNKSYVvqHISWrg9uHx3tzrH2rEga8kwM";
const ADMIN_SETTINGS_SHEET = "Settings";
const ADMIN_EVENTS_SHEET = "Events";
const ADMIN_RESOURCES_SHEET = "Resources";
const ADMIN_PASSWORD = "supernova";

const HEADERS = [
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
    let data = {};

    if (request.parameter && request.parameter.payload) {
      data = JSON.parse(request.parameter.payload);
    } else if (request.postData && request.postData.contents) {
      data = JSON.parse(request.postData.contents);
    }

    if (data.action) {
      if (!data.admin_token || data.admin_token !== ADMIN_PASSWORD) {
        return jsonResponse({ ok: false, error: "Unauthorized" });
      }
      return handleAdminPost(data.action, data.payload || {});
    }

    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);

    let photoUrl = "";
    if (data.photoBase64) {
      photoUrl = savePhotoToDrive(data);
    }

    const rowValues = [
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
    ];

    const teamNumber = String(data.teamNumber || "").trim();
    const teamName = String(data.teamName || "").trim();
    const existingRow = findTeamRow(sheet, teamNumber, teamName);

    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return jsonResponse({ ok: true, photoUrl: photoUrl });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.toString() });
  }
}

function doGet(request) {
  const callback = request && request.parameter ? request.parameter.callback : "";
  const action = request && request.parameter ? request.parameter.action : "";
  const type = request && request.parameter ? request.parameter.type : "";

  if (action === "settings" || type === "settings") {
    return jsonpResponse({ ok: true, settings: getAdminSettings() }, callback);
  }

  if (action === "events" || type === "events") {
    return jsonpResponse({ ok: true, events: getAdminEvents() }, callback);
  }

  if (action === "resources" || type === "resources") {
    return jsonpResponse({ ok: true, resources: getAdminResources() }, callback);
  }

  if (action === "test") {
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);
    const spreadsheet = SpreadsheetApp.openById(SCOUTING_SPREADSHEET_ID);
    return jsonpResponse({
      ok: true,
      service: "SuperNOVA 31742 Pit Scouting",
      sheetName: SHEET_NAME,
      rowCount: Math.max(sheet.getLastRow() - 1, 0),
      spreadsheetUrl: spreadsheet.getUrl()
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
      .filter((row) => row[1] || row[2])
      .map((row) => ({
        entryId: "",
        timestamp: row[0] instanceof Date ? row[0].toLocaleString() : String(row[0] || ""),
        teamNumber: String(row[1] || ""),
        teamName: String(row[2] || ""),
        gameElements: String(row[3] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        scoringCaps: String(row[4] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        endgameSpecs: String(row[5] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        capabilitiesNotes: String(row[6] || ""),
        autoStarts: String(row[7] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        autoActions: String(row[8] || "").split(/[,;]+/).map((item) => item.trim()).filter(Boolean),
        autoNotes: String(row[9] || ""),
        localOutreach: String(row[10] || ""),
        globalOutreach: String(row[11] || ""),
        specialInfo: String(row[12] || ""),
        photoPermission: String(row[13] || ""),
        hasPhoto: Boolean(row[15]),
        photoUrl: String(row[15] || ""),
        synced: true,
        syncStatus: "verified"
      }));

    return jsonpResponse({ ok: true, entries: entries }, callback);
  }

  return jsonpResponse({ ok: true, service: "SuperNOVA 31742 Pit Scouting" }, callback);
}

function findTeamRow(sheet, teamNumber, teamName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const teams = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
  for (let index = 0; index < teams.length; index += 1) {
    if (String(teams[index][0]).trim() === teamNumber && String(teams[index][1]).trim() === teamName) {
      return index + 2;
    }
  }
  return 0;
}

function getOrCreateSheet() {
  const spreadsheet = SCOUTING_SPREADSHEET_ID
    ? SpreadsheetApp.openById(SCOUTING_SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
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

function getOrCreateAdminSheet(name) {
  const spreadsheet = SpreadsheetApp.openById(ADMIN_SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  return sheet;
}

function getAdminSettings() {
  const sheet = getOrCreateAdminSheet(ADMIN_SETTINGS_SHEET);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 3, 2).setValues([
      ["Key", "Value"],
      ["scout_password", "31742"],
      ["scout_locked", "FALSE"]
    ]);
  }

  const values = sheet.getLastRow() >= 2
    ? sheet.getRange(1, 1, sheet.getLastRow(), 2).getValues()
    : [];

  const settings = { scout_password: "31742", scout_locked: false };
  values.forEach((row) => {
    if (String(row[0]).trim() === "scout_password") settings.scout_password = String(row[1] || "31742");
    if (String(row[0]).trim() === "scout_locked") settings.scout_locked = String(row[1]).toLowerCase() === "true";
  });
  return settings;
}

function setAdminSetting(key, value) {
  const sheet = getOrCreateAdminSheet(ADMIN_SETTINGS_SHEET);
  if (sheet.getLastRow() < 1) sheet.getRange(1, 1, 1, 2).setValues([["Key", "Value"]]);

  const lastRow = Math.max(sheet.getLastRow(), 2);
  const values = sheet.getRange(1, 1, lastRow, 2).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]).trim() === key) {
      sheet.getRange(index + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}

function getAdminEvents() {
  const sheet = getOrCreateAdminSheet(ADMIN_EVENTS_SHEET);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 8).setValues([["ID", "Title", "Date", "Start Time", "End Time", "Location", "Category", "Visibility"]]);
  }
  if (sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues()
    .filter((row) => row[0] || row[1])
    .map((row) => ({
      id: String(row[0] || ""),
      title: String(row[1] || ""),
      date: row[2] instanceof Date ? Utilities.formatDate(row[2], Session.getScriptTimeZone(), "yyyy-MM-dd") : String(row[2] || ""),
      startTime: String(row[3] || ""),
      endTime: String(row[4] || ""),
      location: String(row[5] || ""),
      category: String(row[6] || "Team Meeting"),
      visibility: String(row[7] || "Public")
    }));
}

function getAdminResources() {
  const sheet = getOrCreateAdminSheet(ADMIN_RESOURCES_SHEET);
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 5).setValues([["ID", "Title", "URL", "Category", "Description"]]);
  }
  if (sheet.getLastRow() < 2) return [];

  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
    .filter((row) => row[0] || row[1])
    .map((row) => ({
      id: String(row[0] || ""),
      title: String(row[1] || ""),
      url: String(row[2] || ""),
      category: String(row[3] || "Software"),
      description: String(row[4] || "")
    }));
}

function handleAdminPost(action, payload) {
  if (action === "update_scout_password") {
    setAdminSetting("scout_password", payload.scout_password || "31742");
    return jsonResponse({ ok: true, settings: getAdminSettings() });
  }

  if (action === "update_scout_lock") {
    setAdminSetting("scout_locked", payload.scout_locked ? "TRUE" : "FALSE");
    return jsonResponse({ ok: true, settings: getAdminSettings() });
  }

  if (action === "add_event") {
    const sheet = getOrCreateAdminSheet(ADMIN_EVENTS_SHEET);
    if (sheet.getLastRow() < 1) sheet.getRange(1, 1, 1, 8).setValues([["ID", "Title", "Date", "Start Time", "End Time", "Location", "Category", "Visibility"]]);
    sheet.appendRow([payload.id || `event-${Date.now()}`, payload.title || "", payload.date || "", payload.startTime || "", payload.endTime || "", payload.location || "", payload.category || "Team Meeting", payload.visibility || "Public"]);
    return jsonResponse({ ok: true, events: getAdminEvents() });
  }

  if (action === "delete_event") {
    const sheet = getOrCreateAdminSheet(ADMIN_EVENTS_SHEET);
    deleteRowById(sheet, payload.id);
    return jsonResponse({ ok: true, events: getAdminEvents() });
  }

  if (action === "add_resource") {
    const sheet = getOrCreateAdminSheet(ADMIN_RESOURCES_SHEET);
    if (sheet.getLastRow() < 1) sheet.getRange(1, 1, 1, 5).setValues([["ID", "Title", "URL", "Category", "Description"]]);
    sheet.appendRow([payload.id || `resource-${Date.now()}`, payload.title || "", payload.url || "", payload.category || "Software", payload.description || ""]);
    return jsonResponse({ ok: true, resources: getAdminResources() });
  }

  if (action === "delete_resource") {
    const sheet = getOrCreateAdminSheet(ADMIN_RESOURCES_SHEET);
    deleteRowById(sheet, payload.id);
    return jsonResponse({ ok: true, resources: getAdminResources() });
  }

  return jsonResponse({ ok: false, error: "Unknown action" });
}

function deleteRowById(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return;
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0]) === String(id)) {
      sheet.deleteRow(index + 2);
      return;
    }
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

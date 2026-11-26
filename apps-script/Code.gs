const SHEET_NAME = "Pit Scouting";
const PHOTO_FOLDER_NAME = "SuperNOVA 31742 Pit Scouting Photos";

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
    const data = JSON.parse(request.postData.contents);
    const sheet = getOrCreateSheet();
    ensureHeaders(sheet);

    let photoUrl = "";
    if (data.photoBase64) {
      photoUrl = savePhotoToDrive(data);
    }

    sheet.appendRow([
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

function doGet() {
  return jsonResponse({ ok: true, service: "SuperNOVA 31742 Pit Scouting" });
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
  if (existing.every((value) => !value)) {
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

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

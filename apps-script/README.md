# SuperNOVA Pit Scouting Sheets Setup

Use this setup to make the scouting page write and read one Google Spreadsheet.

1. Create or open the Google Sheet that should store all scouting entries.
2. In the sheet, open **Extensions > Apps Script**.
3. Replace the script editor content with `Code.gs` from this folder.
4. Set **Run as** to the Google account owner and **Who has access** to **Anyone**.
5. Deploy with **Deploy > New deployment > Web app**.
6. Copy the `/exec` Web App URL.
7. Open Scouting, click the Sheets status button, paste the URL, and choose **Save & Connect**.

After deployment:

- `Pit Scouting` is created automatically.
- Photos are uploaded to a Google Drive folder named `SuperNOVA 31742 Pit Scouting Photos`.
- The `Photo URL` column contains a link to each uploaded photo.
- The website checks the sheet on navigation and every 30 seconds.
- Existing entries remain available locally if the Web App is temporarily unreachable.

Redeploy the Apps Script after changing `Code.gs`. Use **Manage deployments > Edit > New version**.

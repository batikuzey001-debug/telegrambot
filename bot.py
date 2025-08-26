import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

# Railway Variables içine ekleyeceğiz
svc_json = os.getenv("SVC_JSON")
creds = service_account.Credentials.from_service_account_info(json.loads(svc_json))

# Google Sheets API bağlan
service = build("sheets", "v4", credentials=creds)

# Senin sheet ID
SPREADSHEET_ID = "1nSKu_maQ7qxcyloMy18j4DBaocqEvDehNeP3Vf_V8xQ"
RANGE_NAME = "PersonelListesi!A1:E10"  # ilk 10 satır test

result = service.spreadsheets().values().get(
    spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME
).execute()

values = result.get("values", [])
print("=== PersonelListesi Test Çıktısı ===")
for row in values:
    print(row)

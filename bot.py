import os
import json
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build

def die(msg: str):
    print(f"[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

# ---- Service Account JSON (Railway Variables) ----
svc_json = os.getenv("SVC_JSON") or os.getenv("SVCJSON")
if not svc_json:
    die("Missing env var: SVC_JSON (or SVCJSON). Add your service-account JSON as a single-line string.")

try:
    creds_dict = json.loads(svc_json)
except Exception as e:
    die(f"SVC_JSON is not valid JSON: {e}")

try:
    creds = service_account.Credentials.from_service_account_info(creds_dict)
except Exception as e:
    die(f"Failed to build credentials from SVC_JSON: {e}")

# ---- Google Sheets API ----
service = build("sheets", "v4", credentials=creds)

# ---- Target sheet (Personel Hub) ----
SPREADSHEET_ID = os.getenv("TARGET_SHEET_ID", "1nSKu_maQ7qxcyloMy18j4DBaocqEvDehNeP3Vf_V8xQ")
RANGE_NAME = "PersonelListesi!A1:E10"  # smoke test

def main():
    print("[INFO] Connecting to Google Sheets…")
    print(f"[INFO] TARGET_SHEET_ID={SPREADSHEET_ID}")
    try:
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID, range=RANGE_NAME
        ).execute()
        values = result.get("values", [])
    except Exception as e:
        die(f"Sheets API read error: {e}")

    print("=== PersonelListesi Test Çıktısı ===")
    if not values:
        print("(no data)")
    else:
        for row in values:
            print(row)

if __name__ == "__main__":
    main()

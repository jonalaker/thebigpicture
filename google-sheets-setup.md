# Google Sheets Work Tracker Setup

To connect your dApp to Google Sheets off-chain ledger, you need a Google Service Account. 
Follow these steps:

## 1. Get Google Service Account Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "PINN44 Tracker").
3. Go to **APIs & Services > Library**, search for "Google Sheets API", and enable it.
4. Go to **APIs & Services > Credentials**.
5. Click **Create Credentials > Service Account**.
6. Name it (e.g., `sheets-tracker`), and click **Create and Continue** -> **Done**.
7. In the Credentials list, click the Service Account you just created (looks like an email address).
8. Go to the **Keys** tab, click **Add Key > Create new key**, choose **JSON**, and click Create.
9. A JSON file will download. Open it. You will need `client_email` and `private_key` from this file.

## 2. Prepare your Google Sheet
1. Open [Google Sheets](https://docs.google.com/spreadsheets/) and create a new blank spreadsheet.
2. In the first row, create the following headers in columns A, B, C, D:
   - `Timestamp`
   - `Wallet Address`
   - `Task ID (or Description)`
   - `Tokens Earned`
3. Click the **Share** button in the top right.
4. Paste the `client_email` from your downloaded JSON file into the "Add people and groups" field.
5. Give the Service Account **Editor** access and click Send.
6. Look at the URL of your Google Sheet. Copy the long ID between `/d/` and `/edit`.
   `https://docs.google.com/spreadsheets/d/THIS_IS_YOUR_SHEET_ID/edit`

## 3. Update your `.env` file
Add these to your `c:\Users\Saif\Desktop\thebigpicture\.env` file:

```env
GOOGLE_SHEET_ID=your_sheet_id_here
GOOGLE_CLIENT_EMAIL=your_service_account_email_here
GOOGLE_PRIVATE_KEY="your_private_key_here_including_begin_and_end_tags"
```
*Note: Make sure the private key is wrapped in quotes because it contains newlines (`\n`).*

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Helper to initialize and return the Google Sheet instance
export async function getGoogleSheet() {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!sheetId || !clientEmail || !privateKey) {
        throw new Error('Google Sheets missing environment variables (GOOGLE_SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY)');
    }

    // Initialize Auth Node
    const serviceAccountAuth = new JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
        ],
    });

    const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);

    // Load document properties and worksheets
    await doc.loadInfo();
    return doc;
}

/**
 * Appends a row to the first sheet.
 * Assumes the sheet has headers: Temporal/Timestamp, Wallet Address, Task ID, Tokens Earned
 */
export async function appendWorkToSheet({
    walletAddress,
    taskId,
    tokensEarned,
}: {
    walletAddress: string;
    taskId: string;
    tokensEarned: string | number;
}) {
    try {
        const doc = await getGoogleSheet();
        const sheet = doc.sheetsByIndex[0]; // first worksheet

        const timestamp = new Date().toISOString();

        // Append row
        // Keys must exactly match header names if using objects, 
        // OR we can pass an array of values if we are certain of column order.
        // We will pass an array assuming order: Timestamp, Wallet Address, Task ID, Tokens Earned
        await sheet.addRow([
            timestamp,
            walletAddress,
            taskId,
            tokensEarned
        ]);

        return { success: true };
    } catch (error) {
        console.error('Error appending to Google Sheet:', error);
        throw error;
    }
}

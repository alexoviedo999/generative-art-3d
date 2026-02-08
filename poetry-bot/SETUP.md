# Poetry Bot Setup Guide

Follow these steps to set up Google Cloud and configure the bot.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it something like "Poetry Digitization Bot"
4. Click "Create"

## Step 2: Enable APIs

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for and enable:
   - **Google Drive API**
   - **Cloud Vision API**

## Step 3: Create a Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Name: `poetry-bot`
   - Description: `Digitizes handwritten poems`
4. Click "Create and Continue" (skip granting access for now)
5. Click "Done"

## Step 4: Create and Download Key

1. Click on the service account you just created (`poetry-bot`)
2. Go to the "Keys" tab
3. Click "Add Key" → "Create New Key"
4. Select **JSON** format
5. Click "Create" — this will download a JSON file
6. **Important:** Rename it to `google-credentials.json` and move it to the `poetry-bot` folder

## Step 5: Create the Poetry Archive Folder on Drive

1. Go to your [Google Drive](https://drive.google.com/)
2. Create a new folder called "Poetry Archive"
3. Open the folder — the URL will look like:
   `https://drive.google.com/drive/folders/XXXXXXXXXXXXXXXXXXXXXXXXX`
4. Copy the ID after `/folders/` — this is your `ROOT_FOLDER_ID`

## Step 6: Give Service Account Access to Drive

**Option A: Share the folder with service account email**

1. In your downloaded `google-credentials.json`, find the `client_email` field
   - It looks like: `poetry-bot@PROJECT-ID.iam.gserviceaccount.com`
2. Go to your "Poetry Archive" folder on Google Drive
3. Click "Share" → paste that email address
4. Give it "Editor" permission

**Option B: Make it public (not recommended for private poetry)**

Share the folder as "Anyone with the link can view"

## Step 7: Update the Bot Configuration

Open `poetry-bot/bot.js` and update:

1. Replace `YOUR_ROOT_FOLDER_ID` with the ID from Step 5

2. Update the Drive auth section to use your credentials:

```javascript
// Replace this section:
const drive = google.drive({ version: 'v3', auth: null });

// With this:
const credentials = require('./google-credentials.json');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/drive']
});
const drive = google.drive({ version: 'v3', auth });
```

## Step 8: Install Dependencies and Run

```bash
cd poetry-bot
npm install
node bot.js
```

You should see: `🤖 Bot started...`

## Step 9: Test It!

1. Send `/start` to @alexclaw3d_bot
2. Take a photo of a handwritten poem
3. Send it with caption: "libro 1"
4. Wait for the bot to process it
5. Check your Google Drive "Poetry Archive" folder

---

## Troubleshooting

**Bot doesn't start:**
- Check that `node-telegram-bot-api` installed correctly
- Verify the Telegram token is correct

**Google Drive errors:**
- Make sure the service account email has Editor access to the folder
- Verify `ROOT_FOLDER_ID` is correct
- Check that Drive API is enabled

**OCR isn't working well:**
- Try clearer, brighter photos
- Good lighting and flat paper helps
- The Spanish language hint is already configured

**File organization issues:**
- Caption format must be "libro X" (case-insensitive)
- Use numbers 1, 2, 3, etc. — not "uno", "dos"

---

## Costs

**Google Cloud Vision API:**
- First 1000 units/month: **Free**
- After that: $1.50 per 1000 units
- One photo = 1 unit

For 10+ notebooks, you'll likely stay in the free tier unless you're processing thousands of poems.

---

You're all set! 🎉

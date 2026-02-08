/**
 * Simple single-photo version of poetry bot
 * For troubleshooting batch processing issues
 */

const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (err) {
  console.error('❌ config.json not found.');
  process.exit(1);
}

// Check if OAuth token exists
const tokenPath = path.join(__dirname, config.google.tokenFile);
if (!fs.existsSync(tokenPath)) {
  console.error('❌ OAuth token not found. Run: node auth.js');
  process.exit(1);
}

// Load OAuth token
const tokens = JSON.parse(
  fs.readFileSync(tokenPath, 'utf8')
);

// Create OAuth2 client for Drive and Vision APIs
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

oauth2Client.setCredentials(tokens);

// Handle token refresh
oauth2Client.on('tokens', (newTokens) => {
  if (newTokens.refresh_token) {
    tokens.refresh_token = newTokens.refresh_token;
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  }
});

// ==========================================
// Process Lock - Prevent Multiple Instances
// ==========================================
const PID_FILE = path.join(__dirname, '.poetry-bot.pid');

/**
 * Check if another bot instance is already running
 */
function checkLock() {
  if (!fs.existsSync(PID_FILE)) {
    return false; // No lock file, safe to start
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    
    // Check if process with this PID is still running
    try {
      process.kill(pid, 0); // Signal 0 checks if process exists (doesn't kill it)
      return true; // Process is still running, locked
    } catch (e) {
      // Process doesn't exist or we can't check it - assume stale lock
      console.log('⚠️  Stale lock file found (PID not running), cleaning up...');
      fs.unlinkSync(PID_FILE);
      return false; // Lock cleaned, safe to start
    }
  } catch (err) {
    console.error('❌ Error checking lock:', err.message);
    // If we can't check the lock, assume it's stale and clean it
    try {
      fs.unlinkSync(PID_FILE);
    } catch (e) {}
    return false;
  }
}

/**
 * Create lock file with current process PID
 */
function createLock() {
  const pid = process.pid;
  fs.writeFileSync(PID_FILE, pid.toString());
  console.log(`🔒 Lock created: PID ${pid}`);
}

/**
 * Remove lock file (called on shutdown)
 */
function removeLock() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
    console.log('🔓 Lock removed');
  }
}

// Check for existing lock on startup
if (checkLock()) {
  console.error('❌ Bot is already running!');
  console.error('❌ Another instance is already processing photos.');
  console.error('❌ To start a new instance, first stop the running bot:');
  console.error('   pkill -f "node bot-simple"');
  console.error('❌ Or check and kill the process manually.');
  process.exit(1);
}

// Create lock for this instance
createLock();

// Remove lock on graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  removeLock();
  bot.stopPolling();
  console.log('👋 Goodbye!');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  removeLock();
  bot.stopPolling();
  console.log('👋 Goodbye!');
  process.exit(0);
});
// ==========================================

// Telegram bot setup - use primary bot token
const botToken = config.telegram.primary ? config.telegram.primary.token : config.telegram.token;

const bot = new TelegramBot(botToken, {
  polling: {
    params: {
      offset: 0,
      limit: 100,
      timeout: 30
    }
  }
});

// Google Drive setup with OAuth
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const ROOT_FOLDER_ID = config.google.rootFolderId;

// OpenAI setup for Vision OCR (GPT-4 for handwriting)
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Parse caption to get notebook number
 */
function parseNotebookNumber(caption) {
  if (!caption) return null;

  const match = caption.toLowerCase().match(/libro\s*(\d+)/);
  return match ? match[1] : null;
}

/**
 * Preprocess image for better OCR accuracy
 */
async function preprocessImage(imageBuffer) {
  console.log('   Preprocessing image for better OCR...');

  const processedBuffer = await sharp(imageBuffer)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1, m1: 0.5, m2: 2 })
    .resize({ width: 2048, withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  console.log(`   Preprocessed image size: ${processedBuffer.length} bytes`);

  return processedBuffer;
}

/**
 * OCR with GPT-4 Vision for cursive Spanish handwriting
 */
async function ocrWithGpt4(imageBuffer) {
  console.log('   Running OCR with GPT-4 Vision...');

  const base64Image = imageBuffer.toString('base64');

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at transcribing Spanish handwritten poetry. Extract text from image and return ONLY the transcribed text, with no additional commentary.

Rules:
- Preserve original formatting, line breaks, and structure of the poem
- Use Spanish characters properly (á, é, í, ó, ú, ñ, Á, É, Í, Ó, Ú, Ñ)
- If you're uncertain about a word, make your best guess based on context
- Do not add any intro, outro, or explanation
- Return ONLY the poem text`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Transcribe this Spanish handwritten poem. Return only text, preserving original formatting.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1
    });

    const text = response.choices[0].message.content.trim();
    console.log(`   OCR completed, extracted ${text.length} characters`);

    return text;
  } catch (error) {
    console.error('   GPT-4 Vision error:', error.message);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

/**
 * Upload image to Google Drive and make it public
 */
async function uploadImageToDrive(folderId, imageBuffer, fileName) {
  const { Readable } = require('stream');
  const stream = Readable.from(imageBuffer);

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'image/jpeg'
    },
    media: {
      mimeType: 'image/jpeg',
      body: stream
    }
  });

  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  return file.data.id;
}

/**
 * Save OCR text to Google Drive as Markdown with YAML frontmatter
 */
async function saveTextFile(folderId, firstLine, text, notebookNum, imageFileName) {
  const sanitized = firstLine
    .substring(0, 50)
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  const markdownContent = `---
title: "${firstLine}"
book: "Libro ${notebookNum}"
date: "${dateStr}"
language: "es"
image_file: "${imageFileName}"
---

${text}
`;

  const fileName = `${sanitized}.md`;
  const { Readable } = require('stream');
  const stream = Readable.from(markdownContent);

  const file = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'text/markdown'
    },
    media: {
      mimeType: 'text/markdown',
      body: stream
    }
  });

  await drive.permissions.create({
    fileId: file.data.id,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });

  return file;
}

/**
 * Get or create folder for a specific notebook
 */
async function getNotebookFolder(notebookNum) {
  const folderName = `Libro ${notebookNum}`;

  const response = await drive.files.list({
    q: `name = '${folderName}' and '${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)'
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [ROOT_FOLDER_ID]
    }
  });

  return folder.data.id;
}

/**
 * Process a photo message
 */
async function processPhoto(msg, photo) {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  const notebookNum = parseNotebookNumber(caption);

  if (!notebookNum) {
    bot.sendMessage(chatId, '❌ Please include the notebook number in the caption (e.g., "libro 1")');
    return;
  }

  try {
    const statusMsg = await bot.sendMessage(chatId, `📚 Processing photo for Libro ${notebookNum}...`);

    const fileId = photo[photo.length - 1].file_id;
    console.log(`\n   File ID: ${fileId}`);

    const fileInfo = await bot.getFile(fileId);
    console.log(`   File path: ${fileInfo.file_path}`);

    const photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileInfo.file_path}`;
    console.log(`   Photo URL: ${photoUrl}`);

    console.log(`   Downloading photo...`);
    const response = await fetch(photoUrl);
    console.log(`   Fetch response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`   Downloaded ${imageBuffer.length} bytes`);

    const preprocessedBuffer = await preprocessImage(imageBuffer);

    const folderId = await getNotebookFolder(notebookNum);
    console.log(`   Folder ID: ${folderId}`);

    const extractedText = await ocrWithGpt4(preprocessedBuffer);

    if (!extractedText || extractedText.length === 0) {
      throw new Error('Could not read text from this image. Please try with a clearer photo.');
    }

    const firstLine = extractedText.split('\n')[0].trim() || 'poema_sin_titulo';

    const imageFileName = `${firstLine}.jpg`;

    console.log(`   Saving text file to Drive...`);
    await saveTextFile(folderId, firstLine, extractedText, notebookNum, imageFileName);
    console.log(`   Text file saved`);

    console.log(`   Uploading original image to Drive...`);
    const originalFileId = await uploadImageToDrive(folderId, imageBuffer, imageFileName);
    console.log(`   Original image saved to Drive (ID: ${originalFileId})`);

    const maxLength = 3800;
    let displayText = extractedText;

    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '\n\n...(continúa en Drive)';
    }

    await bot.sendMessage(chatId,
      `✅ Done!\n\n` +
      `📁 Libro: ${notebookNum}\n` +
      `📝 Título: "${firstLine}"\n\n` +
      `📄 Poema:\n\n` +
      `${displayText}\n\n` +
      `📄 Texto guardado en Google Drive\n` +
      `🖼️ Imagen guardada en Google Drive`
    );

  } catch (error) {
    console.error('❌ Error processing photo:', error);
    console.error('   Error details:', error.stack);

    // Handle Telegram 409 Conflict (another bot instance with same token)
    if (error.code === 409) {
      console.error('⚠️ 409 Conflict detected — another bot instance is calling getUpdates()');
      console.error('⚠️ This is NOT from this bot instance, but from another process using the same bot token');
      console.error('⚠️ Telegram API rejected our request due to conflict');
      
      bot.sendMessage(chatId, 
        `⚠️ Bot is experiencing API conflicts.\n\n` +
        `This happens when another bot process is using the same token.\n\n` +
        `Possible causes:\n` +
        `• A stale bot process from a previous session\n` +
        `• Bot running on another machine/location\n\n\n` +
        `If this continues, wait 30 seconds for Telegram to resolve.`
      );
    } else {
      bot.sendMessage(chatId, `❌ Error: ${error.message}\n\nCheck the bot logs for more details.`);
    }
  }
}

// Handle photo messages (single photo only)
bot.on('photo', async (msg) => {
  await processPhoto(msg, msg.photo);
});

// Handle start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 Hola! I'm your poetry digitizer (SIMPLE MODE).\n\n` +
    `📚 Send me a photo of a handwritten poem with the notebook number in the caption.\n\n` +
    `Example caption: "libro 1"\n\n` +
    `I'll:\n` +
    `• Upload the photo to Google Drive\n` +
    `• Use GPT-4 Vision to transcribe handwriting\n` +
    `• Save the poem as Markdown with metadata\n` +
    `• Prevent bot conflicts (process lock)\n\n` +
    `Ready when you are! 🖋️`
  );
});

// Handle help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 Help\n\n` +
    `Send a photo with caption "libro X" where X is the notebook number.\n\n` +
    `I'll organize everything into folders on Google Drive.`
  );
});

console.log('🤖 Bot started (simple mode)...');

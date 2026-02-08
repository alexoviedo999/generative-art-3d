const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync('/home/aoviedo/.openclaw/workspace/poetry-bot/config.json'), 'utf8'));
  console.log('✅ Config loaded successfully');
} catch (err) {
  console.error('❌ config.json not found.');
  process.exit(1);
}

// Check which bot instance to use (primary or secondary)
const BOT_TYPE = process.env.BOT_TYPE || 'primary';

console.log(`🔍 Configuration check:`);
console.log(`   Bot Type: ${BOT_TYPE}`);

// Get appropriate bot configuration
let botConfig;
if (BOT_TYPE === 'primary') {
  botConfig = config.telegram.primary || config.telegram;
} else if (BOT_TYPE === 'secondary') {
  botConfig = config.telegram.secondary || { token: process.env.SECONDARY_BOT_TOKEN, name: 'Search Bot' };
} else {
  console.error('❌ Invalid BOT_TYPE. Expected: primary or secondary');
  process.exit(1);
}

console.log(`🔍 Bot configuration:`);
console.log(`   Bot Token: ${botConfig.token ? 'Present' : 'MISSING'}`);
console.log(`   Bot Name: ${botConfig.name || 'Poetry Bot'}`);

// Verify bot configuration
if (!botConfig.token) {
  console.error('❌ Bot token not found!');
  process.exit(1);
}

console.log(`✅ Bot configuration verified`);
console.log('');

// Check if OAuth token exists
const TOKEN_FILE = '/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json';
console.log(`🔑 OAuth token check:`);
console.log(`   Token file: ${TOKEN_FILE}`);
console.log(`   Exists: ${fs.existsSync(TOKEN_FILE)}`);

// Load OAuth token
let tokens;
if (fs.existsSync(TOKEN_FILE)) {
  try {
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    console.log('✅ OAuth token loaded successfully');
  } catch (err) {
    console.error('❌ Error loading OAuth token:', err.message);
    process.exit(1);
  }
} else {
  console.error('❌ OAuth token file not found!');
  console.error(`Please run: node auth.js`);
  process.exit(1);
}

// Create OAuth2 client for Drive and Vision APIs
console.log(`🔐 Creating OAuth2 client...`);
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

oauth2Client.setCredentials(tokens);
console.log(`✅ OAuth2 client created`);

// Handle token refresh
oauth2Client.on('tokens', (newTokens) => {
  if (newTokens.refresh_token) {
    tokens.refresh_token = newTokens.refresh_token;
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log('🔄 OAuth token refreshed');
  }
});

console.log('✅ Token refresh handler registered');
console.log('');

// Telegram bot setup
console.log(`🤖 Creating Telegram bot...`);
const bot = new TelegramBot(botConfig.token, { 
  polling: {
    params: {
      offset: 0,
      limit: 100,
      timeout: 30
    }
  }
});

console.log('✅ Telegram bot created');
console.log('');

// Google Drive setup
console.log(`📁 Creating Google Drive client...`);
const drive = google.drive({ version: 'v3', auth: oauth2Client });
const ROOT_FOLDER_ID = config.google.rootFolderId;

console.log(`✅ Google Drive initialized`);
console.log(`   Root folder ID: ${ROOT_FOLDER_ID}`);
console.log('');

// OpenAI setup
console.log(`🤖 Creating OpenAI client...`);
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

console.log('✅ OpenAI initialized');
console.log(`   Model: ${config.openai.model || 'gpt-4o'}`);
console.log('');

// ==========================================
// Process Lock - Prevent Multiple Instances
// ==========================================
const PID_FILE = '/home/aoviedo/.openclaw/workspace/poetry-bot/.poetry-bot.pid';

console.log(`🔒 Process lock check:`);
console.log(`   PID file: ${PID_FILE}`);

/**
 * Check if another bot instance is already running
 */
function checkLock() {
  console.log(`   Checking if lock exists...`);
  
  if (!fs.existsSync(PID_FILE)) {
    console.log('   ✅ No lock file found - safe to start');
    return false; 
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    console.log(`   Lock file contains PID: ${pid}`);
    
    // Check if process with this PID is still running
    try {
      process.kill(pid, 0); 
      console.log('   ✅ Process ${pid} is still running - LOCKED');
      return true; 
    } catch (e) {
      console.log(`   Process ${pid} not found or cannot check - assuming clean`);
      console.log(`   Cleaning up stale lock file...`);
      try {
        fs.unlinkSync(PID_FILE);
        console.log('   ✅ Stale lock cleaned up');
      } catch (cleanupError) {
        console.log(`   Cleanup warning: ${cleanupError.message}`);
      }
      return false; 
    }
  } catch (err) {
    console.error('   ❌ Error checking lock:', err.message);
    
    // If we can't check, try to clean
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
console.log('Checking for existing bot instance...');
if (checkLock()) {
  console.error('❌ Bot is already running!');
  console.error(`   Lock file: ${PID_FILE}`);
  console.error('   Bot type: ${BOT_TYPE}`);
  console.error('   To fix:');
  console.error('   1. Kill existing bot processes: pkill -9 -f "node.*bot"');
  console.error('   2. Or manually remove lock file: rm ' + PID_FILE);
  process.exit(1);
}

console.log('✅ No existing lock - safe to start');
createLock();

console.log('✅ Lock created successfully');
console.log('');

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
console.log('✅ Shutdown handlers registered');
console.log('');
console.log('========================================');
// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Parse caption to get notebook number
 * Expects format: "libro 1", "libro 2", etc.
 */
function parseNotebookNumber(caption) {
  if (!caption) return null;

  const match = caption.toLowerCase().match(/libro\s*(\d+)/);
  return match ? match[1] : null;
}

/**
 * Preprocess image for better OCR accuracy
 * - Convert to grayscale
 * - Increase contrast
 * - Sharpen edges
 * - Enhance for text recognition
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
 * - Returns extracted text
 */
async function ocrWithGpt4(imageBuffer) {
  console.log('   Running OCR with GPT-4 Vision...');

  const base64Image = imageBuffer.toString('base64');

  // First try OpenAI (preferred)
  let response;
  try {
    if (openai.apiKey) {
      response = await openai.chat.completions.create({
        model: config.openai.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: \`You are an expert at transcribing Spanish handwritten poetry. Extract text from image and return ONLY transcribed text, with no additional commentary.

Rules:
- Preserve original formatting, line breaks, and structure of poem
- Use Spanish characters properly (á, é, í, ó, ú, ñ, Á, É, Í, Ó, Ú, Ñ)
- If you're uncertain about a word, make your best guess based on context
- Do not add any intro, outro, or explanation
- Return ONLY the poem text\`
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
                  url: \`data:image/jpeg;base64,\${base64Image}\`
                }
              }
            ]
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      });
      
      console.log('✅ OpenAI OCR completed');
    } catch (openaiError) {
      console.error('⚠️  OpenAI error, trying Google Vision fallback:', openaiError.message);
    }
  }

  // Fallback to Google Vision if OpenAI fails or no key
  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
    console.log('⚠️  OpenAI unavailable, using Google Vision fallback');
    try {
      response = await vision.images.annotate({
        requestBody: {
          requests: [{
            image: {
              content: imageBuffer
            },
            features: [{
              type: 'DOCUMENT_TEXT_DETECTION'
            }],
            imageContext: {
              languageHints: ['es-419', 'es', 'en']
            }
          }]
        }
      });
      
      if (response.responses && response.responses[0] && response.responses[0].fullTextAnnotation) {
        console.log('✅ Google Vision completed');
        return response.responses[0].fullTextAnnotation.text;
      } else if (response.responses && response.responses[0] && response.responses[0].textAnnotations) {
        console.log('✅ Google Vision completed');
        return response.responses[0].textAnnotations.map(ta => t.description).join('\\n');
      } else {
        console.log('⚠️  Google Vision returned no text');
        throw new Error('Could not extract text from image');
      }
    } catch (visionError) {
      console.error('❌ Google Vision fallback error:', visionError.message);
      throw new Error(\`Vision failed: \${visionError.message}\`);
    }
  }

  if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
    throw new Error('Could not extract text from image');
  }

  const text = response.choices[0].message.content.trim();
  console.log(\`   OCR completed, extracted \${text.length} characters\`);

  return text;
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

  console.log(\`   Image file created: \${file.data.id}\`);

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

  const markdownContent = \`---
title: "\${firstLine}"
book: "Libro \${notebookNum}"
date: "\${dateStr}"
language: "es"
image_file: "\${imageFileName}"
---

\${text}
\`;

  const fileName = \`\${sanitized}.md\`;

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
  const folderName = \`Libro \${notebookNum}\`;

  const response = await drive.files.list({
    q: \`name = '\${folderName}' and '\${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false\`,
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
 * Process a single photo
 */
async function processSinglePhoto(msg, photo, index, total, notebookNum, statusMsg) {
  const chatId = msg.chat.id;

  try {
    if (statusMsg) {
      await bot.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        \`📚 Processing photo \${index}/\${total} for Libro \${notebookNum}...\`
      );
    } else {
      statusMsg = await bot.sendMessage(chatId, \`📚 Processing photo for Libro \${notebookNum}...\`);
    }

    const fileId = photo[photo.length - 1].file_id;
    console.log(\`\\n   [Photo \${index}/\${total}] File ID: \${fileId}\`);

    const fileInfo = await bot.getFile(fileId);
    console.log(\`   File path: \${fileInfo.file_path}\`);

    const photoUrl = \`https://api.telegram.org/file/bot\${botConfig.token}/\${fileInfo.file_path}\`;
    console.log(\`   Photo URL: \${photoUrl}\`);

    console.log(\`   Downloading photo...\`);
    const response = await fetch(photoUrl);
    console.log(\`   Fetch response status: \${response.status}\`);

    if (!response.ok) {
      throw new Error(\`Failed to download photo: \${response.status} \${response.statusText}\`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(\`   Downloaded \${imageBuffer.length} bytes\`);

    const preprocessedBuffer = await preprocessImage(imageBuffer);

    console.log(\`   Getting/creating notebook folder...\`);
    const folderId = await getNotebookFolder(notebookNum);

    const extractedText = await ocrWithGpt4(preprocessedBuffer);

    if (!extractedText || extractedText.length === 0) {
      await bot.sendMessage(chatId, '❌ Could not read text from this image. Please try with a clearer photo.');
      return;
    }

    const firstLine = extractedText.split('\\n')[0].trim() || 'poema_sin_titulo';

    const imageFileName = \`\\${firstLine}.jpg\`;

    console.log(\`   Saving text file to Drive...\`);
    await saveTextFile(folderId, firstLine, extractedText, notebookNum, imageFileName);
    console.log(\`   Text file saved\`);

    console.log(\`   Uploading original image to Drive for storage...\`);
    const originalFileId = await uploadImageToDrive(folderId, imageBuffer, imageFileName);
    console.log(\`   Original image saved to Drive (ID: \${originalFileId}\`);

    const maxLength = statusMsg ? 1000 : 3800;
    let displayText = extractedText;

    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '\\n\\n...(continúa en Drive)';
    }

    await bot.sendMessage(chatId,
      \`✅ \${statusMsg ? \`Poema \${index}/\${total}\` : 'Done'}!\` +
      \`\\n\\n\` +
      \`📁 Libro: \${notebookNum}\\n\` +
      \`📝 Título: "\${firstLine}"\\n\\n\` +
      \`📄 Poema:\\n\\n\` +
      \`\\${displayText}\\n\\n\` +
      \`📄 Texto guardado en Google Drive\\n\` +
      \`🖼️ Imagen guardada en Google Drive\`
    );

    return { success: true, title: firstLine };

  } catch (error) {
    console.error(\`❌ Error processing photo \${index || 1}:\\n\`, error);
    console.error(\`   Error details:\`, error.stack);

    // Handle Telegram 409 Conflict (another bot instance with same token)
    if (error.code === 409) {
      console.error(\`⚠️ 409 Conflict detected — another bot instance is calling getUpdates()\`);
      console.error(\`   This is NOT from this bot instance, but from another process using the same bot token\`);
      console.error(\`   Telegram API rejected our request due to conflict\`);
      
      bot.sendMessage(chatId,
        \`⚠️ Bot is experiencing API conflicts.\\n\\n\` +
        \`This happens when another bot process is using the same bot token.\\n\\n\` +
        \`Possible causes:\\n\\n\` +
        \`• A stale bot process from a previous session\\n\\n\` +
        \`• Bot running on another machine/location\\n\\n\` +
        \`If this continues, wait 30 seconds for Telegram to resolve.\`
      );
    } else {
      bot.sendMessage(chatId, \`❌ Error: \${error.message}\\n\\nCheck the bot logs for more details.\`);
    }
  }
}

/**
 * Process a batch of photos
 */
async function processBatch(msg, photos) {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  const notebookNum = parseNotebookNumber(caption);

  if (!notebookNum) {
    bot.sendMessage(chatId, '❌ Please include the notebook number in the caption (e.g., "libro 1", "libro 2")');
    return;
  }

  const total = photos.length;

  const statusMsg = await bot.sendMessage(chatId,
    \`📚 Starting batch process for Libro \${notebookNum}...\\n\\n\` +
    \`📸 Processing \${total} photo(s)... (bot: \${BOT_TYPE})\`
  );

  console.log(\`\\n📚 BATCH PROCESSING: \${total} photos for Libro \${notebookNum} (bot: \${BOT_TYPE})\\n\`);

  const results = [];
  for (let i = 0; i < total; i++) {
    const result = await processSinglePhoto(msg, photos[i], i + 1, total, notebookNum, statusMsg);
    results.push(result);
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(\`\\n📊 BATCH COMPLETE: \${successful}/\${total} successful, \${failed} failed (bot: \${BOT_TYPE})\\n\`);

  const summaryTitles = results
    .filter(r => r.success)
    .map(r => \`✅ \${r.title}\`)
    .join('\\n');

  const failedErrors = results
    .filter(r => !r.success)
    .map((r, i) => \`❌ \${i + 1}. \${r.error}\`)
    .join('\\n');

  let summaryMsg = \`🎉 Batch complete for Libro \${notebookNum}! (bot: \${BOT_TYPE})\\n\\n\` +
    \`📊 \${successful}/\${total} successful\\n\`;

  if (failed > 0) {
    summaryMsg += \`\\n⚠️ \${failed} failed\\n\`;
  }

  if (summaryTitles) {
    summaryMsg += \`\\n\\n📝 Poemas procesados:\\n\${summaryTitles}\\n\`;
  }

  if (failedErrors) {
    summaryMsg += \`\\n\\n❌ Errores:\\n\${failedErrors}\\n\`;
  }

  await bot.sendMessage(chatId, summaryMsg);
}

// ==========================================
// Media Group Handling (Batch Processing)
// ==========================================
const mediaGroups = new Map(); // Track grouped photos

bot.on('photo', async (msg) => {
  if (msg.media_group_id) {
    // This photo is part of a batch (multiple photos sent at once)
    if (!mediaGroups.has(msg.media_group_id)) {
      mediaGroups.set(msg.media_group_id, {
        photos: [],
        caption: null  // Will be set from first photo with caption
      });
    }

    const group = mediaGroups.get(msg.media_group_id);

    // Store caption from first photo that has one
    if (msg.caption && msg.caption.trim() && !group.caption) {
      group.caption = msg.caption;
    }

    // Add this photo to the group
    group.photos.push(msg.photo);

    // Process batch after a short delay (wait for all photos to arrive)
    setTimeout(async () => {
      mediaGroups.delete(msg.media_group_id);

      if (group.photos.length > 1) {
        // Batch process multiple photos
        const caption = group.caption || '';
        await processBatch({ ...msg, caption }, group.photos);
      } else {
        // Single photo in group
        await processSinglePhoto({ ...msg, caption: group.caption }, group.photos[0]);
      }
    }, 1000);
  } else {
    // Single photo (not in a media group)
    await processSinglePhoto(msg, msg.photo);
  }
});

// ==========================================
// Command Handlers
// ==========================================

// Handle start command
bot.onText(/\\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    \`👋 Hola! I'm your poetry digitizer (bot: \${BOT_TYPE}).\\n\\n\` +
    \`📚 Send me a photo of a handwritten poem with the notebook number in the caption.\\n\\n\` +
    \`Example caption: "libro 1"\\n\\n\` +
    \`I'll:\\n\\n\` +
    \`• Upload photo to Google Drive\\n\\n\` +
    \`• Use GPT-4 Vision to transcribe handwriting\\n\\n\` +
    \`• Save poem as Markdown with metadata\\n\\n\` +
    \`• Process lock prevents multiple instances\\n\\n\` +
    \`• Supports batch processing (send multiple photos at once)\\n\\n\` +
    \`Ready when you are! 🖋️\`
  );
});

// Handle help command
bot.onText(/\\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    \`📖 Help\\n\\n\` +
    \`Send a photo with caption "libro X" where X is the notebook number.\\n\\n\` +
    \`Features:\\n\\n\` +
    \`• Single photo: Send one photo\\n\\n\` +
    \`• Batch: Send multiple photos, same caption applies to all\\n\\n\` +
    \`• Search: /search <keyword> [notebook] — Find poems by keyword\\n\\n\` +
    \`• Export: /export <notebook> — Download all poems as text\\n\\n\` +
    \`I'll organize everything into folders on Google Drive.\\n\\n\`
  );
});

console.log(\`🤖 Bot started (bot: \${BOT_TYPE})...`);

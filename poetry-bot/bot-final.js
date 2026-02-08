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
} catch (err) {
  console.error('❌ config.json not found.');
  process.exit(1);
}

// Check which bot instance to use (primary or secondary)
const BOT_TYPE = process.env.BOT_TYPE || 'primary';

// Get appropriate bot configuration
const botConfig = config.telegram[BOT_TYPE] || config.telegram;

console.log('🔍 Configuration check:');
console.log(`   Bot Type: ${BOT_TYPE}`);

// Verify bot configuration
if (!botConfig.token) {
  console.error('❌ Bot token not found for "${BOT_TYPE}" bot in config.json');
  console.error(`Please add "telegram.${BOT_TYPE}.token" to config.json`);
  process.exit(1);
}

console.log('✅ Bot token configured');
console.log('');

// ==========================================
// GOOGLE APIS SETUP
// ==========================================

// Check for OAuth tokens (with resolved paths)
console.log('🔑 Checking for OAuth tokens...');

let tokens;
let oauth2Client;
let drive;
let vision;

// Try loading primary token
if (fs.existsSync('/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json')) {
  try {
    tokens = JSON.parse(fs.readFileSync('/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json'), 'utf8'));
    console.log('✅ Primary OAuth token found');
  } catch (err) {
    console.error('Could not load primary token:', err.message);
  }
}

// Try loading secondary token if needed
if (BOT_TYPE === 'secondary' && fs.existsSync('/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json')) {
  try {
    const secondaryTokens = JSON.parse(fs.readFileSync('/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json'), 'utf8'));
    // Merge tokens if primary exists
    tokens = { ...tokens, ...secondaryTokens };
    console.log('✅ Secondary OAuth token found');
  } catch (err) {
    console.error('Could not load secondary token:', err.message);
  }
}

// Determine which token to use
const activeTokens = tokens || { access_token: 'MISSING_TOKEN' };

// Create OAuth2 client for Drive and Vision APIs
oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

// Use available tokens or placeholder
if (activeTokens.access_token) {
  oauth2Client.setCredentials(activeTokens);
  console.log('✅ OAuth2 configured with tokens');
} else {
  // Create placeholder for missing tokens
  activeTokens = {
    access_token: 'PLACEHOLDER_TOKEN',
    refresh_token: 'PLACEHOLDER_REFRESH_TOKEN'
  };
  console.log('⚠️ Using placeholder OAuth tokens');
}

// Handle token refresh
oauth2Client.on('tokens', (newTokens) => {
  if (newTokens.access_token && newTokens.access_token !== 'PLACEHOLDER_ACCESS_TOKEN') {
    activeTokens.access_token = newTokens.access_token;
    if (newTokens.refresh_token) {
      activeTokens.refresh_token = newTokens.refresh_token;
    }
    
    // Save to appropriate token file
    const tokenFile = BOT_TYPE === 'primary' ? '/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json' : '/home/aoviedo/.openclaw/workspace/poetry-bot/oauth-token.json';
    fs.writeFileSync(tokenFile, JSON.stringify(activeTokens, null, 2));
    console.log(`🔄 OAuth token refreshed (saved to ${tokenFile})`);
  }
});

console.log('✅ Token refresh handler registered');
console.log('');

// Telegram bot setup
bot = new TelegramBot(activeTokens.access_token, { 
  polling: {
    params: {
      offset: 0,
      limit: 100,
      timeout: 30
    }
  }
});

console.log('✅ Telegram bot created with tokens');
console.log('');

// Google Drive setup with OAuth
drive = google.drive({ version: 'v3', auth: oauth2Client });

const ROOT_FOLDER_ID = config.google.rootFolderId;

console.log('✅ Google Drive initialized with OAuth');

// OpenAI setup for Vision OCR (GPT-4 for handwriting)
if (config.openai.apiKey) {
  vision = google.vision({ version: 'v1', auth: oauth2Client });
  console.log('✅ Google Vision initialized with OAuth');
} else {
  console.error('❌ OpenAI API key not found');
  process.exit(1);
}

const ROOT_FOLDER_ID = config.google.rootFolderId;

console.log('📁 Root folder ID:', ROOT_FOLDER_ID);

// ==========================================
// Process Lock - Prevent Multiple Instances
// ==========================================
const PID_FILE = '/home/aoviedo/.openclaw/workspace/poetry-bot/.poetry-bot.pid';

console.log('🔍 Process lock check:');
console.log(`   PID file: ${PID_FILE}`);

/**
 * Check if another bot instance is already running
 */
function checkLock() {
  console.log(`   Checking if lock exists...`);
  
  if (!fs.existsSync(PID_FILE)) {
    console.log('✅ No lock file found - safe to start');
    return false; 
  }

  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    console.log(`   Lock file contains PID: ${pid}`);
    
    // Check if process with this PID is still running
    try {
      process.kill(pid, 0); 
      console.log(`✅ Process ${pid} is still running - LOCKED`);
      return true; 
    } catch (e) {
      console.log(`⚠️  Cannot check process ${pid}: ${e.message}`);
      console.log(`   Assuming process is not running - safe to overwrite lock`);
      return false; 
    }
  } catch (err) {
    console.error('❌ Error checking lock:', err.message);
    
    // If we can't check, try to clean it
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
  console.log(`🔒 Lock created: PID ${pid} (bot: ${BOT_TYPE})`);
}

/**
 * Remove lock file (called on shutdown)
 */
function removeLock() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
    console.log('🔓 Lock removed (bot: ${BOT_TYPE})');
  }
}

// Check for existing lock on startup
console.log('🔍 Checking for existing bot instance...');
if (checkLock()) {
  console.error('❌ Bot is already running!');
  console.error(`   Lock file: ${PID_FILE}`);
  console.error(`   Bot type: ${BOT_TYPE}`);
  console.error('   To start a new instance, first stop running bot:');
  console.error(`   pkill -f "node.*bot"`);
  console.error(`   Or manually remove lock file: rm ${PID_FILE}`);
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

  // First try OpenAI GPT-4o with OAuth (preferred)
  let response;
  try {
    response = await openai.chat.completions.create({
      model: config.openai.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at transcribing Spanish handwritten poetry. Extract text from image and return ONLY transcribed text, with no additional commentary.

Rules:
- Preserve original formatting, line breaks, and structure of poem
- Use Spanish characters properly (á, é, í, ó, ú, ñ, Á, É, Í, Ó, Ú, Ñ)
- If you're uncertain about a word, make your best guess based on context
- Do not add any intro, outro, or explanation
- Return ONLY: poem text`
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
  } catch (openaiError) {
    console.log('⚠️  OpenAI API error (using fallback):', openaiError.message);
  }

  // Fallback to Google Vision if OpenAI failed or not configured
  if (!response || !response.choices || !response.choices[0].message) {
    console.log('⚠️  Using Google Vision fallback (no OpenAI response)');
    
    try {
      response = await vision.images.annotate({
        requestBody: {
          requests: [{
            image: imageBuffer
          }],
          features: [{
            type: 'DOCUMENT_TEXT_DETECTION'
          }],
          imageContext: {
            languageHints: ['es-419', 'es', 'en']
          }
        }
      });
      
      if (response.responses && response.responses[0] && response.responses[0].fullTextAnnotation) {
        console.log('✅ Google Vision fallback completed');
        return response.responses[0].fullTextAnnotation.text;
      } else if (response.responses && response.responses[0].textAnnotations && response.responses[0].textAnnotations.length > 0) {
        console.log('✅ Google Vision returned text annotations');
        return response.responses[0].textAnnotations.map(ta => t.description).join('\n');
      } else {
        console.log('⚠️  Google Vision returned no text');
        throw new Error('Could not extract text from image');
      }
    } catch (visionError) {
      console.log('❌ Google Vision fallback error:', visionError.message);
      throw new Error(`Vision failed: ${visionError.message}`);
    }
  }

  return response ? response.responses[0].fullTextAnnotation.text || response.responses[0]?.textAnnotations?.join('\n') : '';
}

/**
 * Upload image to Google Drive and make it public
 */
async function uploadImageToDrive(folderId, imageBuffer, fileName) {
  const { Readable } = require('stream');
  
  // Convert buffer to readable stream
  const stream = Readable.from(imageBuffer);

  try {
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

    console.log(`   Image file created: ${file.data.id}`);

    // Make file publicly readable
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return file.data.id;
  } catch (error) {
    console.error('❌ Drive API Error (uploadImageToDrive):');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    if (error.response) {
      console.error('   Response data:', error.response.data);
    }
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Save OCR text to Google Drive as Markdown with YAML frontmatter
 */
async function saveTextFile(folderId, firstLine, text, notebookNum, imageFileName) {
  // Clean up first line for filename
  const sanitized = firstLine
    .substring(0, 50)
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  // Generate metadata
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  // Create Markdown with YAML frontmatter
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

  // Convert text to readable stream
  const { Readable } = require('stream');
  const stream = Readable.from(markdownContent);

  try {
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

    console.log(`   Text file created: ${file.data.id}`);

    // Make file publicly readable
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    return file;
  } catch (error) {
    console.error('❌ Drive API Error (saveTextFile):');
    console.error('   Code:', error.code);
    console.error('   Message:', error.message);
    if (error.response) {
      console.error('   Response data:', error.response.data);
    }
    throw new Error(`Failed to save text: ${error.message}`);
  }
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
 * Process a single photo
 */
async function processSinglePhoto(msg, photo, index, total, notebookNum, statusMsg) {
  const chatId = msg.chat.id;

  try {
    // Update status for batch, or send initial for single
    if (statusMsg) {
      await bot.editMessageText(
        statusMsg.chat.id,
        statusMsg.message_id,
        `📚 Processing photo ${index}/${total} for Libro ${notebookNum}...`
      );
    } else {
      statusMsg = await bot.sendMessage(chatId, `📚 Processing photo for Libro ${notebookNum}...`);
    }

    // Get the largest photo
    const fileId = photo[photo.length - 1].file_id;
    console.log(`\n   [Photo ${index}/${total}] File ID: ${fileId}`);

    const fileInfo = await bot.getFile(fileId);
    console.log(`   File path: ${fileInfo.file_path}`);

    const photoUrl = `https://api.telegram.org/file/bot${activeTokens.access_token}/${fileInfo.file_path}`;
    console.log(`   Photo URL: ${photoUrl}`);

    // Download photo buffer
    console.log(`   Downloading photo...`);
    const response = await fetch(photoUrl);
    console.log(`   Fetch response status: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Failed to download photo: ${response.status} ${response.statusText}`);
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`   Downloaded ${imageBuffer.length} bytes`);

    // Preprocess image for better OCR
    const preprocessedBuffer = await preprocessImage(imageBuffer);

    // Get or create notebook folder
    console.log(`   Getting/creating notebook folder...`);
    const folderId = await getNotebookFolder(notebookNum);

    // OCR with GPT-4 Vision (uses preprocessed image directly)
    const extractedText = await ocrWithGpt4(preprocessedBuffer);

    if (!extractedText || extractedText.length === 0) {
      await bot.editMessageText(
        '❌ Could not read text from this image. Please try with a clearer photo.',
        {
          chat_id: statusMsg.chat.id,
          message_id: statusMsg.message_id
        }
      );
      return;
    }

    const firstLine = extractedText.split('\n')[0].trim() || 'poema_sin_titulo';

    // Generate image filename
    const imageFileName = `${firstLine}.jpg`;

    // Save text file to Drive as Markdown with YAML frontmatter
    console.log(`   Saving text file to Drive...`);
    await saveTextFile(folderId, firstLine, extractedText, notebookNum, imageFileName);
    console.log(`   Text file saved`);

    // Upload ORIGINAL (non-preprocessed) image to Drive for storage
    console.log(`   Uploading original image to Drive for storage...`);
    const originalFileId = await uploadImageToDrive(folderId, imageBuffer, imageFileName);
    console.log(`   Original image saved to Drive (ID: ${originalFileId}`);

    // Prepare poem text for Telegram (truncated if needed)
    const maxLength = statusMsg ? 1000 : 3800;
    let displayText = extractedText;

    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '\n\n...(continúa en Drive)';
    }

    // Send individual poem message
    await bot.sendMessage(chatId,
      `✅ ${statusMsg ? `Poema ${index}/${total}` : 'Done'}!\n\n` +
      `📁 Libro: ${notebookNum}\n` +
      `📝 Título: "${firstLine}"\n\n` +
      `📄 Poema:\n\n` +
      `${displayText}\n\n` +
      `📄 Texto guardado en Google Drive\n` +
      `🖼️ Imagen guardada en Google Drive`
    );

    return { success: true, title: firstLine };

  } catch (error) {
    console.error('❌ Error processing photo:', error);
    console.error('   Error details:', error.stack);

    // Handle Telegram 409 Conflict (another bot instance with same token)
    if (error.code === 409) {
      console.error('⚠️ 409 Conflict detected — another bot instance is calling getUpdates()');
      console.error('   This is NOT from this bot instance, but from another process using the same bot token');
      console.error('   Telegram API rejected our request due to conflict');
      
      bot.sendMessage(chatId, 
        `⚠️ Bot is experiencing API conflicts.\n\n` +
        `This happens when another bot process is using the same bot token.\n\n` +
        `Possible causes:\n` +
        `• A stale bot process from a previous session\n` +
        `• Bot running on another machine/location\n\n\n` +
        `If this continues, wait 30 seconds for Telegram to resolve.`
      );
    } else {
      bot.sendMessage(chatId, `❌ Error: ${error.message}\n\nCheck bot logs for more details.`);
    }
  }
}

/**
 * Process a batch of photos
 */
async function processBatch(msg, photos) {
  const chatId = msg.chat.id;
  const caption = msg.caption || '';

  // Parse notebook number
  const notebookNum = parseNotebookNumber(caption);

  if (!notebookNum) {
    bot.sendMessage(chatId, '❌ Please include the notebook number in the caption (e.g., "libro 1", "libro 2")');
    return;
  }

  const total = photos.length;

  // Send initial status message
  const statusMsg = await bot.sendMessage(chatId,
    `📚 Starting batch process for Libro ${notebookNum}...\n\n` +
    `📸 Processing ${total} photo(s)... (bot: ${BOT_TYPE})`
  );

  console.log(`\n📚 BATCH PROCESSING: ${total} photos for Libro ${notebookNum} (bot: ${BOT_TYPE})`);

  const results = [];
  for (let i = 0; i < total; i++) {
    const result = await processSinglePhoto(msg, photos[i], i + 1, total, notebookNum, statusMsg);
    results.push(result);
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 BATCH COMPLETE: ${successful}/${total} successful, ${failed} failed (bot: ${BOT_TYPE})`);

  // Send summary
  const summaryTitles = results
    .filter(r => r.success)
    .map(r => `✅ ${r.title}`)
    .join('\n');

  const failedErrors = results
    .filter(r => !r.success)
    .map((r, i) => `❌ ${i + 1}. ${r.error}`)
    .join('\n');

  let summaryMsg = `🎉 Batch complete for Libro ${notebookNum}! (bot: ${BOT_TYPE})\n\n` +
    `📊 ${successful}/${total} successful`;

  if (failed > 0) {
    summaryMsg += `\n⚠️ ${failed} failed`;
  }

  if (summaryTitles) {
    summaryMsg += `\n\n📝 Poemas procesados:\n${summaryTitles}`;
  }

  if (failedErrors) {
    summaryMsg += `\n\n❌ Errores:\n${failedErrors}`;
  }

  await bot.sendMessage(chatId, summaryMsg);
}

// ==========================================
// Media Group Handling (Batch Processing)
// ==========================================
const mediaGroups = new Map();

bot.on('photo', async (msg) => {
  if (msg.media_group_id) {
    // This photo is part of a batch (multiple photos sent at once)
    if (!mediaGroups.has(msg.media_group_id)) {
      mediaGroups.set(msg.media_group_id, {
        photos: [],
        caption: null
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
        const caption = group.caption || '';
        await processBatch({ ...msg, caption }, group.photos);
      } else {
        await processSinglePhoto({ ...msg, caption: group.caption }, group.photos[0]);
      }
    }, 1000);
  } else {
    await processSinglePhoto(msg, msg.photo);
  }
});

// ==========================================
// Command Handlers
// ==========================================

// Handle start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 Hola! I'm your poetry digitizer (bot: ${BOT_TYPE}).\n\n` +
    `📚 Send me a photo of a handwritten poem with the notebook number in the caption.\n\n` +
    `Example caption: "libro 1"\n\n` +
    `Features:\n` +
    `• Upload photo to Google Drive\n` +
    `• Use GPT-4 Vision to transcribe handwriting\n` +
    `• Save poem as Markdown with metadata\n` +
    `• Supports batch processing (send multiple photos at once!)\n` +
    `• Process lock prevents multiple instances\n` +
    `Ready when you are! 🖋️`
  );
});

// Handle help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 Help\n\n` +
    `Send a photo with caption "libro X" where X is the notebook number.\n\n` +
    `Features:\n` +
    `• Single photo: Send one photo\n` +
    `• Batch: Send multiple photos at once\n` +
    `• Search: /search <keyword> [notebook] — Find poems by keyword\n` +
    `• Export: /export <notebook> — Download all poems\n` +
    `• Process lock prevents multiple instances\n\n` +
    `• Multiple bot support: Set BOT_TYPE=secondary\n\n` +
    `I'll organize everything into folders on Google Drive.`
  );
});

console.log(`🤖 Bot started (bot: ${BOT_TYPE})...`);

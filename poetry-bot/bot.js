const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const { Readable } = require('stream');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

  // Check for OpenAI API key
  if (!config.openai || !config.openai.apiKey) {
    console.error('❌ OpenAI API key not found in config.json.');
    console.error('Please add your OpenAI API key to config.json under "openai.apiKey"');
    process.exit(1);
  }
} catch (err) {
  console.error('❌ config.json not found. Copy config.json.example to config.json and fill in the values.');
  process.exit(1);
}

// Check if OAuth token exists
const tokenPath = path.join(__dirname, config.google.tokenFile);
if (!fs.existsSync(tokenPath)) {
  console.error('❌ OAuth token not found. Run: node auth.js');
  process.exit(1);
}

// Load OAuth token
const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));

// Create OAuth2 client for both Drive and Vision APIs
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

// Telegram bot setup
const bot = new TelegramBot(config.telegram.token, { polling: true });

// Google Drive setup with OAuth
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const ROOT_FOLDER_ID = config.google.rootFolderId;

// OpenAI setup for Vision OCR (GPT-4 for handwriting)
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});
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
  console.log(`   Preprocessing image for better OCR...`);

  const processedBuffer = await sharp(imageBuffer)
    .grayscale() // Remove color for better contrast
    .normalize() // Stretch contrast to full range
    .sharpen({ sigma: 1, m1: 0.5, m2: 2 }) // Sharpen edges
    .resize({ width: 2048, withoutEnlargement: true }) // Upscale if too small (helps OCR)
    .jpeg({ quality: 90 }) // Convert to high-quality JPEG
    .toBuffer();

  console.log(`   Preprocessed image size: ${processedBuffer.length} bytes`);

  return processedBuffer;
}

/**
 * OCR with GPT-4 Vision for cursive Spanish handwriting
 * - Returns the extracted text
 * - Returns the first line (for filename)
 */
async function ocrWithGpt4(imageBuffer) {
  console.log(`   Running OCR with GPT-4 Vision...`);

  // Convert image to base64
  const base64Image = imageBuffer.toString('base64');

  try {
    const response = await openai.chat.completions.create({
      model: config.openai.model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert at transcribing Spanish handwritten poetry. Extract the text from the image and return ONLY the transcribed text, with no additional commentary.

Rules:
- Preserve the original formatting, line breaks, and structure of the poem
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
              text: 'Transcribe this Spanish handwritten poem. Return only the text, preserving the original formatting.'
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
      temperature: 0.1 // Low temperature for more accurate transcription
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
 * Get or create folder for a specific notebook
 */
async function getNotebookFolder(notebookNum) {
  const folderName = `Libro ${notebookNum}`;

  // Search for existing folder
  const response = await drive.files.list({
    q: `name = '${folderName}' and '${ROOT_FOLDER_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)'
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Create new folder if it doesn't exist
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
 * Upload image to Google Drive and make it public
 */
async function uploadImageToDrive(folderId, imageBuffer, fileName) {
  // Convert buffer to readable stream using Readable.from()
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

  // Make the file publicly readable
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
  // Clean up first line for filename
  const sanitized = firstLine
    .substring(0, 50)
    .replace(/[^\w\s-áéíóúñÁÉÍÓÚÑ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');

  // Generate metadata
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

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

  // Convert text to readable stream using Readable.from()
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

  // Make the file publicly readable (optional)
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
 * Process a single photo (used by both single and batch modes)
 */
async function processSinglePhoto(msg, photo, index, total, notebookNum, statusMsg) {
  const chatId = msg.chat.id;

  try {
    // Update status for batch, or send initial for single
    if (statusMsg) {
      await bot.editMessageText(
        statusMsg.chat.id, statusMsg.message_id,
        `📚 Processing photo ${index}/${total} for Libro ${notebookNum}...`
      );
    } else {
      statusMsg = await bot.sendMessage(chatId, `📚 Processing photo for Libro ${notebookNum}...`);
    }

    // Get the largest photo
    const fileId = photo[photo.length - 1].file_id;
    console.log(`\n   [Photo ${index || 1}/${total || 1}] File ID: ${fileId}`);

    const fileInfo = await bot.getFile(fileId);
    console.log(`   File path: ${fileInfo.file_path}`);

    const photoUrl = `https://api.telegram.org/file/bot${config.telegram.token}/${fileInfo.file_path}`;
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
      throw new Error('Could not read text from this image. Please try with a clearer photo.');
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
    console.log(`   Original image saved to Drive (ID: ${originalFileId})`);

    // Prepare poem text for Telegram (truncated if needed)
    const maxLength = statusMsg ? 1000 : 3800; // Shorter for batch messages
    let displayText = extractedText;

    if (displayText.length > maxLength) {
      displayText = displayText.substring(0, maxLength) + '\n\n...(continúa en Drive)';
    }

    // Send individual poem message
    await bot.sendMessage(chatId,
      `✅ ${statusMsg ? `Poema ${index}/${total}` : 'Done'}!\n\n` +
      `📁 Libro: ${notebookNum}\n` +
      `📝 Título: "${firstLine}"\n\n` +
      `${displayText}\n\n` +
      `📄 Texto guardado en Google Drive\n` +
      `🖼️ Imagen guardada en Google Drive`
    );

    return { success: true, title: firstLine };

  } catch (error) {
    console.error(`   ❌ Error processing photo ${index || 1}:`, error.message);
    await bot.sendMessage(chatId, `❌ Poema ${index || 1}: ${error.message}`);
    return { success: false, error: error.message };
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
    `📸 Processing ${total} photo(s)...`
  );

  console.log(`\n📚 BATCH PROCESSING: ${total} photos for Libro ${notebookNum}`);

  const results = [];
  for (let i = 0; i < total; i++) {
    const result = await processSinglePhoto({ ...msg, chatId }, photos[i], i + 1, total, notebookNum, statusMsg);
    results.push(result);
  }

  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n📊 BATCH COMPLETE: ${successful}/${total} successful, ${failed} failed\n`);

  // Send summary
  const summaryTitles = results
    .filter(r => r.success)
    .map(r => `✅ ${r.title}`)
    .join('\n');

  const failedErrors = results
    .filter(r => !r.success)
    .map((r, i) => `❌ ${i + 1}. ${r.error}`)
    .join('\n');

  let summaryMsg = `🎉 Batch complete for Libro ${notebookNum}!\n\n` +
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
// Handle photo messages (supports both single and batch processing)
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

    // Store caption from the first photo that has one
    if (msg.caption && msg.caption.trim() && !group.caption) {
      group.caption = msg.caption;
    }

    // Add this photo to the group
    group.photos.push(msg.photo);

    // Process the batch after a short delay (wait for all photos to arrive)
    setTimeout(async () => {
      mediaGroups.delete(msg.media_group_id);

      if (group.photos.length > 1) {
        // Batch process multiple photos
        const caption = group.caption || '';
        await processBatch({ ...msg, caption }, group.photos);
      } else {
        // Single photo in group
        await processPhoto({ ...msg, caption: group.caption }, group.photos[0]);
      }
    }, 1000);
  } else {
    // Single photo (not in a media group)
    await processPhoto(msg, msg.photo);
  }
});

// Handle start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `👋 Hola! I'm your poetry digitizer.\n\n` +
    `📚 Send me a photo of a handwritten poem with the notebook number in the caption.\n\n` +
    `Example caption: "libro 1"\n\n` +
    `I'll:\n` +
    `• Upload the photo to Google Drive\n` +
    `• Use GPT-4 Vision to transcribe handwriting\n` +
    `• Save the poem as Markdown with metadata\n` +
    `• Ready for publishing!\n\n` +
    `Ready when you are! 🖋️`
  );
});

// Handle help command
bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `📖 Help\n\n` +
    `Send a photo with caption "libro X" where X is the notebook number.\n\n` +
    `Example: "libro 3" or "libro 10"\n\n` +
    `I'll organize everything into folders on Google Drive.`
  );
});

console.log('🤖 Bot started...');

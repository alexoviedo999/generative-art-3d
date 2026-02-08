/**
 * Full-featured Poetry Bot with Enhanced Debugging
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
  console.log('✅ Config loaded successfully');
} catch (err) {
  console.error('❌ config.json not found.');
  console.error('   Error:', err.message);
  process.exit(1);
}

// Check which bot instance to use (primary or secondary)
const BOT_TYPE = process.env.BOT_TYPE || 'primary';

// Get appropriate bot configuration
const botConfig = config.telegram[BOT_TYPE] || config.telegram;

// Verify bot configuration
if (!botConfig.token) {
  console.error(`❌ Bot token not found for "${BOT_TYPE}" bot in config.json`);
  console.error(`   Config key: "telegram.${BOT_TYPE}.token"`);
  console.error(`   Checking: telegram.${BOT_TYPE}`);
  if (config.telegram[BOT_TYPE]) {
    console.error(`   Found: telegram.${BOT_TYPE}`);
  } else {
    console.error(`   Available keys: ${Object.keys(config.telegram).join(', ')}`);
  }
  process.exit(1);
}

// Verify Google configuration
if (!config.google || !config.google.rootFolderId) {
  console.error('❌ Google configuration not found');
  console.error('   Required keys: "rootFolderId", "oauth", "openai"');
  process.exit(1);
}

console.log('🔍 Configuration check:');
console.log(`   Bot Type: ${BOT_TYPE}`);
console.log(`   Bot Name: ${botConfig.name || 'Poetry Bot'}`);
console.log(`   Bot Token: ${botConfig.token ? botConfig.token.substring(0, 20) + '...' : 'MISSING'}`);
console.log(`   Google Root Folder: ${config.google.rootFolderId}`);
console.log(`   OpenAI API Key: ${config.openai.apiKey ? 'Present' : 'MISSING'}`);
console.log('');

// Check if OAuth token file exists
const tokenFile = config.google.tokenFile || 'oauth-token.json';
const tokenPath = path.join(__dirname, tokenFile);

console.log('🔍 OAuth token check:');
console.log(`   Token file: ${tokenFile}`);
console.log(`   Full path: ${tokenPath}`);
console.log(`   Exists: ${fs.existsSync(tokenPath)}`);

// Load OAuth token
let tokens;
if (fs.existsSync(tokenPath)) {
  try {
    tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    console.log('✅ OAuth token loaded from file');
    console.log(`   Access token: ${tokens.access_token ? 'Present' : 'MISSING'}`);
    console.log(`   Refresh token: ${tokens.refresh_token ? 'Present' : 'MISSING'}`);
  } catch (err) {
    console.error('❌ Error loading OAuth token:', err.message);
    console.error('   Falling back to API key method');
    tokens = null;
  }
} else {
  console.error('❌ OAuth token file not found at:', tokenPath);
  console.error('   Please run: node auth.js');
  console.error('   Or ensure tokenFile in config.json is correct');
  process.exit(1);
}

// ==========================================
// Google APIs Setup
// ==========================================
let drive;
let vision;

if (tokens) {
  // Using OAuth tokens
  console.log('🔐 Using OAuth2 client for Google APIs');
  
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
      console.log('🔄 OAuth token refreshed');
    }
  });

  // Initialize Google Drive
  drive = google.drive({ version: 'v3', auth: oauth2Client });
  console.log('✅ Google Drive initialized with OAuth');

  // Initialize Google Vision (using OAuth if tokens available, otherwise API key)
  if (config.openai.apiKey) {
    const visionConfig = {
      auth: oauth2Client
    };
    vision = google.vision({ version: 'v1', ...visionConfig });
    console.log('✅ Google Vision initialized with OAuth');
  }
} else {
  console.error('❌ OpenAI API key not found. Please add "openai.apiKey" to config.json');
  process.exit(1);
}

const ROOT_FOLDER_ID = config.google.rootFolderId;

console.log('📁 Root Folder ID:', ROOT_FOLDER_ID);

// OpenAI setup for Vision OCR (GPT-4 for handwriting)
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

console.log('✅ OpenAI initialized');

// ==========================================
// Process Lock - Prevent Multiple Instances
// ==========================================
const PID_FILE = path.join(__dirname, `.poetry-bot-${BOT_TYPE}.pid`);

console.log('🔒 Process lock check:');
console.log(`   PID file: ${PID_FILE}`);

function checkLock() {
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
      console.log(`✅ Process ${pid} is NOT running - safe to overwrite lock`);
      return true;
    } catch (e) {
      console.log(`⚠️  Cannot check process ${pid}: ${e.message}`);
      console.log(`   Assuming process is not running - safe to overwrite lock`);
      
      // Clean up stale lock
      try {
        fs.unlinkSync(PID_FILE);
        console.log('🔓 Cleaned up stale lock file');
      } catch (cleanupError) {
        console.log(`   Cleanup error: ${cleanupError.message}`);
      }
      
      return false;
    }
  } catch (err) {
    console.error('❌ Error checking lock:', err.message);
    
    // If we can't check the lock, try to clean it up
    try {
      fs.unlinkSync(PID_FILE);
      console.log('🔓 Cleaned up lock file due to error');
    } catch (e) {}
    
    return false;
  }
}

function createLock() {
  const pid = process.pid;
  fs.writeFileSync(PID_FILE, pid.toString());
  console.log(`🔒 Lock created: PID ${pid} (bot: ${BOT_TYPE})`);
}

function removeLock() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
    console.log(`🔓 Lock removed (bot: ${BOT_TYPE})`);
  }
}

console.log('🔍 Checking for existing lock...');

if (checkLock()) {
  console.error('❌ Bot is already running!');
  console.error(`   Another instance of "${BOT_TYPE}" bot is already processing photos.`);
  console.error(`   To fix: Stop all node bot processes (pkill -9 -f "node.*bot")`);
  console.error(`   Then restart bot');
  process.exit(1);
}

console.log('✅ No existing lock - creating new lock');
createLock();

console.log('🔒 Lock created successfully');
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

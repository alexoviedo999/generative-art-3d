/**
 * Convert existing .txt files to .md with YAML frontmatter
 * This helps migrate old poems to the new flexible format
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (err) {
  console.error('❌ config.json not found.');
  process.exit(1);
}

// Load OAuth token
const tokens = JSON.parse(
  fs.readFileSync(path.join(__dirname, config.google.tokenFile), 'utf8')
);

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

oauth2Client.setCredentials(tokens);

// Google Drive setup
const drive = google.drive({ version: 'v3', auth: oauth2Client });

const ROOT_FOLDER_ID = config.google.rootFolderId;

/**
 * Extract book number from file path or filename
 * Looks for patterns like "Libro 1", "libro-1", etc.
 */
function extractBookNumber(fileName, folderName) {
  // Try folder name first
  const folderMatch = folderName?.match(/[Ll]ibro\s*[\s-]*(\d+)/);
  if (folderMatch) return folderMatch[1];

  // Try filename
  const fileMatch = fileName?.match(/[Ll]ibro\s*[\s-]*(\d+)/);
  if (fileMatch) return fileMatch[1];

  return null;
}

/**
 * Convert txt file content to Markdown with YAML frontmatter
 */
function txtToMarkdown(content, bookNum, fileName) {
  const firstLine = content.split('\n')[0].trim() || 'Sin título';

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];

  return `---
title: "${firstLine}"
book: "${bookNum ? 'Libro ' + bookNum : 'Desconocido'}"
date: "${dateStr}"
language: "es"
original_file: "${fileName}"
---

${content}
`;
}

/**
 * List all .txt files in the PoetryBot folder
 */
async function listTxtFiles() {
  console.log('\n📂 Listing .txt files from Google Drive...\n');

  const response = await drive.files.list({
    q: `name contains '.txt' and mimeType = 'text/plain' and trashed = false`,
    fields: 'files(id, name, parents)',
    pageSize: 100
  });

  return response.data.files;
}

/**
 * Download file content from Drive
 */
async function downloadFile(fileId) {
  const response = await drive.files.get({
    fileId: fileId,
    alt: 'media'
  });

  return response.data;
}

/**
 * Upload Markdown file to Drive
 */
async function uploadMarkdownFile(folderId, fileName, content) {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(content);
  stream.push(null);

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

  return file;
}

/**
 * Delete file from Drive
 */
async function deleteFile(fileId) {
  await drive.files.delete({ fileId });
}

/**
 * Main conversion process
 */
async function convertFiles() {
  const txtFiles = await listTxtFiles();

  if (txtFiles.length === 0) {
    console.log('✅ No .txt files found to convert.\n');
    return;
  }

  console.log(`Found ${txtFiles.length} .txt file(s) to convert.\n`);

  let converted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of txtFiles) {
    try {
      console.log(`\n📄 Processing: ${file.name}`);

      // Get folder name to extract book number
      let folderName = null;
      if (file.parents && file.parents[0]) {
        const folderResponse = await drive.files.get({
          fileId: file.parents[0],
          fields: 'name'
        });
        folderName = folderResponse.data.name;
      }

      const bookNum = extractBookNumber(file.name, folderName);

      if (!bookNum) {
        console.log(`⚠️  Could not determine book number, using 'Desconocido'`);
      }

      // Download .txt content
      const content = await downloadFile(file.id);

      // Convert to Markdown
      const markdownContent = txtToMarkdown(content, bookNum, file.name);

      // Create new .md filename
      const baseName = file.name.replace('.txt', '');
      const mdFileName = `${baseName}.md`;

      // Upload Markdown file
      const folderId = file.parents?.[0] || ROOT_FOLDER_ID;
      await uploadMarkdownFile(folderId, mdFileName, markdownContent);

      // Delete original .txt file
      await deleteFile(file.id);

      console.log(`✅ Converted to: ${mdFileName}`);
      converted++;

    } catch (error) {
      console.error(`❌ Error converting ${file.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n\n${'='.repeat(50)}`);
  console.log(`Conversion complete!`);
  console.log(`Converted: ${converted}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`${'='.repeat(50)}\n`);
}

// Run conversion
convertFiles().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

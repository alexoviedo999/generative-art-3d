const http = require('http');
const { google } = require('googleapis');
const fs = require('fs');
const url = require('url');

const config = require('./config.json');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

// Set the scopes
const scopes = config.google.oauth.scopes;

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes
});

console.log('\n🔐 OAuth Setup for Poetry Bot\n');
console.log('📋 Step 1: Visit this URL to authorize the bot:');
console.log('\n' + authUrl + '\n');
console.log('✅ After you grant permission, the script will automatically save the tokens.\n');

// Create a simple HTTP server to handle the callback
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  // Handle the OAuth callback
  if (parsedUrl.pathname === '/' && parsedUrl.query.code) {
    const code = parsedUrl.query.code;

    try {
      // Exchange code for tokens
      const { tokens } = await oauth2Client.getToken(code);

      // Save tokens to file
      fs.writeFileSync(
        config.google.tokenFile,
        JSON.stringify(tokens, null, 2)
      );

      // Send success response
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
        <head><title>OAuth Success</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #4CAF50;">✅ Authentication Successful!</h1>
          <p>Your tokens have been saved. You can now run the bot.</p>
          <p>Close this tab and return to the terminal.</p>
        </body>
        </html>
      `);

      console.log('\n✅ OAuth tokens saved successfully!');
      console.log('📁 Saved to:', config.google.tokenFile);
      console.log('🚀 You can now run: node bot.js\n');

      // Close the server after a short delay
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 2000);

    } catch (err) {
      console.error('\n❌ Error getting tokens:', err.message);

      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
        <head><title>OAuth Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #f44336;">❌ Authentication Failed</h1>
          <p>${err.message}</p>
          <p>Check the terminal for more details.</p>
        </body>
        </html>
      `);

      server.close();
      process.exit(1);
    }
  } else {
    // Show a simple landing page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <html>
      <head><title>Poetry Bot OAuth</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Poetry Bot OAuth Callback Server</h1>
        <p>Visit the authorization URL shown in your terminal to get started.</p>
      </body>
      </html>
    `);
  }
});

// Start the server
server.listen(8080, () => {
  console.log('🌐 OAuth callback server listening on http://localhost:8080');
  console.log('🌐 Make sure ngrok is tunneling port 8080 to: https://multiview-nonpopulous-esperanza.ngrok-free.dev\n');
  console.log('⏳ Waiting for callback... (Press Ctrl+C to cancel)\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n❌ OAuth setup cancelled.');
  server.close();
  process.exit(0);
});

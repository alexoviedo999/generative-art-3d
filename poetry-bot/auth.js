const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');

const config = require('./config.json');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

// Set the scopes and generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Request refresh token
  prompt: 'consent',      // Force consent dialog to get refresh token
  scope: config.google.oauth.scopes
});

console.log('\n🔐 OAuth Setup for Poetry Bot\n');
console.log('Visit this URL to authorize the bot:');
console.log('\n' + authUrl + '\n');
console.log('After you grant permission, copy the authorization code from the browser.');
console.log('Paste it here when prompted.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the authorization code: ', (code) => {
  oauth2Client.getToken(code).then(({ tokens }) => {
    // Save tokens to file
    fs.writeFileSync(
      config.google.tokenFile,
      JSON.stringify(tokens, null, 2)
    );

    console.log('\n✅ OAuth tokens saved successfully!');
    console.log('You can now run the bot.\n');

    rl.close();
  }).catch(err => {
    console.error('\n❌ Error getting tokens:', err.message);
    rl.close();
    process.exit(1);
  });
});

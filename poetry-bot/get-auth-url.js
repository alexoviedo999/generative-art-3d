const { google } = require('googleapis');

const config = require('./config.json');

// Create OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.oauth.clientId,
  config.google.oauth.clientSecret,
  config.google.oauth.redirectUri
);

// Generate and display the authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: config.google.oauth.scopes
});

console.log('\n🔐 OAuth Setup for Poetry Bot\n');
console.log('Visit this URL to authorize the bot:\n');
console.log(authUrl);
console.log('\n');
console.log('After you grant permission, copy the authorization code from the browser.');
console.log('Then run: node auth.js');
console.log('And paste the code when prompted.\n');

const vision = require('@google-cloud/vision');
const path = require('path');

// Set credentials
const credentialsPath = path.join(__dirname, 'credentials.json');
console.log('Credentials path:', credentialsPath);
console.log('File exists:', require('fs').existsSync(credentialsPath));

process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;

console.log('Creating Vision client...');
const client = new vision.ImageAnnotatorClient();

console.log('✅ Vision API client created successfully');
console.log('Project ID:', client.getProjectId ? client.getProjectId() : 'N/A');

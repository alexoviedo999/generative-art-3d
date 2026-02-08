const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('8234883548:AAE_6v9mu7wMpfdaPWe2lp0Pwkvlg8xe9kU');

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 
    '👋 New bot test! Your new bot is working.\n\n' +
    'Send a photo with caption "libro 1" to test OCR.'
  );
});

console.log('🤖 Test bot started...');

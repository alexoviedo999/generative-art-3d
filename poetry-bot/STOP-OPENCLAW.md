# Stop OpenClaw Gateway Bot

The 409 Conflict error is caused by OpenClaw's gateway bot running and calling Telegram API with the same token.

## Quick Fix

```bash
# Stop OpenClaw gateway
# (This stops the bot calling Telegram API)
pkill -f "openclaw-gateway"
kill 1719

# Restart your poetry bot
cd /home/aoviedo/.openclaw/workspace/poetry-bot
node bot-simple.js
```

## Alternative: Change Bot Token

If you want OpenClaw to keep running:

1. Create a NEW bot on Telegram: @BotFather
2. Get a new API token
3. Update `config.json` with the new token
4. Restart your poetry bot

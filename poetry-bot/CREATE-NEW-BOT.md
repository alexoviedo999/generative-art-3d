# Create a New Telegram Bot (Fixes 409 Conflicts)

The 409 conflicts are caused by OpenClaw's gateway bot calling Telegram API with the same bot token as your poetry bot. Creating a new bot is the cleanest solution.

## Step 1: Create New Bot via @BotFather

1. Open Telegram
2. Search for `@BotFather` (or use: https://t.me/BotFather)
3. Send: `/newbot`
4. Choose a bot type: Bot
5. Give it a name: e.g., "MyPoetryBot"
6. Follow the instructions to get API token

## Step 2: Update Your Poetry Bot Config

```bash
# Edit your config.json
nano /home/aoviedo/.openclaw/workspace/poetry-bot/config.json
```

Replace the token:
```json
{
  "telegram": {
    "token": "YOUR_NEW_BOT_TOKEN_FROM_BOTFATHER"
  }
}
```

## Step 3: Stop Everything

```bash
# Kill ALL bot processes (your bot AND any others)
pkill -9 -f "node.*bot"

# Verify nothing is running
ps aux | grep "node.*bot"
```

## Step 4: Restart Your Bot

```bash
cd /home/aoviedo/.openclaw/workspace/poetry-bot
node bot-simple.js
```

## Expected Result

✅ No 409 conflicts
✅ Your bot works independently
✅ OpenClaw gateway can continue running normally
✅ Both services coexist without problems

## Why This Is Better

- **Independent bots** — Each has its own token, no conflicts
- **Easier to debug** — Only your bot's logs to check
- **Future-proof** — Changes to one bot don't affect the other

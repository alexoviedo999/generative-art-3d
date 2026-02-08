# 📋 Poetry Bot Troubleshooting Guide

---

## 🔍 Common Issues & Solutions

### ❌ Issue: "Connection refused" when SSHing to Hostinger

**Symptom:** `ssh: connect to host port 22: Connection refused`

**Causes:**
1. **Fail2ban blocked your IP** — Too many failed login attempts
2. **Firewall blocking** — Hostinger security rules
3. **Wrong SSH port** — Using port 57150 instead of 22
4. **SSH service down** — Hostinger maintenance

**Solutions:**
```bash
# Option 1: Wait 5-10 minutes (fail2ban timeout)
# Then SSH again

# Option 2: Check Hostinger control panel
# Remove your IP from blocked list
# Check firewall settings

# Option 3: Use web-based SSH terminal (if available)
```

---

### ⚠️ Issue: 409 Conflict Error from Telegram

**Symptom:**
```
[telegram] getUpdates conflict: Call to 'getUpdates' failed! (409: Conflict: terminated by other getUpdates request; make sure that only one bot instance is running); retrying in 30s.
```

**Cause:** Multiple bot processes calling Telegram API with same bot token simultaneously

**Solutions:**
```bash
# Kill all bot processes
pkill -f "node bot"

# Verify
ps aux | grep "node bot"  # Should show nothing

# Restart bot
cd /home/aoviedo/.openclaw/workspace/poetry-bot
node bot-simple.js
```

**Note:** The `bot-simple.js` version has:
- ✅ Process lock (`.poetry-bot.pid`) — prevents YOUR code from starting multiple instances
- ✅ Unique polling parameters — Makes each bot instance more unique
- ✅ 409 error handling — User-friendly message instead of crash

---

### 🔧 Issue: Process Already Running

**Symptom:**
```
❌ Bot is already running!
❌ Another instance is already processing photos.
```

**Cause:** Old bot process from previous session is still running

**Solutions:**
```bash
# Kill old process
pkill -f "node bot"

# Or manually remove lock
rm /home/aoviedo/.openclaw/workspace/poetry-bot/.poetry-bot.pid

# Then restart
node bot-simple.js
```

---

### 📂 Issue: Files Not Saving to Google Drive

**Symptom:**
```
❌ Error processing photo: Cannot create property 'text' on number '74'
```

**Cause:** Drive API receiving malformed stream (fixed in `bot-simple.js`)

**Solution:**
- Use `bot-simple.js` which has fixed stream creation:
  ```bash
  node bot-simple.js
  ```

---

### 🔍 Issue: OpenClaw Gateway Problems

**Symptom:** Gateway not responding or connection refused

**Check status:**
```bash
# Check if OpenClaw is running
ps aux | grep openclaw-gateway

# Check if it's listening on correct port
lsof -i :57150  # OpenClaw usually on 57150
```

**Restart gateway (if needed):**
```bash
pkill -f "openclaw-gateway"

# Or via OpenClaw CLI (if installed)
openclaw gateway restart
```

---

## 📋 Daily Workflow

### Starting Bot (Recommended):
```bash
# 1. Kill any old processes
pkill -f "node bot"

# 2. Verify clean
ps aux | grep "node bot"  # Should show nothing

# 3. Start bot
cd /home/aoviedo/.openclaw/workspace/poetry-bot
node bot-simple.js

# 4. Check logs
# Watch terminal for: "🤖 Bot started (simple mode)..."
```

### Sending Photos:
1. Take photo of handwritten poem
2. Add caption: "libro 1" (or "libro 2", "libro 10", etc.)
3. Send to bot
4. Wait for transcription
5. Full poem will appear in Telegram

### Checking Google Drive:
1. Go to: https://drive.google.com
2. Navigate to: "Poetry Archive" folder
3. Each notebook has its own folder: "Libro 1", "Libro 2", etc.
4. Each poem has:
   - `.md` file (transcribed text with YAML frontmatter)
   - `.jpg` file (original image)

---

## 🔧 Maintenance

### Update Bot:
```bash
# Kill bot
pkill -f "node bot"

# Pull latest changes
cd /home/aoviedo/.openclaw/workspace/poetry-bot
git pull

# Restart
node bot-simple.js
```

### View Logs:
```bash
# Bot logs appear in terminal where you run it
# Watch for:
# ✅ = Success
# ❌ = Errors
# ⚠️ = Warnings
```

### Migrate Old Files:
```bash
# Convert old .txt files to .md with YAML
node convert-to-markdown.js
```

---

## 📊 System Status

| Component | Command | Purpose |
|----------|----------|---------|
| **Poetry Bot** | `node bot-simple.js` | Main bot (single-photo mode) |
| **Lock File** | `.poetry-bot.pid` | Prevents duplicate instances |
| **OpenClaw Gateway** | Port 57150 | Handles me connecting to you |

---

## 💡 Tips

- **Process lock prevents** YOUR bot from starting multiple instances
- **409 conflicts** mean ANOTHER bot with same token is running (not your code)
- **Single photo mode** is more reliable than batch processing
- **Markdown format** makes poems ready for publishing
- **Always include** "libro X" in captions for organization

---

## 🆘 Need Help?

If you still have issues:
1. Check terminal logs for specific error codes
2. Verify `config.json` has correct values
3. Ensure OpenAI API key is valid
4. Check Google Drive folder ID is correct

---

Last updated: 2026-02-02

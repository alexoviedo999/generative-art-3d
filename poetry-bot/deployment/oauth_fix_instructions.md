# Poetry Landing Page - Deployment Instructions

## 🚨 Current Issue

### Poetry Bot Status
**Error:** OAuth token expired
**Symptom:** Bot cannot save poems to Google Drive
**Cause:** Google Drive API access token has expired
**Solution:** Re-authenticate with Google Drive

---

## 🔧 Fix the Poetry Bot

### Option 1: Run Authentication Script
Navigate to the poetry bot project directory and run the authentication script:

```bash
cd /home/aoviedo/.openclaw/workspace/poetry-bot
node auth.js
```

This will:
1. Open a browser window
2. Navigate to Google OAuth2 authorization page
3. Let you authorize the bot to access Google Drive
4. Save the new token to `oauth-token.json`
5. Restart the bot

### Option 2: Manual Token Refresh
If you have a fresh Google Drive access token:

```bash
cd /home/aoviedo/.openclaw/workspace/poetry-bot

# Edit the token file
nano oauth-token.json

# Replace with your new token
{
  "access_token": "your_new_access_token_here",
  "refresh_token": "your_new_refresh_token_here",
  "scope": "https://www.googleapis.com/auth/drive",
  "token_type": "Bearer",
  "expiry_date": 9999-12-31T23:59:59Z"
}

# Save and exit
# Save the file (Ctrl+O, Ctrl+X)
# Restart the bot:
pm2 restart poetry-bot
```

---

## 📊 After Fix

Once the poetry bot is re-authenticated:
- ✅ Bot will start processing photos again
- ✅ Poems will be saved to Google Drive
- ✅ Poetry landing page will fetch and display new poems
- ✅ All operations will work normally

---

## 🔄 Automation

The poetry landing page is set to auto-rebuild every 2 hours via a cron job. Once you fix the bot, the next automatic rebuild (in approximately 1 hour 58 minutes from now) will include any new poems added to Google Drive.

---

## 💡 Prevention

To avoid this issue in the future:
1. **Monitor token expiration** - OAuth tokens typically expire after 1 hour
2. **Use service accounts** - Consider using a Google Cloud Service Account for long-term access
3. **Automate token refresh** - The bot's OAuth token refresh logic should handle renewal

---

Would you like me to help you run the authentication script, or would you prefer to update the token manually?

Let me know which option you'd like to choose and I'll assist! 🚀

# How to Add Your Google Client ID Secret

## Quick Steps:

1. **Open Secrets Panel**
   - Look for the lock icon (🔒) in the left sidebar
   - Or click the Tools icon (wrench) and select "Secrets"

2. **Add New Secret**
   - Click the "New Secret" button
   - In the "Key" field, enter: `VITE_GOOGLE_CLIENT_ID`
   - In the "Value" field, paste your Google Client ID
   - Click "Add Secret"

3. **Wait for Restart**
   - The app will automatically restart
   - The Google Calendar sync button will become active

## What Your Client ID Should Look Like:
```
123456789012-abcdefghijklmnopqrstuvwxyz1234.apps.googleusercontent.com
```

## After Adding the Secret:
- Go to any trip's calendar page
- Click "Connect Google Calendar"
- Authorize your Google account
- Select a calendar and start syncing!
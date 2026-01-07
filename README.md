# Isai - Personal Music Locker

A secure, single-user music player using Google Drive.

## Setup Instructions

### 1. Google Cloud Console Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named "Isai".
3. Search for **Google Drive API** and enable it.
4. Go to **APIs & Services > OAuth consent screen**:
    - Select **External**.
    - **IMPORTANT**: Scroll down to the **Test users** section and click **+ ADD USERS**. Add your Gmail address here. If you don't do this, you will get an "Access Denied" error.
    - Scope: Add `https://www.googleapis.com/auth/drive.file`.
5. Go to **APIs & Services > Credentials**:
    - Click **Create Credentials > OAuth client ID**.
    - Application type: **Web application**.
    - Authorized JavaScript origins: `http://localhost:5001`, `http://127.0.0.1:5001` and `http://localhost:5173`.
    - Authorized redirect URIs: `http://localhost:5001/auth/google/callback`.
6. Copy the **Client ID** and **Client Secret**.

### 2. Environment Variables
1. Create a `.env` file in the project root.
2. Ensure it contains the following (using port **5001**):
```env
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALLBACK_URL=http://localhost:5001/auth/google/callback
SESSION_SECRET=some_random_string
ALLOWED_EMAIL=your-gmail@gmail.com
PORT=5001
FRONTEND_URL=http://localhost:5173
```

### 3. Installation & Running
Open two terminals:

**Terminal 1 (Server):**
```bash
cd server
npm start
```

**Terminal 2 (Client):**
```bash
cd client
npm run dev
```

### 4. Usage
1. Open `http://localhost:5173`.
2. Login with your restricted Google account.
3. Upload music. A folder named `MyMusicVault` will be created in your Google Drive automatically.

## Deployment Guide

You can deploy this app to platforms like **Render**, **Railway**, or **Heroku**.

### 1. Build the Frontend
Before deploying, you must create a production build of the React app:
```bash
cd client
npm run build
```
This creates a `dist` folder that the server will serve in production.

### 2. Configure Environment Variables on Host
Add all the variables from your `.env` file to your hosting provider's "Environment Variables" section. 
- Set `NODE_ENV` to `production`.
- Set `FRONTEND_URL` to your production URL (e.g., `https://your-app.onrender.com`).
- Update `GOOGLE_CALLBACK_URL` to `https://your-app.onrender.com/auth/google/callback`.

### 3. Update Google Cloud Console
1. Add your production URL to **Authorized JavaScript origins**.
2. Add your production callback URL to **Authorized redirect URIs**.

### 4. Deploy
Command to start the server:
```bash
cd server
npm start
```
The server is now configured to serve the built frontend automatically when `NODE_ENV=production`.

## Uploading to GitHub

### 1. Initialize Git
Run these commands in the root directory:
```bash
git init
git add .
git commit -m "Initial commit: Isai Music Player"
```

### 2. Push to GitHub
1. Create a new repository on [GitHub](https://github.com/new).
2. Copy the remote URL and run:
```bash
git remote add origin https://github.com/yourusername/isai.git
git branch -M main
git push -u origin main
```

> [!CAUTION]
> **Never commit your `.env` file.** I have created a `.gitignore` file to prevent this. Your secrets (Google Client ID/Secret) should only exist locally and in your hosting provider's environment variables.



const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { google } = require('googleapis');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET || 'isai-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true in production with HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport Config
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file']
}, (accessToken, refreshToken, profile, done) => {
    // Single user restriction
    const email = profile.emails[0].value;
    if (email !== process.env.ALLOWED_EMAIL) {
        return done(null, false, { message: 'Unauthorized user' });
    }

    return done(null, { profile, accessToken });
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Middleware to protect routes
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// Drive API helper
const getDriveClient = (accessToken) => {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return google.drive({ version: 'v3', auth });
};

// Auth Routes
app.get('/auth/google', passport.authenticate('google', {
    accessType: 'offline',
    prompt: 'consent'
}));

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect(process.env.FRONTEND_URL || 'http://localhost:5173');
    }
);

app.get('/api/user', (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user: req.user.profile, authenticated: true });
    } else {
        res.status(401).json({ authenticated: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.logout((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ message: 'Logged out' });
    });
});

// Google Drive Folder management
const GET_OR_CREATE_FOLDER_NAME = 'MyMusicVault';

async function getMusicFolderId(drive) {
    const res = await drive.files.list({
        q: `name = '${GET_OR_CREATE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (res.data.files.length > 0) {
        return res.data.files[0].id;
    }

    // Create folder
    const folderMetadata = {
        name: GET_OR_CREATE_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
    };
    const folder = await drive.files.create({
        resource: folderMetadata,
        fields: 'id',
    });
    return folder.data.id;
}

// Multer setup for uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/x-m4a'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP3, WAV, and M4A are allowed.'));
        }
    }
});

// Routes
app.get('/api/songs', isAuthenticated, async (req, res) => {
    try {
        const drive = getDriveClient(req.user.accessToken);
        const folderId = await getMusicFolderId(drive);

        const response = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, size, createdTime, properties)',
            orderBy: 'name',
        });

        res.json(response.data.files);
    } catch (error) {
        console.error('Error listing songs:', error);
        res.status(500).json({ error: 'Failed to list songs' });
    }
});

app.post('/api/upload', isAuthenticated, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const drive = getDriveClient(req.user.accessToken);
        const folderId = await getMusicFolderId(drive);

        const { parseBuffer } = await import('music-metadata');
        const metadata = await parseBuffer(req.file.buffer, req.file.mimetype);
        const duration = Math.round(metadata.format.duration || 0);

        const fileMetadata = {
            name: req.file.originalname,
            parents: [folderId],
            properties: {
                duration: duration.toString()
            }
        };

        const media = {
            mimeType: req.file.mimetype,
            body: require('stream').Readable.from(req.file.buffer),
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id, name, properties',
        });

        res.json(file.data);
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

app.get('/api/stream/:fileId', isAuthenticated, async (req, res) => {
    try {
        const drive = getDriveClient(req.user.accessToken);
        const fileId = req.params.fileId;

        // Get file metadata for size and type
        const fileMeta = await drive.files.get({
            fileId: fileId,
            fields: 'size, mimeType',
        });

        const range = req.headers.range;
        if (range) {
            // Handle range requests for seeking
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileMeta.data.size - 1;
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileMeta.data.size}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': fileMeta.data.mimeType,
            });

            const stream = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream', headers: { Range: `bytes=${start}-${end}` } }
            );
            stream.data.pipe(res);
        } else {
            res.writeHead(200, {
                'Content-Length': fileMeta.data.size,
                'Content-Type': fileMeta.data.mimeType,
            });
            const stream = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            stream.data.pipe(res);
        }
    } catch (error) {
        console.error('Streaming error:', error);
        res.status(500).json({ error: 'Streaming failed' });
    }
});

app.delete('/api/songs/:fileId', isAuthenticated, async (req, res) => {
    try {
        const drive = getDriveClient(req.user.accessToken);
        await drive.files.delete({ fileId: req.params.fileId });
        res.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../client/dist')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/dist/index.html'));
    });
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

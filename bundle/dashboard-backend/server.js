const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { S3Client, ListObjectsV2Command, GetObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const archiver = require('archiver');
const unzipper = require('unzipper');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3005;
const PASSWORD_FILE = '/etc/octiron-admin.pwd';
const DATA_ROOT = '/data';
const BACKUP_PREFIX = 'backups/';
const KEEP_BACKUPS = 30;

const BACKENDS = [
    'calendar-backend',
    'expense-backend',
    'inventory-backend',
    'habits-backend',
    'mood-backend',
    'task-backend',
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth ─────────────────────────────────────────────────────────────────────

function getPassword() {
    try {
        const pw = fs.readFileSync(PASSWORD_FILE, 'utf8').trim();
        if (pw) return pw;
    } catch {}
    return process.env.ADMIN_PASSWORD || '';
}

function sha256(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}

function authMiddleware(req, res, next) {
    const token = req.headers['x-admin-token'];
    if (!token || token !== sha256(getPassword())) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
}

// ── Backup ───────────────────────────────────────────────────────────────────

function backupConfigured() {
    return !!(
        process.env.BUCKET_NAME &&
        process.env.AWS_ACCESS_KEY_ID &&
        process.env.AWS_SECRET_ACCESS_KEY &&
        process.env.AWS_ENDPOINT_URL_S3
    );
}

function s3() {
    return new S3Client({
        region: 'auto',
        endpoint: process.env.AWS_ENDPOINT_URL_S3,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
}

async function runBackup(prefix = BACKUP_PREFIX) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${prefix}octiron-${timestamp}.zip`;

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('warning', err => { if (err.code !== 'ENOENT') throw err; });

    if (fs.existsSync(DATA_ROOT)) {
        archive.directory(DATA_ROOT, 'data');
    }

    const upload = new Upload({
        client: s3(),
        params: {
            Bucket: process.env.BUCKET_NAME,
            Key: key,
            Body: archive,
            ContentType: 'application/zip',
        },
    });

    archive.finalize();
    await upload.done();

    // Prune old backups beyond KEEP_BACKUPS
    const list = await s3().send(new ListObjectsV2Command({
        Bucket: process.env.BUCKET_NAME,
        Prefix: BACKUP_PREFIX,
    }));
    const sorted = (list.Contents || []).sort((a, b) => a.LastModified - b.LastModified);
    const toDelete = sorted.slice(0, Math.max(0, sorted.length - KEEP_BACKUPS));
    if (toDelete.length) {
        await s3().send(new DeleteObjectsCommand({
            Bucket: process.env.BUCKET_NAME,
            Delete: { Objects: toDelete.map(o => ({ Key: o.Key })) },
        }));
    }

    console.log(`Backup complete: ${key}`);
    return key;
}

async function extractBackup(zipStream) {
    await new Promise((resolve, reject) => {
        zipStream
            .pipe(unzipper.Parse({ forceStream: true }))
            .on('entry', entry => {
                const { path: entryPath, type } = entry;
                if (!entryPath.startsWith('data/')) { entry.autodrain(); return; }
                const rel = entryPath.slice('data/'.length);
                // Preserve the API key — don't overwrite it from the backup
                if (!rel || rel === '.octiron-api-key') { entry.autodrain(); return; }
                const dest = path.join(DATA_ROOT, rel);
                if (type === 'Directory') {
                    fs.mkdirSync(dest, { recursive: true });
                    entry.autodrain();
                } else {
                    fs.mkdirSync(path.dirname(dest), { recursive: true });
                    entry.pipe(fs.createWriteStream(dest)).on('error', reject);
                }
            })
            .on('finish', resolve)
            .on('error', reject);
    });
}

// Nightly at 02:00
if (backupConfigured()) {
    cron.schedule('0 2 * * *', () => {
        console.log('Starting scheduled backup...');
        runBackup().catch(err => console.error('Scheduled backup failed:', err));
    });
    console.log('Nightly backup scheduled (02:00)');
}

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/me', authMiddleware, (_req, res) => res.json({ ok: true }));

app.post('/api/auth', (req, res) => {
    const { password } = req.body || {};
    if (!password || password !== getPassword()) {
        return res.status(401).json({ error: 'Invalid password' });
    }
    res.json({ token: sha256(password) });
});

app.post('/api/change-password', authMiddleware, (req, res) => {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || currentPassword !== getPassword()) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
        fs.writeFileSync(PASSWORD_FILE, newPassword, { mode: 0o600 });
    } catch (err) {
        console.error('Failed to write password file:', err);
        return res.status(500).json({ error: 'Failed to save password' });
    }

    try {
        execSync(`supervisorctl restart ${BACKENDS.join(' ')}`, { timeout: 30000 });
    } catch (err) {
        console.error('supervisorctl restart failed:', err.message);
        return res.json({
            token: sha256(newPassword),
            message: 'Password saved. Restart the container for all apps to pick it up.',
        });
    }

    res.json({ token: sha256(newPassword), message: 'Password changed. Services restarted.' });
});

app.get('/api/backup/status', authMiddleware, async (req, res) => {
    if (!backupConfigured()) {
        return res.json({ configured: false });
    }
    try {
        const result = await s3().send(new ListObjectsV2Command({
            Bucket: process.env.BUCKET_NAME,
            Prefix: BACKUP_PREFIX,
        }));
        const backups = (result.Contents || [])
            .sort((a, b) => b.LastModified - a.LastModified)
            .slice(0, 10)
            .map(o => ({ key: o.Key, size: o.Size, date: o.LastModified }));
        res.json({ configured: true, backups });
    } catch (err) {
        console.error('List backups failed:', err);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

app.post('/api/backup/now', authMiddleware, async (req, res) => {
    if (!backupConfigured()) {
        return res.status(400).json({ error: 'Backup not configured' });
    }
    try {
        const key = await runBackup();
        res.json({ key, message: 'Backup complete' });
    } catch (err) {
        console.error('Manual backup failed:', err);
        res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
});

app.get('/api/backup/download/:key(*)', authMiddleware, async (req, res) => {
    if (!backupConfigured()) {
        return res.status(400).json({ error: 'Backup not configured' });
    }
    try {
        const key = decodeURIComponent(req.params.key);
        const result = await s3().send(new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
        }));
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(key)}"`);
        result.Body.pipe(res);
    } catch (err) {
        console.error('Download failed:', err);
        res.status(500).json({ error: 'Download failed' });
    }
});

app.post('/api/backup/restore', authMiddleware, async (req, res) => {
    if (!backupConfigured()) {
        return res.status(400).json({ error: 'Backup not configured' });
    }

    const { key } = req.body || {};
    if (!key || !key.startsWith(BACKUP_PREFIX)) {
        return res.status(400).json({ error: 'Invalid backup key' });
    }

    // Pre-restore snapshot so there is always a way back
    try {
        await runBackup('pre-restore/');
    } catch (err) {
        return res.status(500).json({ error: 'Could not create pre-restore backup: ' + err.message });
    }

    // Stop app backends before touching the data files
    try {
        execSync(`supervisorctl stop ${BACKENDS.join(' ')}`, { timeout: 30000 });
    } catch (err) {
        console.error('Stop backends failed (continuing):', err.message);
    }

    try {
        const response = await s3().send(new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: key,
        }));
        await extractBackup(response.Body);
        execSync(`supervisorctl start ${BACKENDS.join(' ')}`, { timeout: 30000 });
        res.json({ message: 'Restore complete. All services are back online.' });
    } catch (err) {
        console.error('Restore failed:', err);
        try { execSync(`supervisorctl start ${BACKENDS.join(' ')}`, { timeout: 30000 }); } catch {}
        res.status(500).json({ error: 'Restore failed: ' + err.message });
    }
});

app.listen(PORT, () => console.log(`Dashboard backend on port ${PORT}`));

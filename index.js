const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// In-memory job storage
const jobs = new Map();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (req, file, cb) => {
        const isCSV = file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv';
        cb(null, isCSV);
    }
});

// Middleware
app.use(express.json());

// ❌ Commented out to prevent ENOENT for missing 'public' directory
// app.use(express.static('public'));

// ❌ Commented out to prevent ENOENT for missing index.html
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

// Temporary replacement home route to check if server is alive
app.get('/', (req, res) => {
    res.send(`<h2>✅ Server is running. Upload a CSV to /api/upload</h2>`);
});

// Download test CSV if needed
app.get('/test_data.csv', (req, res) => {
    res.download('./test_data.csv');
});

// Upload route
app.post('/api/upload', upload.single('csv'), (req, res) => {
    if (!req.file) return res.json({ success: false, error: 'No file uploaded' });

    const jobId = uuidv4();
    const filePath = req.file.path;

    // Create job entry
    jobs.set(jobId, {
        id: jobId,
        status: 'processing',
        filePath,
        createdAt: new Date(),
        results: null,
        error: null
    });

    // Start ML task
    processCSV(jobId, filePath);

    res.json({ success: true, jobId });
});

// Status check
app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.json({ error: 'Job not found' });

    res.json({
        status: job.status,
        results: job.results,
        error: job.error
    });
});

// Process CSV file using Python
function processCSV(jobId, filePath) {
    const pythonScript = path.join(__dirname, 'python', 'ml_runner.py');

    if (!fs.existsSync(pythonScript)) {
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = 'Python ML script not found.';
            jobs.set(jobId, job);
        }
        return;
    }

    const pythonProcess = spawn('python3', [pythonScript, filePath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('[Python stderr]', data.toString());
    });

    pythonProcess.on('close', (code) => {
        const job = jobs.get(jobId);
        if (!job) return;

        fs.unlink(filePath, () => {}); // delete uploaded file

        if (code === 0) {
            try {
                job.results = JSON.parse(output);
                job.status = 'completed';
            } catch (err) {
                job.status = 'error';
                job.error = 'Failed to parse Python output';
            }
        } else {
            job.status = 'error';
            job.error = errorOutput || 'ML processing failed.';
        }

        jobs.set(jobId, job);

        // Cleanup after 5 minutes
        setTimeout(() => jobs.delete(jobId), 5 * 60 * 1000);
    });

    pythonProcess.on('error', (err) => {
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = 'Python process error: ' + err.message;
            jobs.set(jobId, job);
        }
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.json({ success: false, error: 'File too large. Max is 10MB.' });
    }
    res.json({ success: false, error: error.message });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});

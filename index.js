const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

// In-memory storage for job tracking
const jobs = new Map();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve test data file
app.get('/test_data.csv', (req, res) => {
    res.download('./test_data.csv');
});

// Serve main HTML page
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSV Linear Regression Analysis</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        .btn-primary { background: #007bff; color: white; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 15px 0; }
        .text-center { text-align: center; }
        .row { display: flex; gap: 15px; }
        .col { flex: 1; }
        .alert { padding: 15px; border-radius: 4px; margin: 15px 0; }
        .alert-danger { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .progress { width: 100%; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }
        .progress-bar { height: 100%; background: #007bff; transition: width 0.3s; }
        .metric-card { text-align: center; padding: 20px; margin: 10px; border-radius: 8px; color: white; }
        .metric-r2 { background: #007bff; }
        .metric-mae { background: #28a745; }
        .metric-mse { background: #17a2b8; }
    </style>
    <style>
        .drop-zone {
            border: 2px dashed #ccc;
            border-radius: 10px;
            padding: 60px;
            text-align: center;
            cursor: pointer;
            transition: border-color 0.3s ease;
        }
        .drop-zone:hover, .drop-zone.dragover {
            border-color: #007bff;
            background-color: #f8f9fa;
        }
        .results-container {
            display: none;
        }
        .spinner-border {
            width: 1rem;
            height: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
                <h1 class="text-center">CSV Linear Regression Analysis</h1>
                
                <!-- Upload Area -->
                <div class="card">
                    <div class="drop-zone" id="dropZone">
                        <h3>📁 Drop your CSV file here or click to select</h3>
                        <p>Maximum file size: 10MB</p>
                        <p><a href="/test_data.csv" download>📥 Download sample dataset</a> for quick testing</p>
                        <input type="file" id="fileInput" accept=".csv" style="display: none;">
                    </div>
                </div>

                <!-- Status Area -->
                <div class="card" id="statusCard" style="display: none;">
                    <h3>Processing Status</h3>
                    <p id="statusText">Uploading file...</p>
                    <div class="progress">
                        <div class="progress-bar" id="progressBar" style="width: 0%"></div>
                    </div>
                </div>

                <!-- Results Area -->
                <div class="results-container" id="resultsContainer">
                    <div class="card">
                        <h3>Linear Regression Results</h3>
                        <div class="row">
                            <div class="col">
                                <div class="metric-card metric-r2">
                                    <h4>R² Score</h4>
                                    <h2 id="r2Score">-</h2>
                                </div>
                            </div>
                            <div class="col">
                                <div class="metric-card metric-mae">
                                    <h4>MAE</h4>
                                    <h2 id="maeScore">-</h2>
                                </div>
                            </div>
                            <div class="col">
                                <div class="metric-card metric-mse">
                                    <h4>MSE</h4>
                                    <h2 id="mseScore">-</h2>
                                </div>
                            </div>
                        </div>
                        <p><strong>Dataset Info:</strong> <span id="datasetInfo">-</span></p>
                    </div>
                </div>

                <!-- Error Area -->
                <div class="alert alert-danger" id="errorAlert" style="display: none;"></div>
    </div>
    <script>

        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const statusCard = document.getElementById('statusCard');
        const statusText = document.getElementById('statusText');
        const progressBar = document.getElementById('progressBar');
        const resultsContainer = document.getElementById('resultsContainer');
        const errorAlert = document.getElementById('errorAlert');
        const spinner = document.getElementById('spinner');

        let currentJobId = null;

        // Drop zone events
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFile(e.target.files[0]);
            }
        });

        function handleFile(file) {
            if (!file.name.endsWith('.csv')) {
                showError('Please select a CSV file.');
                return;
            }

            if (file.size > 10 * 1024 * 1024) {
                showError('File size must be less than 10MB.');
                return;
            }

            uploadFile(file);
        }

        function uploadFile(file) {
            const formData = new FormData();
            formData.append('csv', file);

            hideError();
            showStatus('Uploading file...', 25);

            fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    currentJobId = data.jobId;
                    pollJobStatus();
                } else {
                    showError(data.error || 'Upload failed');
                }
            })
            .catch(error => {
                showError('Upload failed: ' + error.message);
            });
        }

        function pollJobStatus() {
            if (!currentJobId) return;

            fetch(\`/api/status/\${currentJobId}\`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'processing') {
                    showStatus('Processing data with machine learning...', 75);
                    setTimeout(pollJobStatus, 1000);
                } else if (data.status === 'completed') {
                    showResults(data.results);
                } else if (data.status === 'error') {
                    showError(data.error || 'Processing failed');
                } else {
                    setTimeout(pollJobStatus, 1000);
                }
            })
            .catch(error => {
                showError('Status check failed: ' + error.message);
            });
        }

        function showStatus(text, progress) {
            statusText.textContent = text;
            progressBar.style.width = progress + '%';
            statusCard.style.display = 'block';
            resultsContainer.style.display = 'none';
        }

        function showResults(results) {
            statusCard.style.display = 'none';
            
            document.getElementById('r2Score').textContent = results.r2_score.toFixed(4);
            document.getElementById('maeScore').textContent = results.mae.toFixed(4);
            document.getElementById('mseScore').textContent = results.mse.toFixed(4);
            document.getElementById('datasetInfo').textContent = 
                \`\${results.dataset_info.total_rows} rows, \${results.dataset_info.feature_columns} features, \${results.dataset_info.train_size} training samples\`;
            
            resultsContainer.style.display = 'block';
        }

        function showError(message) {
            errorAlert.textContent = message;
            errorAlert.style.display = 'block';
            statusCard.style.display = 'none';
            resultsContainer.style.display = 'none';
        }

        function hideError() {
            errorAlert.style.display = 'none';
        }
    </script>
</body>
</html>
    `);
});

// Upload endpoint
app.post('/api/upload', upload.single('csv'), (req, res) => {
    try {
        if (!req.file) {
            return res.json({ success: false, error: 'No file uploaded' });
        }

        const jobId = uuidv4();
        const filePath = req.file.path;

        // Create job entry
        jobs.set(jobId, {
            id: jobId,
            status: 'processing',
            filePath: filePath,
            createdAt: new Date(),
            results: null,
            error: null
        });

        // Start ML processing
        processCSV(jobId, filePath);

        res.json({ success: true, jobId: jobId });
    } catch (error) {
        console.error('Upload error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Status endpoint
app.get('/api/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    
    if (!job) {
        return res.json({ error: 'Job not found' });
    }

    res.json({
        status: job.status,
        results: job.results,
        error: job.error
    });
});

// Process CSV with Python ML script
function processCSV(jobId, filePath) {
    const pythonProcess = spawn('python3', ['python/ml_runner.py', filePath]);
    
    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
        const job = jobs.get(jobId);
        if (!job) return;

        // Cleanup uploaded file
        fs.unlink(filePath, (err) => {
            if (err) console.error('Failed to delete file:', err);
        });

        if (code === 0) {
            try {
                const results = JSON.parse(output);
                job.status = 'completed';
                job.results = results;
            } catch (parseError) {
                job.status = 'error';
                job.error = 'Failed to parse ML results: ' + parseError.message;
            }
        } else {
            job.status = 'error';
            job.error = errorOutput || 'ML processing failed';
        }

        jobs.set(jobId, job);

        // Cleanup job after 5 minutes
        setTimeout(() => {
            jobs.delete(jobId);
        }, 5 * 60 * 1000);
    });

    pythonProcess.on('error', (error) => {
        const job = jobs.get(jobId);
        if (job) {
            job.status = 'error';
            job.error = 'Failed to start Python process: ' + error.message;
            jobs.set(jobId, job);
        }
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.json({ success: false, error: 'File too large. Maximum size is 10MB.' });
        }
    }
    res.json({ success: false, error: error.message });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});

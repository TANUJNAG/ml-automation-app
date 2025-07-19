# CSV Machine Learning Processing Service

## Overview

This is a web-based service that allows users to upload CSV files and automatically performs machine learning analysis on the data. The system consists of a Node.js backend with Express that handles file uploads and a Python ML processing engine that performs linear regression analysis on numeric data. **Status: Successfully deployed and tested on July 19, 2025.**

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (July 19, 2025)

✓ Built complete application with exact minimal tech stack
✓ Optimized interface by removing external dependencies for faster loading
✓ Fixed JavaScript errors and improved performance
✓ Added sample dataset download functionality
✓ Successfully tested end-to-end machine learning workflow
✓ Application confirmed working by user

## System Architecture

The application follows a simple client-server architecture with the following components:

- **Frontend**: Static HTML/CSS/JavaScript served by Express
- **Backend**: Node.js with Express framework handling HTTP requests and file management
- **ML Processing**: Python scripts using scikit-learn for data analysis
- **File Storage**: Local filesystem for temporary CSV file storage
- **Job Management**: In-memory job tracking using JavaScript Map

## Key Components

### Web Server (Node.js/Express)
- **Purpose**: Handles HTTP requests, file uploads, and serves the frontend
- **Port**: Runs on port 5000
- **File Upload**: Uses Multer middleware for handling CSV file uploads
- **Validation**: Restricts uploads to CSV files only with 10MB size limit
- **Job Tracking**: Maintains job status in memory using UUID-based identifiers

### File Upload System
- **Storage Strategy**: Disk storage in `uploads/` directory
- **Naming Convention**: Timestamp + random number + original filename
- **Security**: File type validation to accept only CSV files
- **Size Limits**: Maximum 10MB per file

### ML Processing Engine (Python)
- **Framework**: scikit-learn for machine learning operations
- **Data Processing**: pandas for CSV handling and data manipulation
- **Algorithm**: Linear regression for predictive modeling
- **Validation**: Train/test split (80/20) with R² score calculation
- **Requirements**: Minimum 2 numeric columns and 10 samples after cleaning

### Job Management
- **Architecture**: Asynchronous processing using child processes
- **Tracking**: In-memory Map with UUID-based job IDs
- **Communication**: JSON-based data exchange between Node.js and Python
- **Error Handling**: Comprehensive error capture and user feedback

## Data Flow

1. User uploads CSV file through web interface
2. Express server validates file type and size
3. File is stored in uploads directory with unique filename
4. Job ID is generated and stored in memory
5. Python ML script is spawned as child process
6. Python script processes CSV, performs regression analysis
7. Results are returned as JSON to Node.js
8. Job status is updated in memory
9. User can poll for job completion and retrieve results

## External Dependencies

### Node.js Packages
- **express**: Web framework for handling HTTP requests
- **multer**: Middleware for handling multipart/form-data file uploads
- **uuid**: Generates unique identifiers for job tracking
- **path/fs**: Built-in modules for file system operations
- **child_process**: Built-in module for spawning Python processes

### Python Packages
- **pandas**: Data manipulation and CSV processing
- **scikit-learn**: Machine learning algorithms and model evaluation
- **numpy**: Numerical computing support

## Deployment Strategy

### Local Development
- Simple Node.js application that can run with `node index.js`
- Python environment with required ML packages
- No external database dependencies (uses in-memory storage)
- Static file serving for frontend assets

### Production Considerations
- **Scalability Limitation**: In-memory job storage won't persist across restarts
- **File Cleanup**: No automatic cleanup of uploaded files
- **Security**: Basic file validation but no advanced security measures
- **Performance**: Synchronous Python processing may block for large datasets

### Recommended Improvements for Production
- Replace in-memory storage with database (Redis/PostgreSQL)
- Implement file cleanup mechanisms
- Add user authentication and authorization
- Use proper job queue system (Bull/Redis)
- Add comprehensive error logging and monitoring
- Implement rate limiting for uploads
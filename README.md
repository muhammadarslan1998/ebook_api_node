# eBook Converter API

A powerful Node.js REST API for converting eBooks and documents between multiple formats — no Calibre required!

## ✨ Supported Formats

| Source | Targets                    |
|--------|----------------------------|
| EPUB   | PDF, HTML, TXT             |
| PDF    | HTML, TXT, EPUB            |
| DOCX   | PDF, HTML, TXT, EPUB       |
| TXT    | PDF, HTML, EPUB            |
| HTML   | PDF, TXT, EPUB             |

## 🚀 Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Copy environment file

```bash
cp .env.example .env
```

### 3. Start the server

**Development mode** (auto-restarts on file changes):
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server starts at **http://localhost:3000**

### 4. Open the interactive docs

Navigate to **http://localhost:3000/api/docs** in your browser — you'll see the full Swagger UI where you can test every endpoint.

---

## 📡 API Endpoints

### `GET /api/health`
Check API health and stats.

### `GET /api/refresh` (or `GET /api/ping`)
Keep-alive ping endpoint to prevent sleep on free hosting tiers (Render, Railway, etc.) or wake up the server.

```bash
curl http://localhost:3000/api/refresh
```

```json
{
  "status": "alive",
  "message": "Server is awake and active",
  "timestamp": "2026-08-27T10:07:00.000Z",
  "uptimeSeconds": 300,
  "uptimeFormatted": "5m 0s"
}
```

### `GET /api/cleanup` (or `GET /api/convert/cleanup`)
Manually delete uploaded and converted files older than TTL (default 1 hour = 60 minutes).

```bash
# Default (1 hour / 60 minutes):
curl http://localhost:3000/api/cleanup

# Custom TTL (e.g. 30 minutes, or 0 to clear all):
curl "http://localhost:3000/api/cleanup?ttlMinutes=30"
```

```json
{
  "status": "success",
  "message": "Cleanup completed for files older than 60 minute(s).",
  "ttlMinutes": 60,
  "summary": {
    "prunedJobs": 1,
    "uploadsDeleted": 3,
    "convertedDeleted": 2,
    "totalFilesDeleted": 5,
    "bytesFreed": 4500000,
    "megabytesFreed": "4.29 MB"
  },
  "timestamp": "2026-08-27T10:12:00.000Z"
}
```

### `GET /api/convert/formats`
List all supported source → target format pairs.

### `POST /api/convert` — Synchronous conversion
Upload a file, converts it immediately, and returns a JSON response with the `downloadUrl`.

```bash
curl -X POST http://localhost:3000/api/convert \
  -F "file=@mybook.azw3" \
  -F "targetFormat=txt"
```

```json
{
  "status": "success",
  "message": "Conversion completed successfully.",
  "jobId": "80a440fa-5d38-47e5-b5ea-0ff3597e47f7",
  "sourceFile": "mybook.azw3",
  "from": "azw3",
  "to": "txt",
  "outputFileName": "mybook.txt",
  "fileSizeBytes": 51230,
  "downloadUrl": "http://localhost:3000/api/convert/download/80a440fa-5d38-47e5-b5ea-0ff3597e47f7",
  "downloadPath": "/api/convert/download/80a440fa-5d38-47e5-b5ea-0ff3597e47f7",
  "expiresIn": "60 minutes"
}
```

> **Note:** To stream the raw binary directly instead of JSON, append `?direct=true`:  
> `curl -X POST "http://localhost:3000/api/convert?direct=true" -F "file=@book.epub" -F "targetFormat=pdf" -o book.pdf`

### `POST /api/convert/async` — Asynchronous conversion
Start a background conversion job (useful for large files).

```bash
# 1. Start job
curl -X POST http://localhost:3000/api/convert/async \
  -F "file=@mybook.epub" \
  -F "targetFormat=pdf"

# Response:
# { "jobId": "abc123", "pollUrl": "/api/convert/job/abc123", ... }

# 2. Poll for status
curl http://localhost:3000/api/convert/job/abc123

# 3. Download when done
curl http://localhost:3000/api/convert/download/abc123 -o output.pdf
```

---

## 🛠️ Configuration (`.env`)

| Variable           | Default     | Description                      |
|--------------------|-------------|----------------------------------|
| `PORT`             | `3000`      | HTTP port to listen on           |
| `NODE_ENV`         | `development` | `development` or `production`  |
| `LOG_LEVEL`        | `info`      | Winston log level                |
| `MAX_FILE_SIZE_MB` | `100`       | Maximum upload file size in MB   |
| `OUTPUT_TTL_MS`    | `3600000`   | How long to keep output files (ms)|
| `ENABLE_SELF_PING` | `false`     | Auto-ping `/api/refresh` every 13m (uses `RENDER_EXTERNAL_URL` on Render) |
| `SELF_PING_URL`    | `""`        | Custom URL for background self-ping |

---

## 🚀 Deploying to Render

Render does **not** install Calibre in its standard Node environment. Therefore, deploy using the included **Dockerfile**:

1. Push this repository to GitHub / GitLab.
2. In the [Render Dashboard](https://dashboard.render.com/):
   - Click **New +** → **Web Service**
   - Connect your repository
   - Select **Runtime: Docker** (Render will auto-detect the `Dockerfile`)
   - Set **Plan: Free** (or your desired tier)
3. Click **Create Web Service**.

The `Dockerfile` automatically installs Calibre and all required system libraries.

---

## 📁 Project Structure

```
ebook_converter_api/
├── server.js                    # Entry point (HTTP server)
├── src/
│   ├── app.js                   # Express app setup
│   ├── config.js                # App configuration
│   ├── logger.js                # Winston logger
│   ├── jobStore.js              # In-memory async job tracking
│   ├── swaggerSpec.js           # OpenAPI 3.0 specification
│   ├── converters/
│   │   ├── conversionEngine.js  # Central dispatch table
│   │   ├── epubConverter.js     # EPUB → HTML/TXT parser
│   │   ├── epubGenerator.js     # → EPUB generator
│   │   ├── pdfConverter.js      # PDF → HTML/TXT parser
│   │   ├── pdfGenerator.js      # → PDF generator (PDFKit)
│   │   ├── docxConverter.js     # DOCX → HTML/TXT (mammoth)
│   │   └── htmlConverter.js     # HTML ↔ TXT utilities
│   ├── middleware/
│   │   ├── upload.js            # Multer upload config
│   │   └── errorHandler.js      # Global error handler
│   └── routes/
│       ├── convert.js           # Conversion endpoints
│       └── health.js            # Health check endpoint
├── uploads/                     # Temp uploaded files (auto-created)
├── converted/                   # Converted output files (auto-created)
├── .env.example                 # Environment variable template
├── package.json
└── README.md
```

---

## 🧰 Tech Stack

- **Express 5** — HTTP framework
- **Multer** — Multipart file uploads
- **PDFKit** — PDF generation
- **pdf-parse** — PDF text extraction  
- **mammoth** — DOCX → HTML conversion
- **epub-gen-memory** — EPUB generation
- **JSZip + xml2js** — EPUB parsing
- **html-to-text** — HTML → plain text
- **swagger-ui-express** — Interactive API docs
- **Winston + Morgan** — Logging
- **Helmet + CORS** — Security

---

## 📝 Example cURL Commands

```bash
# EPUB → PDF
curl -X POST http://localhost:3000/api/convert \
  -F "file=@book.epub" \
  -F "targetFormat=pdf" -o book.pdf

# DOCX → EPUB
curl -X POST http://localhost:3000/api/convert \
  -F "file=@document.docx" \
  -F "targetFormat=epub" -o document.epub

# TXT → PDF
curl -X POST http://localhost:3000/api/convert \
  -F "file=@notes.txt" \
  -F "targetFormat=pdf" -o notes.pdf

# HTML → EPUB
curl -X POST http://localhost:3000/api/convert \
  -F "file=@article.html" \
  -F "targetFormat=epub" -o article.epub

# PDF → TXT
curl -X POST http://localhost:3000/api/convert \
  -F "file=@report.pdf" \
  -F "targetFormat=txt" -o report.txt
```

'use strict';
/**
 * OpenAPI / Swagger specification
 */
module.exports = {
  openapi: '3.0.3',
  info: {
    title:       'eBook Converter API',
    version:     '1.0.0',
    description: `A powerful REST API for converting eBooks and documents between multiple formats.

**Supported formats:** EPUB, PDF, DOCX, TXT, HTML

**Conversion matrix:**
| Source | Targets              |
|--------|----------------------|
| EPUB   | PDF, HTML, TXT       |
| PDF    | HTML, TXT, EPUB      |
| DOCX   | PDF, HTML, TXT, EPUB |
| TXT    | PDF, HTML, EPUB      |
| HTML   | PDF, TXT, EPUB       |

**Two conversion modes:**
1. **Synchronous** (\`POST /api/convert\`) — converts and returns the file in one request (best for small files)
2. **Asynchronous** (\`POST /api/convert/async\`) — returns a job ID immediately; poll \`/api/convert/job/:id\` for status
`,
    contact: { name: 'eBook Converter API', email: 'dev@example.com' },
    license:  { name: 'MIT' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development server' },
  ],
  tags: [
    { name: 'Conversion',   description: 'File conversion endpoints' },
    { name: 'Health',       description: 'API health and metadata' },
  ],
  paths: {
    '/api/health': {
      get: {
        tags:    ['Health'],
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:    { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                    version:   { type: 'string' },
                    uptime:    { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/refresh': {
      get: {
        tags:    ['Health'],
        summary: 'Keep-alive / Refresh server to prevent sleeping',
        description: 'Lightweight endpoint to ping the server and prevent sleeping on free-tier platforms (Render, Railway, etc.).',
        operationId: 'refreshServer',
        responses: {
          200: {
            description: 'Server is awake',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:          { type: 'string', example: 'alive' },
                    message:         { type: 'string', example: 'Server is awake and active' },
                    timestamp:       { type: 'string', format: 'date-time' },
                    uptimeSeconds:   { type: 'number', example: 142 },
                    uptimeFormatted: { type: 'string', example: '2m 22s' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/cleanup': {
      get: {
        tags:    ['Health'],
        summary: 'Manually delete old uploaded and converted files',
        description: 'Deletes files in uploads/ and converted/ older than TTL (default: 60 minutes) and prunes expired async jobs.',
        operationId: 'cleanupFiles',
        parameters: [
          {
            name:        'ttlMinutes',
            in:          'query',
            description: 'Delete files older than this many minutes (e.g. 60). Defaults to server TTL.',
            required:    false,
            schema:      { type: 'number', default: 60 },
          },
          {
            name:        'ttlHours',
            in:          'query',
            description: 'Delete files older than this many hours (e.g. 1).',
            required:    false,
            schema:      { type: 'number' },
          },
        ],
        responses: {
          200: {
            description: 'Cleanup summary',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:     { type: 'string', example: 'success' },
                    message:    { type: 'string', example: 'Cleanup completed for files older than 60 minute(s).' },
                    ttlMinutes: { type: 'number', example: 60 },
                    summary: {
                      type: 'object',
                      properties: {
                        prunedJobs:        { type: 'number', example: 1 },
                        uploadsDeleted:    { type: 'number', example: 3 },
                        convertedDeleted:  { type: 'number', example: 2 },
                        totalFilesDeleted: { type: 'number', example: 5 },
                        bytesFreed:        { type: 'number', example: 4500000 },
                        megabytesFreed:    { type: 'string', example: '4.29 MB' },
                      },
                    },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/convert/formats': {
      get: {
        tags:    ['Conversion'],
        summary: 'List supported conversion formats',
        operationId: 'getFormats',
        responses: {
          200: {
            description: 'Supported conversions',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    supportedConversions: {
                      type: 'object',
                      additionalProperties: { type: 'array', items: { type: 'string' } },
                      example: { epub: ['pdf','html','txt'], pdf: ['html','txt','epub'] },
                    },
                    maxFileSizeMB: { type: 'number', example: 100 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/convert': {
      post: {
        tags:    ['Conversion'],
        summary: 'Convert an eBook/document (synchronous)',
        description: 'Upload a file and receive the converted result directly. Best for files under 10 MB.',
        operationId: 'convertSync',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'targetFormat'],
                properties: {
                  file: {
                    type:        'string',
                    format:      'binary',
                    description: 'The eBook/document file to convert',
                  },
                  targetFormat: {
                    type:        'string',
                    description: 'Target format (pdf, html, txt, epub)',
                    example:     'pdf',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Conversion completed successfully with downloadUrl',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status:         { type: 'string', example: 'success' },
                    message:        { type: 'string', example: 'Conversion completed successfully.' },
                    jobId:          { type: 'string', example: '80a440fa-5d38-47e5-b5ea-0ff3597e47f7' },
                    sourceFile:     { type: 'string', example: 'mybook.azw3' },
                    from:           { type: 'string', example: 'azw3' },
                    to:             { type: 'string', example: 'txt' },
                    outputFileName: { type: 'string', example: 'mybook.txt' },
                    fileSizeBytes:  { type: 'number', example: 51230 },
                    downloadUrl:    { type: 'string', example: 'https://your-api.onrender.com/api/convert/download/80a440fa-5d38-47e5-b5ea-0ff3597e47f7' },
                    downloadPath:   { type: 'string', example: '/api/convert/download/80a440fa-5d38-47e5-b5ea-0ff3597e47f7' },
                    expiresIn:      { type: 'string', example: '60 minutes' },
                  },
                },
              },
            },
          },
          400: { description: 'Bad request — missing file or targetFormat' },
          413: { description: 'File too large' },
          422: { description: 'Unsupported conversion' },
          500: { description: 'Internal server error' },
        },
      },
    },
    '/api/convert/async': {
      post: {
        tags:    ['Conversion'],
        summary: 'Convert an eBook/document (asynchronous)',
        description: 'Start a conversion job. Returns a job ID immediately. Poll `/api/convert/job/{id}` for status.',
        operationId: 'convertAsync',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file', 'targetFormat'],
                properties: {
                  file:         { type: 'string', format: 'binary' },
                  targetFormat: { type: 'string', example: 'epub' },
                },
              },
            },
          },
        },
        responses: {
          202: {
            description: 'Job accepted',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobId:       { type: 'string', format: 'uuid' },
                    status:      { type: 'string', example: 'queued' },
                    pollUrl:     { type: 'string' },
                    downloadUrl: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/convert/job/{id}': {
      get: {
        tags:    ['Conversion'],
        summary: 'Get async job status',
        operationId: 'getJobStatus',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Job status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jobId:       { type: 'string' },
                    status:      { type: 'string', enum: ['queued','processing','done','failed'] },
                    downloadUrl: { type: 'string', nullable: true },
                    error:       { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          404: { description: 'Job not found' },
        },
      },
    },
    '/api/convert/download/{id}': {
      get: {
        tags:    ['Conversion'],
        summary: 'Download converted file',
        operationId: 'downloadConverted',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Converted file binary' },
          404: { description: 'Job not found' },
          409: { description: 'Conversion not yet complete' },
          410: { description: 'File expired' },
        },
      },
    },
  },
};

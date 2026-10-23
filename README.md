# Calibre Ebook Converter API

Node.js/Express API around Calibre `ebook-convert`.

## Supported matrix
Input: EPUB, MOBI, PDF, TXT, AZW3, LRF, FB2, TCR, RTF, PDB.

EPUB -> AZW3, LRF, MOBI, OEB, PDB, PDF, RTF, TXT.

All other supported inputs -> AZW3, LRF, EPUB, MOBI, OEB, PDB, PDF, RTF, TXT.

OEB is returned as a `.oeb.zip`, because Calibre writes OEB as a directory.

## Run with Docker
```bash
cp .env.example .env
docker compose up --build -d
curl http://localhost:3000/health
```

## Run locally
Install Node.js 22+, Calibre (`ebook-convert`) and Unicode fonts first.
```bash
cp .env.example .env
npm install
npm start
```

## API
### Formats
`GET /api/v1/formats`

### Convert
`POST /api/v1/convert` as multipart/form-data:
- `file`: ebook
- `outputFormat`: epub/mobi/azw3/lrf/oeb/pdb/pdf/rtf/txt (matrix is validated)

Example:
```bash
curl -X POST http://localhost:3000/api/v1/convert \
  -F "file=@book.epub" \
  -F "outputFormat=pdf"
```

If `API_KEY` is set, add `-H "x-api-key: YOUR_KEY"` to `/api/v1/*` calls.

### Job
`GET /api/v1/jobs/:jobId`

### Download
`GET /api/v1/jobs/:jobId/download`

### Delete one job and BOTH uploaded/converted files
`DELETE /api/v1/jobs/:jobId/files`

### Delete expired files
`DELETE /api/v1/cleanup/expired`

The server also runs expired-file cleanup automatically. Configure TTL with `FILE_TTL_MINUTES`.

## Flutter example
```dart
final request = http.MultipartRequest(
  'POST',
  Uri.parse('$baseUrl/api/v1/convert'),
);
request.fields['outputFormat'] = 'pdf';
request.files.add(await http.MultipartFile.fromPath('file', filePath));
final response = await request.send();
```

After downloading, call:
```dart
await http.delete(Uri.parse('$baseUrl/api/v1/jobs/$jobId/files'));
```

## Fonts / missing squares
The Docker image installs broad Noto, CJK, DejaVu and FreeFont coverage. For EPUB/AZW3/PDF, the API passes Calibre's `--embed-all-fonts` and `--subset-embedded-fonts`. This significantly improves multilingual output when the needed glyphs exist on the server and the destination supports embedded fonts.

No converter can guarantee every Unicode glyph in every legacy output format. MOBI/PDB/LRF/RTF/TXT have format/reader limitations. PDF input can also contain text/fonts that cannot be reconstructed perfectly. Do not use ASCII transliteration because it destroys original Unicode characters.

## Production notes
- Put the API behind HTTPS/reverse proxy.
- Set `API_KEY` or replace it with your own authentication.
- Keep upload limits/timeouts appropriate for your server.
- For high traffic, move jobs to a real queue (Redis/BullMQ) and isolate conversion workers.
- Only convert files you are authorized to process; this API does not remove DRM.

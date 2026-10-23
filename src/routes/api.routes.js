import { Router } from 'express';
import { upload } from '../middleware/upload.middleware.js';
import * as c from '../controllers/conversion.controller.js';

const r = Router();
r.get('/formats', c.formats);
r.post('/convert', upload.single('file'), c.convert);
r.get('/convert/status/:id', c.status);
r.get('/convert/download/:id', c.download);
r.delete('/convert/:id/files', c.remove);
r.delete('/cleanup/expired', c.expired);
export default r;

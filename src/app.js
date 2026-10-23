import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit';
import api from './routes/api.routes.js'; import { apiToken } from './middleware/auth.middleware.js'; import { notFound,errors } from './middleware/error.middleware.js'; import { calibreVersion } from './services/calibre.service.js'; import { env } from './config/env.js';
const app=express(); if(env.trustProxy)app.set('trust proxy',1); app.use(helmet()); app.use(cors()); app.use(express.json({limit:'1mb'})); app.use(rateLimit({windowMs:60_000,limit:60,standardHeaders:true,legacyHeaders:false}));
app.get('/health',async(req,res)=>{const v=await calibreVersion();res.status(v?200:503).json({status:v?'success':'error',message:v?'API is healthy.':'Calibre unavailable.',calibre:v})});
app.use('/api',apiToken,api); app.use(notFound); app.use(errors); export default app;

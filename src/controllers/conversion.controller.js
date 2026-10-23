import path from 'node:path';
import fs from 'node:fs/promises';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';
import { isAllowed, outputsFor, INPUT_FORMATS } from '../utils/formats.js';
import { safeName, rmSafe } from '../utils/files.js';
import { runCalibre } from '../services/calibre.service.js';
import { zipDirectory } from '../services/archive.service.js';
import { jobs } from '../services/jobs.service.js';
import { cleanupJob, cleanupExpired } from '../services/cleanup.service.js';

export function formats(req,res){res.json({status:'success',inputFormats:INPUT_FORMATS,epubOutputFormats:outputsFor('epub'),nonEpubOutputFormats:outputsFor('pdf')});}

function result(req,j){
  const downloadPath=`/api/convert/download/${j.id}`;
  const host=req.get('host');
  const baseUrl=`${req.protocol}://${host}`;
  return {
    status:'success',
    message:'Conversion completed successfully.',
    jobId:j.id,
    sourceFile:j.originalName,
    from:j.inputFormat,
    to:j.outputFormat,
    outputFileName:j.downloadName,
    fileSizeBytes:j.size,
    downloadUrl:`${baseUrl}${downloadPath}?token=${encodeURIComponent(env.apiToken)}`,
    downloadPath,
    expiresIn:`${Math.round(env.ttlMs/60000)} minutes`
  };
}

async function convertOne(req,file,outputFormat){
  const inputFormat=path.extname(file.originalname).slice(1).toLowerCase();
  if(!isAllowed(inputFormat,outputFormat)){
    await rmSafe(file.path);
    const e=new Error(`Cannot convert ${inputFormat} to ${outputFormat}`); e.status=400; e.allowedOutputs=outputsFor(inputFormat); throw e;
  }
  const id=uuid(), originalBase=path.parse(file.originalname).name, base=safeName(originalBase), workPath=path.join(env.tmp,id);
  await fs.mkdir(workPath,{recursive:true});
  let calibreOutput,downloadPath,downloadName;
  if(outputFormat==='oeb'){
    calibreOutput=path.join(workPath,'oeb'); downloadPath=path.join(env.outputs,`${id}-${base}.oeb.zip`); downloadName=`${originalBase}.oeb.zip`;
  }else{
    calibreOutput=path.join(env.outputs,`${id}-${base}.${outputFormat}`); downloadPath=calibreOutput; downloadName=`${originalBase}.${outputFormat}`;
  }
  const job=jobs.create({id,status:'processing',inputFormat,outputFormat,originalName:file.originalname,inputPath:file.path,outputPath:downloadPath,workPath,downloadName,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  try{
    await runCalibre(file.path,calibreOutput,outputFormat);
    if(outputFormat==='oeb') await zipDirectory(calibreOutput,downloadPath);
    const stat=await fs.stat(downloadPath);
    jobs.update(id,{status:'completed',size:stat.size});
    // Source upload is no longer needed after successful conversion.
    await rmSafe(file.path);
    jobs.update(id,{inputPath:null});
    return result(req,jobs.get(id));
  }catch(e){
    jobs.update(id,{status:'failed',error:e.message});
    await rmSafe(file.path);
    throw e;
  }
}

export async function convert(req,res,next){
  const file=req.file;
  try{
    if(!file) return res.status(400).json({status:'error',message:'file is required. Use multipart field name "file".'});
    const targetFormat=String(req.body.targetFormat||'').toLowerCase().replace('.','');
    if(!targetFormat){ await rmSafe(file.path); return res.status(400).json({status:'error',message:'targetFormat is required.'}); }
    const converted=await convertOne(req,file,targetFormat);
    return res.status(201).json(converted);
  }catch(e){
    if(file?.path) await rmSafe(file.path);
    if(e.status) return res.status(e.status).json({status:'error',message:e.message,...(e.allowedOutputs?{allowedOutputs:e.allowedOutputs}:{})});
    next(e);
  }
}

export function status(req,res){const j=jobs.get(req.params.id);if(!j)return res.status(404).json({status:'error',message:'Job not found'});res.json(j.status==='completed'?result(req,j):{status:j.status,jobId:j.id,sourceFile:j.originalName,from:j.inputFormat,to:j.outputFormat});}
export async function download(req,res,next){try{const j=jobs.get(req.params.id);if(!j)return res.status(404).json({status:'error',message:'Job not found'});if(j.status!=='completed')return res.status(409).json({status:'error',message:'Conversion is not completed'});await fs.access(j.outputPath);res.download(j.outputPath,j.downloadName);}catch(e){next(e);}}
export async function remove(req,res,next){try{const ok=await cleanupJob(req.params.id);if(!ok)return res.status(404).json({status:'error',message:'Job not found'});res.json({status:'success',message:'Converted and temporary files deleted successfully.',jobId:req.params.id});}catch(e){next(e);}}
export async function expired(req,res,next){try{const count=await cleanupExpired();res.json({status:'success',message:'Expired files cleaned successfully.',jobsDeleted:count});}catch(e){next(e);}}

import multer from 'multer';
export function notFound(req,res){res.status(404).json({success:false,message:'Route not found'});}
export function errors(err,req,res,next){ console.error(err); if(res.headersSent)return next(err); const status=err instanceof multer.MulterError?400:(err.status||500); res.status(status).json({success:false,message:err.message||'Internal server error'}); }

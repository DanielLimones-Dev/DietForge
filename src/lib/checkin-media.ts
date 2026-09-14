import {supabase} from './supabase';
const BUCKET='checkin-photos';
export async function uploadCheckinPhoto(owner:string,clientId:number,file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size<=0||file.size>5*1024*1024)throw new Error('Usa una foto JPG, PNG o WebP de hasta 5 MB.');
 const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path=`${owner}/${clientId}/${crypto.randomUUID()}.${extension}`;
 const {error}=await supabase.storage.from(BUCKET).upload(path,file,{upsert:false,contentType:file.type});
 if(error)throw new Error('No se pudo subir la foto. Comprueba la conexión y vuelve a intentarlo.');
 return path;
}
export async function checkinPhotoUrl(path:string):Promise<string>{
 if(!/^[a-f0-9-]{36}\/\d+\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path))throw new Error('Foto inválida.');
 const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,300);
 if(error||!data)throw new Error('No se pudo cargar la foto.');return data.signedUrl;
}

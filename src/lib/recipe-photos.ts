import {supabase} from './supabase';
export async function uploadRecipePhoto(file:File):Promise<string>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Elige una foto JPG, PNG o WebP de hasta 5 MB.');
 const {data,error}=await supabase.auth.getUser();
 if(error||!data.user)throw new Error('Inicia sesión para subir la foto.');
 const owner=data.user.id;
 const bitmap=await createImageBitmap(file);
 let blob:Blob|null;
 try{
  const ratio=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const context=canvas.getContext('2d');if(!context)throw new Error('No se pudo preparar la foto.');
  context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.8));
 }finally{bitmap.close();}
 if(!blob)throw new Error('No se pudo procesar la foto.');
 const path=`${owner}/${crypto.randomUUID()}.jpg`;
 const uploaded=await supabase.storage.from('recipe-photos').upload(path,blob,{contentType:'image/jpeg',upsert:false});
 if(uploaded.error)throw new Error('No se pudo subir la foto. Revisa la conexión y que el almacenamiento de recetas esté habilitado.');
 return path;
}
export async function recipePhotoUrl(path:string):Promise<string>{
 const {data,error}=await supabase.storage.from('recipe-photos').createSignedUrl(path,900);
 if(error)throw new Error('No se pudo cargar la foto.');return data.signedUrl;
}

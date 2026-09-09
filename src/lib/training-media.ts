import type {TrainingExercise} from '@/types';

export const VIDEO_BUCKET = 'training-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// Persist object paths, never expiring signed URLs. The base catalog has no
// media: every displayed video must have been selected by the coach.
export function mediaPath(value:string):string|null {
 const match=/^storage:([a-f0-9-]{36}\/[a-f0-9-]{36}\.(?:mp4|webm|mov))$/i.exec(value);
 return match?.[1]??null;
}
export function youtubeUrl(value:string):string|null {
 try {const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
 const id=u.hostname==='youtu.be'?u.pathname.slice(1):['youtube.com','www.youtube.com','m.youtube.com'].includes(u.hostname)?(u.pathname==='/watch'?u.searchParams.get('v'):u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1]):null;
 if(!id||!/^[\w-]{11}$/.test(id))return null;
 const raw=u.searchParams.get('t')??u.searchParams.get('start')??'';
 const parts=/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(raw);
 const seconds=parts?Number(parts[1]??0)*3600+Number(parts[2]??0)*60+Number(parts[3]??0):0;
 return `https://www.youtube.com/watch?v=${id}${seconds>0&&seconds<=86400?`&t=${seconds}s`:''}`;
 }catch{return null;}
}
export function exerciseVideo(exercise:TrainingExercise):string {
 return exercise.video_custom&&exercise.video_url&&(mediaPath(exercise.video_url)||youtubeUrl(exercise.video_url))?exercise.video_url:'';
}
export function videoFileError(file:Pick<File,'type'|'size'>):string|null {
 if(!['video/mp4','video/webm','video/quicktime'].includes(file.type))return 'Usa un video MP4, WebM o MOV.';
 return file.size<=0||file.size>MAX_VIDEO_BYTES?'El video debe pesar entre 1 byte y 50 MB.':null;
}

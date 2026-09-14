import type { PhotoAngle } from '@/types';
import { validTrainingDate, trainingDateValue } from './training';

export const measurementFields = { neck:'Cuello', shoulders:'Hombros', chest:'Pecho', waist:'Cintura', hips:'Cadera', left_arm:'Brazo izquierdo', right_arm:'Brazo derecho', left_thigh:'Muslo izquierdo', right_thigh:'Muslo derecho', left_calf:'Pantorrilla izquierda', right_calf:'Pantorrilla derecha' } as const;
export const adherenceFields = { meals:'Alimentación', supplements:'Suplementos', training:'Entrenamiento', cardio:'Cardio' } as const;
export const wellbeingFields = { energy:'Energía', sleep:'Sueño', hunger:'Hambre', libido:'Libido', digestion:'Digestión' } as const;
export const photoAngles: Record<PhotoAngle,string> = { front_relaxed:'Frente relajado', back_relaxed:'Espalda relajada', front_double_biceps:'Doble bíceps frontal', back_lat_spread:'Expansión dorsal posterior', side_chest:'Pecho lateral', side_triceps:'Tríceps lateral', ab_thigh:'Abdomen y muslo', most_muscular:'Más muscular' };
export interface PortalCheckInPhoto { angle:PhotoAngle; path:string }
export interface PortalCheckInDraft { date:string; weight:string; measurements:Record<string,string>; adherence:Record<string,string>; notes:string; photos:PortalCheckInPhoto[] }
export interface PortalCheckInData extends Record<string,unknown> { date:string; weight:number; measurements?:Record<string,number>; adherence?:Record<string,number>; notes:string; photos:PortalCheckInPhoto[] }
export function emptyPortalCheckIn():PortalCheckInDraft { return {date:trainingDateValue(),weight:'',measurements:{},adherence:{},notes:'',photos:[]}; }
export function validatePortalCheckIn(draft:PortalCheckInDraft):{errors:string[];data:PortalCheckInData|null} {
 const errors:string[]=[];
 if(!validTrainingDate(draft.date))errors.push('Selecciona una fecha válida.');
 const number=(raw:string,label:string,min:number,max:number,required=false)=>{if(!raw.trim()){if(required)errors.push(`${label} es obligatorio.`);return undefined;}const n=Number(raw);if(!Number.isFinite(n)||n<min||n>max){errors.push(`${label} debe estar entre ${min} y ${max}.`);return undefined;}return n;};
 const weight=number(draft.weight,'El peso',20,500,true);
 const measurements:Record<string,number>={},adherence:Record<string,number>={};
 for(const [key,label] of Object.entries(measurementFields)){const n=number(draft.measurements[key]??'',label,0.1,300);if(n!==undefined)measurements[key]=n;}
 for(const [key,label] of Object.entries({...adherenceFields,...wellbeingFields})){const isWellbeing=key in wellbeingFields;const n=number(draft.adherence[key]??'',label,isWellbeing?1:0,isWellbeing?5:100);if(n!==undefined){if(isWellbeing&&!Number.isInteger(n))errors.push(`${label} debe ser un número entero.`);adherence[key]=n;}}
 if(draft.notes.length>5000)errors.push('Las notas admiten hasta 5000 caracteres.');
 if(draft.photos.length>8||new Set(draft.photos.map(p=>p.angle)).size!==draft.photos.length||draft.photos.some(p=>!Object.prototype.hasOwnProperty.call(photoAngles,p.angle)||!p.path.trim()))errors.push('Revisa las fotos: máximo una por ángulo.');
 if(errors.length||weight===undefined)return {errors,data:null};
 return {errors,data:{date:draft.date,weight,...(Object.keys(measurements).length?{measurements}:{}),...(Object.keys(adherence).length?{adherence}:{}),notes:draft.notes.trim(),photos:draft.photos.map(p=>({...p}))}};
}

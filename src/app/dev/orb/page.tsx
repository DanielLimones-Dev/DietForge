import {notFound} from 'next/navigation';
import {PortalMesocycle} from '@/components/PortalMesocycle';
import {NotificationBell} from '@/components/ui/notification-bell';
import {DeleteIconButton} from '@/components/ui/delete-icon-button';
import type {TrainingProgram} from '@/types';

const weeks=(sets:number,repsMin:number,repsMax:number,rirEnd:number)=>Array.from({length:4},(_,index)=>({
 week:index+1,sets:sets+(index>1?1:0),reps_min:repsMin,reps_max:repsMax,rir_start:rirEnd+1,rir_end:rirEnd,
}));

const previewProgram:TrainingProgram={
 id:1,client_id:1,name:'Mesociclo de hipertrofia',objective:'hypertrophy',start_date:'2026-09-19',
 duration_weeks:4,mesocycle_number:2,rotation_number:1,priorities:['Pectoral','Espalda'],
 split:'Push · Pull · Legs',notes:'Controla la técnica y registra cada serie antes de avanzar.',
 status:'active',created_at:'2026-09-19',updated_at:'2026-09-19',
 days:[
  {id:'push',day_number:1,name:'Push',notes:'Pectoral y tríceps',exercises:[
   {id:'press',name:'Press inclinado con mancuernas',muscle_group:'Pectoral',prescriptions:weeks(3,8,12,1)},
   {id:'lateral',name:'Elevación lateral',muscle_group:'Deltoides',prescriptions:weeks(3,12,15,1)},
  ]},
  {id:'pull',day_number:2,name:'Pull',notes:'Espalda y bíceps',exercises:[
   {id:'row',name:'Remo en máquina',muscle_group:'Espalda',prescriptions:weeks(4,8,12,1)},
  ]},
 ],review:{session_fatigue:[0,0,0,0]},
};

export default function FluidOrbPreview(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <main className="care-page"><section className="rare-ui-preview"><div><p className="df-eyebrow">COMPONENTES UNIFICADOS</p><h1>Acciones más claras</h1><span>Campana con contador y eliminación con respuesta visual.</span></div><div className="rare-ui-preview-actions"><NotificationBell count={7} aria-label="Notificaciones, 7 sin leer"/><DeleteIconButton label="Eliminar elemento"/></div></section><PortalMesocycle programs={[previewProgram]}/></main>;
}

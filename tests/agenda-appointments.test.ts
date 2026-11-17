import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CareAgenda} from '../src/components/CareAgenda';
import {agendaEvents,agendaStateLabel,validateAppointment} from '../src/lib/agenda';
import {civilAdd} from '../src/lib/training-tracking';
import {trainingDateValue} from '../src/lib/training';
import type {PortalData} from '../src/lib/client-portal';

const today = trainingDateValue();
const tomorrow = civilAdd(today, 1);

function fixture(activity:unknown[] = []):PortalData {
  return {
    client: {id: 7, name: 'Cliente de prueba', next_check_in_date: undefined},
    trainingPrograms: [], mealPlans: [], mealPlanItems: [], foods: [], measurements: [], weekPlans: [],
    activity,
  } as unknown as PortalData;
}

test('a client can book one appointment with date, time and an optional reason',()=>{
  const result = validateAppointment({date:tomorrow,time:'09:30',note:'  Revisión de medidas  '},{today,activity:[]});
  assert.deepEqual(result.errors,[]);
  assert.deepEqual(result.data,{date:tomorrow,time:'09:30',note:'Revisión de medidas',status:'requested'});
});

test('booking rejects past dates, off-hours, wrong intervals, long reasons and duplicate slots',()=>{
  const active = [{id:'a',kind:'appointment',data:{date:tomorrow,time:'09:30',note:'',status:'requested'}}];
  assert.match(validateAppointment({date:civilAdd(today,-1),time:'09:30',note:''},{today,activity:[]}).errors.join(' '),/fecha pasada/);
  assert.match(validateAppointment({date:tomorrow,time:'22:00',note:''},{today,activity:[]}).errors.join(' '),/07:00 y 21:00/);
  assert.match(validateAppointment({date:tomorrow,time:'09:07',note:''},{today,activity:[]}).errors.join(' '),/15 minutos/);
  assert.match(validateAppointment({date:tomorrow,time:'',note:''},{today,activity:[]}).errors.join(' '),/hora válida/);
  assert.match(validateAppointment({date:tomorrow,time:'09:30',note:'x'.repeat(301)},{today,activity:[]}).errors.join(' '),/300 caracteres/);
  assert.match(validateAppointment({date:tomorrow,time:'09:30',note:''},{today,activity:active as never}).errors.join(' '),/Ya existe una cita/);
  const moving = validateAppointment({date:tomorrow,time:'09:30',note:''},{today,activity:active as never,id:'a'});
  assert.deepEqual(moving.errors,[],'editing the same appointment does not conflict with itself');
});

test('the agenda lists the appointment with time and client and keeps reminders out',()=>{
  const data = fixture([
    {id:'a',kind:'appointment',data:{date:tomorrow,time:'17:45',note:'Ajuste de plan',status:'confirmed'}},
    {id:'reminder',kind:'event',data:{date:tomorrow,title:'Recordatorio heredado',completed:false}},
  ]);
  const events = agendaEvents(data);
  assert.equal(events.length,1);
  assert.equal(events[0].kind,'appointment');
  assert.equal(events[0].time,'17:45');
  assert.equal(events[0].client,'Cliente de prueba');
  assert.equal(events[0].title,'Ajuste de plan');
  assert.equal(agendaStateLabel(events[0],today),'Confirmada');
});

test('appointment states stay honest: requested, unconfirmed when late, cancelled',()=>{
  const future = agendaEvents(fixture([{id:'a',kind:'appointment',data:{date:tomorrow,time:'10:00',note:'',status:'requested'}}]))[0];
  assert.equal(agendaStateLabel(future,today),'Solicitada');
  const past = agendaEvents(fixture([{id:'b',kind:'appointment',data:{date:civilAdd(today,-2),time:'10:00',note:'',status:'requested'}}]))[0];
  assert.equal(agendaStateLabel(past,today),'Sin confirmar');
  const cancelled = agendaEvents(fixture([{id:'c',kind:'appointment',data:{date:tomorrow,time:'10:00',note:'',status:'cancelled'}}]))[0];
  assert.equal(agendaStateLabel(cancelled,today),'Cancelada');
});

test('the client portal renders a short booking form and the booked appointment',()=>{
  const data = fixture([{id:'a',kind:'appointment',data:{date:today,time:'08:15',note:'Revisión mensual',status:'requested'}}]);
  const html = renderToStaticMarkup(createElement(CareAgenda,{data,coach:false,onSaved:()=>{},onSave:async()=>{}}));
  assert.match(html,/Solicitar una cita/);
  assert.match(html,/Solicitar cita/);
  assert.match(html,/08:15/);
  assert.match(html,/Revisión mensual/);
  assert.match(html,/Solicitada/);
  assert.doesNotMatch(html,/Confirmar/,'only the coach confirms');
});

test('the coach agenda shows the client and confirms without a booking form',()=>{
  const data = fixture([{id:'a',kind:'appointment',data:{date:today,time:'08:15',note:'Revisión mensual',status:'requested'}}]);
  const html = renderToStaticMarkup(createElement(CareAgenda,{data,coach:true,onSaved:()=>{},onSave:async()=>{}}));
  assert.doesNotMatch(html,/Solicitar una cita/);
  assert.match(html,/Cita · Cliente de prueba/);
  assert.match(html,/08:15/);
  assert.match(html,/Confirmar/);
  assert.match(html,/Cancelar/);
});

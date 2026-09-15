import test from 'node:test';
import assert from 'node:assert/strict';
import {act,createElement,useState} from 'react';
import {JSDOM} from 'jsdom';
import {parseTrainingRepRange} from '../src/components/TrainingRepRange';

test('rep range accepts ordered bounds and rejects incomplete or out-of-range values',()=>{
 assert.deepEqual(parseTrainingRepRange('12 - 15'),{min:12,max:15});assert.deepEqual(parseTrainingRepRange('8'),{min:8,max:8});
 assert.deepEqual(parseTrainingRepRange('120 - 150'),{min:120,max:150});assert.deepEqual(parseTrainingRepRange('0 - 200'),{min:0,max:200});
 for(const value of ['', '12 -','15 - 12','-1 - 5','10 - 201','1.5 - 3','foo'])assert.equal(parseTrainingRepRange(value),null);
});
test('rep range only commits on blur and restores invalid drafts',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost'});const keys=['window','document','navigator'] as const;
 const originals=new Map(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));for(const k of keys)Object.defineProperty(globalThis,k,{configurable:true,value:dom.window[k]});Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const {createRoot}=await import('react-dom/client');const {TrainingRepRange}=await import('../src/components/TrainingRepRange');const root=createRoot(document.getElementById('root')!);const saved:number[][]=[];
 function Harness(){const [range,setRange]=useState({min:8,max:12});return createElement(TrainingRepRange,{...range,label:'Repeticiones',onCommit:(min,max)=>{saved.push([min,max]);setRange({min,max});}});}
 const edit=async(value:string)=>{await act(async()=>{const input=document.querySelector('input')!;input.focus();});await act(async()=>{const input=document.querySelector('input')!;Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 try{await act(async()=>root.render(createElement(Harness)));await edit('12 - 15');assert.equal(saved.length,0);await act(async()=>document.querySelector('input')!.blur());assert.deepEqual(saved,[[12,15]]);assert.equal(document.querySelector('input')!.value,'12 - 15');await edit('12 -');await act(async()=>document.querySelector('input')!.blur());assert.deepEqual(saved,[[12,15]]);assert.equal(document.querySelector('input')!.value,'12 - 15');assert.ok(document.querySelector('[role=alert]'));await edit('10 - 14');await act(async()=>document.querySelector('input')!.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true})));assert.deepEqual(saved,[[12,15],[10,14]]);}finally{await act(async()=>root.unmount());for(const k of keys){const old=originals.get(k);if(old)Object.defineProperty(globalThis,k,old);else Reflect.deleteProperty(globalThis,k);}dom.window.close();}
});

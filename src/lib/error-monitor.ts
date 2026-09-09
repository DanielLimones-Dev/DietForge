// Store only error categories and timestamps; never retain messages, tokens, names or URLs.
export interface ErrorEvent {type:'runtime'|'promise'|'react';at:string}
const events:ErrorEvent[]=[];
export function recordError(type:ErrorEvent['type']){events.push({type,at:new Date().toISOString()});if(events.length>100)events.shift();}
export function monitoredErrors(){return [...events];}

// One read lane for initial load, polling and post-save reloads.
export function startAutoRefresh<T>(options: {
 read: () => Promise<T>; apply: (value:T) => void; error: (error:unknown) => void;
 shouldRetry?: (error:unknown) => boolean;
 active: () => boolean; schedule: (fn:()=>void, delay:number) => ReturnType<typeof setTimeout>;
 cancel: (id:ReturnType<typeof setTimeout>) => void;
}) {
 let stopped=false, running=false, blocked=false, queued=false, generation=0, failures=0;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let pending:Promise<void>=Promise.resolve();
 const clear=()=>{if(timer!==undefined){options.cancel(timer);timer=undefined;}};
 const refresh=():Promise<void>=>{
  if(stopped||running||blocked)return Promise.resolve();
  clear();
  if(!options.active())return Promise.resolve();
  running=true;
  pending=(async()=>{
   try {
    do {
     queued=false;
     const version=generation;
     try {
      const value=await options.read();
      if(!stopped&&version===generation){options.apply(value);failures=0;}
     } catch(error) {
      if(!stopped&&version===generation){failures++;blocked=options.shouldRetry?.(error)===false;options.error(error);}
     }
    } while(queued&&!stopped&&!blocked&&options.active());
   } finally {
    running=false;
    if(!stopped&&!blocked)timer=options.schedule(()=>void refresh(),Math.min(60000,5000*2**failures));
   }
  })();
  return pending;
 };
 return {
  refresh,
  // Invalidate a pre-save response, then coalesce concurrent reloads into one fresh read.
  reload(){
   if(stopped)return Promise.resolve();
   generation++;blocked=false;
   if(running){queued=true;return pending;}
   return refresh();
  },
  stop(){stopped=true;generation++;queued=false;clear();},
 };
}

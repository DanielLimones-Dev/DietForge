// Serial background reads; never publish a response after the view is disposed.
export function startAutoRefresh<T>(options: {
 read: () => Promise<T>; apply: (value:T) => void; error: () => void;
 active: () => boolean; schedule: (fn:()=>void, delay:number) => ReturnType<typeof setTimeout>;
 cancel: (id:ReturnType<typeof setTimeout>) => void;
}) {
 let stopped=false, running=false, failures=0;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const refresh=async()=>{
  if(stopped||running)return;
  if(timer!==undefined)options.cancel(timer);
  if(!options.active())return;
  running=true;
  try {const value=await options.read();if(!stopped){options.apply(value);failures=0;}}
  catch {if(!stopped){failures++;options.error();}}
  finally {running=false;if(!stopped)timer=options.schedule(()=>void refresh(),Math.min(60000,5000*2**failures));}
 };
 return {refresh,stop(){stopped=true;if(timer!==undefined)options.cancel(timer);}};
}

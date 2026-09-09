import type { Snapshot } from './model';
export type SaveState = { phase: 'ready'|'saving'|'error'; message: string };
// One immutable in-flight operation. Retry reuses its ID and revision after an ambiguous response.
export class SaveQueue {
  private operation: {snapshot:Snapshot; revision:number; id:string}|null=null;
  private latest: Snapshot|null=null;
  private running: Promise<void>|null=null;
  state: SaveState={phase:'ready',message:'Guardado en Supabase'};
  constructor(public revision:number,private write:(s:Snapshot,r:number,id:string)=>Promise<number>,private changed:(s:SaveState)=>void,private journal:(s:Snapshot,r:number)=>void, private operationJournal:(op:{snapshot:Snapshot;revision:number;id:string}|null)=>void=()=>{}) {}
  private set(state:SaveState){this.state=state;this.changed(state);}
  enqueue(snapshot:Snapshot) {this.journal(snapshot,this.revision);this.latest=structuredClone(snapshot);if(this.state.phase!=='error')void this.flush();}
  async flush():Promise<void> {
    if(this.running)return this.running;
    this.running=this.drain().finally(()=>{this.running=null;});
    return this.running;
  }
  private async drain(){
    try {
      while(this.operation||this.latest){
        if(!this.operation){this.operation={snapshot:this.latest!,revision:this.revision,id:crypto.randomUUID()};this.latest=null;this.operationJournal(this.operation);}
        this.set({phase:'saving',message:'Guardando en Supabase…'});
        this.revision=await this.write(this.operation.snapshot,this.operation.revision,this.operation.id);
        this.operation=null;this.operationJournal(null);
      }
      this.set({phase:'ready',message:'Guardado en Supabase'});
    }catch(e){this.set({phase:'error',message:e instanceof Error?e.message:'No se pudo guardar. Conserva tu respaldo.'});}
  }
  get pending(){return !!(this.latest||this.operation||this.running);}
}

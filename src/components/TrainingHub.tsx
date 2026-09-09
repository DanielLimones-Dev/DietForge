"use client";

import Link from "next/link";
import { ArrowRight, CalendarRange, Dumbbell, Layers3, Users } from "lucide-react";
import { db } from "@/lib/db";

export function TrainingHub() {
  const clients = db.getClients();
  const programs = db.getTrainingPrograms();
  const active = programs.filter(program => program.status === "active").length;
  const programmedExercises = programs.reduce((sum, program) => sum + program.days.reduce((daySum, day) => daySum + day.exercises.length, 0), 0);
  return <div className="training-hub">
    <header className="training-hub-hero"><div><span><Dumbbell size={14}/> PROGRAMACIÓN</span><h1>Rutinas personalizadas</h1><p>Diseña bloques por cliente, ajusta cada semana y revisa el volumen antes de publicar.</p></div>{clients[0] && <Link href={`/clients/${clients[0].id}/training`}>Crear rutina <ArrowRight size={16}/></Link>}</header>
    <section className="training-hub-metrics"><article><span><Layers3 size={18}/></span><div><small>BLOQUES</small><strong>{programs.length}</strong><p>{active} activos</p></div></article><article><span><Users size={18}/></span><div><small>CLIENTES</small><strong>{clients.length}</strong><p>con expediente disponible</p></div></article><article><span><Dumbbell size={18}/></span><div><small>EJERCICIOS PROGRAMADOS</small><strong>{programmedExercises}</strong><p>en todos los bloques</p></div></article></section>
    <section className="training-hub-directory"><header><div><span>DIRECTORIO</span><h2>Entrenamiento por cliente</h2></div><p>Abre un expediente de programación para crear o continuar una rutina.</p></header><div>{clients.length ? clients.map(client => {
      const clientPrograms = programs.filter(program => program.client_id === client.id);
      const latest = clientPrograms[0];
      return <Link key={client.id} href={`/clients/${client.id}/training`}><span className="training-client-avatar">{client.name.slice(0, 1).toUpperCase()}</span><div><strong>{client.name}</strong><p>{latest ? latest.name : "Sin rutina creada"}</p></div><span className={latest?.status === "active" ? "active" : ""}><CalendarRange size={14}/>{latest ? `${latest.duration_weeks} semanas` : "Crear"}</span><ArrowRight size={16}/></Link>;
    }) : <div className="training-hub-empty"><Dumbbell size={24}/><p>Registra un cliente antes de crear su rutina.</p><Link href="/clients/new">Registrar cliente</Link></div>}</div></section>
  </div>;
}

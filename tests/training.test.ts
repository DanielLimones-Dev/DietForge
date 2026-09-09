import assert from "node:assert/strict";
import test from "node:test";
import { copyTrainingWeek, createTrainingDraft, exerciseFromLibrary, independentTrainingProgram, replaceTrainingDays, resizeProgramWeeks, trainingDateValue, trainingDays, trainingProgramIssues, weeklyMuscleVolume } from "../src/lib/training.ts";
import { trainingProgramHtml } from "../src/lib/training-pdf.ts";
import { emptySnapshot, validateSnapshot } from "../src/lib/cloud/model.ts";
import type { Client, TrainingProgram } from "../src/types/index.ts";

const program = (): TrainingProgram => ({
  ...createTrainingDraft(7, "Daniel", "2026-09-07"), id: 1, created_at: "2026-09-07T00:00:00Z", updated_at: "2026-09-07T00:00:00Z",
});

test("each training week owns an independent day and exercise schedule",()=>{
  const legacy=program();legacy.days[0].exercises.push(exerciseFromLibrary({id:'press',name:'Press',muscle_group:'Pectoral'},5));
  const value=independentTrainingProgram(legacy);
  assert.equal(trainingDays(value,1).length,5);assert.equal(trainingDays(value,2).length,5);
  replaceTrainingDays(value,2,trainingDays(value,2).slice(0,3));
  trainingDays(value,2)[0].exercises[0].prescriptions[1].sets=7;
  assert.equal(trainingDays(value,1).length,5);
  assert.equal(trainingDays(value,1)[0].exercises[0].prescriptions[1].sets,3);
  assert.equal(trainingDays(value,2).length,3);
  const copied=copyTrainingWeek(value,2,3);
  assert.equal(trainingDays(copied,3).length,3);
  trainingDays(copied,3)[0].name='Semana 3';
  assert.notEqual(trainingDays(copied,2)[0].name,'Semana 3');
});

test("training volume sums direct sets and session frequency", () => {
  const value = program();
  value.days[0].exercises.push(exerciseFromLibrary({ id: "a", name: "Remo", muscle_group: "Espalda" }, 5));
  value.days[1].exercises.push(exerciseFromLibrary({ id: "b", name: "Jalón", muscle_group: "Espalda" }, 5));
  value.days[0].exercises[0].prescriptions[0].sets = 3;
  value.days[1].exercises[0].prescriptions[0].sets = 2;
  assert.deepEqual(weeklyMuscleVolume(value, 1), [{ muscle_group: "Espalda", sets: 5, frequency: 2 }]);
});

test("new training blocks use the coach's civil date instead of the UTC date", () => {
  const afterMidnightUtc = new Date("2026-09-08T03:30:00.000Z");
  assert.equal(trainingDateValue(afterMidnightUtc, "America/Mexico_City"), "2026-09-07");
});

test("copying and resizing weeks preserves prescriptions without sharing objects", () => {
  const value = program();
  value.days[0].exercises.push(exerciseFromLibrary({ id: "a", name: "Press", muscle_group: "Pectoral" }, 5));
  value.days[0].exercises[0].prescriptions[0].sets = 4;
  const copied = copyTrainingWeek(value, 1, 2);
  assert.equal(copied.days[0].exercises[0].prescriptions[1].sets, 4);
  copied.days[0].exercises[0].prescriptions[1].sets = 2;
  assert.equal(copied.days[0].exercises[0].prescriptions[0].sets, 4);
  assert.equal(resizeProgramWeeks(copied, 7).days[0].exercises[0].prescriptions.length, 7);
});

test("training validation detects reversed repetition ranges", () => {
  const value = program();
  const exercise = exerciseFromLibrary({ id: "a", name: "Curl", muscle_group: "Bíceps" }, 5);
  exercise.prescriptions[0].reps_min = 15; exercise.prescriptions[0].reps_max = 8;
  value.days[0].exercises.push(exercise);
  assert.match(trainingProgramIssues(value, 1).join(" "), /mínimo de repeticiones/);
});

test("old cloud snapshots gain the training and exercise collections without losing records", () => {
  const snapshot = emptySnapshot();
  const legacy = structuredClone(snapshot) as unknown as { database: Record<string, unknown> };
  delete legacy.database.trainingPrograms;
  delete legacy.database.exercises;
  const upgraded = validateSnapshot(legacy);
  assert.deepEqual(upgraded.database.trainingPrograms, []);
  assert.deepEqual(upgraded.database.exercises, []);
});

test("training PDF escapes client and exercise content", () => {
  const value = program();
  value.name = '<img src=x onerror="alert(1)">';
  value.days[0].exercises.push(exerciseFromLibrary({ id: "a", name: "Press <script>", muscle_group: "Pectoral", video_url: "javascript:alert(1)" }, 5));
  const client: Client = { id: 7, name: "Daniel & equipo", created_at: "", updated_at: "" };
  const html = trainingProgramHtml(value, client);
  assert.ok(!html.includes("Press <script>"));
  assert.match(html, /Press &lt;script&gt;/);
  assert.ok(!html.includes("javascript:alert"));
  assert.match(html, /Daniel &amp; equipo/);
});

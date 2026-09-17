import { test } from "node:test";
import assert from "node:assert/strict";
import exercises from "../src/data/training-exercises.json";
import { mergedExerciseLibrary } from "../src/lib/exercise-library";

test("the complete inherited exercise catalog has no default videos", () => {
  assert.equal(exercises.length, 134);
  for (const exercise of exercises) {
    assert.equal("video_url" in exercise, false, `${exercise.name} contains a default video`);
    assert.ok(exercise.name.trim());
    assert.ok(exercise.muscle_group.trim());
  }
});

test("a coach can personalize an included exercise without seeing a duplicate", () => {
  const included = [{ id: "base-1", name: "Press inclinado", muscle_group: "Pectoral" }];
  const custom = [{
    id: 7,
    name: "Press inclinado",
    muscle_group: "Pectoral",
    video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    created_at: "2026-09-08T00:00:00.000Z",
    updated_at: "2026-09-08T00:00:00.000Z",
  }];
  const library = mergedExerciseLibrary(custom, included);
  assert.equal(library.length, 1);
  assert.equal(library[0].id, "coach-7");
  assert.equal(library[0].video_url, custom[0].video_url);
});

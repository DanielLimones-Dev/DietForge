import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarCells} from '../src/components/PeakCalendar';
test('monthly calendar has six Monday-first weeks and includes leap day and year boundaries',()=>{
 const feb=calendarCells('2024-02');
 assert.equal(feb.length,42);assert.equal(new Set(feb).size,42);
 assert.equal(feb[0],'2024-01-29');assert.ok(feb.includes('2024-02-29'));
 assert.equal(calendarCells('2027-01')[0],'2026-12-28');
});

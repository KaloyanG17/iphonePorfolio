import assert from 'node:assert/strict';
import { fmt, garageAt, lapStep, lightsState, sectorStep, speedProfile, steerTo, type LapTracker } from './race.ts';

const N = 600;
const drive = (s: LapTracker, path: number[]) => path.filter((i) => lapStep(s, i, N)).length;

// A full forward lap from the line counts once
assert.equal(drive({ half: false, prev: 0 }, [0, 100, 300, 500, 590, 5]), 1);
// Wiggling back and forth over the line without going round never counts
assert.equal(drive({ half: false, prev: 0 }, [0, 595, 3, 598, 2]), 0);
// Reversing round the whole track and over the line does not count
assert.equal(drive({ half: false, prev: 0 }, [0, 595, 300, 50, 5, 595]), 0);
// Reversing past halfway, back over the line, then driving forwards over it does not count either
assert.equal(drive({ half: false, prev: 0 }, [0, 590, 300, 50, 590, 5]), 0);
// Two forward laps count twice
assert.equal(drive({ half: false, prev: 0 }, [0, 300, 595, 4, 300, 595, 4]), 2);

// Sectors: forward entries announce, reversing back does not, and the line wraps 3 -> 0
const sec = { sector: 3 };
assert.deepEqual([590, 5, 160, 140, 160, 310].map((i) => sectorStep(sec, i, N)), [-1, 0, 1, -1, -1, 2]);

// Garages: parked on the pit side near a bay and slow
const bays = [20, 40, 60];
assert.equal(garageAt(41, -12, 5, bays, 9, -10), 1);
assert.equal(garageAt(41, -12, 80, bays, 9, -10), -1); // too fast
assert.equal(garageAt(41, 3, 5, bays, 9, -10), -1); // wrong side of the track
assert.equal(garageAt(200, -12, 5, bays, 9, -10), -1); // nowhere near the pit lane

// Start lights: one per 800 ms, all five held, then out after the hold
assert.deepEqual(lightsState(0, 500), { lit: 1, out: false });
assert.deepEqual(lightsState(3300, 500), { lit: 5, out: false });
assert.deepEqual(lightsState(4400, 500), { lit: 5, out: false });
assert.deepEqual(lightsState(4500, 500), { lit: 5, out: true });

// AI speeds: flat out on a straight, slower into a corner, and braking starts before it
const loop = Array.from({ length: 200 }, (_, i) => {
  const a = i < 100 ? 0 : ((i - 100) / 100) * Math.PI * 2; // straight, then a full circle
  return { x: Math.sin(a), z: Math.cos(a) };
});
const prof = speedProfile(loop, 1, 60, 15, 20);
assert.equal(prof[2], 60); // start of the straight, long before the braking zone
assert.ok(prof[150] < 40, 'slow in the corner');
assert.ok(prof[50] < 60 && prof[50] > prof[150], 'braking before the corner');

// Autopilot steering: straight ahead is 0, left is positive, and the wrap at ±π never flips the answer
assert.equal(steerTo(0, 0, 10), 0);
assert.ok(steerTo(0, 5, 10) > 0, 'target to the left (+x when facing +z) steers left');
assert.ok(steerTo(0, -5, 10) < 0);
assert.ok(steerTo(Math.PI - 0.05, -0.5, -10) > 0 && steerTo(Math.PI - 0.05, -0.5, -10) < 0.5, 'small correction across the ±π seam');
assert.equal(steerTo(0, 0, -10), 1 * Math.sign(Math.PI)); // straight behind: full lock one way, not NaN

assert.equal(fmt(0), '-:--.---');
assert.equal(fmt(83456), '1:23.456');
assert.equal(fmt(5007), '0:05.007');

console.log('race: all checks passed');

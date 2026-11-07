import assert from 'node:assert/strict';
import { run } from './terminal.ts';

assert.deepEqual(run('   '), { lines: [] });
assert.equal(run('open about').open, 'about');
assert.equal(run('OPEN Projects').open, 'projects');
const p = run('open shiplog');
assert.equal(p.open, 'projects');
assert.equal(p.project, 'shiplog');
assert.equal(run('open simulated motorsport').project, 'motorsport');
assert.equal(run('open nope').open, undefined);
assert.equal(run('sudo hire-me').open, 'messages');
assert.equal(run('open github').open, 'github');
assert.equal(run('open LinkedIn').open, 'linkedin');
assert.equal(run('open cv').open, 'cv');
assert.equal(run('sudo rm -rf').open, undefined);
assert.equal(run('clear').clear, true);
assert.match(run('wat').lines[0], /command not found: wat/);

console.log('terminal: all checks passed');

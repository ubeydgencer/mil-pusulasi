import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const html=await readFile('dist/index.html','utf8');
for(const asset of ['styles.css','app.js']){assert(html.includes(`./${asset}`));await readFile(`dist/${asset}`);}
for(const file of ['dist/app.js','dist/lib/miles.js','scripts/serve.mjs']){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
for(const file of await readdir('dist/data')){const json=JSON.parse(await readFile(`dist/data/${file}`,'utf8'));assert.equal(json.verifiedAt,'2026-10-09');}
const awards=JSON.parse(await readFile('dist/data/awards.json','utf8'));assert.equal(awards.regions.length,12);assert.equal(new Set(awards.regions.map(r=>r.id)).size,12);
for(const r of awards.regions){for(const k of ['promoEconomy','promoBusiness','standardEconomy','standardBusiness'])assert(Number.isInteger(r[k])&&r[k]>0);assert(r.countries.length);}
console.log('JavaScript syntax, local assets and all 12 award regions verified.');

import {projectScopes,compareReview,reviewSummary} from '../dist/lib/reviews.js';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const html=await readFile('dist/index.html','utf8');
for(const asset of ['styles.css','app.js']){assert(html.includes(`./${asset}`));await readFile(`dist/${asset}`);}
for(const file of ['dist/app.js','dist/lib/miles.js','dist/lib/reviews.js','scripts/review-rules.mjs','scripts/serve.mjs']){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);}
const datasets=Object.fromEntries(await Promise.all(['awards','earning','status','partners'].map(async k=>[k,JSON.parse(await readFile(`dist/data/${k}.json`,'utf8'))])));
for(const json of Object.values(datasets))assert.match(json.verifiedAt,/^\d{4}-\d{2}-\d{2}$/);
const history=JSON.parse(await readFile('dist/data/reviews.json','utf8'));
assert.equal(history.schemaVersion,1);
for(const review of history.reviews)assert.equal(compareReview(projectScopes(datasets),review).schemaVersion,1);
assert(reviewSummary(datasets,history).lastSuccessfulAt,'Current data must have a complete matching source review');
const awards=JSON.parse(await readFile('dist/data/awards.json','utf8'));assert.equal(awards.regions.length,12);assert.equal(new Set(awards.regions.map(r=>r.id)).size,12);
for(const r of awards.regions){for(const k of ['promoEconomy','promoBusiness','standardEconomy','standardBusiness'])assert(Number.isInteger(r[k])&&r[k]>0);assert(r.countries.length);}
const partners=JSON.parse(await readFile('dist/data/partners.json','utf8'));
assert.deepEqual(partners.carriers.map(c=>c.carrier),['LH','UA']);
for(const c of partners.carriers){
  assert.equal(new URL(c.sourceUrl).hostname,'www.turkishairlines.com');
  assert.equal(c.planningEligibleFlights,0);
  const classes=c.rules.flatMap(r=>r.bookingClasses).concat(c.excludedClasses);
  assert.equal(classes.length,new Set(classes).size);
  for(const r of c.rules){assert(r.rate>0);assert(r.minimumMiles===null||Number.isInteger(r.minimumMiles)&&r.minimumMiles>0);}
}
console.log('JavaScript syntax, local assets, 12 award regions and both partner earning tables verified.');

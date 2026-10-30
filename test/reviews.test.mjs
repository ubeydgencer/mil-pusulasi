import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {projectScopes,compareReview,reviewSummary,normalizeValue} from '../dist/lib/reviews.js';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const data=Object.fromEntries(await Promise.all(['awards','earning','status','partners'].map(async k=>[k,await read(`../dist/data/${k}.json`)])));
const observation=await read('../docs/reviews/2026-10-30-observations.json');
const fixtures=await read('./fixtures/review-cases.json');
const scopes=projectScopes(data);
const source=(review,id)=>review.sources.find(s=>s.id===id);
const copy=()=>structuredClone(observation);
test('manual official observations cover seven scopes and 198 fields without network access',()=>{
  const report=compareReview(scopes,observation);
  assert.equal(report.result,'unchanged');
  assert.equal(report.sources.length,7);
  assert.equal(report.sources.reduce((n,s)=>n+s.comparedFields,0),198);
});
test('localized integer grouping, percentages and class order normalize without losing precision',()=>{
  for(const v of ['1,250','1.250','1250',1250])assert.equal(normalizeValue(v,'integer'),1250);
  assert.equal(normalizeValue('135%','rate'),1.35);
  assert.equal(normalizeValue('12,5%','rate'),0.125);
  const review=copy();source(review,'LH').fields.find(f=>f.key==='row0.classes').value=['F','A'];
  assert.equal(compareReview(scopes,review).result,'unchanged');
  for(const v of ['1,25','1.2.3','NaN',-1])assert.throws(()=>normalizeValue(v,'integer'));
});
test('one changed rate reports its exact field and retains the prior successful review',()=>{
  const review=copy(),f=fixtures.changed;review.checkedAt='2026-10-31';
  Object.assign(source(review,f.id).fields.find(v=>v.key===f.field),{value:f.value,unit:f.unit});
  const report=compareReview(scopes,review);
  assert.equal(report.result,'changed');
  assert.deepEqual(report.sources.find(s=>s.id==='LH').differences,[{field:'row0.rate',expected:{unit:'rate',value:2},observed:{unit:'rate',value:2.01}}]);
  assert.equal(reviewSummary(data,{reviews:[observation,review]}).lastSuccessfulAt,'2026-10-30');
});
test('unreadable source is unavailable and cannot advance successful review date',()=>{
  const review=copy();review.checkedAt='2026-10-31';Object.assign(source(review,'UA'),fixtures.unavailable);
  const summary=reviewSummary(data,{reviews:[review,observation]});
  assert.equal(summary.latest.result,'unavailable');
  assert.equal(summary.lastSuccessfulAt,'2026-10-30');
  assert.equal(reviewSummary(data,{reviews:[review]}).lastSuccessfulAt,null);
});
test('missing or malformed fields and an unexpected source URL fail closed',()=>{
  for(const mutate of [r=>r.sources.pop(),r=>source(r,'status').fields.pop(),r=>source(r,'TK').fields[0].value='not a class',r=>source(r,'LH').url='https://example.com/',r=>source(r,'UA').fields.push({...source(r,'UA').fields[0]})]){
    const r=copy();mutate(r);assert.equal(compareReview(scopes,r).result,'unavailable');
  }
  const r=copy();r.checkedAt='2026-02-30';assert.throws(()=>compareReview(scopes,r));
});
test('unpublished UA minimum remains null and never silently turns into zero',()=>{
  const r=copy();source(r,'UA').fields.find(f=>f.key==='row0.minimum').value=0;
  assert.equal(compareReview(scopes,r).result,'changed');
});
test('review status is recomputed when project calculation data changes',()=>{
  const changed=structuredClone(data);changed.earning.rules[0].international.classic.rate=1.26;
  const summary=reviewSummary(changed,{reviews:[observation]});
  assert.equal(summary.lastSuccessfulAt,null);assert.equal(summary.latest.result,'changed');
});
test('CLI distinguishes exit statuses, preserves datasets and refuses report overwrite',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'mil-review-test-'));
  const dataPath=new URL('../dist/data/earning.json',import.meta.url),before=await readFile(dataPath);
  try{
    for(const [kind,code] of [['unchanged',0],['changed',1],['unavailable',2]]){
      const r=copy();if(kind==='changed')source(r,'LH').fields.find(f=>f.key==='row0.rate').value='201%';
      if(kind==='unavailable')Object.assign(source(r,'UA'),fixtures.unavailable);
      const input=join(temp,kind+'.json'),output=join(temp,kind+'-report.json');await writeFile(input,JSON.stringify(r));
      const args=['scripts/review-rules.mjs','--input',input,'--output',output];
      const result=spawnSync(process.execPath,args,{cwd:new URL('../',import.meta.url),encoding:'utf8'});
      assert.equal(result.status,code,result.stderr);assert.equal(JSON.parse(await readFile(output)).result,kind);
      const saved=await readFile(output);assert.equal(spawnSync(process.execPath,args,{cwd:new URL('../',import.meta.url)}).status,2);assert.deepEqual(await readFile(output),saved);
    }
    assert.deepEqual(await readFile(dataPath),before);
  }finally{await rm(temp,{recursive:true,force:true});}
});

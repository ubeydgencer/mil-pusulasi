import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {calculateItinerary,itineraryRecords,restoreSegments} from '../dist/lib/itinerary.js';
import {rollingTotals} from '../dist/lib/miles.js';
const load=async k=>JSON.parse(await readFile(new URL('../dist/data/'+k+'.json',import.meta.url)));
const tk=await load('earning'), partners=await load('partners');
const tables=id=>id==='TK'?tk:partners.carriers.find(x=>x.carrier===id);
const today='2026-11-05';
const leg=(id,overrides={})=>({id,label:'Flight '+id,date:'2026-11-10',operator:'TK',bookingClass:'K',routeType:'international',tier:'elite',ticketType:'paid',distance:6855,...overrides});
const trip=()=>[
 leg('out'),
 leg('lh',{operator:'LH',bookingClass:'A',distance:100,date:'2026-11-12'}),
 leg('ua',{operator:'UA',bookingClass:'J',distance:100,date:'2026-11-14'}),
 leg('return',{bookingClass:'Y',date:'2026-11-20'}),
 leg('award',{bookingClass:'X',ticketType:'award',distance:'',date:'2026-11-21'})
];
test('TK/LH/UA, farklı dönüş sınıfı ve ödül ayrı hesaplanır; sayaçlar toplanmaz',()=>{
 const estimate=calculateItinerary(trip(),tables);
 assert.deepEqual(estimate.rows.map(r=>r.result.miles),[10968,1600,150,8568,0]);
 assert.equal(estimate.statusMiles,21286);assert.equal(estimate.redeemableMiles,21286);
 assert.deepEqual(estimate.rows.map(r=>r.flights),[1,0,0,1,0]);
});
test('tarihli plan etapları eski kayda dokunmaz; projeksiyon yalnız o güne kadar olanları sayar',()=>{
 const legs=trip(), estimate=calculateItinerary(legs,tables);
 const old={id:'old',label:'Existing',date:'2026-10-10',statusMiles:500,flights:1,state:'credited'};
 const newRecords=itineraryRecords(legs,tables,{today,fingerprint:estimate.fingerprint,existing:[old]});
 const records=[old,...newRecords];
 assert.equal(newRecords.length,4);assert.deepEqual(newRecords.map(r=>r.date),['2026-11-10','2026-11-12','2026-11-14','2026-11-20']);
 assert.equal(rollingTotals(records,'2026-11-14',false).miles,500);
 assert.equal(rollingTotals(records,'2026-11-14',true).miles,13218);
 assert.equal(rollingTotals(records,'2026-11-14',true).flights,2);
 assert.equal(rollingTotals(records,'2026-11-21',true).miles,21786);
 assert.deepEqual(old,{id:'old',label:'Existing',date:'2026-10-10',statusMiles:500,flights:1,state:'credited'});
});
test('tarih, sınıf, TPM, ekleme veya silme eski hesabın aktarımını engeller',()=>{
 const original=trip(), fingerprint=calculateItinerary(original,tables).fingerprint;
 for(const changed of [[leg('out',{date:'2026-11-11'}),...original.slice(1)],[leg('out',{bookingClass:'Y'}),...original.slice(1)],[leg('out',{distance:7000}),...original.slice(1)],original.slice(1),[...original,leg('extra')]])assert.throws(()=>itineraryRecords(changed,tables,{today,fingerprint,existing:[]}),/recalculate/);
});
test('geçmiş tarih, yinelenen kayıt ve yalnız ödül biletinin aktarımı reddedilir',()=>{
 const legs=trip(), fingerprint=calculateItinerary(legs,tables).fingerprint;
 assert.throws(()=>itineraryRecords(legs,tables,{today:'2026-11-11',fingerprint,existing:[]}),/past_plan/);
 assert.throws(()=>itineraryRecords(legs,tables,{today,fingerprint,existing:[{id:'out'}]}),/already_planned/);
 const zero=[legs.at(-1)];
 assert.throws(()=>itineraryRecords(zero,tables,{today,fingerprint:calculateItinerary(zero,tables).fingerprint,existing:[]}),/no_earning_segments/);
});
test('mesafe gereken etap eksik TPM ile hesaplanmaz; iç hat sabiti mesafesiz çalışır',()=>{
 assert.throws(()=>calculateItinerary([leg('a'),leg('b',{operator:'UA',bookingClass:'J',distance:''})],tables),e=>e.message==='invalid_number'&&e.segment===2);
 assert.equal(calculateItinerary([leg('dom',{routeType:'domestic',distance:''})],tables).statusMiles,1000);
});
test('eksik alanlı taslak korunur, tekrarlanan veya desteklenmeyen taslak seçime sızmaz',()=>{
 const draft=leg('draft',{date:'',distance:'',bookingClass:''});
 assert.equal(restoreSegments().length,0);
 const restored=restoreSegments([draft,draft,leg('bad',{operator:'OTHER'})]);
 assert.deepEqual(restored,[draft]);
 assert.throws(()=>calculateItinerary(restored,tables),/invalid_date/);
});

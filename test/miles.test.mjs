import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {awardCost,compareMiles,calculateEarn,rollingTotals,promotionProgress,renewalProgress,expiringRecords,parseDate,addMonths} from '../dist/lib/miles.js';
const load=async name=>JSON.parse(await readFile(new URL(`../dist/data/${name}.json`,import.meta.url),'utf8'));
const awards=await load('awards'),earning=await load('earning'),status=await load('status');
const partners=await load('partners');
const lh=partners.carriers.find(c=>c.carrier==='LH'),ua=partners.carriers.find(c=>c.carrier==='UA');
const record=(date,miles,state='credited',flights=1)=>({id:date,date,statusMiles:miles,state,flights});
test('official THY award prices include passengers and two directions',()=>{
  const europe=awards.regions.find(r=>r.id==='avrupa-2');
  assert.equal(awardCost(europe,{cabin:'business',type:'promo',passengers:2,directions:2}),100000);
  assert.equal(awardCost(europe,{cabin:'economy',type:'standard'}),20000);
  assert.throws(()=>awardCost(europe,{passengers:0}));
});
test('cash comparison subtracts all cash award charges and keeps negative results',()=>{
  assert.equal(compareMiles({cashPrice:12000,awardCash:2000,miles:20000}).valuePerMile,.5);
  assert.equal(compareMiles({cashPrice:1000,awardCash:2000,miles:20000}).savings,-1000);
  for(const miles of [0,-1,NaN,Infinity,1.5,''])assert.throws(()=>compareMiles({cashPrice:1000,awardCash:0,miles}));
});
test('official Elite IST-LAX K example, minimum and domestic fixed accrual',()=>{
  assert.equal(calculateEarn(earning,{bookingClass:'K',tier:'elite',distance:6855}).miles,10968);
  assert.equal(calculateEarn(earning,{bookingClass:'K',tier:'classic',distance:6855}).rawMiles,9254.25);
  assert.equal(calculateEarn(earning,{bookingClass:'C',tier:'elite',distance:100}).miles,1750);
  assert.equal(calculateEarn(earning,{bookingClass:'K',tier:'elite',routeType:'domestic'}).miles,1000);
  assert.equal(calculateEarn(earning,{bookingClass:'W',routeType:'domestic'}).miles,150);
});
test('award tickets do not earn and unsupported carrier/class are rejected',()=>{
  assert.equal(calculateEarn(earning,{ticketType:'award'}).eligibleFlights,0);
  assert.throws(()=>calculateEarn(earning,{operator:'LH',bookingClass:'K',distance:6855}));
  assert.throws(()=>calculateEarn(earning,{bookingClass:'X',distance:6855}));
});
test('Lufthansa applies its own rate, minimum and excluded classes',()=>{
  assert.equal(calculateEarn(lh,{bookingClass:'Z',distance:1000}).miles,1350);
  assert.equal(calculateEarn(lh,{bookingClass:'T',distance:400}).miles,200);
  assert.equal(calculateEarn(lh,{bookingClass:'A',distance:400}).miles,1600);
  const zero=calculateEarn(lh,{bookingClass:'P'});
  assert.equal(zero.miles,0);assert.equal(zero.reason,'excluded_class');
  assert.throws(()=>calculateEarn(lh,{bookingClass:'?',distance:1000}),/unsupported_class/);
});
test('United uses published distance rates without borrowing a THY minimum',()=>{
  assert.equal(calculateEarn(ua,{bookingClass:'J',distance:1000}).miles,1500);
  assert.equal(calculateEarn(ua,{bookingClass:'Q',distance:800}).miles,600);
  const short=calculateEarn(ua,{bookingClass:'K',distance:100});
  assert.equal(short.miles,50);assert.equal(short.minimumMiles,null);
  assert.equal(calculateEarn(ua,{bookingClass:'O',distance:800}).cabin,'premiumEconomy');
  assert.equal(calculateEarn(ua,{bookingClass:'X'}).miles,0);
});
test('partner earnings reject THY-only rules and do not add its tier bonus',()=>{
  for(const table of [lh,ua]){
    assert.equal(calculateEarn(table,{bookingClass:'C',tier:'elitePlus',distance:2000}).miles,3000);
    assert.throws(()=>calculateEarn(table,{bookingClass:'C',routeType:'domestic',distance:2000}),/unsupported_earning/);
    assert.throws(()=>calculateEarn(table,{bookingClass:'C',ticketType:'cashMiles',distance:2000}),/unsupported_earning/);
    assert.throws(()=>calculateEarn(table,{bookingClass:'C',ticketType:'charter',distance:2000}),/unsupported_earning/);
    assert.equal(calculateEarn(table,{ticketType:'award'}).miles,0);
    assert.throws(()=>calculateEarn(table,{operator:'TK',bookingClass:'C',distance:2000}),/unsupported_carrier/);
  }
});
test('partner plans do not automatically satisfy Classic Plus flight-count qualification',()=>{
  const earned=calculateEarn(lh,{bookingClass:'T',distance:400});
  assert.equal(earned.eligibleFlights,0);
  const records=Array.from({length:40},()=>record('2026-11-01',earned.miles,'planned',earned.eligibleFlights));
  const progress=promotionProgress(status,records,{target:'classicPlus',asOf:'2026-12-01',forecast:true});
  assert.equal(progress.totals.miles,8000);assert.equal(progress.totals.flights,0);assert.equal(progress.achieved,false);
});
test('a future status forecast ages historical records instead of adding to today',()=>{
  const records=[record('2025-10-08',5000),record('2025-10-10',12000),record('2026-10-01',16000),record('2027-02-01',15000,'planned')];
  assert.equal(rollingTotals(records,'2026-10-09').miles,28000);
  assert.equal(rollingTotals(records,'2027-02-01',true).miles,31000);
  assert.equal(promotionProgress(status,records,{target:'elite',asOf:'2027-02-01',forecast:true}).achieved,false);
});
test('planned, cancelled, future and uncredited flights are excluded from actual totals',()=>{
  const records=[record('2026-10-01',1000),record('2026-10-02',5000,'planned'),record('2026-10-03',5000,'cancelled'),record('2026-10-04',5000,'completed_uncredited'),record('2027-01-01',5000)];
  assert.equal(rollingTotals(records,'2026-10-09').miles,1000);
});
test('Classic Plus qualification supports the confirmed flight-count alternative',()=>{
  const p=promotionProgress(status,[record('2026-10-01',0,'credited',40)],{target:'classicPlus',asOf:'2026-10-09'});
  assert.equal(p.achieved,true);assert.equal(p.remainingFlights,0);
});
test('renewal includes both years and freezes the first-year result',()=>{
  const records=[record('2025-05-01',28000),record('2026-04-01',18000)];
  const options={tier:'elite',residence:'Turkey',start:'2025-04-01',firstEnd:'2026-03-31',end:'2027-03-31',asOf:'2026-10-09'};
  const r=renewalProgress(status,records,options);
  assert.equal(r.first.totals.miles,28000);assert.equal(r.first.achieved,false);
  assert.equal(r.second.totals.miles,46000);assert.equal(r.achieved,true);
  const abroad=renewalProgress(status,records,{...options,residence:'abroad'});assert.equal(abroad.first.achieved,true);
});
test('forecast cannot revive a missed first-year renewal condition',()=>{
  const records=[record('2025-05-01',28000),record('2026-11-01',10000,'planned')];
  const r=renewalProgress(status,records,{tier:'elite',residence:'Turkey',start:'2025-04-01',firstEnd:'2026-03-31',end:'2027-03-31',asOf:'2026-12-01',forecast:true});
  assert.equal(r.first.totals.miles,28000);assert.equal(r.first.achieved,false);assert.equal(r.second.totals.miles,38000);
});
test('rolling anniversary exclusion and leap-day expiry match the counter',()=>{
  assert.equal(rollingTotals([record('2025-10-09',1000)],'2026-10-09').miles,0);
  const records=[record('2024-02-29',1000)];
  assert.equal(rollingTotals(records,'2025-02-28').miles,1000);
  assert.equal(expiringRecords(records,'2025-02-27','2025-03-02')[0].expiryDate,'2025-03-01');
  assert.equal(rollingTotals(records,'2025-03-01').miles,0);
});
test('invalid dates and impossible period order fail explicitly',()=>{
  assert.throws(()=>parseDate('2025-02-29'));assert.throws(()=>parseDate('2026-13-01'));
  assert.equal(addMonths('2024-02-29',12),'2025-02-28');
  assert.throws(()=>renewalProgress(status,[],{tier:'elite',residence:'Turkey',start:'2026-01-01',firstEnd:'2028-01-01',end:'2027-01-01',asOf:'2026-10-09'}));
});

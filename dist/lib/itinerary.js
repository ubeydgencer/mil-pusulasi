import {calculateEarn,parseDate} from './miles.js';

export const MAX_SEGMENTS=12;
export const segmentFields=['label','date','operator','bookingClass','tier','routeType','ticketType','distance'];
export function restoreSegments(stored){
 if(!Array.isArray(stored))return [];
 const ids=new Set();
 return stored.slice(0,MAX_SEGMENTS).flatMap(entry=>{
  if(!entry||typeof entry.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(entry.id)||ids.has(entry.id))return [];
  ids.add(entry.id);
  const draft={id:entry.id,...Object.fromEntries(segmentFields.map(key=>[key,['string','number'].includes(typeof entry[key])?String(entry[key]).slice(0,80):'']))};
  if(!['TK','LH','UA'].includes(draft.operator))return [];
  const choice=(key,values,fallback)=>{if(!values.includes(draft[key]))draft[key]=fallback;};
  choice('tier',['classic','classicPlus','elite','elitePlus'],'classic');
  choice('routeType',draft.operator==='TK'?['domestic','international']:['international'],'international');
  choice('ticketType',draft.operator==='TK'?['paid','award','charter','cashMiles']:['paid','award'],'paid');
  return [draft];
 });
}
export function calculateItinerary(segments,tableFor){
 if(!Array.isArray(segments)||!segments.length||segments.length>MAX_SEGMENTS)throw Error('invalid_segments');
 const ids=new Set();
 const rows=segments.map((segment,index)=>{
  try{
   const {id,date,operator,tier,routeType,ticketType,distance}=segment;
   if(typeof id!=='string'||!id||ids.has(id))throw Error('invalid_segments');
   ids.add(id);
   parseDate(date);
   const label=String(segment.label??'').trim(),bookingClass=String(segment.bookingClass??'').trim().toUpperCase();
   if(!label||label.length>80)throw Error('invalid_segment_label');
   if(!/^[A-Z]$/.test(bookingClass))throw Error('unsupported_class');
   const input={id,label,date,operator,bookingClass,tier,routeType,ticketType,distance};
   const result=calculateEarn(tableFor(operator),input);
   return {input,result,flights:operator==='TK'?result.eligibleFlights:0};
  }catch(error){error.segment=index+1;throw error;}
 });
 // One flight earning can appear in two counters, but is never added to itself.
 const miles=rows.reduce((sum,row)=>sum+row.result.miles,0);
 return {rows,statusMiles:miles,redeemableMiles:miles,fingerprint:JSON.stringify(rows)};
}
export function itineraryRecords(segments,tableFor,{fingerprint,today,existing}){
 const result=calculateItinerary(segments,tableFor);
 if(result.fingerprint!==fingerprint)throw Error('recalculate');
 parseDate(today);
 if(result.rows.some(({input})=>input.date<today))throw Error('past_plan');
 const ids=new Set(existing.map(r=>r.id));
 const records=result.rows.filter(({result})=>result.miles>0).map(({input,result,flights})=>{
  if(ids.has(input.id))throw Error('already_planned');
  const {id,label,date,operator,bookingClass}=input;
  return {id,label,date,operator,bookingClass,statusMiles:result.miles,flights,state:'planned'};
 });
 if(!records.length)throw Error('no_earning_segments');
 return records;
}

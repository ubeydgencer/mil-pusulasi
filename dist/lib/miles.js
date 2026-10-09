// Pure planning calculations. No account access and no booking side effects.
export function number(value, { min = 0, max = 1e9, integer = false } = {}) {
  if (value === '' || value === null || value === undefined || typeof value === 'boolean') throw new Error('invalid_number');
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) throw new Error('invalid_number');
  return n;
}

export function awardCost(region, { cabin = 'economy', type = 'promo', passengers = 1, directions = 1 } = {}) {
  if (!['economy','business'].includes(cabin) || !['promo','standard'].includes(type)) throw new Error('invalid_award');
  const p = number(passengers, { min:1, max:9, integer:true });
  const d = number(directions, { min:1, max:2, integer:true });
  const key = type + (cabin === 'business' ? 'Business' : 'Economy');
  return number(region?.[key], { min:1, integer:true }) * p * d;
}

export function compareMiles({ cashPrice, awardCash, miles }) {
  const cash = number(cashPrice, {min:0.01});
  const fees = number(awardCash);
  const used = number(miles, {min:1, integer:true});
  const savings = cash - fees;
  return { cashPrice:cash, awardCash:fees, miles:used, savings, valuePerMile:savings / used, percentSavings:savings / cash * 100 };
}

export function calculateEarn(data, { bookingClass, tier = 'classic', routeType = 'international', distance, ticketType = 'paid', operator = data?.carrier || 'TK' }) {
  if (!data || operator !== data.carrier || !['TK','LH','UA'].includes(operator)) throw new Error('unsupported_carrier');
  if (!['classic','classicPlus','elite','elitePlus'].includes(tier)) throw new Error('invalid_tier');
  if (!['domestic','international'].includes(routeType) || !['paid','award','charter','cashMiles'].includes(ticketType)) throw new Error('invalid_earning');
  if (operator !== 'TK' && (routeType !== 'international' || !['paid','award'].includes(ticketType))) throw new Error('unsupported_earning');
  const zero=reason=>({miles:0,rawMiles:0,rate:0,minimumMiles:null,fixed:false,cabin:null,eligibleFlights:0,operator,reason});
  if (ticketType === 'award' || ticketType === 'charter') return zero(ticketType);
  const code = String(bookingClass).trim().toUpperCase();
  if (data.excludedClasses?.includes(code)) return zero('excluded_class');
  const rule = data.rules.find(r => r.bookingClasses.includes(code));
  if (!rule) throw new Error('unsupported_class');
  if (data.calculationMethod === 'distanceRate') {
    const tpm=number(distance,{min:1,max:20000});
    const rawMiles=rule.minimumMiles===null?tpm*rule.rate:Math.max(tpm*rule.rate,rule.minimumMiles);
    return {miles:Math.floor(rawMiles),rawMiles,rate:rule.rate,minimumMiles:rule.minimumMiles,distance:tpm,fixed:false,cabin:rule.cabin,eligibleFlights:data.planningEligibleFlights,operator};
  }
  if (routeType === 'domestic') return { miles:rule.domestic.allTiers.fixedMiles, rawMiles:rule.domestic.allTiers.fixedMiles, rate:null, minimumMiles:null, fixed:true, cabin:rule.cabin, eligibleFlights:1 };
  const tpm = number(distance, {min:1, max:20000});
  const {rate, minimumMiles} = rule.international[tier];
  const rawMiles = Math.max(tpm * rate, minimumMiles);
  return { miles:Math.floor(rawMiles), rawMiles, rate, minimumMiles, distance:tpm, fixed:false, cabin:rule.cabin, eligibleFlights:1 };
}

export function parseDate(iso) {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error('invalid_date');
  const date = new Date(iso + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== iso) throw new Error('invalid_date');
  return date;
}
export const dateString = d => d.toISOString().slice(0,10);
export function addMonths(iso, months) {
  const d = parseDate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day,last));
  return dateString(d);
}
export function addDays(iso, days) {
  const d = parseDate(iso); d.setUTCDate(d.getUTCDate()+days); return dateString(d);
}
export function eligibleRecords(records, asOf, forecast = false) {
  parseDate(asOf);
  return records.filter(r => {
    parseDate(r.date);
    return r.date <= asOf && (r.state === 'credited' || (forecast && r.state === 'planned'));
  });
}
export function sumRecords(records) {
  return records.reduce((sum,r) => ({ miles:sum.miles + number(r.statusMiles, {integer:true}), flights:sum.flights + number(r.flights, {max:1000, integer:true}) }), {miles:0,flights:0});
}
export function rollingTotals(records, asOf, forecast = false) {
  const cutoff = addMonths(asOf,-12);
  const active = eligibleRecords(records,asOf,forecast).filter(r => r.date > cutoff);
  return { ...sumRecords(active), startExclusive:cutoff, endInclusive:asOf, records:active };
}
export function requirementProgress(totals, requirement) {
  const remainingMiles = Math.max(0,requirement.miles-totals.miles);
  const remainingFlights = requirement.flights ? Math.max(0,requirement.flights-totals.flights) : null;
  return { remainingMiles, remainingFlights, achieved:remainingMiles === 0 || remainingFlights === 0, percent:Math.min(100,Math.max(totals.miles/requirement.miles,requirement.flights ? totals.flights/requirement.flights : 0)*100) };
}
export function promotionProgress(data, records, {target,asOf,forecast=false}) {
  const tier=data.tiers.find(t=>t.id===target);
  if (!tier?.promotion) throw new Error('invalid_target');
  const totals=rollingTotals(records,asOf,forecast);
  return { tier:tier.label, totals, requirement:tier.promotion, ...requirementProgress(totals,tier.promotion) };
}
export function renewalProgress(data, records, { tier, residence, start, firstEnd, end, asOf, forecast = false }) {
  [start,firstEnd,end,asOf].forEach(parseDate);
  if (!(start <= firstEnd && firstEnd < end)) throw new Error('invalid_period');
  const rules=data.tiers.find(t=>t.id===tier)?.renewal?.[residence];
  if (!rules) throw new Error('invalid_renewal');
  const active=eligibleRecords(records, asOf < end ? asOf : end,forecast).filter(r=>r.date>=start);
  const firstTotals=sumRecords(active.filter(r=>r.date<=firstEnd));
  const total=sumRecords(active);
  const first={totals:firstTotals,requirement:rules.year1, ...requirementProgress(firstTotals,rules.year1), deadline:firstEnd,closed:asOf>firstEnd};
  const second={totals:total,requirement:rules.year2,...requirementProgress(total,rules.year2),deadline:end,closed:asOf>end};
  return {first,second,achieved:first.achieved || second.achieved,expired:asOf>end};
}
export function expiringRecords(records, asOf, until) {
  parseDate(asOf);parseDate(until);
  if(until<asOf) throw new Error('invalid_forecast');
  // A record falls out on its calendar anniversary under our documented (start, end] convention.
  return rollingTotals(records,asOf).records.map(r=>{
    let expiryDate=addMonths(r.date,12);
    // Forward and backward clamping differ for 29 February; match rollingTotals.
    if(addMonths(expiryDate,-12)<r.date) expiryDate=addDays(expiryDate,1);
    return {...r,expiryDate};
  }).filter(r=>r.expiryDate>asOf && r.expiryDate<=until).sort((a,b)=>a.expiryDate.localeCompare(b.expiryDate));
}
export function targetProgress(balance, required) {
  const b=number(balance,{integer:true});const r=number(required,{min:1,integer:true});
  return { required:r, balance:b, remaining:Math.max(0,r-b), percent:Math.min(100,b/r*100) };
}

// Shared offline comparison. Observations are explicitly reviewed transcriptions,
// never evidence that this module fetched or interpreted an airline web page.
export const scopeIds=['awards','TK','status','LH','UA','statusPurchase','statusConversion'];
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function normalizeValue(value,unit){
  if(unit==='classes'){
    const list=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
    const result=list.map(v=>String(v).trim().toUpperCase()).sort();
    if(!result.length||result.some(v=>!(/^[A-Z]$/).test(v))||new Set(result).size!==result.length)throw Error('Invalid booking classes');
    return result;
  }
  if(unit==='rate'){
    if(typeof value==='string'&&/^\d+(?:[.,]\d+)?%$/.test(value.trim()))value=Number(value.trim().slice(0,-1).replace(',','.'))/100;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw Error('Invalid rate');
    return value;
  }
  if(unit==='integer'){
    if(typeof value==='string'){
      const s=value.trim();
      if(!/^(?:\d+|\d{1,3}(?:,\d{3})+|\d{1,3}(?:\.\d{3})+)$/.test(s))throw Error('Invalid integer grouping');
      value=Number(s.replace(/[.,]/g,''));
    }
    if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid integer');
    return value;
  }
  if(unit==='nullableInteger')return value===null?null:normalizeValue(value,'integer');
  throw Error('Unknown field unit');
}
export function projectScopes(data){
  const {awards,earning,status,partners}=data;
  const scopes={};
  const add=(id,url,scope,fields)=>{scopes[id]={id,url,scope,fields};};
  const field=(key,value,unit='integer')=>({key,value,unit});
  add('awards',awards.sourceUrl,'12 Türkiye bağlantılı tek yön bölgesinin dört ödül fiyatı; ülke listeleri ve genel koşul metni kapsam dışı.',awards.regions.flatMap(r=>['promoEconomy','promoBusiness','standardEconomy','standardBusiness'].map(k=>field(`${r.id}.${k}`,r[k]))));
  add('TK',earning.sourceUrl,'THY rezervasyon sınıfları, iç hat sabitleri ve kart bazında dış hat oran/minimumları.',earning.rules.flatMap(r=>[
    field(`${r.id}.classes`,r.bookingClasses,'classes'),field(`${r.id}.domestic`,r.domestic.allTiers.fixedMiles),
    ...Object.entries(r.international).flatMap(([tier,v])=>[field(`${r.id}.${tier}.rate`,v.rate,'rate'),field(`${r.id}.${tier}.minimum`,v.minimumMiles)])]));
  add('status',status.sources.status.url,'Classic Plus/Elite/Elite Plus yükseltme ve Türkiye/yurt dışı ilk yıl/tüm iki yıl koruma eşikleri; dönem sınır günü yorumu kapsam dışı.',status.tiers.filter(t=>t.promotion).flatMap(t=>[
    field(`${t.id}.promotion.miles`,t.promotion.miles),field(`${t.id}.promotion.flights`,t.promotion.flights,'nullableInteger'),
    ...['Turkey','abroad'].flatMap(place=>['year1','year2'].flatMap(period=>['miles','flights'].map(k=>field(`${t.id}.${place}.${period}.${k}`,t.renewal[place][period][k],'nullableInteger'))))]));
  for(const c of partners.carriers)add(c.carrier,c.sourceUrl,`${c.carrier} sınıfları, oranları, yayımlanan minimumlar ve kazanım dışı sınıflar. UA null minimum, yayımlanmamış demektir; sıfır varsayılmaz.`,[
    field('excludedClasses',c.excludedClasses,'classes'),...c.rules.flatMap((r,i)=>[field(`row${i}.classes`,r.bookingClasses,'classes'),field(`row${i}.rate`,r.rate,'rate'),field(`row${i}.minimum`,r.minimumMiles,'nullableInteger')])]);
  const p=status.statusPurchase;
  add('statusPurchase',status.sources.statusPurchase.url,'Satın alma blok tutarı/fiyatı, 12 aylık ek limit ve statü başına eksik mil sınırları; hesap uygunluğu kapsam dışı.',[
    ...['blockMiles','pricePerBlockUSD','publishedAdditional12MonthLimit'].map(k=>field(k,p[k])),
    ...Object.entries(p.maxShortfallByCurrentTier).flatMap(([tier,v])=>Object.entries(v).map(([k,n])=>field(`${tier}.${k}`,n,'nullableInteger')))]);
  add('statusConversion',status.sources.statusConversion.url,'Dönüştürme oranı ve 12 aylık üst sınır; kart/hesap uygunluğu kapsam dışı.',['spendableMilesDebitedPerStatusMile','maxStatusMilesInPrevious12Months'].map(k=>field(k,status.statusConversion[k])));
  if(scopeIds.some(id=>!scopes[id])||Object.keys(scopes).length!==scopeIds.length)throw Error('Unsupported scope set');
  return scopes;
}
function fieldsMap(fields){
  if(!Array.isArray(fields)||!fields.length||fields.length>1000)throw Error('Missing or oversized fields');
  const map=new Map();
  for(const f of fields){
    if(typeof f.key!=='string'||!f.key||map.has(f.key))throw Error('Duplicate or invalid field key');
    map.set(f.key,{unit:f.unit,value:normalizeValue(f.value,f.unit)});
  }
  return map;
}
export function compareReview(scopes,review){
  if(review.schemaVersion!==1||!date(review.checkedAt)||!review.reviewer?.trim()||!Array.isArray(review.sources))throw Error('Invalid review metadata');
  const observed=new Map();
  for(const source of review.sources){if(!scopeIds.includes(source.id)||observed.has(source.id))throw Error('Unknown or duplicate source');observed.set(source.id,source);}
  const results=scopeIds.map(id=>{
    const expected=scopes[id],source=observed.get(id);
    const result={id,url:expected.url,scope:expected.scope,checkedAt:review.checkedAt,result:'unavailable',differences:[]};
    if(!source||source.url!==expected.url||source.status!=='available'||source.method!=='manual-transcription'||!source.locator?.trim())return {...result,reason:source?.reason||'Missing source, URL, evidence locator or readable fields'};
    try{
      const a=fieldsMap(expected.fields),b=fieldsMap(source.fields);
      for(const key of [...new Set([...a.keys(),...b.keys()])].sort()){
        if(JSON.stringify(a.get(key))!==JSON.stringify(b.get(key)))result.differences.push({field:key,expected:a.get(key)??null,observed:b.get(key)??null});
      }
      // An absent field is incomplete coverage, not evidence of a removed rule.
      if([...a.keys()].some(key=>!b.has(key)))return {...result,reason:'Incomplete source field coverage'};
      return {...result,result:result.differences.length?'changed':'unchanged',comparedFields:a.size};
    }catch(error){return {...result,reason:error.message};}
  });
  return {schemaVersion:1,checkedAt:review.checkedAt,reviewer:review.reviewer,
    result:results.some(r=>r.result==='unavailable')?'unavailable':results.some(r=>r.result==='changed')?'changed':'unchanged',sources:results};
}
export function reviewSummary(data,history){
  const scopes=projectScopes(data);
  const records=history.reviews.map(r=>compareReview(scopes,r)).sort((a,b)=>a.checkedAt.localeCompare(b.checkedAt));
  const successful=records.filter(r=>r.result==='unchanged');
  return {dataDates:[...new Set(['awards','earning','status','partners'].map(k=>data[k].verifiedAt))].sort(),
    lastSuccessfulAt:successful.at(-1)?.checkedAt??null,latest:records.at(-1)??null};
}

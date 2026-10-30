import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {compareReview,projectScopes} from '../dist/lib/reviews.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
try{
  if(args.length!==4||args[0]!=='--input'||args[2]!=='--output')throw Error('Usage: npm run review:rules -- --input observations.json --output new-report.json');
  const data=Object.fromEntries(await Promise.all(['awards','earning','status','partners'].map(async k=>[k,JSON.parse(await readFile(resolve(root,`dist/data/${k}.json`),'utf8'))])));
  const report=compareReview(projectScopes(data),JSON.parse(await readFile(args[1],'utf8')));
  // Exclusive creation: never overwrite an earlier report or verified dataset.
  await writeFile(args[3],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  console.log(`${report.checkedAt}: ${report.result}`);
  for(const s of report.sources){console.log(`${s.id}: ${s.result}${s.reason?' — '+s.reason:''}`);for(const d of s.differences)console.log(`  ${d.field}: ${JSON.stringify(d.expected)} -> ${JSON.stringify(d.observed)}`);}
  process.exitCode=report.result==='unchanged'?0:report.result==='changed'?1:2;
}catch(error){console.error(error.message);process.exitCode=2;}

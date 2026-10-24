// Startup order: code that runs while the hub boots (the preferences load) must only call
// RemoteCatalog functions defined earlier in message.txt. A later definition is nil at that point
// and crashes the whole hub before any UI exists.
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../message.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
const lines=source.split('\n');
const defined=new Map();
lines.forEach((line,index)=>{
  const m=line.match(/^\s*function RemoteCatalog\.(\w+)\s*\(/)||line.match(/^\s*RemoteCatalog\.(\w+)\s*=\s*function/)||line.match(/^\s*function catalog\.(\w+)\s*\(/);
  if(m&&!defined.has(m[1])) defined.set(m[1],index+1);
});
const start=lines.findIndex(l=>l.startsWith('local function loadPreferences('));
const end=lines.findIndex((l,i)=>i>start&&l.startsWith('local preferencesLoaded'));
if(start<0||end<0) throw new Error('loadPreferences block not found');
const problems=[];
for(let i=start;i<=end;i++){
  for(const m of lines[i].matchAll(/RemoteCatalog\.(\w+)\s*\(/g)){
    const at=defined.get(m[1]);
    if(at===undefined) problems.push(`${m[1]} (line ${i+1}) is never defined as a function`);
    else if(at>end) problems.push(`${m[1]} (line ${i+1}) is defined later, at line ${at}`);
  }
}
if(problems.length) throw new Error('Startup calls functions that do not exist yet:\n'+problems.join('\n'));
// The startup preference load must be protected: a damaged settings file may not keep the hub from opening.
if(!/pcall\(loadPreferences\)/.test(source)) throw new Error('The startup loadPreferences() call is not wrapped in pcall');
console.log(['Startup order: the preferences load only calls RemoteCatalog functions defined before it'] );

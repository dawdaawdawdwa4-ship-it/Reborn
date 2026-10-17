import fs from 'node:fs';
const hub=new URL('../message.txt',import.meta.url);
const recorder=fs.readFileSync(new URL('../tools/CaptureRemotes.lua',import.meta.url),'utf8').replaceAll('\r\n','\n').trimEnd();
const start='-- EMBEDDED CAPTURE BEGIN';
const end='-- EMBEDDED CAPTURE END';
const original=fs.readFileSync(hub,'utf8');
let source=original.replaceAll('\r\n','\n');
const block=start+'\n-- Generated from tools/CaptureRemotes.lua by scripts/embed-capture.mjs.\nfunction RemoteCatalog.StartCapture()\n'+recorder+'\nend\n'+end;
if(source.includes(start)) {
 source=source.slice(0,source.indexOf(start))+block+source.slice(source.indexOf(end)+end.length);
} else {
 const anchor='-- REMOTE CATALOG END';
 source=source.replace(anchor,anchor+'\n\n'+block);
}
const output=source.replaceAll('\n','\r\n');
if(process.argv.includes('--check')) {
 if(output!==original) throw new Error('Embedded recorder is stale; run node scripts/embed-capture.mjs');
 console.log('Embedded recorder matches source');
} else fs.writeFileSync(hub,output);

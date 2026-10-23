// Removes Luau comments while keeping strings, long strings and every newline (so line numbers match).
export function stripLuaComments(source) {
  let out = '', i = 0;
  const n = source.length;
  const longOpen = at => { const m = /^\[(=*)\[/.exec(source.slice(at, at + 64)); return m ? m[1].length : -1; };
  while (i < n) {
    const c = source[i];
    if (c === '-' && source[i + 1] === '-') {
      const level = longOpen(i + 2);
      if (level >= 0) {
        const close = ']' + '='.repeat(level) + ']';
        const end = source.indexOf(close, i + 4 + level);
        const stop = end < 0 ? n : end + close.length;
        out += source.slice(i, stop).replace(/[^\n]/g, '');
        i = stop;
      } else {
        while (i < n && source[i] !== '\n') i++;
      }
      continue;
    }
    if (c === '[') {
      const level = longOpen(i);
      if (level >= 0) {
        const close = ']' + '='.repeat(level) + ']';
        const end = source.indexOf(close, i + 2 + level);
        const stop = end < 0 ? n : end + close.length;
        out += source.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && source[j] !== c && source[j] !== '\n') j += source[j] === '\\' ? 2 : 1;
      out += source.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

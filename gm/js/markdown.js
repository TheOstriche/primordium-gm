// A small Markdown reader for the rules docs: headings, paragraphs, lists,
// tables, code blocks, **bold**, *italics*, and `code`.
(function () {
  const { h } = UI;

  function inline(text) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('**')) out.push(h('strong', t.slice(2, -2)));
      else if (t.startsWith('`')) out.push(h('code', t.slice(1, -1)));
      else out.push(h('em', t.slice(1, -1)));
      last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }

  const cells = line => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

  function render(md) {
    const lines = md.replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }
      if (line.startsWith('```')) {
        const body = [];
        i++;
        while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
        i++;
        out.push(h('pre', h('code', body.join('\n'))));
        continue;
      }
      const head = line.match(/^(#{1,4})\s+(.*)$/);
      if (head) {
        out.push(h('h' + Math.min(4, head[1].length + 1), { id: slug(head[2]) }, inline(head[2])));
        i++;
        continue;
      }
      if (line.trim().startsWith('|') && lines[i + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        const header = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
        out.push(h('div.table-wrap', h('table',
          h('thead', h('tr', header.map(c => h('th', inline(c))))),
          h('tbody', rows.map(r => h('tr', r.map(c => h('td', inline(c)))))))));
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line);
        const items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          items.push(h('li', inline(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''))));
          i++;
        }
        out.push(h(ordered ? 'ol' : 'ul', items));
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#|```|\s*\||\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      out.push(h('p', inline(para.join(' '))));
    }
    return out;
  }

  function headings(md) {
    return md.replace(/\r/g, '').split('\n')
      .map(l => l.match(/^(#{2,3})\s+(.*)$/))
      .filter(Boolean)
      .map(m => ({ level: m[1].length, text: m[2].replace(/\*\*/g, ''), id: slug(m[2]) }));
  }

  const slug = t => 'md-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  window.Markdown = { render, headings };
})();

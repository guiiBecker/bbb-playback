// The shared notes as Markdown, from Etherpad's HTML export (notes.html):
// lines separated by <br>, <strong>/<b>, <em>/<i>, <s>/<del>, <u>, <code>,
// links, <h1>-<h6>, and lists as <ul class="bullet"> / <ol class="number">,
// nested for indentation. What Markdown has no syntax for (underline,
// colours) keeps its text

// Characters Markdown would read as formatting in plain text
const escape = (text) => text.replace(/([\\`*_[\]#])/g, '\\$1');

const wrap = (marker, content) => {
  const text = content.trim();
  if (!text) return content;

  // The marker hugs the text; the spaces around it stay outside
  const before = content.match(/^\s*/)[0];
  const after = content.match(/\s*$/)[0];

  return `${before}${marker}${text}${marker}${after}`;
};

const INLINE = {
  b: (content) => wrap('**', content),
  code: (content) => wrap('`', content),
  del: (content) => wrap('~~', content),
  em: (content) => wrap('*', content),
  i: (content) => wrap('*', content),
  s: (content) => wrap('~~', content),
  strike: (content) => wrap('~~', content),
  strong: (content) => wrap('**', content),
};

const convert = (node, depth) => {
  // U+FFFC stands for an embedded object the export left out
  if (node.nodeType === 3) return escape(node.textContent.replace(/\uFFFC/g, '').replace(/\s+/g, ' '));
  if (node.nodeType !== 1) return '';

  const tag = node.tagName.toLowerCase();
  const children = (level = depth) => Array.from(node.childNodes).map((child) => convert(child, level)).join('');

  if (tag === 'br') return '\n';
  if (INLINE[tag]) return INLINE[tag](children());
  if (tag === 'a') {
    const href = node.getAttribute('href');
    const text = children().trim();

    return href ? `[${text || href}](${href})` : text;
  }

  const heading = /^h([1-6])$/.exec(tag);
  if (heading) return `\n\n${'#'.repeat(Number(heading[1]))} ${children().trim()}\n\n`;

  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(node.children).filter((child) => child.tagName.toLowerCase() === 'li');
    const lines = items.map((item, index) => {
      const marker = tag === 'ol' ? `${index + 1}.` : '-';
      // A nested list goes on its own lines, one level deeper
      const own = Array.from(item.childNodes)
        .filter((child) => !(child.nodeType === 1 && /^(ul|ol)$/i.test(child.tagName)))
        .map((child) => convert(child, depth + 1))
        .join('')
        .trim();
      const nested = Array.from(item.children)
        .filter((child) => /^(ul|ol)$/i.test(child.tagName))
        .map((child) => convert(child, depth + 1))
        .join('');
      // Etherpad indents with nested lists whose items are only the list
      const line = own ? `${'  '.repeat(depth)}${marker} ${own}\n` : '';

      return `${line}${nested}`;
    });

    return depth === 0 ? `\n\n${lines.join('')}\n` : lines.join('');
  }

  if (tag === 'p' || tag === 'div') return `\n\n${children()}\n\n`;

  return children();
};

const notesToMarkdown = (html) => {
  const container = document.createElement('div');
  container.innerHTML = html || '';

  return Array.from(container.childNodes)
    .map((node) => convert(node, 0))
    .join('')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .concat('\n');
};

export default notesToMarkdown;

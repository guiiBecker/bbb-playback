import notesToMarkdown from './notes-markdown';

describe('notesToMarkdown', () => {
  it('converts a real export: headings, lines, lists with paragraphs', () => {
    const html = '<h2 data-level="2">REUNIÃO 16/11</h2><p>Host: Arthur<br>Próximo host: Atila<br></p>'
      + '<h3 data-level="3">SUPORTE</h3><ul><li><p class="bn-inline-content">￼</p></li></ul>'
      + '<h3 data-level="3">PRODUTO</h3><ul><li><p>Novo player</p></li><li><p>Download</p></li></ul>';

    expect(notesToMarkdown(html)).toBe([
      '## REUNIÃO 16/11',
      '',
      'Host: Arthur',
      'Próximo host: Atila',
      '',
      '### SUPORTE',
      '',
      '### PRODUTO',
      '',
      '- Novo player',
      '- Download',
      '',
    ].join('\n'));
  });

  it('keeps bold, italic, strikethrough, code and links', () => {
    expect(notesToMarkdown('<p><strong>a</strong> <em>b</em> <s>c</s> <code>d</code> <a href="https://x.y">e</a></p>'))
      .toBe('**a** *b* ~~c~~ `d` [e](https://x.y)\n');
  });

  it('numbers ordered lists and indents nested ones', () => {
    expect(notesToMarkdown('<ol class="number"><li>one<ul><li>inner</li></ul></li><li>two</li></ol>'))
      .toBe('1. one\n  - inner\n2. two\n');
  });

  it('escapes what Markdown would read as formatting', () => {
    expect(notesToMarkdown('<p>2*3 = 6 and a_b [x]</p>')).toBe('2\\*3 = 6 and a\\_b \\[x\\]\n');
  });

  it('is empty for no notes', () => {
    expect(notesToMarkdown('')).toBe('\n');
  });
});

(() => {
  'use strict';
  const root = document.querySelector('[data-file-demo]');
  if (!root) return;
  const find = id => root.querySelector(`#${id}`);
  const tabs = [...root.querySelectorAll('[data-file-kind]')];
  const states = { document: 0, slides: 0, sheets: 0, pdf: 0 };
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  let selected = 'document';
  const examples = {
    document: {
      title: 'Reading-list brief', prompt: 'Write a one-page brief for my reading-list app.',
      create: 'Load sample brief', revise: 'Add a success measure', revision: 'Add one clear measure of success for the first version.',
      format: 'Markdown (.md)', filename: 'reading-list-brief.md', mime: 'text/markdown;charset=utf-8',
      response: 'The sample brief focuses on one useful flow: save a link, find it, and read it later.',
      revised: 'The brief now includes a measurable target for the first five testers.',
      preview: state => `<article class="files-paper"><span class="files-paper-kicker">PROJECT BRIEF</span><h3>Less bookmarking.<br>More reading.</h3><p>A personal reading list that makes the next good read easy to find.</p>${state ? '<h4>The first useful version</h4><ul><li>Save an article with a title and a link.</li><li>Find saved articles in one simple list.</li><li>Mark an article as read.</li></ul>' : '<div class="files-placeholder-lines" aria-hidden="true"><i></i><i></i><i></i></div><span class="files-sample-watermark">Load the sample to explore</span>'}${state === 2 ? '<p class="files-added"><strong>Success measure</strong><br>Four of five testers save and find an article without help.</p>' : ''}</article>`,
      download: state => '# Reading-list brief\n\n## Less bookmarking. More reading.\n\nA personal reading list that makes the next good read easy to find.\n\n## The first useful version\n\n- Save an article with a title and a link.\n- Find saved articles in one simple list.\n- Mark an article as read.\n' + (state === 2 ? '\n## Success measure\n\nFour of five testers save and find an article without help.\n' : '')
    },
    slides: {
      title: 'Reading-list pitch · slide 1', prompt: 'Turn my reading-list idea into an opening pitch slide.',
      create: 'Load sample slide', revise: 'Make the benefit clearer', revision: 'Lead with what the reader gets out of it.',
      format: 'HTML slide (.html)', filename: 'reading-list-slide.html', mime: 'text/html;charset=utf-8',
      response: 'One idea per slide. This opening gives the audience a clear problem and a simple promise.',
      revised: 'The opening now leads with the benefit: spend less time finding links and more time reading.',
      preview: state => `<article class="files-paper files-slide"><span class="files-paper-kicker">THE READING LIST / A FIRST LOOK</span><h3>${state === 2 ? 'Find your next<br>good read.' : 'Good links deserve<br>a second look.'}</h3><p>${state === 2 ? 'Less searching through bookmarks.<br>More time with the ideas you saved.' : 'A calmer home for everything<br>you want to read next.'}</p><span class="files-slide-number">01 / OPENING SLIDE</span>${state ? '' : '<span class="files-sample-watermark">Load the sample to explore</span>'}</article>`,
      download: state => `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reading-list pitch — sample slide</title><style>body{margin:0;background:#3b3932;color:#faf5eb;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}main{padding:7vw;max-width:1000px}small{color:#d2bda3;letter-spacing:.15em}h1{font-family:Georgia,serif;font-weight:400;font-size:clamp(40px,8vw,90px);line-height:1.05;letter-spacing:-.04em}p{font-size:clamp(18px,3vw,30px);color:#d8cbbb;line-height:1.6}footer{margin-top:60px;color:#d2bda3;font-size:12px}</style><main><small>THE READING LIST / A FIRST LOOK</small><h1>${state === 2 ? 'Find your next<br>good read.' : 'Good links deserve<br>a second look.'}</h1><p>${state === 2 ? 'Less searching through bookmarks.<br>More time with the ideas you saved.' : 'A calmer home for everything<br>you want to read next.'}</p><footer>01 / OPENING SLIDE · DevCon illustrative sample · HTML file</footer></main></html>`
    },
    sheets: {
      title: 'Launch budget', prompt: 'Make a simple launch budget for my side project.',
      create: 'Load sample budget', revise: 'Add a testing budget', revision: 'Set aside $30 for testing with early users.',
      format: 'CSV spreadsheet (.csv)', filename: 'launch-budget.csv', mime: 'text/csv;charset=utf-8',
      response: 'A small starting budget: a domain and one month of hosting. The total updates with the sample revision.',
      revised: 'Added $30 for user testing. The total is now $62.',
      preview: state => `<div class="files-sheet"><div class="files-sheet-title">LAUNCH BUDGET / USD</div><table><caption>${state ? `Total = SUM(C1:C${state === 2 ? 3 : 2}) · example calculation` : 'Load the sample to explore'}</caption><thead><tr><th scope="col"></th><th scope="col">A · Item</th><th scope="col">B · When</th><th scope="col">C · Cost</th></tr></thead><tbody><tr><td>1</td><td>Domain</td><td>Year one</td><td>$12</td></tr><tr><td>2</td><td>Hosting</td><td>Month one</td><td>$20</td></tr>${state === 2 ? '<tr><td>3</td><td>User testing</td><td>Launch</td><td>$30</td></tr>' : ''}<tr><td>${state === 2 ? 4 : 3}</td><td>Total</td><td></td><td>$${state === 2 ? 62 : 32}</td></tr></tbody></table></div>`,
      download: state => 'Item,When,Cost (USD)\r\nDomain,Year one,12\r\nHosting,Month one,20\r\n' + (state === 2 ? 'User testing,Launch,30\r\n' : '') + `Total,,${state === 2 ? 62 : 32}\r\n`
    },
    pdf: {
      title: 'Launch checklist · PDF', prompt: 'Make a shareable PDF checklist for launch day.',
      create: 'Load sample checklist', revise: 'Add a recovery step', revision: 'Add a final check that I can roll back the release.',
      format: 'PDF document (.pdf)', filename: 'launch-checklist.pdf', mime: 'application/pdf',
      response: 'A short launch checklist, ready to share. This demo downloads a simple, real PDF sample.',
      revised: 'Added a recovery check so the checklist covers what happens if the release needs to be undone.',
      preview: state => `<article class="files-paper files-pdf"><span class="files-paper-kicker">READY TO SHARE</span><span class="files-pdf-tag">PDF</span><h3>A little calmer<br>on launch day.</h3><p>A short checklist for the reading-list app.</p>${state ? '<ul><li>Test the complete save-and-read flow.</li><li>Check the mobile experience.</li><li>Verify errors have a useful next step.</li><li>Share the release with five testers.</li></ul>' : '<div class="files-placeholder-lines" aria-hidden="true"><i></i><i></i><i></i></div><span class="files-sample-watermark">Load the sample to explore</span>'}${state === 2 ? '<p class="files-added"><strong>Recovery check</strong><br>Confirm the previous release can be restored.</p>' : ''}</article>`,
      download: state => makePdf(['Launch checklist', '', 'A little calmer on launch day.', 'A short checklist for the reading-list app.', '', '- Test the complete save-and-read flow.', '- Check the mobile experience.', '- Verify errors have a useful next step.', '- Share the release with five testers.', ...(state === 2 ? ['', 'Recovery check', '- Confirm the previous release can be restored.'] : []), '', 'DevCon illustrative sample'])
    }
  };
  // A self-contained ASCII PDF with byte-accurate offsets; no network or PDF service.
  function makePdf(lines) {
    const literal = line => line.replace(/[\\()]/g, '\\$&');
    const stream = `BT /F1 12 Tf 54 750 Td 20 TL\n${lines.map((line, index) => `${index ? 'T* ' : ''}(${literal(line)}) Tj`).join('\n')}\nET`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    ];
    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return pdf;
  }
  function announce(message) { find('files-announcement').textContent = message; }
  function render() {
    const example = examples[selected];
    const state = states[selected];
    tabs.forEach(tab => {
      const active = tab.dataset.fileKind === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    find('file-demo-panel').setAttribute('aria-labelledby', `file-tab-${selected}`);
    find('files-user-message').textContent = example.prompt;
    find('files-assistant-message').textContent = state === 2 ? example.revised : state ? example.response : 'Load a local sample, try a revision, and download the result. No AI request is made.';
    find('files-create').innerHTML = `${escape(state ? 'Reset sample' : example.create)} <span aria-hidden="true">↗</span>`;
    find('files-create').disabled = false;
    find('files-revise').textContent = state === 2 ? 'Revision applied' : example.revise;
    find('files-revise').disabled = state !== 1;
    find('files-revision-request').hidden = state !== 2;
    find('files-revision-request').textContent = example.revision;
    find('files-preview-name').textContent = example.title;
    find('files-version').textContent = state === 2 ? 'VERSION 2' : state ? 'VERSION 1' : 'PREVIEW';
    find('files-save-status').textContent = state === 2 ? 'Sample revised locally' : state ? 'Sample loaded locally' : 'Choose an example';
    find('files-preview-content').innerHTML = example.preview(state);
    find('files-export-description').textContent = `Sample download: ${example.format}`;
    find('files-download').disabled = state === 0;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { selected = tab.dataset.fileKind; render(); announce(''); });
    tab.addEventListener('keydown', event => {
      let next = index;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selected = tabs[next].dataset.fileKind;
      render(); announce(''); tabs[next].focus();
    });
  });
  find('files-create').addEventListener('click', () => { states[selected] = 1; render(); announce('Sample loaded in this browser. Try a revision or download it.'); });
  find('files-revise').addEventListener('click', () => { states[selected] = 2; render(); announce('Sample revision applied. Your download now includes the change.'); });
  find('files-download').addEventListener('click', () => {
    const example = examples[selected];
    try {
      const url = URL.createObjectURL(new Blob([example.download(states[selected])], { type: example.mime }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = example.filename; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce(`${example.filename} prepared. This is an illustrative ${example.format} sample.`);
    } catch {
      announce('The sample could not be downloaded. Try another browser or allow downloads for this page.');
    }
  });
  render();
})();

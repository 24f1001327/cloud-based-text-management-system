document.querySelectorAll('.dept-head').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    if (e.target.closest('form') || e.target.closest('button.icon-btn')) return;
    const box = btn.closest('.dept');
    box.classList.toggle('open');
    btn.setAttribute('aria-expanded', box.classList.contains('open'));
  });
});
document.querySelectorAll('.topic-head').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    if (e.target.closest('form') || e.target.closest('button.icon-btn')) return;
    const box = btn.closest('.topic');
    box.classList.toggle('open');
    btn.setAttribute('aria-expanded', box.classList.contains('open'));
  });
});

const katexOptions = {
  delimiters: [
    {left: "$$", right: "$$", display: true},
    {left: "\\[", right: "\\]", display: true},
    {left: "$", right: "$", display: false},
    {left: "\\(", right: "\\)", display: false}
  ],
  throwOnError: false
};

function renderFormulas(container){
  if (!container) return;
  if (container.dataset.katexRendered === '1') return;

  if (typeof window.renderMathInElement === 'function') {
    try {
      window.renderMathInElement(container, katexOptions);
      container.dataset.katexRendered = '1';
    } catch(e) {
      console.warn('KaTeX render error', e);
    }
  } else if (window.katex && typeof window.katex.renderToString === 'function') {
    const nodes = container.querySelectorAll('[data-latex]');
    nodes.forEach(n=>{
      try {
        if (n.querySelector && n.querySelector('.katex')) return;
        const latex = n.getAttribute('data-latex') || '';
        n.innerHTML = window.katex.renderToString(latex, {throwOnError:false});
      } catch(e){}
    });
    container.dataset.katexRendered = '1';
  }
}

function parseDataContent(raw){
  if (!raw && raw !== '') return '';
  try {
    if (typeof raw === 'string') {
      const s = raw.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
        return JSON.parse(raw);
      }
    }
  } catch(e){ /* ignore */ }
  return raw;
}

document.querySelectorAll('.subtopic-link:not([data-url])').forEach(link=>{
  link.addEventListener('click', (e)=>{
    if (e.target.closest('form') || e.target.closest('button.icon-btn')) return;
    e.preventDefault();

    const title   = link.dataset.title || 'Untitled';
    const rawContent = link.dataset.content || '';
    const parsedContent = parseDataContent(rawContent) || 'No content yet.';
    const topic   = link.dataset.topicTitle || '';
    const dept    = link.dataset.deptTitle || '';

    const viewPane = document.getElementById('view-pane');
    if (viewPane) viewPane.style.display = 'block';
    const editorPane = document.getElementById('editor-pane');
    if (editorPane) editorPane.style.display = 'none';

    document.getElementById('content-title').textContent = title;
    document.getElementById('content-breadcrumb').textContent =
      (dept && topic) ? `${dept} › ${topic} › ${title}` : title;

    const body = document.getElementById('content-body');
    body.innerHTML = "";

    const area = document.createElement('div');
    area.style.whiteSpace = 'normal';

    if (typeof parsedContent === 'string' && /<[a-z][\s\S]*>/i.test(parsedContent)) {
      area.innerHTML = parsedContent;
    } else {
      area.textContent = parsedContent;
    }

    renderFormulas(area);
    body.appendChild(area);
  });
});


function waitForMathJax(timeout = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.MathJax && MathJax.startup && MathJax.startup.promise) {
        MathJax.startup.promise.then(() => resolve(MathJax)).catch(reject);
      } else if (Date.now() - start > timeout) {
        reject(new Error('MathJax not available'));
      } else {
        setTimeout(poll, 50);
      }
    })();
  });
}

async function renderMathJaxSvgNode(latex, display) {
  const MJ = await waitForMathJax();
  const node = MJ.tex2svg(latex, {display: !!display});
  return node.cloneNode(true);
}

function svgNodeToDataUrl(svgNode) {
  const svgEl = svgNode.querySelector('svg') || (svgNode.nodeName && svgNode.nodeName.toLowerCase() === 'svg' ? svgNode : null);
  if (!svgEl) return null;
  const serializer = new XMLSerializer();
  let svgText = serializer.serializeToString(svgEl);
  if (!svgText.match(/^<svg[^>]+xmlns="/)) {
    svgText = svgText.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  const encoded = encodeURIComponent(svgText).replace(/'/g, '%27').replace(/"/g, '%22');
  return 'data:image/svg+xml;charset=utf-8,' + encoded;
}

function waitForCondition(predicate, timeout = 1000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (predicate()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('timeout'));
      setTimeout(poll, 20);
    })();
  });
}

let tinyInitialized = false;

function safeRenderIn(elem) {
  if (!elem) return;
  if (typeof window.renderMathInElement === 'function') {
    try { window.renderMathInElement(elem, katexOptions); elem.dataset.katexRendered = '1'; }
    catch(e) { console.error('KaTeX render error', e); }
  }
}

function ensureTinyMCE() {
  if (tinyInitialized && window.tinymce && tinymce.get('editor')) return Promise.resolve(tinymce.get('editor'));

  return new Promise((resolve, reject) => {
    try {
      tinymce.init({
        selector: '#editor',
        plugins: 'code link table lists image',
        toolbar: 'undo redo | bold italic | alignleft aligncenter alignright | bullist numlist | link table | insertmath | code',
        license_key: 'gpl',
        branding: false,
        promotion: false,
        content_css: 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css',
        content_style: `
          img.math-svg-img { display:inline-block; vertical-align:baseline; max-height:3em; }
          body { line-height:1.4; }
        `,
        setup: function(editor) {
          editor.ui.registry.addButton('insertmath', {
            text: 'Insert Math',
            onAction: function() {
              editor.windowManager.open({
                title: 'Insert Math (preview, double-click image to edit)',
                size: 'normal',
                body: {
                  type: 'panel',
                  items: [
                    { type: 'textarea', name: 'latex', label: 'LaTeX', value: '' },
                    { type: 'checkbox', name: 'display', label: 'Display mode (block math)' },
                    { type: 'htmlpanel', name: 'preview', html: '<div id="math-preview" class="math-preview">Preview appears here</div>' }
                  ]
                },
                buttons: [
                  { type: 'cancel', text: 'Cancel' },
                  { type: 'submit', text: 'Insert', primary: true }
                ],
                async onChange(api) {
                  const data = api.getData();
                  const latex = (data.latex || '').trim();
                  const display = !!data.display;
                  const previewEl = document.getElementById('math-preview');
                  if (!previewEl) return;
                  if (!latex) { previewEl.innerHTML = 'Preview appears here'; return; }
                  try {
                    const node = await renderMathJaxSvgNode(latex, display);
                    previewEl.innerHTML = ''; previewEl.appendChild(node);
                  } catch (err) {
                    previewEl.innerHTML = '<div style="color:#b00">Render failed</div>';
                  }
                },
                async onSubmit(api) {
                  const data = api.getData();
                  const latex = (data.latex || '').trim();
                  const display = !!data.display;

                  let dataUrl = null;
                  if (latex) {
                    try {
                      const svgNode = await renderMathJaxSvgNode(latex, display);
                      dataUrl = svgNodeToDataUrl(svgNode);
                    } catch (err) { console.warn('SVG generation failed', err); }
                  }

                  if (dataUrl) {
                    const doc = editor.getDoc();
                    const img = doc.createElement('img');
                    img.setAttribute('src', dataUrl);
                    img.setAttribute('alt', latex);
                    img.setAttribute('class', 'math-svg-img');
                    img.setAttribute('data-latex', latex);

                    try {
                      editor.selection.setNode(img);
                    } catch (e) {
                      const esc = editor.dom.encode(latex);
                      editor.insertContent(`<img class="math-svg-img" data-latex="${esc}" src="${dataUrl}" alt="${esc}">`);
                    }

                    await waitForCondition(() => !!editor.getBody().querySelector('img.math-svg-img'), 500).catch(()=>{});
                    const body = editor.getBody();
                    let insertedImg = body.querySelector('img.math-svg-img[data-latex]');
                    if (!insertedImg) {
                      const imgs = body.querySelectorAll('img.math-svg-img');
                      insertedImg = imgs[imgs.length - 1];
                    }

                    if (insertedImg) {
                      const zwsp = doc.createTextNode('\u200B');
                      insertedImg.parentNode.insertBefore(zwsp, insertedImg.nextSibling);

                      const rng = doc.createRange();
                      rng.setStart(zwsp, 1);
                      rng.collapse(true);
                      const sel = doc.getSelection();
                      sel.removeAllRanges();
                      sel.addRange(rng);
                      editor.selection.setRng(rng);

                      const removeZwsp = () => {
                        if (zwsp && zwsp.parentNode) zwsp.parentNode.removeChild(zwsp);
                        try { editor.getDoc().removeEventListener('input', onInputListener); } catch(_) {}
                      };
                      const onInputListener = () => removeZwsp();
                      try { editor.getDoc().addEventListener('input', onInputListener, {once:true}); } catch(_) {}
                    }
                  } else {
                    const wrapped = `$$${latex}$$`;
                    editor.insertContent(wrapped);
                    safeRenderIn(editor.getBody());
                  }

                  api.close();
                },
                onOpen(api) {
                  const sel = editor.selection.getContent({format:'text'}) || '';
                  if (sel) {
                    api.setData({ latex: sel });
                    renderMathJaxSvgNode(sel, false).then(node => {
                      const previewEl = document.getElementById('math-preview');
                      if (previewEl) { previewEl.innerHTML = ''; previewEl.appendChild(node); }
                    }).catch(()=>{});
                  } else {
                    const previewEl = document.getElementById('math-preview');
                    if (previewEl) previewEl.innerHTML = 'Preview appears here';
                  }
                }
              });
            }
          });

          editor.on('DblClick', function(e) {
            const t = e.target;
            if (!t || t.tagName !== 'IMG') return;
            if (!t.classList || !t.classList.contains('math-svg-img')) return;
            e.preventDefault();
            const latex = t.getAttribute('data-latex') || '';
            editor.windowManager.open({
              title: 'Edit formula',
              size: 'normal',
              body: {
                type: 'panel',
                items: [
                  { type: 'textarea', name: 'latex', label: 'LaTeX', value: latex },
                  { type: 'checkbox', name: 'display', label: 'Display mode (block math)' },
                  { type: 'htmlpanel', name: 'preview', html: '<div id="math-preview-edit" class="math-preview">Preview appears here</div>' }
                ]
              },
              buttons: [
                { type: 'cancel', text: 'Cancel' },
                { type: 'submit', text: 'Update', primary: true }
              ],
              async onChange(api) {
                const data = api.getData();
                const previewEl = document.getElementById('math-preview-edit');
                if (!previewEl) return;
                const latex2 = (data.latex || '').trim();
                if (!latex2) { previewEl.innerHTML = 'Preview appears here'; return; }
                try {
                  const node = await renderMathJaxSvgNode(latex2, !!data.display);
                  previewEl.innerHTML = ''; previewEl.appendChild(node);
                } catch (err) { previewEl.innerHTML = '<div style="color:#b00">Render failed</div>'; }
              },
              async onSubmit(api) {
                const data = api.getData();
                const latex2 = (data.latex || '').trim();
                const display2 = !!data.display;
                let dataUrl = null;
                if (latex2) {
                  try {
                    const svgNode = await renderMathJaxSvgNode(latex2, display2);
                    dataUrl = svgNodeToDataUrl(svgNode);
                  } catch (err) { console.warn('SVG generation failed', err); }
                }
                if (dataUrl) {
                  const imgEl = e.target;
                  imgEl.setAttribute('src', dataUrl);
                  imgEl.setAttribute('alt', latex2);
                  imgEl.setAttribute('data-latex', latex2);
                }
                api.close();
              },
              onOpen(api) {
                renderMathJaxSvgNode(latex, false).then(node => {
                  const previewEl = document.getElementById('math-preview-edit');
                  if (previewEl) { previewEl.innerHTML = ''; previewEl.appendChild(node); }
                }).catch(()=>{});
              }
            });
          });

          ['init','SetContent','change','keyup','PastePostProcess'].forEach(ev => {
            editor.on(ev, () => safeRenderIn(editor.getBody()));
          });

          editor.on('keydown', function(e) {
            if (e.key !== 'Backspace') return;

            const doc = editor.getDoc();
            const rng = editor.selection.getRng();
            if (!rng || !rng.collapsed) return;

            let container = rng.startContainer;
            let offset = rng.startOffset;

            if (container.nodeType === Node.TEXT_NODE && offset > 0) return;

            function previousNodeAtCaret(cont, off) {
              if (cont.nodeType === Node.TEXT_NODE) {
                return cont.previousSibling;
              } else {
                if (cont.childNodes && off > 0) return cont.childNodes[off - 1];
                let node = cont;
                while (node && node !== doc.body) {
                  if (node.previousSibling) return node.previousSibling;
                  node = node.parentNode;
                }
                return null;
              }
            }

            const prev = previousNodeAtCaret(container, offset);
            if (!prev) return;
            if (prev.nodeType === Node.TEXT_NODE) {
              const txt = prev.nodeValue || '';
              if (txt.replace(/\u200B/g, '').length > 0) return;
            }

            let mathNode = null;
            if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'IMG' && prev.classList && prev.classList.contains('math-svg-img')) {
              mathNode = prev;
            } else if (prev.nodeType === Node.ELEMENT_NODE && prev.classList && prev.classList.contains('math-cursor')) {
              const maybe = prev.previousSibling;
              if (maybe && maybe.tagName === 'IMG' && maybe.classList && maybe.classList.contains('math-svg-img')) mathNode = maybe;
            }

            if (!mathNode) return;

            e.preventDefault();

            try {
              const parent = mathNode.parentNode;
              if (!parent) return;

              const next = mathNode.nextSibling;
              if (next && next.nodeType === Node.ELEMENT_NODE && next.classList && next.classList.contains('math-cursor')) {
                parent.removeChild(next);
              }

              const zwsp = doc.createTextNode('\u200B');
              parent.replaceChild(zwsp, mathNode);

              const newRange = doc.createRange();
              newRange.setStart(zwsp, 1);
              newRange.collapse(true);
              const sel = doc.getSelection();
              sel.removeAllRanges();
              sel.addRange(newRange);

              editor.selection.setRng(newRange);
            } catch (err) {
              console.warn('Backspace math remove error', err);
            }
          });

          editor.on('init', () => safeRenderIn(editor.getBody()));
        }
      }).then(() => {
        tinyInitialized = true;
        resolve(tinymce.get('editor'));
      }).catch(err => {
        console.error('TinyMCE init failed', err);
        reject(err);
      });
    } catch (e) {
      console.error('ensureTinyMCE error', e);
      reject(e);
    }
  });
}

function openSubtopicEditorRight(btn, ev) {
  if (ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    ev.stopPropagation();
  }

  const editorPane = document.getElementById('editor-pane');
  if (!editorPane) return; 

  const title   = btn.dataset.title || '';
  let htmlContent = '';
  try { htmlContent = parseDataContent(btn.dataset.content || '') || ''; } catch(e) { htmlContent = btn.dataset.content || ''; }
  const postUrl = btn.dataset.url || '';

  document.getElementById('view-pane').style.display = 'none';
  editorPane.style.display = 'block';

  const form = document.getElementById('editor-form');
  form.action = postUrl;
  document.getElementById('editor-title').value = title;

  ensureTinyMCE().then(editorInst=>{
    try {
      editorInst.setContent(htmlContent || '');
      safeRenderIn(editorInst.getBody());
    } catch(e){
      const ta = document.getElementById('editor');
      if (ta) ta.value = htmlContent || '';
    }
  }).catch(err=>{
    const ta = document.getElementById('editor');
    if (ta) ta.value = htmlContent || '';
  });

  form.onsubmit = function(){
    try {
      const inst = tinymce.get('editor');
      const html = inst ? inst.getContent() : document.getElementById('editor').value;
      document.getElementById('editor-content').value = html;
    } catch (e) {
      document.getElementById('editor-content').value = document.getElementById('editor').value || '';
    }
    return true;
  };

  editorPane.scrollIntoView({behavior:'smooth', block:'start'});
}

function closeEditorPane() {
  const editorPane = document.getElementById('editor-pane');
  if (editorPane) editorPane.style.display = 'none';
  const viewPane = document.getElementById('view-pane');
  if (viewPane) viewPane.style.display = 'block';
}

window.openSubtopicEditorRight = openSubtopicEditorRight;
window.closeEditorPane = closeEditorPane;

function toggleBlock(id, ev){
  if (ev) ev.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
}
window.toggleBlock = toggleBlock;

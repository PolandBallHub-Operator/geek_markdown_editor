const state = {
            zipFilesMap: {},
            zipBlobUrls: {},
            markdownFiles: [],
            currentFile: null,
            viewMode: 'split',
            selectedNocodingImg: null
        };

        const editor = document.getElementById('md-editor');
        const preview = document.getElementById('preview-output');
        const lineNumbers = document.getElementById('line-numbers');
        const fileTreeList = document.getElementById('file-tree-list');
        const assetGridList = document.getElementById('asset-grid-list');
        const nocodingCanvas = document.getElementById('nocoding-canvas');

        window.addEventListener('DOMContentLoaded', () => {
            setupEditorEvents();
            setupNocodingEvents();
            marked.use({ gfm: true, breaks: true });
            loadDefaultInitialContent();
        });

        function closeSplashScreen() {
            document.getElementById('splash-screen').classList.add('hidden');
        }

        function toggleDrawer() {
            document.getElementById('app-drawer').classList.toggle('collapsed');
        }

        function setViewMode(mode) {
            state.viewMode = mode;
            const cardEditor = document.getElementById('card-editor');
            const cardPreview = document.getElementById('card-preview');
            const cardNocoding = document.getElementById('card-nocoding');

            document.querySelectorAll('.md-tab').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${mode}`).classList.add('active');

            cardEditor.style.display = 'none';
            cardPreview.style.display = 'none';
            cardNocoding.style.display = 'none';

            if (mode === 'split') {
                cardEditor.style.display = 'flex';
                cardPreview.style.display = 'flex';
            } else if (mode === 'nocoding') {
                cardNocoding.style.display = 'flex';
                syncMarkdownToNocoding();
            } else if (mode === 'editor') {
                cardEditor.style.display = 'flex';
            } else if (mode === 'preview') {
                cardPreview.style.display = 'flex';
            }
        }

        function syncMarkdownToNocoding() {
            let rawMd = editor.value;
            rawMd = rawMd.replace(/==([^=]+)==/g, '<mark>$1</mark>');
            rawMd = processGithubAlerts(rawMd);
            nocodingCanvas.innerHTML = marked.parse(rawMd);
            resolveRelativeImagesInElement(nocodingCanvas);
            bindNocodingImageClicks();
        }

        function syncNocodingToMarkdown() {
            const convertedMd = convertHtmlToMarkdown(nocodingCanvas);
            editor.value = convertedMd;
            updateEditorLineNumbers();
            renderMarkdownPreview();
            updateDocStats();
        }

        function setupNocodingEvents() {
            nocodingCanvas.addEventListener('input', () => {
                syncNocodingToMarkdown();
            });
        }

        function execNocodingCmd(cmd, value = null) {
            document.execCommand(cmd, false, value);
            syncNocodingToMarkdown();
        }

        function bindNocodingImageClicks() {
            const imgs = nocodingCanvas.querySelectorAll('img');
            imgs.forEach(img => {
                img.onclick = (e) => {
                    e.stopPropagation();
                    state.selectedNocodingImg = img;
                    openModal('modal-nocoding-img');
                };
            });
        }

        function openNocodingImageInspector() {
            const imgs = nocodingCanvas.querySelectorAll('img');
            if (imgs.length === 0) {
                alert('No image element found in document canvas.');
                return;
            }
            state.selectedNocodingImg = imgs[0];
            openModal('modal-nocoding-img');
        }

        function applyNocodingImageStyles() {
            if (!state.selectedNocodingImg) return;
            const align = document.getElementById('nocoding-img-align').value;
            const width = document.getElementById('nocoding-img-width').value;
            const img = state.selectedNocodingImg;

            img.style.width = width;
            img.setAttribute('width', width);

            let parentDiv = img.closest('div[align]');
            if (!parentDiv) {
                parentDiv = document.createElement('div');
                img.parentNode.insertBefore(parentDiv, img);
                parentDiv.appendChild(img);
            }
            parentDiv.setAttribute('align', align);

            closeModal('modal-nocoding-img');
            syncNocodingToMarkdown();
        }

        function convertHtmlToMarkdown(containerNode) {
            let md = '';
            containerNode.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    md += node.textContent;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tag = node.tagName.toLowerCase();
                    if (/^h[1-6]$/.test(tag)) {
                        const level = '#'.repeat(parseInt(tag[1]));
                        md += `\n\n${level} ${node.textContent.trim()}\n\n`;
                    } else if (tag === 'p') {
                        md += `\n\n${node.innerHTML}\n\n`;
                    } else if (tag === 'ul') {
                        node.querySelectorAll('li').forEach(li => md += `- ${li.textContent}\n`);
                        md += '\n';
                    } else if (tag === 'ol') {
                        let i = 1;
                        node.querySelectorAll('li').forEach(li => md += `${i++}. ${li.textContent}\n`);
                        md += '\n';
                    } else if (tag === 'blockquote') {
                        md += `\n> ${node.textContent.trim()}\n\n`;
                    } else if (tag === 'pre') {
                        md += `\n\`\`\`\n${node.textContent.trim()}\n\`\`\`\n\n`;
                    } else {
                        md += node.outerHTML;
                    }
                }
            });

            return md.replace(/<b>(.*?)<\/b>/gi, '**$1**')
                     .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
                     .replace(/<i>(.*?)<\/i>/gi, '*$1*')
                     .replace(/<em>(.*?)<\/em>/gi, '*$1*')
                     .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
                     .replace(/<mark>(.*?)<\/mark>/gi, '==$1==')
                     .replace(/\n\s*\n\s*\n/g, '\n\n')
                     .trim();
        }

        /* JUNIOR PLUGIN FUNCTIONS */
        function openJuniorPluginModal() {
            updateJuniorMetrics();
            openModal('modal-junior-plugin');
        }

        function updateJuniorMetrics() {
            const text = editor.value;
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            const readTime = Math.ceil(words / 200);
            const tasks = (text.match(/- \[( |x)\]/gi) || []).length;
            const htmlTags = (text.match(/<[a-z\/][^>]*>/gi) || []).length;

            document.getElementById('j-words').textContent = words;
            document.getElementById('j-readtime').textContent = `${readTime} min`;
            document.getElementById('j-tasks').textContent = tasks;
            document.getElementById('j-htmltags').textContent = htmlTags;
        }

        function juniorInsertTemplate(type) {
            let tpl = '';
            if (type === 'full_cheatsheet') {
                tpl = `# Markdown & HTML Full Suite Cheatsheet

# 見出し1 (H1)
## 見出し2 (H2)
### 見出し3 (H3)
#### 見出し4 (H4)
##### 見出し5 (H5)
###### 見出し6 (H6)

---

## 🎨 テキスト装飾 (Markdown & HTML)
*斜体 (イタリック)* や _斜体 (イタリック)_
**太字 (ボールド)** や __太字 (ボールド)__
***太字かつ斜体***
~~打ち消し線 (ストライク)~~
==マーカーハイライト== または <mark>マーカーハイライト</mark>
<ins>下線 (アンダーライン)</ins> や <u>uタグによるアンダーライン</u>
下付き文字: H<sub>2</sub>O | 上付き文字: X<sup>2</sup>
キーボード表示: <kbd>Ctrl</kbd> + <kbd>C</kbd>

---

## 🔗 リンク & 画像
- [標準リンクテキスト](https://google.com)
- [ポップアップタイトル付き](https://google.com "Google Top")
- 自動リンク: <https://github.com>
- ![標準画像](assets/banner.png)
- ![タイトル付き画像](assets/banner.png "画像タイトル")
- <img src="assets/banner.png" width="300" height="120" alt="サイズ指定画像">
- <img src="assets/banner.png" style="max-width:100%; border-radius:4px;" alt="レスポンシブ画像">

---

## 💬 引用 & ネスト
> 引用ブロック
> > ネストされた引用ブロック

<blockquote cite="https://example.com">
  出典付きのHTML詳細引用ブロック
</blockquote>

---

## 📋 リスト (Markdown & HTML)
- 箇条書き (ディスク -)
* 箇条書き (アスタリスク *)
+ 箇条書き (プラス +)

1. 番号付きリスト
2. 連番項目
   1.1. ネストされた番号付きリスト

- [ ] 未チェックのタスク
- [x] チェック済みのタスク

<ul>
  <li>HTML形式箇条書き 1</li>
  <li>HTML形式箇条書き 2</li>
</ul>

---

## 💻 コード & 構造
インラインコード: \`const val = 42;\`

\`\`\`javascript
// 複数行コードブロック
function greet(name) {
  console.log("Hello, " + name);
}
\`\`\`

<pre><code><div class="custom">HTML埋め込み整形済みコード</div></code></pre>

---

## 📊 テーブル (Markdown & HTML)

| 左寄せ (列1) | 中央寄せ (列2) | 右寄せ (列3) |
| :--- | :---: | ---: |
| Data A | Data B | Data C |
| Data D | Data E | Data F |

<table>
  <tr>
    <th>HTMLヘッダー1</th>
    <th colspan="2">横に結合されたヘッダー</th>
  </tr>
  <tr>
    <td rowspan="2">縦結合セル</td>
    <td>データA</td>
    <td>データB</td>
  </tr>
  <tr>
    <td>データC</td>
    <td>データD</td>
  </tr>
</table>

---

## 📐 配置・詳細・アコーディオン
<div align="center">中央寄せ配置 (center)</div>
<div align="right">右寄せ配置 (right)</div>
<div align="left">左寄せ配置 (left)</div>

<span style="color: red;">赤文字指定</span>
<span style="background-color: yellow;">背景色ハイライト</span>
<span style="font-size: 20px;">20px文字サイズ</span>

<details>
  <summary>折りたたみ見出し (アコーディオン)</summary>
  折りたたまれていた詳細コンテンツです。
</details>

<br> (強制改行)
<hr> (水平線)
<!-- これは画面に表示されない隠しコメントです -->
絵文字: :rocket: :smile: :sparkles:
エスケープ処理: \* \_ \[ \] \( \) \# \+ \- \. \!
`;
            } else if (type === 'readme') {
                tpl = `# Project Title\n\n> Short project description\n\n<div align="center">\n  <img src="assets/banner.png" alt="Banner" style="max-width:85%;">\n</div>\n\n## ⚡ Installation\n\`\`\`bash\nnpm install package\n\`\`\`\n`;
            } else if (type === 'api') {
                tpl = `# API Reference\n\n### \`POST /api/v1/resource\`\n\n<details>\n  <summary>View Payload Example</summary>\n\n\`\`\`json\n{\n  "status": "active"\n}\n\`\`\`\n</details>\n`;
            }

            editor.value = tpl;
            updateEditorLineNumbers();
            renderMarkdownPreview();
            if (state.viewMode === 'nocoding') syncMarkdownToNocoding();
            closeModal('modal-junior-plugin');
        }

        function juniorCenterAllImages() {
            let content = editor.value;
            content = content.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
                return `<div align="center">\n  <img src="${src}" alt="${alt}" style="max-width:85%;">\n</div>`;
            });
            editor.value = content;
            updateEditorLineNumbers();
            renderMarkdownPreview();
            closeModal('modal-junior-plugin');
        }

        function juniorFormatHeadings() {
            let content = editor.value;
            content = content.replace(/\n{3,}/g, '\n\n');
            editor.value = content;
            updateEditorLineNumbers();
            renderMarkdownPreview();
            closeModal('modal-junior-plugin');
        }

        function juniorOptimizeDoc() {
            juniorCenterAllImages();
        }

        function resolveRelativeImagesInElement(parentElement) {
            const imgElements = parentElement.querySelectorAll('img');
            imgElements.forEach(img => {
                const src = img.getAttribute('src');
                if (!src) return;
                const cleanSrc = src.replace(/^(\.\/|\/)/, '');
                if (state.zipBlobUrls[src]) {
                    img.src = state.zipBlobUrls[src];
                } else if (state.zipBlobUrls[cleanSrc]) {
                    img.src = state.zipBlobUrls[cleanSrc];
                }
            });
        }

        function loadDefaultInitialContent() {
            juniorInsertTemplate('full_cheatsheet');
        }

        async function loadDemoRepoZip() {
            const zip = new JSZip();
            zip.file("README.md", editor.value);
            const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160">
                <rect width="600" height="160" fill="#3F51B5" rx="4"/>
                <text x="300" y="85" font-family="Roboto, sans-serif" font-size="22" fill="#FFFFFF" text-anchor="middle" font-weight="bold">MATERIAL DESIGN DEMO ZIP</text>
            </svg>`;
            zip.file("assets/banner.png", bannerSvg);
            const content = await zip.generateAsync({ type: "blob" });
            processZipBlob(content, "demo-suite-repo.zip");
        }

        function handleZipUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            processZipBlob(file, file.name);
        }

        async function processZipBlob(blob, zipName) {
            try {
                document.getElementById('repo-status-text').textContent = `Loaded: ${zipName}`;
                Object.values(state.zipBlobUrls).forEach(url => URL.revokeObjectURL(url));
                state.zipFilesMap = {};
                state.zipBlobUrls = {};
                state.markdownFiles = [];

                const zip = await JSZip.loadAsync(blob);
                const promises = [];

                zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.dir) return;
                    const ext = relativePath.split('.').pop().toLowerCase();

                    if (['md', 'markdown'].includes(ext)) {
                        promises.push(zipEntry.async("string").then(content => {
                            state.markdownFiles.push({ path: relativePath, content: content });
                        }));
                    } else if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext)) {
                        promises.push(zipEntry.async("blob").then(imgBlob => {
                            const url = URL.createObjectURL(imgBlob);
                            state.zipFilesMap[relativePath] = imgBlob;
                            state.zipBlobUrls[relativePath] = url;
                            const cleanPath = relativePath.replace(/^(\.\/|\/)/, '');
                            state.zipBlobUrls[cleanPath] = url;
                        }));
                    }
                });

                await Promise.all(promises);
                renderFileTree();
                renderAssetGrid();

                if (state.markdownFiles.length > 0) {
                    selectMarkdownFile(state.markdownFiles[0].path);
                }
                closeSplashScreen();
            } catch (err) {
                console.error("Zip parse error:", err);
            }
        }

        function renderFileTree() {
            fileTreeList.innerHTML = '';
            document.getElementById('md-count-badge').textContent = state.markdownFiles.length;

            if (state.markdownFiles.length === 0) {
                fileTreeList.innerHTML = '<li style="padding:10px; font-size:12px; color:#888;">No markdown files.</li>';
                return;
            }

            state.markdownFiles.forEach(file => {
                const li = document.createElement('li');
                li.className = `md-list-item ${state.currentFile === file.path ? 'active' : ''}`;
                li.innerHTML = `<span class="material-icons" style="font-size:16px;">description</span><span style="overflow:hidden;text-overflow:ellipsis;">${file.path}</span>`;
                li.onclick = () => selectMarkdownFile(file.path);
                fileTreeList.appendChild(li);
            });
        }

        function selectMarkdownFile(filePath) {
            const docObj = state.markdownFiles.find(f => f.path === filePath);
            if (!docObj) return;

            state.currentFile = filePath;
            editor.value = docObj.content;
            document.getElementById('current-file-label').textContent = `Editor (${filePath})`;

            renderFileTree();
            updateEditorLineNumbers();
            renderMarkdownPreview();
        }

        function renderAssetGrid() {
            assetGridList.innerHTML = '';
            const paths = Object.keys(state.zipFilesMap);
            document.getElementById('img-count-badge').textContent = paths.length;

            if (paths.length === 0) {
                assetGridList.innerHTML = '<div style="grid-column: span 2; padding:10px; font-size:11px; color:#888; text-align:center;">No extracted images.</div>';
                return;
            }

            paths.forEach(path => {
                const url = state.zipBlobUrls[path];
                const card = document.createElement('div');
                card.className = 'asset-card';
                card.innerHTML = `
                    <img class="asset-thumb" src="${url}" alt="${path}">
                    <div class="asset-name">${path}</div>
                `;
                card.onclick = () => insertAtCursor(`![Image](${path})`);
                assetGridList.appendChild(card);
            });
        }

        function renderMarkdownPreview() {
            let rawMarkdown = editor.value;
            rawMarkdown = rawMarkdown.replace(/==([^=]+)==/g, '<mark>$1</mark>');
            rawMarkdown = processGithubAlerts(rawMarkdown);

            let htmlOutput = marked.parse(rawMarkdown);
            preview.innerHTML = htmlOutput;

            resolveRelativeImagesInElement(preview);

            preview.querySelectorAll('pre code').forEach((block) => {
                if (block.classList.contains('language-mermaid')) {
                    try {
                        const mDiv = document.createElement('div');
                        mDiv.className = 'mermaid';
                        mDiv.textContent = block.textContent;
                        block.parentNode.replaceWith(mDiv);
                    } catch (e) {}
                } else {
                    hljs.highlightElement(block);
                }
            });

            try { mermaid.contentLoaded(); } catch (e) {}
            renderKaTeXMath();
            bindCheckboxes();
        }

        function processGithubAlerts(md) {
            const types = ['NOTE', 'WARNING', 'IMPORTANT', 'TIP', 'CAUTION'];
            types.forEach(type => {
                const regex = new RegExp(`^> \\[\\!${type}\\]\\n> (.*)$`, 'gm');
                md = md.replace(regex, (match, content) => {
                    return `<div class="markdown-alert ${type}"><div class="markdown-alert-title">${type}</div><div>${content}</div></div>`;
                });
            });
            return md;
        }

        function renderKaTeXMath() {
            const walk = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT, null, false);
            const textNodes = [];
            let node;
            while (node = walk.nextNode()) {
                if (node.parentNode.tagName !== 'SCRIPT' && node.parentNode.tagName !== 'CODE' && node.parentNode.tagName !== 'PRE') {
                    textNodes.push(node);
                }
            }

            textNodes.forEach(n => {
                let text = n.nodeValue;
                if (text.includes('$')) {
                    const span = document.createElement('span');
                    span.innerHTML = text.replace(/\$([^\$]+)\$/g, (m, math) => {
                        try { return katex.renderToString(math, { throwOnError: false }); }
                        catch (e) { return m; }
                    });
                    if (n.parentNode) n.parentNode.replaceChild(span, n);
                }
            });
        }

        function bindCheckboxes() {
            const cbs = preview.querySelectorAll('input[type="checkbox"]');
            cbs.forEach((cb, idx) => {
                cb.style.cursor = 'pointer';
                cb.onchange = () => {
                    let count = 0;
                    editor.value = editor.value.replace(/- \[( |x)\]/gi, (m) => {
                        if (count++ === idx) return cb.checked ? '- [x]' : '- [ ]';
                        return m;
                    });
                    renderMarkdownPreview();
                };
            });
        }

        function setupEditorEvents() {
            editor.addEventListener('input', () => {
                updateEditorLineNumbers();
                renderMarkdownPreview();
                updateDocStats();
            });
            editor.addEventListener('keyup', updateCursorInfo);
            editor.addEventListener('click', updateCursorInfo);
            editor.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    insertAtCursor('  ');
                }
            });
        }

        function updateEditorLineNumbers() {
            const lines = editor.value.split('\n').length;
            let html = '';
            for (let i = 1; i <= lines; i++) html += i + '<br>';
            lineNumbers.innerHTML = html;
        }

        function updateCursorInfo() {
            const pos = editor.selectionStart;
            const text = editor.value.substring(0, pos);
            const line = text.split('\n').length;
            const col = text.split('\n').pop().length + 1;
            document.getElementById('cursor-pos-info').textContent = `Ln ${line}, Col ${col}`;
        }

        function updateDocStats() {
            const val = editor.value;
            document.getElementById('doc-stats-info').textContent = `${val.split('\n').length} lines | ${val.length} chars`;
        }

        function insertAtCursor(before, after = '') {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const sel = editor.value.substring(start, end);
            editor.value = editor.value.substring(0, start) + before + sel + after + editor.value.substring(end);
            editor.focus();
            editor.selectionStart = start + before.length;
            editor.selectionEnd = start + before.length + sel.length;

            updateEditorLineNumbers();
            renderMarkdownPreview();
            updateDocStats();
        }

        /* FULL MD & HTML SYNTAX INSERTION ENGINE */
        function insertSyntax(type) {
            switch (type) {
                // Headings
                case 'h1': insertAtCursor('# '); break;
                case 'h2': insertAtCursor('## '); break;
                case 'h3': insertAtCursor('### '); break;
                case 'h4': insertAtCursor('#### '); break;
                case 'h5': insertAtCursor('##### '); break;
                case 'h6': insertAtCursor('###### '); break;

                // Text Format
                case 'bold': insertAtCursor('**', '**'); break;
                case 'bold2': insertAtCursor('__', '__'); break;
                case 'italic': insertAtCursor('*', '*'); break;
                case 'italic2': insertAtCursor('_', '_'); break;
                case 'bolditalic': insertAtCursor('***', '***'); break;
                case 'strike': insertAtCursor('~~', '~~'); break;
                case 'underline': insertAtCursor('<u>', '</u>'); break;
                case 'ins': insertAtCursor('<ins>', '</ins>'); break;
                case 'highlight': insertAtCursor('==', '=='); break;
                case 'sub': insertAtCursor('<sub>', '</sub>'); break;
                case 'sup': insertAtCursor('<sup>', '</sup>'); break;
                case 'kbd': insertAtCursor('<kbd>', '</kbd>'); break;

                // Lists
                case 'ul_dash': insertAtCursor('- '); break;
                case 'ul_star': insertAtCursor('* '); break;
                case 'ul_plus': insertAtCursor('+ '); break;
                case 'ol': insertAtCursor('1. '); break;
                case 'ol_nested': insertAtCursor('  1.1. '); break;
                case 'task_off': insertAtCursor('- [ ] '); break;
                case 'task_on': insertAtCursor('- [x] '); break;
                case 'html_ul': insertAtCursor('<ul>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ul>\n'); break;
                case 'html_ol': insertAtCursor('<ol>\n  <li>Item 1</li>\n  <li>Item 2</li>\n</ol>\n'); break;

                // Links & Images
                case 'link': insertAtCursor('[Text](', 'https://example.com)'); break;
                case 'link_title': insertAtCursor('[Text](', 'https://example.com "Popup Title")'); break;
                case 'auto_link': insertAtCursor('<', 'https://example.com>'); break;
                case 'img': insertAtCursor('![Alt](', 'path/to/image.png)'); break;
                case 'img_title': insertAtCursor('![Alt](', 'path/to/image.png "Image Title")'); break;
                case 'img_html': insertAtCursor('<img src="path/to/image.png" width="300" height="200" alt="Image">'); break;
                case 'img_responsive': insertAtCursor('<img src="path/to/image.png" style="max-width:100%; height:auto;" alt="Responsive">'); break;

                // Layout & Quotes
                case 'quote': insertAtCursor('> '); break;
                case 'quote_nested': insertAtCursor('> > '); break;
                case 'quote_cite': insertAtCursor('<blockquote cite="https://example.com">\n  Quote content\n</blockquote>\n'); break;
                case 'align_center': insertAtCursor('<div align="center">\n  Centered content\n</div>\n'); break;
                case 'align_right': insertAtCursor('<div align="right">\n  Right aligned content\n</div>\n'); break;
                case 'align_left': insertAtCursor('<div align="left">\n  Left aligned content\n</div>\n'); break;

                // Rules & Breaks
                case 'hr_dash': insertAtCursor('\n---\n'); break;
                case 'hr_star': insertAtCursor('\n***\n'); break;
                case 'hr_under': insertAtCursor('\n___\n'); break;
                case 'hr_html': insertAtCursor('\n<hr>\n'); break;
                case 'br': insertAtCursor('<br>\n'); break;
                case 'p_tag': insertAtCursor('<p>', '</p>'); break;
                case 'comment': insertAtCursor('<!-- ', ' -->'); break;

                // Code & Accordion
                case 'code_inline': insertAtCursor('`', '`'); break;
                case 'codeblock': insertAtCursor('```javascript\n', '\n```'); break;
                case 'code_html': insertAtCursor('<pre><code>\nCode block here\n</code></pre>\n'); break;
                case 'details': insertAtCursor('<details>\n  <summary>Accordion Summary</summary>\n  Hidden content\n</details>\n'); break;

                // Tables
                case 'table_html': insertAtCursor('<table>\n  <tr><th>Header 1</th><th>Header 2</th></tr>\n  <tr><td>Cell 1</td><td>Cell 2</td></tr>\n</table>\n'); break;
                case 'table_merged': insertAtCursor('<table>\n  <tr><th colspan="2">Merged Header</th></tr>\n  <tr><td rowspan="2">Merged Row</td><td>Cell A</td></tr>\n  <tr><td>Cell B</td></tr>\n</table>\n'); break;

                // Specials
                case 'escapes': insertAtCursor('\\* \\_ \\[ \\] \\( \\) \\# \\+ \\- \\. \\!'); break;
                case 'emoji': insertAtCursor(':rocket: '); break;
                case 'math': insertAtCursor('$', '$'); break;
                case 'mermaid': insertAtCursor('```mermaid\ngraph TD;\n  A-->B;\n```'); break;
                case 'callout': insertAtCursor('> [!NOTE]\n> Alert Callout'); break;
            }
        }

        function openModal(id) { document.getElementById(id).classList.add('active'); }
        function closeModal(id) { document.getElementById(id).classList.remove('active'); }

        function openTableModal() { openModal('modal-table'); }
        function generateTableMarkdown() {
            const rows = parseInt(document.getElementById('tbl-rows').value) || 3;
            const cols = parseInt(document.getElementById('tbl-cols').value) || 3;
            const align = document.getElementById('tbl-align').value;

            let alignStr = ':---';
            if (align === 'center') alignStr = ':---:';
            if (align === 'right') alignStr = '---:';

            let tableMd = '\n';
            let headerRow = '|', sepRow = '|';
            for (let c = 1; c <= cols; c++) {
                headerRow += ` Column ${c} |`;
                sepRow += ` ${alignStr} |`;
            }
            tableMd += headerRow + '\n' + sepRow + '\n';

            for (let r = 1; r <= rows; r++) {
                let rowStr = '|';
                for (let c = 1; c <= cols; c++) rowStr += ` Data ${r}-${c} |`;
                tableMd += rowStr + '\n';
            }
            tableMd += '\n';
            insertAtCursor(tableMd);
            closeModal('modal-table');
        }

        function openColorModal(mode) {
            document.getElementById('color-target-mode').value = mode;
            const gColor = document.getElementById('group-color-hex');
            const gSize = document.getElementById('group-font-size');
            const title = document.getElementById('color-modal-title');

            gColor.style.display = 'flex';
            gSize.style.display = 'none';

            if (mode === 'color') title.textContent = 'Text Color Span';
            else if (mode === 'bg') title.textContent = 'Background Color Span';
            else if (mode === 'size') {
                title.textContent = 'Font Size Span';
                gColor.style.display = 'none';
                gSize.style.display = 'flex';
            }
            openModal('modal-color');
        }

        function generateColorSpan() {
            const mode = document.getElementById('color-target-mode').value;
            const text = document.getElementById('color-text-val').value || 'Content';
            const color = document.getElementById('color-hex-val').value || '#3F51B5';
            const size = document.getElementById('font-size-val').value || '20px';

            if (mode === 'color') insertAtCursor(`<span style="color: ${color};">${text}</span>`);
            else if (mode === 'bg') insertAtCursor(`<span style="background-color: ${color};">${text}</span>`);
            else if (mode === 'size') insertAtCursor(`<span style="font-size: ${size};">${text}</span>`);

            closeModal('modal-color');
        }

        function exportMarkdownFile() {
            const blob = new Blob([editor.value], { type: 'text/markdown;charset=utf-8' });
            const filename = state.currentFile ? state.currentFile.split('/').pop() : 'document.md';
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            link.click();
            URL.revokeObjectURL(link.href);
        }
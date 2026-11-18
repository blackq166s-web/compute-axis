const advisorQuants = [
  ['Q4_K_M', 'Q4 · 占用较小', 4.5],
  ['Q6_K', 'Q6 · 折中', 6.5],
  ['Q8_0', 'Q8 · 较高精度', 8],
  ['FP16', 'FP16 · 半精度', 16],
];
const advisorNumber = (value, digits = 1) => value.toLocaleString('zh-CN', {maximumFractionDigits:digits});
const advisorSearchText = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function advisorCapacity(model, quant) {
  return model.params_b * quant[2] / 8 * 1.15;
}

function advisorRecipe(model, quant, targetSpeed, platform) {
  const required = advisorCapacity(model, quant);
  const weightsGB = model.params_b * quant[2] / 8;
  const candidates = [];
  for (const gpu of ADVISOR_DATA.gpus) {
    const unified = gpu.type === 'system';
    if ((platform === 'card' && unified) || (platform === 'unified' && !unified)) continue;
    for (const count of unified ? [1] : [1, 2, 4, 8]) {
      const nominal = gpu.memory * count;
      const available = nominal * (unified ? 0.75 : count > 1 ? 0.95 : 1);
      if (available < required) continue;
      // Use per-device bandwidth without assuming linear multi-GPU scaling.
      const speed = gpu.bandwidth == null ? null : gpu.bandwidth / weightsGB;
      candidates.push({gpu,unified,count,nominal,speed});
    }
  }
  candidates.sort((a,b) => a.count - b.count || a.nominal - b.nominal || a.gpu.name.localeCompare(b.gpu.name));
  const matches = candidates.filter(item => targetSpeed === 0 || (item.speed != null && item.speed >= targetSpeed));
  const fastest = matches.filter(item => item.speed != null).sort((a,b) => b.speed - a.speed)[0];
  return {candidates,matches,minimum:candidates[0],choices:[
    ['占用容量优先',matches[0]], ['带宽上限优先',fastest],
    ['单卡方案',matches.find(item => item.count === 1 && !item.unified)],
    ['统一内存方案',matches.find(item => item.unified)],
  ]};
}

function advisor() {
  $('#main').innerHTML = `
    <section class="hero">
      <div>
        <h1>按模型选硬件</h1>
        <p>选一个要部署的模型，查看所需容量和适合进一步验证的硬件。</p>
      </div>
    </section>
    <div class="advisor-layout">
      <form class="panel advisor-form" id="model-hardware-form">
        <h2>设置部署需求</h2>
        <div class="advisor-picker">
          <label for="advisor-model-search">模型</label>
          <input id="advisor-model-search" type="search" role="combobox" autocomplete="off"
            aria-expanded="false" aria-controls="advisor-model-options" aria-autocomplete="list"
            placeholder="搜索模型名称或系列">
          <div class="advisor-options" id="advisor-model-options" role="listbox" aria-label="匹配模型" hidden></div>
          <p id="advisor-model-status" class="small" aria-live="polite">${ADVISOR_DATA.models.length.toLocaleString()} 条模型目录记录</p>
        </div>
        <div class="advisor-field">
          <label for="advisor-quant">量化精度</label>
          <select id="advisor-quant">${opts(advisorQuants.map(([key,label]) => [key,label]))}</select>
        </div>
        <div class="advisor-field">
          <label for="advisor-speed">目标生成速度</label>
          <select id="advisor-speed">${opts([[0,'不限'],[10,'至少 10 token/s'],[25,'至少 25 token/s'],[50,'至少 50 token/s']])}</select>
        </div>
        <div class="advisor-field">
          <label for="advisor-platform">硬件范围</label>
          <select id="advisor-platform">${opts([['all','全部平台'],['card','独立显卡'],['unified','统一内存整机']])}</select>
        </div>
        <button class="primary" id="advisor-submit" type="submit" disabled>查找硬件方案</button>
      </form>
      <section class="panel advisor-results" id="advisor-results" aria-live="polite">
        <div class="empty"><div><h2>先选择模型</h2><p>搜索并选中具体版本，然后查看配置。</p></div></div>
      </section>
    </div>
    <p class="small advisor-attribution">示例型号来自厂商规格与模型卡。带宽计算用于粗筛，实际部署请按对应软硬件复测。</p>` + footer;

  const form = $('#model-hardware-form');
  const input = $('#advisor-model-search');
  const list = $('#advisor-model-options');
  const quantSelect = $('#advisor-quant');
  $('#advisor-speed').value = '10';
  const status = $('#advisor-model-status');
  const submit = $('#advisor-submit');
  const results = $('#advisor-results');
  const modelRows = ADVISOR_DATA.models.map((model, index) => ({
    model, index, name: advisorSearchText(model.name),
    search: advisorSearchText(`${model.name} ${model.family} ${model.hf_id || ''}`),
  }));
  let selected = null;
  let activeIndex = -1;
  let shown = [];

  function closeList() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }
  function markDirty() {
    results.innerHTML = selected
      ? '<div class="empty"><div><h2>开始匹配硬件</h2><p>按当前精度、速度和预算计算候选方案。</p></div></div>'
      : '<div class="empty"><div><h2>先选择模型</h2><p>搜索并选中具体版本，然后查看配置。</p></div></div>';
    submit.disabled = !selected;
  }
  function choose(index) {
    selected = ADVISOR_DATA.models[index];
    input.value = selected.name;
    status.textContent = [selected.provider, `${selected.params_b}B 参数`, selected.hf_id].filter(Boolean).join(' · ');
    closeList();
    markDirty();
  }
  function updateResults() {
    if (!selected) return;
    const quant = advisorQuants.find(([level]) => level === quantSelect.value);
    const speed = Number($('#advisor-speed').value);
    const recipe = advisorRecipe(selected, quant, speed, $('#advisor-platform').value);
    renderAdvisorResults(results, selected, quant, recipe);
  }
  function search() {
    const query = advisorSearchText(input.value);
    const rank = row => row.name === query ? 0 : row.name.startsWith(query) ? 1 : row.search.includes(query) ? 2 : 3;
    const matches = query ? modelRows.filter(row => query.split(' ').every(word => row.search.includes(word)))
      .sort((a, b) => rank(a) - rank(b)) : modelRows;
    shown = matches.slice(0, 40);
    activeIndex = -1;
    input.removeAttribute('aria-activedescendant');
    list.innerHTML = shown.map(({model,index}) => `
      <div id="advisor-model-${index}" role="option" aria-selected="false" data-model-index="${index}">
        <strong>${esc(model.name)}</strong><small>${esc([model.provider, `${model.params_b}B`, model.hf_id].filter(Boolean).join(' · '))}</small>
      </div>`).join('') || '<div class="small advisor-no-model">没有找到模型，试试较短的关键词。</div>';
    status.textContent = matches.length > shown.length ? `找到 ${matches.length} 条，显示前 ${shown.length} 条。可继续缩小搜索。` : `找到 ${matches.length} 条`;
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }
  input.addEventListener('focus', () => { if (!selected) search(); });
  input.addEventListener('input', () => { selected = null; search(); markDirty(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeList(); return; }
    if (event.key === 'Tab') { closeList(); return; }
    if (event.key === 'Enter' && !list.hidden) {
      event.preventDefault();
      if (shown.length) choose(shown[Math.max(0, activeIndex)].index);
      return;
    }
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    if (list.hidden) search();
    if (!shown.length) return;
    activeIndex = Math.max(0, Math.min(shown.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
    const item = list.children[activeIndex];
    for (const node of list.children) node.setAttribute('aria-selected', String(node === item));
    input.setAttribute('aria-activedescendant', item.id);
    item.scrollIntoView({block:'nearest'});
  });
  list.addEventListener('click', event => {
    const item = event.target.closest('[data-model-index]');
    if (item) choose(Number(item.dataset.modelIndex));
  });
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.advisor-picker')) closeList(); });
  form.addEventListener('change', event => {
    if (event.target === quantSelect && results.querySelector('[data-advisor-quant]')) updateResults();
    else if (event.target.tagName === 'SELECT') markDirty();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    closeList();
    updateResults();
  });
  results.addEventListener('click', event => {
    const button = event.target.closest('[data-advisor-quant]');
    if (!button || button.dataset.advisorQuant === quantSelect.value) return;
    quantSelect.value = button.dataset.advisorQuant;
    updateResults();
    results.querySelector('.advisor-memory.on').focus({preventScroll:true});
  });
  const defaultIndex = modelRows.findIndex(({model}) => model.hf_id === 'Qwen/Qwen3.8-27B');
  if (defaultIndex >= 0) {
    choose(defaultIndex);
    updateResults();
  }
}

function advisorOption(item, labels) {
  const brand = item.gpu.brand;
  const power = item.gpu.tdp > 0 && !item.unified ? `${advisorNumber(item.gpu.tdp * item.count, 0)} W 卡标称功耗合计` : '';
  return `<article class="advisor-option">
    <p class="advisor-option-label">${esc(labels.join(' · '))}</p>
    <div class="advisor-hardware-name">${brandIcon(brand)}<h3>${item.count > 1 ? item.count + ' × ' : ''}${esc(item.gpu.name)}</h3></div>
    <dl><div><dt>${item.unified ? '统一内存总量' : '标称显存合计'}</dt><dd>${advisorNumber(item.nominal)} GB</dd></div>
    <div><dt>仅按带宽估算上限</dt><dd>${item.speed == null ? '待核验' : advisorNumber(item.speed) + ' token/s'}</dd></div></dl>
    ${power ? `<p class="small">${power}</p>` : ''}
    ${item.count > 1 ? '<p class="small">需核对卡间互联、框架分片、主板插槽及整机供电。</p>' : ''}
  </article>`;
}

function renderAdvisorResults(target, model, quant, recipe) {
  const top = new Map();
  for (const [label, item] of recipe.choices) {
    if (!item) continue;
    if (!top.has(item)) top.set(item, []);
    top.get(item).push(label);
  }
  if (!top.size && recipe.matches.length) top.set(recipe.matches[0], ['符合筛选条件']);
  if (!top.size && recipe.minimum) top.set(recipe.minimum, ['容量参考 · 未满足当前筛选']);
  const modelLink = /^[\w.-]+\/[\w.-]+$/.test(model.hf_id || '')
    ? `<a href="https://huggingface.co/${esc(model.hf_id)}" target="_blank" rel="noopener">查看模型资料 ↗</a>` : '';
  const modelMeta = [`${advisorNumber(model.params_b)}B 标称参数`];
  target.innerHTML = `
    <header class="advisor-result-head"><div><p class="small">匹配结果</p><h2>${esc(model.name)}</h2></div>${modelLink}</header>
    <p class="small advisor-model-meta">${modelMeta.join(' · ')}</p>
    <div class="advisor-memory-grid" role="group" aria-label="按量化精度切换推荐">${advisorQuants.map(entry => {
      const required = advisorCapacity(model, entry);
      const active = entry === quant;
      return `<button type="button" class="advisor-memory ${active ? 'on' : ''}" data-advisor-quant="${entry[0]}" aria-pressed="${active}"><span>${entry[0]}</span>
        <strong>${advisorNumber(required)} GB</strong><small>公式估算</small></button>`;
    }).join('')}</div>
    <p class="small advisor-assumptions">容量按权重加 15% 估算。统一内存按总量的 75% 粗筛，多卡按合计的 95% 粗筛。速度为仅考虑带宽的上限，实际结果取决于上下文、框架及硬件。</p>
    <div class="advisor-match-summary">
      <strong>${recipe.matches.length} 个方案符合筛选</strong>
    </div>
    ${recipe.matches.length ? '' : `<p class="notice">${recipe.candidates.length ? '有满足容量估算的配置，可以放宽目标速度查看。' : '所选范围暂无满足容量估算的配置，可调整量化精度或硬件范围。'}</p>`}
    <div class="advisor-recommendations">${[...top].map(([item,labels]) => advisorOption(item,labels)).join('')}</div>
    ${top.size ? '<p class="small">部署前请确认模型格式、推理框架及驱动支持。</p>' : ''}
    ${recipe.candidates.length ? `<details class="advisor-expand"><summary>查看全部容量候选（${recipe.candidates.length} 个）</summary>
      <p class="small">此列表保留容量候选，并标出符合速度筛选的方案。</p>
      <div class="advisor-table table-scroll"></div>
      <div class="advisor-paging"><button type="button" class="outline" data-advisor-prev>上一页</button>
        <span class="small" data-advisor-pages></span><button type="button" class="outline" data-advisor-next>下一页</button></div></details>` : ''}
    `;
  if (!recipe.candidates.length) return;
  const rows = target.querySelector('.advisor-table');
  const prev = target.querySelector('[data-advisor-prev]');
  const next = target.querySelector('[data-advisor-next]');
  const pages = target.querySelector('[data-advisor-pages]');
  const matches = new Set(recipe.matches);
  const pageSize = 24;
  let current = 0;
  function drawPage() {
    const last = Math.ceil(recipe.candidates.length / pageSize) - 1;
    rows.innerHTML = `<table><thead><tr><th>配置</th><th>标称容量</th><th>带宽速度上限</th><th>筛选状态</th></tr></thead>
      <tbody>${recipe.candidates.slice(current * pageSize, (current + 1) * pageSize).map(item => `
      <tr><td>${item.count} × ${esc(item.gpu.name)}</td><td>${advisorNumber(item.nominal)} GB</td>
      <td>${item.speed == null ? '待核验' : advisorNumber(item.speed) + ' token/s'}</td>
      <td>${matches.has(item) ? '符合条件' : '仅容量参考'}</td></tr>`).join('')}</tbody></table>`;
    prev.disabled = current === 0;
    next.disabled = current === last;
    pages.textContent = `第 ${current + 1} / ${last + 1} 页`;
  }
  prev.onclick = () => { current--; drawPage(); };
  next.onclick = () => { current++; drawPage(); };
  drawPage();
}

function models() {
  const localFile = location.protocol === 'file:';
  const localHost = ['127.0.0.1', 'localhost'].includes(location.hostname);
  const hosted = document.body.dataset.hosted === 'true';
  const adminUrl = localFile || (localHost && location.port === '8765')
    ? 'http://127.0.0.1:8766/admin/aa'
    : localHost || hosted ? '/admin/aa' : '';
  const intro = `
    <section class="model-intro">
      <div><h1>模型对比</h1><p>挑选模型，查看 Artificial Analysis 的评测图表。</p></div>
      <div class="model-intro-links">
        <a class="outline model-origin" href="https://artificialanalysis.ai/zh" target="_blank" rel="noopener">查看 AA 原站 ↗</a>
        ${adminUrl ? `<a class="outline model-origin" href="${adminUrl}">AA 管理后台</a>` : ''}
      </div>
    </section>`;
  if (hosted && typeof AA_CHART_DATA === 'undefined') {
    $('#main').innerHTML = `${intro}
      <section class="panel aa-chart-panel"><p>评测数据请查看 Artificial Analysis 原站。</p></section>
      ${footer}`;
    return;
  }
  $('#main').innerHTML = `${intro}
    <div class="model-tools">
      <div class="segments model-scope" role="group" aria-label="模型范围">
        <button type="button" data-model-scope="local">可本地部署</button>
        <button type="button" data-model-scope="all">全部模型</button>
      </div>
      ${aaOfficial?.checkedAt ? `<label class="model-source">
        <span>评测数据</span>
        <select id="model-source">
          <option value="latest">最近同步</option>
          <option value="snapshot">原始快照</option>
        </select>
      </label>` : ''}
      <input id="model-query" type="search" aria-label="搜索模型" placeholder="搜索模型或厂商">
      <details class="aa-model-picker">
        <summary class="outline" id="aa-picker-toggle">选择模型</summary>
        <div class="aa-picker-list" id="aa-picker-list"></div>
      </details>
    </div>
    ${aaChartMarkup()}
    ${footer}`;

  let scope = 'local';
  const hiddenModels = new Set();
  const search = $('#model-query');
  const dataSource = $('#model-source');
  const picker = $('.aa-model-picker');
  const choices = $('#aa-picker-list');
  const updateCharts = initAACharts();
  const scopeButtons = document.querySelectorAll('[data-model-scope]');
  const catalog = AA_CHART_DATA.models;
  const availability = new Map(aaApiModels?.map(model => [model.id, model.weight]));

  function render(updateChoices = true) {
    const useLatest = dataSource?.value !== 'snapshot';
    const query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const available = catalog.filter(model =>
      scope === 'all' || ((useLatest ? availability.get(model.id) : undefined) ?? model.weight));
    const matches = available.filter(model => aaMatchesSearch(model, query));
    const visible = matches.filter(model => !hiddenModels.has(model.id));
    $('#aa-picker-toggle').textContent = `选择模型 · ${visible.length}/${matches.length}`;
    if (updateChoices) {
      choices.innerHTML = matches.length ? matches.map(model => `<label class="aa-picker-option">
        <input type="checkbox" data-aa-choice value="${esc(model.id)}" ${hiddenModels.has(model.id) ? '' : 'checked'}>
        <span>${esc(aaModelLabel(model))}<small>${esc(model.maker)}</small></span>
      </label>`).join('') : '<p class="small aa-picker-empty">没有匹配的 AA 型号。</p>';
    }
    scopeButtons.forEach(button => {
      const active = button.dataset.modelScope === scope;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateCharts(scope, query, hiddenModels, useLatest);
  }

  choices.addEventListener('change', event => {
    const input = event.target.closest('[data-aa-choice]');
    if (!input) return;
    if (input.checked) hiddenModels.delete(input.value);
    else hiddenModels.add(input.value);
    render(false);
  });
  scopeButtons.forEach(button => button.addEventListener('click', () => {
    scope = button.dataset.modelScope;
    render();
  }));
  search.addEventListener('input', () => {
    if (search.value.trim()) picker.open = true;
    render();
  });
  dataSource?.addEventListener('change', () => render());
  render();
}

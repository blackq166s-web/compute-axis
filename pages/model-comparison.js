function models() {
  $('#main').innerHTML = `
    <section class="model-intro">
      <div><h1>模型对比</h1><p><strong>示例数据</strong> · 型号、评分、耗时和成本均为虚构，用于演示筛选和图表。</p></div>
      <div class="model-intro-links">
        <a class="outline model-origin" href="https://artificialanalysis.ai/zh" target="_blank" rel="noopener">查看 AA 原站 ↗</a>

      </div>
    </section>
    <div class="model-tools">
      <div class="segments model-scope" role="group" aria-label="模型范围">
        <button type="button" data-model-scope="local">可本地部署</button>
        <button type="button" data-model-scope="all">全部模型</button>
      </div>
      <input id="model-query" type="search" aria-label="搜索模型" placeholder="搜索模型或厂商">
      <details class="comparison-model-picker">
        <summary class="outline" id="comparison-picker-toggle">选择模型</summary>
        <div class="comparison-picker-list" id="comparison-picker-list"></div>
      </details>
    </div>
    ${compareChartMarkup()}
    ${footer}`;

  let scope = 'local';
  const hiddenModels = new Set();
  const search = $('#model-query');
  const picker = $('.comparison-model-picker');
  const choices = $('#comparison-picker-list');
  const updateCharts = initModelCharts();
  const scopeButtons = document.querySelectorAll('[data-model-scope]');
  const catalog = MODEL_DEMO_DATA.models;

  function render(updateChoices = true) {
    const query = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const available = catalog.filter(model => scope === 'all' || model.weight);
    const matches = available.filter(model => compareMatchesSearch(model, query));
    const visible = matches.filter(model => !hiddenModels.has(model.id));
    $('#comparison-picker-toggle').textContent = `选择模型 · ${visible.length}/${matches.length}`;
    if (updateChoices) {
      choices.innerHTML = matches.length ? matches.map(model => `<label class="comparison-picker-option">
        <input type="checkbox" data-comparison-choice value="${esc(model.id)}" ${hiddenModels.has(model.id) ? '' : 'checked'}>
        <span>${esc(compareModelLabel(model))}<small>${esc(model.maker)}</small></span>
      </label>`).join('') : '<p class="small comparison-picker-empty">没有匹配的示例型号。</p>';
    }
    scopeButtons.forEach(button => {
      const active = button.dataset.modelScope === scope;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateCharts(scope, query, hiddenModels);
  }

  choices.addEventListener('change', event => {
    const input = event.target.closest('[data-comparison-choice]');
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
  render();
}

const captureDate = HARDWARE_SOURCE_DATE;
const hardwareColumns = [
  ['name', 'GPU'], ['architecture', 'Architecture'], ['memory', 'Memory'],
  ['bandwidth', 'Bandwidth'], ['fp8', 'FP8'], ['fp16', 'FP16'], ['tdp', 'TDP'],
];
const hardwareUnits = {memory:'GB', bandwidth:'GB/s', fp8:'TFLOPS', fp16:'TFLOPS', tdp:'W'};
const hardwareById = new Map(HARDWARE.map(row => [row.id, row]));
const hardwareView = {preset:'starter', picked:new Set(starterHardware), query:'', sort:null, asc:true, page:1, size:24};

function hardwareMatches(row, query) {
  const normalize = value => value.toLowerCase().replace(/[\s-]+/g, '');
  return normalize(`${hardwareModelName(row)} ${row.name} ${row.brand} ${row.originalName ?? ''}`).includes(normalize(query));
}

function hardwareMetric(row, key) {
  if (row[key] == null) return '—';
  return `${row[key].toLocaleString('zh-CN')} ${hardwareUnits[key]}`;
}

function detail(id) {
  const row = hardwareById.get(id);
  if (!row) return;
  const basis = hardwareMemoryBasis(row);
  const labels = {memory:isUnifiedHardware(row) ? '统一内存总量' : '显存容量', bandwidth:'带宽',
    fp8:'FP8 理论峰值', fp16:'FP16 理论峰值', tdp:'TDP / 设计功耗'};
  const provenance = `厂商规格 · ${captureDate} 核对`;
  $('#dialog-body').innerHTML = `<span class="badge">${esc(row.brand)}</span>
    <h2>${esc(row.name)}</h2>
    <p class="small">${esc(row.architecture || '架构未披露')}${basis ? ' · ' + basis : ''}</p>
    <div class="detail-grid">${Object.entries(labels).map(([key,label]) =>
      `<div class="metric"><span class="small">${label}</span><strong>${hardwareMetric(row,key)}</strong></div>`).join('')}</div>
    ${(row.sourceNotes || []).map(note => `<p class="notice">${esc(note)}</p>`).join('')}
    <p class="small">${provenance} · 理论规格</p>
    <a class="outline" href="${esc(row.source)}" target="_blank" rel="noopener">查看资料来源 ↗</a>`;
  $('#dialog').showModal();
}

function hardwareRows() {
  const rows = [...hardwareView.picked].map(id => hardwareById.get(id)).filter(row =>
    row && hardwareMatches(row, hardwareView.query));
  const {sort, asc} = hardwareView;
  if (!sort) return rows;
  return rows.sort((left, right) => {
    const a = sort === 'name' ? hardwareModelName(left) : left[sort];
    const b = sort === 'name' ? hardwareModelName(right) : right[sort];
    if (a == null) return b == null ? 0 : 1;
    if (b == null) return -1;
    return (typeof a === 'number' ? a - b : a.localeCompare(b, 'zh-CN', {numeric:true})) * (asc ? 1 : -1);
  });
}

function applyHardwareSelection(preset, rows) {
  Object.assign(hardwareView, {preset, picked:new Set(rows), query:'', sort:null, asc:true, page:1});
  $('#search').value = '';
  renderHardware();
}

function openHardwarePicker(group) {
  const label = hardwareGroups.find(([id]) => id === group)[1];
  const candidates = HARDWARE.filter(row => group === 'system'
    ? isUnifiedHardware(row) : !isUnifiedHardware(row) && row.tier === group);
  const candidateIds = new Set(candidates.map(row => row.id));
  const common = new Set(starterHardware.filter(id => candidateIds.has(id)));
  const commonRows = [...common].map(id => hardwareById.get(id));
  const picked = new Set(candidates.filter(row => hardwareView.picked.has(row.id)).map(row => row.id));
  const dialog = $('#dialog');
  $('#dialog-body').innerHTML = `<h2>${label}型号</h2>
    <input class="hardware-search" id="picker-search" type="search" aria-label="在${label}中搜索" placeholder="搜索型号或厂商">
    <div class="hardware-picker-tools">
      <button type="button" class="outline" id="picker-common">只选常见型号</button>
      <button type="button" class="textbutton" id="picker-clear">清空选择</button>
    </div>
    <div class="hardware-picker-list" id="picker-models" aria-label="${label}型号"></div>
    <div class="hardware-picker-actions">
      <span id="picker-count" aria-live="polite"></span>
      <button type="button" class="outline" id="picker-all">显示所有${label}</button>
      <button type="button" class="primary" id="picker-apply">应用筛选</button>
    </div>`;
  const search = $('#picker-search');
  const list = $('#picker-models');
  const count = () => { $('#picker-count').textContent = `已选 ${picked.size} 款`; };
  const option = row => `<label class="hardware-picker-option">
    <input type="checkbox" value="${esc(row.id)}" ${picked.has(row.id) ? 'checked' : ''}>
    ${transparentBrandIcon(row.brand)}
    <span class="hardware-option-name" title="${esc(row.name)}">${esc(hardwareModelName(row))}</span>
    <small>${esc(row.brand)} · ${hardwareMetric(row,'memory')}</small></label>`;
  function showOptions() {
    const query = search.value.trim();
    const matches = row => hardwareMatches(row, query);
    const groups = [
      ['常见型号', commonRows.filter(matches)],
      ['其他型号', candidates.filter(row => !common.has(row.id) && matches(row))],
    ];
    list.innerHTML = groups.filter(([, rows]) => rows.length).map(([name, rows]) =>
      `<h3 class="hardware-picker-label">${name}</h3>${rows.map(option).join('')}`).join('') ||
      '<p class="empty">没有匹配的型号。</p>';
    count();
  }
  list.addEventListener('change', event => {
    const input = event.target;
    if (input.checked) picked.add(input.value);
    else picked.delete(input.value);
    count();
  });
  search.addEventListener('input', showOptions);
  $('#picker-common').disabled = common.size === 0;
  $('#picker-common').onclick = () => {
    picked.clear();
    common.forEach(id => picked.add(id));
    search.value = '';
    showOptions();
    list.scrollTop = 0;
  };
  $('#picker-clear').onclick = () => {
    picked.clear();
    showOptions();
  };
  function apply(rows) {
    dialog.close();
    applyHardwareSelection(group, rows);
  }
  $('#picker-all').onclick = () => apply(candidates.map(row => row.id));
  $('#picker-apply').onclick = () => apply(candidates.filter(row => picked.has(row.id)).map(row => row.id));
  showOptions();
  dialog.showModal();
  search.focus();
}

function hardwarePagination(position) {
  return `<div class="table-pagination hardware-pagination hardware-pagination-${position}" data-hardware-pager hidden>
    <span class="small" data-page-status ${position === 'top' ? 'aria-live="polite"' : ''}></span>
    <div class="row">
      <select data-page-size aria-label="每页型号数，${position === 'top' ? '图表上方' : '规格表下方'}">${opts([[24,'每页 24 款'],[50,'每页 50 款'],[100,'每页 100 款']])}</select>
      <button type="button" class="outline" data-page-step="-1">上一页</button>
      <button type="button" class="outline" data-page-step="1">下一页</button>
    </div>
  </div>`;
}

function renderHardware() {
  const rows = hardwareRows();
  const pageCount = Math.max(1, Math.ceil(rows.length / hardwareView.size));
  hardwareView.page = Math.min(hardwareView.page, pageCount);
  const pageRows = rows.slice((hardwareView.page - 1) * hardwareView.size, hardwareView.page * hardwareView.size);
  renderHardwareCharts(pageRows);

  $('#shown-count').textContent = `${rows.length} 款型号`;
  document.querySelectorAll('[data-hardware-group]').forEach(button => {
    const active = button.dataset.hardwareGroup === hardwareView.preset;
    button.classList.toggle('on', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const first = (hardwareView.page - 1) * hardwareView.size + 1;
  const range = `显示第 ${first}–${first + pageRows.length - 1} 款，共 ${rows.length} 款`;
  document.querySelectorAll('[data-hardware-pager]').forEach(pager => {
    pager.hidden = rows.length <= 24;
    pager.querySelector('[data-page-status]').textContent = rows.length ? range : '';
    pager.querySelector('[data-page-step="-1"]').disabled = hardwareView.page === 1;
    pager.querySelector('[data-page-step="1"]').disabled = hardwareView.page === pageCount;
    pager.querySelector('[data-page-size]').value = hardwareView.size;
  });
  $('#columns').innerHTML = `<tr>${hardwareColumns.map(([key,label]) => {
    const active = hardwareView.sort === key;
    return `<th scope="col" ${active ? `aria-sort="${hardwareView.asc ? 'ascending' : 'descending'}"` : ''}>
      <button type="button" class="sort" data-sort="${key}">${label}${active ? (hardwareView.asc ? ' ↑' : ' ↓') : ''}</button></th>`;
  }).join('')}</tr>`;
  $('#rows').innerHTML = pageRows.map(row => {
    const basis = hardwareMemoryBasis(row);
    return `<tr data-hardware-row="${esc(row.id)}">
      <td><div class="product-cell">${transparentBrandIcon(row.brand)}
        <div class="hardware-model-cell"><button type="button" class="model-name" data-detail="${esc(row.id)}" title="${esc(row.name)}">${esc(hardwareModelName(row))}</button>
        ${basis ? `<small class="hardware-basis">${basis}</small>` : ''}</div>
      </div></td>
      <td>${esc(row.architecture ?? '—')}</td>
      ${hardwareColumns.slice(2).map(([key]) => `<td>${hardwareMetric(row, key)}</td>`).join('')}
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty">没有符合条件的型号。</td></tr>';
}

function hardware() {
  $('#main').innerHTML = `
    <section class="hardware-intro">
      <h1>硬件对比</h1>
      <div class="hardware-filter-row">
        <input id="search" class="hardware-search" type="search" aria-label="筛选当前型号" placeholder="筛选当前型号或厂商">
        <div class="segments" aria-label="硬件型号筛选" role="group">
          ${[['starter','常见型号'], ...hardwareGroups, ['all','全部型号']].map(([key,label]) =>
            `<button type="button" data-hardware-group="${key}" ${hardwareGroups.some(([id]) => id === key) ? 'aria-haspopup="dialog"' : ''}>${label}</button>`).join('')}
        </div>
      </div>
    </section>
    ${hardwarePagination('top')}
    ${hardwareChartsMarkup()}
    <section class="panel full-catalog" id="hardware-catalog" aria-labelledby="catalog-heading">
      <div class="panel-head row between"><h2 id="catalog-heading">硬件规格</h2><span class="small" id="shown-count" aria-live="polite"></span></div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="硬件规格表"><table class="hardware-table"><thead id="columns"></thead><tbody id="rows"></tbody></table></div>
      ${hardwarePagination('bottom')}
      <div class="chart-footer">当前为小范围示例目录，可以在型号详情打开厂商规格。</div>
    </section>` + footer;

  $('#main').addEventListener('click', event => {
    const pagination = event.target.closest('[data-page-step]');
    if (pagination) {
      hardwareView.page += Number(pagination.dataset.pageStep);
      return renderHardware();
    }
    const model = event.target.closest('[data-detail]');
    if (model) return detail(model.dataset.detail);
    const control = event.target.closest('[data-hardware-group]');
    if (control) {
      const group = control.dataset.hardwareGroup;
      if (group === 'starter') applyHardwareSelection(group, starterHardware);
      else if (group === 'all') applyHardwareSelection(group, HARDWARE.map(row => row.id));
      else openHardwarePicker(group);
    }
    const sorter = event.target.closest('[data-sort]');
    if (sorter) {
      const sort = sorter.dataset.sort;
      hardwareView.asc = hardwareView.sort === sort ? !hardwareView.asc : ['name','architecture'].includes(sort);
      hardwareView.sort = sort;
      hardwareView.page = 1;
      renderHardware();
      document.querySelector(`[data-sort="${sort}"]`).focus();
    }
  });
  $('#search').oninput = event => {
    hardwareView.query = event.target.value.trim();
    hardwareView.page = 1;
    renderHardware();
  };
  $('#main').addEventListener('change', event => {
    if (!event.target.matches('[data-page-size]')) return;
    hardwareView.size = Number(event.target.value);
    hardwareView.page = 1;
    renderHardware();
  });
  const plots = hardwareCharts.map(({plot}) => document.getElementById(plot));
  const observer = new ResizeObserver(entries => entries.forEach(({target}) => updateHardwareChartOverflow(target)));
  plots.forEach(plot => observer.observe(plot));
  renderHardware();
  const item = new URLSearchParams(location.search).get('item');
  if (item) detail(item);
}

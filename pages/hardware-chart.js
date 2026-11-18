const hardwareGroups = [
  ['consumer', '消费级'], ['workstation', '工作站级'], ['enterprise', '企业级'], ['system', '统一内存'],
];

const starterHardware = ['4060', '4090', '5090', 'p6000', 'h200', 'spark'];

function isUnifiedHardware(row) {
  return row.type === 'system' || row.memoryKind === 'unified';
}

function hardwareMemoryBasis(row) {
  if (isUnifiedHardware(row)) return '统一内存';
  return row.acceleratorCount > 1 ? `${row.acceleratorCount} GPU 合计` : '';
}

function hardwareModelName(row) {
  return row.name.replace(/^(GeForce|Radeon) /, '')
    .replace(/^(RTX PRO \d+) Blackwell (.*?)(?: Edition)?$/, '$1 $2')
    .replace(/ Workstation(?: Edition)?$/, '')
    .replace(/\bServer(?: Edition)?\b/, '服务器版')
    .replace(/ \d+(?:\.\d+)?GB$/, '');
}

const hardwareCharts = [
  {key:'memory', title:'显存对比', heading:'featured-heading', plot:'featured-plot',
    note:'容量单位 GB。统一内存为 CPU 和 GPU 共享的总量，多 GPU 以模组合计显示。'},
  {key:'bandwidth', title:'内存带宽对比', heading:'bandwidth-heading', plot:'bandwidth-plot',
    note:'带宽单位 GB/s。统一内存和多 GPU 沿用各平台的规格口径。「—」表示数据缺失。'},
];

function hardwareChartsMarkup() {
  return hardwareCharts.map(({title,heading,plot,note}) => `<section class="panel featured-chart" aria-labelledby="${heading}" data-scale="expanded">
    <div class="panel-head row between">
      <h2 id="${heading}">${title}</h2>
      <div class="chart-scale-controls">
        <span class="small" data-chart-scroll-hint hidden>横向滑动查看更多型号</span>
        <div class="segments" role="group" aria-label="${title}的纵轴刻度">
          <button type="button" data-chart-scale="expanded" aria-pressed="true" class="on">低值放大</button>
          <button type="button" data-chart-scale="linear" aria-pressed="false">线性刻度</button>
        </div>
      </div>
    </div>
    <div id="${plot}" class="memory-scroll" tabindex="0" role="region" aria-label="${title}图" aria-describedby="${plot}-note"></div>
    <div class="chart-footer" id="${plot}-note">${note}<span data-chart-scale-note> 低值放大使用平方根刻度，请按柱顶数字读数。</span></div>
  </section>`).join('');
}

function updateHardwareChartOverflow(plot) {
  const hint = plot.closest('.featured-chart').querySelector('[data-chart-scroll-hint]');
  hint.hidden = plot.scrollWidth <= plot.clientWidth;
}

function renderHardwareCharts(rows) {
  for (const {key,plot} of hardwareCharts) {
    const element = document.getElementById(plot);
    const chart = element.closest('.featured-chart');
    element.scrollLeft = 0;
    drawHardwareChart(chart, element, rows, key);
    chart.querySelectorAll('[data-chart-scale]').forEach(button => {
      button.onclick = () => {
        if (chart.dataset.scale === button.dataset.chartScale) return;
        chart.dataset.scale = button.dataset.chartScale;
        drawHardwareChart(chart, element, rows, key);
      };
    });
  }
}

function drawHardwareChart(chart, plot, rows, key) {
  const expanded = chart.dataset.scale === 'expanded';
  const scroll = plot.scrollLeft;
  plot.innerHTML = hardwareChartColumns(rows, key, expanded);
  plot.scrollLeft = scroll;
  updateHardwareChartOverflow(plot);
  chart.querySelector('[data-chart-scale-note]').hidden = !expanded;
  chart.querySelectorAll('[data-chart-scale]').forEach(button => {
    const selected = chart.dataset.scale === button.dataset.chartScale;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function hardwareChartColumns(rows, key, expanded) {
  if (!rows.length) return '<p class="empty">没有符合条件的型号。</p>';

  const maximum = Math.max(1, ...rows.map(row => row[key] ?? 0));
  const magnitude = 10 ** Math.floor(Math.log10(maximum / 4));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find(value => value * magnitude * 4 >= maximum) * magnitude;
  const ceiling = 4 * step;
  const percent = value => (expanded ? Math.sqrt(value / ceiling) : value / ceiling) * 100;
  const ticks = Array.from({length:5}, (_, index) => {
    const value = expanded && index < 4 ? Number((ceiling * (index / 4) ** 2).toPrecision(2)) : index * step;
    return `<span style="bottom:${percent(value)}%"><b>${value.toLocaleString('zh-CN')}</b></span>`;
  }).join('');

  return `<div class="memory-columns" style="--models:${rows.length}">
    <div class="memory-grid" aria-hidden="true">${ticks}</div>
    ${rows.map(row => {
      const fullName = row.name;
      const basis = hardwareMemoryBasis(row);
      const amount = row[key];
      const value = amount == null ? '—' : amount.toLocaleString('zh-CN');
      const reported = amount == null ? '规格未披露' : `${value} ${hardwareUnits[key]}`;
      const cap = percent(amount ?? 0);
      return `<button type="button" class="memory-column" data-detail="${esc(row.id)}"
        title="${esc(fullName)} · ${reported}${basis ? ' · ' + basis : ''}"
        aria-label="查看 ${esc(fullName)}，${reported}${basis ? '，' + basis : ''}"
        style="--brand:${hardwareBrandColors[row.brand] ?? '#888'};--capacity:${cap}%">
        <span class="memory-plot ${isUnifiedHardware(row) ? 'memory-unified' : ''}">
          ${amount == null ? '' : '<span class="memory-fill" aria-hidden="true"></span>'}<strong>${value}</strong>
        </span>
        <span class="memory-column-label">${esc(hardwareModelName(row))}${basis ? `<small>${basis}</small>` : ''}</span>
      </button>`;
    }).join('')}
  </div>`;
}

const compareViews = ['intelligence', 'task', 'value', 'capabilities'];
const compareMeasures = {
  score: {title:'示例综合评分', hint:'同一版本下的综合评测，高分代表表现更好。', format:value=>String(value)},
  cost: {title:'每任务成本', hint:'示例任务的 API 成本，单位为美元。', format:value=>`$${value.toFixed(2)}`},
  minutes: {title:'每任务耗时', hint:'示例任务所需时间。', format:value=>`${value.toFixed(1)} 分钟`},
  tokens: {title:'每任务输出 Token 数', hint:'完成示例任务产生的输出 Token 数。',
    format:value=>value.toLocaleString('zh-CN')},
};
const compareCostParts = [
  ['答案','#7c77ed'], ['推理','#6266b7'], ['缓存写入','#367b95'], ['缓存命中','#438e9c'], ['输入','#78a7a5'],
];
const compareModelLabel = model => model.name + (model.effort ? ` (${model.effort})` : '');
const compareMatchesSearch = (model, query) => {
  const value = `${compareModelLabel(model)} ${model.maker}`.toLowerCase().replace(/[\s-]/g, '');
  return query.every(word => value.includes(word.replace(/-/g, '')));
};
const compareFormat = (measure, value) => compareMeasures[measure].format(value);

function compareChartMarkup() {
  return compareViews.map(view => `<section class="panel comparison-chart-panel" data-comparison-panel="${view}" aria-labelledby="comparison-title-${view}">
    <div class="comparison-heading">
      <div><h2 id="comparison-title-${view}" data-comparison-title></h2><p class="small" data-comparison-description></p></div>
      ${view === 'task' ? `<div class="segments comparison-task-tabs" role="group" aria-label="任务指标">
        ${['cost','minutes','tokens'].map(key=>`<button type="button" data-comparison-task="${key}">${compareMeasures[key].title}</button>`).join('')}
      </div>` : ''}
    </div>
    <div class="comparison-chart-content"></div>
    <div class="comparison-inspect small" aria-live="polite"></div>
    <div class="comparison-footer small">
      <span data-comparison-footnote></span>
    </div>
  </section>`).join('');
}

function compareBars(rows, measure) {
  const highFirst = measure === 'score';
  const format = value => compareFormat(measure, value);
  rows.sort((a,b)=>highFirst ? b[measure]-a[measure] : a[measure]-b[measure]);
  const largest = Math.max(1, ...rows.map(model=>model[measure]));
  const power = 10 ** Math.floor(Math.log10(largest / 4));
  const step = [1,2,2.5,5,10].find(value => value * power * 4 >= largest) * power;
  const max = highFirst ? Math.max(70, Math.ceil(largest / 10) * 10) : step * 4;
  const tickStep = highFirst ? 20 : step;
  const ticks = Array.from({length:Math.floor(max / tickStep) + 1}, (_, i) => tickStep * i);
  const hasParts = measure === 'cost' && rows.some(model=>model.parts);
  const legend = hasParts ? `<div class="comparison-key comparison-cost-key">${compareCostParts.map(([name,color])=>
    `<span style="--series:${color}"><i></i>${name}</span>`).join('')}<span>单色条仅有总价</span></div>` : '';
  return legend + `<p class="small comparison-scroll-hint">左右滑动查看完整图表</p>
    <div class="comparison-plot-scroll" tabindex="0" role="region" aria-label="${compareMeasures[measure].title}柱状图">
    <div class="comparison-columns" style="--count:${rows.length};--min-chart:${56 + rows.length * 82}px">
    <div class="comparison-column-grid" aria-hidden="true">${ticks.map(value =>
      `<span style="bottom:${value / max * 100}%"><b>${measure === 'cost' ? '$' : ''}${value.toLocaleString('zh-CN')}</b></span>`).join('')}</div>
    ${rows.map(model => {
    const parts = hasParts && model.parts;
    const sum = parts ? parts.reduce((a,b)=>a+b,0) : 0;
    const fill = sum ? parts.map((value,index)=>
      `<i style="height:${value/sum*100}%;background:${compareCostParts[index][1]}"></i>`).join('') : '';
    return `<button type="button" class="comparison-bar" data-comparison-inspect="${model.id}" style="--series:${model.color}"
      aria-label="${esc(compareModelLabel(model))}，${format(model[measure])}">
      <span class="comparison-column-plot" style="--bar-height:${model[measure]/max*100}%">
        <span class="comparison-fill ${parts ? 'stacked' : ''}" aria-hidden="true">${fill}</span>
        <strong>${format(model[measure])}</strong>
      </span>
      <span class="comparison-column-label" title="${esc(compareModelLabel(model))}">${compareModelBadge(model)}${esc(compareModelLabel(model))}</span>
    </button>`;
  }).join('')}</div></div>`;
}

function compareModelBadge(model) {
  return `<span class="comparison-brand" aria-hidden="true">${transparentBrandIcon(model.maker)}</span>`;
}

function compareSeriesKey(rows) {
  return `<div class="comparison-key">${rows.map(model=>`<button type="button" class="comparison-series-name"
    data-comparison-inspect="${model.id}" style="--series:${model.color}"><i aria-hidden="true"></i>${compareModelBadge(model)}${esc(compareModelLabel(model))}</button>`).join('')}</div>`;
}

function compareMedian(values) {
  const ordered = values.slice().sort((a,b)=>a-b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function compareLabelPositions(points, bounds) {
  const placed = [];
  return points.map(point => {
    const label = point.model.name;
    const width = Math.max(26, label.length * 6.25);
    const { x, y } = point;
    const candidates = [[x+12,y+4],[x-width-12,y+4],[x-width/2,y-12],[x-width/2,y+19]];
    const slot = candidates.find(([left, bottom]) => {
      if (left < bounds.left || left + width > bounds.right || bottom < bounds.top + 10 || bottom > bounds.bottom) return false;
      return placed.every(box => left + width + 4 < box.left || left > box.right + 4 ||
        bottom < box.bottom - 14 || bottom > box.bottom + 14);
    });
    if (!slot) return '';
    const [left,bottom] = slot;
    placed.push({left, right:left+width, bottom});
    return `<text class="comparison-point-label" x="${left}" y="${bottom}">${esc(label)}</text>`;
  });
}

function compareValuePlot(rows) {
  const width = 1000, height = 360, left = 58, right = 974, top = 27, bottom = 310;
  const low = Math.min(...rows.map(model=>model.cost)) / 1.22;
  const high = Math.max(...rows.map(model=>model.cost)) * 1.22;
  const x = value => left + Math.log(value / low) / Math.log(high / low) * (right - left);
  const ceiling = Math.ceil(Math.max(70, ...rows.map(model=>model.score)) / 10) * 10;
  const y = value => bottom - value / ceiling * (bottom - top);
  const yGrid = Array.from({length:ceiling / 10 + 1}, (_, i) => i * 10).map(value =>
    `<path class="comparison-grid" d="M${left},${y(value)}H${right}"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end">${value}</text>`).join('');
  const xGrid = [0.1,0.2,0.5,1,2,5,10,20,40,100].filter(value=>value>=low && value<=high).map(value =>
    `<path class="comparison-grid" d="M${x(value)},${top}V${bottom}"/><text x="${x(value)}" y="${bottom+19}" text-anchor="middle">$${value}</text>`).join('');
  let best = -Infinity;
  const frontier = rows.slice().sort((a,b)=>a.cost-b.cost || b.score-a.score).filter(model => {
    if (model.score <= best) return false;
    best = model.score;
    return true;
  });
  const frontierPath = frontier.map((model,index)=>`${index ? 'L' : 'M'}${x(model.cost)},${y(model.score)}`).join('');
  const splitX = x(compareMedian(rows.map(model=>model.cost)));
  const splitY = y(compareMedian(rows.map(model=>model.score)));
  const coordinates = rows.slice().sort((a,b)=>b.score-a.score).map(model=>({model, x:x(model.cost), y:y(model.score)}));
  const labels = compareLabelPositions(coordinates,{left, right, top, bottom});
  const points = coordinates.map(({model,x:cx,y:cy},index) => `<g role="button" tabindex="0" class="comparison-marker" data-comparison-inspect="${model.id}"
    aria-label="${esc(compareModelLabel(model))}，智能指数 ${model.score}，${compareMeasures.cost.format(model.cost)} 每任务">
    <circle cx="${cx}" cy="${cy}" r="13" fill="transparent"/>
    <circle class="comparison-dot" cx="${cx}" cy="${cy}" r="7" fill="${model.color}"/>
    ${labels[index]}
    <title>${esc(compareModelLabel(model))} · ${model.score} · ${compareMeasures.cost.format(model.cost)}</title>
  </g>`).join('');
  return `<div class="comparison-value-key small"><span class="comparison-key-quadrant">低成本、高分区域</span><span class="comparison-key-frontier">成本效益前沿</span></div>
  <p class="small comparison-scroll-hint">左右滑动查看完整图表</p><div class="comparison-plot-scroll" tabindex="0" role="region" aria-label="成本散点图区"><svg class="comparison-plot comparison-scatter" viewBox="0 0 ${width} ${height}" role="group" aria-label="示例综合评分和每任务成本散点图">
    <rect class="comparison-quadrant" x="${left}" y="${top}" width="${splitX-left}" height="${splitY-top}"/>
    ${yGrid}${xGrid}<path class="comparison-frontier" d="${frontierPath}"/>${points}
    <text x="${left}" y="17">示例综合评分</text>
    <text x="${right}" y="353" text-anchor="end">每任务成本（美元 · 对数刻度） →</text>
  </svg></div>${compareSeriesKey(rows)}`;
}

function compareRankPlot(rows) {
  const width = 1000, left = 75, right = 925, top = 49;
  const maximum = Math.max(3,...rows.flatMap(model=>model.ranks));
  const height = Math.max(252, top + maximum * 25 + 18);
  const bottom = height - 20;
  const x = i => left + i * (right-left) / (MODEL_DEMO_DATA.domains.length-1);
  const y = rank => top + (rank-1) / (maximum-1) * (bottom-top);
  const ticks = Array.from({length:maximum},(_,i)=>i+1);
  const guides = ticks.map(rank=>`<path class="comparison-grid" d="M${left},${y(rank)}H${right}"/>
    <text x="${left-13}" y="${y(rank)+4}" text-anchor="end">${rank}</text>`).join('');
  const labels = MODEL_DEMO_DATA.domains.map((name,index)=>
    `<text x="${x(index)}" y="21" text-anchor="middle">${name}</text>`).join('');
  const paths = rows.map(model => {
    const points = model.ranks.map((rank,index)=>rank == null ? null : [x(index),y(rank)]);
    const path = points.map((point,index)=>{
      if (!point) return '';
      const [px,py] = point;
      const previous = points[index-1];
      if (!previous) return `M${px},${py}`;
      const [previousX,previousY] = previous;
      const mid = (previousX+px)/2;
      return `C${mid},${previousY} ${mid},${py} ${px},${py}`;
    }).join('');
    const dots = points.map((point,index) => {
      if (!point) return '';
      const rank = model.ranks[index];
      const [px,py] = point;
      return `<circle class="comparison-rank-dot" cx="${px}" cy="${py}" r="${rank <= 4 ? 9 : 4.5}" fill="${model.color}">
        <title>${esc(model.name)} · ${MODEL_DEMO_DATA.domains[index]}第 ${rank} 名</title></circle>
        ${rank <= 4 ? `<text class="comparison-rank-number" x="${px}" y="${py+3}" text-anchor="middle">${rank}</text>` : ''}`;
    }).join('');
    return `<g class="comparison-rank-series comparison-marker" data-comparison-inspect="${model.id}" tabindex="0" role="button"
      aria-label="${esc(compareModelLabel(model))}各项排名：${model.ranks.map(rank=>rank ?? '缺分').join('、')}">
      <path class="comparison-rank-hit" d="${path}"/><path class="comparison-rank-line" d="${path}" stroke="${model.color}"/>${dots}</g>`;
  }).join('');
  return `<p class="small comparison-scroll-hint">左右滑动查看完整图表</p><div class="comparison-plot-scroll" tabindex="0" role="region" aria-label="六领域排名图区"><svg class="comparison-plot comparison-ranks" viewBox="0 0 ${width} ${height}" role="group" aria-label="六领域能力排名走势">
    ${guides}${labels}${paths}</svg></div>${compareSeriesKey(rows)}`;
}

function compareRankedModels(models) {
  const rated = models.filter(model => model.capabilityScores?.some(score => score != null));
  return rated.map(model => ({
    ...model,
    rankedByScore: true,
    ranks: model.capabilityScores.map((score, domain) => score == null ? null :
      1 + rated.filter(other => other.capabilityScores[domain] != null &&
        other.capabilityScores[domain] > score).length),
  }));
}

function initModelChart(panel) {
  const view = panel.dataset.comparisonPanel;
  const output = panel.querySelector('.comparison-chart-content');
  const inspect = panel.querySelector('.comparison-inspect');
  let measure = 'cost';
  let scope = 'local';
  let query = [];
  let hiddenModels = new Set();
  let shown = [];
  let pinned = '';

  function showDetails(id) {
    const model = shown.find(row=>row.id===id);
    panel.querySelectorAll('[data-comparison-inspect]').forEach(element => {
      element.classList.toggle('comparison-active', Boolean(model) && element.dataset.comparisonInspect === id);
      element.classList.toggle('comparison-muted', Boolean(model) && element.dataset.comparisonInspect !== id);
      element.setAttribute('aria-pressed', String(pinned === element.dataset.comparisonInspect));
    });
    inspect.hidden = shown.length === 0;
    if (!model) { inspect.textContent = '悬停、聚焦或点按型号查看数值。'; return; }
    const items = [];
    if (view === 'capabilities') {
      model.ranks.forEach((rank,i)=>{
        const score = model.rankedByScore ? model.capabilityScores[i] : null;
        const result = rank == null ? '待核对' : `#${rank}${score == null ? '' : `（${score} 分）`}`;
        items.push(`${MODEL_DEMO_DATA.domains[i]} ${result}`);
      });
      if (model.rankEffort) items.push(model.rankEffort);
    } else {
      if (view === 'intelligence' || view === 'value') items.push(`示例评分 ${model.score}`);
      if (view === 'value') items.push(`每任务 ${compareMeasures.cost.format(model.cost)}`);
      if (view === 'task') items.push(`${compareMeasures[measure].title} ${compareFormat(measure,model[measure])}`);
      if (view === 'task' && measure === 'cost' && model.parts) {
        model.parts.forEach((value,i)=>items.push(`${compareCostParts[i][0]} $${value.toFixed(i===4 ? 4 : 2)}`));
      }
    }
    inspect.innerHTML = `<strong>${esc(compareModelLabel(model))}</strong><span>${esc(items.join(' · '))}</span>`;
  }

  function render() {
    const rankView = view === 'capabilities';
    const cohort = MODEL_DEMO_DATA.models.filter(model => scope === 'all' || model.weight);
    const ranked = rankView ? compareRankedModels(cohort) : cohort;
    const selected = ranked.filter(model => !hiddenModels.has(model.id) && compareMatchesSearch(model, query));
    const metric = view === 'task' ? measure : 'score';
    shown = selected.filter(model=>{
      if (view === 'value') return model.score != null && model.cost > 0;
      if (view === 'capabilities') return Array.isArray(model.ranks);
      return model[metric] != null;
    });
    panel.querySelectorAll('[data-comparison-task]').forEach(button=>{
      const active = button.dataset.comparisonTask === measure;
      button.classList.toggle('on',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const rankHint = '示例模型按各领域的虚构分数排名。搜索仅改变显示范围。';
    const headline = view === 'value' ? ['示例评分与每任务成本','点越靠左成本越低，越靠上评分越高。虚线连接当前样本的成本效益前沿。']
      : rankView ? ['六领域能力排名',rankHint]
      : [compareMeasures[metric].title,compareMeasures[metric].hint];
    panel.querySelector('[data-comparison-title]').textContent = headline[0];
    panel.querySelector('[data-comparison-description]').textContent = headline[1];
    panel.querySelector('[data-comparison-footnote]').textContent = `${shown.length} / ${selected.length} 款有示例数据`;
    let content = '';
    if (shown.length) {
      if (view === 'value') content = compareValuePlot(shown);
      else if (view === 'capabilities') content = compareRankPlot(shown);
      else content = compareBars(shown,metric);
    } else {
      content = '<p class="comparison-empty">当前范围暂无符合条件的示例数据。</p>';
    }
    output.innerHTML = content;
    if (!shown.some(model=>model.id===pinned)) pinned='';
    showDetails(pinned);
  }

  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-comparison-task]');
    if (button) {
      measure=button.dataset.comparisonTask;
      pinned='';
      render();
      return;
    }
    const target=event.target.closest('[data-comparison-inspect]');
    if (target) {
      pinned=pinned===target.dataset.comparisonInspect ? '' : target.dataset.comparisonInspect;
      showDetails(pinned);
    }
  });
  output.addEventListener('keydown',event=>{
    const target=event.target.closest('g[data-comparison-inspect]');
    if (!target || !['Enter',' '].includes(event.key)) return;
    event.preventDefault();
    pinned=pinned===target.dataset.comparisonInspect ? '' : target.dataset.comparisonInspect;
    showDetails(pinned);
  });
  for (const type of ['pointerover','focusin']) output.addEventListener(type,event=>{
    const target=event.target.closest('[data-comparison-inspect]');
    if (target) showDetails(target.dataset.comparisonInspect);
  });
  output.addEventListener('pointerleave',()=>showDetails(pinned));
  output.addEventListener('focusout',event=>{
    if (!output.contains(event.relatedTarget)) showDetails(pinned);
  });
  return (modelScope,words,excluded)=>{
    scope=modelScope;
    query=words;
    hiddenModels=excluded;
    render();
  };
}

function initModelCharts() {
  const update = Array.from(document.querySelectorAll('[data-comparison-panel]'), initModelChart);
  return (scope, query, excluded) => update.forEach(render => render(scope, query, excluded));
}

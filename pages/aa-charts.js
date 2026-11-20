const aaViews = ['intelligence', 'task', 'value', 'capabilities'];
const aaMeasures = {
  score: {title:'AA 智能指数', hint:'同一版本下的综合评测，高分代表表现更好。', format:value=>String(value)},
  cost: {title:'每任务成本', hint:'AA 评测任务的加权平均 API 成本，单位为美元。', format:value=>`$${value.toFixed(2)}`},
  minutes: {title:'每任务耗时', hint:'AA 在评测所用 API 环境下的加权平均耗时。', format:value=>`${value.toFixed(1)} 分钟`},
  tokens: {title:'每任务输出 Token 数', hint:'完成一项 AA 智能指数评测任务平均产生的输出 Token，包含答案和推理。',
    format:value=>value.toLocaleString('zh-CN')},
};
const aaCostParts = [
  ['答案','#7c77ed'], ['推理','#6266b7'], ['缓存写入','#367b95'], ['缓存命中','#438e9c'], ['输入','#78a7a5'],
];
const aaModelLabel = model => model.name + (model.effort ? ` (${model.effort})` : '');
const aaMatchesSearch = (model, query) => {
  const value = `${aaModelLabel(model)} ${model.maker}`.toLowerCase().replace(/[\s-]/g, '');
  return query.every(word => value.includes(word.replace(/-/g, '')));
};
const aaBaseline = new Map(AA_CHART_DATA.models.map(model => [model.id, model]));
const aaOfficial = AA_OFFICIAL_DATA.api;
const aaCapabilityPatch = AA_OFFICIAL_DATA.capabilityPatch;
const aaTokens = AA_OFFICIAL_DATA.tokenUse;
const aaApiModels = aaOfficial?.models.map(row => {
  const { id, name, effort, maker, color } = aaBaseline.get(row.id);
  return { id, name, effort, maker, color, ...row, source: `https://artificialanalysis.ai/models/${row.slug}` };
});
const aaTokenModels = aaTokens?.models.map(row => {
  const official = aaApiModels?.find(model => model.id === row.id);
  return { ...aaBaseline.get(row.id), weight: official?.weight ?? aaBaseline.get(row.id).weight,
    tokens: row.tokens, source: row.source, defaultFallback: row.defaultFallback };
}) ?? [];
const aaFormat = (measure, value) =>
  (measure === 'tokens' && aaTokens?.kind === 'comparison' ? '约 ' : '') + aaMeasures[measure].format(value);

function aaChartMarkup() {
  return aaViews.map(view => `<section class="panel aa-chart-panel" data-aa-panel="${view}" aria-labelledby="aa-title-${view}">
    <div class="aa-heading">
      <div><h2 id="aa-title-${view}" data-aa-title></h2><p class="small" data-aa-description></p></div>
      ${view === 'task' ? `<div class="segments aa-task-tabs" role="group" aria-label="任务指标">
        ${['cost','minutes','tokens'].map(key=>`<button type="button" data-aa-task="${key}">${aaMeasures[key].title}</button>`).join('')}
      </div>` : ''}
    </div>
    <div class="aa-chart-content"></div>
    <div class="aa-inspect small" aria-live="polite"></div>
    <div class="aa-footer small">
      <span data-aa-footnote></span>
      <a data-aa-source href="${AA_CHART_DATA.source}" target="_blank" rel="noopener">Artificial Analysis 来源 ↗</a>
    </div>
  </section>`).join('');
}

function aaBars(rows, measure) {
  const highFirst = measure === 'score';
  const format = value => aaFormat(measure, value);
  rows.sort((a,b)=>highFirst ? b[measure]-a[measure] : a[measure]-b[measure]);
  const largest = Math.max(1, ...rows.map(model=>model[measure]));
  const power = 10 ** Math.floor(Math.log10(largest / 4));
  const step = [1,2,2.5,5,10].find(value => value * power * 4 >= largest) * power;
  const max = highFirst ? Math.max(70, Math.ceil(largest / 10) * 10) : step * 4;
  const tickStep = highFirst ? 20 : step;
  const ticks = Array.from({length:Math.floor(max / tickStep) + 1}, (_, i) => tickStep * i);
  const hasParts = measure === 'cost' && rows.some(model=>model.parts);
  const legend = hasParts ? `<div class="aa-key aa-cost-key">${aaCostParts.map(([name,color])=>
    `<span style="--series:${color}"><i></i>${name}</span>`).join('')}<span>单色条仅有总价</span></div>` : '';
  return legend + `<p class="small aa-scroll-hint">左右滑动查看完整图表</p>
    <div class="aa-plot-scroll" tabindex="0" role="region" aria-label="${aaMeasures[measure].title}柱状图">
    <div class="aa-columns" style="--count:${rows.length};--min-chart:${56 + rows.length * 82}px">
    <div class="aa-column-grid" aria-hidden="true">${ticks.map(value =>
      `<span style="bottom:${value / max * 100}%"><b>${measure === 'cost' ? '$' : ''}${value.toLocaleString('zh-CN')}</b></span>`).join('')}</div>
    ${rows.map(model => {
    const parts = hasParts && model.parts;
    const sum = parts ? parts.reduce((a,b)=>a+b,0) : 0;
    const fill = sum ? parts.map((value,index)=>
      `<i style="height:${value/sum*100}%;background:${aaCostParts[index][1]}"></i>`).join('') : '';
    return `<button type="button" class="aa-bar" data-aa-inspect="${model.id}" style="--series:${model.color}"
      aria-label="${esc(aaModelLabel(model))}，${format(model[measure])}">
      <span class="aa-column-plot" style="--bar-height:${model[measure]/max*100}%">
        <span class="aa-fill ${parts ? 'stacked' : ''}" aria-hidden="true">${fill}</span>
        <strong>${format(model[measure])}</strong>
      </span>
      <span class="aa-column-label" title="${esc(aaModelLabel(model))}">${aaModelBadge(model)}${esc(aaModelLabel(model))}</span>
    </button>`;
  }).join('')}</div></div>`;
}

function aaModelBadge(model) {
  return `<span class="aa-brand" aria-hidden="true">${transparentBrandIcon(model.maker)}</span>`;
}

function aaSeriesKey(rows) {
  return `<div class="aa-key">${rows.map(model=>`<button type="button" class="aa-series-name"
    data-aa-inspect="${model.id}" style="--series:${model.color}"><i aria-hidden="true"></i>${aaModelBadge(model)}${esc(aaModelLabel(model))}</button>`).join('')}</div>`;
}

function aaMedian(values) {
  const ordered = values.slice().sort((a,b)=>a-b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function aaLabelPositions(points, bounds) {
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
    return `<text class="aa-point-label" x="${left}" y="${bottom}">${esc(label)}</text>`;
  });
}

function aaValuePlot(rows) {
  const width = 1000, height = 360, left = 58, right = 974, top = 27, bottom = 310;
  const low = Math.min(...rows.map(model=>model.cost)) / 1.22;
  const high = Math.max(...rows.map(model=>model.cost)) * 1.22;
  const x = value => left + Math.log(value / low) / Math.log(high / low) * (right - left);
  const ceiling = Math.ceil(Math.max(70, ...rows.map(model=>model.score)) / 10) * 10;
  const y = value => bottom - value / ceiling * (bottom - top);
  const yGrid = Array.from({length:ceiling / 10 + 1}, (_, i) => i * 10).map(value =>
    `<path class="aa-grid" d="M${left},${y(value)}H${right}"/><text x="${left-9}" y="${y(value)+4}" text-anchor="end">${value}</text>`).join('');
  const xGrid = [0.1,0.2,0.5,1,2,5,10,20,40,100].filter(value=>value>=low && value<=high).map(value =>
    `<path class="aa-grid" d="M${x(value)},${top}V${bottom}"/><text x="${x(value)}" y="${bottom+19}" text-anchor="middle">$${value}</text>`).join('');
  let best = -Infinity;
  const frontier = rows.slice().sort((a,b)=>a.cost-b.cost || b.score-a.score).filter(model => {
    if (model.score <= best) return false;
    best = model.score;
    return true;
  });
  const frontierPath = frontier.map((model,index)=>`${index ? 'L' : 'M'}${x(model.cost)},${y(model.score)}`).join('');
  const splitX = x(aaMedian(rows.map(model=>model.cost)));
  const splitY = y(aaMedian(rows.map(model=>model.score)));
  const coordinates = rows.slice().sort((a,b)=>b.score-a.score).map(model=>({model, x:x(model.cost), y:y(model.score)}));
  const labels = aaLabelPositions(coordinates,{left, right, top, bottom});
  const points = coordinates.map(({model,x:cx,y:cy},index) => `<g role="button" tabindex="0" class="aa-marker" data-aa-inspect="${model.id}"
    aria-label="${esc(aaModelLabel(model))}，智能指数 ${model.score}，${aaMeasures.cost.format(model.cost)} 每任务">
    <circle cx="${cx}" cy="${cy}" r="13" fill="transparent"/>
    <circle class="aa-dot" cx="${cx}" cy="${cy}" r="7" fill="${model.color}"/>
    ${labels[index]}
    <title>${esc(aaModelLabel(model))} · ${model.score} · ${aaMeasures.cost.format(model.cost)}</title>
  </g>`).join('');
  return `<div class="aa-value-key small"><span class="aa-key-quadrant">低成本、高分区域</span><span class="aa-key-frontier">成本效益前沿</span></div>
  <p class="small aa-scroll-hint">左右滑动查看完整图表</p><div class="aa-plot-scroll" tabindex="0" role="region" aria-label="成本散点图区"><svg class="aa-plot aa-scatter" viewBox="0 0 ${width} ${height}" role="group" aria-label="AA 智能指数和每任务成本散点图">
    <rect class="aa-quadrant" x="${left}" y="${top}" width="${splitX-left}" height="${splitY-top}"/>
    ${yGrid}${xGrid}<path class="aa-frontier" d="${frontierPath}"/>${points}
    <text x="${left}" y="17">AA 智能指数</text>
    <text x="${right}" y="353" text-anchor="end">每任务成本（美元 · 对数刻度） →</text>
  </svg></div>${aaSeriesKey(rows)}`;
}

function aaRankPlot(rows) {
  const width = 1000, left = 75, right = 925, top = 49;
  const maximum = Math.max(3,...rows.flatMap(model=>model.ranks));
  const height = Math.max(252, top + maximum * 25 + 18);
  const bottom = height - 20;
  const x = i => left + i * (right-left) / (AA_CHART_DATA.domains.length-1);
  const y = rank => top + (rank-1) / (maximum-1) * (bottom-top);
  const ticks = Array.from({length:maximum},(_,i)=>i+1);
  const guides = ticks.map(rank=>`<path class="aa-grid" d="M${left},${y(rank)}H${right}"/>
    <text x="${left-13}" y="${y(rank)+4}" text-anchor="end">${rank}</text>`).join('');
  const labels = AA_CHART_DATA.domains.map((name,index)=>
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
      return `<circle class="aa-rank-dot" cx="${px}" cy="${py}" r="${rank <= 4 ? 9 : 4.5}" fill="${model.color}">
        <title>${esc(model.name)} · ${AA_CHART_DATA.domains[index]}第 ${rank} 名</title></circle>
        ${rank <= 4 ? `<text class="aa-rank-number" x="${px}" y="${py+3}" text-anchor="middle">${rank}</text>` : ''}`;
    }).join('');
    return `<g class="aa-rank-series aa-marker" data-aa-inspect="${model.id}" tabindex="0" role="button"
      aria-label="${esc(aaModelLabel(model))}各项排名：${model.ranks.map(rank=>rank ?? '缺分').join('、')}">
      <path class="aa-rank-hit" d="${path}"/><path class="aa-rank-line" d="${path}" stroke="${model.color}"/>${dots}</g>`;
  }).join('');
  return `<p class="small aa-scroll-hint">左右滑动查看完整图表</p><div class="aa-plot-scroll" tabindex="0" role="region" aria-label="六领域排名图区"><svg class="aa-plot aa-ranks" viewBox="0 0 ${width} ${height}" role="group" aria-label="六领域能力排名走势">
    ${guides}${labels}${paths}</svg></div>${aaSeriesKey(rows)}`;
}

function aaRankedModels(models) {
  const rated = models.filter(model => model.capabilityScores?.some(score => score != null));
  return rated.map(model => ({
    ...model,
    rankedByScore: true,
    ranks: model.capabilityScores.map((score, domain) => score == null ? null :
      1 + rated.filter(other => other.capabilityScores[domain] != null &&
        other.capabilityScores[domain] > score).length),
  }));
}

function aaMergeLocalCapabilities(model) {
  const update = aaCapabilityPatch?.models[model.id];
  if (!update) return model;
  const capabilityScores = model.capabilityScores.slice();
  capabilityScores[4] = update.engineering?.score ?? capabilityScores[4];
  capabilityScores[5] = update.economics?.score ?? capabilityScores[5];
  return { ...model, capabilityScores, source: aaCapabilityPatch.source };
}

function initAAChart(panel) {
  const view = panel.dataset.aaPanel;
  const output = panel.querySelector('.aa-chart-content');
  const inspect = panel.querySelector('.aa-inspect');
  let measure = 'cost';
  let scope = 'local';
  let query = [];
  let hiddenModels = new Set();
  let useLatest = true;
  let shown = [];
  let pinned = '';

  function showDetails(id) {
    const model = shown.find(row=>row.id===id);
    panel.querySelectorAll('[data-aa-inspect]').forEach(element => {
      element.classList.toggle('aa-active', Boolean(model) && element.dataset.aaInspect === id);
      element.classList.toggle('aa-muted', Boolean(model) && element.dataset.aaInspect !== id);
      element.setAttribute('aria-pressed', String(pinned === element.dataset.aaInspect));
    });
    inspect.hidden = shown.length === 0;
    if (!model) { inspect.textContent = '悬停、聚焦或点按型号查看数值。'; return; }
    const items = [];
    if (view === 'capabilities') {
      model.ranks.forEach((rank,i)=>{
        const score = model.rankedByScore ? model.capabilityScores[i] : null;
        const result = rank == null ? '待核对' : `#${rank}${score == null ? '' : `（${score} 分）`}`;
        items.push(`${AA_CHART_DATA.domains[i]} ${result}`);
      });
      if (model.rankEffort) items.push(model.rankEffort);
    } else {
      if (view === 'intelligence' || view === 'value') items.push(`智能指数 ${model.score}`);
      if (view === 'value') items.push(`每任务 ${aaMeasures.cost.format(model.cost)}`);
      if (view === 'task') items.push(`${aaMeasures[measure].title} ${aaFormat(measure,model[measure])}`);
      if (view === 'task' && measure === 'tokens' && model.defaultFallback) items.push('含默认回退');
      if (view === 'task' && measure === 'cost' && model.parts) {
        model.parts.forEach((value,i)=>items.push(`${aaCostParts[i][0]} $${value.toFixed(i===4 ? 4 : 2)}`));
      }
    }
    inspect.innerHTML = `<strong>${esc(aaModelLabel(model))}</strong><span>${esc(items.join(' · '))}</span>` +
      (model.source ? ` <a href="${model.source}" target="_blank" rel="noopener">来源 ↗</a>` : '');
  }

  function render() {
    const tokenView = view === 'task' && measure === 'tokens';
    const rankView = view === 'capabilities';
    const useApi = useLatest && Boolean(aaOfficial) &&
      (view !== 'task' || measure !== 'minutes' || aaApiModels.some(model => model.minutes != null));
    const localRankSnapshot = rankView && !useApi && scope === 'local';
    const computeRanks = rankView && (useApi || localRankSnapshot);
    const inScope = model => scope === 'all' || model.weight;
    const cohort = (useApi ? aaApiModels : AA_CHART_DATA.models).filter(inScope);
    const localRankUpdate = rankView && scope === 'local' && aaCapabilityPatch && (!useApi || !aaOfficial.checkedAt);
    const ranked = computeRanks ? aaRankedModels(localRankUpdate ? cohort.map(aaMergeLocalCapabilities) : cohort) : cohort;
    const displayed = model => !hiddenModels.has(model.id) && aaMatchesSearch(model, query);
    const selected = (tokenView ? (aaTokenModels ?? []).filter(inScope) : ranked).filter(displayed);
    const metric = view === 'task' ? measure : 'score';
    shown = selected.filter(model=>{
      if (view === 'value') return model.score != null && model.cost > 0;
      if (view === 'capabilities') return Array.isArray(model.ranks);
      return model[metric] != null;
    });
    panel.querySelectorAll('[data-aa-task]').forEach(button=>{
      const active = button.dataset.aaTask === measure;
      button.classList.toggle('on',active);
      button.setAttribute('aria-pressed',String(active));
    });
    const rankHint = computeRanks
      ? `各领域在本站收录的${scope === 'local' ? '开放权重模型' : '模型'}中按可核对的分数排名。同分并列，搜索只筛选显示。`
      : '名次来自 AA 当时选中的模型。切换范围只筛选显示。';
    const headline = view === 'value' ? ['智能指数与每任务成本','点越靠左成本越低，越靠上评分越高。虚线连接当前样本的成本效益前沿。']
      : rankView ? ['六领域能力排名',rankHint]
      : [aaMeasures[metric].title,aaMeasures[metric].hint];
    panel.querySelector('[data-aa-title]').textContent = headline[0];
    panel.querySelector('[data-aa-description]').textContent = headline[1];
    const snapshot = tokenView ? aaTokens : localRankSnapshot ? AA_CHART_DATA.localCapabilities
      : useApi ? aaOfficial : AA_CHART_DATA;
    const source = tokenView ? aaTokens?.source ?? 'https://artificialanalysis.ai/models#token-use'
      : localRankUpdate ? aaCapabilityPatch.source
      : computeRanks ? AA_CHART_DATA.localCapabilities.source
      : useApi ? 'https://artificialanalysis.ai/data-api/docs/reference' : AA_CHART_DATA.source;
    panel.querySelector('[data-aa-source]').href = source;
    const matching = cohort.filter(displayed);
    const total = tokenView ? new Set([...matching, ...selected].map(model => model.id)).size : matching.length;
    panel.querySelector('[data-aa-footnote]').textContent = `${shown.length} / ${total} 款有数据` +
      (snapshot?.indexVersion ? ` · AA ${String(snapshot.indexVersion).startsWith('v') ? '' : 'v'}${snapshot.indexVersion}` : '') +
      (snapshot ? ` · ${snapshot.readDate} 整理` : '') +
      (localRankUpdate ? ` · 最近同步 ${new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai'}).format(new Date(aaCapabilityPatch.checkedAt))}` : '');
    let content = '';
    if (shown.length) {
      if (view === 'value') content = aaValuePlot(shown);
      else if (view === 'capabilities') content = aaRankPlot(shown);
      else content = aaBars(shown,metric);
    } else {
      const message = tokenView && !aaTokens
        ? '尚未取得 AA 单任务输出 Token 数据。可前往 AA 的 Token Use 图表查看。'
        : '当前范围暂无这项数据，可切换到全部模型或调整搜索。';
      content = `<p class="aa-empty">${message}</p>`;
    }
    if (computeRanks && shown.length) {
      const coverage = AA_CHART_DATA.domains.map((domain,index) =>
        `${domain} ${ranked.filter(model=>model.ranks[index] != null).length} / ${cohort.length}`);
      content += `<p class="small aa-note">分数覆盖 · ${coverage.join(' · ')}。缺分处留空。</p>`;
    }
    output.innerHTML = content;
    if (!shown.some(model=>model.id===pinned)) pinned='';
    showDetails(pinned);
  }

  panel.addEventListener('click',event=>{
    const button=event.target.closest('[data-aa-task]');
    if (button) {
      measure=button.dataset.aaTask;
      pinned='';
      render();
      return;
    }
    const target=event.target.closest('[data-aa-inspect]');
    if (target) {
      pinned=pinned===target.dataset.aaInspect ? '' : target.dataset.aaInspect;
      showDetails(pinned);
    }
  });
  output.addEventListener('keydown',event=>{
    const target=event.target.closest('g[data-aa-inspect]');
    if (!target || !['Enter',' '].includes(event.key)) return;
    event.preventDefault();
    pinned=pinned===target.dataset.aaInspect ? '' : target.dataset.aaInspect;
    showDetails(pinned);
  });
  for (const type of ['pointerover','focusin']) output.addEventListener(type,event=>{
    const target=event.target.closest('[data-aa-inspect]');
    if (target) showDetails(target.dataset.aaInspect);
  });
  output.addEventListener('pointerleave',()=>showDetails(pinned));
  output.addEventListener('focusout',event=>{
    if (!output.contains(event.relatedTarget)) showDetails(pinned);
  });
  return (modelScope,words,excluded,latest)=>{
    scope=modelScope;
    query=words;
    hiddenModels=excluded;
    useLatest=latest;
    render();
  };
}

function initAACharts() {
  const update = Array.from(document.querySelectorAll('[data-aa-panel]'), initAAChart);
  return (scope, query, excluded, latest) => update.forEach(render => render(scope, query, excluded, latest));
}

const { getModelPages, normalizeName, numberOrNull, readSnapshot, writeSnapshot } = require('./import_aa.cjs');

const targets = [
  { id: 'qwen', name: 'Qwen3.8 27B (Xhigh)', slug: 'qwen3-8-27b' },
  { id: 'mistral', name: 'Mistral Large 4 (High)', slug: 'mistral-large-4' },
  { id: 'nemotron', name: 'Nemotron 3.5 Super VL', slug: 'nemotron-3-5-super-vl' },
];
const fields = [
  ['engineering', '工程'],
  ['economics', '经济学'],
];
const targetsBySlug = new Map(targets.map(target => [target.slug, target]));
const documentation = 'https://artificialanalysis.ai/data-api/docs/reference#getLanguageModelsFree';

async function syncCapabilities(key) {
  const matches = new Map();
  let indexVersion;
  for await (const page of getModelPages('free', key)) {
    indexVersion = page.intelligence_index_version;
    for (const row of page.data) {
      const target = targetsBySlug.get(row.slug);
      if (!target || normalizeName(row.name) !== normalizeName(target.name)) continue;
      if (matches.has(target.id) || typeof row.id !== 'string' || !row.id) {
        throw new Error('AA 返回的型号标识不唯一或不完整。');
      }
      matches.set(target.id, row);
    }
  }

  const checkedAt = new Date().toISOString();
  const snapshot = readSnapshot({ allowMissing: true });
  const models = { ...snapshot.capabilityPatch?.models };
  const rows = {};
  let stored = 0;
  for (const target of targets) {
    const aa = matches.get(target.id);
    const previous = models[target.id];
    if (aa && previous && aa.id !== previous.aaId) {
      throw new Error('AA 型号标识变更，需要重新核对评测版本。');
    }
    const entry = { ...previous, aaId: aa?.id, slug: target.slug };
    const outcomes = {};
    for (const [field] of fields) {
      const score = numberOrNull(aa?.evaluations?.[`artificial_analysis_${field}_index`]);
      outcomes[field] = score == null ? (aa ? 'AA 暂无分数' : '未匹配到型号和档位') : '已同步';
      if (score != null) {
        entry[field] = { score, checkedAt, intelligenceIndexVersion: indexVersion };
        stored++;
      }
    }
    if (fields.some(([field]) => outcomes[field] === '已同步')) models[target.id] = entry;
    rows[target.id] = outcomes;
  }
  if (stored) {
    writeSnapshot({ ...snapshot, capabilityPatch: { checkedAt, source: documentation, models } });
  }
  return { stored, checkedAt, rows };
}

module.exports = { syncCapabilities, targets, fields, documentation };

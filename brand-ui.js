const hardwareBrandColors = {NVIDIA:'#76b900', AMD:'#df3241', Apple:'#777e8a'};
const brandLabels = {NVIDIA:'NV', AMD:'AMD', Apple:'AP'};

function brandIcon(brand) {
  const label = brandLabels[brand] ?? [...brand].slice(0, 2).join('');
  return `<span class="brand-icon brand-transparent brand-initial" title="${esc(brand)}">${esc(label)}</span>`;
}

const transparentBrandIcon = brandIcon;

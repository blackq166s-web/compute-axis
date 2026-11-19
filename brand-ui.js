const hardwareBrandColors = {
  NVIDIA:'#76b900', AMD:'#ed1c24', Apple:'#555555', Intel:'#0071c5',
  '华为昇腾':'#cf0a2c', '海光':'#c71d23', '寒武纪':'#3374c4', '摩尔线程':'#f15a24',
  Meta:'#0866ff', Google:'#4285f4', OpenAI:'#10a37f', SambaNova:'#cf2030',
  Microsoft:'#00a4ef', 'd-Matrix':'#7c3aed', '壁仞':'#0e8f73', Rebellions:'#6d50c8',
  AWS:'#ff9900', '高通':'#3253dc', Graphcore:'#ff6f40', '百度':'#2932e1',
  Tenstorrent:'#ff5c35', '沐曦':'#4975d0', Furiosa:'#ef4836', Groq:'#f55036',
  '天数智芯':'#4097c7', '燧原':'#e8380d', '昆仑芯':'#3a64a5', Cerebras:'#ed1c24',
  '平头哥':'#ee6b24', '算能':'#0e9b8a',
};

const brandFiles = {
  NVIDIA:'nvidia.svg', AMD:'amd.svg', Apple:'apple.svg', Intel:'flopper-intel.svg',
  '高通':'flopper-qualcomm.png', '华为昇腾':'huawei.svg', '海光':'hygon.png',
  '寒武纪':'cambricon.png', '摩尔线程':'mthreads.png', Meta:'flopper-meta.png',
  Google:'flopper-google.svg', OpenAI:'flopper-openai.png', SambaNova:'flopper-sambanova.png',
  Microsoft:'flopper-microsoft.svg', 'd-Matrix':'flopper-d-matrix.png', '壁仞':'flopper-biren.png',
  Rebellions:'flopper-rebellions.png', AWS:'flopper-aws.png',
};
const brandInitials = {Graphcore:'GC', Tenstorrent:'TT', Groq:'GQ', Furiosa:'F'};
const flopperBrandMetadata = typeof FLOPPER_SNAPSHOT === 'undefined' ? null : FLOPPER_SNAPSHOT;

function brandIcon(brand) {
  const file = brandFiles[brand] ?? flopperBrandMetadata?.brandIcons?.[brand];
  if (file) {
    return `<span class="brand-icon"><img src="assets/brands/${file}" alt="${esc(brand)} 品牌图标" width="26" height="26"></span>`;
  }
  const fallback = flopperBrandMetadata?.brandFallbacks?.[brand];
  const color = fallback ? '#fff' : hardwareBrandColors[brand] ?? '#555';
  const background = fallback?.background ?? '#fff';
  const initials = fallback?.initials ?? brandInitials[brand] ?? [...brand].slice(0, 2).join('');
  return `<span class="brand-icon brand-initial" title="${esc(brand)} · 品牌缩写标识" style="color:${color};background:${background}">${esc(initials)}</span>`;
}

function transparentBrandIcon(brand) {
  const asset = BRAND_ICON_ASSETS.get(String(brand).trim().toLowerCase());
  if (!asset) return brandIcon(brand);
  const [lightFile, darkFile] = asset;
  const folder = 'assets/brands/transparent/';
  const src = folder + (document.documentElement.dataset.theme === 'dark' ? darkFile : lightFile);
  const variants = lightFile === darkFile ? '' : ` data-logo-light="${folder + lightFile}" data-logo-dark="${folder + darkFile}"`;
  return `<span class="brand-icon brand-transparent"><img src="${src}"${variants} alt="" width="26" height="26"></span>`;
}

function updateBrandIconTheme(dark) {
  document.querySelectorAll('img[data-logo-dark]').forEach(image => {
    const src = dark ? image.dataset.logoDark : image.dataset.logoLight;
    if (image.getAttribute('src') !== src) image.setAttribute('src', src);
  });
}

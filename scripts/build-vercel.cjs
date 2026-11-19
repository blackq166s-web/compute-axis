const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (fs.existsSync(output)) {
  if (fs.lstatSync(output).isSymbolicLink() || path.dirname(fs.realpathSync(output)) !== fs.realpathSync(root)) {
    throw new Error('构建目录不在项目内。');
  }
  fs.rmSync(output, { recursive: true });
}
const resources = [
  'style.css', 'theme.js',
  'data.js', 'flopper-data.js', 'advisor-data.js', 'brand-icons.js', 'brand-ui.js',
  'aa-admin.css', 'aa-chart-data.js',
  'pages/advisor.js', 'pages/advisor.css', 'pages/hardware.js', 'pages/hardware.css',
  'pages/hardware-chart.js', 'pages/aa-charts.js', 'pages/aa-charts.css',
  'pages/model-comparison.js', 'pages/model-comparison.css',
];

function copy(file) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}

for (const file of resources) copy(file);
for (const file of ['index.html', 'advisor.html', 'models.html', 'app.js']) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
    .replaceAll('assets/site-logo.ico', 'assets/compute-axis.svg')
    .replace('data-page="models"', 'data-page="models" data-hosted="true"');
  fs.writeFileSync(path.join(output, file), source);
}

copy('assets/compute-axis.svg');
for (const [folder, pattern] of [
  ['assets/brands', /^[\w.-]+\.(?:svg|png|webp)$/],
  ['assets/brands/transparent', /^[a-z0-9-]+\.png$/],
]) {
  for (const entry of fs.readdirSync(path.join(root, folder), { withFileTypes: true })) {
    if (entry.isFile() && pattern.test(entry.name)) copy(path.join(folder, entry.name));
  }
}

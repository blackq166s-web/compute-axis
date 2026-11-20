const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const keyFile = path.resolve(__dirname, '../../..', 'SECRETS.local.md');
const marker = '<!-- aa-api-key:dpapi:v1 ';
const keyPattern = /^[!-~]{1,512}$/;

function transform(value, decrypt) {
  if (process.platform !== 'win32') throw new Error('Windows 用户加密存储不可用。');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const action = decrypt
    ? '$bytes = [Convert]::FromBase64String($value); [Console]::Write([Text.Encoding]::ASCII.GetString([Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, $scope)))'
    : '$bytes = [Text.Encoding]::ASCII.GetBytes($value); [Console]::Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect($bytes, $entropy, $scope)))';
  const script = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Security
    $value = [Console]::In.ReadToEnd()
    $entropy = [Text.Encoding]::ASCII.GetBytes('AI deployment selection / AA key / v1')
    $scope = [Security.Cryptography.DataProtectionScope]::CurrentUser
    try { ${action} } finally { if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) } }
  `;
  const result = spawnSync(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
    input: value, encoding: 'utf8', timeout: 10000, maxBuffer: 16384, windowsHide: true,
  });
  if (result.error || result.status !== 0 || !result.stdout) throw new Error('Windows 用户加密存储读写失败。');
  return result.stdout;
}

function readFile() {
  let content = '';
  try {
    content = fs.readFileSync(keyFile, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const records = content.split(/\r?\n/).filter(line => line.startsWith(marker));
  if (records.length > 1) throw new Error('找到多个 AA 密钥记录。');
  return { content, record: records[0] };
}

function loadKey() {
  const { record } = readFile();
  if (!record) return '';
  const encrypted = record.slice(marker.length, -4);
  if (!record.endsWith(' -->') || !/^[A-Za-z0-9+/]+={0,2}$/.test(encrypted)) {
    throw new Error('AA 密钥记录格式不正确。');
  }
  const key = transform(encrypted, true);
  if (!keyPattern.test(key)) throw new Error('AA 密钥格式不正确。');
  return key;
}

function saveKey(key) {
  if (!keyPattern.test(key)) throw new Error('AA 密钥格式不正确。');
  const { content, record } = readFile();
  const replacement = marker + transform(key, false) + ' -->';
  const updated = record ? content.replace(record, replacement)
    : (content ? content.replace(/\r?\n?$/, '\n') : '# 本机服务端凭据\n\n') + replacement + '\n';
  const temporary = `${keyFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, updated, { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, keyFile);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

module.exports = { loadKey, saveKey, keyPattern };

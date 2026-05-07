import { readFileSync, writeFileSync } from 'fs';

const path = './src/services/newsService.js';
let code = readFileSync(path, 'utf8');

// 1. Reduz content_preview
code = code.replace(/\.slice\(0,\s*2000\)/g, '.slice(0, 500)');

// 2. Remove ogCache e fetchOgImage
code = code.replace(/\/\/ ── Cache de OG images[\s\S]*?^async function enrichWithOgImages/m, 'async function enrichWithOgImages');
code = code.replace(/const ogCache = new Map\(\);[\s\S]*?^async function fetchOgImage[\s\S]*?^\}/m, '');

// 3. Substitui enrichWithOgImages por passthrough simples
code = code.replace(
  /async function enrichWithOgImages[\s\S]*?^\}/m,
  `function enrichWithOgImages(articles) {
  // OG scraping removido — usar apenas imagens vindas diretamente do RSS
  return articles.map(({ _needsOg, ...rest }) => rest);
}`
);

writeFileSync(path, code);
console.log('✅ newsService.js corrigido!');

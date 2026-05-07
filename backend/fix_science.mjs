import { readFileSync, writeFileSync } from 'fs';

const path = './src/routes/science.js';
let code = readFileSync(path, 'utf8');

// 1. Remove searchEuropePMC completo
code = code.replace(/\/\/ ── Europe PMC[\s\S]*?(?=\/\/ ── Semantic Scholar)/, '');

// 2. Remove searchSemantic completo
code = code.replace(/\/\/ ── Semantic Scholar[\s\S]*?(?=\/\/ ── Gemini Search)/, '');

// 3. Remove branches europepmc e semantic da rota
code = code.replace(/\s+if \(source === 'europepmc'\) \{[\s\S]*?} else if \(source === 'semantic'\) \{[\s\S]*?} else if/, ' if');

writeFileSync(path, code);
console.log('✅ science.js corrigido!');

import { readFileSync, writeFileSync } from 'fs';

const path = './src/routes/youtube.js';
let code = readFileSync(path, 'utf8');

// Move export default para o final
code = code.replace(/\nexport default router;\n/, '\n');
code = code + '\nexport default router;\n';

writeFileSync(path, code);
console.log('✅ youtube.js corrigido!');

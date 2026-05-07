import { readFileSync, writeFileSync } from 'fs';

const path = './src/server.js';
let code = readFileSync(path, 'utf8');

// 1. Remove rota duplicada /api/youtube (app.get direto no server.js)
code = code.replace(/\/\/ ─── YouTube Analytics[\s\S]*?app\.get\('\/api\/youtube'[\s\S]*?^\}\);/m, '');

// 2. Remove rota /api/ai-diagnosis (sem auth, expõe chave Gemini)
code = code.replace(/\napp\.post\('\/api\/ai-diagnosis'[\s\S]*?^\}\);/m, '');

// 3. Remove rota /api/ai (sem auth, expõe chave Anthropic)
code = code.replace(/\napp\.post\('\/api\/ai'[\s\S]*?^\}\);/m, '');

// 4. Move app.listen para o final do arquivo
code = code.replace(/\/\/ ─── Start Server[\s\S]*?^\}\);\n/m, '');
code = code.replace(/\/\/ ─── 404 & Error Handlers/, `// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(\`\\n🚀 ViralNews AI Backend running at http://localhost:\${config.port}\`);
  console.log(\`📡 Environment: \${config.nodeEnv}\`);
  console.log(\`🔑 NewsAPI: \${config.newsApiKey ? '✅ configured' : '❌ missing'}\`);
  console.log(\`🤖 Gemini AI: \${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing'}\\n\`);
});

// ─── 404 & Error Handlers`);

writeFileSync(path, code);
console.log('✅ server.js corrigido!');

import { readFileSync, writeFileSync } from 'fs';

const path = './src/routes/niche.js';
let code = readFileSync(path, 'utf8');

// 1. Remove AMAZON_TAG
code = code.replace(/const AMAZON_TAG = 'viralnewsai-20';\n/, '');

// 2. Remove amazonUrl e isAffiliate do Open Library
code = code.replace(/\s+const amazonUrl = `https:\/\/www\.amazon\.com\.br\/s\?k=\$\{encodeURIComponent\(title \+ ' ' \+ author\)\}&tag=\$\{AMAZON_TAG\}`;\n(\s+return \{)/,
  '\n$1');
code = code.replace(/\s+url: amazonUrl,(\s+source: 'Open Library',)/, '\n      url: `https://openlibrary.org${d.key}`,\n$1');
code = code.replace(/\s+amazonUrl,\n\s+isAffiliate: true,\n(\s+isbn,)/, '\n$1');

// 3. Remove amazonUrl e isAffiliate do Google Books
code = code.replace(/\s+const amazonUrl = `https:\/\/www\.amazon\.com\.br\/s\?k=\$\{encodeURIComponent\(info\.title \+ ' ' \+ author\)\}&tag=\$\{AMAZON_TAG\}`;\n(\s+return \{)/,
  '\n$1');
code = code.replace(/\s+url: amazonUrl,(\s+source: 'Google Books',)/, '\n      url: info.infoLink || `https://books.google.com/books?id=${v.id}`,\n$1');
code = code.replace(/\s+amazonUrl,\n\s+isAffiliate: true,\n(\s+\};)/, '\n$1');

// 4. Limita selftext do Reddit a 400 chars (evita reproduzir post curto inteiro)
code = code.replace(
  "description: p.data.selftext?.slice(0, 200) || `${p.data.ups?.toLocaleString()} upvotes · r/${p.data.subreddit}`",
  "description: p.data.selftext?.length > 400 ? p.data.selftext.slice(0, 400) + '...' : `${p.data.ups?.toLocaleString()} upvotes · r/${p.data.subreddit}`"
);

writeFileSync(path, code);
console.log('✅ niche.js corrigido!');

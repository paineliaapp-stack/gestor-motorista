/**
 * BooksWorld.jsx — capas via Open Library (cover_id) + Google Books fallback
 * Open Library é mais estável e retorna cover_i confiável por busca de título
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptGenerator } from '../../hooks/useScriptGenerator';
import { BookChat } from './BookChat';
import { PersonaModal } from './PersonaModal';
import { ScriptModal } from '../../components/script/ScriptModal';

if (typeof document !== 'undefined' && !document.getElementById('bw-fonts')) {
  const l = document.createElement('link');
  l.id = 'bw-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(l);
}

const BOOKS = [
  // PRODUTIVIDADE
  { title: 'Hábitos Atômicos', author: 'James Clear', cat: 'Produtividade', score: 9.1 },
  { title: 'O Poder do Hábito', author: 'Charles Duhigg', cat: 'Produtividade', score: 8.7 },
  { title: 'Milagre da Manhã', author: 'Hal Elrod', cat: 'Produtividade', score: 7.8 },
  { title: 'Os 7 Hábitos das Pessoas Altamente Eficazes', author: 'Stephen Covey', cat: 'Produtividade', score: 8.8 },
  { title: 'Eat That Frog', author: 'Brian Tracy', cat: 'Produtividade', score: 8.2 },
  { title: 'Deep Work', author: 'Cal Newport', cat: 'Produtividade', score: 8.9 },
  { title: 'Essentialism', author: 'Greg McKeown', cat: 'Produtividade', score: 8.6 },
  { title: 'Getting Things Done', author: 'David Allen', cat: 'Produtividade', score: 8.3 },
  { title: 'The One Thing', author: 'Gary Keller', cat: 'Produtividade', score: 8.4 },
  { title: 'Ikigai', author: 'Héctor García', cat: 'Produtividade', score: 8.5 },

  // PSICOLOGIA
  { title: 'Mindset: A Nova Psicologia do Sucesso', author: 'Carol Dweck', cat: 'Psicologia', score: 8.6 },
  { title: 'Rápido e Devagar', author: 'Daniel Kahneman', cat: 'Psicologia', score: 9.0 },
  { title: 'Ansiedade', author: 'Augusto Cury', cat: 'Psicologia', score: 7.5 },
  { title: 'O Homem em Busca de Sentido', author: 'Viktor Frankl', cat: 'Psicologia', score: 9.3 },
  { title: 'Os Dons da Imperfeição', author: 'Brené Brown', cat: 'Psicologia', score: 8.3 },
  { title: 'Inteligência Emocional', author: 'Daniel Goleman', cat: 'Psicologia', score: 8.7 },
  { title: 'O Poder da Vulnerabilidade', author: 'Brené Brown', cat: 'Psicologia', score: 8.5 },
  { title: 'Flow', author: 'Mihaly Csikszentmihalyi', cat: 'Psicologia', score: 8.8 },
  { title: 'Thinking Fast and Slow', author: 'Daniel Kahneman', cat: 'Psicologia', score: 9.0 },
  { title: 'A Psicologia das Massas', author: 'Gustave Le Bon', cat: 'Psicologia', score: 8.1 },

  // AUTOAJUDA
  { title: 'A Sutil Arte de Ligar o F*da-se', author: 'Mark Manson', cat: 'Autoajuda', score: 8.9 },
  { title: 'O Segredo', author: 'Rhonda Byrne', cat: 'Autoajuda', score: 7.4 },
  { title: 'O Poder do Agora', author: 'Eckhart Tolle', cat: 'Autoajuda', score: 8.7 },
  { title: 'Seja Dono do Seu Dia', author: 'Jocko Willink', cat: 'Autoajuda', score: 8.4 },
  { title: 'O Ego é Seu Inimigo', author: 'Ryan Holiday', cat: 'Autoajuda', score: 8.6 },
  { title: 'Acredite em Você', author: 'Jack Canfield', cat: 'Autoajuda', score: 7.8 },
  { title: 'O Milagre da Gratidão', author: 'Rhonda Byrne', cat: 'Autoajuda', score: 7.5 },
  { title: 'Desperte o Gigante Interior', author: 'Tony Robbins', cat: 'Autoajuda', score: 8.3 },
  { title: 'Os Quatro Compromissos', author: 'Don Miguel Ruiz', cat: 'Autoajuda', score: 8.5 },
  { title: 'O Obstáculo é o Caminho', author: 'Ryan Holiday', cat: 'Autoajuda', score: 8.7 },

  // NEGÓCIOS
  { title: 'Pai Rico Pai Pobre', author: 'Robert Kiyosaki', cat: 'Negócios', score: 8.5 },
  { title: 'A Startup Enxuta', author: 'Eric Ries', cat: 'Negócios', score: 8.8 },
  { title: 'De Zero a Um', author: 'Peter Thiel', cat: 'Negócios', score: 9.1 },
  { title: 'A Lógica do Cisne Negro', author: 'Nassim Taleb', cat: 'Negócios', score: 9.0 },
  { title: 'Como Fazer Amigos e Influenciar Pessoas', author: 'Dale Carnegie', cat: 'Negócios', score: 8.4 },
  { title: 'O Monge e o Executivo', author: 'James Hunter', cat: 'Negócios', score: 8.0 },
  { title: 'Blitzscaling', author: 'Reid Hoffman', cat: 'Negócios', score: 8.6 },
  { title: 'Good to Great', author: 'Jim Collins', cat: 'Negócios', score: 8.9 },
  { title: 'Rework', author: 'Jason Fried', cat: 'Negócios', score: 8.5 },
  { title: 'O Ponto da Virada', author: 'Malcolm Gladwell', cat: 'Negócios', score: 8.8 },
  { title: 'Fora de Série', author: 'Malcolm Gladwell', cat: 'Negócios', score: 8.7 },
  { title: 'Traction', author: 'Gabriel Weinberg', cat: 'Negócios', score: 8.4 },

  // FINANÇAS
  { title: 'O Investidor Inteligente', author: 'Benjamin Graham', cat: 'Finanças', score: 9.2 },
  { title: 'A Psicologia do Dinheiro', author: 'Morgan Housel', cat: 'Finanças', score: 9.3 },
  { title: 'Antifrágil', author: 'Nassim Taleb', cat: 'Finanças', score: 9.0 },
  { title: 'Os Segredos da Mente Milionária', author: 'T. Harv Eker', cat: 'Finanças', score: 8.2 },
  { title: 'Dinheiro: Domine o Jogo', author: 'Tony Robbins', cat: 'Finanças', score: 8.0 },
  { title: 'O Homem Mais Rico da Babilônia', author: 'George Clason', cat: 'Finanças', score: 8.6 },
  { title: 'Múltiplos Fluxos de Renda', author: 'Robert Allen', cat: 'Finanças', score: 7.9 },
  { title: 'Dinheiro Mestre do Jogo', author: 'Tony Robbins', cat: 'Finanças', score: 8.1 },

  // LIDERANÇA
  { title: 'Liderança Extrema', author: 'Jocko Willink', cat: 'Liderança', score: 8.9 },
  { title: 'Os 21 Princípios da Liderança', author: 'John Maxwell', cat: 'Liderança', score: 8.5 },
  { title: 'Comece pelo Porquê', author: 'Simon Sinek', cat: 'Liderança', score: 9.0 },
  { title: 'Os Líderes se Servem Por Último', author: 'Simon Sinek', cat: 'Liderança', score: 8.8 },
  { title: 'Tribu', author: 'Seth Godin', cat: 'Liderança', score: 8.3 },
  { title: 'O Jogo Infinito', author: 'Simon Sinek', cat: 'Liderança', score: 8.7 },

  // SOCIEDADE
  { title: 'Sapiens', author: 'Yuval Noah Harari', cat: 'Sociedade', score: 9.4 },
  { title: 'Homo Deus', author: 'Yuval Noah Harari', cat: 'Sociedade', score: 9.1 },
  { title: '21 Lições para o Século 21', author: 'Yuval Noah Harari', cat: 'Sociedade', score: 8.9 },
  { title: 'A Revolução dos Bichos', author: 'George Orwell', cat: 'Sociedade', score: 9.1 },
  { title: '1984', author: 'George Orwell', cat: 'Sociedade', score: 9.5 },
  { title: 'Admirável Mundo Novo', author: 'Aldous Huxley', cat: 'Sociedade', score: 9.2 },
  { title: 'O Príncipe', author: 'Nicolau Maquiavel', cat: 'Sociedade', score: 8.9 },
  { title: 'Armas Germes e Aço', author: 'Jared Diamond', cat: 'Sociedade', score: 9.1 },
  { title: 'O Colapso', author: 'Jared Diamond', cat: 'Sociedade', score: 8.7 },
  { title: 'Como as Democracias Morrem', author: 'Steven Levitsky', cat: 'Sociedade', score: 9.2 },
  { title: 'A Origem das Espécies', author: 'Charles Darwin', cat: 'Sociedade', score: 9.0 },

  // FILOSOFIA
  { title: 'O Pequeno Príncipe', author: 'Antoine de Saint-Exupéry', cat: 'Filosofia', score: 9.2 },
  { title: 'Meditações', author: 'Marco Aurélio', cat: 'Filosofia', score: 9.3 },
  { title: 'A República', author: 'Platão', cat: 'Filosofia', score: 8.9 },
  { title: 'Assim Falou Zaratustra', author: 'Friedrich Nietzsche', cat: 'Filosofia', score: 9.0 },
  { title: 'Cartas a Lucílio', author: 'Sêneca', cat: 'Filosofia', score: 9.1 },
  { title: 'A Arte de Amar', author: 'Erich Fromm', cat: 'Filosofia', score: 8.8 },
  { title: 'O Mundo de Sofia', author: 'Jostein Gaarder', cat: 'Filosofia', score: 8.6 },

  // LITERATURA
  { title: 'Dom Casmurro', author: 'Machado de Assis', cat: 'Literatura', score: 8.8 },
  { title: 'Grande Sertão Veredas', author: 'João Guimarães Rosa', cat: 'Literatura', score: 9.0 },
  { title: 'O Alquimista', author: 'Paulo Coelho', cat: 'Literatura', score: 8.7 },
  { title: 'Cem Anos de Solidão', author: 'Gabriel García Márquez', cat: 'Literatura', score: 9.4 },
  { title: 'Crime e Castigo', author: 'Fiódor Dostoiévski', cat: 'Literatura', score: 9.3 },
  { title: 'O Processo', author: 'Franz Kafka', cat: 'Literatura', score: 9.1 },
  { title: 'A Metamorfose', author: 'Franz Kafka', cat: 'Literatura', score: 8.9 },

  // CIÊNCIA
  { title: 'Breve História do Tempo', author: 'Stephen Hawking', cat: 'Ciência', score: 9.2 },
  { title: 'O Gene Egoísta', author: 'Richard Dawkins', cat: 'Ciência', score: 9.0 },
  { title: 'A Ordem do Tempo', author: 'Carlo Rovelli', cat: 'Ciência', score: 8.9 },
  { title: 'O Universo Elegante', author: 'Brian Greene', cat: 'Ciência', score: 8.7 },
  { title: 'Sete Breves Lições de Física', author: 'Carlo Rovelli', cat: 'Ciência', score: 8.8 },

  // ESTRATÉGIA
  { title: 'A Arte da Guerra', author: 'Sun Tzu', cat: 'Estratégia', score: 8.9 },
  { title: 'As 48 Leis do Poder', author: 'Robert Greene', cat: 'Estratégia', score: 9.0 },
  { title: 'As 33 Estratégias de Guerra', author: 'Robert Greene', cat: 'Estratégia', score: 8.8 },
  { title: 'A Sedução', author: 'Robert Greene', cat: 'Estratégia', score: 8.6 },
  { title: 'O Domínio', author: 'Robert Greene', cat: 'Estratégia', score: 8.7 },

  // COMPORTAMENTO HUMANO
  { title: 'Previsivelmente Irracional', author: 'Dan Ariely', cat: 'Comportamento', score: 9.0 },
  { title: 'Nudge', author: 'Richard Thaler', cat: 'Comportamento', score: 8.8 },
  { title: 'A Lógica do Consumo', author: 'Martin Lindstrom', cat: 'Comportamento', score: 8.6 },
  { title: 'Subliminar', author: 'Leonard Mlodinow', cat: 'Comportamento', score: 8.7 },
  { title: 'O Efeito Halo', author: 'Phil Rosenzweig', cat: 'Comportamento', score: 8.4 },
  { title: 'Blink', author: 'Malcolm Gladwell', cat: 'Comportamento', score: 8.9 },
  { title: 'Previsível', author: 'Dan Ariely', cat: 'Comportamento', score: 8.5 },
  { title: 'A Psicologia da Persuasão', author: 'Kevin Hogan', cat: 'Comportamento', score: 8.3 },
  { title: 'O Poder do Contexto', author: 'Malcolm Gladwell', cat: 'Comportamento', score: 8.6 },
  { title: 'Você não é tão Esperto quanto Pensa', author: 'David McRaney', cat: 'Comportamento', score: 8.4 },

  // PERSUASÃO
  { title: 'As Armas da Persuasão', author: 'Robert Cialdini', cat: 'Persuasão', score: 9.4 },
  { title: 'Pré-Suasão', author: 'Robert Cialdini', cat: 'Persuasão', score: 9.1 },
  { title: 'Como Convencer Alguém em 90 Segundos', author: 'Nicholas Boothman', cat: 'Persuasão', score: 8.3 },
  { title: 'Neuromarketing', author: 'Patrick Renvoise', cat: 'Persuasão', score: 8.6 },
  { title: 'Gatilhos Mentais', author: 'Gustavo Ferreira', cat: 'Persuasão', score: 8.8 },
  { title: 'Pitch Anything', author: 'Oren Klaff', cat: 'Persuasão', score: 8.7 },
  { title: 'Never Split the Difference', author: 'Chris Voss', cat: 'Persuasão', score: 9.2 },
  { title: 'Como Falar em Público e Encantar as Pessoas', author: 'Dale Carnegie', cat: 'Persuasão', score: 8.4 },
  { title: 'O Poder da Comunicação', author: 'Carmine Gallo', cat: 'Persuasão', score: 8.5 },
  { title: 'Fale como Ted', author: 'Carmine Gallo', cat: 'Persuasão', score: 8.7 },

  // VENDAS
  { title: 'A Venda Desafiadora', author: 'Matthew Dixon', cat: 'Vendas', score: 8.9 },
  { title: 'SPIN Selling', author: 'Neil Rackham', cat: 'Vendas', score: 9.0 },
  { title: 'Receita Previsível', author: 'Aaron Ross', cat: 'Vendas', score: 9.1 },
  { title: 'Vender é Humano', author: 'Daniel Pink', cat: 'Vendas', score: 8.7 },
  { title: 'Way of the Wolf', author: 'Jordan Belfort', cat: 'Vendas', score: 8.6 },
  { title: 'Objeções', author: 'Jeb Blount', cat: 'Vendas', score: 8.5 },
  { title: 'Prospecção Fanática', author: 'Jeb Blount', cat: 'Vendas', score: 8.7 },
  { title: 'O Guia do Mestre das Vendas', author: 'Jeffrey Gitomer', cat: 'Vendas', score: 8.4 },
  { title: 'A Máquina de Vendas Definitiva', author: 'Chet Holmes', cat: 'Vendas', score: 8.6 },
  { title: 'Venda ou Seja Vendido', author: 'Grant Cardone', cat: 'Vendas', score: 8.8 },
];

// Títulos em PT para exibição (mantém busca em EN para melhor cobertura)
const DISPLAY_TITLES = {
  'O Poder do Hábito': 'O Poder do Hábito',
  'A Sutil Arte de Ligar o F*da-se': 'A Sutil Arte de Ligar o F*da-se',
  'Milagre da Manhã': 'O Milagre da Manhã',
  'Os 7 Hábitos das Pessoas Altamente Eficazes': 'Os 7 Hábitos',
  'Rápido e Devagar': 'Rápido e Devagar',
  'Em Busca de Sentido': 'O Homem em Busca de Sentido',
  'Pai Rico Pai Pobre': 'Pai Rico Pai Pobre',
  'Como Fazer Amigos e Influenciar Pessoas': 'Como Fazer Amigos e Influenciar Pessoas',
  'O Poder do Agora': 'O Poder do Agora',
  'Os Dons da Imperfeição': 'A Coragem de Ser Imperfeito',
  'A Arte da Guerra': 'A Arte da Guerra',
  'O Pequeno Príncipe': 'O Pequeno Príncipe',
  'O Segredo': 'O Segredo',
  'O Monge e o Executivo': 'O Monge e o Executivo',
  'A Revolução dos Bichos': 'A Revolução dos Bichos',
};

const CATS = ['Todos', 'Produtividade', 'Psicologia', 'Finanças', 'Autoajuda', 'Filosofia', 'Literatura', 'Liderança', 'Negócios', 'Sociedade', 'Estratégia', 'Comportamento', 'Persuasão', 'Vendas', 'Ciência'];
const PLATFORMS = [['tiktok', 'TikTok / Instagram'], ['youtube_shorts', 'YT Shorts'], ['youtube_long', 'YT Longo']];
const STYLES    = [['educational', 'Educacional'], ['storytelling', 'Storytelling'], ['dark_channel', 'Entretenimento'], ['controversial', 'Debate']];

const COVER_FALLBACK_COLORS = [
  ['#1a0a2e', '#7c3aed'], ['#0a1a2e', '#2563eb'], ['#0a2e1a', '#059669'],
  ['#2e1a0a', '#d97706'], ['#2e0a1a', '#dc2626'], ['#1a2e0a', '#65a30d'],
  ['#0a2e2e', '#0891b2'], ['#2e0a2e', '#9333ea'], ['#1a1a0a', '#ca8a04'],
];
function getFallbackColors(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffffffff;
  return COVER_FALLBACK_COLORS[Math.abs(h) % COVER_FALLBACK_COLORS.length];
}

// ── Cover fetcher ─────────────────────────────────────────────────────────────
const coverCache = {};

/**
 * Busca capa na Open Library pelo título em inglês.
 * Retorna URL da capa -L (large) se cover_i existir.
 */
async function fetchOpenLibraryCover(title, author) {
  const q = encodeURIComponent(title);
  const a = encodeURIComponent(author.split(' ').slice(-1)[0]); // sobrenome
  const res = await fetch(`https://openlibrary.org/search.json?title=${q}&author=${a}&limit=5&fields=cover_i,title,author_name`);
  const data = await res.json();
  const docs = data?.docs || [];

  // Prefere match exato no título
  for (const doc of docs) {
    if (doc.cover_i && doc.title?.toLowerCase().includes(title.toLowerCase().slice(0, 8))) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
  }
  // Aceita qualquer resultado com capa
  const withCover = docs.find(d => d.cover_i);
  return withCover ? `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg` : null;
}

/**
 * Fallback: Google Books
 */
async function fetchGoogleBooksCover(title, author) {
  const q = encodeURIComponent(`intitle:${title} inauthor:${author.split(' ').slice(-1)[0]}`);
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=3&fields=items(volumeInfo/imageLinks,volumeInfo/title)`);
  const data = await res.json();
  const items = data?.items || [];
  for (const item of items) {
    const url = item.volumeInfo?.imageLinks?.thumbnail || item.volumeInfo?.imageLinks?.smallThumbnail;
    if (url) {
      return url.replace('zoom=1', 'zoom=3').replace('&edge=curl', '').replace('http://', 'https://');
    }
  }
  return null;
}

async function fetchCover(title, author) {
  const key = `${title}__${author}`;
  if (key in coverCache) return coverCache[key];

  try {
    // Open Library primeiro (mais estável)
    const olUrl = await fetchOpenLibraryCover(title, author);
    if (olUrl) { coverCache[key] = olUrl; return olUrl; }

    // Google Books como fallback
    const gbUrl = await fetchGoogleBooksCover(title, author);
    coverCache[key] = gbUrl;
    return gbUrl;
  } catch {
    coverCache[key] = null;
    return null;
  }
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ height: 200, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'bwShimmer 1.5s ease infinite' }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '35%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '90%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '65%' }} />
        <div style={{ height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginTop: 4 }} />
      </div>
    </div>
  );
}

function BookCard({ book, index, onClick, highlighted = false, dimmed = false }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const highlightStyle = highlighted
    ? { transform: 'translateY(-10px) scale(1.04)', zIndex: 10, filter: 'drop-shadow(0 16px 40px rgba(255,200,80,0.45))', transition: 'all 0.5s cubic-bezier(0.34,1.2,0.64,1)', opacity: 1 }
    : dimmed
    ? { opacity: 0.12, filter: 'grayscale(1)', transform: 'scale(0.96)', transition: 'all 0.5s ease', zIndex: 0 }
    : { transition: 'all 0.5s ease' };
  const [showOpts, setShowOpts] = useState(false);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  const displayTitle = DISPLAY_TITLES[book.title] || book.title;
  const accent = '#ffbe4d';
  const glow = '255,190,77';
  const score = book.score;
  const scoreColor = score >= 9 ? '#00e5b0' : score >= 8 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
  const scoreLabel = score >= 9 ? 'ULTRA VIRAL' : score >= 8 ? 'POTENCIAL' : 'NORMAL';
  const [bgDark, bgAccent] = getFallbackColors(book.title);
  const initials = displayTitle.split(' ').filter(w => w.length > 2).slice(0, 2).map(w => w[0]).join('').toUpperCase();

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchCover(book.title, book.author).then(url => {
      if (!cancelled) setImgSrc(url);
    });
    return () => { cancelled = true; };
  }, [book.title, book.author]);

  const handleImgError = useCallback(() => {
    // Se Open Library falhou, tenta Google Books diretamente
    fetchGoogleBooksCover(book.title, book.author).then(url => {
      if (url) { setImgSrc(url); setImgLoaded(false); }
      else setImgFailed(true);
    }).catch(() => setImgFailed(true));
  }, [book.title, book.author]);

  return (
    <div style={{ position: 'relative', ...highlightStyle }}>
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${hovered ? `rgba(${glow},0.22)` : 'rgba(255,255,255,0.06)'}`,
        background: hovered ? `rgba(${glow},0.04)` : 'rgba(255,255,255,0.02)',
        transform: visible ? (hovered ? 'translateY(-4px)' : 'translateY(0)') : 'translateY(18px)',
        opacity: visible ? 1 : 0,
        boxShadow: hovered ? `0 16px 48px rgba(0,0,0,0.65)` : '0 2px 12px rgba(0,0,0,0.3)',
        transition: `transform 0.28s ease, box-shadow 0.28s ease, border-color 0.2s, background 0.2s, opacity 0.5s ease ${index * 0.04}s`,
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', height: 200, overflow: 'hidden', background: bgDark, flexShrink: 0 }}>
        {imgSrc && !imgFailed ? (
          <>
            {!imgLoaded && (
              <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'bwShimmer 1.5s ease infinite' }} />
            )}
            <img
              src={imgSrc} alt={displayTitle}
              onLoad={() => setImgLoaded(true)}
              onError={handleImgError}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease, transform 0.4s ease', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
            />
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(155deg, ${bgDark} 0%, #000 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 40, fontWeight: 700, color: bgAccent, opacity: 0.7, letterSpacing: 4 }}>{initials}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, letterSpacing: '0.2em', color: `${bgAccent}66`, textAlign: 'center', maxWidth: 110, lineHeight: 1.7 }}>{displayTitle.toUpperCase()}</span>
          </div>
        )}

        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(5,3,0,0.82) 0%, transparent 55%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'rgba(5,3,0,0.78)', backdropFilter: 'blur(12px)', border: `1px solid ${scoreColor}33` }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, boxShadow: score >= 8 ? `0 0 6px ${scoreColor}` : 'none', animation: score >= 9 ? 'bwPulse 2s ease infinite' : 'none' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor, fontWeight: 700 }}>{score}/10</span>
        </div>

        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', background: 'rgba(5,3,0,0.72)', backdropFilter: 'blur(12px)', padding: '3px 8px', borderRadius: 4 }}>{book.cat.toUpperCase()}</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.14em', color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
        </div>

        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 14, fontWeight: 700, color: hovered ? '#fff' : 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color 0.2s' }}>{displayTitle}</h3>

        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.38)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.author}</p>

        <div style={{ flex: 1 }} />

        {showOpts && (
          <>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: `rgba(${glow},0.55)`, margin: '0 0 6px', fontWeight: 300 }}>✨ Inspirado no universo de <strong style={{ fontWeight: 500 }}>{displayTitle}</strong></p>
          <div style={{ padding: '10px 12px', borderRadius: 10, background: `rgba(${glow},0.06)`, border: `1px solid rgba(${glow},0.18)`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {PLATFORMS.map(([v, l]) => <option key={v} value={v} style={{ background: '#0a0700' }}>{l}</option>)}
            </select>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {STYLES.map(([v, l]) => <option key={v} value={v} style={{ background: '#0a0700' }}>{l}</option>)}
            </select>
            <button onClick={() => onClick(book, { platform, style })} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, background: `rgba(${glow},0.18)`, border: `1px solid rgba(${glow},0.45)`, color: accent, fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.16em', cursor: 'pointer' }}>GERAR →</button>
          </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button onClick={() => setShowOpts(!showOpts)} style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, color: showOpts ? accent : '#0a0700', background: showOpts ? `rgba(${glow},0.15)` : `linear-gradient(135deg, #ffbe4d 0%, #e8a000 100%)`, boxShadow: showOpts ? 'none' : `0 2px 14px rgba(${glow},0.35)`, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>📖</span>
            {showOpts ? 'Fechar opções' : 'Gerar Roteiro'}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}

function BooksModal({ book, onClose, isMobile, generator, onSave }) {
  generator = generator || useScriptGenerator();
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState(false);
  const [generated, setGenerated] = useState(false);
  const outputRef = useRef(null);
  const displayTitle = DISPLAY_TITLES[book.title] || book.title;

  useEffect(() => {
    setGenerated(false);
    setTopic('');
    setTopicError(false);
    generator.reset();
  }, [book.title]);

  const inspiredLine = (
    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,190,77,0.5)', margin: '0 0 0', fontWeight: 300 }}>
      ✨ Inspirado no universo de <strong style={{ color: 'rgba(255,190,77,0.85)', fontWeight: 500 }}>{displayTitle}</strong>
    </p>
  );

  const buildArticle = (t) => ({
    id: 'book_' + Date.now(),
    title: `${displayTitle} — ${book.author}`,
    description: `Livro: ${displayTitle} de ${book.author}. Tema do roteiro: ${t}`,
    url: '', source: 'Livro', publishedAt: '',
    viral_score: Math.round(book.score),
    content_preview: `TEMA DO ROTEIRO: ${t}
LIVRO DE REFERÊNCIA: "${displayTitle}" de ${book.author}

INSTRUÇÃO PRINCIPAL: Crie um roteiro viral sobre "${t}" usando conceitos e ideias do livro "${displayTitle}" de ${book.author}.

REGRAS OBRIGATÓRIAS:
1. PERSPECTIVA — apresente como "o que o autor defende" ou "segundo esse livro", nunca como verdade absoluta
2. ÂNGULO ÚNICO — escolha UM conceito específico do livro e aprofunde, não liste vários
3. DIVERSIDADE — o semente de variação acima deve guiar você a escolher um ângulo diferente a cada geração
4. TOM — questionador, não prescritivo. Provoque reflexão, não dê receita
5. CONEXÃO REAL — conecte o conceito do livro a uma situação cotidiana de quem treina/trabalha/vive o tema "${t}"
6. PROIBIDO: receitas de "faça X e Y acontece". PERMITIDO: "o livro sugere que X pode explicar Y — e isso muda como você pensa sobre Z"`,
    image: null,
  });

  const handleGenerate = () => {
    if (!topic.trim()) { setTopicError(true); return; }
    setTopicError(false);
    setGenerated(true);
    generator.reset();
    generator.setPlatform(platform);
    generator.setStyle(style);
    setTimeout(() => generator.generate(buildArticle(topic.trim()), 1), 80);
  };

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = 0;
  }, [generator.script]);

  const handleRegenerate = () => {
    if (!topic.trim()) return;
    generator.setPlatform(platform);
    generator.setStyle(style);
    generator.reset();
    setTimeout(() => generator.generate(buildArticle(topic.trim()), 1), 0);
  };

  const rawScript = generator.script && typeof generator.script === 'object' ? generator.script.script : (generator.script || '');
  const wordCount = rawScript ? rawScript.split(/\s+/).filter(Boolean).length : 0;
  const readTime = Math.ceil(wordCount / 150);

  const bookArticle = generated ? {
    id: 'book_' + book.title,
    title: `${displayTitle} — ${book.author}`,
    description: topic,
    source: 'Livro',
    publishedAt: '',
    viral_score: Math.round(book.score),
    image: null,
  } : null;

  if (generated && bookArticle) {
    return (
      <ScriptModal
        article={bookArticle}
        generator={generator}
        onClose={onClose}
        onSave={onSave}
        accentColor="#ffbe4d"
        glowColor="255,190,77"
        subtitle={`✨ Inspirado no universo de ${displayTitle}`}
      />
    );
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4,2,0,0.93)', backdropFilter: 'blur(28px)', display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24, animation: 'bwFadeIn 0.2s ease' }}>
      <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 880, maxHeight: isMobile ? '92vh' : '90vh', background: '#0a0700', border: '1px solid rgba(255,190,77,0.14)', borderRadius: isMobile ? '18px 18px 0 0' : 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'bwSlideUp 0.3s cubic-bezier(0.34,1.1,0.64,1)', boxShadow: '0 48px 120px rgba(0,0,0,0.85)' }}>
        <div style={{ height: 3, background: 'linear-gradient(90deg, #5c2a00, #ffbe4d, #e8a000, #5c2a00)', flexShrink: 0 }} />

        <div style={{ padding: isMobile ? '14px 18px' : '18px 28px', borderBottom: '1px solid rgba(255,190,77,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, letterSpacing: '0.3em', color: 'rgba(255,190,77,0.35)', margin: '0 0 4px' }}>ROTEIRO — BIBLIOTECA</p>
            <h2 style={{ fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 17 : 22, fontWeight: 700, color: '#fff', margin: '0 0 2px' }}>{displayTitle}</h2>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.38)', margin: '0 0 4px', fontWeight: 300 }}>{book.author}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#ffbe4d' }}>{book.score}/10</span>}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </div>
        </div>

        {/* Campo de tema — aparece só antes de gerar */}
        {!generated && (
          <div style={{ padding: isMobile ? '14px 16px' : '16px 28px', borderBottom: '1px solid rgba(255,190,77,0.07)', flexShrink: 0 }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.25em', color: 'rgba(255,190,77,0.45)', margin: '0 0 10px' }}>SOBRE O QUE VOCÊ QUER FALAR?</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                value={topic}
                onChange={e => { setTopic(e.target.value); setTopicError(false); }}
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                placeholder="ex: gestão de pessoas, liderança, motivação..."
                style={{ flex: 1, minWidth: 200, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.04)', border: topicError ? '1px solid rgba(255,80,80,0.5)' : '1px solid rgba(255,190,77,0.2)', borderRadius: 8, padding: '10px 14px', outline: 'none' }}
                autoFocus
              />
              <button onClick={handleGenerate} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.18em', color: '#0a0700', background: 'linear-gradient(135deg, #ffbe4d 0%, #e8a000 100%)', border: 'none', borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>GERAR →</button>
            </div>
            {topicError && <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,80,80,0.7)', margin: '6px 0 0' }}>Digite o assunto do roteiro para continuar</p>}
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,190,77,0.4)', margin: '10px 0 0', fontWeight: 300 }}>✨ Inspirado no universo de <strong style={{ color: 'rgba(255,190,77,0.7)', fontWeight: 500 }}>{displayTitle}</strong></p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              {[{ v: platform, fn: setPlatform, opts: PLATFORMS }, { v: style, fn: setStyle, opts: STYLES }].map((s, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <select value={s.v} onChange={e => s.fn(e.target.value)} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,190,77,0.12)', borderRadius: 6, padding: '6px 28px 6px 12px', cursor: 'pointer', appearance: 'none' }}>
                    {s.opts.map(([v, l]) => <option key={v} value={v} style={{ background: '#0a0700' }}>{l}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: 'rgba(255,255,255,0.22)', pointerEvents: 'none' }}>▾</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barra de controles — aparece depois de gerar */}
        {generated && (
          <div style={{ padding: isMobile ? '10px 16px' : '12px 28px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,190,77,0.5)', fontStyle: 'italic', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>"{topic}"</span>
            <button onClick={() => { setGenerated(false); generator.reset(); }} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>← MUDAR</button>
            <button onClick={handleRegenerate} disabled={generator.loading} style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.18em', color: generator.loading ? 'rgba(255,190,77,0.25)' : '#ffbe4d', background: 'rgba(255,190,77,0.05)', border: '1px solid rgba(255,190,77,0.15)', borderRadius: 6, padding: '7px 14px', cursor: generator.loading ? 'not-allowed' : 'pointer' }}>{generator.loading ? 'GERANDO...' : '↺ REGERAR'}</button>
            {rawScript && !generator.loading && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
                {!isMobile && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)' }}>{wordCount} palavras · ~{readTime} min</span>}
                <button onClick={() => navigator.clipboard?.writeText(rawScript)} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,190,77,0.75)', background: 'transparent', border: '1px solid rgba(255,190,77,0.15)', borderRadius: 6, padding: '5px 14px', cursor: 'pointer' }}>Copiar</button>
              </div>
            )}
          </div>
        )}

        <div ref={outputRef} style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '20px 18px' : '28px 32px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,190,77,0.1) transparent' }}>
          {generator.loading && !rawScript && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 0', gap: 16 }}>
              <div style={{ fontSize: 40, animation: 'bwPulse 1.8s ease infinite', opacity: 0.5 }}>📖</div>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,0.4)', margin: '0 0 4px' }}>Criando seu roteiro...</p>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.22)', margin: 0, fontWeight: 300 }}>A IA está analisando o livro</p>
            </div>
          )}
          {generator.error && (
            <div style={{ padding: '16px 20px', background: 'rgba(180,40,40,0.08)', border: '1px solid rgba(180,40,40,0.15)', borderRadius: 8 }}>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,110,110,0.85)', margin: 0 }}>{generator.error}</p>
            </div>
          )}
          {rawScript && (
            <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: isMobile ? 13 : 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.9, fontWeight: 300, whiteSpace: 'pre-wrap' }}>
              {rawScript}
              {generator.loading && <span style={{ display: 'inline-block', width: 2, height: 14, background: '#ffbe4d', marginLeft: 3, animation: 'bwPulse 0.8s ease infinite', verticalAlign: 'text-bottom' }} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function BooksWorld() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('Todos');
  const [selectedBook, setSelectedBook] = useState(null);
  const generator = useScriptGenerator();
  const [savedScripts, setSavedScripts] = useState(() => { try { return JSON.parse(localStorage.getItem('viralnews_saved_scripts') || '[]'); } catch { return []; } });

  const saveCurrentScript = (book, rawScript) => {
    const entry = { id: Date.now(), title: book.title, author: book.author, script: rawScript, savedAt: new Date().toISOString() };
    const updated = [entry, ...savedScripts].slice(0, 50);
    setSavedScripts(updated);
    localStorage.setItem('viralnews_saved_scripts', JSON.stringify(updated));
  };
  const [apiBooks, setApiBooks] = useState([]);
  const [highlightedIndices, setHighlightedIndices] = useState([]);
  const [personaSelection, setPersonaSelection] = useState(null);
  const [searching, setSearching] = useState(false);

  const filtered = BOOKS.filter(b => {
    const s = search.toLowerCase();
    const displayTitle = (DISPLAY_TITLES[b.title] || b.title).toLowerCase();
    return (!search || displayTitle.includes(s) || b.title.toLowerCase().includes(s) || b.author.toLowerCase().includes(s))
      && (cat === 'Todos' || b.cat === cat);
  });

  // Busca na API quando não tem resultado local
  useEffect(() => {
    if (!search || search.length < 3 || filtered.length > 0) {
      setApiBooks([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/niche?q=${encodeURIComponent(search + ' livro')}`);
        const data = await res.json();
        const books = (data.books || []).map(b => ({
          title: b.title,
          author: b.authors || b.description || '',
          cat: 'Busca',
          score: b.viral_score || 7,
          _api: true,
          _image: b.image,
          _url: b.url,
          _rating: b.rating,
        }));
        setApiBooks(books);
      } catch (e) {
        setApiBooks([]);
      } finally {
        setSearching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [search, filtered.length]);

  const displayBooks = filtered.length > 0 ? filtered : apiBooks;

  const accent = '#ffbe4d';
  const glow = '255,190,77';

  return (
    <div style={{ minHeight: '100vh', background: '#080500', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes bwFadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes bwSlideUp { from{opacity:0;transform:translateY(40px) scale(0.98);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes bwPulse { 0%,100%{opacity:1;} 50%{opacity:0.25;} }
        @keyframes bwShimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input:focus { outline: none; border-color: rgba(255,190,77,0.4) !important; box-shadow: 0 0 0 3px rgba(255,190,77,0.06); }
        select { appearance: none; -webkit-appearance: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,190,77,0.15); border-radius: 2px; }
        .bw-cat { white-space: nowrap; flex-shrink: 0; transition: all 0.15s; }
        .bw-cat:hover { border-color: rgba(255,190,77,0.3) !important; color: rgba(255,255,255,0.7) !important; }
        .bw-cat-scroll { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
        .bw-cat-scroll::-webkit-scrollbar { display: none; }
      ` }} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 15% 0%, rgba(100,55,0,0.28) 0%, transparent 50%), radial-gradient(ellipse at 85% 100%, rgba(80,40,0,0.18) 0%, transparent 50%)' }} />
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #5c2a00, #ffbe4d, #e8a000, #5c2a00)', zIndex: 200, opacity: 0.75 }} />

      <header style={{ position: 'sticky', top: 42, zIndex: 100, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px', background: 'rgba(8,5,0,0.97)', backdropFilter: 'blur(32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigate('/')} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← PORTAL</button>
          <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 10px rgba(${glow},0.9)`, animation: 'bwPulse 2.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Biblioteca</span>
          </div>
        </div>
        {!isMobile && <span style={{ position: 'fixed', top: 164, right: 28, fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.75)', zIndex: 290 }}>ACERVO</span>}
      </header>

      <div style={{ padding: isMobile ? '32px 16px 24px' : '40px 24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: `linear-gradient(180deg, rgba(${glow},0.04) 0%, transparent 100%)`, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 175, background: 'linear-gradient(180deg, rgba(8,5,0,0.97) 0%, rgba(8,5,0,0.88) 42%, rgba(8,5,0,0.45) 75%, transparent 100%)', pointerEvents: 'none', zIndex: 0 }} />
        <p style={{ position: 'relative', zIndex: 1, fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.5em', color: `rgba(${glow},0.6)`, marginBottom: 10, marginTop: 8 }}>ROTEIROS VIRAIS</p>
        <h1 style={{ position: 'relative', zIndex: 1, fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 'clamp(32px,10vw,48px)' : 'clamp(40px,6vw,64px)', fontWeight: 900, margin: '0 0 6px', lineHeight: 0.92, letterSpacing: '-2px' }}>
          <span style={{ fontStyle: 'italic', color: '#fff' }}>Livros</span>{' '}
          <span style={{ color: 'transparent', WebkitTextStroke: `1.5px rgba(${glow},0.8)` }}>Virais</span>
        </h1>
        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '8px 0 0', fontWeight: 300 }}>Roteiros originais inspirados no universo temático das obras · Não reproduzem o conteúdo oficial</p>
      </div>

      <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(8,5,0,0.65)', backdropFilter: 'blur(20px)', position: 'sticky', top: 98, zIndex: 40 }}>
        <div className="bw-cat-scroll" style={{ width: '100%' }}>
          {CATS.map(c => (
            <button key={c} className="bw-cat" onClick={() => setCat(c)} style={{ padding: '6px 16px', borderRadius: 20, border: cat === c ? `1px solid rgba(${glow},0.6)` : '1px solid rgba(255,255,255,0.08)', background: cat === c ? `rgba(${glow},0.15)` : 'rgba(255,255,255,0.04)', color: cat === c ? accent : 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{c}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 80px' : '28px 24px 100px', position: 'relative', zIndex: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: isMobile ? '100%' : 360 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'rgba(255,255,255,0.2)', pointerEvents: 'none' }}>⌕</span>
            <input type="text" placeholder="Buscar título ou autor..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.065)', borderRadius: 10, padding: '10px 14px 10px 38px', fontSize: 13, color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 300 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: `rgba(${glow},0.5)` }}>{filtered.length} LIVROS</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,229,176,0.5)' }}>{filtered.filter(b => b.score >= 9).length} ULTRA VIRAL</span>
          </div>
        </div>

        {searching ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,190,77,0.6)' }}>BUSCANDO...</p>
          </div>
        ) : displayBooks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '100px 0', border: '1px dashed rgba(255,190,77,0.1)', borderRadius: 16 }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>SEM RESULTADOS</p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.22)', fontWeight: 300 }}>Tente outra busca ou categoria</p>
          </div>
        ) : (
          {highlightedIndices.length > 0 && activePersonaKey && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 18px', marginBottom: 14,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              animation: 'bwSlideUp 0.4s ease',
            }}>
              <span style={{ fontSize: 20 }}>
                {{'lira': '🎙️', 'atlas': '🌍', 'faisca': '⚡'}[activePersonaKey]}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
                  {{'lira': 'Lira', 'atlas': 'Atlas', 'faisca': 'Faísca'}[activePersonaKey]} selecionou {highlightedIndices.length} livros para você
                </p>
                <p style={{ margin: '2px 0 0', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                  Role a página para ver os destaques · Clique em um para gerar o roteiro
                </p>
              </div>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
                OS OUTROS FICARAM EM 2º PLANO
              </span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {displayBooks.map((book, i) => (
              <BookCard key={book.title + book.author} book={book} index={i} onClick={(b) => { if (highlightedIndices.includes(i) && activePersonaKey) { setPersonaSelection({ book: b, personaKey: activePersonaKey }); } else { setSelectedBook(b); } }} highlighted={highlightedIndices.length > 0 && highlightedIndices.includes(i)} dimmed={highlightedIndices.length > 0 && !highlightedIndices.includes(i)} />
            ))}
          </div>
        )}
      </div>

      <BookChat
        books={BOOKS}
        onHighlight={setHighlightedIndices}
        onPersonaChange={setActivePersonaKey}
        onSelectBook={(book, personaKey) => personaKey ? setPersonaSelection({ book, personaKey }) : setSelectedBook(book)}
      />

      {personaSelection && (
        <PersonaModal
          book={personaSelection.book}
          personaKey={personaSelection.personaKey}
          onClose={() => setPersonaSelection(null)}
        />
      )}

      {selectedBook && (
        <BooksModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          isMobile={isMobile}
          generator={generator}
          onSave={() => saveCurrentScript(selectedBook, generator.script)}
        />
      )}
    </div>
  );
}

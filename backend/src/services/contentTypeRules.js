export function detectContentType(source = '', url = '', title = '') {
  const s = (source + url + title).toLowerCase();

  const scienceSources = ['pubmed', 'nature', 'science', 'cell', 'lancet', 'nejm', 'jama', 'biorxiv', 'medrxiv', 'arxiv', 'sciencedirect', 'springer', 'wiley', 'oxford', 'med sci', 'plos', 'frontiers', 'elife', 'pnas'];
  const bookSources = ['book', 'livro', 'goodreads', 'amazon books', 'kindle', 'audible', 'blinkist'];
  const newsSources = ['bbc', 'cnn', 'g1', 'globo', 'folha', 'uol', 'reuters', 'ap ', 'associated press', 'nytimes', 'guardian', 'washingtonpost', 'forbes', 'bloomberg', 'techcrunch', 'wired'];

  if (scienceSources.some(k => s.includes(k))) return 'science';
  if (bookSources.some(k => s.includes(k))) return 'book';
  if (newsSources.some(k => s.includes(k))) return 'news';
  return 'news';
}

export const CONTENT_TYPE_RULES = {
  science: {
    label: 'Scientific Article',
    substanceRule: `
AUDIENCE: Educated viewers — students, researchers, professionals, curious people who read papers. They will fact-check you. They will notice vague claims. They respect precision and lose trust at the first exaggeration.

SCIENCE SCRIPT RULES — ALL MANDATORY:

1. EXPLAIN THE MECHANISM, NOT JUST THE RESULT
   Wrong: "Scientists discovered that exercise is good for the brain."
   Right: "Exercise increases BDNF — a protein that triggers the growth of new neurons in the hippocampus, the region responsible for memory formation. The effect is measurable within 6 weeks."

2. ESTABLISH THE BEFORE STATE
   What did the scientific community believe before this study? What was the gap in knowledge? This contrast is what makes the discovery meaningful. Without it, nothing feels new.

3. DESCRIBE THE METHODOLOGY BRIEFLY
   Who was studied? How many subjects? Over what period? What was measured? One sentence is enough — but it builds credibility. "A study with 847 participants over 18 months measured..." is infinitely more trustworthy than "scientists studied this."

4. USE THE EXACT DATA FROM THE ARTICLE
   Percentages, sample sizes, p-values if relevant, effect sizes, timeframes. If the article says "42% reduction in cortisol levels", use that number. Never round down to "significant reduction."

5. EXPLAIN THE IMPLICATION PRECISELY
   What does this finding change in practice? For a doctor, a patient, a researcher? Be specific. "This means that existing drugs targeting X pathway may now be repurposed for Y condition" is good. "This changes everything" is forbidden.

6. ACKNOWLEDGE LIMITATIONS HONESTLY
   If the study is preliminary, in animals, or has a small sample — say so. Educated viewers respect this. It builds trust. "This was tested in mice, so human trials are the next step" is credible. Hiding limitations destroys credibility.

7. FORBIDDEN COMPLETELY:
   - Hyperbolic language: "inacreditável", "mudou tudo", "revolucionário", "jamais imaginávamos"
   - Vague conclusions: "isso muda tudo sobre como vemos o cérebro"
   - Invented implications: never extrapolate beyond what the article states
   - Emotional manipulation: the content is powerful on its own — trust it

TONE: Precise, clear, respectful of the viewer's intelligence. Like a brilliant professor who makes complex things simple without dumbing them down. Kurzgesagt, not sensationalism.

QUALITY CHECK: A researcher in this field should watch your video and think "that was accurate and well explained" — not "that was oversimplified" or "that was wrong."`,

    openingRule: `Open by establishing what was UNKNOWN or MISUNDERSTOOD before this study — the scientific gap. Then the discovery fills that gap. This structure creates intellectual satisfaction, not just shock.
Do NOT open with hype. Open with a precise, concrete question or observation that the study answers.`,

    exampleGood: `"Por décadas, sabíamos que o exercício físico melhorava o humor. Mas o mecanismo exato era desconhecido. [BEAT] Em 2024, um estudo com 312 participantes publicado na Nature Neuroscience mediu algo diferente: a concentração de BDNF no hipocampo antes e depois de 8 semanas de exercício aeróbico. [PAUSE] O resultado foi uma elevação média de 34% nos níveis dessa proteína — a mesma proteína que regula a formação de novas sinapses. [SLOW DOWN] Em linguagem simples: o exercício literalmente reconstrói partes do cérebro responsáveis pela memória. Não é metáfora. É neuroplasticidade mensurável."`,

    exampleBad: `"A neurociência mudou TUDO em 2025. [BEAT] Por décadas a gente não sabia NADA sobre o cérebro, mas agora cientistas descobriram algo INACREDITÁVEL que vai revolucionar a medicina para sempre..."`,
  },

  news: {
    label: 'News Article',
    substanceRule: `
AUDIENCE: People who want to understand what actually happened — not just that something happened. They are tired of vague headlines. Give them the facts, the context, and the real consequence.

NEWS CONTENT RULES — ALL MANDATORY:

1. THE FACTS FIRST: Who did what, when, where, how much. Specific names, organizations, numbers, dates. Never "authorities" — name them. Never "a lot of money" — give the figure.

2. THE CONTEXT: Why does this event matter NOW? What led to it? One or two sentences of background that makes the event make sense, not just feel dramatic.

3. THE REAL IMPACT: Connect the event to a concrete effect on the viewer's daily life, money, safety, rights, or future. Not abstract — specific. "This affects your X because Y."

4. THE NEXT DOMINO: What happens next as a direct consequence of this event? What should the viewer watch for in the coming days or weeks?

5. FORBIDDEN: Vague language — "authorities say", "experts warn", "sources indicate" with no attribution. If you cannot name the source, explain why briefly. Round numbers are lazy — use what the article states.

QUALITY CHECK: A viewer should be able to explain to a friend exactly what happened, why it matters, and what comes next.`,

    openingRule: 'Open mid-event — drop the viewer into the moment it happened or the moment everything changed. Specific time, specific place, specific action.',

    exampleGood: `"Na última terça, o Banco Central bloqueou R$ 2,3 bilhões em transações de 47 fintechs brasileiras. [BEAT] Não foi erro técnico. Foi uma ação coordenada após auditoria identificar irregularidades em processos de KYC — verificação de identidade de clientes. [PAUSE] O que isso significa na prática: se você tem conta em alguma dessas plataformas, transferências podem estar temporariamente suspensas. A lista completa foi publicada no Diário Oficial desta manhã."`,

    exampleBad: `"Uma notícia importante está sacudindo o mercado financeiro. Especialistas estão preocupados com os recentes desenvolvimentos que podem afetar muitas pessoas de formas significativas..."`,
  },

  book: {
    label: 'Book',
    substanceRule: `
AUDIENCE: People who want to learn something they can use today. They are not looking for a book review or a summary — they want to walk away with one idea they can apply immediately.

BOOK CONTENT RULES — ALL MANDATORY:

1. OPEN WITH A SCENE THE VIEWER HAS LIVED
   A specific situation, frustration, or failure the viewer recognizes from their own life. The book is the solution to that situation — not the subject of the video.

2. THE ONE BIG COUNTERINTUITIVE IDEA
   What does the book argue that goes against conventional wisdom? This is the hook. "Most people think X. The author spent Y years researching this and found the opposite is true."

3. EXPLAIN HOW IT WORKS
   What is the mechanism behind the idea? Not just "habits are important" — but "the habit loop has three parts: cue, routine, reward — and most people try to change the routine without touching the cue, which is why they fail."

4. APPLY IT IN A CONCRETE DAILY SITUATION
   Give ONE specific example: a decision, a conversation, a routine, a moment where this idea changes the outcome. Make it granular. "When your colleague sends a passive-aggressive email, instead of responding immediately, the book suggests waiting 20 minutes and then..."

5. THE PROOF FROM THE BOOK
   One specific story, study, or example the author uses. Real name, real situation, real result.

6. FORBIDDEN:
   - "O livro fala sobre..." as an opener
   - Summarizing chapters
   - Listing multiple ideas — pick the ONE most powerful
   - Ending without a concrete action the viewer can take today

QUALITY CHECK: A viewer should finish watching and think "I need to try this today" — not "interesting, I might read that someday."`,

    openingRule: 'Open with a real situation the viewer has faced — a failure, a frustration, a recurring problem. The book is the unexpected solution. Reveal it like a plot twist, not like a book report.',

    exampleGood: `"Você já tentou criar um hábito e desistiu em duas semanas? [BEAT] Não foi falta de disciplina. Foi porque você tava tentando mudar a coisa errada. [PAUSE] James Clear estudou os hábitos de atletas olímpicos, músicos de elite e CEOs por anos. E o que ele descobriu é contra-intuitivo: nenhum deles foca em objetivos. Eles focam em sistemas. [SLOW DOWN] A diferença é essa: um objetivo é 'quero correr uma maratona'. Um sistema é 'toda manhã, quando tomar café, coloco o tênis antes de sentar no computador'. O tênis já na porta é o gatilho. E gatilhos são mais poderosos que motivação."`,

    exampleBad: `"Atomic Habits é um bestseller escrito por James Clear. O livro explica que pequenos hábitos fazem grande diferença. O autor acredita que mudanças incrementais levam a resultados extraordinários ao longo do tempo..."`,
  },
};

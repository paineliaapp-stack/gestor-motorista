# ViralNews AI 🚀

> **Turn real-time news into viral video scripts** — powered by Groq LLaMA 3 70B + NewsAPI

A production-ready SaaS MVP for content creators who want to generate platform-optimized viral scripts from trending news in seconds.

---

## ✨ Features

### Phase 1 (Core)
- 📡 **Trending News Engine** — Fetches live news with internal viral scoring (1–10)
- 🤖 **AI Script Generator** — Full scripts via Groq LLaMA 3 70B
- 🎯 **Platform Optimization** — TikTok, YouTube Shorts, YouTube Long-Form
- 🎨 **4 Script Styles** — Dark Channel, Storytelling, Controversial, Educational
- 📋 **Rich Output** — 3 hooks, full script, 3 title variants, CTA, hashtags, thumbnail idea
- 📋 **Copy Everywhere** — One-click copy for every section

### Phase 2 (Included)
- 🔄 **3 Script Versions** — Generate different takes with 1 click
- ♻️ **Regenerate Hooks Only** — Keep your script, refresh just the hooks
- 💾 **Save Scripts Locally** — localStorage-based, no backend DB needed
- 🌙 **Dark Mode** — Full dark UI by default

---

## 🏗️ Architecture

```
viralnews-ai/
├── backend/                 # Node.js + Express API
│   └── src/
│       ├── config/          # Environment config
│       ├── middleware/      # Error handling
│       ├── routes/
│       │   ├── news.js      # GET /api/news
│       │   └── generate.js  # POST /api/generate
│       └── services/
│           ├── newsService.js     # NewsAPI integration + caching
│           ├── aiService.js       # Groq AI + dynamic prompt engine
│           └── scoringService.js  # Viral score algorithm
│
└── frontend/               # React + Vite + Tailwind
    └── src/
        ├── components/
│       │   ├── layout/     # Header
│       │   ├── news/       # NewsCard, NewsGrid, NewsFilters, StatsBar
│       │   ├── script/     # ScriptModal, ScriptOutput, Selectors, SavedDrawer
│       │   └── ui/         # CopyButton
        ├── hooks/           # useNews, useScriptGenerator, useCopyToClipboard
        ├── services/        # api.js (axios client), storage.js (localStorage)
        └── utils/           # Formatters, score helpers, config maps
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- [NewsAPI key](https://newsapi.org) (free tier: 100 req/day)
- [Groq API key](https://console.groq.com) (free tier available)

### 1. Clone & Install

```bash
git clone <repo>
cd viralnews-ai

# Install all dependencies
npm install
npm run install:all
```

### 2. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
PORT=3001
NODE_ENV=development
NEWS_API_KEY=your_newsapi_key_here
GROQ_API_KEY=your_groq_api_key_here
CORS_ORIGIN=http://localhost:5173
```

### 3. Run in Development

```bash
# Option A: Run both together (requires root npm install)
npm run dev

# Option B: Run separately
npm run dev:backend   # → http://localhost:3001
npm run dev:frontend  # → http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 📡 API Reference

### `GET /api/news`

Fetch trending articles with viral scores.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | string | `general` | `general`, `technology`, `business`, `entertainment`, `health`, `science`, `sports` |
| `q` | string | — | Search query |
| `country` | string | `us` | Country code |

**Response:**
```json
{
  "success": true,
  "count": 32,
  "articles": [
    {
      "id": "article_0_...",
      "title": "...",
      "description": "...",
      "url": "...",
      "image": "...",
      "source": "BBC News",
      "publishedAt": "2025-01-01T10:00:00Z",
      "viral_score": 9,
      "score_label": "ULTRA VIRAL",
      "score_color": "red"
    }
  ]
}
```

---

### `POST /api/generate`

Generate a viral script.

**Body:**
```json
{
  "article": { "title": "...", "description": "...", "viral_score": 8 },
  "platform": "youtube_shorts",
  "style": "storytelling",
  "version": 1
}
```

**Platforms:** `tiktok` | `youtube_shorts` | `youtube_long`  
**Styles:** `dark_channel` | `storytelling` | `controversial` | `educational`

**Response:**
```json
{
  "success": true,
  "script": {
    "hooks": ["Hook 1", "Hook 2", "Hook 3"],
    "script": "Full script text...",
    "titles": ["Title A", "Title B", "Title C"],
    "cta": "Call to action...",
    "hashtags": ["viral", "news", "..."],
    "thumbnail_idea": "...",
    "best_posting_time": "...",
    "estimated_views": "50K–200K"
  }
}
```

---

### `POST /api/generate/hooks`

Regenerate hooks only.

**Body:**
```json
{
  "article": { "title": "...", "viral_score": 7 },
  "platform": "tiktok",
  "style": "controversial",
  "existingHooks": ["Old hook 1", "Old hook 2"]
}
```

---

## 🧠 Viral Scoring Algorithm

The `scoringService.js` scores each article on 4 dimensions:

| Factor | Weight | Logic |
|--------|--------|-------|
| **Keywords** | 0–5 pts | Tier 1 (scandal, war, crash): 2.5 pts each. Tier 2 (celebrity, AI, money): 1.5 pts. Tier 3 (record, biggest): 0.8 pts |
| **Emotion** | 0–2 pts | Emotional words, exclamation marks, ALL CAPS |
| **Title Length** | 0–1.5 pts | Sweet spot: 60–90 chars = max score |
| **Recency** | 0–1.5 pts | <1h = 1.5pts, <6h = 1.2pts, <24h = 0.6pts |

Final score is clamped to **1–10**.

---

## 🎨 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express 4 |
| AI | Groq SDK (LLaMA 3 70B) |
| News | NewsAPI.org |
| Fonts | Syne (display), DM Sans (body), JetBrains Mono |
| State | React hooks (no Redux needed) |
| Storage | localStorage (no DB) |

---

## 🔧 Configuration

### Rate Limits (backend)
- News API: 100 req / 15 min
- Generate: 10 req / 1 min (per IP)
- News cache: 10 minute TTL

### Extending the Viral Scorer
Edit `backend/src/services/scoringService.js` — add keywords to any tier:
```js
tier1: ['your', 'keyword', 'here'],
```

### Adding New Platforms/Styles
Edit `backend/src/services/aiService.js`:
```js
const PLATFORM_SPECS = {
  instagram_reels: {
    name: 'Instagram Reels',
    duration: '15–30 seconds',
    // ...
  }
};
```
Then add the display config in `frontend/src/utils/index.js`.

---

## 🚢 Production Deployment

### Backend (Railway, Render, Fly.io)
```bash
cd backend
npm start
```
Set env vars in your platform dashboard.

### Frontend (Vercel, Netlify)
```bash
cd frontend
npm run build
# Deploy /dist folder
```

Set `VITE_API_URL=https://your-backend.com/api` in frontend env.

---

## 📦 Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install all dependencies |
| `npm run dev` | Run both backend + frontend concurrently |
| `npm run dev:backend` | Run backend only |
| `npm run dev:frontend` | Run frontend only |
| `npm run build` | Build frontend for production |

---

## 📄 License

MIT — build something viral.

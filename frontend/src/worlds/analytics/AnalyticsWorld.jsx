import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const accent = '#ff0000';
const glow = '255,50,50';
const gold = '#ffbe4d';

function fmt(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return String(n);
}

function parseDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '0:00';
  const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${min}:${String(s).padStart(2,'0')}`;
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(${glow},0.15)`, borderRadius: 16, padding: '20px 24px', flex: 1, minWidth: 140 }}>
      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px' }}>{label}</p>
      <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 32, fontWeight: 700, color: color || accent, margin: 0, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '6px 0 0' }}>{sub}</p>}
    </div>
  );
}

function VideoCard({ video, rank }) {
  const [hovered, setHovered] = useState(false);
  const scoreColor = video.viral_score >= 8 ? '#00e5b0' : video.viral_score >= 5 ? gold : 'rgba(255,255,255,0.4)';
  const scoreLabel = video.viral_score >= 8 ? 'VIRAL' : video.viral_score >= 5 ? 'BOM' : 'NORMAL';

  return (
    <a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', gap: 16, alignItems: 'center',
          background: hovered ? 'rgba(255,50,50,0.06)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${hovered ? `rgba(${glow},0.3)` : 'rgba(255,255,255,0.06)'}`,
          borderRadius: 14, padding: 14, transition: 'all 0.2s', cursor: 'pointer',
        }}
      >
        {/* Rank */}
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.2)', minWidth: 24, textAlign: 'center' }}>#{rank}</div>

        {/* Thumbnail */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img src={video.thumbnail} alt="" style={{ width: 100, height: 56, borderRadius: 8, objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.8)', borderRadius: 4, padding: '1px 4px', fontFamily: 'Space Mono, monospace', fontSize: 9, color: '#fff' }}>
            {parseDuration(video.duration)}
          </div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: '#fff', margin: '0 0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title}</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>👁 {fmt(video.views)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>👍 {fmt(video.likes)}</span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>💬 {fmt(video.comments)}</span>
          </div>
        </div>

        {/* Score */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{video.viral_score}</div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.1em', color: scoreColor, marginTop: 2 }}>{scoreLabel}</div>
        </div>
      </div>
    </a>
  );
}

export function AnalyticsWorld() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('views');

  useEffect(() => {
    const niches = (() => { try { return JSON.parse(localStorage.getItem('vn_niches') || '[]'); } catch { return []; } })();
    const activeNicheId = (() => { try { return localStorage.getItem('vn_active_niche_id') || ''; } catch { return ''; } })();
    const activeNiche = niches.find(n => n.id === activeNicheId) || niches[0];
    const apiKey = activeNiche ? localStorage.getItem('vn_yt_api_key_' + activeNiche.id) || '' : '';
    const channelId = activeNiche ? localStorage.getItem('vn_yt_channel_id_' + activeNiche.id) || '' : '';
    const qs = (apiKey && channelId) ? `?apiKey=${encodeURIComponent(apiKey)}&channelId=${encodeURIComponent(channelId)}` : '';
    fetch('/api/youtube' + qs)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); try { localStorage.setItem("vn_my_channel", JSON.stringify(d.channel)); } catch {} })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const sorted = data?.videos ? [...data.videos].sort((a, b) => {
    if (sort === 'views') return b.views - a.views;
    if (sort === 'likes') return b.likes - a.likes;
    if (sort === 'score') return b.viral_score - a.viral_score;
    if (sort === 'date') return new Date(b.publishedAt) - new Date(a.publishedAt);
    return 0;
  }) : [];

  const totalViews = data?.videos?.reduce((s, v) => s + v.views, 0) || 0;
  const bestVideo = data?.videos?.reduce((a, b) => a.views > b.views ? a : b, {});

  return (
    <div style={{ minHeight: '100vh', background: '#050000', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(${glow},0.2); border-radius: 2px; }
      `}</style>

      {/* BG */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 20% 0%, rgba(255,30,30,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(180,0,0,0.1) 0%, transparent 50%)' }} />

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '32px 20px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 12px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12, fontFamily: 'DM Sans, sans-serif' }}>← Portal</button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}` }} />
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: `rgba(${glow},0.8)` }}>ANALYTICS</span>
            </div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 28, fontWeight: 700, margin: 0 }}>
              Canal <span style={{ color: accent }}>Analytics</span>
            </h1>
          </div>
          {data?.channel?.thumbnail && (
            <img src={data.channel.thumbnail} alt="" style={{ width: 48, height: 48, borderRadius: '50%', border: `2px solid rgba(${glow},0.3)`, marginLeft: 'auto' }} />
          )}
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: `rgba(${glow},0.6)` }}>CARREGANDO DADOS DO CANAL...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)' }}>
            <p>Erro ao carregar: {error}</p>
          </div>
        )}

        {data && (
          <>
            {/* Stats */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 32 }}>
              <StatCard label="INSCRITOS" value={fmt(data.channel.subscribers)} sub="no canal" />
              <StatCard label="VIEWS TOTAIS" value={fmt(data.channel.totalViews)} sub="desde o início" color={gold} />
              <StatCard label="VÍDEOS" value={data.channel.videoCount} sub="publicados" color="#00e5b0" />
              <StatCard label="MÉDIA/VÍDEO" value={fmt(Math.round(totalViews / (data.videos.length || 1)))} sub="views por vídeo" color="#a78bfa" />
            </div>

            {/* Melhor vídeo */}
            {bestVideo?.title && (
              <div style={{ background: 'rgba(255,190,77,0.05)', border: '1px solid rgba(255,190,77,0.15)', borderRadius: 14, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>🏆</span>
                <div>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.15em', color: gold, margin: '0 0 4px' }}>MELHOR VÍDEO</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500, color: '#fff', margin: 0 }}>{bestVideo.title}</p>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{fmt(bestVideo.views)} views · {fmt(bestVideo.likes)} likes</p>
                </div>
              </div>
            )}

            {/* Sort */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)' }}>ORDENAR:</span>
              {[['views','👁 Views'],['likes','👍 Likes'],['score','⚡ Score'],['date','📅 Data']].map(([k, l]) => (
                <button key={k} onClick={() => setSort(k)} style={{
                  background: sort === k ? `rgba(${glow},0.15)` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${sort === k ? `rgba(${glow},0.4)` : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, padding: '5px 12px', color: sort === k ? accent : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer', fontSize: 11, fontFamily: 'DM Sans, sans-serif', transition: 'all 0.15s'
                }}>{l}</button>
              ))}
            </div>

            {/* Videos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sorted.map((v, i) => <VideoCard key={v.id} video={v} rank={i + 1} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

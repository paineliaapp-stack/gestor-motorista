import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const planos = [
  { id: 'basic', title: 'Plano Basic', price: 29.90, description: 'Acesso a notícias e geração de scripts' },
  { id: 'pro', title: 'Plano Pro', price: 59.90, description: 'Tudo do Basic + ciência e nichos' },
  { id: 'ultra', title: 'Plano Ultra', price: 97.00, description: 'Acesso completo + suporte prioritário' },
];

export function Planos() {
  const [loading, setLoading] = useState(null);

  async function handleCheckout(plano) {
    setLoading(plano.id);
    try {
      const res = await fetch(`${API}/api/payment/create-preference`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: plano.title, price: plano.price, quantity: 1 }),
      });
      const data = await res.json();
      if (data.init_point) window.location.href = data.init_point;
    } catch (err) {
      console.error(err);
      alert('Erro ao iniciar pagamento. Tente novamente.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#07070f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: '-apple-system, SF Pro Text, sans-serif',
    }}>
      <h1 style={{ color: '#fff', fontSize: 32, marginBottom: 8 }}>Escolha seu plano</h1>
      <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 48 }}>Cancele quando quiser</p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
        {planos.map(plano => (
          <div key={plano.id} style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: '32px 28px',
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
          }}>
            <h2 style={{ color: '#fff', fontSize: 20, margin: 0 }}>{plano.title}</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', margin: 0 }}>{plano.description}</p>
            <div style={{ color: '#fff', fontSize: 36, fontWeight: 700 }}>
              R$ {plano.price.toFixed(2).replace('.', ',')}
              <span style={{ fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.4)' }}>/mês</span>
            </div>
            <button
              onClick={() => handleCheckout(plano)}
              disabled={loading === plano.id}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 10,
                border: 'none',
                background: loading === plano.id ? 'rgba(255,255,255,0.1)' : '#009ee3',
                color: '#fff',
                fontSize: 16,
                fontWeight: 600,
                cursor: loading === plano.id ? 'not-allowed' : 'pointer',
              }}
            >
              {loading === plano.id ? 'Aguarde...' : 'Assinar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

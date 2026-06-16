-- Eventos da landing page para medir conversão dos anúncios.
-- Cada linha é um evento: visita na página ou clique num botão.
CREATE TABLE IF NOT EXISTS eventos_landing (
    id BIGSERIAL PRIMARY KEY,
    tipo TEXT NOT NULL,            -- 'visita', 'clique_gratis', 'clique_assinar'
    criado_em TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos_landing (tipo);
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos_landing (criado_em);

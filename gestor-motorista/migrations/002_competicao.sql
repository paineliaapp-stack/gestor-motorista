-- Anti-burla do Card do Dia: congela a meta no primeiro toque do dia.
-- Mudar a meta depois NÃO altera o ranking daquele dia.
CREATE TABLE IF NOT EXISTS metas_dia (
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  data DATE NOT NULL,
  meta DECIMAL(10,2) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (motorista_id, data)
);

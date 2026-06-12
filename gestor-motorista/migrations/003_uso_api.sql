-- Contador de uso de API por usuário (mede custo Gemini real, não faturamento)
CREATE TABLE IF NOT EXISTS uso_api (
  motorista_id UUID NOT NULL REFERENCES motoristas(id),
  data DATE NOT NULL,
  chamadas INTEGER DEFAULT 0,
  PRIMARY KEY (motorista_id, data)
);

-- Modo motoboy: registra com qual veículo o ganho foi feito (carro/moto)
-- Permite ver no histórico quanto fez em cada modo de trabalho.
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS veiculo TEXT;

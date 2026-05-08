import express from 'express';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { config } from '../config/index.js';

const router = express.Router();
const client = new MercadoPagoConfig({ accessToken: config.mpAccessToken });

router.get('/config', (_req, res) => {
  res.json({ publicKey: config.mpPublicKey });
});

router.post('/create-preference', async (req, res) => {
  try {
    const { title, price, quantity = 1 } = req.body;
    const preference = new Preference(client);
    const result = await preference.create({
      body: {
        items: [{ title, unit_price: Number(price), quantity }],
        back_urls: {
          success: `${config.corsOrigin}/payment/success`,
          failure: `${config.corsOrigin}/payment/failure`,
          pending: `${config.corsOrigin}/payment/pending`,
        },
        auto_return: 'approved',
      },
    });
    res.json({ id: result.id, init_point: result.init_point });
  } catch (err) {
    console.error('MP error:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar preferencia' });
  }
});

router.post('/webhook', async (req, res) => {
  const { type, data } = req.body;
  if (type === 'payment') {
    const payment = new Payment(client);
    const info = await payment.get({ id: data.id });
    console.log('Pagamento recebido:', info.status, info.id);
  }
  res.sendStatus(200);
});

export default router;

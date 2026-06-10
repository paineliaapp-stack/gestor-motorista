"""Variáveis de ambiente e constantes compartilhadas."""
from dotenv import load_dotenv
load_dotenv()
import os

_ALLOWED_ORIGINS = [
    "https://gestor-motorista-production.up.railway.app",
    "http://localhost:8080",
    "http://localhost:3000",
]

# ── Push (VAPID) ──
VAPID_PUBLIC_KEY  = os.getenv("VAPID_PUBLIC_KEY", "BCy8ETKpP9jIkSHcogzLDgCUlOq3ZuKQ84nnF9Td7Wya6K-q-TUH0NIloBgDPaArR6lhEVt-KhOevVWgG8PCg98")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "MHcCAQEEIJRY2GzyzckkCKFiuCqMNYnJ+yNeLnXMjcklMTydxMq6oAoGCCqGSM49\nAwEHoUQDQgAELLwRMqk/2MiRIdyiDMsOAJSU6rdm4pDziecX1N3tbJror6r5NQfQ\n0iWgGAM9oCtHqWERW34qE569VaAbw8KD3w==")
VAPID_EMAIL       = os.getenv("VAPID_EMAIL", "mailto:admin@painelia.app")

# ── WhatsApp / Evolution API ──
ANTHROPIC_KEY = os.getenv("GEMINI_API_KEY", "")
EVOLUTION_URL = os.getenv("EVOLUTION_URL", "")
EVOLUTION_KEY = os.getenv("EVOLUTION_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "painel")


def hoje_brasil():
    import datetime as _dt
    return (_dt.datetime.utcnow() - _dt.timedelta(hours=3)).date()

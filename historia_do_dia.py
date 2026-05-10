import google.generativeai as genai
import datetime, os

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.5-flash-preview-04-17")
hoje = datetime.date.today().strftime("%d/%m/%Y")

prompt = f"""Hoje é {hoje}. Escolha UMA história real pouco conhecida e narre em português brasileiro no estilo storytelling viral:

1. Gancho: frase que gera curiosidade imediata
2. Escalada: 4 a 6 fatos reais absurdos em sequência
3. Virada: o fato mais surpreendente
4. Moral: 2 a 3 frases finais com reflexão

Regras: 100% real e verificável, tom conversacional, 120-150 palavras, zero invenção.

Ao final:
[FONTE]
- Wikipedia: (url)
- Fonte adicional: (url ou publicação)"""

print(f"\n{'='*50}\n  HISTÓRIA REAL DO DIA — {hoje}\n{'='*50}\n")

response = model.generate_content(prompt, stream=True)
for chunk in response:
    print(chunk.text, end="", flush=True)

print(f"\n{'='*50}\n")

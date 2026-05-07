/**
 * contexts/LanguageContext.jsx
 * Global language state — PT-BR / EN
 */

import { createContext, useContext, useState } from 'react';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('pt'); // default PT-BR

  const toggle = () => setLang(l => l === 'pt' ? 'en' : 'pt');

  return (
    <LanguageContext.Provider value={{ lang, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

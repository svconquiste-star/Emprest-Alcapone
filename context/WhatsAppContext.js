'use client';

import { createContext, useContext } from 'react';

const WHATSAPP_PHONE = '5531975033836';

const WhatsAppContext = createContext({
  phone: WHATSAPP_PHONE,
  buildLink: () => '',
});

export function WhatsAppProvider({ children }) {
  const buildLink = ({ nome, cidade, telefone }) => {
    const n = nome ? nome.trim() : '[NOME]';
    const c = cidade ? cidade.trim() : '[CIDADE]';
    const t = telefone || '[TELEFONE]';
    const message = `Olá! Sou ${n}. Quero falar com um especialista. Moro em ${c} e meu telefone é ${t}`;
    return `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(message)}`;
  };

  return (
    <WhatsAppContext.Provider value={{ phone: WHATSAPP_PHONE, buildLink }}>
      {children}
    </WhatsAppContext.Provider>
  );
}

export function useWhatsApp() {
  return useContext(WhatsAppContext);
}

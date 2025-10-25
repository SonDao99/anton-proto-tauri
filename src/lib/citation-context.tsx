import React, { createContext, useContext } from 'react';

interface CitationContextType {
  onCitationClick: (citationNumber: number) => void;
}

const CitationContext = createContext<CitationContextType | null>(null);

export const CitationProvider: React.FC<{
  value: CitationContextType;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <CitationContext.Provider value={value}>
      {children}
    </CitationContext.Provider>
  );
};

export const useCitationContext = () => {
  const context = useContext(CitationContext);
  if (!context) {
    throw new Error('useCitationContext must be used within a CitationProvider');
  }
  return context;
};
import { create } from 'zustand';

// Loose typing for page data — pages cast back to their specific types when reading.
// The store is an in-memory singleton (no serialization) so casts are safe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyData = any;

interface QuoteState {
  ticker: string;
  quote: AnyData;
  history: { date: string; close: number }[];
}

interface TechnicalState {
  ticker: string;
  indicators: AnyData;
  signals: AnyData;
  conviction: AnyData;
  tab: string;
}

interface FundamentalState {
  ticker: string;
  ratios: AnyData;
  dcf: AnyData;
  dividends: AnyData;
  activeTab: string;
}

interface PageStore {
  quote: QuoteState;
  technical: TechnicalState;
  fundamental: FundamentalState;
  setQuote: (s: Partial<QuoteState>) => void;
  setTechnical: (s: Partial<TechnicalState>) => void;
  setFundamental: (s: Partial<FundamentalState>) => void;
}

const defaultQuote: QuoteState = { ticker: '', quote: null, history: [] };
const defaultTechnical: TechnicalState = { ticker: '', indicators: null, signals: null, conviction: null, tab: 'indicadores' };
const defaultFundamental: FundamentalState = { ticker: '', ratios: null, dcf: null, dividends: null, activeTab: 'ratios' };

export const usePageStore = create<PageStore>((set) => ({
  quote: defaultQuote,
  technical: defaultTechnical,
  fundamental: defaultFundamental,
  setQuote: (s) => set((st) => ({ quote: { ...st.quote, ...s } })),
  setTechnical: (s) => set((st) => ({ technical: { ...st.technical, ...s } })),
  setFundamental: (s) => set((st) => ({ fundamental: { ...st.fundamental, ...s } })),
}));

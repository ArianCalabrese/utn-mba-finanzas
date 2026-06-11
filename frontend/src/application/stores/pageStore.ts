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

interface RadarState {
  source: string;
  universe: string;
  watchlistId: string;
  portfolioId: string;
  manualTickers: string[];
  result: AnyData;
}

interface ScreenerState {
  filters: AnyData;
  sort: string;
  sortAsc: boolean;
  result: AnyData;
}

interface MonteCarloState {
  rows: { ticker: string; weight: string }[];
  initial: string;
  monthly: string;
  years: string;
  target: string;
  method: string;
  nSims: string;
  result: AnyData;
}

interface PageStore {
  quote: QuoteState;
  technical: TechnicalState;
  fundamental: FundamentalState;
  radar: RadarState;
  screener: ScreenerState;
  montecarlo: MonteCarloState;
  setQuote: (s: Partial<QuoteState>) => void;
  setTechnical: (s: Partial<TechnicalState>) => void;
  setFundamental: (s: Partial<FundamentalState>) => void;
  setRadar: (s: Partial<RadarState>) => void;
  setScreener: (s: Partial<ScreenerState>) => void;
  setMonteCarlo: (s: Partial<MonteCarloState>) => void;
}

const defaultQuote: QuoteState = { ticker: '', quote: null, history: [] };
const defaultTechnical: TechnicalState = { ticker: '', indicators: null, signals: null, conviction: null, tab: 'indicadores' };
const defaultFundamental: FundamentalState = { ticker: '', ratios: null, dcf: null, dividends: null, activeTab: 'ratios' };
const defaultRadar: RadarState = { source: 'universe', universe: 'megacaps_us', watchlistId: '', portfolioId: '', manualTickers: [], result: null };
const defaultScreener: ScreenerState = { filters: { region: { value: 'us' } }, sort: 'marketcap', sortAsc: false, result: null };
const defaultMonteCarlo: MonteCarloState = {
  rows: [{ ticker: '', weight: '' }],
  initial: '10000', monthly: '500', years: '10', target: '', method: 'bootstrap', nSims: '1000',
  result: null,
};

export const usePageStore = create<PageStore>((set) => ({
  quote: defaultQuote,
  technical: defaultTechnical,
  fundamental: defaultFundamental,
  radar: defaultRadar,
  screener: defaultScreener,
  montecarlo: defaultMonteCarlo,
  setQuote: (s) => set((st) => ({ quote: { ...st.quote, ...s } })),
  setTechnical: (s) => set((st) => ({ technical: { ...st.technical, ...s } })),
  setFundamental: (s) => set((st) => ({ fundamental: { ...st.fundamental, ...s } })),
  setRadar: (s) => set((st) => ({ radar: { ...st.radar, ...s } })),
  setScreener: (s) => set((st) => ({ screener: { ...st.screener, ...s } })),
  setMonteCarlo: (s) => set((st) => ({ montecarlo: { ...st.montecarlo, ...s } })),
}));

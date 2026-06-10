import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { searchTickers, type TickerSuggestion } from '@/application/api/market';
import './TickerInput.css';

interface TickerInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked (or the same as onChange with the chosen symbol). */
  onSelect?: (symbol: string) => void;
  placeholder?: string;
  style?: CSSProperties;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Forwarded to the input — e.g. to let a parent <form> submit on Enter. */
  onEnter?: () => void;
}

export function TickerInput({
  value,
  onChange,
  onSelect,
  placeholder = 'Ej: AAPL',
  style,
  autoFocus,
  disabled,
  onEnter,
}: TickerInputProps) {
  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const justPicked = useRef(false);

  // Debounced search after the 2nd character.
  useEffect(() => {
    const q = value.trim();
    if (justPicked.current) { justPicked.current = false; return; }
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }

    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchTickers(q);
        if (cancelled) return;
        setSuggestions(res);
        setOpen(res.length > 0);
        setHighlight(-1);
      } catch {
        if (!cancelled) { setSuggestions([]); setOpen(false); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => { cancelled = true; clearTimeout(t); };
  }, [value]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pick = (s: TickerSuggestion) => {
    justPicked.current = true;
    onChange(s.symbol);
    onSelect?.(s.symbol);
    setOpen(false);
    setSuggestions([]);
    setHighlight(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (open && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight(h => (h + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight(h => (h <= 0 ? suggestions.length - 1 : h - 1));
        return;
      }
      if (e.key === 'Enter' && highlight >= 0) {
        e.preventDefault();
        pick(suggestions[highlight]);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
    }
    if (e.key === 'Enter') onEnter?.();
  };

  return (
    <div className="ticker-input" ref={wrapRef}>
      <input
        value={value}
        placeholder={placeholder}
        style={style}
        autoFocus={autoFocus}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        onChange={e => onChange(e.target.value.toUpperCase())}
        onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="ticker-suggestions">
          {suggestions.map((s, i) => (
            <li
              key={`${s.symbol}-${s.exchange}`}
              className={i === highlight ? 'active' : ''}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={e => { e.preventDefault(); pick(s); }}
            >
              <span className="ticker-suggestion-symbol">{s.symbol}</span>
              <span className="ticker-suggestion-name">{s.name}</span>
              <span className="ticker-suggestion-meta">{s.exchange}</span>
            </li>
          ))}
        </ul>
      )}
      {loading && value.trim().length >= 2 && !open && (
        <div className="ticker-loading">Buscando…</div>
      )}
    </div>
  );
}

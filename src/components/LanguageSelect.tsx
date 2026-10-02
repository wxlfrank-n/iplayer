import {useEffect, useId, useRef, useState} from 'react';
import {LOCALE_IDS, type LocaleId} from '../i18n';
import {onOutsideDismiss} from '../utils/listener';
import './LanguageSelect.css';

/**
 * Custom language dropdown (button + listbox).
 *
 * Native <option> styling is unreliable across browsers, so the picker is a
 * keyboard-accessible listbox: a trigger button showing the selected locale in
 * its own endonym, and a themed popup list with arrow-key navigation.
 */

const OPTION_LABELS: Record<LocaleId, string> = {
  en: 'English',
  zh: '中文',
};

interface LanguageSelectProps {
  value: LocaleId;
  onChange: (locale: LocaleId) => void;
  label: string;
}

export function LanguageSelect({value, onChange, label}: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, LOCALE_IDS.indexOf(value)),
  );

  // Reset the highlight to the current value whenever the list opens, so an
  // externally changed value (e.g. "Reset all") is reflected on the next open.
  const openList = () => {
    setActiveIndex(Math.max(0, LOCALE_IDS.indexOf(value)));
    setOpen(true);
  };

  // Close on outside pointer press and on Escape.
  useEffect(() => {
    if (!open) return;
    return onOutsideDismiss(rootRef.current, () => setOpen(false));
  }, [open]);

  const select = (id: LocaleId) => {
    onChange(id);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => (i + 1) % LOCALE_IDS.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => (i - 1 + LOCALE_IDS.length) % LOCALE_IDS.length);
        break;
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(LOCALE_IDS.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(LOCALE_IDS[activeIndex]);
        break;
    }
  };

  const activeDescendant = open
    ? `${listboxId}-${LOCALE_IDS[activeIndex]}`
    : undefined;

  return (
    <div className="language-select" ref={rootRef}>
      <button
        type="button"
        className="language-select__button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeDescendant}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={handleKeyDown}
      >
        <span className="language-select__value">{OPTION_LABELS[value]}</span>
        <svg
          className={`language-select__chevron${open ? ' language-select__chevron--open' : ''}`}
          viewBox="0 0 16 16"
          width="14"
          height="14"
          aria-hidden="true"
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="language-select__list"
          aria-label={label}
        >
          {LOCALE_IDS.map((id, i) => (
            <li
              key={id}
              id={`${listboxId}-${id}`}
              role="option"
              aria-selected={id === value}
              className={`language-select__option ${
                i === activeIndex ? 'language-select__option--active' : ''
              } ${id === value ? 'language-select__option--selected' : ''}`}
              onPointerEnter={() => setActiveIndex(i)}
              onClick={() => select(id)}
            >
              <span>{OPTION_LABELS[id]}</span>
              {id === value && (
                <svg
                  className="language-select__check"
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  aria-hidden="true"
                >
                  <path
                    d="M3.5 8.5l3 3 6-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

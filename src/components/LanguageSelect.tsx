import {useEffect, useId, useRef, useState} from 'react';
import {LOCALE_IDS, type LocaleId} from '../i18n';
import {onOutsideDismiss} from '../utils/listener';
import './LanguageSelect.css';

/**
 * Custom language dropdown (button + listbox).
 *
 * Native <option> styling is unreliable across browsers, so the picker is a
 * custom listbox: a trigger button showing the selected locale in its own
 * endonym, and a themed popup list.
 */

const OPTION_LABELS: Record<LocaleId, string> = {
  en: 'English',
  zh: '中文',
  no: 'Norsk',
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

  const openList = () => setOpen(true);

  // Close on an outside pointer press.
  useEffect(() => {
    if (!open) return;
    return onOutsideDismiss(rootRef.current, () => setOpen(false));
  }, [open]);

  const select = (id: LocaleId) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="language-select" ref={rootRef}>
      <button
        type="button"
        className="language-select__button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => (open ? setOpen(false) : openList())}
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
          {LOCALE_IDS.map(id => (
            <li
              key={id}
              role="option"
              aria-selected={id === value}
              className={`language-select__option ${
                id === value ? 'language-select__option--selected' : ''
              }`}
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

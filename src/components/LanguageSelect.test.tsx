// @vitest-environment jsdom

import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {LanguageSelect} from './LanguageSelect';

afterEach(cleanup);

describe('LanguageSelect', () => {
  it('shows the current locale in its own endonym', () => {
    render(<LanguageSelect value="zh" onChange={() => {}} label="Language" />);
    expect(screen.getByRole('button').textContent).toBe('中文');
  });

  it('opens on click and lists the available locales', () => {
    render(<LanguageSelect value="en" onChange={() => {}} label="Language" />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'true',
    );
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([
      'English',
      '中文',
    ]);
  });

  it('reports selection via onChange and closes', () => {
    const onChange = vi.fn();
    render(<LanguageSelect value="en" onChange={onChange} label="Language" />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByText('中文'));
    expect(onChange).toHaveBeenCalledWith('zh');
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('moves the highlight with the arrow keys and selects on Enter', () => {
    const onChange = vi.fn();
    render(<LanguageSelect value="en" onChange={onChange} label="Language" />);
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'Enter'});
    expect(onChange).toHaveBeenCalledWith('zh');
  });

  it('closes on Escape', () => {
    render(<LanguageSelect value="en" onChange={() => {}} label="Language" />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(button, {key: 'Escape'});
    expect(screen.queryByRole('option')).toBeNull();
  });
});

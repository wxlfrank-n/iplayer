// @vitest-environment jsdom

import {fireEvent, render} from '@testing-library/react';
import {beforeAll, describe, expect, it, vi} from 'vitest';
import {Clip} from './Clip';
import type {WaveWindow} from '../types';
import type {Clip as ClipData} from '../utils/clips';

const windowConfig: WaveWindow = {
  windowStartSec: 0,
  windowLen: 10,
  innerH: 192,
  vbW: 1000,
  vbH: 200,
};

const clip: ClipData = {
  start: 1,
  end: 3,
  vStart: 1,
  vEnd: 3,
};

const renderClip = (
  overrides: Partial<React.ComponentProps<typeof Clip>> = {},
) => {
  const props: React.ComponentProps<typeof Clip> = {
    clip,
    window: windowConfig,
    id: 0,
    active: false,
    onPlayRange: vi.fn(),
    repetitions: 3,
    playing: false,
    onStopPlayback: vi.fn(),
    onActivate: vi.fn(),
    onSwipe: vi.fn(),
    ...overrides,
  };
  const view = render(<Clip {...props} />);
  return {
    ...view,
    rect: view.container.querySelector('.waveform-clip')!,
    props,
  };
};

beforeAll(() => {
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.releasePointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
});

describe('Clip gestures', () => {
  it('plays on a tap without requiring a second click', () => {
    const {rect, props} = renderClip();

    fireEvent.pointerDown(rect, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 102,
      clientY: 102,
    });

    expect(props.onActivate).toHaveBeenCalledWith(0);
    expect(props.onPlayRange).toHaveBeenCalledWith(1, 3, 3);
  });

  it('stops playback when the active clip is tapped again', () => {
    const onStopPlayback = vi.fn();
    const onPlayRange = vi.fn();
    const {rect} = renderClip({
      playing: true,
      active: true,
      onStopPlayback,
      onPlayRange,
    });

    fireEvent.click(rect);

    expect(onStopPlayback).toHaveBeenCalledTimes(1);
    expect(onPlayRange).not.toHaveBeenCalled();
  });

  it('reports a swipe up without playing the clip', () => {
    const onSwipe = vi.fn();
    const onPlayRange = vi.fn();
    const {rect} = renderClip({onSwipe, onPlayRange});

    fireEvent.pointerDown(rect, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 2,
      pointerType: 'touch',
      clientX: 100,
      clientY: 60,
    });

    expect(onSwipe).toHaveBeenCalledWith(0, 'up');
    expect(onPlayRange).not.toHaveBeenCalled();
  });

  it('reports a swipe down with the reported id', () => {
    const onSwipe = vi.fn();
    const onPlayRange = vi.fn();
    const {rect} = renderClip({id: 7, onSwipe, onPlayRange});

    fireEvent.pointerDown(rect, {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 3,
      pointerType: 'touch',
      clientX: 100,
      clientY: 140,
    });

    expect(onSwipe).toHaveBeenCalledWith(7, 'down');
    expect(onPlayRange).not.toHaveBeenCalled();
  });

  it('marks the clip rectangle active and renders its label', () => {
    const label = <span className="clip-label-marker">x</span>;
    const {container} = renderClip({id: 3, active: true, label});

    const rect = container.querySelector('.waveform-clip') as HTMLElement;
    expect(rect.classList.contains('waveform-clip--active')).toBe(true);
    expect(container.querySelector('.clip-label-marker')).not.toBeNull();
  });
});

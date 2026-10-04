// @vitest-environment jsdom

import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import configReducer, {updateConfig} from '../store/configSlice';
import playerReducer from '../store/playerSlice';
import analysisReducer from '../store/analysisSlice';
import {ClipToolbarCollapsedHit} from './ClipToolbarCollapsedHit';

afterEach(cleanup);

function makeStore() {
  return configureStore({
    reducer: {
      config: configReducer,
      player: playerReducer,
      analysis: analysisReducer,
    },
  });
}

function renderHit(store: ReturnType<typeof makeStore>) {
  store.dispatch(updateConfig({showAdvancedControls: false}));
  return render(
    <Provider store={store}>
      <ClipToolbarCollapsedHit />
    </Provider>,
  );
}

describe('ClipToolbarCollapsedHit', () => {
  it('renders the collapsed hit area', () => {
    const {container} = renderHit(makeStore());
    expect(container.querySelector('.clip-toolbar__collapsed-hit')).not.toBe(
      null,
    );
  });

  it('expands the toolbar on a double-click', () => {
    const store = makeStore();
    const {container} = renderHit(store);

    fireEvent.doubleClick(
      container.querySelector('.clip-toolbar__collapsed-hit')!,
    );
    expect(store.getState().config.showAdvancedControls).toBe(true);
  });

  it('expands the toolbar on a swipe down', () => {
    const store = makeStore();
    const {container} = renderHit(store);
    const hit = container.querySelector('.clip-toolbar__collapsed-hit')!;

    fireEvent.pointerDown(hit, {clientX: 100, clientY: 0});
    fireEvent.pointerUp(hit, {clientX: 100, clientY: 40});
    expect(store.getState().config.showAdvancedControls).toBe(true);
  });

  it('does not expand on a swipe up', () => {
    const store = makeStore();
    const {container} = renderHit(store);
    const hit = container.querySelector('.clip-toolbar__collapsed-hit')!;

    fireEvent.pointerDown(hit, {clientX: 100, clientY: 40});
    fireEvent.pointerUp(hit, {clientX: 100, clientY: 0});
    expect(store.getState().config.showAdvancedControls).toBe(false);
  });

  it('does not expand on a mostly horizontal swipe', () => {
    const store = makeStore();
    const {container} = renderHit(store);
    const hit = container.querySelector('.clip-toolbar__collapsed-hit')!;

    fireEvent.pointerDown(hit, {clientX: 0, clientY: 0});
    fireEvent.pointerUp(hit, {clientX: 200, clientY: 30});
    expect(store.getState().config.showAdvancedControls).toBe(false);
  });

  it('ignores a swipe below the threshold', () => {
    const store = makeStore();
    const {container} = renderHit(store);
    const hit = container.querySelector('.clip-toolbar__collapsed-hit')!;

    fireEvent.pointerDown(hit, {clientX: 100, clientY: 0});
    fireEvent.pointerUp(hit, {clientX: 100, clientY: 10});
    expect(store.getState().config.showAdvancedControls).toBe(false);
  });

  it('ignores a pointer-up with no matching pointer-down', () => {
    const store = makeStore();
    const {container} = renderHit(store);

    fireEvent.pointerUp(
      container.querySelector('.clip-toolbar__collapsed-hit')!,
      {
        clientX: 100,
        clientY: 40,
      },
    );
    expect(store.getState().config.showAdvancedControls).toBe(false);
  });

  it('abandons the gesture when the pointer is cancelled', () => {
    const store = makeStore();
    const {container} = renderHit(store);
    const hit = container.querySelector('.clip-toolbar__collapsed-hit')!;

    fireEvent.pointerDown(hit, {clientX: 100, clientY: 0});
    fireEvent.pointerCancel(hit);
    fireEvent.pointerUp(hit, {clientX: 100, clientY: 40});
    expect(store.getState().config.showAdvancedControls).toBe(false);
  });
});

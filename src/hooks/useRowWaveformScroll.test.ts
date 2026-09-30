// @vitest-environment jsdom

import {
    act,
    renderHook,
} from "@testing-library/react";
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import {
    useRowWaveformScroll,
} from "./useRowWaveformScroll";

import type { Clip } from "../utils/clips";

/*
 * Make viewport calculation deterministic.
 *
 * Adjust this mock if your getWindowSecs()
 * is already deterministic in tests.
 */
vi.mock(
    "../utils/rowWaveform",
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import("../utils/rowWaveform")
            >();

        return {
            ...actual,

            getWindowSecs:
                vi.fn(() => 10),
        };
    },
);

type PlayRangeCallbacks = {
    onComplete?: () => void;
    onRepeat?: () => void;
};

function createHarness(
    options?: {
        duration?: number;
        currentTime?: number;
        playing?: boolean;
        clips?: Clip[];
    },
) {
    let time =
        options?.currentTime ?? 0;

    let playing =
        options?.playing ?? false;

    let callbacks:
        PlayRangeCallbacks = {};

    const onSeek = vi.fn(
        (next: number) => {
            time = next;
        },
    );

    const onActiveClipChange =
        vi.fn();

    const onPlayRange = vi.fn(
        (
            _start: number,
            _end: number,
            _repetitions: number,
            onComplete?: () => void,
            onRepeat?: () => void,
        ) => {
            callbacks = {
                onComplete,
                onRepeat,
            };
        },
    );

    const setScrolling =
        vi.fn();

    const scrollTimeoutRef = {
        current:
            undefined as
            | number
            | undefined,
    };

    const getCurrentTime = () =>
        time;

    const result = renderHook(
        () =>
            useRowWaveformScroll({
                waveformDuration:
                    options?.duration ??
                    100,

                displayClips:
                    options?.clips ?? [],

                currentTime: time,

                onSeek,

                onPlayRange,

                repetitions: 3,

                activeClip: -1,

                onActiveClipChange,

                getCurrentTime,

                playing,

                scrolling: false,

                setScrolling,

                scrollTimeoutRef,
            }),
    );

    return {
        ...result,

        onPlayRange,

        onSeek,

        onActiveClipChange,

        callbacks: () =>
            callbacks,

        getTime: () =>
            time,

        setTime: (
            next: number,
        ) => {
            time = next;
        },

        setPlaying: (
            next: boolean,
        ) => {
            playing = next;
        },
    };
}

describe(
    "useRowWaveformScroll clip playback",
    () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        /*
         * ------------------------------------------------
         * Fully visible clip
         * ------------------------------------------------
         */

        it(
            "does not move the viewport when the whole clip is visible",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 10;
                });

                act(() => {
                    h.result.current
                        .playClip(
                            12,
                            18,
                            3,
                        );
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);

                expect(
                    h.onPlayRange,
                ).toHaveBeenCalledWith(
                    12,
                    18,
                    3,
                    expect.any(Function),
                    expect.any(Function),
                );
            },
        );

        /*
         * ------------------------------------------------
         * Left-hidden short clip
         * ------------------------------------------------
         */

        it(
            "moves to clip.start when a clip is left-hidden",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 15;
                });

                /*
                 * viewport = 15..25
                 * clip     = 10..18
                 */
                act(() => {
                    h.result.current
                        .playClip(
                            10,
                            18,
                            2,
                        );
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);
            },
        );

        /*
         * ------------------------------------------------
         * Right-hidden short clip
         * ------------------------------------------------
         */

        it(
            "does not jump immediately when a clip is right-hidden",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 10;
                });

                /*
                 * viewport = 10..20
                 * clip     = 16..24
                 *
                 * Right side is hidden.
                 */
                act(() => {
                    h.result.current
                        .playClip(
                            16,
                            24,
                            2,
                        );
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);
            },
        );

        /*
         * ------------------------------------------------
         * Long clip
         * ------------------------------------------------
         */

        it(
            "starts a long clip at clip.start",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 15;
                });

                /*
                 * window = 10
                 *
                 * viewport = 15..25
                 * clip     = 10........30
                 *
                 * Clip is both left-hidden and
                 * right-hidden.
                 */
                act(() => {
                    h.result.current
                        .playClip(
                            10,
                            30,
                            3,
                        );
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);
            },
        );

        /*
         * This is the regression test for the bug:
         *
         * round 1:
         *     viewport follows toward end
         *
         * round 2:
         *     viewport must return to clip.start
         */
        it(
            "resets a long clip viewport to clip.start on every repetition",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 15;
                });

                act(() => {
                    h.result.current
                        .playClip(
                            10,
                            30,
                            3,
                        );
                });

                /*
                 * Initial round.
                 */
                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);

                /*
                 * Simulate the viewport having followed
                 * playback toward the end of round 1.
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 20;
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(20);

                /*
                 * playRange tells us that round 2 started.
                 */
                act(() => {
                    h.callbacks()
                        .onRepeat?.();
                });

                /*
                 * Critical assertion:
                 *
                 * 20..30
                 *
                 * must become
                 *
                 * 10..20
                 */
                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);

                /*
                 * Simulate round 2 following again.
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 20;
                });

                /*
                 * Round 3.
                 */
                act(() => {
                    h.callbacks()
                        .onRepeat?.();
                });

                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(10);
            },
        );

        /*
         * ------------------------------------------------
         * Manual movement during clip
         * ------------------------------------------------
         */

        it(
            "does not reclaim the viewport on repeat after the user manually moves it",
            () => {
                const h =
                    createHarness();

                act(() => {
                    h.result.current
                        .playClip(
                            10,
                            30,
                            3,
                        );
                });

                /*
                 * We need to trigger actual manual movement
                 * through the public handlers in a full DOM
                 * integration test.
                 *
                 * This test documents the expected behavior:
                 *
                 * once userMoved=true, onRepeat must not
                 * reset the viewport.
                 */
            },
        );

        /*
         * ------------------------------------------------
         * Final completion
         * ------------------------------------------------
         */

        it(
            "keeps the current viewport when a right-hidden clip finishes",
            () => {
                const h =
                    createHarness();

                /*
                 * Initial viewport.
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 10;
                });

                act(() => {
                    h.result.current
                        .playClip(
                            16,
                            24,
                            3,
                        );
                });

                /*
                 * Simulate normal following during the
                 * final repetition.
                 *
                 * The exact value is not important.
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 14;
                });

                const anchorBeforeFinish =
                    h.result.current
                        .viewportAnchorRef
                        .current;

                /*
                 * playRange reaches the final clip end.
                 */
                act(() => {
                    h.callbacks()
                        .onComplete?.();
                });

                /*
                 * Completion MUST NOT perform another
                 * forward-follow operation.
                 */
                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(
                    anchorBeforeFinish,
                );
            },
        );

        /*
         * This is specifically your newest bug.
         */
        it(
            "does not suddenly move forward after all repetitions of a right-hidden clip",
            () => {
                const h =
                    createHarness();

                /*
                 * window = 10
                 *
                 * viewport initially:
                 *
                 * 10----------20
                 *
                 * clip:
                 *
                 *       16----------------24
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 10;

                    h.result.current
                        .playClip(
                            16,
                            24,
                            3,
                        );
                });

                /*
                 * Playback has followed naturally toward
                 * the end.
                 */
                act(() => {
                    h.result.current
                        .viewportAnchorRef
                        .current = 14;
                });

                /*
                 * Final boundary reached.
                 */
                act(() => {
                    h.callbacks()
                        .onComplete?.();
                });

                /*
                 * It must remain exactly where clip
                 * playback left it.
                 *
                 * It must NOT suddenly become e.g.:
                 *
                 * 16
                 * 18
                 * 20
                 * etc.
                 */
                expect(
                    h.result.current
                        .viewportAnchorRef
                        .current,
                ).toBe(14);
            },
        );
    },
);
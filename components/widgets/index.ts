import type { Component } from 'svelte';
import type { Widget } from '@/lib/types';
import Clock from './Clock.svelte';
import Countdown from './Countdown.svelte';
import Counter from './Counter.svelte';
import Photo from './Photo.svelte';
import Pomodoro from './Pomodoro.svelte';
import Snippet from './Snippet.svelte';
import Timer from './Timer.svelte';

/** Each widget's view, by type (labels and config fields are in lib/widgets.ts). Views mutate `w` and call `save`. */
export const VIEWS: Record<string, Component<{ w: Widget; save: () => void }>> = {
  clock: Clock, countdown: Countdown, timer: Timer, pomodoro: Pomodoro, counter: Counter, snippet: Snippet, photo: Photo,
};

// Dialog and toast state; components/Dialogs.svelte renders it.
import type { Component } from 'svelte';

export interface Field {
  name: string;
  label: string;
  type?: string;
  value?: unknown;
  options?: [string, string?][];
  required?: boolean;
  maxlength?: number;
  accept?: string;
  min?: number;
  max?: number;
  onchange?: (e: Event & { currentTarget: HTMLInputElement }) => void;
}
export type FormField = Field | { heading: string };
/** A button under a dialog's fields; the dialog closes (as cancelled) before it runs. */
export type Extra = [label: string, run: () => void];
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each form knows its own field types
export type Values = Record<string, any>;

type FormDialog = { kind: 'form'; id: number; title: string; fields: FormField[]; extra: Extra[]; resolve: (v: Values | null) => void };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ModalDialog = { kind: 'modal'; id: number; title: string; body: Component<any>; props: Record<string, unknown>; buttons: Extra[] };
export type Dialog = FormDialog | ModalDialog;

export const dialogs = $state<Dialog[]>([]);
export const note = $state<{ v: { msg: string; label?: string; fn?: () => void } | null }>({ v: null });
let nextId = 0;

export const drop = (d: Dialog) => dialogs.splice(dialogs.findIndex((x) => x.id === d.id), 1);

/** Form dialog: resolves to the field values on Save, null otherwise. */
export const form = (title: string, fields: FormField[], extra: Extra[] = []) =>
  new Promise<Values | null>((resolve) => dialogs.push({ kind: 'form', id: nextId++, title, fields, extra, resolve }));

/** Info dialog showing a component; it gets a `close` prop besides `props`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const modal = (title: string, body: Component<any>, props: Record<string, unknown> = {}, buttons: Extra[] = []) =>
  dialogs.push({ kind: 'modal', id: nextId++, title, body, props, buttons });

let timer: ReturnType<typeof setTimeout>;
export function toast(msg: string, label?: string | null, fn?: () => void) {
  note.v = { msg, label: label ?? undefined, fn };
  clearTimeout(timer);
  timer = setTimeout(() => (note.v = null), 6000);
}

export const OPEN_PALETTE_EVENT = "leadagent:open-palette";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

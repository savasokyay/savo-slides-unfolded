// @ts-check
// WP-31: global keyboard shortcuts (plan §3.3): F presenting mode, T theme, G language, L relock
// the exam (when unlocked), Ctrl+Shift+H temporarily reveal hidden nav groups, Esc closes a modal.
// Per-step TracePlayer shortcuts (Space/arrows/P/+/-) arrive with WP-32 and are wired separately.

import { showToast } from "./components/toast.js";

/**
 * @param {{store: any, theme: any, i18n: any, api: any}} ctx
 */
export function initKeyboard(ctx) {
  window.addEventListener("keydown", (e) => onKey(e, ctx));
}

/**
 * @param {KeyboardEvent} e
 * @param {{store: any, theme: any, i18n: any, api: any}} ctx
 */
function onKey(e, ctx) {
  if (e.key === "Escape") {
    const modal = document.querySelector(".modal-backdrop");
    if (modal) modal.remove();
    return;
  }
  const target = /** @type {HTMLElement | null} */ (e.target);
  const typing = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
  if (typing) return;

  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
    e.preventDefault();
    const state = ctx.store.get();
    ctx.store.set({ showHiddenOverride: !state.showHiddenOverride });
    return;
  }
  switch (e.key.toLowerCase()) {
    case "f":
      setPresenting(ctx.store, !ctx.store.get().presenting);
      break;
    case "t":
      ctx.theme.toggle();
      break;
    case "g":
      toggleLanguage(ctx);
      break;
    case "l":
      if (ctx.store.get().examToken) relock(ctx);
      break;
    default:
      break;
  }
}

/**
 * Enter/exit presenting mode: `.presenting` on `<html>` (CSS hides the sidebar, enlarges type)
 * plus a best-effort real fullscreen request. Shared by the `F` shortcut and the header button so
 * both triggers stay in sync.
 * @param {any} store
 * @param {boolean} presenting
 */
export function setPresenting(store, presenting) {
  document.documentElement.classList.toggle("presenting", presenting);
  store.set({ presenting });
  if (presenting) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else if (document.fullscreenElement) {
    document.exitFullscreen?.().catch(() => {});
  }
}

/** @param {{store: any, i18n: any, api: any}} ctx */
async function toggleLanguage(ctx) {
  const next = ctx.i18n.lang() === "en" ? "tr" : "en";
  if (!(await ctx.i18n.load(ctx.api, next))) return; // WP-97: a newer load superseded this one
  try {
    localStorage.setItem("i2rs.lang", next);
  } catch {
    /* private browsing - the toggle still works for this page view */
  }
  ctx.store.set({ lang: next });
}

/** @param {{store: any, api: any, i18n: any}} ctx */
async function relock(ctx) {
  const token = ctx.store.get().examToken;
  try {
    await ctx.api.examRelock(token);
  } catch {
    /* the token may already be expired server-side - clear it locally regardless */
  } finally {
    ctx.store.set({ examToken: null });
    showToast(ctx.i18n.t("shell.relock"));
  }
}

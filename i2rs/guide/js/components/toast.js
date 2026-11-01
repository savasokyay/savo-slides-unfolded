// @ts-check
// WP-31: minimal toast stack (errors, nav hints). No queue limit - four seconds and gone.

/** @type {HTMLElement | null} */
let container = null;

function ensureContainer() {
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-stack";
    document.body.appendChild(container);
  }
  return container;
}

/**
 * @param {string} message
 * @param {"info" | "error"} [kind]
 */
export function showToast(message, kind = "info") {
  const el = document.createElement("div");
  el.className = kind === "error" ? "toast error" : "toast";
  el.textContent = message;
  ensureContainer().appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

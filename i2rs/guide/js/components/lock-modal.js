// @ts-check
// WP-31: PIN dialog for lockable nav items (the Exam module). The token lives only in memory
// (`store.examToken`) - never persisted, per the privacy design (docs/PRIVACY.md).

/**
 * @param {{i18n: import("../i18n.js").createI18n, onSubmit: (pin: string) => Promise<boolean>, onClose?: () => void}} opts
 */
export function openPinDialog({ i18n, onSubmit, onClose }) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const title = document.createElement("h3");
  title.textContent = i18n.t("common.locked");

  const label = document.createElement("label");
  label.textContent = i18n.t("shell.pin_label");
  const input = document.createElement("input");
  input.type = "password";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = i18n.t("shell.pin_placeholder");
  label.appendChild(input);

  const errorText = document.createElement("p");
  errorText.style.color = "var(--red)";
  errorText.style.fontSize = "12px";
  errorText.style.minHeight = "16px";

  const actions = document.createElement("div");
  actions.className = "modal-actions";
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn";
  cancelBtn.textContent = i18n.t("shell.close");
  const submitBtn = document.createElement("button");
  submitBtn.className = "btn btn-primary";
  submitBtn.textContent = i18n.t("common.unlock");
  actions.append(cancelBtn, submitBtn);

  modal.append(title, label, errorText, actions);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  input.focus();

  function close() {
    backdrop.remove();
    if (onClose) onClose();
  }

  async function submit() {
    submitBtn.disabled = true;
    try {
      const ok = await onSubmit(input.value);
      if (ok) {
        close();
      } else {
        errorText.textContent = i18n.t("error.wrong_pin");
        input.select();
      }
    } finally {
      submitBtn.disabled = false;
    }
  }

  cancelBtn.addEventListener("click", close);
  submitBtn.addEventListener("click", submit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  return { close };
}

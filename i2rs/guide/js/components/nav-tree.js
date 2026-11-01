// @ts-check
// WP-31: sidebar nav tree from `config/nav.yaml`. Every node's `id` in that file is already a full
// dotted path (e.g. the fault-injection leaf is literally `id: extras.pitfalls.fault_injection`,
// not a bare `fault_injection` nested three levels deep) - so `meta.hidden` entries match `node.id`
// directly, with no prefix-concatenation. `store.showHiddenOverride` (Ctrl+Shift+H, see
// keyboard.js) previews hidden items with a dashed outline instead of disappearing outright, so the
// instructor can tell what a profile switch would hide. `lockable` nodes (the Exam item) need a
// ~1.5s long-press to open the PIN dialog; a quick click on a still-locked item shows a hint instead
// of navigating.

import { publicationStamp } from "../util/publication.js"; // WP-237a: the students' edition's stamp
import { openPinDialog } from "./lock-modal.js";
import { showToast } from "./toast.js";

const LONG_PRESS_MS = 1500;

// WP-66: groups fold their children. `collapsed: true` in config/nav.yaml is a group's start state;
// the last toggle per group is remembered (same localStorage-backed shape as nav-collapse.js), and
// a default-collapsed group that holds the ACTIVE page opens itself unless the user chose otherwise.
const GROUPS_KEY = "i2rs.navGroups";

/** @returns {Record<string, boolean>} */
function loadGroupState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(GROUPS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} id
 * @param {boolean} collapsed
 */
function saveGroupState(id, collapsed) {
  const state = loadGroupState();
  state[id] = collapsed;
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(state));
  } catch {
    /* private browsing - the fold still works for this page view */
  }
}

/**
 * @param {any} node
 * @param {string | undefined} page
 * @returns {boolean}
 */
function holdsActivePage(node, page) {
  return (node.children || []).some((c) => c.page === page || holdsActivePage(c, page));
}

/**
 * @param {any} node
 * @param {any} ctx
 * @returns {boolean}
 */
function groupCollapsed(node, ctx) {
  const saved = loadGroupState();
  if (node.id in saved) return !!saved[node.id];
  if (!node.collapsed) return false;
  return !holdsActivePage(node, ctx.store.get().route?.page);
}

/**
 * @param {HTMLElement} root
 * @param {{nav: {tree: any[]}, i18n: any, store: any, router: any, api: any, navCollapse: any, publication?: any}} ctx WP-237a: + publication (the students' edition, null in the lab)
 */
export function renderNavTree(root, ctx) {
  const state = ctx.store.get();
  const hidden = new Set(state.meta?.hidden || []);
  const showAll = !!state.showHiddenOverride;

  root.innerHTML = "";

  // WP-54a: the toggle is the FIRST thing in the sidebar, set off by its own bottom border, so
  // it reads as sidebar chrome rather than one more row in the nav list to scroll past - matches
  // lbxd-stats' hamburger sitting right below its sidebar header, not at the bottom.
  const collapsed = !!state.navCollapsed;
  const toggleText = ctx.i18n.t(collapsed ? "shell.show_sidebar" : "shell.hide_sidebar");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "nav-row nav-collapse-toggle";
  toggle.title = toggleText;
  const toggleIcon = document.createElement("span");
  toggleIcon.className = "nav-icon";
  toggleIcon.textContent = "☰"; // ☰ - stays the universal "menu" glyph in both states
  const toggleLabel = document.createElement("span");
  toggleLabel.className = "nav-label";
  toggleLabel.textContent = toggleText;
  toggle.append(toggleIcon, toggleLabel);
  toggle.addEventListener("click", () => ctx.navCollapse.toggle());
  root.appendChild(toggle);

  const ul = document.createElement("ul");
  ul.className = "nav-tree";
  const hiddenCount = buildList(ul, ctx.nav.tree || [], ctx, hidden, showAll);
  root.appendChild(ul);

  if (hiddenCount > 0) {
    const btn = document.createElement("button");
    btn.className = "nav-hidden-toggle";
    btn.textContent = showAll
      ? ctx.i18n.t("shell.hide_hidden")
      : ctx.i18n.t("shell.hidden_count", { n: hiddenCount });
    btn.addEventListener("click", () => ctx.store.set({ showHiddenOverride: !showAll }));
    root.appendChild(btn);
  }

  // WP-54: pushes the credit logo to the bottom of the sidebar regardless of how many nav
  // items/hidden-count chip are above it (matches lbxd-stats' own sidebar layout).
  const spacer = document.createElement("div");
  spacer.className = "nav-spacer";
  root.appendChild(spacer);

  const logo = document.createElement("div");
  logo.className = "nav-credit-logo";
  const logoImg = document.createElement("img");
  logoImg.src = "assets/imgLogo_SOkyay.png"; // WP-237a: relative (a package under <host>/<repo>/i2rs/<profile>/ has no root of its own) and without the leading "_" (GitHub Pages' Jekyll skips such files)
  logoImg.alt = "";
  logoImg.title = "savasokyay";
  logoImg.hidden = true;
  logoImg.addEventListener("load", () => {
    logoImg.hidden = false;
  });
  logo.appendChild(logoImg);
  root.appendChild(logo);

  // WP-237a: the students' edition stamps itself at the foot of the sidebar - "v0.6 · rendered 2026-10-24 17:05" (the major.minor and the render time; the revision is not on screen) - and
  // says so when the tree it was rendered from had uncommitted changes. The lab has no publication: nothing is added.
  if (ctx.publication) {
    const { text, preview } = publicationStamp(ctx.publication, (key, params) => ctx.i18n.t(key, params));
    const stamp = document.createElement("div");
    stamp.className = "nav-publication-stamp";
    const line = document.createElement("span");
    line.className = "nav-stamp-text";
    line.textContent = text;
    stamp.appendChild(line);
    if (preview) {
      const flag = document.createElement("span");
      flag.className = "nav-stamp-preview";
      flag.textContent = ctx.i18n.t("shell.preview_build");
      flag.title = ctx.i18n.t("shell.preview_build_tip");
      stamp.appendChild(flag);
    }
    root.appendChild(stamp);
  }
}

/**
 * @param {HTMLUListElement} ul
 * @param {any[]} nodes
 * @param {any} ctx
 * @param {Set<string>} hidden
 * @param {boolean} showAll
 * @param {number} [depth] WP-74: 0 = top level; children get depth + 1 (badge colour per level)
 * @returns {number}
 */
function buildList(ul, nodes, ctx, hidden, showAll, depth = 0) {
  let hiddenCount = 0;
  for (const node of nodes) {
    const nodeHidden = hidden.has(node.id);
    if (nodeHidden) {
      hiddenCount += 1;
      if (!showAll) continue;
    }
    const li = document.createElement("li");
    li.appendChild(buildRow(node, ctx, nodeHidden, depth));
    if (node.children && node.children.length) {
      const childUl = document.createElement("ul");
      hiddenCount += buildList(childUl, node.children, ctx, hidden, showAll, depth + 1);
      li.appendChild(childUl);
      // WP-66 fold state; WP-82: `collapsible: false` = a fixed heading that never folds
      if (!node.page) li.classList.toggle("collapsed", node.collapsible !== false && groupCollapsed(node, ctx));
    }
    ul.appendChild(li);
  }
  return hiddenCount;
}

/**
 * @param {any} node
 * @param {any} ctx
 * @param {boolean} previewingHidden
 * @param {number} [depth]
 */
function buildRow(node, ctx, previewingHidden, depth = 0) {
  const { i18n, store, router, api } = ctx;
  const state = store.get();
  const planned = node.planned === true; // WP-231: a row of future work - no page, no link, no gold; the label says so and the tooltip says what the idea is
  const locked = node.locked === true; // WP-237a: a row the students' edition shows but does not open (`locked: true` in the package's nav.json): a lock for its badge, "Coming later" for its tip, no link
  const inert = planned || locked; // nothing to open: not focusable, no href, no click
  const isGroup = !node.page && !inert; // WP-231: a planned row is not a heading either; WP-237a: nor is a locked one (it names its page, which the edition does not carry)
  const row = document.createElement(inert ? "span" : isGroup ? "div" : "a"); // WP-231; WP-237a
  row.className = `nav-row${isGroup ? " group" : ""}${previewingHidden ? " hidden-preview" : ""}`;
  row.classList.add(`depth-${depth}`); // WP-74: app.css colours the badge box per level
  if (node.done) row.classList.add("done"); // WP-82: a signed-off page - its badge wears the logo's gold
  row.dataset.navId = node.id;
  // WP-54: the icon badge never hides when the sidebar collapses - unlike a pictogram, the
  // course's own abbreviations (uCF, iCF, DNN, MF, CB, ...) stay just as legible at icon width.
  // WP-74: the badge is an emoji now (user choice); the collapsed rail has no indentation, so the
  // per-depth box colour is what still tells a group's child from a top-level page there.
  const badge = locked ? "\u{1F512}" : node.icon; // WP-237a: a locked row wears the lock where the page's emoji would be
  if (badge) {
    const icon = document.createElement("span");
    icon.className = "nav-icon";
    icon.textContent = badge; // WP-237a
    row.appendChild(icon);
  }
  const label = document.createElement("span");
  label.className = "nav-label";
  label.textContent = i18n.t(node.label_key) + (planned ? ` ${i18n.t("nav.future_work_suffix")}` : ""); // WP-231
  row.appendChild(label);
  // WP-82: the collapsed rail shows the emoji badge alone - the native tooltip names the page
  // (the instructor mostly works with the rail collapsed; a reviewer flagged the bare icons)
  // WP-231: a row that carries `tip_key` shows that text instead (it starts with the page's name, so the rail's tooltip still names it)
  row.title = locked ? i18n.t("nav.coming_later") : typeof node.tip_key === "string" ? i18n.t(node.tip_key) : label.textContent; // WP-237a: a locked row's tip says only that it comes later (no date)
  if (inert) {
    // WP-231: nothing to open - not focusable, no click handler, no href; the muted look is css/app.css `.nav-row.planned`; WP-237a: a locked row looks the same (`.nav-row.locked`)
    row.classList.add(planned ? "planned" : "locked");
    row.setAttribute("aria-disabled", "true");
    return row;
  }

  if (node.lockable) {
    const lock = document.createElement("span");
    lock.className = "lock-icon";
    lock.textContent = state.examToken ? "\u{1F513}" : "\u{1F512}";
    row.appendChild(lock);
  }

  if (!isGroup) {
    const params = node.params || {};
    const qs = new URLSearchParams(params).toString();
    row.setAttribute("href", `#/${node.page}${qs ? `?${qs}` : ""}`);
    // WP-177b: two rows of ONE page (the content page's two methods) are told apart by a route parameter: `route_key` names it, the row's own `params` hold its value, and
    // `route_default` lights the row when the route does not name the parameter at all (a link with no `m` opens the page's default method)
    const onPage = Boolean(state.route) && state.route.page === node.page;
    const keyed = typeof node.route_key === "string" ? node.route_key : null;
    const got = keyed && state.route ? state.route.params?.[keyed] : undefined;
    const lit = keyed === null ? onPage : onPage && (got === params[keyed] || (got === undefined && node.route_default === true));
    // WP-221: a plain row of a page that a sibling row also shows under one value of a route parameter (the Model-based parent's neural-models row and the Hybrid & ensemble child
    // "Feature-combination network", both page `dnn`: `#/dnn?arch=features` is the child's) steps aside while the route holds that value - `route_except: {arch: features}` on the plain row -
    // so a deep link lights ONE row. A row without `route_except` is untouched.
    const exceptions = node.route_except && typeof node.route_except === "object" ? Object.entries(node.route_except) : [];
    const stepsAside = exceptions.some(([key, value]) => Boolean(state.route) && state.route.params?.[key] === value);
    if (lit && !stepsAside) row.classList.add("active");
  }

  if (node.lockable) {
    wireLongPress(row, {
      onShortClick: () => {
        if (state.examToken) {
          if (!isGroup) router.navigate(node.page, node.params);
        } else {
          showToast(i18n.t("common.locked"));
        }
      },
      onLongPress: () => {
        if (state.examToken) return;
        openPinDialog({
          i18n,
          onSubmit: async (pin) => {
            try {
              const res = await api.examUnlock(pin);
              store.set({ examToken: res.token });
              return true;
            } catch {
              return false;
            }
          },
        });
      },
    });
  } else if (!isGroup) {
    row.addEventListener("click", (e) => {
      e.preventDefault();
      router.navigate(node.page, node.params);
    });
  } else if (node.collapsible === false) {
    // WP-82: a fixed group - a heading that shows the hierarchy and never folds (the Slides group:
    // the instructor wants both boards visible at all times)
    row.classList.add("fixed");
  } else {
    // WP-66: fold caret (rotates open via CSS) + remembered toggle
    const caret = document.createElement("span");
    caret.className = "nav-caret";
    caret.textContent = "▸";
    row.appendChild(caret);
    row.addEventListener("click", () => {
      const li = row.parentElement;
      if (!li) return;
      const collapsed = !li.classList.contains("collapsed");
      li.classList.toggle("collapsed", collapsed);
      saveGroupState(node.id, collapsed);
    });
  }
  return row;
}

/**
 * @param {HTMLElement} el
 * @param {{onShortClick: () => void, onLongPress: () => void}} handlers
 */
function wireLongPress(el, { onShortClick, onLongPress }) {
  /** @type {number | null} */
  let timer = null;
  let fired = false;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    fired = false;
    timer = window.setTimeout(() => {
      fired = true;
      onLongPress();
    }, LONG_PRESS_MS);
  });
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  el.addEventListener("pointerup", () => {
    cancel();
    if (!fired) onShortClick();
  });
  el.addEventListener("pointerleave", cancel);
}

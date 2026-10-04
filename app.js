/*
 * Review DCR prototype — app logic.
 * Plain JS, no framework, no build step. State lives in one object and
 * every change goes through render functions, so the UI is always derived
 * from state (tallies and summaries are computed, never stored).
 */
(function () {
  "use strict";

  const { dcr, fields: SEED_FIELDS, otherTasks } = window.DEMO;
  const $ = (sel, root = document) => root.querySelector(sel);

  // ---------- State ----------
  function freshState() {
    return {
      // Flagged fields start with their reasoning open, as in the Figma design.
      fields: SEED_FIELDS.map((f) => ({ ...f, status: "pending", comment: "", expanded: f.confidence !== "high" })),
      taskInInbox: true,
    };
  }
  let state = freshState();

  // ---------- Helpers ----------
  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // ---------- Inbox ----------
  function renderInbox() {
    const rows = [];
    if (state.taskInInbox) {
      rows.push(`
        <tr data-task="dcr">
          <td>Data Change Request Review</td>
          <td><button type="button" class="row-open" id="open-dcr" aria-label="Open review for ${esc(dcr.entityName)}">
            <span class="entity-pill">${esc(dcr.entityName)}</span></button></td>
          <td>${esc(dcr.priority)}</td>
          <td>${esc(dcr.createdBy)}</td>
          <td>${esc(dcr.createdOn)}</td>
          <td>${esc(dcr.dueDate)}</td>
        </tr>`);
    }
    otherTasks.forEach((t) => {
      rows.push(`
        <tr>
          <td>${esc(t.type)}</td>
          <td><span class="entity-pill">${esc(t.entity)}</span>${t.more ? `<span class="more-pill">+${t.more}</span>` : ""}</td>
          <td>${esc(t.priority)}</td>
          <td>${esc(t.by)}</td>
          <td>${esc(t.on)}</td>
          <td>${esc(dcr.dueDate)}</td>
        </tr>`);
    });
    $("#task-rows").innerHTML = rows.join("");
    const count = otherTasks.length + (state.taskInInbox ? 1 : 0);
    $("#inbox-count").textContent = count;
    $("#task-total").textContent = `${count} tasks`;
  }

  // ---------- Review panel ----------
  const CHANGE_LABEL = { updated: "Updated", added: "Added", deleted: "Deleted" };
  const panel = $("#review-panel");

  function valuesHTML(f) {
    if (f.change === "added") {
      return `<span class="sr-only">New value:</span><span class="val-new">${esc(f.proposed)}</span>`;
    }
    if (f.change === "deleted") {
      return `<span class="sr-only">Value to be removed:</span><span class="val-removed">${esc(f.original)}</span>`;
    }
    return `
      <span class="sr-only">Changes from</span><span class="val-old">${esc(f.original)}</span>
      <span class="arrow" aria-hidden="true">→</span>
      <span class="sr-only">to</span><span class="val-new">${esc(f.proposed)}</span>`;
  }

  // Confidence is advisory: it is shown, explained, and never acts on its own.
  const CONFIDENCE = {
    high:     { label: "High confidence",   short: "clear",        icon: '<path d="M5 12.5l4.5 4.5L19 7.5"/>' },
    review:   { label: "Needs review",      short: "needs review", icon: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.2v.1"/>' },
    nosignal: { label: "Not enough signal", short: "no signal",    icon: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>' },
  };

  function confidenceHTML(f) {
    const c = CONFIDENCE[f.confidence];
    return `
      <button type="button" class="conf conf--${f.confidence}" data-action="toggle-why"
        aria-expanded="${f.expanded}" aria-controls="why-${f.id}">
        <svg class="conf__icon" aria-hidden="true" viewBox="0 0 24 24">${c.icon}</svg>
        ${c.label}<span class="sr-only">, ${f.expanded ? "hide" : "show"} reasoning</span>
        <svg class="conf__chev" aria-hidden="true" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg>
      </button>`;
  }

  function reasoningHTML(f) {
    return `
      <p class="why why--${f.confidence}" id="why-${f.id}" ${f.expanded ? "" : "hidden"}>
        <span class="why__label">Why this signal:</span> ${esc(f.reasoning)}
      </p>`;
  }

  function changeHTML(f) {
    return `
      <li class="change change--${f.confidence}" id="change-${f.id}" data-id="${f.id}" tabindex="-1">
        <div class="change__head">
          <span class="change__label">${esc(f.label)}</span>
          <span class="tag tag--${f.change}">${CHANGE_LABEL[f.change]}</span>
          <span class="change__spacer"></span>
          ${confidenceHTML(f)}
        </div>
        <div class="change__values">${valuesHTML(f)}</div>
        ${reasoningHTML(f)}
      </li>`;
  }

  function countBy(key) {
    return state.fields.reduce((acc, f) => ((acc[f[key]] = (acc[f[key]] || 0) + 1), acc), {});
  }

  function summaryHTML() {
    const c = countBy("confidence");
    const jump = (level, n) =>
      n ? `<button type="button" class="summary__jump summary__jump--${level}" data-action="jump" data-level="${level}">${n} ${CONFIDENCE[level].short}</button>`
        : `<span>0 ${CONFIDENCE[level].short}</span>`;
    return `
      <div class="summary" role="group" aria-label="AI review summary">
        <svg class="summary__icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3l2.2 5.6L20 9.3l-4.5 3.9 1.4 5.8L12 16l-4.9 3 1.4-5.8L4 9.3l5.8-.7z"/></svg>
        <span class="summary__text">
          <span>${c.high || 0} clear</span> ·
          ${jump("review", c.review || 0)} ·
          ${jump("nosignal", c.nosignal || 0)}
        </span>
        <button type="button" class="link-btn summary__how" id="how-open" aria-haspopup="dialog">How this works</button>
      </div>`;
  }

  function renderPanel() {
    $("#entity-name").textContent = dcr.entityName;
    $("#entity-type").textContent = dcr.entityType;
    $("#entity-id").textContent = dcr.entityId;
    $("#panel-summary").innerHTML = summaryHTML();
    $("#changes").innerHTML = state.fields.map(changeHTML).join("");
  }

  function getField(id) {
    return state.fields.find((f) => f.id === id);
  }

  function toggleWhy(id) {
    const f = getField(id);
    f.expanded = !f.expanded;
    renderPanel();
    $(`#change-${id} [data-action="toggle-why"]`).focus();
  }

  function jumpTo(level) {
    const f = state.fields.find((x) => x.confidence === level);
    if (!f) return;
    f.expanded = true;
    renderPanel();
    const el = $(`#change-${f.id}`);
    el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
    el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1200);
  }

  // "How this works" — native <dialog> gives focus trapping and Esc for free.
  const howDialog = $("#how-dialog");
  function openHow() {
    howDialog.showModal();
  }

  function openPanel() {
    renderPanel();
    panel.hidden = false;
    const row = $('tr[data-task="dcr"]');
    if (row) row.classList.add("is-selected");
    $("#panel-title").focus();
  }

  function closePanel() {
    panel.hidden = true;
    const row = $('tr[data-task="dcr"]');
    if (row) row.classList.remove("is-selected");
    const opener = $("#open-dcr");
    if (opener) opener.focus();
  }

  // ---------- Events ----------
  $("#task-rows").addEventListener("click", (e) => {
    if (e.target.closest("#open-dcr")) openPanel();
  });
  $("#close-panel").addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action], #how-open");
    if (!btn) return;
    if (btn.id === "how-open") return openHow();
    const id = btn.closest(".change")?.dataset.id;
    switch (btn.dataset.action) {
      case "toggle-why": return toggleWhy(id);
      case "jump": return jumpTo(btn.dataset.level);
    }
  });
  $("#how-close").addEventListener("click", () => howDialog.close());
  howDialog.addEventListener("close", () => $("#how-open")?.focus());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    if (document.querySelector("dialog[open]")) return; // dialog handles its own Esc
    closePanel();
  });

  // ---------- Boot ----------
  $("#reset-demo").addEventListener("click", () => {
    state = freshState();
    panel.hidden = true;
    renderInbox();
  });

  renderInbox();
})();

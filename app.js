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
      history: [],        // undo stack of { id, status, comment, verb }
      rejecting: null,    // id of the field whose reject form is open
      draft: "",          // unsent comment text (survives re-renders)
      rejectError: false, // false | "empty" | "pending"
      resolved: null,     // null | { kind: "approved" | "rejected", applied, rejected, comment }
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

  const COMMENT_ICON = '<svg class="comment__icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>';

  // Inline form: rejecting a single field always requires feedback.
  function rejectFormHTML(f) {
    const err = state.rejectError;
    return `
      <form class="reject-form" data-id="${f.id}" novalidate>
        <label class="reject-form__label" for="comment-${f.id}">Why are you rejecting this change?</label>
        <p class="reject-form__hint" id="hint-${f.id}">Required. The requester sees this on the ${esc(f.label)} field and only needs to fix this field.</p>
        <textarea id="comment-${f.id}" class="reject-form__input" rows="3"
          aria-describedby="hint-${f.id}${err ? ` err-${f.id}` : ""}" ${err ? 'aria-invalid="true"' : ""}
          placeholder="e.g. Please attach the registry document confirming the change">${esc(state.draft)}</textarea>
        ${err ? `<p class="reject-form__error" id="err-${f.id}">${err === "pending"
          ? "Finish or cancel this rejection before approving."
          : "Add a comment so the requester knows what to fix."}</p>` : ""}
        <div class="reject-form__actions">
          <button type="button" class="btn-sm btn-sm--ghost" data-action="cancel-reject">Cancel</button>
          <button type="submit" class="btn-sm btn-sm--danger">Reject change</button>
        </div>
      </form>`;
  }

  function changeHTML(f) {
    const rejected = f.status === "rejected";
    const editing = state.rejecting === f.id;
    const locked = !!state.resolved; // read-only once the DCR is resolved
    const head = rejected
      ? `<span class="tag tag--rejected">Rejected</span>
         <span class="change__spacer"></span>
         ${locked ? "" : `<button type="button" class="text-action" data-action="unreject">Unreject<span class="sr-only"> ${esc(f.label)}</span></button>`}`
      : `<span class="tag tag--${f.change}">${CHANGE_LABEL[f.change]}</span>
         <span class="change__spacer"></span>
         ${editing || locked ? "" : `<button type="button" class="text-action text-action--reject" data-action="start-reject">Reject<span class="sr-only"> ${esc(f.label)} change</span></button>`}
         ${confidenceHTML(f)}`;
    return `
      <li class="change change--${rejected ? "rejected" : f.confidence}${editing ? " is-editing" : ""}" id="change-${f.id}" data-id="${f.id}" tabindex="-1">
        <div class="change__head">
          <span class="change__label">${esc(f.label)}</span>
          ${head}
        </div>
        <div class="change__values">${rejected ? '<span class="sr-only">Rejected:</span>' : ""}${valuesHTML(f)}</div>
        ${rejected
          ? `<p class="comment">${COMMENT_ICON}<span><span class="comment__who">Your feedback:</span> ${esc(f.comment)}</span></p>`
          : reasoningHTML(f)}
        ${editing ? rejectFormHTML(f) : ""}
      </li>`;
  }

  // Live tally — always derived from field state.
  function tally() {
    const t = { updated: 0, added: 0, deleted: 0, rejected: 0 };
    state.fields.forEach((f) => (f.status === "rejected" ? t.rejected++ : t[f.change]++));
    return t;
  }

  function tallyHTML() {
    const t = tally();
    const parts = [`${t.updated} Updated`, `${t.added} Added`, `${t.deleted} Deleted`];
    if (t.rejected) parts.push(`<strong class="tally__rejected">${t.rejected} Rejected</strong>`);
    return `
      <div class="tally">
        <span class="tally__text">${parts.join(" · ")}</span>
        ${state.resolved ? "" : `<button type="button" class="link-btn tally__undo" id="undo" ${state.history.length ? "" : "disabled"}>Undo last edit</button>`}
      </div>`;
  }

  function actionsHTML() {
    const r = state.resolved;
    if (r) {
      const text = r.kind === "approved"
        ? `Approved · ${r.applied} ${r.applied === 1 ? "change" : "changes"} applied, ${r.rejected} rejected`
        : "Rejected · returned to the requester with your feedback";
      return `<p class="resolved-note resolved-note--${r.kind}">${text}</p>`;
    }
    const nothingToApply = tally().rejected === state.fields.length;
    return `
      <button type="button" class="btn btn--reject" id="reject-dcr" aria-haspopup="dialog">Reject</button>
      <button type="button" class="btn btn--approve" id="approve-dcr" ${nothingToApply ? 'disabled title="Every change is rejected — use Reject instead"' : ""}>Approve</button>`;
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
    $("#panel-summary").innerHTML = summaryHTML() + tallyHTML();
    $("#changes").innerHTML = state.fields.map(changeHTML).join("");
    $("#panel-actions").innerHTML = actionsHTML();
  }

  function getField(id) {
    return state.fields.find((f) => f.id === id);
  }

  // Polite live region so screen-reader users hear state changes.
  function announce(msg) {
    const live = $("#live");
    live.textContent = "";
    setTimeout(() => (live.textContent = msg), 50);
  }

  function tallyPhrase() {
    const t = tally();
    return `${t.rejected} rejected, ${state.fields.length - t.rejected} to apply.`;
  }

  // ---------- Per-field rejection ----------
  function startReject(id) {
    state.rejecting = id;
    state.draft = "";
    state.rejectError = false;
    renderPanel();
    $(`#comment-${id}`).focus();
  }

  function cancelReject() {
    const id = state.rejecting;
    state.rejecting = null;
    state.rejectError = false;
    renderPanel();
    $(`#change-${id} [data-action="start-reject"]`)?.focus();
  }

  function confirmReject(id) {
    const comment = state.draft.trim();
    if (!comment) {
      state.rejectError = "empty";
      renderPanel();
      $(`#comment-${id}`).focus();
      return;
    }
    const f = getField(id);
    state.history.push({ id, status: f.status, comment: f.comment, verb: "rejected" });
    f.status = "rejected";
    f.comment = comment;
    state.rejecting = null;
    state.rejectError = false;
    renderPanel();
    $(`#change-${id} [data-action="unreject"]`).focus();
    announce(`${f.label} rejected with feedback. ${tallyPhrase()}`);
  }

  function unreject(id) {
    const f = getField(id);
    state.history.push({ id, status: f.status, comment: f.comment, verb: "unrejected" });
    f.status = "pending";
    f.comment = "";
    renderPanel();
    $(`#change-${id} [data-action="start-reject"]`).focus();
    announce(`${f.label} restored. ${tallyPhrase()}`);
  }

  function undo() {
    const last = state.history.pop();
    if (!last) return;
    const f = getField(last.id);
    f.status = last.status;
    f.comment = last.comment;
    state.rejecting = null;
    renderPanel();
    const btn = $("#undo");
    (btn.disabled ? $(`#change-${f.id}`) : btn).focus();
    announce(`Undid: ${f.label} ${last.verb}. ${tallyPhrase()}`);
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

  function closePanel({ restoreFocus = true } = {}) {
    panel.hidden = true;
    const row = $('tr[data-task="dcr"]');
    if (row) row.classList.remove("is-selected");
    if (restoreFocus) ($("#open-dcr") || $("#task-total")).focus();
  }

  // ---------- Resolve: approve / reject the whole request ----------
  function guardOpenRejection() {
    if (!state.rejecting) return false;
    state.rejectError = "pending";
    renderPanel();
    $(`#comment-${state.rejecting}`).focus();
    return true;
  }

  function approve() {
    if (guardOpenRejection()) return;
    const t = tally();
    state.resolved = { kind: "approved", applied: state.fields.length - t.rejected, rejected: t.rejected };
    finishResolve();
  }

  const rejectDialog = $("#reject-dialog");
  function openRejectDialog() {
    if (guardOpenRejection()) return;
    $("#reject-dcr-comment").value = "";
    setRejectDialogError(false);
    rejectDialog.showModal();
  }
  function setRejectDialogError(on) {
    const input = $("#reject-dcr-comment");
    $("#reject-dcr-error").hidden = !on;
    input.toggleAttribute("aria-invalid", on);
  }
  function confirmRejectDCR() {
    const comment = $("#reject-dcr-comment").value.trim();
    if (!comment) {
      setRejectDialogError(true);
      $("#reject-dcr-comment").focus();
      return;
    }
    rejectDialog.close();
    state.resolved = { kind: "rejected", comment };
    finishResolve();
  }

  function finishResolve() {
    state.taskInInbox = false;
    closePanel({ restoreFocus: false });
    renderInbox();
    showToast();
  }

  // ---------- Toast ----------
  const toast = $("#toast");
  function showToast() {
    const r = state.resolved;
    const changes = (n) => `${n} ${n === 1 ? "change" : "changes"}`;
    $("#toast-text").textContent = r.kind === "approved"
      ? `DCR approved for ${dcr.entityName} · ${changes(r.applied)} applied, ${r.rejected} rejected`
      : `DCR rejected for ${dcr.entityName} · returned to ${dcr.createdBy}`;
    toast.className = `toast toast--${r.kind}`;
    toast.hidden = false;
    announce($("#toast-text").textContent);
    $("#toast-view").focus();
  }
  function hideToast() {
    toast.hidden = true;
  }

  // ---------- Events ----------
  $("#task-rows").addEventListener("click", (e) => {
    if (e.target.closest("#open-dcr")) openPanel();
  });
  $("#close-panel").addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action], #how-open, #undo, #approve-dcr, #reject-dcr");
    if (!btn) return;
    if (btn.id === "how-open") return openHow();
    if (btn.id === "undo") return undo();
    if (btn.id === "approve-dcr") return approve();
    if (btn.id === "reject-dcr") return openRejectDialog();
    const id = btn.closest(".change")?.dataset.id;
    switch (btn.dataset.action) {
      case "toggle-why": return toggleWhy(id);
      case "jump": return jumpTo(btn.dataset.level);
      case "start-reject": return startReject(id);
      case "cancel-reject": return cancelReject();
      case "unreject": return unreject(id);
    }
  });
  panel.addEventListener("input", (e) => {
    if (e.target.matches(".reject-form__input")) state.draft = e.target.value;
  });
  panel.addEventListener("submit", (e) => {
    e.preventDefault();
    confirmReject(e.target.dataset.id);
  });
  panel.addEventListener("keydown", (e) => {
    // Esc inside the comment box cancels the rejection, not the whole panel.
    if (e.key === "Escape" && e.target.matches(".reject-form__input")) {
      e.stopPropagation();
      cancelReject();
    }
    // Cmd/Ctrl + Enter submits the comment.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.matches(".reject-form__input")) {
      e.preventDefault();
      confirmReject(state.rejecting);
    }
  });
  $("#how-close").addEventListener("click", () => howDialog.close());
  howDialog.addEventListener("close", () => $("#how-open")?.focus());
  $("#reject-dcr-form").addEventListener("submit", (e) => {
    e.preventDefault();
    confirmRejectDCR();
  });
  $("#reject-dcr-cancel").addEventListener("click", () => {
    rejectDialog.close();
    $("#reject-dcr")?.focus();
  });
  $("#toast-view").addEventListener("click", () => {
    hideToast();
    openPanel();
  });
  $("#toast-close").addEventListener("click", () => {
    hideToast();
    $("#task-total").focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || panel.hidden) return;
    if (document.querySelector("dialog[open]")) return; // dialog handles its own Esc
    closePanel();
  });

  // ---------- Boot ----------
  $("#reset-demo").addEventListener("click", () => {
    state = freshState();
    panel.hidden = true;
    hideToast();
    renderInbox();
    $("#open-dcr").focus();
  });

  renderInbox();
})();

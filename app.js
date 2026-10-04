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
      fields: SEED_FIELDS.map((f) => ({ ...f, status: "pending", comment: "" })),
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

  function changeHTML(f) {
    return `
      <li class="change" id="change-${f.id}" data-id="${f.id}">
        <div class="change__head">
          <span class="change__label">${esc(f.label)}</span>
          <span class="tag tag--${f.change}">${CHANGE_LABEL[f.change]}</span>
          <span class="change__spacer"></span>
        </div>
        <div class="change__values">${valuesHTML(f)}</div>
      </li>`;
  }

  function renderPanel() {
    $("#entity-name").textContent = dcr.entityName;
    $("#entity-type").textContent = dcr.entityType;
    $("#entity-id").textContent = dcr.entityId;
    $("#changes").innerHTML = state.fields.map(changeHTML).join("");
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
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) closePanel();
  });

  // ---------- Boot ----------
  $("#reset-demo").addEventListener("click", () => {
    state = freshState();
    panel.hidden = true;
    renderInbox();
  });

  renderInbox();
})();

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

  // ---------- Boot ----------
  $("#reset-demo").addEventListener("click", () => {
    state = freshState();
    renderInbox();
  });

  renderInbox();
})();

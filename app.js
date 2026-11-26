/*
 * Review DCR prototype — app logic (vanilla JS, no build step).
 * Flow follows the Figma "Final end to end workflow" page. The reviewer starts on
 * the entity profile ("Profile Page 01 — Reviewer Viewing"): Workflow panel →
 * REVIEW DCR opens the Review DCR dialog. The same task is also in the Inbox:
 *   Inbox (07) → review panel (08) → Review DCR dialog (09)
 *   → REJECT on a field → required comment (10/11) → Rejected + comment (12)
 *   → Approve / Reject → back to the Inbox with a snack bar.
 * All UI is rendered from one state object; tallies are always derived.
 */
(function () {
  "use strict";

  const { dcr, fields: SEED, tasks: TASKS, totalTasks, user, profile } = window.DEMO;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const icon = window.icon;

  // Workflow panel filters (profile page)
  const WF_DEFAULT = { q: "", type: "all", status: "all", priority: "all", assignee: "all", due: "all", created: "all" };

  // ---------- State ----------
  function freshState() {
    return {
      fields: SEED.map((f) => ({ ...f, value: f.proposed, status: "pending", whyOpen: false })),
      comments: [],           // { id, fieldId|null, kind: "rejection"|"note"|"request", text, at }
      extra: [],              // values the REVIEWER adds with "+": { id, of: fieldId, value }
      touched: new Set(),     // row ids whose value was committed (show "incomplete" errors only after that)
      newAttrs: [],           // profile attributes the REVIEWER adds with "Add attribute", one row per value: { id, attr, current, value }
      selected: new Set(),    // indices into TASKS
      deleted: new Set(),     // I4: tasks removed with bulk Delete
      dcrInInbox: true,
      resolved: null,         // { kind: "approved"|"rejected", applied, rejected }
      pending: null,          // what the open comment dialog will do: { kind: "field", id } | { kind: "request", from }
      orgOpen: true,
      wfOpen: true,           // Workflow panel on the profile (open in Figma "Reviewer Viewing")
      wfExpanded: true,       // the DCR card's details (due date, priority, assignee)
      wfForm: { ...profile.workflow.open.form }, // due date (DD/MM/YYYY), priority, assignee — editable
      wfFilter: { ...WF_DEFAULT },  // applied Workflow filters
      wfDraft: { ...WF_DEFAULT },   // filters being edited in the open filter form
      wfFiltersOpen: false,
      panelTab: "info",       // Inbox review panel tab: "info" | "details"
      pdClosed: new Set(),    // collapsed sections in Additional details
      viewing: null,          // DCR id shown in "View DCR" (history), or null for Review DCR
      histOpen: new Set(),    // fields whose history is expanded in View DCR
      mode: "viewing",        // profile header mode: "viewing" | "suggesting" | "editing"
      saved: {},              // profile values saved in Editing mode: { [card|label]: values[] }
      moreOpen: new Set(),    // profile cards expanded with "Show more"
      sug: null,              // Suggesting draft: { rows: { [attrKey]: [{ rid, orig, value, del, added }] } }
      dueMsg: null,           // P9: { level: "error"|"warning", text } under the typed due date
      rejecting: null,        // field id whose inline rejection reason box is open (R14)
      drafts: {},             // unsent rejection reasons per field id (kept when another box opens)
      seq: 0,
    };
  }
  let state = freshState();

  // Requester's change types. "Updated" is the reviewer's own change (value differs from the proposal).
  const CHANGE_LABEL = { added: "Added", edited: "Edited", deleted: "Deleted" };
  const CONF = {
    review: { label: "Needs review" },
    high: { label: "High Confidence" },
    notvalidated: { label: "Not Validated" },
  };
  const PRIORITY = { High: "error", Medium: "progress", Low: "success" };
  const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
  const field = (id) => state.fields.find((f) => f.id === id);
  const extraOf = (fid) => state.extra.filter((x) => x.of === fid);
  // A row is either a requester field or a value the reviewer added under it
  const item = (id) => field(id)
    || (() => { const x = state.extra.find((e) => e.id === id); return x && { ...field(x.of), ...x, isExtra: true, ref: x }; })()
    || (() => { const r = state.newAttrs.find((e) => e.id === id); return r && { ...r, label: r.attr, isNew: true, ref: r }; })();
  // Profile attributes (Figma profile cards) that are not in this DCR and not added yet
  // A card's attributes, including those behind "Show more"; values reflect anything saved in Editing mode
  const cardAttrs = (c) => [...(c.attrs || []), ...(c.more || [])];
  const valsOf = (c, a) => (state.saved && state.saved[`${c.title}|${a[0]}`]) || a[2];
  const withVals = (c) => cardAttrs(c).map((a) => [a[0], a[1], valsOf(c, a), a[3], a[4]]);
  const profileAttrs = () => profile.columns.flat().flatMap(withVals).map(([label, , values]) => ({ label, values }));
  const availableAttrs = () => profileAttrs().filter((a) => !profile.inDcr[a.label] && !state.newAttrs.some((r) => r.attr === a.label));
  // A reviewer-added attribute row counts as a change when its value differs from the profile
  const newAttrChanged = (r) => (r.value || null) !== (r.current || null);
  // Values already in this DCR for the attribute (other rows), so a menu can grey them out
  const usedValues = (fid, exceptId) => [field(fid), ...extraOf(fid)].filter((r) => r.id !== exceptId).map((r) => r.value).filter((v) => v != null && v !== "");
  const now = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    let h = d.getHours(); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(h)}:${p(d.getMinutes())} ${ap}`; // DD/MM/YYYY like the profile
  };
  function announce(msg) { const l = $("#live"); l.textContent = ""; setTimeout(() => (l.textContent = msg), 50); }

  // Fill static [data-icon] placeholders
  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-icon]:not([data-hydrated])").forEach((el) => {
      let name = el.dataset.icon;
      if (name.startsWith("expand_less")) name = "expand_less";
      el.innerHTML = name === "expand_less"
        ? `<svg class="ico" width="${el.dataset.size || 20}" height="${el.dataset.size || 20}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 8L6 14L7.41 15.41L12 10.83L16.59 15.41L18 14L12 8Z"/></svg>`
        : icon(name, +(el.dataset.size || 20));
      el.dataset.hydrated = "";
    });
  }

  // ---------- Derived ----------
  function tally() {
    const t = { edited: 0, added: 0, deleted: 0, rejected: 0 };
    state.fields.forEach((f) => {
      if (f.status === "rejected") t.rejected++;
      else if (f.change === "added") t.added++;
      else if (f.change === "deleted") t.deleted++;
      else t.edited++;
    });
    return t;
  }
  function confCounts() {
    const c = { high: 0, review: 0, notvalidated: 0 };
    state.fields.forEach((f) => c[f.confidence]++);
    return c;
  }
  function summaryText() {
    const c = confCounts();
    return `${c.high} clear · ${c.review} needs review · ${c.notvalidated} no signal`;
  }
  const visibleTasks = () => TASKS.map((t, i) => ({ t, i })).filter(({ i }) => (i !== 0 || state.dcrInInbox) && !state.deleted.has(i));

  // ---------- Inbox ----------
  function renderInbox() {
    const rows = visibleTasks().map(({ t, i }) => {
      const [type, ent, more, pri, by, on, status, due] = t;
      const isDcr = i === 0;
      const checked = state.selected.has(i);
      const typeCell = isDcr
        ? `<button type="button" class="row-open" id="open-dcr" aria-haspopup="true">${esc(type)}</button>`
        : `<span class="cell-type__text">${esc(type)}</span>`;
      return `
        <tr data-i="${i}" class="${checked ? "is-checked" : ""}${isDcr && !$("#review-panel").hidden ? " is-open" : ""}">
          <td class="col-type"><div class="cell-type">
            <label class="cb"><input type="checkbox" data-row="${i}" ${checked ? "checked" : ""} aria-label="Select ${esc(type)} for ${esc(ent)}"><span class="cb__box" aria-hidden="true"></span></label>
            ${typeCell}</div></td>
          <td class="col-ent"><span class="pill pill--default">${esc(ent)}</span>${more ? `<span class="pill-more">+${more}</span>` : ""}</td>
          <td class="col-pri"><span class="pill pill--${PRIORITY[pri]}">${esc(pri)}</span></td>
          <td class="col-by">${esc(by)}</td>
          <td class="col-on">${esc(on)}</td>
          <td class="col-st"><span class="status status--${slug(status)}"><span class="status__dot" aria-hidden="true"></span>${esc(status)}</span></td>
          <td class="col-due">${esc(due)}</td>
        </tr>`;
    });
    $("#task-rows").innerHTML = rows.join("");
    const shown = visibleTasks().length;
    $("#inbox-count").textContent = shown;
    $("#page-range").textContent = `1–${shown} of ${totalTasks - (state.dcrInInbox ? 0 : 1) - state.deleted.size}`;
    renderSelection();
  }
  function renderSelection() {
    const n = state.selected.size;
    $("#selected-count").textContent = `${n} ${n === 1 ? "task" : "tasks"} selected`;
    const all = $("#select-all");
    const total = visibleTasks().length;
    all.checked = n > 0 && n === total;
    all.indeterminate = n > 0 && n < total;
    const bulk = $("#bulk-actions");
    if (!n && bulk.contains(document.activeElement)) all.focus(); // don't strand focus on a hidden button
    bulk.hidden = n === 0;
  }
  // Bulk actions: tooltips on hover and focus (Esc hides them, WCAG 1.4.13). The actions aren't built yet.
  $("#bulk-actions").addEventListener("click", (e) => {
    const b = e.target.closest("[data-bulk]");
    if (!b) return;
    if (b.dataset.bulk === "Delete") { bulkDelete(); return; }
    announce(`${b.dataset.bulk} for ${state.selected.size} selected ${state.selected.size === 1 ? "task" : "tasks"} isn't part of this prototype yet.`);
  });
  /* I4 (interaction spec): Delete can't be undone, so it always confirms (Cancel has focus), then a snack bar
     reports the result. A data change request can't be deleted, only rejected, so it is left out and kept
     selected, and the confirm says so ("Delete applies to 2 of 3 selected tasks"). */
  function bulkDelete() {
    const sel = [...state.selected], eligible = sel.filter((i) => i !== 0), n = sel.length, k = eligible.length;
    const tasks = (x) => `${x} ${x === 1 ? "task" : "tasks"}`;
    const kept = n - k ? ` Delete applies to ${k} of ${n} selected tasks: data change requests can only be rejected.` : "";
    if (!k) { bulkToast("Nothing deleted", "Data change requests can't be deleted. Reject them instead.", "rejected"); return; }
    confirmDialog({ title: `Delete ${tasks(k)}?`, text: `This can't be undone.${kept}`, ok: "Delete", cancel: "Cancel" }).then((ok) => {
      if (!ok) return;
      eligible.forEach((i) => { state.deleted.add(i); state.selected.delete(i); });
      renderInbox();
      $("#task-table").focus();
      bulkToast(`${tasks(k)} deleted`, n - k ? `${n - k} data change request is still selected.` : "Deleted tasks can't be restored.", "deleted");
    });
  }
  function bulkToast(title, text, kind) {
    $("#toast-title").textContent = title;
    $("#toast-text").textContent = text;
    $("#toast-view").hidden = true;
    toast.className = `toast toast--${kind}`;
    toast.hidden = false;
    announce(`${title}. ${text}`);
  }
  $("#bulk-actions").addEventListener("keydown", (e) => {
    const w = e.target.closest(".tip-wrap");
    if (e.key === "Escape" && w && !w.classList.contains("tip-off")) { e.stopPropagation(); w.classList.add("tip-off"); }
  });
  ["mouseleave", "focusout"].forEach((ev) => $("#bulk-actions").addEventListener(ev, (e) => {
    const w = e.target.closest && e.target.closest(".tip-wrap"); if (w) w.classList.remove("tip-off");
  }, true));


  // ---------- Validation (Review DCR text inputs) ----------
  // chars: what may be typed at all (checked live). full: the complete value (checked once committed).
  const RULES = {
    phone:  { chars: /^[\d\s()+.-]*$/, full: (v) => /^\+?[\d\s().-]+$/.test(v) && (v.match(/\d/g) || []).length >= 7 && (v.match(/\d/g) || []).length <= 15,
              msg: "Enter a phone number using digits, spaces and an optional +, e.g. +1 860 555 0148." },
    url:    { chars: /^\S*$/, full: (v) => /^(https?:\/\/)?([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(\/\S*)?$/i.test(v),
              msg: "Enter a web address, e.g. groton-mystic-falcons.com." },
    integer:{ chars: /^[\d,]*$/, full: (v) => /^\d{1,3}(,?\d{3})*$/.test(v), msg: "Enter a whole number, e.g. 310." },
    place:  { chars: /^[\p{L}\s.'-]*$/u, full: (v) => /^\p{L}[\p{L}\s.'-]*$/u.test(v), msg: "Use letters only, e.g. Groton." },
    taxid:  { chars: /^[\d-]*$/, full: (v) => /^\d[\d-]*\d$/.test(v), msg: "Use digits and hyphens only, e.g. 06-1234567." },
    digits: { chars: /^\d*$/, full: (v) => /^\d+$/.test(v), msg: "Use digits only, e.g. 2069885596." },
    email:  { chars: /^\S*$/, full: (v) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v), msg: "Enter an email address, e.g. info@grotonmysticfalcons.com." },
    year:   { chars: /^\d*$/, full: (v) => /^\d{4}$/.test(v) && +v >= 1800 && +v <= new Date().getFullYear(), msg: "Enter a 4-digit year, e.g. 2004." },
  };
  const KIND = { phone: "phone", website: "url", employees: "integer", city: "place", taxId: "taxid", "Data Provider Organization ID": "digits", Email: "email", Fax: "phone", "Founded Year": "year" };
  // Returns { level: "error" | "warning", text, live } or null. live = may show while typing.
  function check(row, raw) {
    const v = (raw ?? "").trim();
    const kind = KIND[row.isNew ? row.attr : row.isExtra ? row.of : row.id];
    const rule = kind && RULES[kind];
    if (rule && v && !rule.chars.test(v)) return { level: "error", text: rule.msg, live: true };
    if (row.isNew) {
      if (!v) return row.current == null ? null : { level: "error", text: "Enter a value, or delete this row." };
      if (rule && !rule.full(v)) return { level: "error", text: rule.msg };
      if (v === (row.current || "")) return { level: "warning", text: "Same as the current profile value, so this won't be sent as a change. Edit it, or delete the row.", live: true };
      return null;
    }
    if (row.isExtra) return v && rule && !rule.full(v) ? { level: "error", text: rule.msg } : null;
    if (!v || v === "—") return row.change === "deleted" ? null : { level: "error", text: `Enter a ${row.label.toLowerCase()}, or reject this change instead.` };
    return rule && !rule.full(v) ? { level: "error", text: rule.msg } : null;
  }
  const rowValue = (it) => (it.isExtra || it.isNew ? it.ref.value : it.value) ?? "";
  // What to show under a row right now (incomplete-value errors wait until the value is committed)
  function shownMsg(it, raw = rowValue(it)) {
    if (it.options || state.resolved || it.status === "rejected" || (!it.isExtra && !it.isNew && it.change === "deleted")) return null;
    const r = check(it, raw);
    return r && (r.live || r.level === "warning" || state.touched.has(it.id)) ? r : null;
  }
  function msgHTML(id, r) {
    return `<p class="erow__msg erow__msg--${r ? r.level : "none"}" id="msg-${id}" ${r ? "" : "hidden"}>${r ? `${icon("error_outline", 16)}<span><span class="sr-only">${r.level === "error" ? "Error: " : "Note: "}</span>${esc(r.text)}</span>` : ""}</p>`;
  }
  const invalidAttrs = (r) => r && r.level === "error" ? `aria-invalid="true"` : "";
  // All rows that would block Approve / Resubmit
  function blockingRows() {
    const rows = [...state.newAttrs.map((r) => item(r.id)), ...state.fields.flatMap((f) => [f, ...extraOf(f.id).map((x) => item(x.id))])];
    return rows.filter((it) => !it.options && !state.resolved && it.status !== "rejected" && !(!it.isExtra && !it.isNew && it.change === "deleted"))
      .filter((it) => { const r = check(it, rowValue(it)); return r && r.level === "error"; });
  }

  // ---------- Shared bits ----------
  function confChip(f, withInfo) {
    const info = f.confidence === "high" && withInfo
      ? `<button type="button" class="conf__info" data-action="why" aria-expanded="${f.whyOpen}" aria-controls="${withInfo}-why-${f.id}" aria-label="Why ${CONF.high.label.toLowerCase()} for ${esc(f.label)}">${icon("error_outline", 18)}</button>`
      : "";
    return `<span class="conf conf--${f.confidence}">${icon("ai", 12)}${CONF[f.confidence].label}${info}</span>`;
  }
  function whyHTML(f, prefix) {
    const open = f.confidence !== "high" || f.whyOpen;
    return `<p class="why why--${f.confidence}" id="${prefix}-why-${f.id}" ${open ? "" : "hidden"}><span class="why__bar" aria-hidden="true"></span><span><span class="sr-only">Why this signal: </span>${esc(f.reasoning)}</span></p>`;
  }
  // "Edited"/"Added"/"Deleted" = what the requester did. "Updated" = the reviewer changed the value here.
  function tagHTML(f) {
    if (f.value !== f.proposed) return `<span class="tag tag--updated">Updated<span class="sr-only"> by you</span></span>`;
    return `<span class="tag tag--${f.change}">${CHANGE_LABEL[f.change]}</span>`;
  }
  const fmt = (v) => (v == null || v === "" ? "—" : v);

  // ---------- Review panel (Inbox-08) ----------
  const panel = $("#review-panel");
  function panelRowHTML(f) {
    const rejected = f.status === "rejected";
    return `
      <li class="chg${rejected ? " chg--rejected" : ""}" data-id="${f.id}">
        <div class="chg__head">
          <span class="chg__label">${esc(f.label)}</span>
          ${rejected ? `<span class="tag tag--deleted">Rejected</span>` : tagHTML(f)}
          <span class="chg__spacer"></span>
          ${confChip(f, "p")}
        </div>
        <p class="chg__values">
          <span class="sr-only">From</span><span class="val-old">${esc(fmt(f.original))}</span>
          <span class="val-arrow" aria-hidden="true">→</span>
          <span class="sr-only">to</span><span class="val-new">${esc(fmt(f.value))}</span>
        </p>
        ${whyHTML(f, "p")}
      </li>`;
  }
  function renderPanel() {
    $("#panel-avatar").textContent = dcr.entityInitials;
    $("#panel-entity-name").textContent = dcr.entityName;
    $("#panel-entity-type").textContent = dcr.entityType;
    $("#panel-entity-id").textContent = `Entity ID: ${dcr.entityId}`;
    $("#panel-summary").innerHTML = `${icon("ai", 18)}<span>${summaryText()}</span>`;
    $("#panel-changes").innerHTML = state.newAttrs.filter(newAttrChanged).map((r) => `
      <li class="chg chg--extra">
        <div class="chg__head"><span class="chg__label">${esc(r.attr)}</span><span class="tag tag--${r.current == null ? "added" : "updated"}">${r.current == null ? "Added" : "Updated"}<span class="sr-only"> by you</span></span></div>
        <p class="chg__values"><span class="sr-only">From</span><span class="val-old">${esc(fmt(r.current))}</span><span class="val-arrow" aria-hidden="true">→</span><span class="sr-only">to</span><span class="val-new">${esc(fmt(r.value))}</span></p>
      </li>`).join("") + state.fields.map((f) => panelRowHTML(f) + extraOf(f.id).filter((x) => x.value).map((x) => `
      <li class="chg chg--extra">
        <div class="chg__head"><span class="chg__label">${esc(f.label)}</span><span class="tag tag--added">Added<span class="sr-only"> by you</span></span></div>
        <p class="chg__values"><span class="sr-only">From</span><span class="val-old">—</span><span class="val-arrow" aria-hidden="true">→</span><span class="sr-only">to</span><span class="val-new">${esc(x.value)}</span></p>
      </li>`).join("")).join("");
    const t = tally();
    $("#more-info-body").innerHTML = `
      <dt>DCR ID</dt><dd>${esc(dcr.dcrId)}</dd>
      <dt>Created by</dt><dd>${esc(dcr.createdBy)} · ${esc(dcr.createdOn)}</dd>
      <dt>Step</dt><dd>${esc(dcr.step)}</dd>
      <dt>Changes</dt><dd>${t.edited} edited · ${t.added} added · ${t.deleted} deleted · ${t.rejected} rejected</dd>`;
    const r = state.resolved;
    $("#panel-actions").innerHTML = r
      ? `<p class="resolved-note resolved-note--${r.kind}">${r.kind === "approved" ? `Approved · ${r.applied} applied` : r.kind === "resubmitted" ? `Sent for resubmission · ${r.rejected} returned, ${r.applied} applied` : "Rejected · returned to the requester"}</p>`
      : actionsHTML("panel");
  }
  function openPanel() {
    setPanelTab("info");
    renderPanel();
    panel.hidden = false;
    renderInbox();
    $("#panel-title").focus();
  }
  function closePanel({ focus = true } = {}) {
    panel.hidden = true;
    renderInbox();
    if (focus) ($("#open-dcr") || $("#task-table")).focus();
  }

  // ---------- Review DCR dialog (Inbox-09 … 12) ----------
  const review = $("#review-dialog");
  function erowHTML(f) {
    const rejected = f.status === "rejected";
    const locked = !!state.resolved;
    const n = state.comments.filter((c) => c.fieldId === f.id).length;
    const changed = f.value !== f.proposed;
    const inputId = `val-${f.id}`;
    const fMsg = shownMsg(f);
    const fieldCtl = f.options
      ? ddHTML(f.id, f.options, f.value, usedValues(f.id, f.id), rejected || locked)
      : `<input class="erow__input" id="${inputId}" data-action="edit" value="${esc(f.value == null ? "—" : f.value)}" aria-describedby="msg-${f.id}" ${invalidAttrs(fMsg)} ${rejected || locked || f.change === "deleted" ? 'readonly aria-readonly="true"' : ""}>`;
    return `
      <li class="erow${rejected ? " erow--rejected" : ""}" data-id="${f.id}">
        ${confChip(f, "d")}
        <div class="erow__content">
          <label class="erow__label" id="lbl-${f.id}" for="${inputId}">${esc(f.label)}</label>
          <span class="erow__old${f.change === "deleted" ? " erow__old--removed" : ""}"><span class="sr-only">Current value: </span>${esc(fmt(f.original))}</span>
          <span class="erow__arrow" aria-hidden="true">→</span>
          <span class="erow__field">${fieldCtl}</span>
          <span class="erow__tools">
            <button type="button" class="icon-btn" data-action="add-value" aria-label="Add another ${esc(f.label)} value" ${rejected || locked ? 'aria-disabled="true"' : ""}>${icon("add", 20)}</button>
            ${changed && !rejected && !locked ? `<button type="button" class="icon-btn" data-action="revert" aria-label="Revert ${esc(f.label)} to the requester's value">${icon("undo", 20)}</button>` : ""}
          </span>
          <span class="erow__end">
            ${tagHTML(f)}
            ${rejected
              ? `<button type="button" class="rejected-chip" data-action="unreject" ${locked ? "disabled" : ""} aria-label="Rejected. Undo rejection of ${esc(f.label)}">Rejected${icon("clear", 14)}</button>`
              : locked ? "" : `<button type="button" class="btn-xs" data-action="reject-field" aria-expanded="${state.rejecting === f.id}" aria-controls="reason-${f.id}">Reject<span class="sr-only"> ${esc(f.label)}</span></button>`}
          </span>
        </div>
        ${f.options ? "" : msgHTML(f.id, fMsg)}
        ${whyHTML(f, "d")}
        ${reasonHTML(f)}
        ${n ? `<button type="button" class="comment-pin" data-action="show-comments" aria-label="${n} ${n === 1 ? "comment" : "comments"} on ${esc(f.label)}">${icon("mode_comment", 18)}<span class="comment-pin__n" aria-hidden="true">${n}</span></button>` : ""}
      </li>${extraOf(f.id).map((x) => xrowHTML(f, x)).join("")}`;
  }
  /* R14 (interaction spec, option b): the reason for a field rejection is written in a box under the row,
     so the value and its signal stay in view. A reason is required; Ctrl/Cmd+Enter submits, Esc cancels.
     Only one box is open at a time; an unsent reason is kept as a draft when another row's box opens. */
  const MOD_KEY = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? "⌘" : "Ctrl";
  function reasonHTML(f) {
    if (state.rejecting !== f.id || state.resolved || f.status === "rejected") return "";
    const v = state.drafts[f.id] || "";
    return `<div class="reason" id="reason-${f.id}">
        <label class="reason__label" for="reason-input-${f.id}">Why are you rejecting ${esc(f.label)}?</label>
        <textarea class="reason__input" id="reason-input-${f.id}" data-reason="${f.id}" rows="2" maxlength="1000" aria-required="true" aria-describedby="reason-hint-${f.id}">${esc(v)}</textarea>
        <div class="reason__foot">
          <p class="reason__hint" id="reason-hint-${f.id}">The requester sees this next to the field. ${MOD_KEY}+Enter rejects, Esc cancels.</p>
          <p class="reason__count" ${v.length >= 900 ? "" : "hidden"}>${v.length} / 1,000</p>
          <button type="button" class="text-btn" data-action="reason-cancel">Cancel</button>
          <button type="button" class="text-btn text-btn--danger" data-action="reason-submit" ${v.trim() ? "" : "disabled"}>Reject field</button>
        </div>
      </div>`;
  }
  function openReason(id) {
    state.rejecting = id;
    renderReview();
    const ta = $(`#reason-input-${id}`);
    scrollWithin($("#review-main"), ta.closest(".erow"));
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
  function cancelReason(id) {
    delete state.drafts[id];
    state.rejecting = null;
    renderReview();
    review.querySelector(`.erow[data-id="${id}"] [data-action="reject-field"]`)?.focus();
    announce(`Rejection of ${field(id).label} cancelled. Nothing was rejected.`);
  }
  function submitReason(id) {
    const text = (state.drafts[id] || "").trim();
    if (!text) return;
    delete state.drafts[id];
    state.rejecting = null;
    state.pending = { kind: "field", id };
    applyComment(text);
  }
  /* DS Field + DS Menu as a select-only combobox. Values already used by another row of the
     same attribute are greyed out (DS Menu item, disabled state) and can't be picked. */
  function ddHTML(id, options, value, used, disabled, takenNote = "already in this request") {
    return `<button type="button" class="erow__input dd__trigger" id="val-${id}" role="combobox" aria-haspopup="listbox" aria-expanded="false"
         aria-controls="lb-${id}" aria-labelledby="lbl-${id} val-${id}" ${disabled ? "disabled" : ""}>
         <span class="dd__value">${value == null ? `<span class="sr-only">No value selected</span>` : esc(value)}</span><span class="dd__chev" aria-hidden="true">${icon("arrow_drop_down", 20)}</span></button>
       <ul class="dd__menu" id="lb-${id}" role="listbox" aria-labelledby="lbl-${id}" hidden>
         ${options.map((o, i) => { const taken = used.includes(o) && o !== value;
           return `<li class="dd__item${taken ? " is-disabled" : ""}" role="option" id="opt-${id}-${i}" data-value="${esc(o)}" aria-selected="${o === value}"${taken ? ' aria-disabled="true"' : ""}>${esc(o)}${taken ? `<span class="sr-only"> (${takenNote})</span>` : ""}</li>`; }).join("")}
       </ul>`;
  }
  // A value the reviewer added with "+": same attribute, empty value, light-grey row, delete instead of add
  function xrowHTML(f, x) {
    const locked = !!state.resolved;
    const xMsg = f.options ? null : shownMsg(item(x.id));
    const ctl = f.options
      ? ddHTML(x.id, f.options, x.value, usedValues(f.id, x.id), locked)
      : `<input class="erow__input" id="val-${x.id}" data-action="edit" value="${esc(x.value || "")}" aria-describedby="msg-${x.id}" ${invalidAttrs(xMsg)} ${locked ? 'readonly aria-readonly="true"' : ""}>`;
    return `
      <li class="erow erow--extra" data-id="${x.id}">
        <div class="erow__content">
          <label class="erow__label" id="lbl-${x.id}" for="val-${x.id}">${esc(f.label)}<span class="sr-only"> (another value, added by you)</span></label>
          <span class="erow__old"><span class="sr-only">Current value: </span>—</span>
          <span class="erow__arrow" aria-hidden="true">→</span>
          <span class="erow__field">${ctl}</span>
          <span class="erow__tools">
            ${locked ? "" : `<button type="button" class="icon-btn" data-action="remove-value" aria-label="Delete this added ${esc(f.label)} value">${icon("delete_outline", 20)}</button>`}
          </span>
          <span class="erow__end"><span class="tag tag--added">Added<span class="sr-only"> by you</span></span></span>
        </div>
        ${f.options ? "" : msgHTML(x.id, xMsg)}
      </li>`;
  }
  /* "Add attribute" (interaction spec R9, option b): a searchable picker. DS Menu surface with a search
     field at the top (combobox + listbox), attributes not in this request grouped by profile card, the
     match shown in bold. Arrow keys move, Enter adds, Esc closes. Real profiles have 100+ attributes. */
  function addAttrHTML() {
    const n = availableAttrs().length;
    return `<div class="add-attr-wrap" data-id="__addattr">
      <button type="button" class="add-attr" id="val-__addattr" aria-haspopup="listbox" aria-expanded="false" aria-controls="ap-pop"
        ${n ? "" : 'disabled title="Every profile attribute is already in this request"'}>${icon("add", 16)}<span class="dd__value">Add attribute</span><span class="dd__chev" aria-hidden="true">${icon("arrow_drop_down", 20)}</span></button>
      <div class="ap" id="ap-pop" hidden>
        <div class="ap__search">${icon("search", 18)}<input type="text" id="ap-q" role="combobox" aria-expanded="true" aria-controls="ap-list" aria-autocomplete="list"
          aria-label="Search profile attributes not in this request" placeholder="Search attributes" autocomplete="off"></div>
        <ul class="ap__list" id="ap-list" role="listbox" aria-label="Profile attributes not in this request"></ul>
        <p class="ap__empty" id="ap-empty" hidden></p>
      </div></div>`;
  }
  let ap = null, apTimer = null; // { opts, active }
  function apGroups(q) {
    const avail = new Set(availableAttrs().map((a) => a.label)), seen = new Set(), ql = q.trim().toLowerCase();
    return profile.columns.flat().map((c) => ({
      title: c.title,
      items: cardAttrs(c).map((a) => a[0]).filter((l) => avail.has(l) && !seen.has(l) && seen.add(l) && (!ql || l.toLowerCase().includes(ql))),
    })).filter((g) => g.items.length);
  }
  function apRender() {
    const q = $("#ap-q").value, ql = q.trim().toLowerCase();
    const hl = (l) => { if (!ql) return esc(l); const i = l.toLowerCase().indexOf(ql); return `${esc(l.slice(0, i))}<strong>${esc(l.slice(i, i + ql.length))}</strong>${esc(l.slice(i + ql.length))}`; };
    let k = 0;
    $("#ap-list").innerHTML = apGroups(q).map((g, gi) => `<li role="presentation">
        <div class="ap__group" id="ap-g-${gi}" aria-hidden="true">${esc(g.title)}</div>
        <ul class="ap__grp" role="group" aria-labelledby="ap-g-${gi}">
          ${g.items.map((l) => `<li class="dd__item ap__opt" role="option" id="ap-opt-${k++}" data-value="${esc(l)}" aria-selected="false">${hl(l)}</li>`).join("")}
        </ul></li>`).join("");
    ap.opts = [...$("#ap-list").querySelectorAll("[role=option]")];
    const empty = $("#ap-empty");
    empty.hidden = ap.opts.length > 0;
    empty.textContent = `No attributes match \u2018${q.trim()}\u2019`;
    apActive(ap.opts.length ? 0 : -1);
  }
  function apActive(i) {
    ap.active = i;
    ap.opts.forEach((o, j) => o.classList.toggle("is-active", j === i));
    const q = $("#ap-q");
    if (i < 0) { q.removeAttribute("aria-activedescendant"); return; }
    q.setAttribute("aria-activedescendant", ap.opts[i].id);
    const list = $("#ap-list"), o = ap.opts[i], head = o.closest("li[role=presentation]").querySelector(".ap__group").offsetHeight;
    if (o.offsetTop - head < list.scrollTop) list.scrollTop = o.offsetTop - head; // keep it clear of the pinned group heading
    else if (o.offsetTop + o.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = o.offsetTop + o.offsetHeight - list.clientHeight;
  }
  function apOpen() {
    ap = { opts: [], active: -1 };
    $("#ap-pop").hidden = false;
    $("#val-__addattr").setAttribute("aria-expanded", "true");
    $("#ap-q").value = "";
    apRender();
    $("#ap-q").focus();
  }
  function apClose(focusBtn) {
    if (!ap) return;
    ap = null; clearTimeout(apTimer);
    const pop = $("#ap-pop"); if (pop) pop.hidden = true;
    const btn = $("#val-__addattr");
    if (btn) { btn.setAttribute("aria-expanded", "false"); if (focusBtn) btn.focus(); }
  }
  function apPick(i) {
    const o = ap && ap.opts[i]; if (!o) return;
    const label = o.dataset.value;
    apClose(false);
    addAttribute(label);
  }
  review.addEventListener("click", (e) => {
    if (e.target.closest("#val-__addattr")) { ap ? apClose(true) : apOpen(); return; }
    const o = e.target.closest(".ap__opt"); if (o && ap) { apPick(ap.opts.indexOf(o)); return; }
    if (ap && !e.target.closest(".add-attr-wrap")) apClose(false);
  });
  review.addEventListener("mousemove", (e) => { const o = e.target.closest(".ap__opt"); if (o && ap && ap.opts.indexOf(o) !== ap.active) apActive(ap.opts.indexOf(o)); });
  review.addEventListener("input", (e) => {
    if (e.target.id !== "ap-q" || !ap) return;
    apRender();
    clearTimeout(apTimer);
    apTimer = setTimeout(() => { if (ap) announce(ap.opts.length ? `${ap.opts.length} ${ap.opts.length === 1 ? "attribute matches" : "attributes match"}.` : $("#ap-empty").textContent); }, 500);
  });
  review.addEventListener("keydown", (e) => {
    if (e.target.id === "val-__addattr" && e.key === "ArrowDown" && !ap) { e.preventDefault(); apOpen(); return; }
    if (e.target.id !== "ap-q" || !ap) return;
    const n = ap.opts.length;
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) apActive(Math.min(n - 1, ap.active + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) apActive(Math.max(0, ap.active - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (ap.active >= 0) apPick(ap.active); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); apClose(true); } // close the picker, not the dialog
    else if (e.key === "Tab") apClose(false);
  });
  // A profile attribute the reviewer added: current profile value, editable, + and delete, no revert, light-grey row
  function arowHTML(r, i, all) {
    const locked = !!state.resolved;
    const repeat = i > 0 && all[i - 1].attr === r.attr; // label shown once per attribute group
    const aMsg = shownMsg(item(r.id));
    const tag = r.current == null ? `<span class="tag tag--added">Added<span class="sr-only"> by you</span></span>`
      : newAttrChanged(r) ? `<span class="tag tag--updated">Updated<span class="sr-only"> by you</span></span>` : "";
    return `
      <li class="erow erow--extra erow--attr" data-id="${r.id}">
        <div class="erow__content">
          <label class="erow__label" id="lbl-${r.id}" for="val-${r.id}">${repeat ? `<span class="sr-only">${esc(r.attr)}</span>` : esc(r.attr)}<span class="sr-only"> (added by you from the profile)</span></label>
          <span class="erow__old"><span class="sr-only">Current value: </span>${esc(fmt(r.current))}</span>
          <span class="erow__arrow" aria-hidden="true">→</span>
          <span class="erow__field"><input class="erow__input" id="val-${r.id}" data-action="edit" value="${esc(r.value || "")}" aria-describedby="msg-${r.id}" ${invalidAttrs(aMsg)} ${locked ? 'readonly aria-readonly="true"' : ""}></span>
          <span class="erow__tools">${locked ? "" : `
            <button type="button" class="icon-btn" data-action="add-attr-value" aria-label="Add another ${esc(r.attr)} value">${icon("add", 20)}</button>
            <button type="button" class="icon-btn" data-action="remove-attr-value" aria-label="Delete this ${esc(r.attr)} row">${icon("delete_outline", 20)}</button>`}
          </span>
          <span class="erow__end">${tag}</span>
        </div>
        ${msgHTML(r.id, aMsg)}
      </li>`;
  }
  function addAttribute(label) {
    const a = profileAttrs().find((x) => x.label === label);
    const rows = (a.values.length ? a.values : [null]).map((v) => ({ id: `attr${++state.seq}`, attr: label, current: v, value: v }));
    state.newAttrs.push(...rows);
    renderReview();
    const first = review.querySelector(`.erow[data-id="${rows[0].id}"]`);
    scrollWithin($("#review-main"), first);
    const inp = $(`#val-${rows[0].id}`);
    inp.focus({ preventScroll: true });
    inp.setSelectionRange(inp.value.length, inp.value.length); // caret at the end, ready to edit
    announce(`${label} added with ${rows.length === 1 ? "its current profile value" : `its ${rows.length} current profile values`}. You can edit ${rows.length === 1 ? "it" : "them"}.`);
  }
  // Header / panel actions. Once a field is rejected the DCR can't be rejected as a whole;
  // Approve becomes Resubmit (DS Button, Primary variant): rejected fields go back to the
  // requester with their comments, the rest are applied.
  function actionsHTML(from) {
    const n = tally().rejected;
    if (!n) return `
      <button type="button" class="btn btn--reject" data-action="reject-request" data-from="${from}" aria-haspopup="dialog">Reject</button>
      <button type="button" class="btn btn--approve" data-action="approve">Approve</button>`;
    const hint = `actions-hint-${from}`;
    return `
      <button type="button" class="btn btn--reject" disabled aria-describedby="${hint}" title="Field rejections are in progress. Resubmit sends them back to the requester.">Reject</button>
      <button type="button" class="btn btn--primary" data-action="resubmit" aria-describedby="${hint}">Resubmit</button>
      <span class="sr-only" id="${hint}">${n} ${n === 1 ? "field is" : "fields are"} rejected. Resubmit sends ${n === 1 ? "it" : "them"} back to the requester with your comments and applies the other changes.</span>`;
  }
  function renderReview() {
    dd = null; ap = null;
    $("#review-title").textContent = state.viewing ? "View DCR" : "Review DCR";
    $("#comment-form").hidden = !!state.viewing;
    $("#rail-closed").hidden = !state.viewing;
    if (state.viewing) { renderHistory(historyFor(state.viewing)); return; }
    const t = tally();
    const r = state.resolved;
    $("#review-actions").innerHTML = r ? "" : actionsHTML("dialog");
    $("#review-main").innerHTML = `
      <div class="org">
        <span class="avatar avatar--entity" aria-hidden="true">${esc(dcr.entityInitials)}</span>
        <span class="org__name">${esc(dcr.entityName)}</span>
        <span class="type-badge">${esc(dcr.entityType)}</span>
        <span class="org__id">Entity ID: ${esc(dcr.entityId)}</span>
        <button type="button" class="icon-btn org__toggle" data-action="toggle-org" aria-expanded="${state.orgOpen}" aria-controls="req-summary" aria-label="${state.orgOpen ? "Hide" : "Show"} request summary">${icon("keyboard_arrow_up", 24)}</button>
      </div>
      <div class="req-summary" id="req-summary" ${state.orgOpen ? "" : "hidden"}>
        <p class="req-summary__id"><strong>DCR ID: ${esc(dcr.dcrId)}</strong><span>Created by ${esc(dcr.createdBy)}  ·  ${esc(dcr.createdOn)}  ·  Step: ${esc(dcr.step)}</span></p>
        <p class="tally tally--edited"><span class="tally__n">${t.edited}</span><span class="tally__l">Edited</span></p>
        <p class="tally tally--added"><span class="tally__n">${t.added}</span><span class="tally__l">Added</span></p>
        <p class="tally tally--deleted"><span class="tally__n">${t.deleted}</span><span class="tally__l">Deleted</span></p>
        <p class="tally tally--rejected"><span class="tally__n">${t.rejected}</span><span class="tally__l">Rejected</span></p>
      </div>
      <h3 class="sc__title">Suggested Changes</h3>
      ${state.resolved ? "" : addAttrHTML()}
      <div class="ai-summary">${icon("ai", 18)}<span>${summaryText()}</span><span class="ai-summary__right">Confidence updates as you edit</span></div>
      <ul class="edit-rows" aria-label="Suggested changes">${state.newAttrs.map(arowHTML).join("")}${state.fields.map(erowHTML).join("")}</ul>`;
    renderRail();
  }
  function renderRail() {
    $("#rail-title").textContent = `Comments (${state.comments.length})`;
    $("#rail-list").innerHTML = state.comments.map((c) => {
      const f = c.fieldId && field(c.fieldId);
      const cls = c.kind === "rejection" || c.kind === "request" ? " cmt--rejection" : "";
      const link = f
        ? `<button type="button" class="cmt__field" data-action="goto-row" data-field="${f.id}">Rejected · ${esc(f.label)}</button>`
        : c.kind === "request" ? `<p class="cmt__field">Rejected the request</p>` : "";
      return `
        <li class="cmt${cls}" id="cmt-${c.id}" ${f ? `data-field="${f.id}"` : ""} tabindex="-1">
          <span class="cmt__avatar"><span>${icon("person", 14)}</span></span>
          <div class="cmt__body">
            <p class="cmt__who">${esc(user.reviewer)}</p>
            <p class="cmt__when">${esc(c.at)}</p>
            ${link}
            <p class="cmt__text">${esc(c.text)}</p>
          </div>
        </li>`;
    }).join("");
  }
  let reviewOpener = null, reviewOpenerSel = null;
  function openReview(fallbackSel) {
    if (state.resolved && !state.viewing) state.viewing = dcr.dcrId; // a decided DCR opens as View DCR
    reviewOpener = document.activeElement;
    reviewOpenerSel = typeof fallbackSel === "string" ? fallbackSel
      : reviewOpener && reviewOpener.dataset && reviewOpener.dataset.action ? `[data-action="${reviewOpener.dataset.action}"]` : null;
    renderReview();
    review.showModal();
    $("#close-review").focus();
  }
  function closeReview() {
    if (review.open) review.close();
  }
  review.addEventListener("close", () => {
    state.viewing = null; state.histOpen = new Set(); state.rejecting = null;
    $("#review-title").textContent = "Review DCR"; $("#comment-form").hidden = false; $("#rail-closed").hidden = true;
    renderPanel(); renderInbox(); renderWorkflow();
    // Return focus to whatever opened the dialog (re-rendered buttons are found again by selector)
    const back = reviewOpener && document.contains(reviewOpener) && !reviewOpener.closest("[hidden]") ? reviewOpener
      : reviewOpenerSel ? document.querySelector(`.view:not([hidden]) ${reviewOpenerSel}`) : null;
    reviewOpener = reviewOpenerSel = null;
    if (back) back.focus();
  });


  // ---------- View DCR: history of a decided DCR ----------
  // Same overlay as Review DCR, read-only. Shows original → final values; each field expands to the
  // rounds it went through (who, when, what value) with the comments of that round in the right rail.
  const STEP = {
    proposed:    { label: "Proposed",            cls: "info" },
    rejected:    { label: "Sent back",           cls: "error" },
    updated:     { label: "Updated by reviewer", cls: "warning" },
    resubmitted: { label: "Resubmitted",         cls: "info" },
    approved:    { label: "Approved",            cls: "success" },
    returned:    { label: "Returned to requester", cls: "error" },
    notapplied:  { label: "Not applied",         cls: "error" },
    added:       { label: "Added by reviewer",   cls: "warning" },
  };
  const OUTCOME = { approved: "Approved", resubmitted: "Sent for resubmission", rejected: "Rejected" };
  // History of the DCR reviewed in this prototype, built from what the reviewer did
  function ownHistory() {
    const r = state.resolved, me = user.reviewer;
    const decided = { id: "s2", label: OUTCOME[r.kind], by: me, role: "Reviewer", at: r.at };
    const cm = state.comments.map((c) => ({ id: `o${c.id}`, stage: "s2", field: c.fieldId, by: me, at: c.at, kind: c.kind === "rejection" || c.kind === "request" ? "rejection" : "note", text: c.text }));
    const fields = state.fields.map((f) => {
      const ids = cm.filter((c) => c.field === f.id).map((c) => c.id);
      const rejected = f.status === "rejected";
      const kind = r.kind === "rejected" ? "notapplied" : rejected ? (r.kind === "resubmitted" ? "returned" : "rejected") : f.value !== f.proposed ? "updated" : "approved";
      return { id: f.id, label: f.label, change: f.change, original: f.original, final: kind === "notapplied" || rejected ? f.original : f.value,
        result: kind === "notapplied" ? "notapplied" : rejected ? "returned" : "applied", reviewerUpdated: kind === "updated",
        steps: [{ stage: "s1", kind: "proposed", value: f.proposed }, { stage: "s2", kind, value: rejected || kind === "notapplied" ? f.proposed : f.value, comments: ids }] };
    });
    const added = [
      ...state.extra.filter((x) => x.value).map((x) => ({ id: x.id, label: field(x.of).label, value: x.value, original: null })),
      ...state.newAttrs.filter(newAttrChanged).map((x) => ({ id: x.id, label: x.attr, value: x.value, original: x.current })),
    ].map((x) => ({ id: x.id, label: x.label, change: "reviewer", original: x.original, final: r.kind === "rejected" ? x.original : x.value,
      result: r.kind === "rejected" ? "notapplied" : "applied", reviewerUpdated: true, steps: [{ stage: "s2", kind: r.kind === "rejected" ? "notapplied" : "added", value: x.value }] }));
    return { dcrId: dcr.dcrId, entity: { name: dcr.entityName, initials: dcr.entityInitials, type: dcr.entityType, id: dcr.entityId },
      createdBy: dcr.createdBy, createdOn: dcr.createdOn, outcome: r.kind,
      stages: [{ id: "s1", label: "Submitted", by: dcr.createdBy, role: "Requester", at: dcr.createdOn }, decided],
      fields: [...fields, ...added], comments: cm };
  }
  function historyFor(id) {
    if (id === dcr.dcrId) return ownHistory();
    const h = window.DEMO.history[id];
    return { dcrId: id, entity: { name: profile.entityName, initials: dcr.entityInitials, type: dcr.entityType, id: profile.entityId }, ...h };
  }
  const stageOf = (h, sid) => h.stages.find((x) => x.id === sid);
  const stageNo = (h, sid) => h.stages.findIndex((x) => x.id === sid) + 1;
  function cmtBtn(ids, label) {
    if (!ids || !ids.length) return "";
    return `<button type="button" class="hist-cmt" data-action="hist-cmt" data-ids="${ids.join(",")}" aria-label="${ids.length} ${ids.length === 1 ? "comment" : "comments"} ${esc(label)}. Show in Comments">${icon("mode_comment", 16)}<span>${ids.length}</span></button>`;
  }
  function renderHistory(h) {
    // Rejected = turned down in its first review: no rounds to show, only what was asked for and why
    if (h.outcome === "rejected") return renderRejected(h);
    const decided = h.stages[h.stages.length - 1];
    const applied = h.fields.filter((f) => f.result === "applied").length;
    const byReviewer = h.fields.filter((f) => f.reviewerUpdated).length;
    const sentBack = h.fields.filter((f) => f.steps.some((x) => x.kind === "rejected" || x.kind === "returned")).length;
    $("#review-actions").innerHTML = `<span class="hist-status hist-status--${h.outcome}">${icon(h.outcome === "approved" ? "done" : h.outcome === "rejected" ? "close_24" : "send", 18)}${OUTCOME[h.outcome]}</span>`;
    const tagFor = (f) => f.result === "returned" ? `<span class="tag tag--deleted">Returned</span>`
      : f.result === "notapplied" ? `<span class="tag tag--deleted">Not applied</span>`
      : f.change === "reviewer" ? `<span class="tag tag--updated">Added by reviewer</span>`
      : f.reviewerUpdated ? `<span class="tag tag--updated">Updated</span>` : `<span class="tag tag--${f.change}">${CHANGE_LABEL[f.change]}</span>`;
    const rows = h.fields.map((f) => {
      const open = state.histOpen.has(f.id);
      const ids = f.steps.flatMap((x) => x.comments || []);
      return `
      <li class="hrow${open ? " is-open" : ""}" data-hfield="${f.id}">
        <div class="hrow__grid">
          <span class="erow__label" id="hlbl-${f.id}">${esc(f.label)}</span>
          <span class="erow__old"><span class="sr-only">Original value: </span>${esc(fmt(f.original))}</span>
          <span class="erow__arrow" aria-hidden="true">→</span>
          <span class="hrow__final"><span class="sr-only">Final value: </span>${esc(fmt(f.final))}</span>
          <span class="hrow__tag">${tagFor(f)}</span>
          <span class="hrow__cmts">${cmtBtn(ids, `on ${f.label}`)}</span>
          <button type="button" class="hist-toggle" data-action="hist-toggle" aria-expanded="${open}" aria-controls="hist-${f.id}">
            <span class="sr-only">History of ${esc(f.label)}: </span><span>${f.steps.length} ${f.steps.length === 1 ? "step" : "steps"}</span>${icon(open ? "arrow_up_20" : "expand_more_20", 20)}</button>
        </div>
        <ol class="hist" id="hist-${f.id}" aria-label="${esc(f.label)} history" ${open ? "" : "hidden"}>
          ${f.steps.map((x, si) => { const st = stageOf(h, x.stage), k = STEP[x.kind];
            const prev = si > 0 ? f.steps[si - 1].value : null;
            const val = prev != null && prev !== x.value
              ? `<span class="hist__prev"><span class="sr-only">changed from </span>${esc(fmt(prev))}</span><span class="hist__arrow" aria-hidden="true">→</span><span class="sr-only"> to </span>${esc(fmt(x.value))}`
              : esc(fmt(x.value));
            return `<li class="hist__step hist__step--${k.cls}" id="hstep-${f.id}-${x.stage}">
              <span class="hist__dot" aria-hidden="true"></span>
              <div class="hist__body">
                <p class="hist__head"><span class="hist__round">Round ${stageNo(h, x.stage)}</span><span class="hist__action">${k.label}</span><span class="hist__who">${esc(st.by)} · ${st.role}</span><span class="hist__when">${esc(st.at)}</span></p>
                <p class="hist__value"><span class="sr-only">Value: </span>${val}</p>
              </div>
              ${cmtBtn(x.comments, `in round ${stageNo(h, x.stage)} on ${f.label}`)}
            </li>`; }).join("")}
        </ol>
      </li>`; }).join("");
    $("#review-main").innerHTML = `
      <div class="org">
        <span class="avatar avatar--entity" aria-hidden="true">${esc(h.entity.initials)}</span>
        <span class="org__name">${esc(h.entity.name)}</span>
        <span class="type-badge">${esc(h.entity.type)}</span>
        <span class="org__id">Entity ID: ${esc(h.entity.id)}</span>
        <button type="button" class="icon-btn org__toggle" data-action="toggle-org" aria-expanded="${state.orgOpen}" aria-controls="req-summary" aria-label="${state.orgOpen ? "Hide" : "Show"} request summary">${icon("keyboard_arrow_up", 24)}</button>
      </div>
      <div class="req-summary" id="req-summary" ${state.orgOpen ? "" : "hidden"}>
        <p class="req-summary__id"><strong>DCR ID: ${esc(h.dcrId)}</strong><span>Created by ${esc(h.createdBy)}  ·  ${esc(h.createdOn)}  ·  ${OUTCOME[h.outcome]} by ${esc(decided.by)} on ${esc(decided.at)}</span></p>
        <p class="tally tally--added"><span class="tally__n">${applied}</span><span class="tally__l">Applied</span></p>
        <p class="tally tally--updated"><span class="tally__n">${byReviewer}</span><span class="tally__l">By reviewer</span></p>
        <p class="tally tally--deleted"><span class="tally__n">${sentBack}</span><span class="tally__l">Sent back</span></p>
        <p class="tally tally--rejected"><span class="tally__n">${h.comments.length}</span><span class="tally__l">Comments</span></p>
      </div>
      <h3 class="sc__title">Rounds</h3>
      <ol class="hstages" aria-label="Rounds of this DCR">
        ${h.stages.map((st, i) => { const ids = h.comments.filter((c) => c.stage === st.id).map((c) => c.id);
          return `<li class="hstage hstage--${/approved/i.test(st.label) ? "success" : /back|reject|resubmission/i.test(st.label) && st.role === "Reviewer" ? "error" : "info"}">
            <span class="hstage__n" aria-hidden="true">${i + 1}</span>
            <div class="hstage__body"><p class="hstage__label"><span class="sr-only">Round ${i + 1}: </span>${esc(st.label)}</p><p class="hstage__meta">${esc(st.by)}</p><p class="hstage__meta">${st.role} · ${esc(st.at)}</p>
              ${cmtBtn(ids, `in round ${i + 1}`)}</div>
          </li>`; }).join("")}
      </ol>
      <div class="hist-head">
        <h3 class="sc__title">Final changes</h3>
        <button type="button" class="link-btn" data-action="hist-all" aria-controls="hist-rows">${state.histOpen.size === h.fields.length ? "Collapse all" : "Expand all"}</button>
      </div>
      <div class="ai-summary hist-cols" aria-hidden="true"><span>Attribute</span><span>Original</span><span></span><span>Final value</span><span>Change</span><span>Comments</span><span>History</span></div>
      <ul class="edit-rows hist-rows" id="hist-rows" aria-label="Final changes">${rows}</ul>`;
    // Comments rail: every round's comments, linked back to the field and round
    $("#rail-title").textContent = `Comments (${h.comments.length})`;
    $("#rail-list").innerHTML = h.comments.map((c) => {
      const f = c.field && h.fields.find((x) => x.id === c.field), n = stageNo(h, c.stage), st = stageOf(h, c.stage);
      const cls = c.kind === "rejection" ? " cmt--rejection" : c.kind === "approval" ? " cmt--approval" : "";
      return `
        <li class="cmt${cls}" id="cmt-${c.id}" tabindex="-1" data-stage="${c.stage}">
          <span class="cmt__avatar"><span>${icon("person", 14)}</span></span>
          <div class="cmt__body">
            <p class="cmt__who">${esc(c.by)} <span class="cmt__role">${st.role}</span></p>
            <p class="cmt__when">${esc(c.at)}</p>
            ${f ? `<button type="button" class="cmt__field cmt__field--hist" data-action="hist-goto" data-field="${f.id}" data-stage="${c.stage}">Round ${n} · ${esc(f.label)}</button>`
                : `<p class="cmt__field cmt__field--hist">Round ${n} · ${esc(st.label)}</p>`}
            <p class="cmt__text">${esc(c.text)}</p>
          </div>
        </li>`;
    }).join("");
  }
  function renderRejected(h) {
    const decided = h.stages[h.stages.length - 1];
    $("#review-actions").innerHTML = `<span class="hist-status hist-status--rejected">${icon("close_24", 18)}Rejected</span>`;
    const rows = h.fields.map((f) => {
      const ids = f.steps.flatMap((x) => x.comments || []);
      const requested = f.steps[0].value;
      return `
      <li class="hrow" data-hfield="${f.id}">
        <div class="hrow__grid hrow__grid--simple">
          <span class="erow__label">${esc(f.label)}</span>
          <span class="erow__old"><span class="sr-only">Original value: </span>${esc(fmt(f.original))}</span>
          <span class="erow__arrow" aria-hidden="true">→</span>
          <span class="hrow__final hrow__final--rejected"><span class="sr-only">Requested value, not applied: </span>${esc(fmt(requested))}</span>
          <span class="hrow__tag"><span class="tag tag--deleted">Not applied</span></span>
          <span class="hrow__cmts">${cmtBtn(ids, `on ${f.label}`)}</span>
        </div>
      </li>`; }).join("");
    $("#review-main").innerHTML = `
      <div class="org">
        <span class="avatar avatar--entity" aria-hidden="true">${esc(h.entity.initials)}</span>
        <span class="org__name">${esc(h.entity.name)}</span>
        <span class="type-badge">${esc(h.entity.type)}</span>
        <span class="org__id">Entity ID: ${esc(h.entity.id)}</span>
        <button type="button" class="icon-btn org__toggle" data-action="toggle-org" aria-expanded="${state.orgOpen}" aria-controls="req-summary" aria-label="${state.orgOpen ? "Hide" : "Show"} request summary">${icon("keyboard_arrow_up", 24)}</button>
      </div>
      <div class="req-summary" id="req-summary" ${state.orgOpen ? "" : "hidden"}>
        <p class="req-summary__id"><strong>DCR ID: ${esc(h.dcrId)}</strong><span>Created by ${esc(h.createdBy)}  ·  ${esc(h.createdOn)}  ·  Rejected by ${esc(decided.by)} on ${esc(decided.at)}</span></p>
        <p class="tally tally--edited"><span class="tally__n">${h.fields.length}</span><span class="tally__l">Requested</span></p>
        <p class="tally tally--deleted"><span class="tally__n">${h.fields.length}</span><span class="tally__l">Not applied</span></p>
        <p class="tally tally--rejected"><span class="tally__n">${h.comments.length}</span><span class="tally__l">Comments</span></p>
      </div>
      <h3 class="sc__title">Requested changes</h3>
      <div class="ai-summary hist-cols hist-cols--simple" aria-hidden="true"><span>Attribute</span><span>Original</span><span></span><span>Requested value</span><span>Change</span><span>Comments</span></div>
      <ul class="edit-rows hist-rows" id="hist-rows" aria-label="Requested changes, none applied">${rows}</ul>
      <p class="hist-note">${icon("error_outline", 16)}<span>Nothing in this request was applied. The profile keeps the original values.</span></p>`;
    $("#rail-title").textContent = `Comments (${h.comments.length})`;
    $("#rail-list").innerHTML = h.comments.map((c) => {
      const st = stageOf(h, c.stage), f = c.field && h.fields.find((x) => x.id === c.field);
      return `
        <li class="cmt cmt--rejection" id="cmt-${c.id}" tabindex="-1">
          <span class="cmt__avatar"><span>${icon("person", 14)}</span></span>
          <div class="cmt__body">
            <p class="cmt__who">${esc(c.by)} <span class="cmt__role">${st.role}</span></p>
            <p class="cmt__when">${esc(c.at)}</p>
            <p class="cmt__field">${f ? `Rejected · ${esc(f.label)}` : "Rejected the request"}</p>
            <p class="cmt__text">${esc(c.text)}</p>
          </div>
        </li>`;
    }).join("");
  }
  function showComments(ids) {
    const els = ids.map((id) => $(`#cmt-${id}`)).filter(Boolean);
    $("#rail-list").querySelectorAll(".cmt.is-current").forEach((x) => x.classList.remove("is-current"));
    els.forEach((el) => { el.classList.add("is-current"); flash(el); });
    if (els[0]) { scrollWithin($("#rail-list"), els[0]); els[0].focus({ preventScroll: true }); }
    announce(`${els.length} ${els.length === 1 ? "comment" : "comments"} highlighted in Comments.`);
  }

  // ---------- Mandatory comment dialog ----------
  const cdlg = $("#comment-dialog");
  const cinput = $("#comment-dlg-input");
  function askComment(pending, context) {
    state.pending = pending;
    cinput.value = "";
    $("#comment-dlg-done").disabled = true;
    $("#comment-dlg-context").textContent = context;
    cdlg.showModal();
    cinput.focus();
  }
  cinput.addEventListener("input", () => { $("#comment-dlg-done").disabled = !cinput.value.trim(); });
  $("#comment-dlg-cancel").addEventListener("click", () => cdlg.close("cancel"));
  $("#comment-dlg-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = cinput.value.trim();
    if (!text) return;
    cdlg.close("done");
    applyComment(text);
  });
  cdlg.addEventListener("close", () => {
    if (cdlg.returnValue !== "done") {
      const p = state.pending; state.pending = null;
      if (p && p.kind === "field") review.querySelector(`.erow[data-id="${p.id}"] [data-action="reject-field"]`)?.focus();
    }
    cdlg.returnValue = "";
  });

  function applyComment(text) {
    const p = state.pending; state.pending = null;
    if (!p) return;
    if (p.kind === "field") {
      const f = field(p.id);
      f.status = "rejected";
      state.comments.push({ id: ++state.seq, fieldId: f.id, kind: "rejection", text, at: now() });
      renderReview();
      const row = review.querySelector(`.erow[data-id="${f.id}"]`);
      const card = $(`#cmt-${state.seq}`);
      scrollWithin($("#rail-list"), card); flash(row); flash(card);
      row.querySelector('[data-action="unreject"]')?.focus({ preventScroll: true });
      announce(`${f.label} rejected. Your comment is in the Comments panel. ${tally().rejected} rejected.${tally().rejected === 1 ? " Approve is now Resubmit, and Reject is unavailable." : ""}`);
    } else {
      state.comments.push({ id: ++state.seq, fieldId: null, kind: "request", text, at: now() });
      resolve("rejected");
    }
  }

  // ---------- Confirm undo rejection ----------
  // Removing a rejection also deletes its comment, so the reviewer confirms first.
  const udlg = $("#unreject-dialog");
  let unrejectId = null;
  document.querySelectorAll(".confirm-dlg__icon").forEach((el) => (el.innerHTML = icon("error_outline", 24)));

  // ---------- Generic confirm (P6 Discard, I4 Delete) ----------
  const xdlg = $("#confirm-dialog");
  let xResolve = null, xReturn = null;
  function confirmDialog({ title, text, ok, cancel }) {
    $("#confirm-title").textContent = title;
    $("#confirm-desc").textContent = text;
    $("#confirm-ok").textContent = ok;
    $("#confirm-cancel").textContent = cancel;
    xReturn = document.activeElement;
    xdlg.returnValue = "";
    xdlg.showModal();
    $("#confirm-cancel").focus(); // safe default
    return new Promise((resolve) => { xResolve = resolve; });
  }
  $("#confirm-cancel").addEventListener("click", () => xdlg.close("cancel"));
  $("#confirm-form").addEventListener("submit", (e) => { e.preventDefault(); xdlg.close("ok"); });
  xdlg.addEventListener("close", () => {
    const ok = xdlg.returnValue === "ok", done = xResolve, back = xReturn;
    xResolve = xReturn = null;
    if (!ok && back && document.contains(back)) back.focus();
    if (done) done(ok);
  });
  function askUnreject(id) {
    const f = field(id);
    const cs = state.comments.filter((c) => c.fieldId === id && c.kind === "rejection");
    unrejectId = id;
    $("#unreject-title").textContent = `Remove rejection of ${f.label}?`;
    $("#unreject-desc").textContent = cs.length
      ? `${f.label} has a rejection comment. Removing the rejection also deletes ${cs.length === 1 ? "this comment" : `these ${cs.length} comments`} from the Comments panel.`
      : `${f.label} will go back to pending.`;
    $("#unreject-quote").innerHTML = cs.map((c) => `<p>${esc(c.text)}</p>`).join("");
    $(".confirm-dlg__quote").hidden = !cs.length;
    $("#unreject-quote-label").textContent = cs.length === 1 ? "Comment that will be deleted" : "Comments that will be deleted";
    udlg.returnValue = "";
    udlg.showModal();
    $("#unreject-cancel").focus(); // safe default: Enter / Esc keep the rejection
    linkRow(id, true);
  }
  $("#unreject-cancel").addEventListener("click", () => udlg.close("cancel"));
  $("#unreject-form").addEventListener("submit", (e) => { e.preventDefault(); udlg.close("confirm"); });
  udlg.addEventListener("close", () => {
    const id = unrejectId; unrejectId = null;
    if (!id) return;
    linkRow(id, false);
    const f = field(id);
    if (udlg.returnValue !== "confirm") {
      review.querySelector(`.erow[data-id="${id}"] [data-action="unreject"]`)?.focus();
      return;
    }
    const before = state.comments.length;
    f.status = "pending";
    state.comments = state.comments.filter((c) => !(c.fieldId === id && c.kind === "rejection"));
    const removed = before - state.comments.length;
    renderReview();
    review.querySelector(`.erow[data-id="${id}"] [data-action="reject-field"]`)?.focus();
    announce(`${f.label} rejection removed${removed ? ` and ${removed === 1 ? "its comment was" : `${removed} comments were`} deleted` : ""}. ${tally().rejected} rejected.${tally().rejected ? "" : " Reject and Approve are available again."}`);
  });

  // ---------- Resolve ----------
  function resolve(kind) {
    const t = tally();
    const added = state.extra.filter((x) => x.value).length + state.newAttrs.filter(newAttrChanged).length; // the reviewer's own additions
    state.resolved = { kind, applied: state.fields.length - t.rejected + added, rejected: t.rejected, at: now() };
    reviewOpener = reviewOpenerSel = null; // focus goes to the snack bar, not back to the opener
    state.dcrInInbox = false;
    state.selected.delete(0);
    closeReview();
    closePanel({ focus: false });
    renderInbox();
    renderWorkflow();
    $("#wf-list").scrollTop = 0; // the decided card (now shorter) stays in view
    showToast();
  }
  const toast = $("#toast");
  function showToast() {
    const r = state.resolved;
    const ch = (n) => `${n} ${n === 1 ? "change" : "changes"}`;
    const f = (n) => `${n} ${n === 1 ? "field" : "fields"}`;
    $("#toast-title").textContent = { approved: "DCR approved", resubmitted: "DCR sent for resubmission", rejected: "DCR rejected" }[r.kind];
    $("#toast-text").textContent = r.kind === "approved"
      ? `${dcr.entityName} · ${ch(r.applied)} applied`
      : r.kind === "resubmitted"
        ? `${dcr.entityName} · ${f(r.rejected)} returned to ${dcr.createdBy} with your comments, ${ch(r.applied)} applied`
        : `${dcr.entityName} · returned to ${dcr.createdBy} with your comment`;
    toast.className = `toast toast--${r.kind}`;
    $("#toast-view").hidden = false;
    toast.hidden = false;
    announce(`${$("#toast-title").textContent}. ${$("#toast-text").textContent}`);
    $("#toast-view").focus();
  }

  // ---------- Comment ⇄ row linking ----------
  function scrollWithin(box, el) {
    if (!box || !el) return;
    const b = box.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (r.top < b.top) box.scrollTop -= b.top - r.top + 8;
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
  }
  function flash(el) {
    if (!el) return;
    el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash");
    setTimeout(() => el.classList.remove("is-flash"), 1600);
  }
  function linkRow(fid, on) {
    review.querySelectorAll(`.erow[data-id="${fid}"], .cmt[data-field="${fid}"]`).forEach((el) => el.classList.toggle("is-linked", on));
  }
  review.addEventListener("mouseover", (e) => {
    const card = e.target.closest(".cmt[data-field]"); if (card) linkRow(card.dataset.field, true);
    const pin = e.target.closest(".comment-pin"); if (pin) linkRow(pin.closest("[data-id]").dataset.id, true);
  });
  review.addEventListener("mouseout", (e) => {
    const card = e.target.closest(".cmt[data-field]"); if (card && !card.contains(e.relatedTarget)) linkRow(card.dataset.field, false);
    const pin = e.target.closest(".comment-pin"); if (pin && !pin.contains(e.relatedTarget)) linkRow(pin.closest("[data-id]").dataset.id, false);
  });
  review.addEventListener("focusin", (e) => { const c = e.target.closest(".cmt[data-field]"); if (c) linkRow(c.dataset.field, true); });
  review.addEventListener("focusout", (e) => { const c = e.target.closest(".cmt[data-field]"); if (c && !c.contains(e.relatedTarget)) linkRow(c.dataset.field, false); });

  // ---------- Dropdown (DS Field + DS Menu), select-only combobox ----------
  let dd = null; // { id, trigger, menu, opts, active }
  const CHEV = (up) => icon(up ? "arrow_drop_up" : "arrow_drop_down", 20);
  function ddOpen(trigger) {
    ddClose();
    const id = trigger.closest("[data-id]").dataset.id;
    const menu = $(`#lb-${id}`);
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    trigger.querySelector(".dd__chev").innerHTML = CHEV(true);
    const opts = [...menu.querySelectorAll("[role=option]")];
    dd = { id, trigger, menu, opts, active: -1 };
    const sel = opts.findIndex((o) => o.getAttribute("aria-selected") === "true");
    ddActive(sel >= 0 ? sel : Math.max(0, opts.findIndex((o) => o.getAttribute("aria-disabled") !== "true")));
    if ($("#wf-panel").contains(trigger)) scrollWithin($("#wf-list"), menu); // keep the whole menu in view inside the panel
  }
  function ddActive(i) {
    if (!dd) return;
    i = Math.max(0, Math.min(dd.opts.length - 1, i));
    dd.opts.forEach((o, j) => o.classList.toggle("is-active", j === i));
    dd.active = i;
    dd.trigger.setAttribute("aria-activedescendant", dd.opts[i].id);
    // keep the active option visible inside the menu only (never scroll the page)
    const o = dd.opts[i], m = dd.menu;
    if (o.offsetTop < m.scrollTop) m.scrollTop = o.offsetTop;
    else if (o.offsetTop + o.offsetHeight > m.scrollTop + m.clientHeight) m.scrollTop = o.offsetTop + o.offsetHeight - m.clientHeight;
  }
  function ddClose(focus) {
    if (!dd) return;
    const t = dd.trigger;
    dd.menu.hidden = true;
    t.setAttribute("aria-expanded", "false");
    t.removeAttribute("aria-activedescendant");
    t.querySelector(".dd__chev").innerHTML = CHEV(false);
    dd = null;
    if (focus) t.focus();
  }
  function ddPick(i) {
    const { id, opts } = dd;
    if (opts[i].getAttribute("aria-disabled") === "true") {
      announce(id === "mode" ? `${opts[i].dataset.label} isn't part of this prototype.`
        : id.startsWith("wff-") ? `There are no ${opts[i].dataset.label} workflows on this profile yet.`
        : id.startsWith("sg-") ? `${opts[i].dataset.value} is already a value of this attribute.`
        : `${opts[i].dataset.value} is already in this request.`);
      return;
    }
    const v = opts[i].dataset.value;
    ddClose();
    if (id === "mode") { requestMode(v); return; }
    if (id.startsWith("sg-")) {
      const r = sgRow(id.slice(3));
      if (r && v !== r.value) { r.value = v; renderGrid(); announce(`${r.label} set to ${v}.`); }
      $(`#val-${id}`).focus();
      return;
    }
    if (id === "__addattr") { addAttribute(v); return; }
    if (id.startsWith("wff-")) {
      state.wfDraft[id.slice(4)] = v; renderFilterForm();
      $(`#val-${id}`).focus();
      return;
    }
    if (id === "wf-priority" || id === "wf-assignee") {
      const k = id === "wf-priority" ? "priority" : "assignedTo";
      if (v !== state.wfForm[k]) { state.wfForm[k] = v; renderWorkflow(); announce(k === "priority" ? `Priority set to ${v}.` : `Assigned to ${v}.`); }
      $(`#val-${id}`).focus();
      return;
    }
    const it = item(id), target = it.isExtra ? it.ref : it;
    if (v !== target.value) { target.value = v; renderReview(); announce(`${it.label} set to ${v}.`); }
    $(`#val-${id}`).focus();
  }
  const ddRoots = [review, $("#wf-panel"), $("#profile-main")];
  // Clicking a menu item must not take focus away from its combobox (keeps Esc / arrows working)
  document.addEventListener("mousedown", (e) => { if (e.target.closest(".dd__item")) e.preventDefault(); });
  document.addEventListener("click", (e) => { if (dd && !dd.trigger.contains(e.target) && !dd.menu.contains(e.target)) ddClose(); });
  ddRoots.forEach((root) => root.addEventListener("click", (e) => {
    const trig = e.target.closest(".dd__trigger");
    const item = e.target.closest(".dd__item");
    if (item && dd) { ddPick(dd.opts.indexOf(item)); return; }
    if (trig) { dd && dd.trigger === trig ? ddClose(true) : ddOpen(trig); return; }
    if (dd && !e.target.closest(".dd__menu")) ddClose();
  }));
  ddRoots.forEach((root) => root.addEventListener("mousemove", (e) => {
    const item = e.target.closest(".dd__item");
    if (item && dd) { dd.menu.classList.remove("is-kbd"); if (dd.opts.indexOf(item) !== dd.active) ddActive(dd.opts.indexOf(item)); }
  }));
  ddRoots.forEach((root) => root.addEventListener("keydown", (e) => {
    const trig = e.target.closest(".dd__trigger");
    if (!trig) return;
    const open = dd && dd.trigger === trig;
    const k = e.key;
    if (open) dd.menu.classList.add("is-kbd");
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(k)) { e.preventDefault(); ddOpen(trig); dd.menu.classList.add("is-kbd"); }
      return;
    }
    if (k === "ArrowDown") { e.preventDefault(); ddActive(dd.active + 1); }
    else if (k === "ArrowUp") { e.preventDefault(); ddActive(dd.active - 1); }
    else if (k === "Home" || k === "PageUp") { e.preventDefault(); ddActive(0); }
    else if (k === "End" || k === "PageDown") { e.preventDefault(); ddActive(dd.opts.length - 1); }
    else if (k === "Enter" || k === " ") { e.preventDefault(); ddPick(dd.active); }
    else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); ddClose(true); } // close the menu, not the dialog
    else if (k === "Tab") ddClose();
    else if (k.length === 1 && /\S/.test(k)) {
      const start = dd.active + 1, n = dd.opts.length;
      for (let j = 0; j < n; j++) { const o = dd.opts[(start + j) % n]; if (o.textContent.trim().toLowerCase().startsWith(k.toLowerCase())) { ddActive((start + j) % n); break; } }
    }
  }));



  // ---------- Date picker (Workflow "Due date") ----------
  // Build DS has no date picker, so it is composed from DS parts: Field (trigger), Menu surface
  // (popover), icon buttons (month nav) and Menu item states (days). Keyboard follows the
  // WAI-ARIA date picker dialog pattern: arrows move by day/week, PageUp/PageDown by month
  // (Shift = year), Home/End to the week's start/end, Enter/Space picks, Esc closes.
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = [["Mo", "Monday"], ["Tu", "Tuesday"], ["We", "Wednesday"], ["Th", "Thursday"], ["Fr", "Friday"], ["Sa", "Saturday"], ["Su", "Sunday"]];
  const parseDMY = (t) => { const [d, m, y] = t.split("/").map(Number); return new Date(y, m - 1, d); };
  const fmtDMY = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const sameDay = (a, b) => a && b && iso(a) === iso(b);
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const addMonths = (d, n) => { const t = new Date(d.getFullYear(), d.getMonth() + n, 1); const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return new Date(t.getFullYear(), t.getMonth(), Math.min(d.getDate(), last)); };
  const longDate = (d) => `${DOW[(d.getDay() + 6) % 7][1]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  let dp = null; // { pop, trigger, focus: Date }
  const wfEl = $("#wf-panel");
  function dpRender() {
    const sel = dp.sel || parseDMY(state.wfForm.dueDate), today = new Date(), f = dp.focus;
    const first = new Date(f.getFullYear(), f.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    let rows = "";
    for (let w = 0; w < 6; w++) {
      rows += "<tr>";
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, w * 7 + i), out = d.getMonth() !== f.getMonth();
        rows += `<td role="gridcell" class="dp__day${out ? " is-out" : ""}${sameDay(d, today) ? " is-today" : ""}" data-date="${iso(d)}"
          tabindex="${sameDay(d, f) ? 0 : -1}" aria-selected="${sameDay(d, sel)}" ${sameDay(d, today) ? 'aria-current="date"' : ""} aria-label="${longDate(d)}">${d.getDate()}</td>`;
      }
      rows += "</tr>";
    }
    dp.pop.innerHTML = `
      <div class="dp__head">
        <button type="button" class="icon-btn" data-dp="prev" aria-label="Previous month">${icon("keyboard_arrow_left", 20)}</button>
        <h4 class="dp__title" id="dp-title" aria-live="polite">${MONTHS[f.getMonth()]} ${f.getFullYear()}</h4>
        <button type="button" class="icon-btn" data-dp="next" aria-label="Next month">${icon("keyboard_arrow_right", 20)}</button>
      </div>
      <table class="dp__grid" role="grid" aria-labelledby="dp-title">
        <thead><tr>${DOW.map(([a, l]) => `<th scope="col" abbr="${l}">${a}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="dp__hint">Selected: ${longDate(sel)}</p>`;
  }
  function dpOpen(trigger) {
    ddClose();
    const pop = $("#dp-wf-due");
    const typed = parseTyped($("#val-wf-due").value);
    dp = { pop, trigger, focus: typed || parseDMY(state.wfForm.dueDate), sel: typed };
    dpRender();
    pop.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    scrollWithin($("#wf-list"), pop);
    pop.querySelector('.dp__day[tabindex="0"]').focus({ preventScroll: true });
  }
  function dpClose(focus) {
    if (!dp) return;
    const t = dp.trigger;
    dp.pop.hidden = true; dp.pop.innerHTML = "";
    t.setAttribute("aria-expanded", "false");
    dp = null;
    if (focus) t.focus();
  }
  function dpMove(d) {
    dp.focus = d; dpRender();
    dp.pop.querySelector('.dp__day[tabindex="0"]').focus();
  }
  function dpPick(d) {
    const v = fmtDMY(d);
    dpClose();
    state.dueMsg = d < TODAY ? { level: "warning", text: "This date is in the past." } : null;
    if (v !== state.wfForm.dueDate) state.wfForm.dueDate = v;
    renderWorkflow(); announce(`Due date set to ${longDate(d)}.${state.dueMsg ? " This date is in the past." : ""}`);
    $("#val-wf-due").focus();
  }
  wfEl.addEventListener("click", (e) => {
    const trig = e.target.closest(".dp__trigger");
    if (trig) { dp ? dpClose(true) : dpOpen(trig); return; }
    if (!dp) return;
    const nav = e.target.closest("[data-dp]");
    if (nav) { e.stopPropagation(); /* the re-render detaches the button; don't let "click outside" close the picker */ dp.focus = addMonths(dp.focus, nav.dataset.dp === "next" ? 1 : -1); dpRender(); dp.pop.querySelector(`[data-dp="${nav.dataset.dp}"]`).focus(); return; }
    const day = e.target.closest(".dp__day");
    if (day) dpPick(new Date(day.dataset.date + "T00:00"));
  });
  wfEl.addEventListener("keydown", (e) => {
    if (!dp) return;
    if (e.key === "Escape") { // first Esc only closes the calendar (from the typed field too)
      e.preventDefault(); e.stopImmediatePropagation();
      dpClose(!e.target.matches(".dp__input")); return;
    }
    if (!e.target.closest(".dp__day")) return;
    const f = dp.focus;
    const moves = {
      ArrowRight: () => addDays(f, 1), ArrowLeft: () => addDays(f, -1), ArrowDown: () => addDays(f, 7), ArrowUp: () => addDays(f, -7),
      PageDown: () => addMonths(f, e.shiftKey ? 12 : 1), PageUp: () => addMonths(f, e.shiftKey ? -12 : -1),
      Home: () => addDays(f, -((f.getDay() + 6) % 7)), End: () => addDays(f, 6 - ((f.getDay() + 6) % 7)),
    };
    if (moves[e.key]) { e.preventDefault(); dpMove(moves[e.key]()); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); dpPick(f); }
  });
  // Close when focus or a click leaves the date picker
  document.addEventListener("click", (e) => { if (dp && !dp.pop.contains(e.target) && !dp.trigger.contains(e.target) && !e.target.closest(".dp__input")) dpClose(); });
  wfEl.addEventListener("focusout", (e) => { if (dp && e.relatedTarget && !dp.pop.contains(e.relatedTarget) && e.relatedTarget !== dp.trigger && !e.relatedTarget.matches(".dp__input")) dpClose(); });

  /* P9 (interaction spec, option c): the due date can be typed as well as picked.
     Field and calendar stay in sync: the calendar highlight only moves on a complete, real date (so it doesn't
     jump on "1" or "12/0"); a date in another month turns the calendar to that month. The typed date saves on
     Enter or when focus leaves the field. A date that doesn't exist is an error; a past date is a warning. */
  function parseTyped(t) {
    const m = String(t || "").trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!m) return null;
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? d : null;
  }
  function dueMsgHTML() {
    const r = state.dueMsg;
    return `<p class="erow__msg dp__msg erow__msg--${r ? r.level : "none"}" id="msg-wf-due" ${r ? "" : "hidden"}>${r ? `${icon("error_outline", 16)}<span><span class="sr-only">${r.level === "error" ? "Error: " : "Note: "}</span>${esc(r.text)}</span>` : ""}</p>`;
  }
  function showDueMsg() {
    const old = $("#msg-wf-due"); if (old) old.outerHTML = dueMsgHTML();
    const inp = $("#val-wf-due");
    if (inp) state.dueMsg && state.dueMsg.level === "error" ? inp.setAttribute("aria-invalid", "true") : inp.removeAttribute("aria-invalid");
  }
  function commitDue(inp) {
    const raw = inp.value.trim(), d = parseTyped(raw);
    if (!d) {
      state.dueMsg = { level: "error", text: raw ? "Enter a real date as DD/MM/YYYY, e.g. 05/02/2026." : "Enter a due date as DD/MM/YYYY." };
      showDueMsg();
      return;
    }
    const v = fmtDMY(d);
    inp.value = v;
    state.dueMsg = d < TODAY ? { level: "warning", text: "This date is in the past." } : null;
    showDueMsg();
    if (v !== state.wfForm.dueDate) {
      state.wfForm.dueDate = v;
      const flag = $("#req-due-text"); if (flag) flag.innerHTML = `<span class="sr-only">Due </span>${esc(v)}`;
      announce(`Due date set to ${longDate(d)}.${state.dueMsg ? " This date is in the past." : ""}`);
    }
    if (dp) { dp.sel = null; dp.focus = d; dpRender(); }
  }
  wfEl.addEventListener("input", (e) => {
    if (!e.target.matches(".dp__input")) return;
    const d = parseTyped(e.target.value);
    if (d && state.dueMsg && state.dueMsg.level === "error") { state.dueMsg = null; showDueMsg(); } // clears as soon as it's valid
    if (d && dp) { dp.sel = d; dp.focus = d; dpRender(); } // sync only on a complete, real date
  });
  wfEl.addEventListener("change", (e) => { if (e.target.matches(".dp__input")) commitDue(e.target); });
  wfEl.addEventListener("keydown", (e) => {
    if (!e.target.matches(".dp__input")) return;
    if (e.key === "Enter") { e.preventDefault(); commitDue(e.target); }
    else if (e.key === "Escape" && !dp && (e.target.value !== state.wfForm.dueDate || state.dueMsg)) { // back to the saved date (a second Esc closes the panel)
      e.preventDefault(); e.stopPropagation();
      e.target.value = state.wfForm.dueDate;
      state.dueMsg = null; showDueMsg();
    }
  });


  // ---------- Inbox panel: Additional details (profile context) ----------
  // Same data as the profile page, so the reviewer doesn't have to leave the Inbox.
  const CARDS = profile.columns.flat();
  const cardBy = (t) => CARDS.find((c) => c.title === t);
  function renderDetails() {
    const groups = CARDS.filter((c) => c.attrs).map((c) => ({ title: c.title, attrs: withVals(c).filter(([l]) => !profile.inDcr[l]) })).filter((g) => g.attrs.length);
    const nAttrs = groups.reduce((n, g) => n + g.attrs.length, 0);
    const dnb = cardBy("D&B Hierarchy"), seg = cardBy("Segments").table;
    const sec = (id, title, count, body) => {
      const open = !state.pdClosed.has(id);
      return `<section class="pd" aria-labelledby="pd-${id}-h">
        <h3 class="pd__h" id="pd-${id}-h"><button type="button" class="pd__toggle" data-pd="${id}" aria-expanded="${open}" aria-controls="pd-${id}">
          <span>${title}</span>${count != null ? `<span class="pd__n">${count}</span>` : ""}${icon("arrow_drop_down", 20)}</button></h3>
        <div class="pd__body" id="pd-${id}" ${open ? "" : "hidden"}>${body}</div></section>`;
    };
    const attrsHTML = `<p class="pd__note">On the profile and not changed by this DCR.</p>` + groups.map((g) => `
      <h4 class="pd__group">${esc(g.title)}</h4>
      <dl class="pd__attrs">${g.attrs.map(([l, cnt, vals]) => `<div class="pd__attr"><dt>${esc(l)}${cnt ? ` <span class="counter"><span aria-hidden="true">+${cnt}</span><span class="sr-only">${cnt} more</span></span>` : ""}</dt>
        ${vals.length ? vals.map((v) => `<dd>${esc(v)}</dd>`).join("") : `<dd class="pd__empty">No value</dd>`}</div>`).join("")}</dl>`).join("");
    const relHTML = `
      <h4 class="pd__group">D&amp;B Hierarchy</h4>
      <ul class="tree pd__tree">${dnb.tree.map(([name, cnt, kids]) => `<li><span class="tree__node"><span class="tree__icon" aria-hidden="true"></span>${esc(name)}<span class="pd__tag">This profile</span></span>
        <ul>${kids.map((k) => `<li><span class="tree__node"><span class="tree__icon" aria-hidden="true"></span>${esc(k)}<span class="pd__tag">Child</span></span></li>`).join("")}</ul></li>`).join("")}</ul>
      <h4 class="pd__group">Associated organizations</h4><p class="pd__empty">${esc(cardBy("Associated Organization Details").empty)}</p>
      <h4 class="pd__group">Organisation hierarchy</h4><p class="pd__empty">No hierarchy for the current effective date</p>`;
    const segHTML = `<table class="ptable pd__table"><thead><tr>${seg.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${seg.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const dqHTML = `<dl class="pd__attrs">
      <div class="pd__attr"><dt>Potential matches</dt><dd>${esc(cardBy("Potential Matches").empty)}</dd></div>
      <div class="pd__attr"><dt>Data validation warnings</dt><dd>${esc(cardBy("Data Validation Warnings").empty)}</dd></div></dl>`;
    $("#ptab-details").innerHTML = `
      ${sec("attrs", "Other attributes", nAttrs, attrsHTML)}
      ${sec("rel", "Relationships &amp; hierarchy", 1, relHTML)}
      ${sec("seg", "Segments", seg.rows.length, segHTML)}
      ${sec("dq", "Data quality", null, dqHTML)}
      <p class="pd__foot"><a href="#profile" class="link-btn" id="pd-open-profile">${icon("open_in_new", 16)}Open full profile</a></p>`;
  }
  function setPanelTab(tab, focus) {
    state.panelTab = tab;
    const info = tab === "info";
    $("#ptab-info").hidden = !info; $("#ptab-details").hidden = info;
    [["ptab-info-tab", info], ["ptab-details-tab", !info]].forEach(([id, on]) => {
      const t = $(`#${id}`); t.setAttribute("aria-selected", String(on)); t.tabIndex = on ? 0 : -1; t.classList.toggle("is-active", on);
    });
    if (!info) renderDetails();
    if (focus) $(info ? "#ptab-info-tab" : "#ptab-details-tab").focus();
  }
  $("#panel-tabs").addEventListener("click", (e) => { const t = e.target.closest("[role=tab]"); if (t) setPanelTab(t.id === "ptab-info-tab" ? "info" : "details"); });
  $("#panel-tabs").addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === "Home" ? "info" : e.key === "End" ? "details" : state.panelTab === "info" ? "details" : "info";
    setPanelTab(next, true);
  });
  $("#ptab-details").addEventListener("click", (e) => {
    const t = e.target.closest("[data-pd]");
    if (t) { const id = t.dataset.pd; state.pdClosed.has(id) ? state.pdClosed.delete(id) : state.pdClosed.add(id); renderDetails(); $(`[data-pd="${id}"]`).focus(); return; }
    if (e.target.closest("#pd-open-profile")) { e.preventDefault(); history.pushState(null, "", "#profile"); showView("profile"); $("#profile-main").focus(); }
  });

  // ---------- Views: Profile (start) and Inbox ----------
  const views = { profile: $("#view-profile"), inbox: $("#view-inbox") };
  let view = "profile";
  function showView(v) {
    view = v === "inbox" ? "inbox" : "profile";
    views.profile.hidden = view !== "profile";
    views.inbox.hidden = view !== "inbox";
    $("#skip-link").setAttribute("href", view === "inbox" ? "#task-table" : "#profile-main");
    $("#skip-link").textContent = view === "inbox" ? "Skip to tasks" : "Skip to profile";
    const sw = $("#switch-view");
    sw.textContent = view === "inbox" ? "Open Profile" : "Open Inbox";
    sw.setAttribute("href", view === "inbox" ? "#profile" : "#inbox");
    document.title = view === "inbox" ? "Inbox — Review DCR prototype" : `${profile.entityName} · Profile — Review DCR prototype`;
    if (view === "inbox") renderInbox(); else renderWorkflow();
  }
  window.addEventListener("hashchange", () => showView(location.hash.slice(1)));

  // ---------- Profile page (Figma 1752:18350) ----------
  function renderProfileStatic() {
    $("#ent-avatar").textContent = dcr.entityInitials;
    $("#ent-name").textContent = profile.entityName;
    $("#ent-type").textContent = dcr.entityType;
    $("#ent-id").textContent = `Entity ID: ${profile.entityId}`;
    $("#ent-results").textContent = profile.searchResults;
    $("#profile-user-avatar").textContent = user.initials;
    $("#entity-tabs").innerHTML = profile.tabs.map((t, i) => i === 0
      ? `<button type="button" class="tab" role="tab" id="tab-${i}" aria-selected="true" tabindex="0">${esc(t)}</button>`
      : `<button type="button" class="tab" role="tab" id="tab-${i}" aria-selected="false" aria-disabled="true" tabindex="-1" title="Not part of this prototype">${esc(t)}</button>`).join("");
    hydrateIcons($("#view-profile"));
    renderMode();
    renderGrid();
  }

  // ---------- Profile mode: Viewing / Suggesting / Editing ----------
  // Figma: mode menu "Profile Page 02 — Select suggesting" (1856:35664); editable profile
  // "Profile Page 04 — Suggest Mode" (830:22529). The mode button is a DS Button/Outline acting as
  // a select-only combobox over a DS Menu (same controller as the Review DCR dropdowns).
  const MODES = profile.modes;
  const attrKey = (card, label) => `${card}|${label}`;
  const optionsFor = (label) => (SEED.find((f) => f.label === label && f.options) || {}).options;
  const editable = () => state.mode !== "viewing";
  const MODE_COPY = {
    suggesting: { send: "Suggest", count: "to suggest", title: "Suggestion sent", done: (n) => `${n} ${n === 1 ? "change" : "changes"} sent for review as a data change request`,
      enter: "Suggesting. Organization Attributes, Identifiers and Associated Organization Details are now editable. Suggest sends your changes for review.", discard: "Suggestion discarded." },
    editing: { send: "Save", count: "to save", title: "Profile saved", done: (n) => `${n} ${n === 1 ? "change" : "changes"} saved to the profile`,
      enter: "Editing. Organization Attributes, Identifiers and Associated Organization Details are now editable. Save applies your changes to the profile.", discard: "Changes discarded." },
  };
  function renderMode() {
    if (dd && dd.id === "mode") dd = null;
    const m = MODES.find((x) => x.id === state.mode);
    $("#mode").innerHTML = `
      <span class="sr-only" id="lbl-mode">Profile mode</span>
      <button type="button" class="btn btn--outline dd__trigger mode__btn" id="val-mode" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="lb-mode" aria-labelledby="lbl-mode val-mode">
        ${icon(m.icon, 20)}<span class="dd__value">${esc(m.label)}</span><span class="dd__chev" aria-hidden="true">${icon("arrow_drop_down", 20)}</span></button>
      <ul class="dd__menu mode__menu" id="lb-mode" role="listbox" aria-labelledby="lbl-mode" hidden>
        ${MODES.map((o, i) => `<li class="dd__item mode__item" role="option" id="opt-mode-${i}" data-value="${o.id}" data-label="${esc(o.label)}" aria-selected="${o.id === state.mode}">
          ${icon(o.icon, 20)}<span>${esc(o.label)}</span></li>`).join("")}
      </ul>`;
    const on = editable();
    $("#suggest-actions").hidden = !on;
    if (on) { $("#suggest-send").textContent = MODE_COPY[state.mode].send; updateSuggestBtn(); }
  }
  function initDraft() {
    const rows = {}; let rid = 0;
    profile.columns.flat().filter((c) => c.suggest && c.attrs).forEach((c) => cardAttrs(c).forEach((a) => {
      rows[attrKey(c.title, a[0])] = valsOf(c, a).map((v) => ({ rid: String(++rid), label: a[0], orig: v, value: v, del: false, added: false }));
    }));
    return { rows, next: rid };
  }
  const sgRows = () => Object.values(state.sug ? state.sug.rows : {}).flat();
  const sgRow = (rid) => sgRows().find((r) => r.rid === rid);
  const sgKeyOf = (rid) => Object.keys(state.sug.rows).find((k) => state.sug.rows[k].some((r) => r.rid === rid));
  const filled = (v) => v != null && String(v).trim() !== "";
  function sgChanges() {
    return sgRows().filter((r) => r.added ? !r.del && filled(r.value) : r.del || String(r.value ?? "").trim() !== r.orig).length;
  }
  function updateSuggestBtn() {
    if (!editable()) return;
    const n = sgChanges();
    $("#suggest-send").disabled = n === 0;
    $("#suggest-n").textContent = n ? `${n} ${n === 1 ? "change" : "changes"} ${MODE_COPY[state.mode].count}` : "No changes yet";
  }
  function setMode(m, focusSel = "#val-mode") {
    if (m === state.mode) { $(focusSel).focus(); return; }
    const was = state.mode, discarded = state.sug ? sgChanges() : 0;
    state.mode = m;
    state.sug = m === "viewing" ? null : initDraft();
    renderMode(); renderGrid();
    $(focusSel).focus();
    const pre = discarded ? `${MODE_COPY[was].discard} ` : "";
    announce(m === "viewing" ? `${pre}Back to viewing.` : `${pre}${MODE_COPY[m].enter}`);
  }

  /* P6 (interaction spec, option b): leaving Suggesting / Editing with unsent changes asks first.
     With no changes it leaves at once. Keep editing is the default, so Enter / Esc never discard. */
  function requestMode(m, focusSel) {
    const n = state.sug && m !== state.mode ? sgChanges() : 0;
    if (!n) { setMode(m, focusSel); return; }
    const editing = state.mode === "editing", word = n === 1 ? "change" : "changes";
    const labels = [...new Set(sgRows().filter((r) => r.added ? !r.del && filled(r.value) : r.del || String(r.value ?? "").trim() !== r.orig).map((r) => r.label))];
    const list = labels.length > 5 ? `${labels.slice(0, 5).join(", ")} and ${labels.length - 5} more` : labels.join(", ");
    confirmDialog({
      title: editing ? `Discard ${n} unsaved ${word}?` : `Discard ${n} ${word}?`,
      text: `${editing ? "Your changes haven't been saved to the profile." : `Your suggestion for ${profile.entityName} hasn't been sent.`} Changed: ${list}.`,
      ok: "Discard", cancel: "Keep editing",
    }).then((ok) => { if (ok) setMode(m, focusSel); });
  }
  window.addEventListener("beforeunload", (e) => { if (state.sug && sgChanges()) { e.preventDefault(); e.returnValue = ""; } });

  function renderGrid() {
    if (dd && $("#profile-grid").contains(dd.trigger)) dd = null;
    const sug = editable();
    let n = 0;
    const attrHTML = ([label, count, values, stacked]) => {
      const dt = `<dt class="attr__label">${esc(label)}<span data-icon="help_outline" data-size="11" aria-hidden="true"></span>${count ? `<span class="counter"><span aria-hidden="true">+${count}</span><span class="sr-only">${count} more ${count === 1 ? "value" : "values"}</span></span>` : ""}</dt>`;
      const dd = (v) => `<dd class="attr__value">${stacked ? `<span data-icon="arrow_forward_ios" data-size="8" aria-hidden="true"></span>` : ""}<span>${esc(v)}</span></dd>`;
      return `<div class="attr${stacked ? " attr--stack" : ""}">${dt}${values.map(dd).join("")}</div>`;
    };
    const labelHTML = (label, count, id) => `<span class="attr__label"${id ? ` id="${id}"` : ""}>${esc(label)}<span data-icon="help_outline" data-size="11" aria-hidden="true"></span>${count ? `<span class="counter"><span aria-hidden="true">+${count}</span><span class="sr-only">${count} more ${count === 1 ? "value" : "values"}</span></span>` : ""}</span>`;
    // Suggesting / Editing: inline values become DS Fields (Company Type a DS dropdown) with + and delete;
    // stacked (nested) values keep their text with delete only, as in Figma 830:22529.
    const srowHTML = (r, i, rows, stacked, opts) => {
      const id = `sg-${r.rid}`, nth = rows.filter((x) => !x.added).length > 1 || r.added ? `, value ${i + 1}` : "";
      const lbl = `<span hidden id="lbl-${id}">${esc(r.label)}${nth}${r.added ? " (added by you)" : ""}</span>`;
      if (r.del) return `<div class="srow is-deleted" data-id="${id}">${lbl}
          <span class="srow__ctl srow__text"><span class="sr-only">${esc(r.label)}${nth}, deleted: </span><s>${esc(r.orig)}</s></span>
          <span class="tag tag--deleted">Deleted</span>
          <span class="srow__tools"><span class="srow__gap" aria-hidden="true"></span><button type="button" class="icon-btn" data-action="sg-restore" data-rid="${r.rid}" aria-label="Restore ${esc(r.label)}${nth}">${icon("undo", 18)}</button></span></div>`;
      const used = rows.filter((x) => !x.del && x !== r).map((x) => x.value);
      const ctl = stacked
        ? `<span class="srow__ctl srow__text attr__value"><span data-icon="arrow_forward_ios" data-size="8" aria-hidden="true"></span><span>${esc(r.value)}</span></span>`
        : `<span class="srow__ctl">${opts
          ? ddHTML(id, opts, r.value, used, false, "already a value of this attribute")
          : `<input class="erow__input" id="val-${id}" data-rid="${r.rid}" value="${esc(r.value || "")}" aria-labelledby="lbl-${id}" autocomplete="off">`}</span>`;
      const add = stacked || r.added ? `<span class="srow__gap" aria-hidden="true"></span>` : `<button type="button" class="icon-btn" data-action="sg-add" data-rid="${r.rid}" aria-label="Add another ${esc(r.label)} value">${icon("add", 18)}</button>`;
      const del = `<button type="button" class="icon-btn" data-action="sg-del" data-rid="${r.rid}" aria-label="Delete ${esc(r.label)}${nth}${stacked ? `: ${esc(r.value)}` : ""}">${icon("delete_outline", 18)}</button>`;
      return `<div class="srow${r.added ? " srow--added" : ""}" data-id="${id}">${lbl}${ctl}<span class="srow__tools">${add}${del}</span></div>`;
    };
    const sattrHTML = (c) => ([label, count, , stacked]) => {
      const rows = state.sug.rows[attrKey(c.title, label)];
      return `<div class="sattr">${labelHTML(label, count)}${rows.length ? "" : `<span class="srow__none">No value</span>`}${rows.map((r, i) => srowHTML(r, i, rows, stacked, stacked ? null : optionsFor(label))).join("")}</div>`;
    };
    const moreAttrs = `<button type="button" class="more-attrs" aria-disabled="true" title="Not part of this prototype">${icon("add", 16)}More attributes</button>`;
    // "Show more" reveals the card's other attributes (c.more), in every mode
    const shown = (c) => [...(c.attrs || []), ...(c.more && state.moreOpen.has(c.title) ? c.more : [])].map((a) => [a[0], a[1], valsOf(c, a), a[3], a[4]]);
    const moreBtn = (c, id) => {
      if (!c.more) return "";
      const open = state.moreOpen.has(c.title), k = c.more.length;
      return `<button type="button" class="show-more" data-action="show-more" data-card="${esc(c.title)}" aria-expanded="${open}" aria-controls="${id}-body">
        <span class="show-more__chev${open ? " is-open" : ""}" aria-hidden="true">⌄</span> ${open ? "Show less" : "Show more"}<span class="sr-only"> attributes${open ? "" : ` (${k} more)`}</span></button>`;
    };
    const cardHTML = (c) => {
      const id = `pcard-${++n}`;
      let body = "";
      if (sug && c.suggest) body = `<div class="pcard__body pcard__body--suggest" id="${id}-body">${moreAttrs}${shown(c).map(sattrHTML(c)).join("")}${moreBtn(c, id)}</div>`;
      else if (c.attrs) body = `<div class="pcard__body" id="${id}-body"><dl class="pcard__list">${shown(c).map(attrHTML).join("")}</dl>${moreBtn(c, id)}</div>`;
      else if (c.table) {
        const tb = c.table;
        body = `<table class="ptable"><colgroup><col style="width:32%"><col style="width:43%"><col style="width:25%"></colgroup>
          <thead><tr>${tb.head.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
          <tbody>${tb.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>
          <div class="ptable__pager"><span>${esc(tb.range)}</span><span aria-hidden="true">‹&nbsp;&nbsp;&nbsp;&nbsp;›</span></div>`;
      } else if (c.empty) body = `<p class="pcard__empty">${esc(c.empty)}</p>`;
      if (c.dateField || c.tree) {
        body = `<div class="pcard__body">
          ${c.dateField ? `<div class="pfield" title="Not part of this prototype"><span>Effective date</span><span data-icon="help_outline" data-size="20" aria-hidden="true"></span></div>` : ""}
          ${c.tree ? `<ul class="tree">${c.tree.map(([name, cnt, kids]) => `<li><span class="tree__node"><span class="tree__icon" aria-hidden="true"></span>${esc(name)}<span class="tree__n"><span class="sr-only">, children: </span>${cnt}</span></span>
              <ul>${kids.map((k) => `<li><span class="tree__node"><span class="tree__icon" aria-hidden="true"></span>${esc(k)}</span></li>`).join("")}</ul></li>`).join("")}</ul>` : ""}
        </div>`;
      }
      return `<section class="pcard" aria-labelledby="${id}">
        <div class="pcard__head"><h2 class="pcard__title" id="${id}">${esc(c.title)}</h2>${c.action ? `<span data-icon="select_all" data-size="15" aria-hidden="true"></span>` : ""}</div>
        ${body}</section>`;
    };
    $("#profile-grid").innerHTML = profile.columns.map((col) => `<div class="pcol">${col.map(cardHTML).join("")}</div>`).join("");
    hydrateIcons($("#profile-grid"));
    updateSuggestBtn();
  }
  const grid = $("#profile-grid");
  grid.addEventListener("input", (e) => {
    const r = e.target.dataset.rid && sgRow(e.target.dataset.rid);
    if (r) { r.value = e.target.value; updateSuggestBtn(); }
  });
  grid.addEventListener("click", (e) => {
    const more = e.target.closest('[data-action="show-more"]');
    if (more) {
      const t = more.dataset.card, open = !state.moreOpen.has(t);
      open ? state.moreOpen.add(t) : state.moreOpen.delete(t);
      renderGrid();
      $(`[data-action="show-more"][data-card="${CSS.escape(t)}"]`, grid).focus();
      const k = cardBy(t).more.length;
      announce(open ? `Showing ${k} more attributes.` : "Showing fewer attributes.");
      return;
    }
    const b = e.target.closest("[data-action^='sg-']");
    if (!b || !state.sug) return;
    const rid = b.dataset.rid, key = sgKeyOf(rid), rows = state.sug.rows[key], r = sgRow(rid);
    let focus;
    if (b.dataset.action === "sg-add") {
      const nr = { rid: String(++state.sug.next), label: r.label, orig: null, value: optionsFor(r.label) ? null : "", del: false, added: true };
      rows.push(nr);
      focus = `#val-sg-${nr.rid}`;
      announce(`Added another ${r.label} value.`);
    } else if (b.dataset.action === "sg-del") {
      const i = rows.indexOf(r);
      if (r.added) { rows.splice(i, 1); const prev = rows[Math.max(0, i - 1)]; focus = prev && (prev.del ? `[data-action="sg-restore"][data-rid="${prev.rid}"]` : `[data-action="sg-del"][data-rid="${prev.rid}"]`); }
      else { r.del = true; r.value = r.orig; focus = `[data-action="sg-restore"][data-rid="${rid}"]`; }
      announce(`${r.label} value deleted${r.added ? "" : ". Restore brings it back"}.`);
    } else if (b.dataset.action === "sg-restore") {
      r.del = false;
      focus = `[data-action="sg-del"][data-rid="${rid}"]`;
      announce(`${r.label} value restored.`);
    }
    renderGrid();
    const f = focus && $(focus, grid); if (f) f.focus();
  });
  $("#suggest-cancel").addEventListener("click", () => requestMode("viewing"));
  $("#suggest-send").addEventListener("click", () => {
    const n = sgChanges(), mode = state.mode, copy = MODE_COPY[mode];
    if (!n) return;
    if (mode === "editing") { // apply the draft to the profile
      Object.entries(state.sug.rows).forEach(([key, rows]) => {
        const vals = rows.filter((r) => !r.del && filled(r.value)).map((r) => String(r.value).trim());
        const before = rows.filter((r) => !r.added).map((r) => r.orig);
        if (vals.join("\u0000") !== before.join("\u0000")) state.saved[key] = vals;
      });
    }
    state.sug = null; // so setMode doesn't report it as discarded
    setMode("viewing");
    $("#toast-title").textContent = copy.title;
    $("#toast-text").textContent = `${profile.entityName} · ${copy.done(n)}`;
    $("#toast-view").hidden = true;
    toast.className = "toast toast--suggested";
    toast.hidden = false;
    announce(`${copy.title}. ${$("#toast-text").textContent}`);
  });

  // Workflow panel: the DCR waiting for this reviewer, then requests already reviewed
  const wf = $("#wf-panel");
  const RESOLVED_LABEL = { approved: "Approved", resubmitted: "Sent for resubmission", rejected: "Rejected" };
  function reqAttrs(id, by, on, step) {
    return `<p class="req__attrs">
      <span><span class="req__k">DCR ID:</span>${esc(id)}</span>
      <span><span class="req__k">Created by:</span>${esc(by)} <span class="req__k">on</span>${esc(on)}</span>
      <span><span class="req__k">Step:</span>${esc(step)}</span></p>`;
  }
  function renderWorkflow() {
    if (dp) dpClose();
    if (dd && wf.contains(dd.trigger)) dd = null;
    const w = profile.workflow, o = w.open, r = state.resolved, f = state.wfForm;
    const expanded = state.wfExpanded && !r;
    wf.hidden = !state.wfOpen;
    $("#wf-toggle").setAttribute("aria-expanded", String(state.wfOpen));
    const items = wfItems(), F = state.wfFilter;
    const pass = new Map(items.map((it) => [it.id, wfMatch(it, F)]));
    const shown = items.filter((it) => pass.get(it.id)).length;
    $("#wf-count").textContent = activeFilters(F).length ? `${shown} of ${items.length} items` : `${items.length} items`;
    renderChips();
    const matchLine = (id) => { const m = pass.get(id); return m && m.matchedAttr ? `<p class="req__match">Matches attribute: <strong>${esc(m.matchedAttr)}</strong></p>` : ""; };
    const dcrCard = `
      <li class="req${r ? "" : ` req--${f.priority.toLowerCase()}`}" id="req-dcr">
        <span class="req__bar" aria-hidden="true"></span>
        <div class="req__content">
          <div class="req__top">
            ${window.ICON_TASK_DCR}
            <div class="req__main">
              <h3 class="req__title">Data Change Request Review${r ? "" : `<span class="sr-only"> · waiting for your review, ${f.priority.toLowerCase()} priority</span>`}</h3>
              ${reqAttrs(dcr.dcrId, o.createdBy, o.createdOn, o.step)}
              ${matchLine(dcr.dcrId)}
            </div>
            <div class="req__meta">
              <span data-icon="flag" data-size="14" aria-hidden="true"></span><span id="req-due-text"><span class="sr-only">Due </span>${esc(f.dueDate)}</span>
              ${r ? "" : `<button type="button" class="icon-btn req__toggle" data-action="wf-expand" aria-expanded="${expanded}" aria-controls="req-dcr-form" aria-label="${expanded ? "Hide" : "Show"} due date, priority and assignee">
                <span data-icon="${expanded ? "arrow_up_20" : "expand_more_20"}" data-size="20"></span></button>`}
            </div>
          </div>
          <div class="req__actions">
            ${r
              ? `<span class="req__status req__status--${r.kind}"><span data-icon="${r.kind === "approved" ? "done" : r.kind === "rejected" ? "close_24" : "send"}" data-size="18" aria-hidden="true"></span>${RESOLVED_LABEL[r.kind]}</span>
                 <button type="button" class="btn btn--text" data-action="wf-view" aria-haspopup="dialog"><span data-icon="visibility" data-size="18"></span>View DCR</button>`
              : `<a href="#inbox" class="btn btn--text" data-action="wf-inbox"><span data-icon="open_in_new" data-size="18"></span>Open in Inbox<span class="sr-only">: DCR ${esc(dcr.dcrId)}</span></a>
                 <button type="button" class="btn btn--text" data-action="wf-review" aria-haspopup="dialog"><span data-icon="review_dcr" data-size="18"></span>Review DCR</button>`}
          </div>
          ${expanded ? `
          <div class="req__form" id="req-dcr-form">
            <div class="req__row">
              <div class="dropdown" data-id="wf-due"><label class="field__label" id="lbl-wf-due" for="val-wf-due">Due date</label>
                <div class="dp">
                  <div class="dp__field">
                    <input class="erow__input dp__input" id="val-wf-due" value="${esc(f.dueDate)}" placeholder="DD/MM/YYYY" inputmode="numeric" autocomplete="off" maxlength="10"
                      aria-describedby="hint-wf-due msg-wf-due" ${state.dueMsg && state.dueMsg.level === "error" ? 'aria-invalid="true"' : ""}>
                    <button type="button" class="icon-btn dp__trigger" aria-label="Choose due date from a calendar" aria-haspopup="dialog" aria-expanded="false" aria-controls="dp-wf-due">
                      <span class="dp__icon" data-icon="date_range" data-size="20" aria-hidden="true"></span></button>
                  </div>
                  <span class="sr-only" id="hint-wf-due">Format DD/MM/YYYY</span>
                  ${dueMsgHTML()}
                  <div class="dp__pop" id="dp-wf-due" role="dialog" aria-modal="false" aria-labelledby="dp-title" hidden></div>
                </div></div>
              <div class="dropdown" data-id="wf-priority"><span class="field__label" id="lbl-wf-priority">Priority</span>
                <div class="erow__field">${ddHTML("wf-priority", w.priorities, f.priority, [], false)}</div></div>
            </div>
            <div class="dropdown" data-id="wf-assignee"><span class="field__label" id="lbl-wf-assignee">Assigned to</span>
              <div class="erow__field">${ddHTML("wf-assignee", w.users, f.assignedTo, [], false)}</div></div>
          </div>` : ""}
        </div>
      </li>`;
    const doneCards = w.reviewed.filter((x) => pass.get(x.id)).map(({ id, by, on, step, due, outcome }) => `
      <li class="req">
        <span class="req__bar" aria-hidden="true"></span>
        <div class="req__content">
          <div class="req__top">
            ${window.ICON_TASK_DCR}
            <div class="req__main"><h3 class="req__title">Data Change Request Review</h3>${reqAttrs(id, by, on, step)}${matchLine(id)}</div>
            <div class="req__meta"><span data-icon="flag" data-size="14" aria-hidden="true"></span><span><span class="sr-only">Due </span>${esc(due)}</span>
              <button type="button" class="icon-btn req__toggle" aria-disabled="true" aria-label="Show details (not part of this prototype)"><span data-icon="expand_more_20" data-size="20"></span></button></div>
          </div>
          <div class="req__actions">
            <span class="req__status req__status--${outcome}"><span data-icon="${outcome === "approved" ? "done" : "close_24"}" data-size="18" aria-hidden="true"></span>${STATUS_LABEL[outcome]}</span>
            ${window.DEMO.history[id]
              ? `<button type="button" class="btn btn--text" data-action="wf-history" data-dcr="${esc(id)}" aria-haspopup="dialog"><span data-icon="visibility" data-size="18"></span>View DCR<span class="sr-only"> ${esc(id)}</span></button>`
              : `<button type="button" class="btn btn--text" aria-disabled="true" title="In this prototype, View DCR shows the history of 8kqTMD12"><span data-icon="visibility" data-size="18"></span>View DCR<span class="sr-only"> ${esc(id)} (not part of this prototype)</span></button>`}
          </div>
        </div>
      </li>`).join("");
    $("#wf-list").innerHTML = (pass.get(dcr.dcrId) ? dcrCard : "") + doneCards + (shown ? "" : `
      <li class="wf__empty"><p>No workflows on this profile match these filters.</p><button type="button" class="btn btn--text" data-action="wf-clear">Clear filters</button></li>`);
    hydrateIcons(wf);
  }

  // ---------- Workflow filters (profile page) ----------
  const W = profile.workflow;
  const TODAY = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); })();
  const STATUS_LABEL = { open: "Open", approved: "Approved", rejected: "Rejected", resubmitted: "Sent for resubmission" };
  const WF_OPTIONS = {
    type: [{ v: "all", l: "All types" }, ...W.types.map((t) => ({ v: t.id, l: t.label, disabled: !t.enabled }))],
    status: [{ v: "all", l: "All statuses" }, { v: "open", l: "Open" }, { v: "closed", l: "Closed (any outcome)" }, { v: "approved", l: "Approved" }, { v: "rejected", l: "Rejected" }, { v: "resubmitted", l: "Sent for resubmission" }],
    priority: [{ v: "all", l: "Any priority" }, ...W.priorities.slice().reverse().map((p) => ({ v: p, l: p }))],
    assignee: [{ v: "all", l: "Anyone" }, ...W.users.map((u) => ({ v: u, l: u === user.reviewer ? `${u} (me)` : u }))],
    due: [{ v: "all", l: "Any due date" }, { v: "overdue", l: "Overdue" }, { v: "7", l: "Due in the next 7 days" }, { v: "30", l: "Due in the next 30 days" }],
    created: [{ v: "all", l: "Any time" }, ...[TODAY.getFullYear(), TODAY.getFullYear() - 1, TODAY.getFullYear() - 2].map((y) => ({ v: String(y), l: String(y) })), { v: "older", l: `${TODAY.getFullYear() - 3} or earlier` }],
  };
  const WF_FIELDS = [["type", "Workflow type"], ["status", "Status"], ["priority", "Priority"], ["assignee", "Assigned to"], ["due", "Due date"], ["created", "Created"]];
  const optLabel = (k, v) => (WF_OPTIONS[k].find((o) => o.v === v) || {}).l || v;
  // Every request on this profile as one searchable record
  function wfItems() {
    const r = state.resolved, f = state.wfForm, o = W.open;
    const own = {
      id: dcr.dcrId, type: "dcr", status: r ? r.kind : "open", priority: f.priority, assignee: f.assignedTo, due: f.dueDate,
      on: o.createdOn, by: o.createdBy, step: o.step, mine: true,
      attrs: [...state.fields.flatMap((x) => [x.label, x.value, x.original]), ...state.newAttrs.map((x) => x.attr)].filter(Boolean),
    };
    return [own, ...W.reviewed.map((x) => ({ ...x, type: "dcr", status: x.outcome }))];
  }
  // Returns null if hidden, or { matchedAttr } when it passes
  function wfMatch(it, F) {
    if (F.type !== "all" && it.type !== F.type) return null;
    if (F.status === "closed" ? it.status === "open" : F.status !== "all" && it.status !== F.status) return null;
    if (F.priority !== "all" && it.priority !== F.priority) return null;
    if (F.assignee !== "all" && it.assignee !== F.assignee) return null;
    if (F.due !== "all") {
      const due = parseDMY(it.due), days = Math.round((due - TODAY) / 864e5);
      if (F.due === "overdue" ? !(it.status === "open" && days < 0) : !(days >= 0 && days <= +F.due)) return null;
    }
    if (F.created !== "all") {
      const y = parseDMY(it.on).getFullYear();
      if (F.created === "older" ? y > TODAY.getFullYear() - 3 : String(y) !== F.created) return null;
    }
    const q = F.q.trim().toLowerCase();
    if (!q) return {};
    const typeLabel = W.types.find((t) => t.id === it.type).label;
    const visible = [it.id, it.by, it.step, it.assignee, it.on, it.due, typeLabel, "dcr", STATUS_LABEL[it.status], it.priority].join(" ").toLowerCase();
    if (visible.includes(q)) return {};
    const attr = it.attrs.find((a) => String(a).toLowerCase().includes(q));
    if (!attr) return null;
    const label = it.mine ? (state.fields.find((x) => [x.label, x.value, x.original].includes(attr)) || {}).label || attr : attr;
    return { matchedAttr: label === attr ? attr : `${label} (${attr})` };
  }
  const activeFilters = (F) => [...(F.q.trim() ? [["q", `“${F.q.trim()}”`]] : []), ...WF_FIELDS.filter(([k]) => F[k] !== "all").map(([k, l]) => [k, `${l}: ${optLabel(k, F[k])}`])];
  function selHTML(key) {
    const id = `wff-${key}`, v = state.wfDraft[key];
    return `<button type="button" class="erow__input dd__trigger" id="val-${id}" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-controls="lb-${id}" aria-labelledby="lbl-${id} val-${id}">
        <span class="dd__value">${esc(optLabel(key, v))}</span><span class="dd__chev" aria-hidden="true">${icon("arrow_drop_down", 20)}</span></button>
      <ul class="dd__menu" id="lb-${id}" role="listbox" aria-labelledby="lbl-${id}" hidden>
        ${WF_OPTIONS[key].map((o, i) => `<li class="dd__item${o.disabled ? " is-disabled" : ""}" role="option" id="opt-${id}-${i}" data-value="${esc(o.v)}" data-label="${esc(o.l)}" aria-selected="${o.v === v}"${o.disabled ? ' aria-disabled="true"' : ""}>${esc(o.l)}${o.disabled ? `<span class="dd__note">None on this profile</span>` : ""}</li>`).join("")}
      </ul>`;
  }
  function renderFilterForm() {
    const form = $("#wf-filters");
    if (dd && form.contains(dd.trigger)) dd = null;
    form.hidden = !state.wfFiltersOpen;
    $("#wf-filter-btn").setAttribute("aria-expanded", String(state.wfFiltersOpen));
    if (!state.wfFiltersOpen) { form.innerHTML = ""; return; }
    form.innerHTML = `
      <div class="dropdown wf-filters__search">
        <label class="field__label" for="wff-q">Search</label>
        <div class="field wf-search">${icon("search", 20)}<input type="search" id="wff-q" value="${esc(state.wfDraft.q)}" placeholder="DCR ID, attribute, value, person or step" aria-describedby="wff-q-hint" autocomplete="off"></div>
        <p class="wf-filters__hint" id="wff-q-hint">For example 3nfvPH35, Company Type, Green Corporation, anita.raghavan</p>
      </div>
      <div class="wf-filters__grid">
        ${WF_FIELDS.map(([k, l]) => `<div class="dropdown" data-id="wff-${k}"><span class="field__label" id="lbl-wff-${k}">${l}</span><div class="erow__field">${selHTML(k)}</div></div>`).join("")}
      </div>
      <div class="wf-filters__actions">
        <button type="button" class="btn btn--text" data-action="wf-clear">Clear all</button>
        <button type="submit" class="btn btn--primary">Apply</button>
      </div>`;
  }
  function renderChips() {
    const box = $("#wf-chips"), act = activeFilters(state.wfFilter), n = act.length;
    const badge = $("#wf-filter-n");
    badge.hidden = !n; badge.textContent = n;
    $("#wf-filter-btn").setAttribute("aria-label", n ? `Filter, ${n} active` : "Filter");
    box.hidden = !n;
    box.innerHTML = n ? `<span class="sr-only">Active filters:</span>${act.map(([k, l]) => `<span class="wf-chip">${esc(l)}<button type="button" class="wf-chip__x" data-action="wf-unfilter" data-key="${k}" aria-label="Remove filter ${esc(l)}">${icon("clear", 14)}</button></span>`).join("")}
      <button type="button" class="link-btn wf-chips__clear" data-action="wf-clear">Clear all</button>` : "";
  }
  function applyFilters(F, msgFocus) {
    state.wfFilter = { ...F }; state.wfDraft = { ...F };
    state.wfFiltersOpen = false;
    renderFilterForm();
    renderWorkflow();
    const shown = $("#wf-list").querySelectorAll(".req").length;
    announce(activeFilters(F).length ? `Showing ${shown} of ${wfItems().length} workflows.` : `Filters cleared. Showing all ${shown} workflows.`);
    (msgFocus || $("#wf-filter-btn")).focus();
  }
  $("#wf-filter-btn").addEventListener("click", () => {
    state.wfFiltersOpen = !state.wfFiltersOpen;
    state.wfDraft = { ...state.wfFilter };
    renderFilterForm();
    if (state.wfFiltersOpen) $("#wff-q").focus();
  });
  $("#wf-filters").addEventListener("submit", (e) => { e.preventDefault(); applyFilters({ ...state.wfDraft, q: $("#wff-q").value }); });
  $("#wf-filters").addEventListener("input", (e) => { if (e.target.id === "wff-q") state.wfDraft.q = e.target.value; });
  $("#wf-filters").addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !dd) { e.preventDefault(); e.stopPropagation(); state.wfFiltersOpen = false; renderFilterForm(); $("#wf-filter-btn").focus(); }
  });

  function setWorkflow(open) {
    state.wfOpen = open;
    renderWorkflow();
    (open ? $("#wf-title") : $("#wf-toggle")).focus();
  }
  $("#wf-toggle").addEventListener("click", () => setWorkflow(!state.wfOpen));
  $("#wf-close").addEventListener("click", () => setWorkflow(false));
  wf.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.getAttribute("aria-disabled") === "true") return;
    switch (btn.dataset.action) {
      case "wf-review": case "wf-view": openReview(); break;
      case "wf-inbox": {
        // Same task, opened from the Inbox: switch views and open its review panel
        e.preventDefault();
        history.pushState(null, "", "#inbox");
        showView("inbox");
        openPanel();
        announce(`Inbox. Data Change Request Review ${dcr.dcrId} is open in the review panel.`);
        break;
      }
      case "wf-history": state.viewing = btn.dataset.dcr; openReview(`[data-dcr="${btn.dataset.dcr}"]`); break;
      case "wf-clear": applyFilters({ ...WF_DEFAULT }); break;
      case "wf-unfilter": {
        const k = btn.dataset.key, F = { ...state.wfFilter, [k]: WF_DEFAULT[k] };
        const keys = activeFilters(state.wfFilter).map(([x]) => x), i = keys.indexOf(k);
        applyFilters(F);
        const chips = $("#wf-chips").querySelectorAll(".wf-chip__x");
        (chips[Math.min(i, chips.length - 1)] || $("#wf-filter-btn")).focus();
        break;
      }
      case "wf-expand":
        state.wfExpanded = !state.wfExpanded; renderWorkflow();
        $('#wf-list [data-action="wf-expand"]').focus();
        break;
    }
  });
  // Entity tabs: DS Tab Bar with roving focus (only Profile is part of the prototype)
  $("#entity-tabs").addEventListener("keydown", (e) => {
    const tabs = [...e.currentTarget.querySelectorAll("[role=tab]")];
    const i = tabs.indexOf(document.activeElement); if (i < 0) return;
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    let j = k ? (i + k + tabs.length) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault(); tabs.forEach((t, x) => (t.tabIndex = x === j ? 0 : -1)); tabs[j].focus();
  });

  // ---------- Events ----------
  $("#task-rows").addEventListener("click", (e) => { if (e.target.closest("#open-dcr")) openPanel(); });
  $("#task-rows").addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-row]"); if (!cb) return;
    const i = +cb.dataset.row;
    cb.checked ? state.selected.add(i) : state.selected.delete(i);
    cb.closest("tr").classList.toggle("is-checked", cb.checked);
    renderSelection();
  });
  $("#select-all").addEventListener("change", (e) => {
    state.selected = e.target.checked ? new Set(visibleTasks().map(({ i }) => i)) : new Set();
    renderInbox();
  });
  $("#close-panel").addEventListener("click", () => closePanel());
  $("#open-review").addEventListener("click", openReview);
  $("#more-info-toggle").addEventListener("click", (e) => {
    const b = e.currentTarget; const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", open); $("#more-info-body").hidden = !open;
  });

  function onAction(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn || btn.getAttribute("aria-disabled") === "true" || btn.tagName === "INPUT" || btn.tagName === "SELECT") return;
    const id = btn.closest("[data-id]")?.dataset.id;
    const inDialog = !!btn.closest("#review-dialog");
    switch (btn.dataset.action) {
      case "why": {
        const f = field(id); f.whyOpen = !f.whyOpen;
        inDialog ? renderReview() : renderPanel();
        (inDialog ? review : panel).querySelector(`[data-id="${id}"] [data-action="why"]`)?.focus();
        break;
      }
      case "reject-field": openReason(id); break;
      case "reason-cancel": cancelReason(id); break;
      case "reason-submit": submitReason(id); break;
      case "unreject": askUnreject(id); break;
      case "add-value": {
        const f = field(id);
        const x = { id: `${f.id}-x${++state.seq}`, of: f.id, value: null };
        state.extra.push(x);
        renderReview();
        const row = review.querySelector(`.erow[data-id="${x.id}"]`);
        scrollWithin($("#review-main"), row);
        $(`#val-${x.id}`).focus({ preventScroll: true });
        announce(`New ${f.label} row added below. Choose a value.`);
        break;
      }
      case "add-attr-value": {
        const r = state.newAttrs.find((e) => e.id === id);
        const n = { id: `attr${++state.seq}`, attr: r.attr, current: null, value: null };
        state.newAttrs.splice(state.newAttrs.indexOf(r) + 1, 0, n);
        renderReview();
        $(`#val-${n.id}`).focus();
        announce(`New ${r.attr} row added below.`);
        break;
      }
      case "remove-attr-value": {
        const r = state.newAttrs.find((e) => e.id === id), i = state.newAttrs.indexOf(r);
        state.newAttrs.splice(i, 1);
        renderReview();
        const next = state.newAttrs.filter((e) => e.attr === r.attr)[0];
        (next ? $(`#val-${next.id}`) : $("#val-__addattr")).focus();
        announce(next ? `${r.attr} row deleted.` : `${r.attr} removed from this request. It is back in Add attribute.`);
        break;
      }
      case "remove-value": {
        const x = state.extra.find((e) => e.id === id), f = field(x.of);
        state.extra = state.extra.filter((e) => e.id !== id);
        renderReview();
        review.querySelector(`.erow[data-id="${f.id}"] [data-action="add-value"]`)?.focus();
        announce(`Added ${f.label} value deleted.`);
        break;
      }
      case "revert": {
        const f = field(id); f.value = f.proposed; renderReview();
        $(`#val-${id}`)?.focus(); announce(`${f.label} reverted to the requester's value.`);
        break;
      }
      case "show-comments": {
        const c = state.comments.filter((x) => x.fieldId === id).pop();
        if (c) { const el = $(`#cmt-${c.id}`); scrollWithin($("#rail-list"), el); flash(el); flash(review.querySelector(`.erow[data-id="${id}"]`)); el.focus({ preventScroll: true }); }
        break;
      }
      case "goto-row": {
        const fid = btn.dataset.field;
        const row = review.querySelector(`.erow[data-id="${fid}"]`);
        scrollWithin($("#review-main"), row); flash(row); flash(btn.closest(".cmt"));
        (row.querySelector('[data-action="unreject"], [data-action="reject-field"]') || row).focus({ preventScroll: true });
        break;
      }
      case "hist-toggle": {
        const fid = btn.closest("[data-hfield]").dataset.hfield;
        state.histOpen.has(fid) ? state.histOpen.delete(fid) : state.histOpen.add(fid);
        renderReview();
        review.querySelector(`[data-hfield="${fid}"] [data-action="hist-toggle"]`).focus();
        break;
      }
      case "hist-all": {
        const h = historyFor(state.viewing), all = state.histOpen.size === h.fields.length;
        state.histOpen = all ? new Set() : new Set(h.fields.map((f) => f.id));
        renderReview(); review.querySelector('[data-action="hist-all"]').focus();
        announce(all ? "All histories collapsed." : "All histories expanded.");
        break;
      }
      case "hist-cmt": showComments(btn.dataset.ids.split(",")); break;
      case "hist-goto": {
        const fid = btn.dataset.field, step = `hstep-${fid}-${btn.dataset.stage}`;
        state.histOpen.add(fid); renderReview();
        const el = $(`#${step}`);
        scrollWithin($("#review-main"), el); flash(el);
        (el.querySelector(".hist-cmt") || review.querySelector(`[data-hfield="${fid}"] [data-action="hist-toggle"]`)).focus({ preventScroll: true });
        break;
      }
      case "toggle-org": state.orgOpen = !state.orgOpen; renderReview(); review.querySelector("[data-action='toggle-org']").focus(); break;
      case "reject-request": askComment({ kind: "request", from: btn.dataset.from }, "Rejecting the whole request. It goes back to the requester."); break;
      case "approve": case "resubmit": {
        const bad = blockingRows();
        if (bad.length) {
          bad.forEach((it) => state.touched.add(it.id));
          renderReview();
          const first = $(`#val-${bad[0].id}`);
          scrollWithin($("#review-main"), first.closest(".erow")); first.focus({ preventScroll: true });
          announce(`Fix ${bad.length === 1 ? "1 field" : `${bad.length} fields`} before you ${btn.dataset.action}.`);
          break;
        }
        resolve(btn.dataset.action === "approve" ? "approved" : "resubmitted");
        break;
      }
    }
  }
  panel.addEventListener("click", onAction);
  review.addEventListener("click", onAction);
  review.addEventListener("change", (e) => {
    const el = e.target.closest("input.erow__input"); if (!el) return;
    if (el.readOnly) return;
    const it = item(el.closest("[data-id]").dataset.id);
    state.touched.add(it.id);
    if (it.isExtra || it.isNew) it.ref.value = el.value.trim() || null;
    else it.value = el.value.trim() === "—" ? null : el.value;
    // "change" fires as focus leaves the box: re-render after focus has moved, then put focus (and any
    // half-typed text in the next box) back where the reviewer went, not on the box they just left.
    setTimeout(() => {
      const a = document.activeElement;
      const key = !a || !review.contains(a) ? null
        : a.id ? `#${CSS.escape(a.id)}`
        : a.dataset.action && a.closest("[data-id]") ? `[data-id="${a.closest("[data-id]").dataset.id}"] [data-action="${a.dataset.action}"]` : null;
      const typed = a && a.matches("input.erow__input") ? { v: a.value, s: a.selectionStart, e: a.selectionEnd } : null;
      renderReview();
      const back = key ? review.querySelector(key) : null;
      if (back) {
        if (typed && back.value !== typed.v) { back.value = typed.v; back.dispatchEvent(new Event("input", { bubbles: true })); }
        back.focus({ preventScroll: true });
        if (typed) try { back.setSelectionRange(typed.s, typed.e); } catch (_) {}
      } else if (!a || !review.contains(a) || a === document.body) $(`#val-${it.id}`)?.focus();
    }, 0);
  });
  review.addEventListener("input", (e) => {
    const el = e.target.closest("input.erow__input"); if (!el || el.readOnly) return;
    const li = el.closest("[data-id]"), it = item(li.dataset.id);
    const r = shownMsg(it, el.value);
    const old = $(`#msg-${it.id}`);
    if (old) old.outerHTML = msgHTML(it.id, r);
    r && r.level === "error" ? el.setAttribute("aria-invalid", "true") : el.removeAttribute("aria-invalid");
  });
  // R14: inline rejection reason box
  review.addEventListener("input", (e) => {
    const ta = e.target.closest("textarea[data-reason]"); if (!ta) return;
    const box = ta.closest(".reason"), n = ta.value.length;
    state.drafts[ta.dataset.reason] = ta.value;
    box.querySelector('[data-action="reason-submit"]').disabled = !ta.value.trim();
    const c = box.querySelector(".reason__count"); c.hidden = n < 900; c.textContent = `${n} / 1,000`;
  });
  review.addEventListener("keydown", (e) => {
    const ta = e.target.closest && e.target.closest("textarea[data-reason]"); if (!ta) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancelReason(ta.dataset.reason); }
    else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submitReason(ta.dataset.reason); }
  });
  $("#close-review").addEventListener("click", closeReview);
  $("#comment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#comment-input").value.trim(); if (!text) return;
    state.comments.push({ id: ++state.seq, fieldId: null, kind: "note", text, at: now() });
    $("#comment-input").value = ""; renderRail(); announce("Comment posted.");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector("dialog[open]")) return; // dialogs handle their own Esc
    if (view === "inbox" && !panel.hidden) closePanel();
    else if (view === "profile" && state.wfOpen && wf.contains(document.activeElement)) setWorkflow(false);
  });
  $("#toast-view").addEventListener("click", () => {
    toast.hidden = true;
    if (view === "profile") openReview('[data-action="wf-view"]'); // read-only Review DCR
    else openPanel();
  });
  $("#toast-close").addEventListener("click", () => {
    toast.hidden = true;
    (view === "inbox" ? $("#task-table") : toast.classList.contains("toast--suggested") ? $("#val-mode") : ($('#wf-list [data-action="wf-view"]') || $("#profile-main"))).focus();
  });
  document.querySelectorAll(".nav-item").forEach((a) => a.addEventListener("click", (e) => e.preventDefault()));
  $("#reset-demo").addEventListener("click", () => {
    unrejectId = null;
    [xdlg, udlg, cdlg, review].forEach((d) => { if (d.open) d.close(); });
    state = freshState();
    panel.hidden = true; toast.hidden = true;
    renderInbox(); renderFilterForm(); renderWorkflow(); renderMode(); renderGrid();
    (view === "profile" ? $('#wf-list [data-action="wf-review"]') : $("#open-dcr")).focus();
  });

  // ---------- Boot ----------
  $("#user-avatar").textContent = user.initials;
  hydrateIcons();
  renderProfileStatic();
  renderInbox();
  showView(location.hash.slice(1));
})();

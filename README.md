# Review DCR: Working Prototype

A working, clickable prototype of the **Review DCR** experience from my Reltio Workflow case study. It shows the states between "approve" and "reject" that a static mockup can't. In it, a reviewer reads AI confidence signals and their reasoning, rejects a single field with feedback, watches the tally update, and resolves the request.

**Live demo:** https://jyotirmayeedas93-sketch.github.io/reltio-review-dcr-prototype/
**Case study:** [Reltio Workflow: Redesigning Review Experience](https://jyotirmayee-das-portfolio.framer.website/workflow-rework)

> **Branch `interaction-spec`:** this branch builds six decisions from the interaction specification (states, errors, edge cases and behaviour under load for every interaction in the review). They are: Reject always visible (R13), the rejection reason written inline under the row (R14), a Discard confirm when leaving Suggesting or Editing with changes (P6), a typed due date kept in sync with the calendar (P9), a searchable Add attribute picker (R9), and bulk Delete with a confirm and a result snack bar (I4). `main` and the live demo are unchanged.

---

## Try it (about 2 minutes)

1. The reviewer starts on the **entity profile** of Groton-Mystic Falcons. The DCR has already been created, and it waits at the top of the **Workflow** panel with its due date, priority and assignee. Use the chevron to collapse or expand the card. **Due date** can be typed (DD/MM/YYYY) or picked from the calendar icon (arrow keys, Page Up/Down for months, Enter to pick, Esc to close). The two stay in sync: the calendar moves to a typed date once it's complete and real. A date that doesn't exist shows an error, and a past date shows a note. **Priority** offers Low, Medium and High, and the card's priority bar follows. **Assigned to** lists the team, with you selected. **Filter** (in place of Figma's "Add") opens a search plus filters for workflow type, status (open, closed, approved, rejected, sent for resubmission), priority, assignee, due date and created date. Search covers DCR IDs, the attributes and values inside each DCR, people and steps. **Apply** narrows the list, the active filters show as removable chips, and **Clear all** resets them. Only DCRs exist on this profile, so the other workflow types (Potential Match Review, Recommend for Delete, Authoring, RDM DCR Review, Custom) are listed but disabled. The panel's ✕ and the Workflow icon in the right rail close and reopen it.
2. Close the Workflow panel and open the **Viewing** menu in the header. **Show more** on Organization Attributes reveals the profile's other attributes (Website URL, Email, Fax, Founded Year, Ownership, Description), and **Show less** hides them. The **Viewing** menu lists **Viewing**, **Suggesting** and **Editing**. Pick **Suggesting** and the profile becomes editable, as in Figma's Suggest Mode: Name, DBA name and the identifiers become fields, Company Type a dropdown, and nested values (Status, Address, Phone, Identifiers) get a delete icon. **+** adds another value, deleting an original value marks it **Deleted** with an undo, and **More attributes** is shown but not part of this prototype. **Cancel** and **Suggest** appear left of the menu. Suggest stays disabled until something changes. Suggest sends the changes as a data change request (the snack bar confirms it, and the profile itself doesn't change), and Cancel discards them. With changes, Cancel (or switching mode) first asks "Discard 2 changes?", with **Keep editing** as the default. Both return to Viewing. **Editing** works the same way, except that its primary button is **Save**, which applies the changes to the profile straight away (Reset demo restores the original values).
3. Back in Viewing, reopen the Workflow panel (the Workflow icon in the right rail) and click **Review DCR** on the DCR card. It opens the **Review DCR** dialog. Or click **Open in Inbox** next to it: the Inbox opens with the same task's review panel, and the browser's Back button returns to the profile.
4. Click **REJECT** on *Company Type* (always visible, quiet until you hover). A box opens under the row, so the value and its signal stay in view. A reason is required. Click **Reject field** (or press Ctrl/⌘ + Enter); Esc cancels.
5. The row is flagged **Rejected**, the tally updates, and your comment appears in **Comments** with a link back to its field. Hovering the comment highlights its row, and the reverse. To undo, click **Rejected ×**. A confirmation shows the comment that will be deleted. **Remove rejection** removes the rejection and its comment, and **Cancel** keeps both.
6. Tags say who changed what. **Edited**, **Added** and **Deleted** are the requester's changes. When you change a value yourself, for example by picking another *Company Type* or editing *Website*, the row shows **Updated**, and the undo icon takes it back to the requester's value.
7. Click **+** on a row to add another value for that attribute. A new light-grey row (DS Grey/25) appears underneath with an empty dropdown. Values already in the request, such as *Green Corporation*, are greyed out in its menu. The new row has a delete icon instead of +.
8. Click **Add attribute** to search the profile attributes that aren't in this request, grouped by card (type "dba", then Enter), such as *Doing Business As (DBA) Name*. It appears at the top as a light-grey row with its current profile value, ready to edit. It has **+** (add another value) and **delete**, with no undo, since you added it. Editing it shows **Updated**. A multi-value attribute such as *Industry Classification* adds one row per value. Once an attribute is added it leaves the menu, and deleting all of its rows puts it back. While a value is unchanged, an orange note under the box says it won't be sent as a change. The note disappears as soon as you edit it.
9. Values are checked as you edit. Type letters into *Phone* and a red message appears under the box straight away. An incomplete value (for example 3 digits) or an emptied requester value is flagged once you leave the box. Each message disappears once the value is fixed. Approve and Resubmit don't go through while there's an error; they take you to the first one.
10. Use the ⓘ icon on *High Confidence* to see why a field is clear.
11. While a field is rejected, the header **Reject** is disabled and **Approve** becomes **Resubmit** (the DS primary button). Resubmit sends the rejected fields back to the requester with your comments and applies the rest. With no rejections, **Approve** applies everything. Either way the snack bar confirms the result. The Workflow card shows the outcome, and **Review DCR** becomes **View DCR**, which opens the decided request read-only.
12. On the approved request **8kqTMD12**, click **View DCR**. The same overlay opens as **View DCR**, a read-only history:
   - **Rounds:** Submitted → Sent back → Resubmitted → Approved, each showing who, when and how many comments.
   - **Final changes:** each attribute's original and final value. **History** expands the steps it went through, showing reviewer changes as before → after.
   - **Comments:** the 💬 buttons (on a round or a step) highlight those comments in the Comments panel, and each comment links back to its step.
   - On the rejected request **Rw4xLB90**, View DCR is simpler, because a rejection happens in the first review: no rounds, just each attribute's original and requested value (marked **Not applied**) and the reviewer's comment.
   - Your own DCR opens the same way once you've decided it.
13. **Open Inbox** (bottom left) shows the same task from the Inbox: it has gone from the list. After **Reset demo**, the Inbox flow works on its own too: tick row checkboxes (the selection bar then shows icon-only **Reject**, **Approve**, **Delete** and **Archive** with tooltips on hover or focus. **Delete** asks first, since it can't be undone, then a snack bar reports the result. Data change requests can't be deleted, only rejected, so they stay selected. The other bulk actions aren't built yet), open the first task to see the review panel, and use the pencil icon to open the same Review DCR dialog. The panel's **Additional details** tab shows the profile's context without leaving the Inbox: its other attributes, relationships and hierarchy, segments and data quality, plus **Open full profile**. (Figma's Comments tab is gone, because comments live in the Review DCR overlay.)

The whole flow also works with the keyboard alone.

## What it demonstrates

| Case study capability | In the prototype |
|---|---|
| Review in Context | Review starts from the entity profile the reviewer is already on, and the review panel opens over the Inbox so the queue stays visible |
| Decision Support | Original → proposed values, with an AI confidence signal and its reasoning |
| Inline Collaboration | Rejecting a field requires a comment, which is pinned to that field and listed in Comments |
| Continuous Resolution | Only rejected fields go back to the requester; everything else is applied |
| Workflow Visibility | A live tally, comment count, read-only resolved state and snack bar |
| Unified Entry Points | The profile's Workflow panel and the Inbox open the same Review DCR dialog, and a decision in one shows in the other |

### Human–AI interaction principles

- **Advisory, never acting.** Signals point the reviewer to where they should look. They never approve, reject, edit or hide a change.
- **Explain every signal.** Flagged fields always show their reasoning, and High Confidence fields show it behind an info icon.
- **Say "I don't know."** *Not Validated* is shown as its own state, separate from low confidence, so the system never guesses.
- **Proportional friction.** Flagged fields open with their reasoning visible, clear fields stay compact, and every rejection needs a comment.

### Built on a design system

The screens match the Inbox-Redesign Figma file (page "Final end to end workflow": "Profile Page 01 — Reviewer Viewing", "Profile Page 02 — Select suggesting", "Profile Page 04 — Suggest Mode" and frames Inbox-07 to Inbox-12). Each value is bound to the same **Build Design System** token used in Figma. [`design-system/`](design-system/) holds every token from the DS file: 78 primitives, 68 aliases, 42 semantic tokens (light and dark), 31 responsive tokens, 4 accessibility colours, 18 text styles and 300 component tokens. Icons are the DS Material icons, exported from Figma.

Some values on the Figma canvas aren't bound to any token. These include raw font sizes, the amber "Updated" tag and a few greys, and they are collected in one "Figma layer" block in `styles.css`. Where a token's colour is below WCAG AA, the DS's own Accessibility colour is used instead. [`design-system/README.md`](design-system/README.md) lists every case, plus places where the Inbox file uses an old version of the library.

### Accessibility

- Signals and change types use text and icons, never colour alone. All text meets WCAG AA contrast.
- The keyboard path covers every action. Focus moves into the panel when it opens and returns to where you were when it closes. Esc works one layer at a time.
- The required comment can't be submitted empty. Rejections, comments and the snack bar are announced in a polite live region.
- Icon buttons have a 24px minimum hit area. The prototype supports `prefers-reduced-motion`, `forced-colors`, and phone and tablet layouts.

## Run locally

There is no build step and nothing to install. Open `index.html` in a browser.

```
index.html                    page structure: profile (start) and inbox views, Review DCR dialog, comment dialogs, snack bar
styles.css                    styles, built from DS tokens (plus the "Figma layer" of unbound values)
icons.js                      DS Material icons exported from Figma
data.js                       profile cards and Workflow requests, inbox rows, and the DCR: 8 field changes, confidence levels, reasoning copy
app.js                        state, rendering, interactions (vanilla JS)
design-system/tokens.json     every Build Design System token (W3C Design Tokens format)
design-system/tokens.css      generated CSS custom properties
design-system/build-css.mjs   regenerates tokens.css: node design-system/build-css.mjs
```

The UI is always derived from one state object. Tallies and summaries are computed, never stored, so they can't drift out of sync.

## What's real and what's prototype

- **From the Figma design file:** the profile's attribute cards and Workflow requests, the inbox rows, field names, values, change types, confidence levels, the reasoning for flagged fields (Company Type and Tax ID), and the dialog and comment copy.
- **Written for this prototype:** Figma shows only an info icon for *High Confidence* fields, so that reasoning copy was written here. It is marked `draftCopy: true` in `data.js`. The snack bar is the DS Snack Bar, because Figma has no confirmation frame. The "Remove rejection?" confirmation isn't in Figma either. It reuses the comment dialog shell and is built only from DS tokens.
- **Derived, not static:** the confidence summary, tally and comment count are calculated from the data, so they can differ from the static numbers on the Figma canvas.
- **Demo data, not a live model.**
- **Figma copy kept as is, even where frames disagree:** the profile says "Groton-Mystic Falcons / 118C6dGI" while the dialog says "…Ltd / 0KY7eHf", and the Workflow card's creator (vyacheslav.kovyazin) differs from the dialog's (j.rivera@reltio.com). "Assigned to" uses the reviewer's name instead of Figma's placeholder "username.test".
- **View DCR scenarios:** the history of 8kqTMD12 (approved after 4 rounds, 3 attributes, 4 comments) and of Rw4xLB90 (rejected on first review, 2 attributes, 1 comment) were written for this prototype. Its final values match what the profile shows today.
- **Show more attributes:** Website URL and its value are from Figma's Suggest Mode frame. Email, Fax, Founded Year, Ownership and Description are demo data. They also appear in Review DCR's Add attribute menu and in the Inbox's Additional details, except Website URL, which this DCR already changes.
- **Closed workflow requests:** their outcome (approved or rejected), priority, assignee and changed attributes are demo data added for the filters. The cards show Approved/Rejected instead of Figma's "Reviewed", and the header shows the real count (6) instead of Figma's static "18 item".
- **Reviewer-added values and attributes** count as applied changes when you approve or resubmit. Empty values are ignored, and so are added attributes left unchanged from the profile.
- **Suggesting:** sending a suggestion confirms with a snack bar but doesn't add a new request to the Workflow panel. More attributes is shown but not built. Values saved in Editing mode live only in the demo session.
- **Not functional:** the other entity tabs, the nav rail apps, previous/next entity, Show more, the other Workflow requests, paging, filters, search, reassign and previous/next task. They are shown as in Figma but marked as not part of this prototype.

## How it was built

AI-assisted ("vibe-coded") with Claude, working from the case study and the original Figma file.

- I set the scope (one complete flow, no framework, safe to demo offline), the interaction decisions and the review criteria.
- Claude read the Figma files through the Figma MCP connection. It pulled the real field values and copy from the case-study file, and every variable, text style and component binding from the design-system file. It then wrote the HTML/CSS/JS in stages. Each commit in this repo is one of those stages.
- Each stage was checked in a headless browser (Playwright): screenshots, a scripted run-through of the full flow, keyboard-only navigation, a phone viewport and an automated contrast scan of every visible text element.

---

Built by Jyotirmayee Das · prototype, not production code · demo data only

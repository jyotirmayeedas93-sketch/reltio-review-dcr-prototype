# Review DCR: Working Prototype

A working, clickable prototype of the **Review DCR** experience from my Reltio Workflow case study. It shows the states between "approve" and "reject" that a static mockup can't. In it, a reviewer reads AI confidence signals and their reasoning, rejects a single field with feedback, watches the tally update, and resolves the request.

**Live demo:** https://jyotirmayeedas93-sketch.github.io/reltio-review-dcr-prototype/
**Case study:** [Reltio Workflow: Redesigning Review Experience](https://jyotirmayee-das-portfolio.framer.website/workflow-rework)

---

## Try it (about 90 seconds)

1. Open the **Groton-Mystic Falcons Ltd** task in the Inbox.
2. In the summary strip, click **1 needs review** to jump to *Company Type*. Read the reasoning, then open **How this works**.
3. Hover over *Company Type* and click **Reject**. Try submitting without a comment, then add one.
4. Watch the tally change to `5 Updated · 3 Added · 1 Deleted · 1 Rejected`. Try **Unreject** and **Undo last edit**.
5. Click **Approve**. The task leaves the Inbox, and a snack bar confirms *9 changes applied, 1 rejected*.
6. Click **View task** to see the resolved request, read-only. **Reset demo** (top bar) starts over.

The whole flow also works with the keyboard alone.

## What it demonstrates

| Case study capability | In the prototype |
|---|---|
| Review in Context | The review panel opens over the Inbox, so the queue stays visible |
| Decision Support | Each field shows original → proposed, with a confidence signal and the reasoning behind it |
| Inline Collaboration | Rejection feedback is required and stays pinned to that field |
| Continuous Resolution | Only the rejected field goes back to the requester; everything else is applied |
| Workflow Visibility | A live tally, undo, a confirmation toast and a read-only resolved state |
| Unified Entry Points | One entry from the Inbox into the same Review DCR experience |

### Human–AI interaction principles

- **Advisory, never acting.** Signals point the reviewer to where they should look. They never approve, reject, edit or hide a change.
- **Explain every signal.** Every badge opens its reasoning, and *How this works* explains what the system checks and what it doesn't.
- **Say "I don't know."** *Not enough signal* is shown as its own state, separate from low confidence, so the system never guesses.
- **Proportional friction.** Flagged fields open with their reasoning visible, while clear fields stay compact.

### Built on a design system

The UI uses the **Build Design System** throughout. [`design-system/`](design-system/) holds every token from that Figma file: 78 primitives, 68 aliases, 42 semantic tokens (light and dark), 31 responsive tokens, 4 accessibility colours and 18 text styles. It also has 300 component tokens derived from the Figma components. `styles.css` contains no raw colour values. Buttons, fields, tabs, the table, pills, the avatar and the snack bar all follow the DS component tokens.

Exporting the tokens also produced an audit of the Figma file. Several semantic colour pairs fall below WCAG AA, for example white on the primary purple at 3.92:1. The prototype swaps in the AA-safe colours the DS already defines in its Accessibility collection. [`design-system/README.md`](design-system/README.md) lists every override and every issue found.

### Accessibility

- Signals and change types use text and icons, never colour alone. All text meets WCAG AA contrast.
- The keyboard path covers every action. Focus moves into the panel when it opens and returns to where you were when it closes. Esc works one layer at a time.
- Form errors appear inline with `aria-invalid`. Tally changes and the toast are announced in a polite live region.
- The small confidence pills have a 24px hit area. The prototype supports `prefers-reduced-motion`, `forced-colors`, and phone and tablet layouts.

## Run locally

There is no build step and nothing to install. Open `index.html` in a browser.

```
index.html                    page structure, dialogs, snack bar
styles.css                    prototype styles, built only from DS tokens (plus a small app layer)
data.js                       the DCR: 10 field changes, confidence levels, reasoning copy
app.js                        state, rendering, interactions (vanilla JS)
design-system/tokens.json     every Build Design System token (W3C Design Tokens format)
design-system/tokens.css      generated CSS custom properties
design-system/build-css.mjs   regenerates tokens.css: node design-system/build-css.mjs
```

The UI is always derived from one state object. Tallies and summaries are computed, never stored, so they can't drift out of sync.

## What's real and what's prototype

- **From the Figma design file:** field names, values, change types, confidence levels, the summary strip, the reasoning for flagged fields (Company Type, Tax ID, Industry) and the confirmation copy. All visual styling comes from the Build Design System Figma file.
- **Written for this prototype:** the Figma file shows reasoning for *High confidence* fields only in a collapsed state, so that copy was written here. It is marked `draftCopy: true` in `data.js`.
- **Demo data, not a live model:** the prototype says this in the *How this works* dialog too.
- **Matches the shipped design:** rejection is per field, while approval applies to the whole request.
- **Out of scope:** in-flight editing of proposed values (the Edit DCR modal), the comment thread, attribute grouping and Advanced Search.

## How it was built

AI-assisted ("vibe-coded") with Claude, working from the case study and the original Figma file.

- I set the scope (one complete flow, no framework, safe to demo offline), the interaction decisions and the review criteria.
- Claude read the Figma files through the Figma MCP connection. It pulled the real field values and copy from the case-study file, and every variable, text style and component binding from the design-system file. It then wrote the HTML/CSS/JS in stages. Each commit in this repo is one of those stages.
- Each stage was checked in a headless browser (Playwright): screenshots, a scripted run-through of the full flow, keyboard-only navigation, a phone viewport and an automated contrast scan of every visible text element.

---

Built by Jyotirmayee Das · prototype, not production code · demo data only

/*
 * Demo data, taken from the Inbox-Redesign Figma file, page
 * "Final end to end workflow" (frames Inbox-07, Inbox-08, Inbox-09 … 12).
 *
 * Reasoning for "High Confidence" fields is not shown in Figma (only an
 * info icon), so that copy was written for this prototype: draftCopy: true.
 */
window.DEMO = {
  user: { initials: "PH", reviewer: "alexander.kirsanov" },

  dcr: {
    dcrId: "3nfvPH35",
    entityName: "Groton-Mystic Falcons Ltd",
    entityInitials: "GM",
    entityType: "Organisation",
    entityId: "0KY7eHf",
    createdBy: "j.rivera@reltio.com",
    createdOn: "Jan 13, 2025",
    step: "DCR Review",
  },

  // Clip 2 (interaction spec): "Simulate → Profile merged". The profile was merged into another one
  // after the DCR was created. changed: rows whose CURRENT value is different on the merged profile;
  // done: rows whose suggested value the merged profile already has.
  merge: {
    into: { name: "Groton-Mystic Falcons Inc", id: "0LM2a9X" },
    by: "A. Rao",
    on: "Jan 24, 2025",
    changed: { companyType: "General Partnership", employees: "285" },
    done: ["city"],
  },

  // change (what the REQUESTER did): "added" | "edited" | "deleted".
  // "Updated" is never in the data: it marks a value the REVIEWER changed in Review DCR.
  // confidence: "high" | "review" | "notvalidated"
  // options: present when the value is picked from a list. Option lists are from the
  // open state of the "Company Type value (editable)" dropdowns in Figma (DS Menu).
  fields: [
    { id: "companyType", label: "Company Type", change: "added", original: "Limited Liability Company (LLC)", proposed: "Green Corporation",
      options: ["Limited Liability Company (LLC)", "Green Corporation", "Public Limited Company (PLC)", "Social Enterprise", "Cooperative Association", "Nonprofit Corporation"],
      confidence: "review",
      reasoning: 'Legal entity type change from LLC to Corporation. No registry match found for "Green Corporation" at this address. Confirm with the requester before approving.' },
    { id: "phone", label: "Phone", change: "added", original: null, proposed: "+1 860 555 0148", confidence: "high",
      reasoning: "Valid US number. The 860 area code matches the Groton, CT address on this record.", draftCopy: true },
    { id: "taxId", label: "Tax ID", change: "deleted", original: "06-1234567", proposed: null, confidence: "notvalidated",
      reasoning: "Deletion of a regulated identifier. No external reference available to validate whether removal is intended." },
    { id: "address", label: "Address Line 1", change: "edited", original: "12 Mystic Avenue", proposed: "120 Mystic Avenue", confidence: "high",
      reasoning: "Matches a standardised postal address for Groton, CT.", draftCopy: true },
    { id: "city", label: "City", change: "added", original: null, proposed: "Groton", confidence: "high",
      reasoning: "Consistent with the address and phone area code on this record.", draftCopy: true },
    { id: "country", label: "Country", change: "edited", original: "US", proposed: "United States",
      options: ["Canada", "United States", "Mexico", "Brazil", "United Kingdom", "Germany"], confidence: "high",
      reasoning: "Same country written in full. No change in meaning.", draftCopy: true },
    { id: "website", label: "Website", change: "edited", original: "groton-falcons.com", proposed: "groton-mystic-falcons.com", confidence: "high",
      reasoning: "New domain matches the updated legal name.", draftCopy: true },
    { id: "employees", label: "Employee Count", change: "edited", original: "240", proposed: "310", confidence: "high",
      reasoning: "Within the typical year-on-year range for an organisation of this size.", draftCopy: true },
  ],

  // Inbox rows (Inbox-07). The first row is the DCR that opens the review panel.
  // [task type, entity, extra entities, priority, created by, created on, status, due date]
  tasks: [
    ["Data Change Request Review", "Groton Mystic F...", 2, "High", "Vyacheslav.kovy...", "Jan 15, 2025 2:18 PM", "In Review", "Feb 14, 2025"],
    ["Potential Match Review", "Acme Corporation", 2, "High", "Sarah Mitchell", "Jan 15, 2025 3:42 PM", "Open", "Feb 15, 2025"],
    ["Authoring", "GlobalTech Inc", 0, "Medium", "James Carter", "Jan 15, 2025 11:30 AM", "Pending Approval", "Feb 10, 2025"],
    ["RDM Data Change Request Review", "Product SKU-4502", 1, "Medium", "Sarah Mitchell", "Jan 14, 2025 4:55 PM", "Completed", "Feb 8, 2025"],
    ["Recommend for Delete", "John D. Williams", 1, "High", "David Kowalski", "Jan 14, 2025 3:20 PM", "Open", "Feb 5, 2025"],
    ["Data Change Request Review", "Santa Barbara Cotta...", 0, "High", "Sarah Mitchell", "Jan 13, 2025 11:16 PM", "In Review", "Jan 31, 2025"],
    ["Potential Match Review", "Person A", 3, "Medium", "James Carter", "Jan 13, 2025 9:45 PM", "Open", "Jan 31, 2025"],
    ["Data Change Request Review", "222 E 80th St Apt 1...", 0, "High", "Sarah Mitchell", "Jan 13, 2025 8:30 PM", "Pending Approval", "Jan 31, 2025"],
    ["RDM Data Change Request Review", "MedDevice X100", 0, "Medium", "Emily Nguyen", "Jan 13, 2025 6:12 PM", "Completed", "Jan 31, 2025"],
    ["Authoring", "Nexus Healthcare", 0, "Medium", "James Carter", "Jan 13, 2025 4:05 PM", "Rejected", "Jan 31, 2025"],
    ["Recommend for Delete", "145 W 4th St Ste 10...", 0, "Low", "Sarah Mitchell", "Jan 12, 2025 2:33 PM", "Open", "Jan 28, 2025"],
    ["Data Change Request Review", "Person B", 0, "Medium", "Sarah Mitchell", "Jan 12, 2025 11:50 AM", "In Review", "Jan 28, 2025"],
    ["Potential Match Review", "Calle 6 Munoz River...", 0, "High", "David Kowalski", "Jan 11, 2025 5:18 PM", "Inactive", "Jan 28, 2025"],
    ["Authoring", "Bright Pharma Ltd", 0, "Medium", "James Carter", "Jan 10, 2025 3:40 PM", "Open", "Jan 25, 2025"],
    ["Data Change Request Review", "28426 Tomball P...", 1, "Medium", "Sarah Mitchell", "Jan 9, 2025 1:22 PM", "Pending Approval", "Jan 25, 2025"],
    ["RDM Data Change Request Review", "ABC Group", 0, "Low", "Emily Nguyen", "Jan 8, 2025 10:15 AM", "Completed", "Jan 22, 2025"],
    ["Recommend for Delete", "Maria Gonzalez", 0, "Medium", "David Kowalski", "Jan 7, 2025 8:48 AM", "Open", "Jan 20, 2025"],
    ["Potential Match Review", "Summit Industries", 0, "High", "Sarah Mitchell", "Jan 6, 2025 4:30 PM", "In Review", "Jan 20, 2025"],
    ["Data Change Request Review", "1200 Park Ave, Bldg...", 2, "Medium", "James Carter", "Jan 3, 2025 2:10 PM", "Rejected", "Jan 18, 2025"],
    ["Authoring", "DataCore Systems", 0, "Medium", "Emily Nguyen", "Dec 28, 2024 9:25 AM", "Open", "Jan 15, 2025"],
    ["RDM Data Change Request Review", "Omega Biotech", 0, "Low", "Sarah Mitchell", "Dec 22, 2024 11:40 AM", "Pending Approval", "Jan 12, 2025"],
    ["Recommend for Delete", "Robert Chen", 0, "High", "David Kowalski", "Dec 18, 2024 3:55 PM", "Completed", "Jan 10, 2025"],
    ["Potential Match Review", "Vertex Analytics", 0, "Medium", "James Carter", "Oct 21, 2024 12:42 PM", "Open", "Jan 5, 2025"],
    ["Data Change Request Review", "Vanguard Holdings", 0, "Low", "Emily Nguyen", "Sep 15, 2024 10:08 AM", "In Review", "Dec 30, 2024"],
    ["Authoring", "ABC Group", 0, "Medium", "James Carter", "Jun 27, 2024 12:12 PM", "Inactive", "Dec 15, 2024"],
  ],
  totalTasks: 100,

  // Entity profile where the reviewer starts (Figma: "Profile Page 01 — Reviewer Viewing",
  // node 1752:18350). The DCR above was already created; it waits in the Workflow panel.
  profile: {
    entityName: "Groton-Mystic Falcons",
    entityId: "118C6dGI",
    searchResults: "68,441 Search results",
    tabs: ["Profile", "Relationships", "Graph", "Potential matches", "Interactions", "Sources", "Activity log"],
    // Profile attributes that the DCR already changes (so "Add attribute" in Review DCR leaves them out).
    // Address Line 1, City and Country are parts of Address; Employee Count lives in Employee Details.
    inDcr: { "Company Type": "companyType", "Address": "address", "Phone": "phone", "Tax ID": "taxId", "Employee Details": "employees", "Website URL": "website" },
    // Header mode menu (Figma: "Profile Page 02 — Select suggesting", 1856:35664). Suggesting makes the
    // cards marked suggest: true editable (Figma: "Profile Page 04 — Suggest Mode", 830:22529).
    // Editing works the same way, but Save applies the changes to the profile straight away.
    modes: [
      { id: "viewing", label: "Viewing", icon: "visibility" },
      { id: "suggesting", label: "Suggesting", icon: "rate_review" },
      { id: "editing", label: "Editing", icon: "mode" },
    ],
    // Cards in the three Figma columns. Attribute: [label, count, values[], expandable]
    columns: [
      [
        { title: "Organization Attributes", suggest: true, attrs: [
          ["Status Information", 0, ["Operating"], true],
          ["Name", 1, ["Groton-Mystic Falcons"], false, true],
          ["Doing Business As (DBA) Name", 0, ["Groton Mystic Falcons Youth Football League Inc"], false, true],
          ["Company Type", 0, ["Limited Liability Company (LLC)"], false, true],
          ["Address", 0, ["PO Box 760, Groton, CT, 06340-0760, United States   ·   Business, Shipping"], true],
          ["Phone", 0, ["(327) 938-6007 - Business Phone - VALID"], true],
        ],
        // Behind "Show more". Website URL (+1) and its value are from Figma 830:22529; the rest is demo data.
        more: [
          ["Website URL", 1, ["https://www.grotonmysticfalcons.com"], false, true],
          ["Email", 0, ["info@grotonmysticfalcons.com"], false, true],
          ["Fax", 0, ["(860) 445-2211"], false, true],
          ["Founded Year", 0, ["2004"], false, true],
          ["Ownership", 0, ["Private"], false, true],
          ["Description", 0, ["Youth football league for ages 7–14 in Groton and Mystic, Connecticut"], false, true],
        ] },
        { title: "Data Enrichment Attributes", attrs: [
          ["Verification", 1, ["Enriched by ZoomInfo"], true],
          ["Industry Classification", 0, ["Sic2 - 79", "Sic3 - 794", "Sic4 - 7941", "Naics2 - 71", "Naics4 - 7112", "Naics6 - 711211", "Primary Industry - Hospitality", "Primary Sub-industry - Sports Teams & Leagues"], true],
          ["Employee Details", 0, ["Employees: 17"], true],
          ["Key Financial Figures Overview", 0, [], true],
        ] },
      ],
      [
        { title: "Identifiers", suggest: true, attrs: [
          ["Data Provider Organization ID", 0, ["2069885596"], false, true],
          ["Tax ID", 1, ["22277882032423"], false, true],
          ["Identifiers", 0, ["Salesforce Identifier", "ZoomInfo ID - 2069885596"], true],
        ] },
        { title: "Associated Organization Details", suggest: true, empty: "No data found" },
        { title: "D&B Hierarchy", action: true, dateField: true, tree: [["Groton-Mystic Falcons", 1, ["VINTAGE HIFI INC."]]] },
      ],
      [
        { title: "Segments", action: true, table: { head: ["Name", "Last refreshed on", "Audience"], rows: [["Orgs Ty…", "01/09/2025 19:37", "14"], ["ZoomInf…", "01/09/2025 19:37", "4"]] /* truncated in Figma */, range: "1-2 of 2" } },
        { title: "Potential Matches", empty: "No matches found" },
        { title: "Data Validation Warnings", action: true, empty: "No Data Validations Violated" },
        { title: "Organisation Hierarchy", action: true, dateField: true },
      ],
    ],
    // Workflow panel (Figma: Workflow Panel). The first request is the DCR reviewed in this prototype.
    workflow: {
      total: 18,
      open: { createdBy: "vyacheslav.kovyazin", createdOn: "13/01/2025", step: "DCR Review", due: "31/01/2026",
              form: { dueDate: "05/02/2026", priority: "High", assignedTo: "alexander.kirsanov" } },
      priorities: ["Low", "Medium", "High"],
      // People the task can be assigned to (the current reviewer first; others are the team on this profile)
      users: ["alexander.kirsanov", "anita.raghavan", "david.okonkwo", "sofia.marchetti", "thomas.bergstrom", "priya.venkatesan"],
      // Closed requests (IDs, creators, dates and steps from Figma). Outcome, priority, assignee and the
      // attributes each one changed are demo data, added so the Workflow filters have something to match.
      reviewed: [
        { id: "8kqTMD12", by: "anita.raghavan",   on: "24/11/2024", step: "DCR Review",      due: "03/12/2024", outcome: "approved", priority: "Medium", assignee: "alexander.kirsanov", attrs: ["Phone", "Address Line 1", "Postal Code", "(327) 938-6007", "PO Box 760", "06340-0760"] },
        { id: "Rw4xLB90", by: "david.okonkwo",    on: "24/11/2024", step: "Data Validation", due: "03/12/2024", outcome: "rejected", priority: "High",   assignee: "alexander.kirsanov", attrs: ["Tax ID", "Status Information", "06-1234567", "Inactive"] },
        { id: "7pZmQC48", by: "sofia.marchetti",  on: "24/11/2024", step: "DCR Review",      due: "03/12/2024", outcome: "approved", priority: "Low",    assignee: "anita.raghavan",     attrs: ["Website", "Employee Count"] },
        { id: "Jd2vNH67", by: "thomas.bergstrom", on: "24/11/2024", step: "Approval",        due: "03/12/2024", outcome: "approved", priority: "Medium", assignee: "david.okonkwo",      attrs: ["Company Type"] },
        { id: "Yx9bKF23", by: "priya.venkatesan", on: "01/06/2023", step: "DCR Review",      due: "03/12/2024", outcome: "rejected", priority: "Low",    assignee: "alexander.kirsanov", attrs: ["Name", "Doing Business As (DBA) Name"] },
      ],
      // Workflow types in Reltio (docs.reltio.com: DCR review, Potential Match Review, Recommend for Delete,
      // custom tenant workflows; Authoring and RDM DCR review appear in the Figma Inbox). Only DCRs exist
      // on this profile, so the others are listed but disabled in the filter.
      types: [
        { id: "dcr", label: "Data Change Request Review", enabled: true },
        { id: "pm", label: "Potential Match Review" },
        { id: "rfd", label: "Recommend for Delete" },
        { id: "auth", label: "Authoring" },
        { id: "rdm", label: "RDM Data Change Request Review" },
        { id: "custom", label: "Custom workflows" },
      ],
    },
  },

  // History of a closed DCR, shown in "View DCR" (demo scenario written for this prototype).
  // 8kqTMD12 went back and forth before approval; its final values are what the profile shows today.
  history: {
    // Rejected on first review: no rounds, just what was requested, nothing applied, and the reason.
    "Rw4xLB90": {
      createdBy: "david.okonkwo", createdOn: "24/11/2024", outcome: "rejected",
      stages: [
        { id: "s1", label: "Submitted", by: "david.okonkwo",      role: "Requester", at: "24/11/2024 04:20 PM" },
        { id: "s2", label: "Rejected",  by: "alexander.kirsanov", role: "Reviewer",  at: "25/11/2024 03:15 PM" },
      ],
      fields: [
        { id: "taxId", label: "Tax ID", change: "edited", original: "22277882032423", final: "22277882032423", result: "notapplied",
          steps: [{ stage: "s1", kind: "proposed", value: "06-1234567" }, { stage: "s2", kind: "notapplied", value: "06-1234567", comments: ["r1"] }] },
        { id: "status", label: "Status Information", change: "edited", original: "Operating", final: "Operating", result: "notapplied",
          steps: [{ stage: "s1", kind: "proposed", value: "Inactive" }, { stage: "s2", kind: "notapplied", value: "Inactive", comments: ["r1"] }] },
      ],
      comments: [
        { id: "r1", stage: "s2", field: null, by: "alexander.kirsanov", at: "25/11/2024 03:15 PM", kind: "rejection",
          text: "Rejecting this request. Tax ID 06-1234567 is registered to a different organisation in the IRS EIN lookup, and there's no source showing Groton-Mystic Falcons has stopped operating. Please raise a new request with evidence for both changes." },
      ],
    },
    "8kqTMD12": {
      createdBy: "anita.raghavan", createdOn: "24/11/2024", outcome: "approved",
      stages: [
        { id: "s1", label: "Submitted",             by: "anita.raghavan",     role: "Requester", at: "24/11/2024 09:12 AM" },
        { id: "s2", label: "Sent back for changes", by: "alexander.kirsanov", role: "Reviewer",  at: "25/11/2024 02:40 PM" },
        { id: "s3", label: "Resubmitted",           by: "anita.raghavan",     role: "Requester", at: "26/11/2024 10:05 AM" },
        { id: "s4", label: "Approved",              by: "alexander.kirsanov", role: "Reviewer",  at: "27/11/2024 11:30 AM" },
      ],
      // step.kind: proposed | rejected | updated | resubmitted | approved
      fields: [
        { id: "phone", label: "Phone", change: "edited", original: "(860) 445-2210", final: "(327) 938-6007", result: "applied",
          steps: [
            { stage: "s1", kind: "proposed",    value: "(327) 938-6007" },
            { stage: "s2", kind: "rejected",    value: "(327) 938-6007", comments: ["c1"] },
            { stage: "s3", kind: "resubmitted", value: "(327) 938-6007", comments: ["c2"] },
            { stage: "s4", kind: "approved",    value: "(327) 938-6007" },
          ] },
        { id: "address", label: "Address Line 1", change: "edited", original: "12 Mystic Avenue", final: "PO Box 760", result: "applied", reviewerUpdated: true,
          steps: [
            { stage: "s1", kind: "proposed", value: "P.O. Box 760" },
            { stage: "s2", kind: "updated",  value: "PO Box 760", comments: ["c3"] },
            { stage: "s4", kind: "approved", value: "PO Box 760" },
          ] },
        { id: "postal", label: "Postal Code", change: "edited", original: "06340", final: "06340-0760", result: "applied",
          steps: [
            { stage: "s1", kind: "proposed", value: "06340-0760" },
            { stage: "s4", kind: "approved", value: "06340-0760" },
          ] },
      ],
      comments: [
        { id: "c1", stage: "s2", field: "phone",   by: "alexander.kirsanov", at: "25/11/2024 02:40 PM", kind: "rejection",
          text: "Area code 327 doesn't match Groton, CT (860). Can you confirm this is the club's business line and add the source?" },
        { id: "c3", stage: "s2", field: "address", by: "alexander.kirsanov", at: "25/11/2024 02:42 PM", kind: "note",
          text: "Changed \u201cP.O. Box 760\u201d to the USPS standard \u201cPO Box 760\u201d. No action needed." },
        { id: "c2", stage: "s3", field: "phone",   by: "anita.raghavan",     at: "26/11/2024 10:05 AM", kind: "reply",
          text: "Confirmed with the club office: (327) 938-6007 is their main business line. Source: ZoomInfo, verified 26/11." },
        { id: "c4", stage: "s4", field: null,      by: "alexander.kirsanov", at: "27/11/2024 11:30 AM", kind: "approval",
          text: "Phone verified against ZoomInfo. Approving all three changes." },
      ],
    },
  },
};

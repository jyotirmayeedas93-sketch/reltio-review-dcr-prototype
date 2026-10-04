/*
 * Demo data for the Review DCR prototype.
 *
 * Field names, values, change types, confidence levels and the reasoning copy
 * for flagged fields are taken from the "Inbox-Redesign" Figma file
 * (frame "01 — AI Confidence, Inbox view", node 146:5345).
 *
 * The Figma file shows reasoning only for flagged fields (Needs review /
 * Not enough signal). Reasoning for High-confidence fields is collapsed there,
 * so that copy was written for this prototype and is marked `draftCopy: true`.
 */

window.DEMO = {
  dcr: {
    id: "DCR-0KY7eHf",
    entityName: "Groton-Mystic Falcons Ltd",
    entityType: "Organization",
    entityId: "0KY7eHf",
    createdBy: "j.rivera@reltio.com",
    createdOn: "Jan 13, 11:16 PM",
    dueDate: "Jan 31, 2025",
    priority: "High",
  },

  // change: "updated" | "added" | "deleted"
  // confidence: "high" | "review" | "nosignal"
  fields: [
    {
      id: "name",
      label: "Name",
      change: "updated",
      original: "Groton-Mystic Falcon",
      proposed: "Groton-Mystic Falcons Ltd",
      confidence: "high",
      reasoning: "Adds the legal suffix to the existing name. Formatting-only change; matches the name used on the requester's other submissions.",
      draftCopy: true,
    },
    {
      id: "companyType",
      label: "Company Type",
      change: "updated",
      original: "Limited Liability Company (LLC)",
      proposed: "Green Corporation",
      confidence: "review",
      reasoning: "Legal entity type change. Not verifiable against a registry — confirm with the requester.",
    },
    {
      id: "phone",
      label: "Phone",
      change: "added",
      original: null,
      proposed: "+1 860 555 0148",
      confidence: "high",
      reasoning: "Valid US number. The 860 area code matches the Groton, CT address on this record.",
      draftCopy: true,
    },
    {
      id: "address",
      label: "Address Line 1",
      change: "updated",
      original: "12 Mystic Ave",
      proposed: "120 Mystic Avenue",
      confidence: "high",
      reasoning: "Matches a standardised postal address for Groton, CT. The street number change is consistent with the validated address.",
      draftCopy: true,
    },
    {
      id: "city",
      label: "City",
      change: "added",
      original: null,
      proposed: "Groton",
      confidence: "high",
      reasoning: "Consistent with the address and phone area code on this record.",
      draftCopy: true,
    },
    {
      id: "country",
      label: "Country",
      change: "updated",
      original: "US",
      proposed: "USA",
      confidence: "high",
      reasoning: "Same country, different code format. No change in meaning.",
      draftCopy: true,
    },
    {
      id: "website",
      label: "Website",
      change: "updated",
      original: "groton-falcons.com",
      proposed: "groton-mystic-falcons.com",
      confidence: "high",
      reasoning: "New domain matches the updated legal name.",
      draftCopy: true,
    },
    {
      id: "employees",
      label: "Employee Count",
      change: "updated",
      original: "240",
      proposed: "310",
      confidence: "high",
      reasoning: "Within the typical year-on-year range for an organisation of this size.",
      draftCopy: true,
    },
    {
      id: "taxId",
      label: "Tax ID",
      change: "deleted",
      original: "06-1234567",
      proposed: null,
      confidence: "nosignal",
      reasoning: "Deletion of a regulated identifier. No external reference to validate against.",
    },
    {
      id: "industry",
      label: "Industry",
      change: "added",
      original: null,
      proposed: "Sports & Recreation",
      confidence: "nosignal",
      reasoning: "Free-text classification with no external reference. Your judgment only.",
    },
  ],

  // Other rows in the Inbox (static, from the same Figma frame)
  otherTasks: [
    { type: "Data Change Request Review", entity: "222 E 80th St Apt 1...", more: 1, priority: "High", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Data Change Request Review", entity: "Person A", more: 0, priority: "High", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Data Change Request Review", entity: "145 W 4th St Ste 10...", more: 1, priority: "Medium", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Data Change Request Review", entity: "28426 Tomball Pkw...", more: 1, priority: "Medium", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Data Change Request Review", entity: "Person B", more: 0, priority: "Medium", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Data Change Request Review", entity: "Calle 6 Munoz River...", more: 3, priority: "Medium", by: "person1@reltio.com", on: "Jan 13, 11:16 PM" },
    { type: "Authoring", entity: "ABC Group", more: 0, priority: "Medium", by: "person2@reltio.com", on: "Oct 21, 2024 12:42 PM" },
    { type: "Authoring", entity: "ABC Group", more: 0, priority: "Medium", by: "person2@reltio.com", on: "Jun 27, 2024 12:12 PM" },
  ],
};

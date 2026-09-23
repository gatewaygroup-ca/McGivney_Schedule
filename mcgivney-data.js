/* ============================================================
   McGIVNEY COMMUNITY HOMES — PROJECT DATA
   Extracted from McGivney_Project_Schedule.html (Version 3, rebuilt
   Aug 12, 2026). Dates, statuses, notes, and targets preserved exactly
   as they were in the original static file.
   ============================================================ */

const PROJECT = {
  name: "McGivney Community Homes",
  firebasePath: "mcgivney",           // Firebase Realtime Database root for this project
  contract: "HP 25-17 · NNRFPdb Design-Build",
  purchaser: "McGivney Community Homes Inc.",
  occupancyTarget: "Q1 2027",
  supplier: "Gateway Investment Group Inc.",
  description: "Three pre-1940s single-family homes converting to legal multi-unit dwellings under HP 25-17 design-build contract. Completion targets reflect the August 10 field snapshot with 20% padding applied on remaining days, scheduled around Ontario statutory holidays and the December to January trades shutdown. Myrtle lands first (Dec 15), Emerald in late January 2027, Fairleigh completes early February 2027 with finishing work carrying across the shutdown.",
  fieldNote: "Schedule reflects the August 10, 2026 field snapshot with 20% padding on trade-LOE phases. Paint and other scheduling-bandwidth phases use raw Cory dates directly. Myrtle plumbing, HVAC, windows, and electrical all complete; interior finishes have slipped 1-2 weeks across insulation, drywall, and finishing, but Dec 15 completion holds within padding buffer. Emerald HVAC now in progress; painting is now an 8-week bandwidth window, and kitchen has accelerated 2 weeks. Fairleigh framing extended two weeks and continues in progress; padding buffer largely consumed. All permits released.",
  winterNote: "Emerald and Fairleigh cross the December to January trades shutdown. Emerald finishing work and inspection carry into late January 2027. Fairleigh's finishing, inspection, occupancy, and complete date all land into early February 2027. Myrtle clears the shutdown with a December 15 completion.",
  timelineStart: "2026-03-01",
  timelineEnd: "2027-03-15",
  winterShutdownStart: "2026-12-22",
};

// Ontario statutory holidays, as originally embedded in the file.
const HOLIDAYS = [
  { date: "2026-08-03", name: "Civic Holiday" },
  { date: "2026-09-07", name: "Labour Day" },
  { date: "2026-10-12", name: "Thanksgiving" },
  { date: "2026-11-11", name: "Remembrance Day" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Boxing Day" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-02-15", name: "Family Day" },
];

/*
  Each site: name, addr, type, target, winterRisk, note, and a
  milestones list. Each milestone has its own start/end date, edited
  directly (no dependency-cascade engine — these are independently
  sequenced trade windows, not a chained schedule).
  status: "complete" | "inprog" | "high" | "med" | "low"
  (high/med/low describe scheduling priority/bandwidth for upcoming
  trades, matching the original file's vocabulary exactly.)
*/
const BASELINE_SITES = [
  {
    siteId: "myrtle", name: "29 Myrtle Ave", addr: "29 MYRTLE AVE",
    type: "Duplex/triplex conversion · 2–3 units",
    target: "Dec 15, 2026", winterRisk: false,
    note: "Furthest along of the three sites. Demo, brick, exterior metal, exterior paint, framing, permit, plumbing, HVAC, windows, and electrical all complete. Interior finishes have shifted 1-2 weeks later per the August 10 update — insulation and drywall now late August through early September, painting stretches into late October as a bandwidth window, kitchens and baths mid-October to early November. Inspection and occupancy in December. Completion holds at December 15, 2026 within padding buffer.",
    milestones: [
      { id: 1, task: "Demo", start: "2026-04-07", end: "2026-04-17", status: "complete", notes: "" },
      { id: 2, task: "Brick work", start: "2026-04-13", end: "2026-04-20", status: "complete", notes: "" },
      { id: 3, task: "Exterior Metal", start: "2026-05-12", end: "2026-05-19", status: "complete", notes: "" },
      { id: 4, task: "Framing", start: "2026-05-17", end: "2026-05-27", status: "complete", notes: "" },
      { id: 5, task: "Exterior Paint", start: "2026-05-20", end: "2026-05-25", status: "complete", notes: "" },
      { id: 6, task: "Plumbing", start: "2026-07-05", end: "2026-07-15", status: "complete", notes: "" },
      { id: 7, task: "Permit", start: "2026-07-21", end: "2026-07-27", status: "complete", notes: "" },
      { id: 8, task: "HVAC", start: "2026-07-21", end: "2026-07-30", status: "complete", notes: "" },
      { id: 9, task: "Windows", start: "2026-07-28", end: "2026-08-02", status: "complete", notes: "" },
      { id: 10, task: "Electrical", start: "2026-07-30", end: "2026-08-11", status: "complete", notes: "" },
      { id: 11, task: "Insulation", start: "2026-08-19", end: "2026-08-22", status: "med", notes: "" },
      { id: 12, task: "Drywall/Mud", start: "2026-08-28", end: "2026-09-10", status: "med", notes: "" },
      { id: 13, task: "Painting", start: "2026-09-07", end: "2026-10-23", status: "low", notes: "" },
      { id: 14, task: "Water Proofing", start: "2026-09-08", end: "2026-09-13", status: "high", notes: "" },
      { id: 15, task: "Deck / Porch", start: "2026-09-08", end: "2026-09-13", status: "med", notes: "" },
      { id: 16, task: "Walkway & Grading", start: "2026-09-17", end: "2026-09-30", status: "low", notes: "" },
      { id: 17, task: "Flooring", start: "2026-10-04", end: "2026-10-15", status: "med", notes: "" },
      { id: 18, task: "Kitchens", start: "2026-10-13", end: "2026-11-07", status: "high", notes: "" },
      { id: 19, task: "Bathrooms", start: "2026-10-13", end: "2026-10-30", status: "high", notes: "" },
      { id: 20, task: "Trim & Doors", start: "2026-10-19", end: "2026-11-01", status: "med", notes: "" },
      { id: 21, task: "Final finishing", start: "2026-11-08", end: "2026-11-25", status: "low", notes: "" },
      { id: 22, task: "Inspection", start: "2026-11-29", end: "2026-12-10", status: "med", notes: "" },
      { id: 23, task: "Occupancy", start: "2026-12-09", end: "2026-12-12", status: "low", notes: "" },
      { id: 24, task: "Complete", start: "2026-12-11", end: "2026-12-15", status: "low", notes: "" },
    ],
  },
  {
    siteId: "emerald", name: "132 Emerald St N", addr: "132 EMERALD ST N",
    type: "Duplex/triplex conversion · 2–3 units",
    target: "Jan 22, 2027", winterRisk: true,
    note: "Framing complete July 24; permit released early July. Plumbing rough-in in progress; HVAC in progress. Exterior paint complete. Kitchen and flooring sequences accelerated per the August 10 update. Interior paint is now a bandwidth window running through mid-November. Deck/porch dates corrected. Final finishing and inspection carry across the Dec 22 to Jan 5 trades shutdown, with occupancy targeted January 22, 2027.",
    milestones: [
      { id: 1, task: "Brick work", start: "2026-04-17", end: "2026-04-24", status: "complete", notes: "" },
      { id: 2, task: "Exterior Metal", start: "2026-04-24", end: "2026-05-01", status: "complete", notes: "" },
      { id: 3, task: "Demo", start: "2026-04-28", end: "2026-05-08", status: "complete", notes: "" },
      { id: 4, task: "Framing", start: "2026-07-01", end: "2026-07-25", status: "complete", notes: "" },
      { id: 5, task: "Permit", start: "2026-07-05", end: "2026-07-08", status: "complete", notes: "" },
      { id: 6, task: "Plumbing", start: "2026-07-22", end: "2026-08-19", status: "inprog", notes: "" },
      { id: 7, task: "Exterior Paint", start: "2026-07-28", end: "2026-08-09", status: "complete", notes: "" },
      { id: 8, task: "HVAC", start: "2026-08-06", end: "2026-08-18", status: "inprog", notes: "" },
      { id: 9, task: "Electrical", start: "2026-08-23", end: "2026-08-27", status: "high", notes: "" },
      { id: 10, task: "Insulation", start: "2026-08-31", end: "2026-09-05", status: "med", notes: "" },
      { id: 11, task: "Windows", start: "2026-09-08", end: "2026-09-13", status: "med", notes: "" },
      { id: 12, task: "Walkway & Grading", start: "2026-09-08", end: "2026-10-04", status: "low", notes: "" },
      { id: 13, task: "Deck / Porch", start: "2026-09-14", end: "2026-09-28", status: "med", notes: "" },
      { id: 14, task: "Water Proofing", start: "2026-09-17", end: "2026-09-22", status: "high", notes: "" },
      { id: 15, task: "Drywall/Mud", start: "2026-09-17", end: "2026-09-30", status: "med", notes: "" },
      { id: 16, task: "Painting", start: "2026-09-21", end: "2026-11-16", status: "low", notes: "" },
      { id: 17, task: "Bathrooms", start: "2026-10-14", end: "2026-11-09", status: "high", notes: "" },
      { id: 18, task: "Flooring", start: "2026-10-15", end: "2026-10-27", status: "med", notes: "" },
      { id: 19, task: "Trim & Doors", start: "2026-10-27", end: "2026-11-13", status: "med", notes: "" },
      { id: 20, task: "Kitchens", start: "2026-10-31", end: "2026-11-18", status: "high", notes: "" },
      { id: 21, task: "Final finishing", start: "2026-12-05", end: "2027-01-06", status: "low", notes: "" },
      { id: 22, task: "Inspection", start: "2027-01-06", end: "2027-01-17", status: "med", notes: "" },
      { id: 23, task: "Occupancy", start: "2027-01-18", end: "2027-01-22", status: "low", notes: "" },
    ],
  },
  {
    siteId: "fairleigh", name: "56 Fairleigh Ave N", addr: "56 FAIRLEIGH AVE N",
    type: "Duplex/triplex conversion · 2–3 units",
    target: "Feb 2, 2027", winterRisk: true,
    note: "Longest of the three schedules — stone foundation adds complexity to waterproofing and interior sequencing. Demo, brick, exterior metal, and permit complete. Framing kicked off July 28 and is in progress, with completion pushed two weeks later per the August 10 update; HVAC and interior trades shift accordingly. Finishing work and inspection carry across the trades shutdown. Completion projected February 2, 2027 — padding buffer largely consumed by framing slip, less room for further slippage.",
    milestones: [
      { id: 1, task: "Brick work", start: "2026-04-10", end: "2026-04-17", status: "complete", notes: "" },
      { id: 2, task: "Exterior Metal", start: "2026-04-28", end: "2026-05-05", status: "complete", notes: "" },
      { id: 3, task: "Demo", start: "2026-05-12", end: "2026-05-22", status: "complete", notes: "" },
      { id: 4, task: "Permit", start: "2026-07-07", end: "2026-07-10", status: "complete", notes: "" },
      { id: 5, task: "Framing", start: "2026-07-28", end: "2026-09-02", status: "inprog", notes: "" },
      { id: 6, task: "Exterior Paint", start: "2026-08-13", end: "2026-09-02", status: "low", notes: "" },
      { id: 7, task: "HVAC", start: "2026-09-06", end: "2026-09-20", status: "high", notes: "" },
      { id: 8, task: "Plumbing", start: "2026-09-08", end: "2026-09-22", status: "high", notes: "" },
      { id: 9, task: "Deck / Porch", start: "2026-09-08", end: "2026-09-22", status: "med", notes: "" },
      { id: 10, task: "Water Proofing", start: "2026-09-25", end: "2026-09-30", status: "high", notes: "" },
      { id: 11, task: "Electrical", start: "2026-09-25", end: "2026-09-30", status: "high", notes: "" },
      { id: 12, task: "Walkway & Grading", start: "2026-09-25", end: "2026-10-12", status: "low", notes: "" },
      { id: 13, task: "Insulation", start: "2026-10-04", end: "2026-10-08", status: "med", notes: "" },
      { id: 14, task: "Windows", start: "2026-10-12", end: "2026-10-17", status: "med", notes: "" },
      { id: 15, task: "Drywall/Mud", start: "2026-10-20", end: "2026-11-11", status: "med", notes: "" },
      { id: 16, task: "Painting", start: "2026-10-26", end: "2026-12-04", status: "low", notes: "" },
      { id: 17, task: "Flooring", start: "2026-11-23", end: "2026-12-05", status: "med", notes: "" },
      { id: 18, task: "Kitchens", start: "2026-11-25", end: "2026-12-21", status: "high", notes: "" },
      { id: 19, task: "Bathrooms", start: "2026-11-25", end: "2026-12-12", status: "high", notes: "" },
      { id: 20, task: "Trim & Doors", start: "2026-12-01", end: "2026-12-15", status: "med", notes: "" },
      { id: 21, task: "Final finishing", start: "2026-12-18", end: "2027-01-06", status: "low", notes: "" },
      { id: 22, task: "Inspection", start: "2027-01-06", end: "2027-01-29", status: "med", notes: "" },
      { id: 23, task: "Occupancy", start: "2027-01-28", end: "2027-02-01", status: "low", notes: "" },
      { id: 24, task: "Complete", start: "2027-01-29", end: "2027-02-02", status: "low", notes: "" },
    ],
  },
];

const BASELINE_PHOTOS = []; // Gallery — empty to start, add from the site

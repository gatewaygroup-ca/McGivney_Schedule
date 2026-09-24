/* ============================================================
   GATEWAY PROJECT TEMPLATE — PROJECT DATA
   Blank starting point for a new Gateway project website. Edit the
   3 lines below for each new deployment, then leave everything else
   alone — properties, trades, and their financials are all added
   live from the website itself once it's uploaded.
   ============================================================ */

const PROJECT = {
  name: "New Gateway Project",              // <-- EDIT: shows in the header
  firebasePath: "template",                  // <-- EDIT: must be unique per deployment
                                              //     (e.g. "38-niagara") so this project's
                                              //     data never collides with another
                                              //     project sharing the same Firebase
                                              //     project. Munn uses "schedule",
                                              //     McGivney uses "mcgivney", Kiwanis
                                              //     uses "kiwanis" — pick something new.
  contract: "",                               // <-- EDIT (optional): contract/PO reference
  purchaser: "",                              // <-- EDIT (optional): client/purchaser name
  occupancyTarget: "",                        // <-- EDIT (optional): e.g. "Q2 2027"
  supplier: "Gateway Investment Group Inc.",
  description: "",                            // <-- EDIT (optional): shown under the contract card
  winterNote: "",                             // <-- EDIT (optional): shown as a callout if set
};

// Ontario statutory holidays — edit/add/remove from the site itself
// under "Holidays" once it's live; this is just the starting list.
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
  Nothing pre-seeded below — add properties and trades from the live
  site's "+ Add Property" and "+ Add Trade" buttons once this is
  uploaded and Firebase is connected. No code editing needed for
  day-to-day use; the 3 lines above are the only ones you'll ever need
  to touch, and only once, right after copying this template.
*/
const BASELINE_PROPERTIES = [];
const BASELINE_TRADES = [];
const BASELINE_PHOTOS = [];

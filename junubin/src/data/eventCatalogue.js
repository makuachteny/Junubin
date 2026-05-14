// Static filter option lists for the Events screen. Cities are the
// initial launch markets; categories are the product taxonomy. Real
// Event rows come from the DB — this file is the UI's dropdown menu
// for filtering, not a seed of fake events.
//
// Add a city when you launch in a new market; add a category only
// after the operator-facing event-creation flow knows what to do with
// it. The 'All' entry is the "no filter" sentinel both lists carry.

export const EVENT_CITIES = [
  'All',
  'Juba',
  'London',
  'Minneapolis',
  'Nairobi',
  'Sydney',
  'Toronto',
  'Dallas',
];

export const EVENT_CATEGORIES = [
  'All',
  'Social',
  'Dating',
  'Diaspora',
  'Cultural',
  'Sports',
  'Arts',
];

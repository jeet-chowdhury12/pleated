/* ==========================================================================
   PRODUCTS.JS
   This is the ONLY file you need to touch to add, edit, or remove products.
   The shop page (shop.html) reads this file and builds the grid, filters,
   and pagination automatically. You never have to touch shop.html itself.
   ========================================================================== */


/* --------------------------------------------------------------------------
   STEP 1 — YOUR CATEGORIES
   These are the buttons customers click to sort the shop ("Outerwear",
   "Denim", etc). "value" must be lowercase with no spaces — that's the ID
   a product points to. "label" is what shows on the button.

   To add a new category: add a new { value: '...', label: '...' } line.
   To rename one: just change the "label" — leave "value" alone, since
   your products refer to it by value.
   -------------------------------------------------------------------------- */
const CATEGORIES = [
  { value: 'all',         label: 'All' },
  { value: 'knitwear',    label: 'Knitwear' },
  { value: 'outerwear',   label: 'Outerwear' },
  { value: 'trousers',    label: 'Trousers' },
  { value: 'shirts',      label: 'Shirts' },
];

const PRODUCTS = [
  {
    id: 'p1', code: 'BFSP', category: 'knitwear',
    name: 'Brown Full Sleeve Polo',
    price: 1499,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Brown knitted full sleeve polo',
    details: 'Regular fit, long sleeves, ribbed hem and cuffs, 380 GSM. Made from 80% Acrylic and 20% Nylon.',
  },
  {
    id: 'p2', code: 'WFSP', category: 'knitwear',
    name: 'Off White Full Sleeve Polo',
    price: 1499,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Off-white knitted full sleeve polo',
    details: 'Heavy gauge knit with structured collar and ribbed cuffs. High-density textile weave tailored for lasting structure.',
  },
  {
    id: 'p3', code: 'PL-003', category: 'outerwear',
    name: 'Vintage Workwear Chore Coat',
    price: 2450,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Vintage duck canvas chore coat',
    details: 'Built from 12oz rugged duck canvas with triple-needle reinforced seams and vintage brass shanks.',
  },
  {
    id: 'p4', code: 'PL-004', category: 'trousers',
    name: 'Pleated Selvedge Trousers',
    price: 1950,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Pleated selvedge twill trousers',
    details: 'Double forward pleats, high rise, relaxed tapered leg, and sturdy pocket bags built from selvedge cotton twill.',
  },
  {
    id: 'p5', code: 'PL-005', category: 'knitwear',
    name: 'French Sailor Breton Knit',
    price: 1750,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Nautical striped sailor knitwear',
    details: 'Heavy maritime interlock knit with classic horizontal nautical stripes. Boatneck silhouette inspired by 1950s French naval garments.',
  },
  {
    id: 'p6', code: 'PL-006', category: 'shirts',
    name: 'Heavy Indigo Denim Overshirt',
    price: 2100,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Indigo denim overshirt',
    details: 'Rope-dyed 10.5oz indigo twill featuring twin flap workwear pockets and horn buttons.',
  },
  {
    id: 'p7', code: 'PL-007', category: 'trousers',
    name: '1940s Field Utility Cargo Pants',
    price: 2200,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Military utility cargo pants',
    details: 'Heavy military herringbone twill with expandable cargo bellows pockets and reinforced seat patch.',
  },
  {
    id: 'p8', code: 'PL-008', category: 'outerwear',
    name: 'Herringbone Tweed Overcoat',
    price: 3600,
    images: ['https://occlbnyyhnrslteklqgm.supabase.co/storage/v1/object/public/pleated-assets/logo.jpg'],
    alt: 'Wool herringbone tweed overcoat',
    details: 'Tailored from 100% heavy wool herringbone tweed. Raglan shoulder construction and horn buttons.',
  }
];


/* --------------------------------------------------------------------------
   STEP 3 — ADDING YOUR OWN PHOTOS
   1. Put your product photo inside the /images folder next to this file.
      Square photos (like 1000x1000px) look best in the tag layout.
   2. Give the file a simple name with no spaces, e.g. foreman-jacket.jpg
   3. In your product entry above, set:
        image: 'images/foreman-jacket.jpg'
   4. Refresh the page — that's it, no other code changes needed.

   You do NOT need to resize images perfectly by hand — the site crops
   them to a neat square automatically. Keep file sizes reasonably small
   (under ~500KB per photo) so the shop stays fast to load.
   -------------------------------------------------------------------------- */


/* --------------------------------------------------------------------------
   You shouldn't need to touch anything below this line — it's just the
   fallback line-art used when a product has no photo yet.
   -------------------------------------------------------------------------- */
const GARMENT_ART = {
  jacket: `<svg viewBox="0 0 120 120" fill="none"><path d="M35 30 L48 20 L60 27 L72 20 L85 30 L85 40 L78 44 L78 100 L42 100 L42 44 L35 40 Z" fill="none" stroke="#2B2620" stroke-width="3"/><line x1="60" y1="35" x2="60" y2="96" stroke="#2B2620" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="60" cy="50" r="2" fill="#351E10"/><circle cx="60" cy="64" r="2" fill="#351E10"/><circle cx="60" cy="78" r="2" fill="#351E10"/></svg>`,
  trouser: `<svg viewBox="0 0 120 120" fill="none"><path d="M42 20 L78 20 L80 100 L66 100 L60 55 L54 100 L40 100 Z" fill="none" stroke="#2B2620" stroke-width="3"/><line x1="42" y1="30" x2="78" y2="30" stroke="#2B2620" stroke-width="1.5"/><circle cx="52" cy="26" r="1.8" fill="#351E10"/><circle cx="68" cy="26" r="1.8" fill="#351E10"/></svg>`,
  shirt: `<svg viewBox="0 0 120 120" fill="none"><path d="M40 32 L52 24 L60 30 L68 24 L80 32 L80 42 L72 46 L72 96 L48 96 L48 46 L40 42 Z" fill="none" stroke="#2B2620" stroke-width="3"/><line x1="60" y1="38" x2="60" y2="92" stroke="#2B2620" stroke-width="1.4" stroke-dasharray="2 3"/><path d="M52 24 L60 40 L68 24" stroke="#2B2620" stroke-width="2" fill="none"/></svg>`,
  henley: `<svg viewBox="0 0 120 120" fill="none"><path d="M42 34 L54 24 L66 24 L78 34 L78 44 L70 48 L70 98 L50 98 L50 48 L42 44 Z" fill="none" stroke="#2B2620" stroke-width="3"/><line x1="54" y1="30" x2="54" y2="46" stroke="#2B2620" stroke-width="1.6"/><circle cx="54" cy="36" r="1.6" fill="#351E10"/><circle cx="54" cy="42" r="1.6" fill="#351E10"/></svg>`,
  coat: `<svg viewBox="0 0 120 120" fill="none"><path d="M32 28 L48 18 L60 26 L72 18 L88 28 L88 42 L80 46 L80 102 L40 102 L40 46 L32 42 Z" fill="none" stroke="#2B2620" stroke-width="3"/><path d="M40 46 L28 60 L28 90" stroke="#2B2620" stroke-width="2.5" fill="none"/><path d="M80 46 L92 60 L92 90" stroke="#2B2620" stroke-width="2.5" fill="none"/><line x1="60" y1="34" x2="60" y2="98" stroke="#2B2620" stroke-width="1.4" stroke-dasharray="2 4"/></svg>`,
  belt: `<svg viewBox="0 0 120 120" fill="none"><rect x="20" y="52" width="60" height="16" fill="none" stroke="#2B2620" stroke-width="3"/><rect x="80" y="50" width="16" height="20" fill="none" stroke="#351E10" stroke-width="2.5"/><circle cx="35" cy="60" r="1.6" fill="#2B2620"/><circle cx="47" cy="60" r="1.6" fill="#2B2620"/><circle cx="59" cy="60" r="1.6" fill="#2B2620"/></svg>`,
  boot: `<svg viewBox="0 0 120 120" fill="none"><path d="M46 24 L74 24 L74 66 L96 66 L96 84 L34 84 L34 66 L46 66 Z" fill="none" stroke="#2B2620" stroke-width="3"/><line x1="46" y1="34" x2="74" y2="34" stroke="#2B2620" stroke-width="1.6"/><line x1="46" y1="44" x2="74" y2="44" stroke="#2B2620" stroke-width="1.6"/><line x1="46" y1="54" x2="74" y2="54" stroke="#2B2620" stroke-width="1.6"/><path d="M34 84 L96 84 L92 92 L38 92 Z" fill="#351E10" stroke="#2B2620" stroke-width="2"/></svg>`,
  cap: `<svg viewBox="0 0 120 120" fill="none"><path d="M32 62 a28 28 0 0 1 56 0 Z" fill="none" stroke="#2B2620" stroke-width="3"/><path d="M32 62 L20 68 L60 68 Z" fill="none" stroke="#351E10" stroke-width="2.5"/><line x1="34" y1="48" x2="80" y2="48" stroke="#2B2620" stroke-width="1.4" stroke-dasharray="2 3"/></svg>`,
  default: `<svg viewBox="0 0 120 120" fill="none"><rect x="30" y="24" width="60" height="76" fill="none" stroke="#2B2620" stroke-width="3"/><path d="M30 40 L90 40" stroke="#2B2620" stroke-width="1.4" stroke-dasharray="2 4"/></svg>`,
};

# EGG MOCKTAIL – Simple Web Tech Version (no database, no API)

Plain **HTML + CSS + JavaScript**. No Python, no Flask, no SQLite, no Google Maps key, no installation.

## How to run
1. Extract the ZIP (right-click -> Extract All).
2. Double-click **index.html**. The whole website opens in your browser. That is all.

## Folder
```
egg_mocktail_static/
  index.html        <- open this file
  css/style.css     all styles (website + admin)
  js/data.js        settings, menu, prices, admin login (edit this to change things)
  js/app.js         all the working code (cart, checkout, orders, admin)
  images/           category pictures
```

## Every page and button (all inside index.html, no reload)
| Page | What works |
|---|---|
| Home | Menu tiles, Must-Try Starters with Add / + / -, How to Order, map, WhatsApp, Call, Directions |
| About, Contact | Call Now, WhatsApp, Get Directions, View on Google Maps, social icons, delivery charge boxes |
| Menu | Search box, category chips, Add / + / - on all 95 dishes |
| Cart (yellow "Order Now" button) | Side panel, quantity + / -, Clear order, subtotal, Checkout, Call to order |
| Checkout | Delivery or Pickup, name and phone checks, **delivery charge worked out automatically from your distance to the shop**, address, notes, payment choice, live bill, Place order |
| Order page | Order ID, itemised bill, **Send order on WhatsApp**, Cancel (while Pending), Print / save bill |
| Admin (footer link "Admin", or `index.html#/admin`) | Login, summary cards, search + status + date filters, order details, change status, mark Paid/Unpaid/Refunded, customers list and history, audit log, transactions, CSV download, logout |

## Admin login
Username `admin`, password `egg@12345`. **Change it** in `js/data.js` (the `"admin"` block at the bottom).

## What replaced the database and the APIs
* **Database -> browser storage (localStorage).** The cart and orders are saved in the browser, so a refresh or closing the tab does not lose them. Orders are visible in the admin page of the **same browser/computer** that placed them. Use "Download orders (CSV)" for a backup. Clearing browser data erases them.
* **Google Maps distance API -> live location + straight-line distance (v4).** At checkout the browser asks for the customer's current location and the delivery charge is decided from the distance between that location and the shop:
  * Inside Vijayanagar 4th Stage (within `zone_radius_km`, default 1.5 km) = **Rs 25**
  * Outside it, up to 6 km = **Rs 50**
  * Above 6 km = **Rs 70**
  The three options are shown as a locked rate card with the matching one highlighted, plus an animated distance meter. If the customer blocks location (or the browser cannot share it) the three options unlock so they can still order by choosing manually; that order is marked "chosen manually" in WhatsApp and admin so the shop can verify. The order also stores the distance, and the WhatsApp message and admin order page include the distance and a Google Maps link to the customer's location.
* **WhatsApp**: still a normal `wa.me` link with the full order text. WhatsApp only opens; the shop receives it after the customer presses Send.
* The contact-page map is a normal embedded Google map (needs internet, no key). Fonts also need internet, otherwise a system font is used.

## Change things later (edit `js/data.js`, save, refresh the browser)
* Phone, WhatsApp number, address, social links: `"restaurant"` and `"social"`
* Delivery prices and distances: `"delivery"` (`zone_radius_km`, `zone_charge`, `within_km_charge`, `above_km_charge`, `within_km_limit`)
* Menu items and prices: `"menu"` (each item has `id`, `name`, `price`; keep `id` unique)
* Shop map pin: `"location"` latitude/longitude, then set `location_confirmed` to `true`
* Pictures: replace files in `images/`

## Dark and light theme (v4)
* The sun/moon button in the header (and in the admin bar) switches theme with a circular reveal animation. The choice is remembered; the first time, the site follows the device's light/dark setting.
* All colours live in CSS variables at the top of `css/style.css` (`:root` = dark, `[data-theme="light"]` = light).
* Animations: page and hero entrance, staggered scroll reveals, sliding nav underline, scroll progress bar, button ripples, add-to-cart fly animation, cart drawer with dim backdrop, radar/distance meter on checkout. All of them are switched off automatically for people who use "reduce motion".

## Honest notes
* **Shop pin:** the distance is measured from the pin in `js/data.js` -> `"location"`. It is still the old placeholder near Marimallapa School, so please put the exact shop latitude/longitude there (and set `location_confirmed` to `true`), otherwise charges are measured from the wrong spot.
* **Location needs https:** browsers share location only on secure (`https://`) sites or `localhost`. Host the site on https (Netlify, GitHub Pages, etc.). If it is opened another way, customers fall back to choosing their area manually.
* Distance is straight-line ("as the crow flies"), not road distance, and phone GPS can be off by some metres, so a customer very close to a boundary (1.5 km or 6 km) may land on either side.
* No online payment is taken. Customers pay cash/UPI on delivery or pickup; admin marks Paid.
* Because there is no server, the admin login is a simple browser check (fine for a demo or small shop on one computer, not real security). A real multi-device order system needs a server and database.

## Responsive update (v5)
* Works on phones, tablets and desktops. Menu page: search + category chips form one swipeable row; header menu opens as a full-width panel (closes on link tap, outside tap or Esc).
* Fixed: header-menu CSS was also hitting the category chips and the admin pager on small screens; dark-theme divider colours (`--ln`) were broken; admin order page no longer overflows sideways.
* Phone extras: 44px tap targets, no iPhone zoom on inputs, notch/safe-area support, lighter animations, cart drawer fits the real screen height.

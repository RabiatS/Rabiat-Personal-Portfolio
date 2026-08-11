# Fonts

## Amazon Ember (Amazon Music card only)

Amazon Ember is proprietary and is **not** committed to this repo. The Amazon
Music project card asks for it and falls back gracefully when it is missing.

To enable it, drop the files here with these exact names:

    assets/fonts/AmazonEmber-Regular.woff2
    assets/fonts/AmazonEmber-Bold.woff2

`.otf` / `.ttf` also work; add matching `@font-face` src entries in
`assets/style.css` (search for "Amazon Ember"). Converting to `.woff2` first is
worth it: it is roughly 40% smaller over the wire.

Note: Amazon Ember's license restricts redistribution. Serving it from a public
site may not be permitted; check the license terms that came with your copy
before deploying. Without the files, the card uses the fallback stack and
nothing breaks.

## Apple system font (Assuage card only)

No files needed. The Assuage card uses `-apple-system` / `SF Pro`, which the OS
provides on Apple devices and which falls back to the normal UI font elsewhere.

# MEODP visual assets

The eye represents observing link health; cyan indicates connectivity and coral marks a broken connection.

The navigation and both homepage hero images share the same SVG logo geometry:

- Light theme: `docs/public/brand/logo-light.svg`, pale cyan background with a dark teal eye and coral accent.
- Dark theme: `docs/public/brand/logo.svg`, navy background with a bright cyan eye and coral accent. Also used as the favicon.

VitePress selects the image from the page theme using its `light` and `dark` image configuration. This follows the manual appearance switch as well as the initial system preference. No raster artwork or image-generation step is needed. Keep the paths identical when editing these two palette variants.

The hero uses the SVG's own rounded square rather than a circular CSS crop, preserving the complete logo in both themes. It is displayed at 280 px on desktop and 200 px on small screens, with localized alternative text.

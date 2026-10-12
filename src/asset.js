// The address of a file in public/, wherever the page is served from: the root in dev, and in the build
// whatever folder index.html is in (vite.config.js sets a relative base, so a sub-path works too).
export const asset = (file) => import.meta.env.BASE_URL + file

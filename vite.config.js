import {defineConfig} from 'vite';
// base './' (17 Sep 2026): the game is hosted on Genex, which serves the build under its own origin/path, so asset
// URLs in the build are relative instead of rooted at '/'.
// 13 Oct 2026 (the load pass): the build ships the game page alone. The review pages (animation-review.html,
// boss-idle-video.html, boss-walk-video.html, motion-videos.html) still open under `npm run dev`.
// Minification (13 Oct 2026): Vite 8's defaults are already the maximum here - Oxc (inside rolldown) compresses and
// mangles the JS with top-level names, Lightning CSS minifies the CSS, comments are dropped. Explicit Oxc options
// (10 compress passes, joinVars, sequences, unused) and targets es2022/esnext measured within 0.1 % of the default.
export default defineConfig({base:'./',build:{rolldownOptions:{input:{game:'index.html'},output:{codeSplitting:{groups:[{name:'three',test:/node_modules\/three/}]}}}}});

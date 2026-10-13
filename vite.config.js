import {defineConfig} from 'vite';
// base './' (17 Sep 2026): the game is hosted on Genex, which serves the build under its own origin/path, so asset
// URLs in the build are relative instead of rooted at '/'.
// 13 Oct 2026 (the load pass): the build ships the game page alone. The review pages (animation-review.html,
// boss-idle-video.html, boss-walk-video.html, motion-videos.html) still open under `npm run dev`.
export default defineConfig({base:'./',build:{rolldownOptions:{input:{game:'index.html'},output:{codeSplitting:{groups:[{name:'three',test:/node_modules\/three/}]}}}}});

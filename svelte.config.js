import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * VibeForge ships as a Tauri desktop application, so the frontend must build
 * to a directory of files on disk. `src-tauri/tauri.conf.json` names that
 * directory as `frontendDist: "../build"`.
 *
 * `adapter-auto` cannot produce it. It detects a hosting platform and writes
 * nothing when it finds none, which is the case here, so `pnpm build` printed
 * "Could not detect a supported production environment" and emitted only
 * `.svelte-kit/output`. The desktop binary then could not be compiled at all:
 * `generate_context!` reads `frontendDist` and panics on the missing path.
 * See docs/KNOWN_ISSUES.md.
 *
 * `trailingSlash` is left at its default of 'never', which writes
 * `settings.html` rather than `settings/index.html`. That is what Tauri's
 * asset resolver expects: it tries the exact path, then `<path>.html`, then
 * `<path>/index.html`, then `index.html`
 * (tauri-2.9.3/src/manager/mod.rs, `AppManager::get_asset`). So a reload at a
 * nested route resolves, not only the first load of `/`.
 *
 * `strict` is left at its default of true, so the build fails if any route is
 * not prerendered rather than shipping an artifact with holes in it. No
 * `fallback` is set, because setting one would switch that check off.
 */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build'
		})
	}
};

export default config;

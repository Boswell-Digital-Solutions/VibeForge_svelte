/**
 * Prerender every route.
 *
 * Inherited by every route below this one, which is all of them. The
 * application is a Tauri desktop frontend: there is no server at runtime, so
 * every page has to exist as a file before the binary is built.
 *
 * This is viable because nothing here needs a server. `src/routes/` holds no
 * `+page.server.ts`, no `+layout.server.ts`, no `+server.ts`, no form action
 * and no dynamic route parameter, so SvelteKit can enumerate every route
 * without crawling for links.
 *
 * `ssr` and `csr` are deliberately left at their defaults. Prerendering is
 * server-side rendering performed at build time, so `ssr` must stay on, and
 * `csr` must stay on for the client to hydrate and take over routing.
 */
export const prerender = true;

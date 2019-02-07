/*!
 * service.js for ServiceWorkers v1.0
 * Licensed under the MIT license
 * Copyright (c) 2019 Lukas Jans
 * https://github.com/luniverse/service
 */
Service = class {
	
	// Construct from controller
	constructor(config) {
		this.config = config;
		
		// Register events
		self.addEventListener('install', e => this.install(e));
		self.addEventListener('activate', e => this.activate(e));
		self.addEventListener('fetch', e => this.fetch(e));
	}
	
	// Install the service
	install(e) {
			
		// When ready, immediately replace the current service (if existing) by skipping its waiting-phase
		self.skipWaiting();
			
		// Wait for the cache-download. If the promise gets rejected, the browser dismisses the installation
		e.waitUntil(caches.open(this.config.version).then(cache => cache.addAll(this.config.cache)));
	}
	
	// Activate the service (it now is the only one responsible for this scope)
	activate(e) {
		e.waitUntil((async () => {
	
			// Claim control over all clients in this scope
			await clients.claim();
			
			// Delete caches from older versions of this service worker
			for(const cache of await caches.keys()) {
				if(cache != this.config.version) await caches.delete(cache);
			}
		})());
	}
	
	// Respond to fetch events
	fetch(e) {
		e.respondWith((async () => {
			
			// Load the request
			let request = {}
			request.url = new URL(e.request.url);
			request.GET = request.url.searchParams;
			request.POST = new URLSearchParams(await e.request.clone().text());
			
			// Return cached resources
			const cached = await caches.match(e.request);
			if(cached) return cached;
			
			// Match call against handlers
			for(let handler of this.config.handlers) {
				request.params = handler.pattern.exec(request.url.pathname);
				if(request.params) {
					
					// Apply filters and process request
					if(this.config.requestFilter) request = await this.config.requestFilter(request);
					let response = await handler.process(request);
					if(this.config.responseFilter) response = await this.config.responseFilter(response);
					return response;
				}
			}
			
			// Network fallback
			return fetch(e.request);
		})());
	}
}
import {Injectable, InjectionToken, Injector, NgZone} from '@angular/core';
import {
	ApiConfig,
	BadgrConfig,
	FeaturesConfig,
	GoogleAnalyticsConfig,
	HelpConfig
} from "../../environments/badgr-config";
import {environment} from "../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {BadgrTheme} from '../../theming/badgr-theme';

import * as deepmerge from 'deepmerge'
import {animationFramePromise} from './util/promise-util';
import {initializeTheme} from '../../theming/theme-setup';

const packageJsonVersion = require("../../../package.json").version;

@Injectable()
export class AppConfigService {
	private config: BadgrConfig = defaultConfig;

	constructor(
		private injector: Injector,
		private http: HttpClient,
		private ngZone: NgZone
	) {
		window["initializeBadgrConfig"] = (...args) => ngZone.run(() => this.initializeConfig.apply(this, args));
	}

	get apiConfig(): ApiConfig {
		return this.config.api;
	}

	get featuresConfig(): FeaturesConfig {
		return this.config.features;
	}

	get helpConfig(): HelpConfig {
		return this.config.help;
	}

	get googleAnalyticsConfig(): GoogleAnalyticsConfig {
		return this.config.googleAnalytics;
	}

	get assertionVerifyUrl(): string {
		return this.config.assertionVerifyUrl;
	}

	get theme(): BadgrTheme {
		return this.config.theme;
	}


	private async loadRemoteConfig(): Promise<Partial<BadgrConfig> | null> {
		const queryParams = new URLSearchParams(window.location.search);

		// Allow custom remote config information to be added after the angular scripts in index.html.
		await animationFramePromise();

		function getRemoteConfigParam(name, allowQueryParam) {
			return (allowQueryParam && queryParams.get(name))
				|| window.localStorage.getItem(name)
				|| window.sessionStorage.getItem(name)
				|| (() => { const m = document.querySelector(`meta[name=${name}]`); return m && m.getAttribute("content")})();
		}

		// SECURITY NOTE: We do _not_ allow overriding the remote configuration baseUrl with a query param because it could allow an attacker
		// to load badgr with third-party configuration, which could harvest user data or otherwise cause mischief.
		const baseUrl = getRemoteConfigParam("configBaseUrl", false) || (environment.remoteConfig && environment.remoteConfig.baseUrl) || null;
		const version = getRemoteConfigParam("configVersion", true) || (environment.remoteConfig && environment.remoteConfig.version) || null;
		const cacheBust = getRemoteConfigParam("configCacheBust", true) || null;
		const domain = getRemoteConfigParam("configDomain", true) || window.location.hostname;

		if (! baseUrl || ! version || ! domain) {
			return Promise.resolve(null);
		}

		// Request a new copy of the config every hour
		const oneHourMs = 60 * 60 * 1000;
		const timeCode = Math.floor(Date.now() / oneHourMs);

		const configUrl = `${baseUrl}/${version}/${domain}/config.json?v=${packageJsonVersion}&t=${timeCode}&cacheBust=${cacheBust}`;

		return this.http.get(configUrl)
			.toPromise()
			.then(r => {
				return r;
			})
			.catch(
				err => {
					console.error(`Failed to load remote config from ${configUrl}`, err);
					return null;
				}
			);
	}

	async initializeConfig(configOverrides?: Partial<BadgrConfig>) {
		// Build the canonical configuration object by deep merging all config contributors
		this.config = deepmerge.all([
			// The default, base configuration object
			defaultConfig,

			// Configuration overrides from the Angular environment
			environment.config || {},

			// Configuration overrides in Angular's dependency injection. Mostly used for tests.
			this.injector.get(new InjectionToken<Partial<BadgrConfig>>('config'), null) || {},

			// Remote configuration overrides, generally domain-specific from a config server
			await this.loadRemoteConfig() || {},

			// User-specified configuration overrides from local storage
			JSON.parse(localStorage.getItem("config")) || {},

			// User-specified configuration overrides from session storage
			JSON.parse(sessionStorage.getItem("config")) || {},

			// Programmatic Configuration Overrides
			configOverrides || {}
		], {
			clone: true
		}) as BadgrConfig;

		// Initialize theming with the final configuration value
		initializeTheme(this);

		return this.config;
	}
}

export const defaultConfig: BadgrConfig = {
	api: {
		baseUrl: window.location.protocol + "//" + window.location.hostname + ":8000",
	},
	features: {
		alternateLandingRedirect: false
	},
	help: {
		email: "support@badgr.io"
	},
	googleAnalytics: {
		trackingId: null
	},
	assertionVerifyUrl: "https://badgecheck.io/",
	theme: {
		serviceName: "Badgr",
		welcomeMessage: "## Welcome to Badgr!",
		alternateLandingUrl: null,
		showPoweredByBadgr: false,
		showApiDocsLink: true,
		termsOfServiceLink: null,
		termsHelpLink: null,
		privacyPolicyLink: null,
		providedBy: null,
		logoImg: {
			small: require("../../breakdown/static/images/logo.svg"),
			desktop: require("../../breakdown/static/images/logo-desktop.svg"),
		},
		loadingImg: {
			// Image is inlined here to avoid any external resource loading, at the expense of a larger initial file size. We only do this for the default theme.
			imageUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
				'<svg xmlns="http://www.w3.org/2000/svg" width="122" height="48"><g fill="none" fill-rule="evenodd"><path fill="#05012C" d="M89.7 16.5v2.6h1.8v2.4c-.7-.2-1.6-.4-2.8-.4-3 0-4.7 1.6-4.7 5.1v2.3c0 3.1.9 5.4 4.5 5.4.9 0 2.3-.3 3.5-.9l.2.7h4.5v-2.6H95V16.5h-5.3zm-2.3 12.4v-2.8c0-1.8.7-2.2 2.1-2.2.8 0 1.4.1 2 .2v6.7c-.6.2-1.5.3-2 .3-1.6 0-2.1-.6-2.1-2.2zm-32-12.4v2.6h1.8v14.4c2 .3 3.9.4 5.5.4 4.6 0 5.5-2.3 5.5-5.4v-2.3c0-3.5-1.8-5.1-4.7-5.1-1.2 0-2.1.2-2.8.4v-5h-5.3zM60.7 31v-6.9c.6-.1 1.1-.2 2-.2 1.4 0 2 .4 2 2.2v2.8c0 1.6-.4 2.2-2 2.2-.5 0-1.3 0-2-.1zm56.4-8.6l-.3-1.1h-4.7v2.6h1.8v7.2h-1.6v2.6h6.6v-2.6h-1.5v-6.4c1.2-.4 3.3-.4 4.2-.5v-3.1c-1.6 0-3.1.7-4.5 1.3zm-19 4v2.4c0 3.5 1.8 5 4.7 5.1 1.2 0 2-.2 2.7-.4 0 .9-.2 1.7-1.1 2-1.3.5-3.6.5-5.8.5v2.8h1.1c1.4 0 3.5 0 5.4-.4 4-1.1 4-3.9 4-6.3v-8.2h1.8v-2.6h-4.6l-.2.7c-1.2-.6-2.6-.9-3.5-.9-3.5 0-4.5 2.3-4.5 5.3zm3.5 2.5v-2.8c0-1.6.4-2.2 2-2.2.5 0 1.4.1 2 .2v6.8c-.6.1-1.2.2-2 .2-1.4 0-2-.4-2-2.2zm-28.3-7.5c-3.2.8-3.3 3.3-3.3 4.8v2.5c0 3 .9 5.2 4.5 5.2.9 0 2.2-.3 3.4-.9l.2.7h4.4v-2.6h-1.6v-9.2c-1.9-.6-3.5-.8-5.3-.8-.8 0-1.4.1-2.3.3zm.2 7.5v-2.6c0-1.6.3-2.4 2.1-2.4.5 0 1.2 0 1.8.1v6.7c-.6.2-1.4.4-1.8.4-1.7 0-2.1-.6-2.1-2.2z"/><path fill="#C30A28" d="M43.7 35.87l-19.6 11.5-19.5-11.5v-23l19.5-11.5 19.6 11.5"/><path fill="#FFF" d="M43 23.37l-10.7-7.9-4.3-3.6-1.8-1-4.3 2.6-4.1.5-4.9 2.1-5.9 3.3-5.2 1.4v3.5l1.5 2.3 4 1.3 11 1.6 20.7 8.8 3.2-2.3.6-.8"/><path fill="#05012C" d="M24.1 46.27L5.2 35.07v-7.5c1.1.3 2.6.6 4.5.8l.1.1c5.2.8 7.6 2 7.8 2.1 5 3.2 7.9 7.3 9.5 10.2.5.9 1 1.9 1.4 2.8v.1l-4.4 2.6zm-9.7-25.3l.1-.1h.3c.1 0 .3 0 .4.1l.6.3c-.3 0-.5.3-.9.5h-.2c.1-.1.2-.2.2-.3 0-.3-.2-.5-.5-.5zm14.7-.8c-.3 0-.8-.3-.8-.3.4-.2.5-.8.5-.8-.2.2-.3.3-.5.3-.1 0-.1-.1-.1-.1.1-.2-.1-.5-.1-.5-.1.3-.3.4-.5.4s-.3-.1-.3-.1c.2-.4.1-.8 0-1-.2.3-1.5 1.2-2.3 1.4h-.4c-.4 0-.1-.3-.1-.3l.1-.1c.2-.3.7-.9 1.7-1.2.1 0 .2-.1.3-.1.4-.1.8-.1 1.2-.1.8 0 1.5.2 1.8.9.2.4.4 1 .5 1.6.1.4.2.9.1 1.1v.3c-.1.1-.2.1-.3.1h-.1c-.6-.1-1.2-.9-1.2-.9.4-.1.7-.6.7-.6h-.2zm-25 2.1c0-.4-.9-1.3-1.2-1.6l3.9-1.1c1.6-.4 7.5-5.1 11.9-5.7.6-.1 1.2-.1 1.9-.2h.3c.4 0 1 0 1.8.1 1.2.1 2.4.3 3 .4l2.3.5c2.1.5 4.2 1.4 6 2.7 4.8 3.4 7.5 6 7.6 6.3.2.4-7.8-.4-10.6-2.9-.1-1-.5-2-.7-2.6-.3-.6-.9-1.3-2.4-1.3-.7 0-1.4.1-1.9.3-.1 0-.2.1-.3.1-.6-.2-1.1-.2-1.5-.3-1.3-.2-3.4-.5-7.9.9s-9.4 4-10.2 4.8c-.8.8.1 2 .8 2.5.7.5 1.4 1.4 1.7.7.3-.7.1-.9 1.2-.8 1 .1 6.6.7 9.3.1 2.6-.6 5.3-1.4 5.8-2 0 0-.1.7-.3 1.1 0 0 1.2-.2 1.6-.5 0 0-.1.5-.3.7 0 0 .6.3 1.1-.1 0 0-.4.4-.3.8.1.3 1.2.5 3.5.7 2.1.3 7.1 3.8 11 10.3l-1.2.7c-1.7-1-4.1-2.5-6.2-3.8-3.7-2.2-9.7-4.7-15-4.9-3.8-.1-8.2-.1-12.2-1.1 1.2.1 2.5.2 3.5.2.4-.1.8-.1 1.1-.1 1.6-.1 2.9-.1 3.8.2h.1c.1 0 .1 0 .2-.1 0-.2 0-.3-.2-.3-.9-.4-2.2-.4-3.9-.3-.4 0-.7.1-1.1.1-2.1.1-5.7-.2-6.9-.8.2-.6 1-3.1.9-3.7zm19.1-9.2h-.7s.1 0 .1-.1c.1 0 .2-.1.2-.1.3-.2.5-.3.7-.5.9-.6 1.6-1.2 2.2-1.3h.2c.4.1 1.2.6 1.8 1.1v.4c0 .1 0 .1-.1.2v.2h-.1c-.2-.1-.2-.4-.2-.4l-.1-.2-.1.1c-.1 0-.2 0-.3.1-.1.1-.2.1-.3.2 0-.4-.4-.8-.4-.8l-.2-.2-.1.2c-.2.6-1.6 1-2.7 1.1h.1zm-18-.2l18.9-11.1L43 12.87v9.4c-3.4-3.3-7-5.8-10.7-7.4h-.1c-1.2-.8-2.4-1.8-2.9-2.3-.7-.9-2.3-2.1-3.2-2.3h-.3c-.8 0-1.6.6-2.8 1.4-.2.2-.4.4-.6.5-.6.4-.9.6-1 .7h-.5c-.8 0-1.5.1-2.3.2-3.1.4-6.7 2.6-9.3 4.3-1.2.7-2.3 1.3-2.7 1.5-.5.1-1 .2-1.4.3v-6.3zm38.4-1.1L24.7.67c-.2-.1-.4-.2-.6-.2-.2 0-.4.1-.6.2L4.6 11.77c-.4.2-.6.6-.6 1.1v6.7c-1.1.2-1.8.4-1.9.4-1.1.3-1.7.8-2 1.5-.4 1 .2 2.2.8 3.2.8 1.2 1.5 2 3.1 2.5v7.9c0 .5.2.9.6 1.1l18.9 11.2c.2.1.4.1.6.1.2 0 .4 0 .6-.1l18.9-11.2c.4-.2.6-.6.6-1.1v-22.2c0-.5-.2-.9-.6-1.1z"/></g></svg>'),
			height: 48
		},
		favicons: [],
		cssCustomProps: {}
	}
};
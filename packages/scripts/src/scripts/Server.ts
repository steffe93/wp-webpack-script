import browserSync from 'browser-sync';
import devIp from 'dev-ip';
import formatWebpackMessages from 'react-dev-utils/formatWebpackMessages';
import openBrowser from 'react-dev-utils/openBrowser';
import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';

import { CreateWebpackConfig } from '../config/CreateWebpackConfig';
import { ProjectConfig } from '../config/project.config.default';
import { ServerConfig } from '../config/server.config.default';

interface Callbacks {
	invalid(): void;
	done(stats: webpack.Stats): void;
	firstCompile(stats: webpack.Stats): void;
	onError(err: { errors: string[]; warnings: string[] }): void;
	onWarn(warn: { errors: string[]; warnings: string[] }): void;
	onBsChange(file: string): void;
	onEmit(stats: webpack.Stats): void;
}

/**
 * Create a development server with file watching, hot reload and live reload.
 * Everything is done with browserSync and webpack middleware.
 */
export class Server {
	private projectConfig: ProjectConfig;

	private serverConfig: ServerConfig;

	private cwd: string;

	private isServing: boolean = false;

	private bs?: browserSync.BrowserSyncInstance;

	private devMiddlewares?: webpackDevMiddleware.WebpackDevMiddleware[];

	private webpackConfig: CreateWebpackConfig;

	private isBrowserOpened: boolean = false;

	private firstCompileCompleted: boolean = false;

	private callbacks: Callbacks;

	/**
	 * Create an instance.
	 *
	 * @param projectConfig Project configuration as recovered from user directory.
	 * @param serverConfig Server configuration as recovered from user directory.
	 */
	constructor(
		projectConfig: ProjectConfig,
		serverConfig: ServerConfig,
		cwd: string,
		callbacks: Callbacks
	) {
		this.projectConfig = projectConfig;
		this.serverConfig = serverConfig;
		this.cwd = cwd;
		this.callbacks = callbacks;
		// Override serverConfig host if it is undefined
		if (!this.serverConfig.host) {
			const possibleHost = devIp();
			if (possibleHost) {
				// eslint-disable-next-line prefer-destructuring
				this.serverConfig.host = possibleHost[0];
			}
		}
		// Create the webpackConfig
		this.webpackConfig = new CreateWebpackConfig(
			this.projectConfig,
			this.serverConfig,
			this.cwd,
			true
		);
	}

	/**
	 * Serve the webpack/browserSync hybrid server.
	 */
	public serve(): void {
		// If server is already running, then throw
		if (this.isServing) {
			throw new Error(
				'Can not serve while the server is already running.'
			);
		}
		// Create browserSync Instance
		const bs = browserSync.create();

		// Init middleware and stuff
		const middlewares: browserSync.MiddlewareHandler[] = [];
		const devMiddlewares: webpackDevMiddleware.WebpackDevMiddleware[] = [];

		// We can have multi-compiler or single compiler, depending on the config
		// we get. And both of them works for dev and hot middleware.
		let compiler: webpack.ICompiler;
		if (this.webpackConfig.isMultiCompiler()) {
			compiler = webpack(
				this.webpackConfig.getWebpackConfig() as webpack.Configuration[]
			);
		} else {
			compiler = webpack(
				this.webpackConfig.getWebpackConfig() as webpack.Configuration
			);
		}

		// Apply only the done hook for the single/multi compiler
		// we pass as webpack.Compiler, because ts don't like it otherwise
		this.addHooks(compiler as webpack.Compiler);

		// eslint-disable-next-line @typescript-eslint/no-object-literal-type-assertion
		const devMiddleware = webpackDevMiddleware(compiler, {
			stats: false,
			publicPath: this.webpackConfig.getPublicPath(),
			logLevel: 'silent',
			logTime: false,
		} as webpackDevMiddleware.Options);

		const hotMiddleware = webpackHotMiddleware(compiler, {
			// Now because we are already using publicPath(dynamicPublicPath = true) in client
			// we have to assume that it is prefixed. That's why we prefix it in the server too.
			// Because it could be multi-compiler, I guess it will just work fine since we are
			// passing in the `name` too, as documented.
			path: `${this.webpackConfig.getHmrPath()}`,
			// We don't want any noise
			log: false,
		});
		// Push them
		middlewares.push(devMiddleware);
		devMiddlewares.push(devMiddleware);
		middlewares.push(hotMiddleware);

		// Init browsersync
		// BS options
		let bsOptions: browserSync.Options = {
			logLevel: 'silent',
			port: this.serverConfig.port,
			ui: this.serverConfig.ui,
			proxy: {
				target: this.serverConfig.proxy,
			},
			// Middleware for webpack hot reload
			middleware: middlewares,
			host: this.serverConfig.host,
			open: false, // We don't want to open right away
			notify: this.serverConfig.notify,
			snippetOptions: {
				whitelist: [
					// Add WP REST API
					'/wp-json/**',
					// Add AJAX calls
					'/wp-admin/admin-ajax.php',
				],
			},
		};
		if (this.serverConfig.bsOverride) {
			bsOptions = {
				...bsOptions,
				...this.serverConfig.bsOverride,
			};
		}

		// Open browser on first build
		devMiddleware.waitUntilValid(stats => {
			if (!this.firstCompileCompleted) {
				this.firstCompileCompleted = true;
				this.callbacks.firstCompile(stats);
			}
			this.openBrowser();
		});

		bs.init(bsOptions);
		// Watch for user defined files, when it changes, reload
		// When that change, reload
		if (this.projectConfig.watch) {
			bs.watch(this.projectConfig.watch as string).on(
				'change',
				(file: string) => {
					this.callbacks.onBsChange(file);
					bs.reload();
				}
			);
		}
		// We don't need to watch for manifest, because if user is changing
		// Config, then she does need to restart. It won't be picked up
		// automatically by node.

		// Mark server is running
		this.isServing = true;

		// Store the instances
		this.bs = bs;
		this.devMiddlewares = devMiddlewares;
	}

	/**
	 * Get URL to network IP where the server is alive.
	 */
	public getServerUrl(): string {
		return `http:${this.webpackConfig.getServerUrl()}`;
	}

	/**
	 * Get URL to browserSync UI.
	 */
	public getBsUiUrl(): string | boolean {
		const { host, ui } = this.serverConfig;
		if (!ui) {
			return false;
		}
		return `http://${host || 'localhost'}:${ui.port || '8080'}`;
	}

	/**
	 * Open browser if not already opened and config says so.
	 */
	public openBrowser = (): void => {
		const serverUrl = this.getServerUrl();
		if (!this.isBrowserOpened && this.serverConfig.open) {
			openBrowser(serverUrl);
			this.isBrowserOpened = true;
		}
	};

	/**
	 * Add hooks to compiler instances.
	 */
	public addHooks = (compiler: webpack.Compiler): void => {
		// We tap into done and invalid hooks, which are present
		// in both single and multi-compiler instances.
		const { done, invalid } = compiler.hooks;

		// Run callbacks on events (taps)
		done.tap('wpackio-hot-server', stats => {
			// don't do anything if firstCompile hasn't run
			if (!this.firstCompileCompleted) {
				return;
			}

			const raw = stats.toJson('verbose');
			const messages = formatWebpackMessages(raw);
			if (!messages.errors.length && !messages.warnings.length) {
				// Here be pretty stuff.
				this.callbacks.done(stats);
			}
			if (messages.errors.length) {
				this.callbacks.onError(messages);
			} else if (messages.warnings.length) {
				this.callbacks.onWarn(messages);
			}

			this.callbacks.onEmit(stats);
		});

		// On compile start
		invalid.tap('wpackio-hot-server', () => {
			this.callbacks.invalid();
		});
	};

	/**
	 * Stop the server and clean up all processes.
	 */
	public stop(): void {
		// throw if server is not running
		if (!this.isServing) {
			throw new Error(
				'Can not stop if the server is not running already. Call server.serve() first.'
			);
		}
		// First stop browserSync
		if (this.bs) {
			this.bs.exit();
		}
		// Now stop all webpack compiler
		if (this.devMiddlewares) {
			this.devMiddlewares.forEach(devMiddleware => {
				devMiddleware.close();
			});
		}
		// All good
	}

	/**
	 * Recompile everything through webpack.
	 */
	public refresh(): void {
		// throw if server is not running
		if (!this.isServing) {
			throw new Error(
				'Can not refresh if the server is not running already. Call server.serve() first.'
			);
		}
		// Refresh all devMiddlewares
		if (this.devMiddlewares) {
			this.devMiddlewares.forEach(devMiddleware => {
				devMiddleware.invalidate();
			});
		}
		// We probably? don't need anything with browserSync?
	}
}

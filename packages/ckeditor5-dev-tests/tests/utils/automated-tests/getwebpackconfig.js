/**
 * @license Copyright (c) 2003-2023, CKSource Holding sp. z o.o. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const mockery = require( 'mockery' );
const sinon = require( 'sinon' );
const { expect } = require( 'chai' );

describe( 'getWebpackConfigForAutomatedTests()', () => {
	const escapedPathSep = require( 'path' ).sep === '/' ? '/' : '\\\\';
	let getWebpackConfigForAutomatedTests, getDefinitionsFromFile, postCssOptions;

	beforeEach( () => {
		mockery.enable( {
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		} );

		mockery.registerMock( '@ckeditor/ckeditor5-dev-utils', {
			styles: {
				getPostCssConfig: options => {
					postCssOptions = options;
				}
			}
		} );

		getDefinitionsFromFile = sinon.stub().returns( {} );

		mockery.registerMock( '../getdefinitionsfromfile', getDefinitionsFromFile );

		getWebpackConfigForAutomatedTests = require( '../../../lib/utils/automated-tests/getwebpackconfig' );
	} );

	afterEach( () => {
		sinon.restore();
		mockery.disable();
		mockery.deregisterAll();
	} );

	it( 'should return basic webpack configuration object', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );

		expect( webpackConfig.resolve ).to.deep.equal( {
			extensions: [ '.ts', '.js', '.json' ]
		} );

		expect( webpackConfig.module.rules.length ).to.equal( 5 );
		expect( webpackConfig.resolveLoader.modules[ 0 ] ).to.equal( 'node_modules' );

		expect( webpackConfig.devtool ).to.equal( undefined );
		expect( webpackConfig.output ).to.have.property( 'devtoolModuleFilenameTemplate' );
		expect( webpackConfig ).to.have.property( 'watchOptions' );
		expect( webpackConfig.watchOptions ).to.have.property( 'aggregateTimeout', 500 );
	} );

	it( 'should return webpack configuration containing a loader for measuring the coverage', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			coverage: true,
			files: [ '**/*.js' ]
		} );

		const coverageLoader = webpackConfig.module.rules[ 0 ];

		expect( coverageLoader ).to.not.equal( undefined );
		expect( '/path/to/javascript.js' ).to.match( coverageLoader.test );
		expect( '/path/to/typescript.ts' ).to.match( coverageLoader.test );

		expect( coverageLoader.include ).to.be.an( 'array' );
		expect( coverageLoader.include ).to.lengthOf( 0 );
		expect( coverageLoader.exclude ).to.be.an( 'array' );
		expect( coverageLoader.exclude ).to.lengthOf( 1 );

		expect( coverageLoader.use ).to.be.an( 'array' );
		expect( coverageLoader.use ).to.lengthOf.above( 1 );

		const babelLoader = coverageLoader.use[ 0 ];

		expect( babelLoader.loader ).to.equal( 'babel-loader' );
		expect( babelLoader.options ).to.be.an( 'object' );
		expect( babelLoader.options ).to.have.property( 'plugins' );
		expect( babelLoader.options.plugins ).to.be.an( 'array' );
		expect( babelLoader.options.plugins ).to.include( 'babel-plugin-istanbul' );
	} );

	it( 'should add the "transform-typescript" babel plugin to the coverage loader', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			coverage: true,
			files: [ '**/*.js' ]
		} );

		const coverageLoader = webpackConfig.module.rules[ 0 ];

		expect( coverageLoader ).to.not.equal( undefined );

		const babelLoader = coverageLoader.use[ 0 ];
		expect( babelLoader.loader ).to.equal( 'babel-loader' );
		expect( babelLoader.options ).to.be.an( 'object' );
		expect( babelLoader.options ).to.have.property( 'plugins' );
		expect( babelLoader.options.plugins ).to.be.an( 'array' );
		expect( babelLoader.options.plugins ).to.include( '@babel/plugin-transform-typescript' );
	} );

	it( 'should include the ck-debug-loader when checking the coverage', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			coverage: true,
			files: [ '**/*.js' ]
		} );

		const coverageLoader = webpackConfig.module.rules[ 0 ];

		expect( coverageLoader ).to.not.equal( undefined );

		expect( coverageLoader.use ).to.be.an( 'array' );
		expect( coverageLoader.use ).to.lengthOf( 2 );

		const ckDebugLoader = coverageLoader.use[ 1 ];

		expect( ckDebugLoader.loader ).to.contain( 'ck-debug-loader' );
	} );

	it( 'should return webpack configuration containing a loader for measuring the coverage (include check)', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			coverage: true,
			files: [
				[
					'node_modules/ckeditor5-utils/tests/**/*.js'
				]
			]
		} );

		const coverageLoader = webpackConfig.module.rules[ 0 ];

		expect( coverageLoader ).to.not.equal( undefined );

		expect( coverageLoader.include ).to.be.an( 'array' );
		expect( coverageLoader.include ).to.deep.equal( [
			new RegExp( [ 'ckeditor5-utils', 'src', '' ].join( escapedPathSep ) )
		] );
	} );

	it( 'should return webpack configuration containing a loader for measuring the coverage (exclude check)', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			coverage: true,
			files: [
				[
					'node_modules/ckeditor5-!(utils)/tests/**/*.js'
				]
			]
		} );

		const coverageLoader = webpackConfig.module.rules[ 0 ];

		expect( coverageLoader ).to.not.equal( undefined );

		expect( coverageLoader.include ).to.be.an( 'array' );
		expect( coverageLoader.include ).to.deep.equal( [
			new RegExp( [ 'ckeditor5-!(utils)', 'src', '' ].join( escapedPathSep ) )
		] );
	} );

	it( 'should return webpack configuration with source map support', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			sourceMap: true
		} );

		expect( webpackConfig.devtool ).to.equal( 'inline-source-map' );
		expect( webpackConfig.optimization ).to.deep.equal( {
			runtimeChunk: false,
			splitChunks: false
		} );
	} );

	it( 'should contain a correct paths in resolveLoader', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );

		const firstPath = webpackConfig.resolveLoader.modules[ 0 ];
		const secondPath = webpackConfig.resolveLoader.modules[ 1 ];

		expect( firstPath ).to.equal( 'node_modules' );

		expect( secondPath ).to.match( /node_modules$/ );
		expect( require( 'fs' ).existsSync( secondPath ) ).to.equal( true );
	} );

	it( 'should return webpack configuration with the correct setup of the postcss-loader', () => {
		getWebpackConfigForAutomatedTests( {
			themePath: 'path/to/theme'
		} );

		expect( postCssOptions ).to.deep.equal( {
			themeImporter: {
				themePath: 'path/to/theme'
			},
			minify: true
		} );
	} );

	it( 'should load svg files properly', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );
		const svgRule = webpackConfig.module.rules.find( rule => {
			return rule.test.toString().endsWith( '.svg$/' );
		} );

		if ( !svgRule ) {
			throw new Error( 'Not found loader for "svg".' );
		}

		const svgRegExp = svgRule.test;

		expect( 'C:\\Program Files\\ckeditor\\ckeditor5-basic-styles\\theme\\icons\\italic.svg' ).to.match( svgRegExp, 'Windows' );
		expect( '/home/ckeditor/ckeditor5-basic-styles/theme/icons/italic.svg' ).to.match( svgRegExp, 'Linux' );
	} );

	it( 'should return webpack configuration with loaded identity file', () => {
		getDefinitionsFromFile.returns( { LICENSE_KEY: 'secret' } );

		const webpackConfig = getWebpackConfigForAutomatedTests( {
			identityFile: 'path/to/secrets.js'
		} );

		const plugin = webpackConfig.plugins[ 0 ];

		expect( getDefinitionsFromFile.firstCall.args[ 0 ] ).to.equal( 'path/to/secrets.js' );
		expect( plugin.definitions.LICENSE_KEY ).to.equal( 'secret' );
	} );

	it( 'should process TypeScript files properly', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );

		const tsRule = webpackConfig.module.rules.find( rule => {
			return rule.test.toString().endsWith( '/\\.ts$/' );
		} );

		if ( !tsRule ) {
			throw new Error( 'A loader for ".ts" files was not found.' );
		}

		const ckDebugLoader = tsRule.use.find( item => item.loader.endsWith( 'ck-debug-loader.js' ) );
		const tsLoader = tsRule.use.find( item => item.loader === 'ts-loader' );

		if ( !ckDebugLoader ) {
			throw new Error( '"ck-debug-loader" missing' );
		}

		if ( !tsLoader ) {
			throw new Error( '"ts-loader" missing' );
		}

		expect( tsLoader ).to.have.property( 'options' );
		expect( tsLoader.options ).to.have.property( 'compilerOptions' );
		expect( tsLoader.options.compilerOptions ).to.deep.equal( {
			noEmit: false,
			noEmitOnError: true
		} );
	} );

	it( 'should use "ck-debug-loader" before "ts-loader" while loading TS files', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );

		const tsRule = webpackConfig.module.rules.find( rule => {
			return rule.test.toString().endsWith( '/\\.ts$/' );
		} );

		if ( !tsRule ) {
			throw new Error( 'A loader for ".ts" files was not found.' );
		}

		const ckDebugLoaderIndex = tsRule.use.findIndex( item => item.loader.endsWith( 'ck-debug-loader.js' ) );
		const tsLoaderIndex = tsRule.use.findIndex( item => item.loader === 'ts-loader' );

		if ( ckDebugLoaderIndex === undefined ) {
			throw new Error( '"ck-debug-loader" missing' );
		}

		if ( tsLoaderIndex === undefined ) {
			throw new Error( '"ts-loader" missing' );
		}

		// Webpack reads the "use" array from back to the front.
		expect( ckDebugLoaderIndex ).to.equal( 1 );
		expect( tsLoaderIndex ).to.equal( 0 );
	} );

	it( 'should return webpack configuration with correct extension resolve order', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			resolveJsFirst: true
		} );

		expect( webpackConfig.resolve ).to.deep.equal( {
			extensions: [ '.js', '.ts', '.json' ]
		} );
	} );

	it( 'should return webpack configuration with cache enabled', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {
			cache: true
		} );

		expect( webpackConfig.cache ).to.deep.equal( {
			type: 'filesystem'
		} );
	} );

	it( 'should get rid of the "webpack://" protocol to make the paths clickable in the terminal', () => {
		const webpackConfig = getWebpackConfigForAutomatedTests( {} );

		const { devtoolModuleFilenameTemplate } = webpackConfig.output;

		const info = { resourcePath: 'foo/bar/baz' };

		expect( devtoolModuleFilenameTemplate( info ) ).to.equal( info.resourcePath );
	} );
} );

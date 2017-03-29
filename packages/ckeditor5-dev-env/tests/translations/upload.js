/**
 * @license Copyright (c) 2003-2017, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/* global describe, it, beforeEach, afterEach */

'use strict';

const path = require( 'path' );
const sinon = require( 'sinon' );
const mockery = require( 'mockery' );

describe( 'upload', () => {
	let sandbox, stubs, upload;
	let packageNames, serverResources;

	beforeEach( () => {
		sandbox = sinon.sandbox.create();

		mockery.enable( {
			useCleanCache: true,
			warnOnReplace: false,
			warnOnUnregistered: false
		} );

		stubs = {
			logger: {
				info: sandbox.stub(),
				warning: sandbox.stub(),
				error: sandbox.stub()
			},

			transifexService: {
				getResources: sandbox.spy( () => Promise.resolve( serverResources ) ),
				postResource: sandbox.spy( () => Promise.resolve( '[]' ) ),
				putResourceContent: sandbox.spy( () => Promise.resolve( '{}' ) )
			},

			fs: {
				readdirSync: sandbox.spy( () => packageNames ),
				createReadStream: sandbox.spy( file => `${ file } content` )
			}
		};

		mockery.registerMock( './transifex-service', stubs.transifexService );
		mockery.registerMock( 'fs', stubs.fs );
		mockery.registerMock( '@ckeditor/ckeditor5-dev-utils', {
			logger: () => stubs.logger
		} );

		sandbox.stub( process, 'cwd', () => path.join( 'workspace', 'ckeditor5' ) );

		upload = require( '../../lib/translations/upload' );
	} );

	afterEach( () => {
		mockery.disable();
		sandbox.restore();
	} );

	it( 'should be able to create and update resources on the Transifex', () => {
		packageNames = [
			'ckeditor5-core',
			'ckeditor5-ui',
		];

		serverResources = [ {
			slug: 'ckeditor5-core'
		} ];

		return upload( { token: 'secretToken' } )
			.then( () => {
				sinon.assert.calledOnce( stubs.transifexService.getResources );
				sinon.assert.calledWithExactly( stubs.fs.readdirSync, path.join( 'workspace', 'ckeditor5', 'build', '.transifex' ) );

				sinon.assert.calledOnce( stubs.transifexService.postResource );
				sinon.assert.calledWithExactly( stubs.transifexService.postResource, {
					token: 'secretToken',
					name: 'ckeditor5-ui',
					slug: 'ckeditor5-ui',
					content: 'workspace/ckeditor5/build/.transifex/ckeditor5-ui/en.pot content'
				} );

				sinon.assert.calledOnce( stubs.transifexService.putResourceContent );

				sinon.assert.calledWithExactly( stubs.transifexService.putResourceContent, {
					token: 'secretToken',
					slug: 'ckeditor5-core',
					name: 'ckeditor5-core',
					content: 'workspace/ckeditor5/build/.transifex/ckeditor5-core/en.pot content'
				} );
			} );
	} );
} );

// A plugin for JSDoc that should purge non-public API docs.
// Public API docs should contain the `@publicApi` tag below the `@module` tag.

const path = require( 'path' );
const fs = require( 'fs' );

module.exports = {
	handlers: {
		/**
		 * @see http://usejsdoc.org/about-plugins.html#event-beforeparse
		 * @param {any} evt
		 */
		beforeParse( evt ) {
			// Skip public packages.
			if ( !isPrivatePackageFile( evt.filename ) ) {
				return;
			}

			// Do not emit any JSDoc doclet if the `@publicApi` tag is missing in that file.
			if ( !evt.source.includes( '@publicApi' ) ) {
				evt.source = '';

				return;
			}

			// Do not emit any JSDoc doclet if the '@module' tag is missing and log a warning.
			if ( !evt.source.includes( '@module' ) ) {
				evt.source = '';

				const filename = path.relative( process.cwd(), evt.filename );

				console.warn( `File ${ filename } did not start with '@module' tag and hence it will be ignored while building docs.` );
			}
		},

		processingComplete( evt ) {
			for ( const doclet of evt.doclets ) {
				if ( doclet.meta && doclet.meta.path ) {
					if ( isPrivatePackageFile( doclet.meta.path ) ) {
						delete doclet.meta;

						doclet.skipSource = true;
					}
				}
			}
		}
	},

	/**
	 * See http://usejsdoc.org/about-plugins.html#tag-definition.
	 *
	 * @param {any} dictionary
	 */
	defineTags( dictionary ) {
		dictionary.defineTag( 'publicApi', {
			mustHaveValue: false,
			canHaveType: false,
			canHaveName: false,

			/**
			 * @param {any} doclet
			 * @param {any} tag
			 */
			onTagged( doclet ) {
				Object.assign( doclet, {
					publicApi: true
				} );
			}
		} );
	}
};

function isPrivatePackageFile( fileName ) {
	let dirName = path.dirname( fileName );

	while ( true ) {
		const pathToPackageJson = path.join( dirName, 'package.json' );

		if ( fs.existsSync( pathToPackageJson ) ) {
			return !!JSON.parse( fs.readFileSync( pathToPackageJson ).toString() ).private;
		}

		dirName = path.dirname( dirName );
	}
}

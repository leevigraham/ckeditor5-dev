/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

'use strict';

const { tools } = require( '@ckeditor/ckeditor5-dev-utils' );

/**
 * @param {Object} options
 * @param {String} options.version Version of the current release.
 * @param {String} options.changes Changelog entries for the current release.
 * @param {Boolean} [options.ignoreBranchCheck=false] If set on true, branch checking will be skipped.
 * @returns {Array.<String>}
 */
module.exports = function validatePackageToRelease( options ) {
	const errors = [];

	// Check whether the repository is ready for the release.
	const status = exec( 'git status -sb', { verbosity: 'error' } ).trim();

	if ( !options.ignoreBranchCheck ) {
		// Check whether current branch is "master".
		if ( !status.startsWith( '## master...origin/master' ) ) {
			errors.push( 'Not on master.' );
		}
	}

	// Check whether the local branch is sync with the remote.
	if ( status.match( /behind \d+/ ) ) {
		errors.push( 'The branch is behind with the remote.' );
	}

	// Check whether specified the version.
	if ( !options.version ) {
		errors.push( `Passed an invalid version ("${ options.version }").` );

		return errors;
	}

	// Check whether the changelog entries are correct.
	if ( !options.changes ) {
		errors.push( `Cannot find changelog entries for version "${ options.version }".` );
	}

	return errors;

	function exec( command ) {
		return tools.shExec( command, { verbosity: 'error' } );
	}
};

/**
 * @license Copyright (c) 2003-2021, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 */

'use strict';

const DocletCollection = require( '../utils/doclet-collection' );
const { ALL_TYPES, GENERIC_TYPES } = require( './types' );

const complexTypeRegExp = /^([\w]+)\.<\(?([^)^>]+)\)?>$/;

/**
 * Main validation class
 */
class DocletValidator {
	/**
	 * Creates DocletLinter
	 */
	constructor( doclets ) {
		/**
		 * Errors found during the validation.
		 *
		 * @type {Array.<Object>}
		 * @public
		 * @readonly
		 * */
		this.errors = [];

		/**
		 * Doclets grouped by doclet's `kind` property.
		 *
		 * @private
		 */
		this._collection = this._createDocletCollection( doclets );

		/**
		 * The `longname` -> `doclet` map of doclets.
		 *
		 * @type {Record.<String,Doclet>}
		 */
		this._docletMap = createDocletMap( doclets );
	}

	/**
	 * Creates doclets grouped by doclet kind.
	 *
	 * @private
	 * @returns {DocletCollection}
	 */
	_createDocletCollection( doclets ) {
		const collection = new DocletCollection();

		for ( const doclet of doclets ) {
			collection.add( doclet.kind, doclet );
		}

		return collection;
	}

	/**
	 * Returns errors found during the validation.
	 *
	 * @public
	 * @returns {Array.<Object>}
	 */
	validate() {
		this.errors.length = 0;

		this._validateMembers();
		this._validateMemberofProperty();
		this._validateLongnamePropertyInClasses();
		this._validateParameters();
		this._validateLinks();
		this._validateEvents();
		this._validateInterfaces();
		this._validateModuleDocumentedExports();
		this._validateReturnTypes();
		this._validateSeeReferences();
		this._validateTypedefs();
		this._validateExtensibility();
		this._checkDuplicatedDoclets();
		this._findInheritedMethods();

		return this.errors;
	}

	/**
	 * Tries to find all symbols that override inherited properties from a parent class or a mixing and miss the `@override` annotation.
	 *
	 * @todo: Extract it to a separate class with a proper structure.
	 * @private
	 */
	_findInheritedMethods() {
		// A map containing symbols of classes/mixins/interfaces that a child class extends or mixes.
		// For the following example, "module:foo~Foo" and "module:observable~Observable" symbols will be processed.
		//
		// @extends module:foo~Foo
		// @mixes module:observable~Observable
		// class Bar extends Foo { /* ... */ }
		const baseSymbols = new Map();

		// A map containing symbols of classes/mixins/interfaces that inherit anything from a class or a mixin.
		// For the following example, the "module:bar~Bar" symbol will be processed.
		//
		// @extends module:foo~Foo
		// @mixes module:observable~Observable
		// class Bar extends Foo { /* ... */ }
		const extendedSymbols = new Map();

		// TODO: Should we process only classes here?
		for ( const singleDoclet of this._collection.getAll() ) {
			const augmentsAndMixesSymbols = [].concat( singleDoclet.augments, singleDoclet.mixes ).filter( Boolean );

			// Save symbols when a class inherits.
			if ( augmentsAndMixesSymbols.length ) {
				for ( const augmentOrMixSymbol of augmentsAndMixesSymbols ) {
					baseSymbols.set( augmentOrMixSymbol, singleDoclet );
				}

				extendedSymbols.set( singleDoclet.longname, singleDoclet );
			}
		}

		// Temporary map used for filling the `classAndProperties` collection.
		const docletMap = createDocletMap( this._collection );

		// A map that will contain a name of module and all its symbols.
		const classAndProperties = new Map();

		// Find all `#methods()` and `#properties` for base classes/mixes.
		for ( const [ docletName ] of baseSymbols ) {
			if ( !this._collection._allLongnames.includes( docletName ) ) {
				baseSymbols.delete( docletName );
				continue;
			}

			classAndProperties.set( docletName, docletMap[ docletName ] );
		}

		// Find all `#methods()` and `#properties` for classes that inherit.
		for ( const [ docletName ] of extendedSymbols ) {
			if ( !this._collection._allLongnames.includes( docletName ) ) {
				extendedSymbols.delete( docletName );
				continue;
			}

			classAndProperties.set( docletName, docletMap[ docletName ] );
		}

		// For every class that inherits...
		for ( const [ docletName, classDoclet ] of extendedSymbols ) {
			// ...check a single property (methods and properties)...
			for ( const propertyDoclet of classAndProperties.get( docletName ) ) {
				// If a property is inherited/mixed, it isn't specified in the class directly.
				if ( propertyDoclet.inherited || propertyDoclet.mixed ) {
					continue;
				}

				const augmentsAndMixesSymbols = [].concat( classDoclet.augments, classDoclet.mixes ).filter( Boolean );

				// ...if it is also specified in an augment class or a mixin module.
				for ( const augmentOrMixModuleName of augmentsAndMixesSymbols ) {
					// Missing doclet for the "module:engine/view/observer/bubblingemittermixin~BubblingEmitterMixin" module.
					if ( augmentOrMixModuleName === 'module:engine/view/observer/bubblingemittermixin~BubblingEmitterMixin' ) {
						continue;
					}

					// The following modules lack their symbols:
					// * Error
					// * ObservableMixin
					// * module:utils/domemittermixin~DomEmitterMixin
					if ( !classAndProperties.get( augmentOrMixModuleName ) ) {
						continue;
					}

					const propertyName = getPropertyNameFromDoclet( propertyDoclet );

					const augmentOrMixPropertiesNames = new Map(
						classAndProperties.get( augmentOrMixModuleName ).map( doclet => [ getPropertyNameFromDoclet( doclet ), doclet ] )
					);

					// A parent module does not contain the property specified in the inherited class.
					if ( !augmentOrMixPropertiesNames.has( propertyName ) ) {
						continue;
					}

					// If parent class defines an abstract method, an inherited class must implement it.
					if ( augmentOrMixPropertiesNames.get( propertyName ).virtual ) {
						continue;
					}

					if ( !propertyDoclet.override ) {
						this._addError( propertyDoclet, `Missing @override annotation for the '${ propertyDoclet.longname }' docs.` );
					}
				}
			}
		}

		// Prepares a map containing a full name of module and its properties and methods.
		//
		// @param {DocletCollection} doclets
		// @returns {Object.<String, Array.<Doclet>>}
		function createDocletMap( doclets ) {
			const docletMap = {};

			for ( const doclet of doclets.getAll() ) {
				if ( !docletMap[ doclet.memberof ] ) {
					docletMap[ doclet.memberof ] = [];
				}

				docletMap[ doclet.memberof ].push( doclet );
			}

			return docletMap;
		}

		// @param {Doclet}
		// @returns {String}
		function getPropertyNameFromDoclet( doclet ) {
			return doclet.longname.split( /[.#]/ )[ 1 ];
		}
	}

	/**
	 * Finds incorrectly documented members.
	 *
	 * @protected
	 */
	_validateMembers() {
		this._collection.get( 'member' )
			.filter( member => member.name.startsWith( 'module:' ) )
			.filter( member => member.scope === 'inner' )
			.forEach( member => this._addError( member, `Incorrect member name: ${ member.name }` ) );
	}

	/**
	 * @protected
	 */
	_validateMemberofProperty() {
		this._collection.getAll()
			.filter( doclet => doclet.memberof && !doclet.memberof.startsWith( 'module:' ) )
			.forEach( doclet => {
				this._addError( doclet, `Memberof property should start with 'module:'. Got '${ doclet.memberof }' instead.` );
			} );
	}

	/**
	 * @protected
	 */
	_validateLongnamePropertyInClasses() {
		this._collection.getAll()
			.filter( doclet => doclet.longname )
			.filter( doclet => {
				const match = doclet.longname.match( /~([\w]+)\.([\w]+)$/ ); // e.g module:utils/ckeditorerror~CKEditorError.CKEditorError

				return match && match[ 1 ] === match[ 2 ];
			} )
			.forEach( doclet => {
				this._addError( doclet, `Incorrect class reference name. No doclet exists with the following name: ${ doclet.longname }` );
			} );
	}

	/**
	 * @protected
	 */
	_validateLongnameProperty() {
		this._collection.getAll()
			.filter( doclet => doclet.longname && !doclet.longname.startsWith( 'module:' ) )
			.forEach( doclet => {
				this._addError( doclet, `Longname property should start with the 'module:' part. Got ${ doclet.longname } instead.` );
			} );
	}

	/**
	 * Finds errors in parameter types.
	 *
	 * @protected
	 */
	_validateParameters() {
		for ( const doclet of this._collection.getAll() ) {
			for ( const param of doclet.params || [] ) {
				this._validateParameter( doclet, param );
			}
		}
	}

	/**
	 * @private
	 *
	 * @param {Doclet} doclet
	 * @param {Object} param
	 */
	_validateParameter( doclet, param ) {
		if ( !param.type ) {
			// Skip not typed parameters.
			return;
		}

		for ( const paramFullName of param.type.names || [] ) {
			if ( !this._isCorrectType( paramFullName ) ) {
				this._addError( doclet, `Incorrect param type: ${ paramFullName }` );
			}
		}
	}

	/**
	 * Finds errors in links.
	 *
	 * @protected
	 */
	_validateLinks() {
		const allLinkRegExp = /\{@link\s+[^}]+\}/g;
		const pathRegExp = /^\{@link\s+([^}\s]+)[^}]*\}$/;

		const optionalTagWithBracedContentRegExp = /(@[a-z]+ )?\{[^}]+\}/g;

		for ( const doclet of this._collection.getAll() ) {
			if ( !doclet.comment ) {
				continue;
			}

			// Find all missing `@link` parts inside comments.
			for ( const commentPart of doclet.comment.match( optionalTagWithBracedContentRegExp ) || [] ) {
				if ( commentPart.startsWith( '{module:' ) ) {
					// If the comment part starts with the '{module:' it means that:
					// * it's not a normal tag (tags starts with `@` and the tagName).
					// * it's not a link (the part misses the `@link` part), but it supposed to be (it contains the `module:` part).
					this._addError( doclet, `Link misses the '@link' part: ${ commentPart }` );
				}
			}

			const refs = ( doclet.comment.match( allLinkRegExp ) || [] )
				.map( link => link.match( pathRegExp )[ 1 ] );

			for ( const ref of refs ) {
				if ( !this._isCorrectReference( ref ) ) {
					this._addError( doclet, `Incorrect link: ${ ref }` );
				}
			}
		}
	}

	/**
	 * Finds errors in the 'fires' tag.
	 *
	 * @protected
	 */
	_validateEvents() {
		const eventNames = this._collection.get( 'event' ).map( event => event.longname );

		for ( const doclet of this._collection.getAll() ) {
			for ( const event of doclet.fires || [] ) {
				if ( !eventNames.includes( event ) ) {
					this._addError( doclet, `Incorrect event name: ${ event } in @fires tag` );
				}
			}
		}
	}

	/**
	 * Finds errors in the 'implements' tag.
	 *
	 * @protected
	 */
	_validateInterfaces() {
		const classesAndMixins = [ ...this._collection.get( 'class' ), ...this._collection.get( 'mixin' ) ];
		const interfaceLongNames = this._collection.get( 'interface' )
			.map( i => i.longname );

		for ( const someClassOrMixin of classesAndMixins ) {
			for ( const someInterface of someClassOrMixin.implements || [] ) {
				if ( !interfaceLongNames.includes( someInterface ) ) {
					this._addError( someClassOrMixin, `Incorrect interface name: ${ someInterface }` );
				}
			}
		}
	}

	/**
	 * @protected
	 */
	_validateModuleDocumentedExports() {
		const memberDoclets = this._collection.get( 'member' )
			.filter( member => member.scope === 'inner' )
			.filter( member => !member.undocumented );

		for ( const member of memberDoclets ) {
			if ( this._docletMap[ member.memberof ] && this._docletMap[ member.memberof ].kind === 'module' ) {
				this._addError( member, `Module ${ member.memberof } exports member: ${ member.name }` );
			}
		}
	}

	/**
	 * @protected
	 */
	_validateReturnTypes() {
		const doclets = this._collection.getAll()
			.filter( doclet => !!doclet.returns );

		for ( const doclet of doclets ) {
			if ( !doclet.returns[ 0 ].type ) {
				this._addError( doclet, 'Invalid return type.' );
				continue;
			}

			for ( const typeName of doclet.returns[ 0 ].type.names ) {
				if ( !this._isCorrectType( typeName ) ) {
					this._addError( doclet, `Invalid return type: ${ typeName }.` );
				}
			}
		}
	}

	/**
	 * @protected
	 */
	_validateSeeReferences() {
		for ( const doclet of this._collection.getAll() ) {
			for ( const seeReference of doclet.see || [] ) {
				if ( !this._isCorrectReference( seeReference ) ) {
					this._addError( doclet, `Invalid @see reference: ${ seeReference }.` );
				}
			}
		}
	}

	/**
	 * @protected
	 */
	_validateTypedefs() {
		for ( const doclet of this._collection.getAll() ) {
			for ( const prop of doclet.properties || [] ) {
				for ( const typeName of prop.type.names ) {
					if ( !this._isCorrectType( typeName ) ) {
						this._addError( doclet, `Invalid @property type: ${ typeName }.` );
					}
				}
			}
		}
	}

	/**
	 * Checks whether the reference in the `@extends` tag is correct.
	 *
	 * @protected
	 */
	_validateExtensibility() {
		for ( const doclet of this._collection.getAll() ) {
			for ( const base of doclet.augments || [] ) {
				if ( !this._isCorrectReference( base ) && !this._isValidBuiltInType( base ) ) {
					this._addError(
						doclet,
						`Invalid @extends reference: ${ base }.`
					);
				}
			}
		}

		for ( const doclet of this._collection.getAll() ) {
			for ( const base of doclet.implements || [] ) {
				const baseDoclet = this._docletMap[ base ];

				// TODO: We should only allow interfaces here.
				if ( !baseDoclet || ![ 'interface', 'function' ].includes( baseDoclet.kind ) ) {
					this._addError(
						doclet,
						`Invalid @implements reference: ${ base } - no found doclet or doclet is not an interface.`
					);
				}
			}
		}
	}

	_checkDuplicatedDoclets() {
		const docletLongNames = new Set();

		for ( const doclet of this._collection.getAll() ) {
			// Skip modules.
			// Module descriptions are mergeable.
			if ( doclet.kind === 'module' ) {
				continue;
			}

			if ( docletLongNames.has( doclet.longname ) ) {
				this._addError( doclet, 'Duplicated doclets with longname: ' + doclet.longname );
			}

			docletLongNames.add( doclet.longname );
		}
	}

	/**
	 * @private
	 * @param {Doclet} doclet
	 * @param {string} errorMessage
	 */
	_addError( doclet, errorMessage ) {
		this.errors.push( Object.assign( {
			message: errorMessage
		}, this._getErrorData( doclet ) ) );
	}

	/**
	 * @private
	 * @param {Doclet} doclet
	 */
	_getErrorData( doclet ) {
		return {
			parent: doclet.memberof,
			line: doclet.meta.lineno,
			file: doclet.meta.path + '/' + doclet.meta.filename
		};
	}

	/**
	 * Naive implementation of simple parser.
	 *
	 * @protected
	 * @param {String} type to assert
	 *
	 * @returns {Boolean}
	 */
	_isCorrectType( type ) {
		// JSDoc converts `Type.<Function>` to `Type.<function()>` for some reason...
		type = type.replace( 'function()', 'function' );

		if ( complexTypeRegExp.test( type ) ) {
			const [ , genericType, innerType ] = type.match( complexTypeRegExp );

			return GENERIC_TYPES.includes( genericType ) && this._isCorrectType( innerType );
		}

		if ( type.includes( '|' ) ) {
			return type.split( '|' ).every( unionType => this._isCorrectType( unionType ) );
		}

		if ( type.includes( ',' ) ) {
			return type.split( ',' ).every( type => this._isCorrectType( type ) );
		}

		if ( type.includes( 'module:' ) ) {
			return this._isCorrectReferenceType( type );
		}

		type = type.trim();

		return this._isValidBuiltInType( type ) ||
			this._isStringLiteralType( type );
	}

	/** @private */
	_isValidBuiltInType( type ) {
		return ALL_TYPES.includes( type );
	}

	/**
	 * A string literal type - e.g. 'forward' or 'backward';
	 *
	 * @private
	 */
	_isStringLiteralType( type ) {
		return /^'[^']+'$/.test( type );
	}

	/**
	 * @private
	 * @param {String} type
	 */
	_isCorrectReference( type ) {
		type = type.trim();

		if ( !type.includes( 'module:' ) ) {
			return false;
		}

		return !!this._docletMap[ type ];
	}

	/**
	 * Returns `true` when the reference points to the symbol which is one of:
	 * * `class`
	 * * `interface`
	 * * `typedef`
	 * * `function`
	 *
	 * @private
	 * @param {String} type
	 */
	_isCorrectReferenceType( type ) {
		type = type.trim();

		if ( !type.includes( 'module:' ) ) {
			return false;
		}

		const doclet = this._docletMap[ type ];

		if ( !doclet ) {
			return false;
		}

		return doclet.kind === 'class' ||
			doclet.kind === 'interface' ||
			doclet.kind === 'typedef' ||
			doclet.kind === 'function';
	}
}

/**
 * @param {Array.<Doclet>} doclets
 */
function createDocletMap( doclets ) {
	/** @type {Record.<String,Doclet>} */
	const docletMap = {};

	for ( const doclet of doclets ) {
		docletMap[ doclet.longname ] = doclet;
	}

	return docletMap;
}

module.exports = DocletValidator;

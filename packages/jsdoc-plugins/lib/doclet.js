/**
 * @license Copyright (c) 2003-2019, CKSource - Frederico Knabben. All rights reserved.
 * Licensed under the terms of the MIT License (see LICENSE.md).
 */

/**
 * Doclets are atomic parts of the JSDoc output that describe each symbol of parsed input.
 *
 * @typedef {Object} Doclet
 *
 * @property {String} longname Long name of the doclet (including the `module:` part).
 * @property {String} name Short name of the doclet (e.g. the name of the method).
 * @property {String} memberof Where the doclet belongs to (parent of the symbol).
 * @property {'class'|'interface'|'mixin'|'function'|'typedef'|'event'|'member'|'constant'|'module'} kind The kind of the doclet's symbol.
 * @property {Boolean} [ignore] `true` for internal doclets which should not be published
 * @property {Boolean} [undocumented] `true` when a doclet's symbol does not have API docs written above the declaration.
 * @property {String} [inheritdoc] Warning: When the `@inheritdoc` is present, then in most cases the property
 * becomes  an empty string!
 * @property {Boolean} [overrides]
 * @property {Array.<Property>} [properties] Typedef properties.
 * @property {Boolean} [inherited] `true` for a property / method which is inherited from the parent class.
 * @property {String} [inherits] The longname of the parent class / interface method.
 * @property {String} [comment] Raw API comment.
 * @property {String} [description] API Comment wrapped in HTML tags.
 * @property {Array.<Object>} [params] Event and function params.
 * @property {'instance'|'inner'|'static'} [scope]
 * @property {Array.<String>} [fires] An array of events that a method or a property can fire.
 * @property {Object} meta Doclet's metadata - filename, line number, etc.
 * @property {Array.<String>} [augments] An array of classes that the doclet's symbol extends.
 * Applies for `@class`, `@mixin`, `@interface`.
 * @property {Array.<String>} [mixes] An array of mixins that the doclet's symbol mixes.
 * Applies for `@class` and `@mixin`.
 * @property {Array.<String>} [implements] An array of interfaces that the doclet's symbol implements.
 * Applies for `@class` and `@mixin`.
 * @property {Array.<String>} [augmentsNested] [A custom property used by the relation fixer] -
 * an array of all classes in the inheritance chain augmenting the current doclet's symbol.
 * @property {Array.<String>} [mixesNested] [A custom property used by the relation fixer] -
 * an array of all mixins in the inheritance chain augmenting the current doclet's symbol.
 * @property {Array.<String>} [implementsNested] [A custom  property used by the relation fixer] -
 * an array of all interfaces in the inheritance chain, which the current doclet's symbol implements.
 * @property {Array.<String>} [descendants] [A custom  property used by the relation fixer] -
 * an array of doclets which inherits / implements / mixes the doclet's symbol.
 */

/**
 * @typedef {Object} Property
 *
 * @property {String } name
 * @property {Object} type
 * @property {String} description
 * @property {Boolean} [inherited] [A custom  property used by the relation fixer]
 */

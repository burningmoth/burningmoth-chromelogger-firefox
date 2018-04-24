"use strict";
/**
 * Global scripts.
 * @since 1.5
 */

const DEFAULT_OPTIONS = {
	console_substitution_styles: {
		error: 'color:red;',
		warn: 'color:orange;',
		info: 'color:limegreen;',
		log: '',
		group: 'color:mediumturquoise;border-bottom:1px dashed;cursor:pointer;',
		number: 'background-color:dodgerblue;color:white;font-weight:bold;border-radius:0.5em;padding:0em 0.3em;',
		fileline: 'color:mediumpurple;font-style:italic;border-style:solid;border-width:0px 1px;border-radius:0.5em;padding:0em 0.5em;'
	}
};


/**
 * Array.map callback
 * Removes "__proto__" and "length" properties from objects and arrays.
 * @since 1.3
 * @param mixed obj
 * @return mixed
  */
function cleanObjectProperties( obj ) {

	// not an object ? return as-is ...
	if ( typeof obj !== 'object' ) return obj;

	// removes length property from arrays ...
	if ( Array.isArray(obj) ) obj = Object.assign({}, obj);

	// remove annoying __proto__ property ...
	obj.__proto__ = null;

	// recurse through properties ...
	Object.entries(obj).forEach(([ key, value ])=>{ obj[ key ] = cleanObjectProperties( value ); });

	// return cloned object ...
	return obj;

}

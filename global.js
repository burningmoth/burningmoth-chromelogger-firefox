"use strict";
/**
 * Global scripts.
 */

/**
 * Default options object.
 * @since 1.5
 * @since 1.7
 *	- added classname substitution style.
 *	- added display_data_url option.
 * @var object
 */
const DEFAULT_OPTIONS = {
	console_substitution_styles: {
		error: 'color:red;',
		warn: 'color:orange;',
		info: 'color:limegreen;',
		log: '',
		group: 'color:mediumturquoise;border-bottom:1px dashed;cursor:pointer;',
		number: 'background-color:dodgerblue;color:white;font-weight:bold;border-radius:0.5em;padding:0em 0.3em;',
		fileline: 'color:mediumpurple;font-style:italic;border-style:solid;border-width:0px 1px;border-radius:0.5em;padding:0em 0.5em;',
		classname: 'font-weight:bold;',
		header: 'display:block;background-color:black;color:white;text-align:center;padding:0.2em;border-radius:0.3em;'
	},
	display_data_url: true
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
	if ( typeof obj !== 'object' || obj === null ) return obj;

	// removes length property from arrays ...
	if ( Array.isArray(obj) ) obj = Object.assign({}, obj);

	// remove annoying __proto__ property ...
	obj.__proto__ = null;

	// recurse through properties ...
	Object.entries(obj).forEach(([ key, value ])=>{ obj[ key ] = cleanObjectProperties( value ); });

	// return cloned object ...
	return obj;

}

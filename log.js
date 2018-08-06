"use strict";
/**
 * Injection script.
 *
 * @since 1.0
 * @since 1.5
 *	- moved all data processing to bg.js onDevPortMessage()
 *	- updated to use data.args processed from data.rows
 * @param object data
 *	- processed ChromeLogger data sent from Tab.log()
 */
browser.runtime.onMessage.addListener(( data )=>{
	data.args.forEach(args=>{
		try {
			window.console[ args.shift() ].apply(null, args.map(cleanObjectProperties));
		} catch ( error ) {
			window.console.error( args, error );
		}
	});
});

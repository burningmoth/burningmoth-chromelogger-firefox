"use strict";
/**
 * DevTools
 * Triggers the parsing, processing and outputting to the web console messages encoded in X-ChromeLogger-Data headers.
 */

/**
 * Connects the tab these devtools are open on to the background and content scripts via runtime.onConnect
 * @since 1.0
 * @var runtime.Port
 */
var port = browser.runtime.connect({
	// this is used as a tab key to mark open console sessions and derive the tabId from ...
	name: 'tab' + browser.devtools.inspectedWindow.tabId
});


/**
 * Listener / In the unlikely event of disconnect from the background process.
 * @since 1.0
 * @param runtime.Port
 */
port.onDisconnect.addListener(( port ) => {
	if ( port.error ) console.error( 'Disconnected due to error: %s', port.error.message );
	else console.error( '%s has been disconnected!', port.name );
});


/**
 * Listener / Passed details from Tab.onHeadersReceived() handler, passes them back to onDevPortMessage() for processing if the devtools here are open.
 *
 * @since 1.0
 * @since 1.2
 *	- distinguish between tabs.onHeadersReceived and ChromeLoggerData
 *	- convert ChromeLoggerData into script and eval against inspectedWindow
 * @since 1.5
 *	- moved all data processing to bg.js onDevPortMessage()
 *	- updated to use data.args processed from data.rows
 * @since 1.7
 *	- parse <script[data-chromelogger-rows]> nodes data-chromelogger-version and data-chromelogger-columns attributes
 *	- parse <script[data-chromelogger-data]> nodes.
 * @since 2.0
 *	- removed details.processContentUrl processing, moved to log.js
 *
 * @param tabs.onHeadersReceived|ChromeLoggerData details
 */
port.onMessage.addListener(( details ) => {

	// details contains response headers ? bounce back to background script for processing ...
	if ( details.responseHeaders ) port.postMessage( details );

	// ChromeLoggerData ? sent here if log.js fails to inject into the tab ...
	else if ( details.args ) {

		browser.devtools.inspectedWindow.eval(
			'(function(){ '
				+ cleanObjectProperties.toString() + ' '
				+ JSON.stringify(details.args) + '.forEach(args=>{ '
					+ 'try { '
						+ 'console[ args.shift() ].apply(null, args.map(cleanObjectProperties)); '
					+ '} catch ( error ) { console.error(error); } '
				+ '}); '
				+ 'return true; '
			+ '})();'
		).then(([ success, failure ])=>{
			if ( failure ) console.error(failure);
		});

	}

});

"use strict";
/**
 * Injection script.
 *
 * @since 1.0
 * @since 1.5
 *	- moved all data processing to bg.js onDevPortMessage()
 *	- updated to use data.args processed from data.rows
 * @since 2.0
 *	- tabId is passed upon initialization from bg.js.
 *
 * @param object details
 *	- processed ChromeLogger data sent from Tab.log() or tabId upon initialization
 */
browser.runtime.onMessage.addListener(( details )=>{

	// has args ? processed chromelogger data, output to console ...
	if ( details.args ) {

		details.args.forEach(args=>{
			try {
				window.console[ args.shift() ].apply(null, args.map(cleanObjectProperties));
			} catch ( error ) {
				window.console.error( error, args );
			}
		});

	}

	// has tabId ? parse any chromelogger data from document ...
	else if ( details.tabId ) {

		// array of ChromeLoggerData objects ...
		let data = [];

		// check for old DOM elements, issue notice if found ...
		if ( document.querySelector('script[data-chromelogger-data],script[data-chromelogger-rows]') ) data.push({
			columns: [ 'type', 'log' ],
			rows: [[ 'info', [
				"Support for parsing %c<script data-chromelogger-data>%c and %c<script data-chromelogger-rows>%c nodes from DOM has been removed from %s %s.\n\nPlease upgrade to %c<script id=\"chromelogger\" type=\"application/json\">%c nodes instead.\n\nSee %s for details.",
				'font-family:monospace;color:red;',
				'font-family:unset;color:unset;',
				'font-family:monospace;color:red;',
				'font-family:unset;color:unset;',
				browser.runtime.getManifest().name,
				browser.runtime.getManifest().version,
				'font-family:monospace;color:dodgerblue;',
				'font-family:unset;color:unset;',
				browser.runtime.getManifest().homepage_url
			] ]],
			version: '2.0'
		});

		// parse #chromelogger JSON script blocks ...
		document.querySelectorAll('script[type^="application/json"]#chromelogger').forEach(node=>{

			try {

				// parse JSON or throw error ...
				let value = JSON.parse(node.innerText);

				// array ? format rows into chromelogger data object ...
				if (
					Array.isArray(value)
				) data.push({
					rows: value,
					columns: (
						( value = node.dataset.chromeloggerColumns )
						? value.replace(/\s/,'').split(',')
						: [ 'log', 'backtrace', 'type' ]
					),
					version: (
						( value = node.dataset.chromeloggerVersion )
						? value
						: '2.0'
					)
				});

				// object w/rows array ? chromelogger data object ...
				else if (
					typeof value == 'object'
					&& value.rows
					&& Array.isArray(value.rows)
				) data.push(value);

				// fail ! invalid data ...
				else window.console.error('Invalid ChromeLogger Data!', value);

			} catch ( error ) {
				window.console.error(error, node.innerText);
			}

		});

		// send back any data to process ...
		data.forEach(data=>{
			data.tabId = details.tabId;
			browser.runtime.sendMessage(data).catch(error=>{ console.error(error); });
		});

	}

});

"use strict";
/**
 * Background script.
 * All the routine heavy lifting should be done here and the results cordinated betweent devtools.js devtools script and log.js content script.
 */

/**
 * Collection of keyed tab objects connected when devtools are opened on a tab.
 * @since 1.0
 * @var object tabs
 */
var tabs = {};


/**
 * Return tab id integer from port.name.
 * @since 1.0
 * @param runtime.Port port
 * @return integer
 */
function tabIdFromPort( port ) {
	return parseInt( port.name.substr(3) );
}


/**
 * Return tabs object key from id integer.
 * @since 1.0
 * @param integer tabId
 * @return string
 */
function tabKeyFromId( tabId ) {
	return 'tab'.concat(tabId);
}


/**
 * Returns a tab object from id.
 * @since 1.0
 * @param integer
 * @return Tab|undefined
 */
function tabFromId( tabId ) {
	return tabs[ tabKeyFromId( tabId ) ];
}


/**
 * Tab class.
 */
class Tab {

	/**
	 * @since 1.0
	 * @param integer tabId
	 * @param runtime.Port port
	 */
	constructor( tabId, port ){

		/**
		 * Tab id.
		 * @since 1.0
		 * @var integer
		 */
		this.id = tabId;

		/**
		 * Incoming connection from devtools being loaded / set by runtime.onConnect listener.
		 * @since 1.0
		 * @var runtime.Port
		 */
		this.devPort = port;

		/**
		 * Contains pending data while tab main frame is loading.
		 * @since 1.0
		 * @var array
		 */
		this.pending = [];

		/**
		 * Reflects tab DOMReady state. When true the tab is ready to receive messages.
		 * @since 1.1
		 * @var bool
		 */
		this.ready = false;

		/**
		 * Fallback to devtools for reporting should log.js script injection fail onDOMReady.
		 * @since 1.2
		 * @var bool
		 */
		this.fallback = false;

		/**
		 * Sends header details to devtools which, if open, will send them back to onDevPortMessage()
		 * @since 1.0
		 * @param webRequest.onHeadersReceived details
		 * @note This way we're only processing headers when the user can see output from them logged to the web console.
		 * @note Setting up an anonymous function this way in order to make the handler for this tab distinct from that of others so the event handler can tell difference.
		 */
		this.onHeadersReceived = function( details ) {
			tabs[ tabKeyFromId( details.tabId ) ].devPort.postMessage( details );
		}

	}


	/**
	 * Logs data to log.js
	 * @since 1.0
	 * @since 1.2
	 *	- send data back on port if Tab.fallback == true
	 * @param object data
	 *	- ChromeLogger Data
	 */
	log( data ){

		// tab is DOMReady ? send to log.js now !
		if ( this.ready ) browser.tabs.sendMessage( this.id, data );

		// fallback to devtools.inspectedWindow.eval() ? send back through the port now !
		else if ( this.fallback ) this.devPort.postMessage( data );

		// tab document still loading ! queue in pending data to be sent by tabs.onUpdated listener on complete
		else this.pending.push( data );

	}


	/**
	 * Instructs devtools to extract additional information from post-headers loaded content to log.
	 * @since 1.5
	 * @param string url
	 *	- url of the tab frame to extract from
	 *	- not yet supported as of ChromeLogger 1.5 / Firefox 60, to be implemented when support arrives
	 */
	processContentUrl( url ){
		this.devPort.postMessage({ 'processContentUrl': url });
	}

}


/**
 * Removes a corresponding tab and events / used as tabs.onRemoved handler too.
 * @since 1.0
 * @param integer tabId
 */
function onTabRemoved( tabId ) {

	var tabKey = tabKeyFromId(tabId),
		tab = tabs[ tabKey ];

	if ( tab ) {

		// disconnect ports ...
		tab.devPort.disconnect();

		// remove handler ...
		browser.webRequest.onHeadersReceived.removeListener( tab.onHeadersReceived );

		// remove tab ...
		delete tabs[ tabKey ];

	}

}


/**
 * Process ChromeLogger data rows into console args.
 * @since 1.5
 * @param ChromeLoggerData object data
 */
function processChromeLoggerData( data ) {

	return new Promise( resolve => {

		// load options, process data, pass to Tab.log() ...
		browser.storage.sync.get(DEFAULT_OPTIONS).then(opts=>{

			// map to console method args array ...
			data.args = data.rows.map(row=>{

				var [ args, fileline, method ] = row,
					style = '',
					tmpl_pattern = '',
					tmpl_args = [];

				// ensure arguments is array ...
				if ( !Array.isArray(args) ) args = [ args ];

				// ensure method ...
				if ( !method ) method = 'log';

				// process arguments ...
				if ( args.length > 0 ) {

					// detect, passthru an existing substitution pattern ...
					if (
						typeof args[0] == 'string'
						&& /%(s|d|i|f|o|O|c|\.\d+(d|i|f))/.test(args[0])
					) {
						tmpl_pattern = args.shift();
						tmpl_args = args;
					}

					// generate pattern ...
					else {

						// make array ...
						tmpl_pattern = [];

						// populate pattern and args arrays ...
						args.forEach(arg=>{

							switch ( typeof arg ) {

								case 'string':

									style = opts.console_substitution_styles[( method == 'groupCollapsed' ? 'group' : method )];

									if ( style ) {
										tmpl_pattern.push('%c%s%c');
										tmpl_args.push(style, arg, '');
									}
									else {
										tmpl_pattern.push('%s');
										tmpl_args.push(arg);
									}
									break;

								case 'number':

									style = opts.console_substitution_styles['number'];

									if ( style ) {
										tmpl_pattern.push('%c%s%c');
										tmpl_args.push(style, arg, '');
									}
									else {
										tmpl_pattern.push('%s');
										tmpl_args.push(arg);
									}
									break;

								default:
									tmpl_pattern.push('%o');
									tmpl_args.push(arg);
									break;

							}

						});

						// stringify pattern ...
						tmpl_pattern = tmpl_pattern.join(' ');

					}

				}

				// append fileline ...
				if ( fileline ) {

					// add a space if there is other pattern content ...
					if ( tmpl_pattern ) tmpl_pattern = tmpl_pattern.concat(' ');

					style = opts.console_substitution_styles['fileline'];

					if ( style ) {
						tmpl_pattern = tmpl_pattern.concat('%c%s');
						tmpl_args.push(style, fileline);
					}
					else {
						tmpl_pattern = tmpl_pattern.concat('%s');
						tmpl_args.push(fileline);
					}

				}

				// prepend string pattern to arguments ...
				if ( tmpl_pattern ) tmpl_args.unshift( tmpl_pattern );

				// prepend method ...
				tmpl_args.unshift( method );

				// return processed arguments ...
				return tmpl_args;

			});

			// return processed data ...
			resolve(data);

		})
		.catch(error=>{ console.error(error); });

	});

}


/**
 * Tab.devPort runtime.Port.onMessage event handler.
 * Catches and processes header details sent by Tab.onHeadersReceived() handler to and passed back from a verified open devtools.
 * @since 1.0
 * @since 1.5
 *	- accept rows array retrieved from document by devtools ...
 * @param tabs.onHeadersReceived details
 */
function onDevPortMessage( details ) {

	// details object passed through the open devtools ...
	if ( details.responseHeaders ) {

		// parse headers ...
		details.responseHeaders.forEach(( header )=>{

			// ChromeLogger data ! decode and process
			if ( header.name.toLowerCase() == 'x-chromelogger-data' ) {

				try {

					// base64 decode / parse JSON ...
					var data = JSON.parse( atob( header.value ) );

					// append method url to first entry ...
					data.rows[0][0].push('-', details.method, details.url);

					// process and log ...
					processChromeLoggerData( data ).then(data=>{
						tabFromId( details.tabId ).log( data );
					});

				} catch( error ) { console.error(error); }

			}

		});

	}

	// ChromeLogger rows passed from document from devtools ...
	else if ( details.rows ) {

		processChromeLoggerData( details ).then(data=>{
			tabFromId( details.tabId ).log( data );
		});

	}

}


/**
 * Tab.devPort runtime.Port.onDisconnect event handler.
 * @since 1.0
 * @param runtime.Port port
 */
function onDevPortDisconnect( port ) {

	// report error ...
	if ( port.error ) console.error('Disconnected due to error:', port.error.message);
	else console.error( port.name, 'has been disconnected!' );

	// remove tab if any exists ...
	onTabRemoved( tabIdFromPort(port) );

}


/**
 * Listener / Assigns tab object and handlers connecting devtools context when devtools are opened on a tab.
 * @since 1.0
 * @param runtime.Port port
 */
browser.runtime.onConnect.addListener(( port ) => {

	var tabId = tabIdFromPort(port),
		tabKey = port.name,
		tab = tabs[ tabKey ];

	// ports change when devtools are closed/opened so [re]assign port event handlers ...
	port.onDisconnect.addListener(onDevPortDisconnect);
	port.onMessage.addListener(onDevPortMessage);

	// no tab ? create it ...
	if ( !tab ) tab = tabs[ tabKey ] = new Tab( tabId, port );
	// update existing port ...
	else tab.devPort = port;

	// no tab specific anon (IMPORTANT!) listener assigned to catch headers ? assign now ...
	if ( !browser.webRequest.onHeadersReceived.hasListener( tab.onHeadersReceived ) ) {
		browser.webRequest.onHeadersReceived.addListener(
			tab.onHeadersReceived,
			{
				"urls": [ "<all_urls>" ],
				"types": [ "xmlhttprequest", "sub_frame", "main_frame", "ping", "script", "stylesheet" ],
				"tabId": tabId
			},
			[ "responseHeaders" ]
		);
	}

});


/**
 * Listener / Assigns onTabRemoved handler for tab removal events.
 * @note Tried to track closing browser.windows events but it doesn't work as of 2017Oct08
 * @todo Whenever a devtools close event becomes available, bind to that instead of this!
 * @since 1.0
 * @param integer tabId
 */
browser.tabs.onRemoved.addListener(onTabRemoved);


/**
 * Reset tab ready state.
 * @since 1.1
 */
browser.webNavigation.onBeforeNavigate.addListener(( details )=>{
	var tab = tabFromId( details.tabId );
	if ( tab && details.frameId == 0 ) {
		tab.ready = false;
		tab.fallback = false;
	}
});


/**
 * Inject log.js and update tab ready state.
 * @since 1.1
 * @since 1.2
 *	- added fallback to devtools reporting if script injection fails
 * @since 1.5
 *	- finally tell tab to process loaded DOM content for additional info to log
 */
browser.webNavigation.onDOMContentLoaded.addListener(( details )=>{

	var tab = tabFromId( details.tabId );
	if ( tab ) {

		// main tab document ...
		if ( details.frameId == 0 ) {

			browser.tabs.executeScript( details.tabId, {
				file: '/log.js',
				code: cleanObjectProperties.toString(),
			})
			.then(()=>{

				// update ready state ...
				tab.ready = true;

				// send any pending items ...
				while ( tab.pending.length ) browser.tabs.sendMessage( details.tabId, tab.pending.shift() );

			}).catch(()=>{

				// fallback to devTools.inspectedWindow.eval() !!!
				tab.fallback = true;

				// send any pending items back through the dev port ...
				while ( tab.pending.length ) tab.devPort.postMessage( tab.pending.shift() );

			}).finally(()=>{

				// extract any info to log from the frame ...
				tab.processContentUrl( details.url );

			});

		}

		// @todo activate when devtools.inspectedWindow.eval() supports the 'options' argument
		//else tab.processContentUrl( details.url );

	}

});

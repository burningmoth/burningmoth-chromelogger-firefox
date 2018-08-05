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
 * @since 1.7
 * 	- flexible support for different row.column arrangments
 * @param ChromeLoggerData object data
 */
function processChromeLoggerData( data ) {

	return new Promise( resolve => {

		// load options, process data, pass to Tab.log() ...
		browser.storage.sync.get(DEFAULT_OPTIONS).then(opts=>{

			// ensure lowercase columns array ...
			data.columns = (
				! data.columns
				|| ! Array.isArray(data.columns)
				? [ 'log', 'backtrace', 'type' ]
				: data.columns.map(column=>{ return column.toLowerCase(); })
			);

			// map to rows array to console method args ...
			data.args = data.rows.map(row=>{

				// convert row to object w/columns mapped to properties ...
				row = row.reduce(function( row, value, index ){
					row[ data.columns[ index ] ] = value;
					return row;
				}, { 'log': [], 'backtrace': false, 'type': 'log' });

				var

				// console method / @see https://developer.mozilla.org/en-US/docs/Web/API/Console
				method = row.type,

				// console.[method] arguments ...
				args = row.log,

				// file:line ...
				fileline = row.backtrace,

				// substitution pattern ...
				tmpl_pattern = '',

				// substition arguments ...
				tmpl_args = [];

				// ensure arguments is array ...
				if ( ! Array.isArray(args) ) args = [ args ];

				// assertion ? ...
				if ( method == 'assert' ) {
					// resolves true ? log nothing ...
					if ( args.shift() ) return false;
					// false ! log error ...
					else method = 'error';
				}

				// process arguments ...
				if (
					args.length > 0
					&& [ 'log', 'info', 'warn', 'error', 'group', 'groupCollapsed' ].includes(method)
				) {

					// detect, passthru an existing substitution pattern ...
					if (
						typeof args[0] == 'string'
						&& /(^|[^%])%(s|d|i|f|o|O|c|\.\d+(d|i|f))/.test(args[0])
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
									tmpl_pattern.push('%c%s%c');
									tmpl_args.push(
										opts.console_substitution_styles[(
											method == 'groupCollapsed'
											? 'group'
											: method
										)],
										// unescape any passed substitution patterns ...
										arg.replace(/%{2,}(s|d|i|f|o|O|c|\.\d+(d|i|f))/g, '%$1'),
										''
									);
									break;

								case 'number':
									tmpl_pattern.push('%c%s%c');
									tmpl_args.push(opts.console_substitution_styles.number, arg, '');
									break;

								case 'object':

									// has special class name property ? prepend and remove ...
									if ( arg.hasOwnProperty('___class_name') ) {
										tmpl_pattern.push('%c%s%c');
										tmpl_args.push(opts.console_substitution_styles.classname, arg.___class_name, '');
										delete arg.___class_name;
									}
									// no break, passthru ...

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

				// straight arguments for all other console methods, no backtrace ...
				else {
					tmpl_args = args;
					fileline = false;
				}

				// append fileline ...
				if ( fileline ) {

					// add a space if there is other pattern content ...
					if ( tmpl_pattern ) tmpl_pattern = tmpl_pattern.concat(' ');

					tmpl_pattern = tmpl_pattern.concat('%c%s');
					tmpl_args.push(opts.console_substitution_styles.fileline, fileline);

				}

				// prepend string pattern to arguments ...
				if ( tmpl_pattern ) tmpl_args.unshift( tmpl_pattern );

				// prepend method ...
				tmpl_args.unshift( method );

				// return processed arguments ...
				return tmpl_args;

			}).filter( args => args !== false );

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
 * @since 1.7
 *	- also checks for X-ChromePHP-Data header
 *	- logs details url, method separately as chromelogger data
 * @param tabs.onHeadersReceived details
 */
function onDevPortMessage( details ) {

	// details object passed through the open devtools ...
	if ( details.responseHeaders ) {

		// headers to process data from ...
		var headers = [ 'x-chromelogger-data', 'x-chromephp-data' ];

		// parse headers ...
		details.responseHeaders.forEach(( header )=>{

			// ChromeLogger data ! decode and process ...
			if ( headers.includes( header.name.toLowerCase() ) ) {

				// load options, process ...
				browser.storage.sync.get(DEFAULT_OPTIONS).then(opts=>{

					// display data url ? log it as chromelogger data ...
					if ( opts.display_data_url ) processChromeLoggerData({
						rows: [[[
							'%c%s %s',
							opts.console_substitution_styles.header,
							details.method,
							details.url
						]]]
					}).then(data=>{
						tabFromId( details.tabId ).log( data );
					});

					// attempt to parse data from header ...
					try {

						// base64 decode / parse JSON ...
						var data = JSON.parse( atob( header.value ) );

						// process and log ...
						processChromeLoggerData( data ).then(data=>{
							tabFromId( details.tabId ).log( data );
						});

					} catch( error ) { console.error(error); }

				});

			}

		});

	}

	// ChromeLogger rows passed through devtools from DOM ...
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
 * @since 1.7
 *	- removed onHeadersReceived listener "types" to process headers from ALL resources.
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

			// inject log.js to receive messages sent to tab ? ...
			browser.tabs.executeScript( details.tabId, { file: '/log.js' })
			.then(()=>{

				// load global functions required by log.js / assume this works at this point ...
				browser.tabs.executeScript( details.tabId, { file: '/global.js' })
				.finally(()=>{

					// update ready state ...
					tab.ready = true;

					// send any pending items ...
					while ( tab.pending.length ) browser.tabs.sendMessage( details.tabId, tab.pending.shift() );

				});

			// unable to inject script ! fallback to devtools functions ...
			}).catch(()=>{

				// fallback to devTools.inspectedWindow.eval() !!!
				tab.fallback = true;

				// send any pending items back through the dev port ...
				while ( tab.pending.length ) tab.devPort.postMessage( tab.pending.shift() );

			// additional processes ...
			}).finally(()=>{

				// extract any info to log from the frame ...
				tab.processContentUrl( details.url );

			});

		}

		// @todo activate when devtools.inspectedWindow.eval() supports the 'options' argument
		//else tab.processContentUrl( details.url );

	}

});

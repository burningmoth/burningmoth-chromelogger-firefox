# Chrome Logger Firefox WebExtension

WebExtension implementing [Chrome Logger protocol](https://craig.is/writing/chrome-logger/techspecs) for Firefox.

To log data to the web console _after_ headers have been sent, the following methods are supported:
	
	<script
		data-chromelogger-version="1.0" 
		data-chromelogger-columns="log,backtrace,type"
		data-chromelogger-rows="var_name"
	>
		var var_name = [[log, backtrace, type],...];
	</script>	

Attributes `data-chromelogger-version` and `data-chromelogger-columns` are optional and default to the values shown if missing. Or log the entire data object that would've otherwise been the base64-encoded header value:

	<script data-chromelogger-data="var_name">
		var var_name = { ChromeLoggerData Object };
	</script>


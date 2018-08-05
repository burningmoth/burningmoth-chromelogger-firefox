# Chrome Logger Firefox WebExtension Change Log

### 2018 Aug 04 / Version 1.7.1
* Fixed: broken `table` and various other `console` methods.
* Fixed: inadequate substitution pattern detection and subsequent unescaping.

### 2018 Aug 03 / Version 1.7
* Fixed: columns arrays that were arranged in ways or [in|ex]cluded columns other than what was explicitly specified by the protocol failed to process. @shoutout Zxurian
* Added: Support for `[object].___class_name` and Class Name substitution styling.
* Added: Support for `X-ChromePHP-Data` headers.
* Updated: Now scans headers from all resource types.
* Updated: `data-chromelogger-version="1.0"` and `data-chromelogger-columns="log,backtrace,type"` optional attributes parsed from `<script[data-chromelogger-rows]>` nodes.
* Added: `<script[data-chromelogger-data]>` node parsing.
* Added: `display_data_url=[bool]` setting and Data Header substitution styling.
* Updated: removed "METHOD url" display from being appended to first parsed data row, logged separately if `display_data_url=true`.

### 2018 Apr 24 / Version 1.6.1
* Fixed: trying (and failing, of course) to process null values as objects w/enumerated properties.
* Fixed: tabs.executeScript() fails injecting both file + code, throws to devtools fallback.

### 2018 Apr 23 / Version 1.6
* Restored: removal of `__proto__` and `length` properties from objects and arrays.

### 2018 Mar 26 / Version 1.5
* Added: console message styling for various contexts w/options page to customize.
* Added: parsing of ChromeLogger formatted rows data from loaded DOM content. Syntax: `<script data-chromelogger-rows="{key}">var {key} = [[log, backtrace, type], ...];</script>`
* Issue: cannot retrieve rows data from subframes DOM until Firefox supports devtools.inspectedWindow.eval() options parameter!
* Regression: `__proto__` and `length` object and array properties no longer removed. Problematic.

### 2018 Mar 18 / Version 1.4
* Updated: chromelogger protocol trace value now appended to passed console method arguments. @shoutout Erik

### 2017 Dec 23 / Version 1.3
* Added: `__proto__` and `length` properties are removed from objects and arrays respectively output to web console.

### 2017 Dec 16 / Version 1.2
* Added: Tab.fallback, flagged true if log.js fails to inject onDOMReady as in the case when Firefox loads JSON viewer in the tab inspectedWindow.
* Updated: Tab.log() sends parsed ChromeLoggerData back to dev.js if Tab.fallback is true.
* Updated: dev.js runtime.Port.onMessage handler stringifies and runs ChromeLoggerData from Tab.log() through devtools.inspectedWindow.eval(), dirty but effective.

### 2017 Nov 29 / Version 1.1.1
* Updated: Chrome Logger data row values validation, replacement on missing with defaults. @shoutout Honza
* Fixed: warning on icon being wrong size.

### 2017 Nov 19 / Version 1.1
* Added: webNavigation event handlers to replace spotty tab.onUpdated event handler.
* Updated: Chrome Logger data rows callback catches malformed row data.

### 2017 Nov 17 / Version 1.0.1
* Fixed: was matching against case sensitive X-ChromeLogger-Data header. Now case insensitive match. @shoutout Jan

### 2017 Oct 10 / Version 1.0
* Maiden voyage.
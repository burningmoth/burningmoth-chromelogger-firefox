"use strict";
/**
 * Options page scripts.
 * @since 1.5
 */


/**
 * Populate form from options.
 * @param object opts
 */
function populateForm( opts ) {

	// populate substitution styles ...
	Object.entries(opts.console_substitution_styles).forEach(([key, value])=>{
		let input = document.querySelector( 'input#console_substitution_styles-'.concat(key) );
		if ( input ) {
			input.value = value;
			input.dispatchEvent(new Event('keyup')); // trigger change event to update label
		}
	});

}


document.addEventListener("DOMContentLoaded", event=>{

	// style inputs ...
	let console_substitution_style_inputs = document.querySelectorAll("form fieldset#console_substitution_styles input");

	// update label style on input update ...
	console_substitution_style_inputs.forEach(input=>{
		input.addEventListener("keyup", event=>{
			event.target.previousElementSibling.style = event.target.value;
		});
	});

	// populate form from options ...
	browser.storage.sync.get(DEFAULT_OPTIONS)
	.then(populateForm)
	.catch(error=>{ console.error(error); });

	// onsubmit ...
	document.querySelector("form").addEventListener("submit", event=>{

		event.preventDefault();

		// reset ...
		if ( event.explicitOriginalTarget.id == 'reset' ) {

			// set from default options ? update form from default options ...
			browser.storage.sync.set(DEFAULT_OPTIONS)
			.then(()=>{
				populateForm(DEFAULT_OPTIONS);
			})
			.catch(error=>{ console.error(error); });

		}

		// save ...
		else {

			// styles collection ...
			let console_substitution_styles = {};

			// update collection ...
			console_substitution_style_inputs.forEach(input=>{
				console_substitution_styles[ input.id.substr( input.id.indexOf('-') + 1 ) ] = input.value;
			});

			// save styles ...
			browser.storage.sync.set({ console_substitution_styles: console_substitution_styles })
			.catch(error=>{ console.error(error); });

		}

	});


});




function closeDialog(){
	// We fill the options with the form values
	for(var key in currentOptions) {
		field = document.getElementById(`config_${key}`)
		if(field) {
			if(key=="targets") {
				currentOptions[key] = JSON.parse(field.value);
			} else {
				currentOptions[key] = field.value;
			}
		}
	}
	tableau.extensions.settings.set("options",JSON.stringify(currentOptions));
	tableau.extensions.settings.saveAsync().then(() => {
		tableau.extensions.ui.closeDialog("All done, thanks");
	});
}

$(document).ready(function() {
	tableau.extensions.initializeDialogAsync()
	.then(openPayload => {

		// Now we're going to try and get all the settings
		currentOptions = tableau.extensions.settings.get("options");

		if(currentOptions == null){
			// There is nothing to fill so we fill with default placeholders
			currentOptions = {
				linkingSourceName: "xhorsederby (test-schema)",
				inputColumn:  "Derby Title Link",
				outputColumn:  "Horse Name Link",
				targets: [
					{sheetName: "Sheet 1", columnName: "Horse Name"}
				],
				filterTitle: "Derby Title",
				allowNone: true
			}
		} else {
			currentOptions = JSON.parse(currentOptions);
		}

		// We fill the form with the current values
		for(var key in currentOptions) {
			field = document.getElementById(`config_${key}`)
			if(field) {
				if(key=="targets") {
					field.innerHTML = JSON.stringify(currentOptions[key]);
				} else {
					field.value = currentOptions[key];
				}
			}
		}

	});

	document.getElementById('close_button').addEventListener("click", closeDialog)
});

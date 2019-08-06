configurationURL = "http://localhost:8765/NestedFilter/configure.html"
options = {};
inputSelection = [];

function getSourceByNames(dash,sheetName, sourceName) {
	sheet = dash.worksheets.find( worksheet => worksheet.name == sheetName )
	return sheet.getDataSourcesAsync()
	.then( datasources => {
		return datasources.find( source => source.name == sourceName);	
	});
}

function getSelectionList(dash, sheetName, sourceName, columnName) {
	outputList = [];
	return getSourceByNames(dash, sheetName, sourceName)
	.then( source => source.getUnderlyingDataAsync() )
	.then( table => {
		index = table.columns.findIndex( col => col.fieldName == columnName )
		table.data.forEach( row => {
			if(!outputList.includes(row[index].value)){
				outputList.push(row[index].value);
			}
		});
		return outputList
	});
}

function arrayToChecklist(arr) {
	str = ""
	arr.forEach( val => {
		preString = "<div class='form-check'>\n"
		preString += `<input class='form-check-input' type='checkbox' value='' id='filter_${val}'>\n`
		preString += `<label class='form-check-label' for='filter_${val}'>\n`
		postString = "\n</label></div>"
		str = str.concat(preString,val,postString) 
	})
	return str;
}

function applyCustomFilter(dashboard, inputSelection, options) {
	getSourceByNames(dashboard,options.targetSheetName,options.linkingSourceName)
	.then( source => source.getUnderlyingDataAsync() )
	.then( table => {
		// First we need to find the index of the two columns
		inputIndex = table.columns.findIndex( col => col.fieldName == options.inputColumn);
		outputIndex = table.columns.findIndex( col => col.fieldName == options.outputColumn);

		// Now we traverse the linking dataset and pick out values in outputIndex
		// wherever inputIndex is in the desired range
		outputSelection = [];
		table.data.forEach( row => {
			if(inputSelection.includes(row[inputIndex].value)) {
				// Is removal of duplicates even necessary?
				if(!outputSelection.includes(row[outputIndex].value)){
					outputSelection.push(row[outputIndex].value);
				}
			}
		});
		targetSheet = dashboard.worksheets.find( worksheet => worksheet.name == options.targetSheetName )
		if(!options.allowNone) {
			// outputSelection now contains a list by which we need to filter targetSource
			// Let's filter our target sheet
			return targetSheet.applyFilterAsync(options.targetColumn, outputSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: false});
		} else {
			// Instead we will do an exclude mode filter
			// We traverse the linking dataset again and pick out all values of outputIndex
			// such there is a no row with inputIndex <--> outputIndex
			excludeSelection = [];
			table.data.forEach( row => {
				// If this row has an invalid input
				if(!inputSelection.includes(row[inputIndex].value)) {
					// and there is no other valid row with this output
					if(!outputSelection.includes(row[outputIndex].value)) {
						// then we should exclude this output
						if(!excludeSelection.includes(row[outputIndex].value)) {
							// so long as we haven't already excluded it
							excludeSelection.push(row[outputIndex].value)
						}
					}
				}
			});
			console.log(excludeSelection)
			return targetSheet.applyFilterAsync(options.targetColumn, excludeSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: true});
		}
	}).catch( err => console.log(err));
}

function updateInputSelection(input) {
	// Either way we need to keep track of inputSelection
	id = `filter_${input}`
	box = document.getElementById(id)
	if(box.checked) {
		if(!inputSelection.includes(input)){
			inputSelection.push(input);
		}
	} else {
		for(var i = 0; i < inputSelection.length; i++) {
			if(inputSelection[i]==input) {
				inputSelection.splice(i,1);
			}
		}
	}
	dashboard = tableau.extensions.dashboardContent.dashboard;
	// TODO: Rather than replacing the whole filter it may be quicker to Add/Remove
	applyCustomFilter(dashboard,inputSelection,options);
	// Save the new inputSelection for session persistence
	tableau.extensions.settings.set("inputSelection", JSON.stringify(inputSelection))
	tableau.extensions.settings.saveAsync();
}

function updateAllowNoneOption() {
	box=document.getElementById('allowNoneCheck');
	options.allowNone=box.checked;
	applyCustomFilter(dashboard,inputSelection,options);
	// Save the new options for session persistence
	tableau.extensions.settings.set("options", JSON.stringify(options));
	tableau.extensions.settings.saveAsync();
}

$(document).ready(function() {

	tableau.extensions.initializeAsync({'configure': configure})
	.then( () => {
		dashboard = tableau.extensions.dashboardContent.dashboard;

		// Get the saved input selection (if it exists)
		inputSelection = tableau.extensions.settings.get("inputSelection");
		if(inputSelection == null) {
			inputSelection = [];
		} else {
			inputSelection = JSON.parse(inputSelection);
		}

		// Get the saved config
		options = tableau.extensions.settings.get("options");
		if(options == null) {
			$("#feedback").html("Please use the configure dialog");
			throw("There aren't any settings");	
		} else {
			options = JSON.parse(options);
		}

		// Get the list of all possible values for inputColumn
		return getSelectionList(dashboard, options.targetSheetName, options.linkingSourceName, options.inputColumn);
	}).then( list => {
		// Display title
		$("#title_elem").html(options.filterTitle);

		// Put up the list
		listHTML = arrayToChecklist(list)
		$("#checkboxes").html(listHTML);
		// Check the ones that should be checked based on saved settings
		list.forEach( elem => {
			id = `filter_${elem}`;
			box = document.getElementById(id);
			box.checked = inputSelection.includes(elem);
		});
		// Check the "None" box at the top according to the options
		document.getElementById('allowNoneCheck').checked=options.allowNone

		// Apply the filter
		dashboard = tableau.extensions.dashboardContent.dashboard;
		applyCustomFilter(dashboard, inputSelection, options) //(this happens async)

		// Add event listeners to each checkbox to update the filter
		list.forEach( elem => {
			id = `filter_${elem}`;
			box = document.getElementById(id);
			box.addEventListener("change", function(){ updateInputSelection(elem) });
		});
		document.getElementById('allowNoneCheck').addEventListener("change",updateAllowNoneOption);
	}).catch( err => console.log(err));
	

	function configure() {
		tableau.extensions.ui.displayDialogAsync(configurationURL, "Sample payload", {height: 500, width:500})
		.then(closePayload => {
			console.log(closePayload);
			window.location.reload(false)
		}).catch(err => console.log(err));
	}

});


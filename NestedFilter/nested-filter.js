//configurationURL = "http://localhost:8765/NestedFilter/configure.html"
configurationURL = "https://tomchaplin.github.io/tableau-nested-filter-production/NestedFilter/configure.html"
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

function arrayToMultiselect(arr) {
	str = `<select id="inputSelector" multiple="multiple">`;
	str += `<option value="__none">None</option>`;
	arr.forEach( val => {
		newStr = `<option value="${val}">${val}</option>`;
		str += newStr;
	})
	str += `</select>`;
	return str;
}

function applyCustomFilter(dashboard, inputSelection, options) {
	// We only need one sheet to get the linking dataset
	getSourceByNames(dashboard,options.targets[0].sheetName,options.linkingSourceName)
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
		// Now we go through each target and apply the filter
		options.targets.forEach( row => {
			targetSheet = dashboard.worksheets.find( worksheet => worksheet.name == row.sheetName )
			if(!options.allowNone) {
				// outputSelection now contains a list by which we need to filter targetSource
				// Let's filter our target sheet
				return targetSheet.applyFilterAsync(row.columnName, outputSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: false});
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
				return targetSheet.applyFilterAsync(row.columnName, excludeSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: true});
			}
		});
	}).catch( err => console.log(err));
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
		// Only need to use one of the target sheets to get the linking source
		return getSelectionList(dashboard, options.targets[0].sheetName, options.linkingSourceName, options.inputColumn);
	}).then( list => {
		// Display title
		$("#title_elem").html(options.filterTitle);

		// Put up the list
		listHTML2 = arrayToMultiselect(list);
		$("#checkboxes").html(listHTML2);

		// Activate bootstrap multiselect with onChange handler
		inputSelector = $("#inputSelector");
		inputSelector.multiselect({
			buttonWidth: '100%;',
			nonSelectedText: '(None)',
			allSelectedText: '(All)',
			numberDisplayed: 1,
			nSelectedText: '(Multiple Values)',
			includeSelectedAllOption: true,
			onChange: function(option, checked, select) {
				if(option[0].value=="__none") {
					// Togle the allow none option to correct value
					options.allowNone=checked;
				} else if(checked) {
					// Add value to inputSelection
					if(!inputSelection.includes(option[0].value)){
						inputSelection.push(option[0].value);
					}
				} else {
					// Remove value from inputSelection
					for(var i = 0; i < inputSelection.length; i++) {
						if(inputSelection[i]==option[0].value) {
							inputSelection.splice(i,1);
						}
					}
				}
				// Apply new filter
				applyCustomFilter(dashboard, inputSelection, options);
				// Save settings
				tableau.extensions.settings.set("options", JSON.stringify(options));
				tableau.extensions.settings.set("inputSelection", JSON.stringify(inputSelection));
				tableau.extensions.settings.saveAsync();
			}
		});

		// Check the ones that should be checked based on saved settings
		inputSelector.multiselect("select", inputSelection);

		// Check the "None" box at the top according to the options
		if(options.allowNone) {
			inputSelector.multiselect("select", "__none");
		} else {
			inputSelector.multiselect("deselect", "__none");
		}

		// Apply the filter
		dashboard = tableau.extensions.dashboardContent.dashboard;
		applyCustomFilter(dashboard, inputSelection, options) //(this happens async)
	}).catch( err => console.log(err));
	

	function configure() {
		tableau.extensions.ui.displayDialogAsync(configurationURL, "Sample payload", {height: 500, width:500})
		.then(closePayload => {
			console.log(closePayload);
			window.location.reload(false)
		}).catch(err => console.log(err));
	}

});


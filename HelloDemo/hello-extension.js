linkingSource = "xhorsederby (test-schema)";
targetSorce = "horse (test-schema)";
inputColumn = "Derby Title Link"
outputColumn = "Horse Name Link";
targetSheetName = "Sheet 1"
targetColumnName = "Horse Name"
inputSelection  = ["Derby 1"];

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
		preString = "<div class='form-check'>"
		preString += `<input class='form-check-input' type='checkbox' value='' id='filter_${val}'>`
		preString += `<label calss='form-check-label' for='filter_${val}'>`
		postString = "</label></div>"
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

		// Now we traverse the dataset and pick out values in targetIndex
		// wherever filteringIndex is in the desired range

		// Might not be the best data structure?

		outputSelection = [];
		table.data.forEach( row => {
			if(inputSelection.includes(row[inputIndex].value)) {
				// Is removal of duplicates even necessary?
				if(!outputSelection.includes(row[outputIndex].value)){
					outputSelection.push(row[outputIndex].value);
				}
			}
		});
		
		// outputSelection now contains a list by which we need to filter targetSource
		// Let's filter our target sheet

		targetSheet = dashboard.worksheets.find( worksheet => worksheet.name == options.targetSheetName )
		return targetSheet.applyFilterAsync(option.targetColumnName, outputSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: false});
	}).catch( err => console.log(err));
}


$(document).ready(function() {

	tableau.extensions.initializeAsync()
	.then(function() {
		// Initialization succeeded! Get the dashboard
		var dashboard = tableau.extensions.dashboardContent.dashboard;

		checkList = ""
		getSelectionList(dashboard, targetSheetName, linkingSource, inputColumn)
		.then(list => {
			checkList = arrayToChecklist(list)
			$("#checkboxes").html(checkList);
		})
		.catch(err => console.log(err));
		

		getSourceByNames(dashboard,targetSheetName,linkingSource)
		.then( source => source.getUnderlyingDataAsync() )
		.then( table => {
			// First we need to find the index of the two columns
			inputIndex = table.columns.findIndex( col => col.fieldName == inputColumn);
			outputIndex = table.columns.findIndex( col => col.fieldName == outputColumn);

			// Now we traverse the dataset and pick out values in targetIndex
			// wherever filteringIndex is in the desired range

			// Might not be the best data structure?

			outputSelection = [];
			table.data.forEach( row => {
				if(inputSelection.includes(row[inputIndex].value)) {
					// Is removal of duplicates even necessary?
					if(!outputSelection.includes(row[outputIndex].value)){
						outputSelection.push(row[outputIndex].value);
					}
				}
			});
			
			// outputSelection now contains a list by which we need to filter targetSource
			// Let's filter our target sheet

			targetSheet = dashboard.worksheets.find( worksheet => worksheet.name == targetSheetName )
			return targetSheet.applyFilterAsync(targetColumnName, outputSelection, tableau.FilterUpdateType.Replace, {isExcludeMode: false})
		}).then(res => {
			console.log("Done?")
		});
	
	}, function(err) {
		console.log(err)
		// something went wrong in initialization
		$("#resultBox").html("Error while Initializing: " + err.toString());
	});

});


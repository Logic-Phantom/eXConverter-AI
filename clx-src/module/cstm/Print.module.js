/************************************************
 * Print.module.js
 * 
 * Version 1.0
 * Updated Date : 2021-04-08
 ************************************************/

/**
 * 프린트할 html 반환
 */
function getHTMLToGrid(gridArr, pageInfo){
	var htmlTagArr= [];
	htmlTagArr[htmlTagArr.length] = "<div class='page'>";

	if (pageInfo != null) {
		// 제목
		if (pageInfo.hasOwnProperty("title")) {
			htmlTagArr[htmlTagArr.length] = "<h1>"+pageInfo["title"]+"</h1>";
		}
		// 결재선 테이블
		if (pageInfo.hasOwnProperty("approvalLine")) {
			var approvalLineTagArr = [];
			approvalLineTagArr[approvalLineTagArr.length] = "<table class='approval_table' >";
			approvalLineTagArr[approvalLineTagArr.length] = "<tr>";
			for (var i = 0; i < pageInfo["approvalLine"].length; i++) {
				approvalLineTagArr[approvalLineTagArr.length] = "<td>"+pageInfo["approvalLine"][i]+"</td>";
			}
			approvalLineTagArr[approvalLineTagArr.length] = "</tr><tr>";
			for (var i = 0; i < pageInfo["approvalLine"].length; i++) {
				approvalLineTagArr[approvalLineTagArr.length] = "<td></td>";
			}
			approvalLineTagArr[approvalLineTagArr.length] = "</tr>";
			approvalLineTagArr[approvalLineTagArr.length] = "</table>";
			htmlTagArr[htmlTagArr.length] = approvalLineTagArr.join("");
		}
	}
	
	
	// 그리드
	for (var i = 0; i < gridArr.length; i++) {
		htmlTagArr[htmlTagArr.length] = getGridTable(gridArr[i]).join("");
		
		if (i != (gridArr.length-1)) {
			htmlTagArr[htmlTagArr.length] = "<div style='page-break-before: always; '> </div>";
		}
	}
	htmlTagArr[htmlTagArr.length] = "</div>";
	
	return htmlTagArr.join("");
}

/**
 * 그리드 데이터를 통한 table 반환
 * @param {cpr.controls.Grid} grid
 */
function getGridTable(grid) {
	var exportData = grid.getExportData({
		exceptStyle : false,
		applyFormat: true,
		applySuppress: true
	});
	
	var tableTagArr = [];
	tableTagArr[tableTagArr.length] = "<table class='content'>";
	var cols = exportData.cols;
	tableTagArr[tableTagArr.length] = "<colgroup>";
	var colWidths = [];
	var totalColumnWidth = 0;
	for (var ci = 0; ci < cols.length; ci++) {
		var colWidth = cpr.utils.ParamUtil.parseSize(cols[ci]["width"]).size;
		totalColumnWidth += colWidth;
		colWidths[colWidths.length] = colWidth;
	}
	for (var ci = 0; ci < colWidths.length; ci++) {
		tableTagArr[tableTagArr.length] = "<col style='width : " + (colWidths[ci] / totalColumnWidth) + "%'>";
	}
	tableTagArr[tableTagArr.length] = "</colgroup>";
	
	var layouts = exportData.rowgroups;
	for (var li = 0; li < layouts.length; li++) {
		var layout = layouts[li];
		var datas = layout.data;
		var styles = layout.style;
		var trTagArr = [];
		
		// 셀별 데이터를 trTagArr에 배열로 추가
		for (var ri = 0; ri < datas.length; ri++) {
			var tdTagArr = [];
			for (var ci = 0; ci < datas[ri].length; ci++) {
				var rowIndex = styles[ci]["rowindex"];
				if (tdTagArr[rowIndex] == null) {
					tdTagArr[rowIndex] = [];
				}
				if (Object.keys(datas[ri][ci]).length != 0) {
					tdTagArr[rowIndex][tdTagArr[rowIndex].length] = getTd(datas[ri][ci], styles[ci]).join("");
				}
			}
			trTagArr = trTagArr.concat(tdTagArr);
		}
		
		if (layout["region"] == "header") {
			tableTagArr[tableTagArr.length] = "<thead>";
		}
		for (var tri=0; tri < trTagArr.length; tri++) {
			tableTagArr[tableTagArr.length] = "<tr>";
			tableTagArr[tableTagArr.length] = trTagArr[tri].join("");
			tableTagArr[tableTagArr.length] = "</tr>";
		}
		if (layout["region"] == "header") {
			tableTagArr[tableTagArr.length] = "</thead>";
		}
	}
	
	tableTagArr[tableTagArr.length] = "</table>";
	return tableTagArr;
	
}

/**
 * 셀 데이터를 통한 td 반환
 * @param {any} cell
 * @param {any} columnInfo
 * @returns {string[]}
 */
function getTd(cell, columnInfo) {
	var value = cell["value"];
	var cellStyle = cell["style"];
	var columnStyle = columnInfo["style"];
	var style = _.extend({}, columnStyle, cellStyle);
	var styleKeys = Object.keys(style);
	
	var tdTagArr = [];
	tdTagArr[tdTagArr.length] = "<td"; 
	if (cell.hasOwnProperty("rowspan")) {
		if (cell["rowspan"] > 1) {
			tdTagArr[tdTagArr.length] = " rowspan='"+cell["rowspan"]+"'";
		}
	} else if (columnInfo["rowspan"] > 1) {
		tdTagArr[tdTagArr.length] = " rowspan='"+columnInfo["rowspan"]+"'";
	}
	if (cell.hasOwnProperty("colspan")) {
		if (cell["colspan"] > 1) {
			tdTagArr[tdTagArr.length] = " colspan='"+cell["colspan"]+"'";
		}
	} else if (columnInfo["colspan"] > 1) {
		tdTagArr[tdTagArr.length] = " colspan='"+columnInfo["colspan"]+"'";
	}
	
	if (styleKeys.length > 0) {
		tdTagArr[tdTagArr.length] = " style='";
		for (var si = 0; si < styleKeys.length; si++) {
			tdTagArr[tdTagArr.length] = styleKeys[si] + " : " + style[styleKeys[si]] +"; ";
		}
		tdTagArr[tdTagArr.length] = "'"
	}
	tdTagArr[tdTagArr.length] = ">" + value + "</td>";
	
	return tdTagArr;
}

/**
 * 입력받은 그리드 프린트
 * @param {cpr.controls.Grid[]} gridArr 프린트 하고자 하는 그리드 배열
 * @param {{title: string, approvalLine: string[]}} pageInfo 프린트 시 추가 정보. (title : 프린트 상단 제목, approvalLine : 결재라인 정보)
 */
globals.printGrid = function(gridArr, pageInfo) {
	
	sessionStorage.setItem("print-content", getHTMLToGrid(gridArr, pageInfo)); 
	var width = 800;
	var height = 700;
	
	// TODO 팝업화면 경로가 변경되었을 시 아래의 URL을 수정하십시오.
	var popWindow = window.open('app/cmn/resources/print.html',"print",'height='+height+',width='+width);
	return true;
} 


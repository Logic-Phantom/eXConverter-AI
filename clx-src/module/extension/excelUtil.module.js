/************************************************
 * excelUtil.module.js
 * Created at 2024. 1. 24. 오후 2:14:56.
 *
 * @author daye
 ************************************************/

/*
 * 클라이언트(XLSX, ExcelJS) 엑셀 다운로드 모듈
 * 
 * 엑셀 라이브러리를  통해 클라이어트에서 엑셀 다운로드 할 수 있는 공통모듈을 제공합니다.
 * 라이브러리는 env.json 또는 ResourceLoader 를 통해 반드시 로드되어 있어야 합니다.
 * 
 * 본 모듈에서 제공하는 기능은 서버가 연동되어 있지 않고 미리보기로 확인하는 경우 사용하는 것을 권장하며, 
 * 기술지원 보증범위에 포함되지 않습니다.
 */

function ExcelUtil() {}

/************************************************
 * 전역 변수 (엑셀 다운로드에서 사용)
 ************************************************/
/**
 * 그리드 헤더 배경 색상
 */
ExcelUtil.prototype.EXCEL_HEADER_BG_COLOR = "f5f6fa";
/**
 * 헤더 텍스트 색상
 */
ExcelUtil.prototype.EXCEL_HEADER_COLOR = "364a63";
/**
 * 디테일 홀수행 배경 색상
 */
ExcelUtil.prototype.EXCEL_DATA_ODD_BG_COLOR = "FFFFFF";
/**
 * 디테일 짝수행 배경 색상
 */
ExcelUtil.prototype.EXCEL_DATA_EVEN_BG_COLOR = "FFFFFF"; // "F4F0EB";		
/**
 * 그룹 헤더 배경 색상
 */
ExcelUtil.prototype.EXCEL_GROUP_HEADER_BG_COLOR = "F8F8F8";
/**
 * 그룹 푸터 배경 색상
 */
ExcelUtil.prototype.EXCEL_GROUP_FOOTER_BG_COLOR = "dbdfea";
/**
 * 푸터 배경 색상
 */
ExcelUtil.prototype.EXCEL_FOOTER_BG_COLOR = "cde2fe";
/**
 * 푸터 텍스트 색상
 */
ExcelUtil.prototype.EXCEL_FOOTER_COLOR = "000000";


/************************************************
 * 클라이언트 엑셀 다운로드
 ************************************************/
/**
 * colIndex 에 따른 엑셀 컬럼명 리턴
 * @param {Number} pnColIndex 열 번호
 */
ExcelUtil.prototype.getExcelColumnName = function(pnColIndex) {
	var ordA = 'A'.charCodeAt(0);
	var ordZ = 'Z'.charCodeAt(0);
	var len = ordZ - ordA + 1;
	
	var vnIndex = pnColIndex;
	
	var vsExcelColumnName = "";
	while (vnIndex >= 0) {
		vsExcelColumnName = String.fromCharCode(vnIndex % len + ordA) + vsExcelColumnName;
		vnIndex = Math.floor(vnIndex / len) - 1;
	}
	
	return vsExcelColumnName;
}

/**
 * ExcelJS 라이브러리 사용<br>
 * 특정 cell 의 스타일 설정
 * @param {any} cell 셀
 * @param {
 *   "background-color": String,
 *   "color": String,
 *   "text-align": String
 * } styles 적용 할 스타일 정보
 * @param {Boolean} pbBold? 폰트 굵게 적용 여부 (deault: false)
 */
ExcelUtil.prototype.setCellStyle = function(cell, styles, pbBold) {
	var vbBold = true;
	if (!ValueUtil.fixBoolean(pbBold)) vbBold = false;
	
	var bgColor = this.EXCEL_HEADER_BG_COLOR;
	var color = this.EXCEL_HEADER_COLOR;
	var vsTextAlign = "left";
	if (styles && styles["background-color"]) {
		bgColor = styles["background-color"].replace("#", "");
	}
	if (styles && styles["color"]) {
		color = styles["color"].replace("#", "");
	}
	if (styles && styles["text-align"]) {
		vsTextAlign = styles["text-align"];
	}
	cell.font = {
		color: {
			argb: color
		},
		bold: vbBold,
		align: vsTextAlign
	}
	
	cell.fill = {
		type: 'pattern',
		pattern: 'solid',
		fgColor: {
			argb: bgColor
		}
	};
	
	//푸터셀에   보더주기 
	cell.border = {
		top: {
			style: "thin",
			color: {
				argb: "black"
			}
		},
		left: {
			style: "thin",
			color: {
				argb: "black"
			}
		},
		bottom: {
			style: "thin",
			color: {
				argb: "black"
			}
		},
		right: {
			style: "thin",
			color: {
				argb: "black"
			}
		}
	};
}

/**
 * ExcelJS 라이브러리 사용<br>
 * 디테일 데이터의 스타일 추가
 * @param {any} worksheet
 * @param {Number} pnHeadeRowIndex 헤더 행 개수
 * @param {Number} pnFooterRowIndex 푸터 행 index
 * @param {Number} vnDetailRowsIndex 디테일 행 index
 * @param {Number[]} paGroupRowIndices 그룹헤더,그룹푸터 행index 배열
 */
ExcelUtil.prototype.setDetailStyle = function(worksheet, pnHeadeRowIndex, pnFooterRowIndex, vnDetailRowsIndex, paGroupRowIndices) {
	
	var vaGroupRowIndices = paGroupRowIndices;
	if (!(vaGroupRowIndices instanceof Array)) {
		vaGroupRowIndices = [];
	}
	
	worksheet.eachRow({
		includeEmpty: true
	}, function(row, rowNumber) {
		row.eachCell({
			includeEmpty: true
		}, function(cell, colNumber) {
			// 데이터 짝 홀 배경 스타일  및 테두리 
			if (rowNumber > pnHeadeRowIndex && rowNumber < pnFooterRowIndex && vaGroupRowIndices.indexOf(rowNumber) < 0) {
				var bgColor = this.EXCEL_DATA_ODD_BG_COLOR;
				if (rowNumber != pnHeadeRowIndex && Math.floor((rowNumber - pnHeadeRowIndex) / (vnDetailRowsIndex + 1)) % 2 == 0) {
					bgColor = this.EXCEL_DATA_EVEN_BG_COLOR;
				}
				
				cell.font = {
					color: {
						argb: "black"
					}
				}
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: {
						argb: bgColor
					}
				};
			}
			//데이터셀  전체에 보더주기 
			cell.border = {
				top: {
					style: "thin",
					color: {
						argb: "black"
					}
				},
				left: {
					style: "thin",
					color: {
						argb: "black"
					}
				},
				bottom: {
					style: "thin",
					color: {
						argb: "black"
					}
				},
				right: {
					style: "thin",
					color: {
						argb: "black"
					}
				}
			}
		});
	});
}

/**
 * XLSX 라이브러리 사용<br>
 * table 형식 데이터를 엑셀로 다운로드
 * @param {String} fileName 파일명
 * @param {String} sheetName 시트명
 * @param {cpr.controls.Grid} gridCtrl 대상 그리드
 */
ExcelUtil.prototype.exportExcelToTable = function(fileName, sheetName, gridCtrl) {
	var table = document.createElement("table");
	table.id = "tableData";
	
	var vcGrid = gridCtrl;
	var exportData = vcGrid.getExportData({
		exceptStyle: true,
		applyFormat: true
	})
	
	var header = exportData.rowgroups[0];
	var detail = exportData.rowgroups[1];
	/** @type Array */
	var headerData = header.data[0];
	/** @type Array */
	var detailData = detail.data;
	
	var result = [];
	
	var tr = document.createElement("tr");
	headerData.forEach(function(each) {
		var td = document.createElement("td");
		td.innerHTML = each;
		tr.appendChild(td);
		table.appendChild(tr);
	});
	
	detailData.forEach(function(each) {
		var trs = document.createElement("tr");
		each.forEach(function(eachs) {
			var tds = document.createElement("td");
			tds.innerHTML = eachs;
			trs.appendChild(tds);
			table.appendChild(trs);
		});
	});
	
	this._exportExcel(fileName, sheetName, table, "table");
}

/**
 * XLSX 라이브러리 사용<br>
 * JSON 형식 데이터를 엑셀로 다운로드<br><br>
 * 
 * <b>[주의 사항]</b><br>
 * - 헤더, 디테일 영역만 다운로드 가능 (그룹헤더, 그룹 푸터, 푸터 다운로드는 수정 필요)<br>
 * - 헤더,디테일 셀의 다중행 불가능<br>
 * - 스타일 제외 (스타일 설정은 수정 필요)<br>
 * - 셀 병합 불가능 (병합으로 인해 헤더셀이 디테일 셀 개수보다 적을 경우, 다른 헤더 컬럼에 데이터가 할당될 수도 있음)<br>
 * - 헤더 컬럼과 디테일 컬럼 매핑은 헤더 text 를 기준으로 설정. 헤더 text 가 중복될 경우, 잘못된 데이터가 바인딩 될 수 있으므로 주의<br>
 * - 필터, 소트, 컬럼 순서변경이 될 경우, 적용된 결과로 엑셀 다운로드 가능<br>
 * - columnVisible=false 인 컬럼도 엑셀 다운로드 시 포함 (미포함 관련 기능은 수정 필요)<br><br>
 * 
 * 각 사이트 별 Customizing 필요
 * @param {String} fileName 파일명
 * @param {String} sheetName 시트명
 * @param {cpr.controls.Grid} gridCtrl 대상 그리드
 * @param {Number[]} paExcludeCols? 다운로드 시 제외 할 colIndex 배열
 */
ExcelUtil.prototype.exportExcelToJSON = function(fileName, sheetName, gridCtrl, paExcludeCols) {
	
	var vaExcludeCols = [];
	if (paExcludeCols != null) {
		if (!(paExcludeCols instanceof Array)) {
			paExcludeCols = [paExcludeCols];
		}
		vaExcludeCols = paExcludeCols;
	}
	
	/** @type cpr.controls.Grid */
	var vcGrid = gridCtrl;
	var exportData = vcGrid.getExportData({
		exceptStyle: true,
		applyFormat: true,
		excludeColIndex: vaExcludeCols
	});
	
	var header = exportData.rowgroups[0];
	exportData.rowgroups.shift();
	
	/** @type Array */
	var detail = exportData.rowgroups;
	
	/** @type Array */
	var headerData = header.data[0];
	
	var result = [];
	
	detail = detail.filter(function(each) {
		return each.region == "detail";
	});
	detail.forEach(function(each) {
		
		/** @type Array */
		var detailData = each.data;
		
		detailData.forEach(function(eachs) {
			
			var a = {};
			headerData.forEach(function(headerEach, idx) {
				a[headerEach] = eachs[idx];
			});
			result.push(a);
		});
	});
	
	this._exportExcel(fileName, sheetName, result, "json", gridCtrl);
}

/**
 * ExcelJS 라이브러리 사용<br>
 * JSON 형식 데이터를 엑셀로 다운로드
 * @param {String} fileName 파일명
 * @param {String} sheetName 시트명
 * @param {cpr.controls.Grid} gridCtrl 대상 그리드
 * @param {Number[]} paExcludeCols? 다운로드 시 제외 할 colIndex 배열
 */
ExcelUtil.prototype.exportExcelJsToJSON = function(fileName, sheetName, gridCtrl, paExcludeCols) {
	
	var vaExcludeCols = [];
	if (paExcludeCols != null) {
		if (!(paExcludeCols instanceof Array)) {
			paExcludeCols = [paExcludeCols];
		}
		vaExcludeCols = paExcludeCols;
	}
	/** @type cpr.controls.Grid */
	var vcGrid = gridCtrl;
	var exportData = vcGrid.getExportData({
		exceptStyle: false,
		applyFormat: false,
		useFormat: true,
		excludeColIndex: vaExcludeCols,
		applySuppress: true
	});
	
	/** @type Array */
	var vaWidth = exportData.cols;
	
	var vaHeaderCols = [];
	
	for (var idx = 0; idx < vcGrid.header.cellCount; idx++) {
		// 제외할 컬럼
		if (paExcludeCols == null || Object.keys().length == 0 || paExcludeCols.indexOf(idx) < 0) {
			vaHeaderCols.push(vcGrid.header.getColumn(idx));
		}
	}
	
	var header = exportData.rowgroups[0];
	var headerStyle = header.style;
	
	headerStyle.forEach(function(each, idx) {
		each["classes"] = vaHeaderCols[idx].style.getClasses();
		each["text"] = header.data[0][idx].value; // vaHeaderCols[idx].getText(); (헤더셀이 아닌  텍스트 정보로 표시하도록 )
	});
	
	/** @type Array */
	var rowgroups = exportData.rowgroups;
	var detailInfos = [];
	var detailDatas = [];
	detailInfos = rowgroups.filter(function(each) {
		return each.region != "header" && each.region != "footer";
	});
	var footerDatas = [];
	footerDatas = rowgroups.filter(function(each) {
		return each.region == "footer";
	});
	
	//엑셀에서의 데이터를 표시하기 위한 컬럼 정보정리  
	var columns = []; //			
	//컬럼의 이름을 임의의 값으로 설정하여 colindex 로 쉽게 셀의 위치를 지정할 수 있도록 설정 
	for (var i = 0; i < vaWidth.length; i++) {
		var vnWidth = 20;
		if (vaWidth[i].width.indexOf("px")) {
			vnWidth = Math.round(Number(vaWidth[i].width.replace("px", "")) / 9 * 1.2);
		}
		if (!vaHeaderCols[i].visible) {
			vnWidth = 0;
		}
		columns.push({
			"key": "column" + i,
			"header": "",
			"width": vnWidth
		});
	}
	
	var headerDatas = [];
	var arrHeader = [];
	var vnHeaderIdx = 0;
	var vnColspan = 1;
	var befRowIndex, curRowIndex;
	
	var vnHeaderRowHeight = vcGrid.header.getRowHeights().length;
	
	headerStyle.forEach(function(each, idx) {
		var headerInfo = {
			header: each.text,
			key: "column" + each.colindex,
			cellInfo: each
		};
		
		curRowIndex = headerStyle[vnHeaderIdx].rowindex;
		
		if (vnHeaderRowHeight > curRowIndex) {
			arrHeader.push(headerInfo);
		}
		
		if (headerStyle[vnHeaderIdx].colspan > 1 && vnColspan == 1) {
			vnColspan = headerStyle[vnHeaderIdx].colspan;
		} else if (vnColspan > 2) {
			vnColspan--;
		} else {
			if (befRowIndex != null && befRowIndex != curRowIndex && curRowIndex != headerStyle[headerStyle.length - 1].rowindex) {
				headerDatas.push(arrHeader);
				befRowIndex = curRowIndex;
				arrHeader = [];
			}
			vnHeaderIdx++;
		}
	});
	
	if (headerStyle[headerStyle.length - 1].rowindex != (headerDatas.length - 1) && vnHeaderRowHeight > headerDatas.length) {
		headerDatas.push(arrHeader);
	}
	
	var vnCellCnt = vcGrid.detail.cellCount;
	
	var detailPreRowIndex, detailCurRowIndex, detailDataType;
	
	detailInfos.forEach(function(each) {
		/** @type Array */
		var detailData = each.data;
		/** @type Array */
		var detailStyle = each.style;
		
		var detailRegion = each.region;
		detailData.forEach(function(each, dataIndex) {
			var detailCell = {};
			for (var idx = 0; idx < detailStyle.length; idx++) {
				detailCurRowIndex = detailStyle[idx].rowindex;
				if (detailPreRowIndex == null) {
					detailPreRowIndex = detailCurRowIndex;
				}
				
				if (detailPreRowIndex != detailCurRowIndex) {
					if (Object.keys(detailCell).length > 0) {
						for (var i = 0; i < columns.length; i++) {
							detailCell["column" + i] = ValueUtil.fixNull(detailCell["column" + i]);
						}
						detailCell["cellInfo"] = detailStyle.filter(function(each) {
							return each.rowindex == detailPreRowIndex;
						});;
						detailCell["region"] = detailRegion;
						detailDatas.push(detailCell);
					}
					detailCell = {};
					detailPreRowIndex = null;
					detailDataType = null;
					detailPreRowIndex = detailCurRowIndex;
				}
				
				if (vcGrid.detail.getControl(detailStyle[idx].cellIndex) instanceof cpr.controls.Output) {
					detailDataType = vcGrid.detail.getControl(detailStyle[idx].cellIndex).dataType;
					detailStyle[idx]["format"] = vcGrid.detail.getControl(detailStyle[idx].cellIndex).format;
				}
				if (vcGrid.detail.getControl(detailStyle[idx].cellIndex) instanceof cpr.controls.NumberEditor) {
					detailDataType = "number";
					detailStyle[idx]["format"] = vcGrid.detail.getControl(detailStyle[idx].cellIndex).format;
				}
				if (vcGrid.detail.getControl(detailStyle[idx].cellIndex) instanceof cpr.controls.DateInput) {
					detailDataType = "date";
					detailStyle[idx]["format"] = vcGrid.detail.getControl(detailStyle[idx].cellIndex).mask;
				}
				if (detailDataType == "date") {
					detailCell["column" + detailStyle[idx].colindex] = ValueUtil.fixNull(each[idx].value) == "" ? "" : moment(each[idx].value).format(detailStyle[idx]["format"]);
				} else {
					detailCell["column" + detailStyle[idx].colindex] = each[idx].value;
				}
				detailDataType = null;
			} // end for 
			
			detailCell["region"] = detailRegion;
			detailCell["cellInfo"] = detailStyle.filter(function(each) {
				return each.rowindex == detailPreRowIndex;
			});;
			detailPreRowIndex == null;
			detailDataType = null;
			detailDatas.push(detailCell);
		});
	});
	var footer = footerDatas;
	
	footerDatas = [];
	
	if (footer && footer.length > 0) {
		
		var footerStyle = footer[0].style;
		var arrfooter = [];
		var vnfooterIdx = 0;
		var vnColspan = 1;
		var befIndex, curIndex;
		var footerInfo = {};
		
		footerStyle.forEach(function(each, idx) {
			
			var footerInfo = {
				footer: footer[0].data[0][idx].value,
				key: each.colindex // columns[each.colindex].columnName									
					,
				cellInfo: each
			};
			arrfooter.push(footerInfo);
			curRowIndex = footerStyle[vnfooterIdx].rowindex;
			
			if (footerStyle[vnfooterIdx].colspan > 1 && vnColspan == 1) {
				vnColspan = footerStyle[vnfooterIdx].colspan;
			} else if (vnColspan > 2) {
				vnColspan--;
			} else {
				if (befIndex != curRowIndex && curRowIndex != footerStyle[footerStyle.length - 1].rowindex) {
					footerDatas.push(arrfooter);
					befIndex = curRowIndex;
					arrfooter = [];
				}
				vnfooterIdx++;
			}
		});
		
		if (footerStyle && footerStyle.length > 0) {
			if (footerStyle[footerStyle.length - 1].rowindex != (footerDatas.length - 1)) {
				footerDatas.push(arrfooter);
			}
		}
	}
	
	var cellInfos = {
		"header": headerDatas,
		"detail": detailDatas,
		"footer": footerDatas
	}
	this._exportJsExcel(fileName, sheetName, columns, cellInfos);
}


/************************************************
 * 내부 함수
 ************************************************/
/**
 * 
 * @param {any} s
 */
ExcelUtil.prototype._s2ab = function(s) {
	var buf = new ArrayBuffer(s.length); //convert s to arrayBuffer
	var view = new Uint8Array(buf); //create uint8array as viewer
	for (var i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF; //convert to octet
	return buf;
}


/**
 * 
 * @param {String} fileName
 * @param {String} sheetName
 * @param {Array} excelColumns
 * @param {{header : JSON , detail : JOSN, footer :JSON} cellInfos
 */
ExcelUtil.prototype._exportJsExcel = function(fileName, sheetName, excelColumns, cellInfos) {
	var workbook = new ExcelJS.Workbook();
	var worksheet = workbook.addWorksheet(sheetName);
	
	worksheet.columns = excelColumns;
	
	//헤더에 대한 정보를 처리( 열병합 정보 조합)
	var headerInfos = cellInfos.header;
	var vnHeaderRow = headerInfos.length;
	
	var headerinfo, cellInfo, sheetColNm;
	var mergeInfos = [];
	
	for (var i = 0; i < headerInfos.length; i++) {
		headerinfo = headerInfos[i];
		for (var idx = 0; idx < headerinfo.length; idx++) {
			cellInfo = headerinfo[idx].cellInfo;
			if (cellInfo && (cellInfo.colspan > 1 || cellInfo.rowspan > 1)) {
				// 핼과 열을 함께 병합시에 문제가 발생
				var endRow = cellInfo.rowspan == 1 ? cellInfo.rowindex + 1 : cellInfo.rowindex + cellInfo.rowspan;
				var endCol = cellInfo.colspan == 1 ? cellInfo.colindex + 1 : cellInfo.colindex + cellInfo.colspan;
				var mergeInfo = {
					"stRowNumber": cellInfo.rowindex + 1,
					"stColNumber": cellInfo.colindex + 1,
					"edRowNumber": endRow,
					"edColNumber": endCol
				};
				if (JSON.stringify(mergeInfos).indexOf(JSON.stringify(mergeInfo)) < 0) {
					mergeInfos.push(mergeInfo);
				}
			}
			
			if (vnHeaderRow < (headerInfos[i][idx].cellInfo.rowindex + 1)) {
				vnHeaderRow = headerInfos[i][idx].cellInfo.rowindex + 1
			}
			sheetColNm = this.getExcelColumnName(headerInfos[i][idx].cellInfo.colindex) + (headerInfos[i][idx].cellInfo.rowindex + 1);
			var cell = worksheet.getCell(sheetColNm);
			//헤더 텍스트 표시 
			cell.value = headerInfos[i][idx].header;
			cell.alignment = {
				horizontal: ValueUtil.nvl(headerInfos[i][idx].cellInfo.style["text-align"], "center"),
				vertical: "middle"
			}
			
			if (headerInfos[i][idx].cellInfo.style) {
				var bgColor = headerInfos[i][idx].cellInfo.style["background-color"];
				if (bgColor == null || bgColor == "inherit") {
					headerInfos[i][idx].cellInfo.style["background-color"] = this.EXCEL_HEADER_BG_COLOR;
				}
			} else {
				headerInfos[i][idx].cellInfo.style = {
					"background-color": this.EXCEL_HEADER_BG_COLOR,
					"text-align": "center"
				};
			}
			
			this.setCellStyle(cell, headerInfos[i][idx].cellInfo.style, true)
			
		} // end for 
		
	} //end for 
	
	// (헤더,푸터정보를 제외한 ) 디테일데이터 추가
	var detailData = cellInfos.detail;
	worksheet.addRows(detailData);
	// 소계 및 디테일의 셀병합(열병합,행병합 ) 처리 
	var vnStartDetailIndex = vnHeaderRow + 1;
	var detailinfo;
	
	var detailInfos = cellInfos.detail;
	var vnDetailRowsIndex = 0;
	var vaGroupRowIndices = []; // 엑셀용으로 1붙여 내보기
	var voStyles = {};
	
	for (var i = 0; i < detailInfos.length; i++) {
		detailinfo = detailInfos[i].cellInfo;
		for (var idx = 0; idx < detailinfo.length; idx++) {
			cellInfo = detailinfo[idx];
			voStyles = cellInfo.style;
			if (detailInfos[i].region == "detail" && vnDetailRowsIndex < cellInfo.rowindex) {
				vnDetailRowsIndex = cellInfo.rowindex;
			}
			if (cellInfo && (cellInfo.colspan > 1 || cellInfo.rowspan > 1)) {
				// 핼과 열을 함께 병합시에 문제가 발생
				var endRow = cellInfo.rowspan == 1 ? 1 : cellInfo.rowindex + cellInfo.rowspan;
				var endCol = cellInfo.colspan == 1 ? cellInfo.colindex + 1 : cellInfo.colindex + cellInfo.colspan;
				var mergeInfo = {
					"stRowNumber": vnStartDetailIndex,
					"stColNumber": cellInfo.colindex + 1,
					"edRowNumber": endRow + (vnStartDetailIndex - 1),
					"edColNumber": endCol
				};
				
				if (JSON.stringify(mergeInfos).indexOf(JSON.stringify(mergeInfo)) < 0) {
					mergeInfos.push(mergeInfo);
				}
			}
			sheetColNm = this.getExcelColumnName(cellInfo.colindex) + (vnStartDetailIndex);
			var cell = worksheet.getCell(sheetColNm);
			
			if (cellInfo.type == "number") {
				cell.numFmt = "#,##";
				if (cellInfo.format && cellInfo.format.indexOf(".") > -1) {
					cell.numFmt = "#,#0" + cellInfo.format.substring(cellInfo.format.indexOf("."));
				}
			}
			//소계 스타일 적용 				
			if (detailInfos[i].region == "gheader") {
				vaGroupRowIndices.push(vnStartDetailIndex);
				voStyles["background-color"] = ValueUtil.nvl(voStyles["background-color"], this.EXCEL_GROUP_HEADER_BG_COLOR);
			} else if (detailInfos[i].region == "gfooter") {
				vaGroupRowIndices.push(vnStartDetailIndex);
				voStyles["background-color"] = ValueUtil.nvl(voStyles["background-color"], this.EXCEL_GROUP_FOOTER_BG_COLOR);
			}
			// default 폰트 색상 정의 
			voStyles["color"] = ValueUtil.nvl(voStyles["color"], "000000");
			cell.alignment = {
				horizontal: ValueUtil.nvl(voStyles["text-align"], "center")
			}
			
			if (Object.keys(voStyles).length > 0) {
				this.setCellStyle(cell, voStyles);
			}
		}
		vnStartDetailIndex++;
	}
	
	var vnStartFooterIndex = vnHeaderRow + detailData.length + 1;
	// 추가된 디테일 데이터의 스타일 추가 , 푸터 포함 ) 
	this.setDetailStyle(worksheet, vnHeaderRow, vnStartFooterIndex, vnDetailRowsIndex, vaGroupRowIndices);
	
	//푸터 대한 정보를 처리( 열병합 정보 조합)	
	var footerinfo;
	var footerInfos = cellInfos.footer;
	for (var i = 0; i < footerInfos.length; i++) {
		footerinfo = footerInfos[i];
		for (var idx = 0; idx < footerinfo.length; idx++) {
			cellInfo = footerinfo[idx].cellInfo;
			if (cellInfo && (cellInfo.colspan > 1 || cellInfo.rowspan > 1)) {
				// 핼과 열을 함께 병합시에 문제가 발생
				var endRow = cellInfo.rowspan == 1 ? cellInfo.rowindex + 1 : cellInfo.rowindex + cellInfo.rowspan;
				var endCol = cellInfo.colspan == 1 ? cellInfo.colindex + 1 : cellInfo.colindex + cellInfo.colspan;
				var mergeInfo = {
					"stRowNumber": vnStartFooterIndex,
					"stColNumber": cellInfo.colindex + 1,
					"edRowNumber": endRow + (vnStartFooterIndex - 1),
					"edColNumber": endCol
				};
				
				if (JSON.stringify(mergeInfos).indexOf(JSON.stringify(mergeInfo)) < 0) {
					mergeInfos.push(mergeInfo);
				}
			}
			
			sheetColNm = this.getExcelColumnName(footerInfos[i][idx].cellInfo.colindex) + (footerInfos[i][idx].cellInfo.rowindex + vnStartFooterIndex);
			var cell = worksheet.getCell(sheetColNm);
			//푸터 텍스트 표시
			cell.value = footerInfos[i][idx].footer;
			if (cellInfo.type == "number") {
				cell.numFmt = "#,##";
			}
			cell.alignment = {
				horizontal: ValueUtil.nvl(cellInfo.style["text-align"], "center")
			}
			//푸터 스타일 적용 
			this.setCellStyle(cell, {
				"background-color": this.EXCEL_FOOTER_BG_COLOR,
				"color": this.EXCEL_FOOTER_COLOR
			});
		}
	}
	//병합하는  정보 (헤더, 디테일, 푸터)
	mergeInfos.forEach(function(each) {
		worksheet.mergeCells(each.stRowNumber, each.stColNumber, each.edRowNumber, each.edColNumber);
	});
	
	var buff = workbook.xlsx.writeBuffer().then(function(data) {
		var blob = new Blob([data], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
		});
		var a = saveAs(blob, fileName);
		
		var isIE = ["ie", "edge"].indexOf(cpr.utils.Util.detectBrowser().name) !== -1;
		if (!isIE) {
			a.onwriteend = function() {}
		} else {
			if (a) {}
		}
	});
	
}

/**
 * 
 * @param {String} fileName
 * @param {String} sheetName
 * @param {any} excelData
 * @param {any} type
 * @param {any} gridCtrl
 */
ExcelUtil.prototype._exportExcel = function(fileName, sheetName, excelData, type, gridCtrl) {
	
	var wb = XLSX.utils.book_new();
	
	var newWorksheet;
	if (type == "table") {
		
		// step 2. 시트 만들기 
		newWorksheet = XLSX.utils.table_to_sheet(excelData);
	} else if (type == "json") {
		
		newWorksheet = XLSX.utils.json_to_sheet(excelData);
	}
	
	//프로버젼만 사용 가능 (xlsx.bundle.js, 상용버젼)
	//			newWorksheet["A1"].s = { // set the style for target cell
	//			  font: {
	//			  	name: '',
	//			    sz: 24,
	//			    bold: true,
	//			    color: {
	//			      rgb: "FFFFAA00"
	//			    }
	//			  },
	//			  
	//			  fill : {
	//			  	patternType	: "solid"
	//			  },
	//			  
	//			  border : {
	//			  	bottom : {
	//			  		style: 'solid', color: 'red' 
	//			  	}
	//			  }	
	//			};
	
	// step 3. workbook에 새로만든 워크시트에 이름을 주고 붙인다.  
	XLSX.utils.book_append_sheet(wb, newWorksheet, sheetName);
	
	// step 4. 엑셀 파일 만들기 
	var wbout = XLSX.write(wb, {
		bookType: 'xlsx',
		type: 'binary',
		compression: true
	});
	
	// step 5. 엑셀 파일 내보내기 
	var a = saveAs(new Blob([this._s2ab(wbout)], {
		type: "application/octet-stream"
	}), fileName);
	
	var isIE = ["ie", "edge"].indexOf(cpr.utils.Util.detectBrowser().name) !== -1;
	if (!isIE) {
		a.onwriteend = function() {}
	} else {
		if (a) {}
	}
}


/************************************************
 * 글로벌 출판
 ************************************************/
/**
 * 클라이언트 엑셀 다운로드 유틸
 */
globals.ExcelClientUtil = function() {
	return new ExcelUtil();
}
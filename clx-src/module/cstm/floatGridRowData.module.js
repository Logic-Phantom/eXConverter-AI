/************************************************
 * floatGridRowData.module.js
 * Created at 2021. 1. 28. 오후 2:45:44.
 *
 * Version 1.0
 * Updated Date : 2021-04-08
 * 
 * @author daye
 ************************************************/

/************************************************
 * 전역변수
 ************************************************/
/**
 * 모듈 사용여부
 * @type {Boolean}
 */
var mbUse = true;

/**
 * 동적으로 생성한 앱ID
 * @type {String}
 */
var msAppId = "floatGridRowData";

/**
 * 사용자 속성
 * @type {String}
 */
var ATTR_GRID_DATA_POP = "grid-data-pop";

/**
 * 폼레이아웃 스타일 클래스
 * @type {String}
 */
var msFormCls = "cl-form-group";

/**
 * 폼레이아웃 내부의 아웃풋 스타일 클래스(라벨 스타일)
 * @type {String}
 */
var msFormLabelCls = "label";


/************************************************
 * 사용자 함수
 ************************************************/
if(mbUse) cpr.events.EventBus.INSTANCE.addFilter("row-dblclick", fn_row_dblclick);

function fn_row_dblclick (/* cpr.events.CGridMouseEvent */ e) {
	
	/** @type cpr.controls.Grid */
	var grid = e.control;
	
	if(grid && grid.type == "grid") {
		if(grid.userAttr(ATTR_GRID_DATA_POP) == "true") {
			
			var vnIndex = e.rowIndex;
					
			var voPopApp = _createApp();
			
			var voAppIns = grid.getAppInstance();
			var voRootAppIns = voAppIns.getRootAppInstance();	
			voRootAppIns.openDialog(voPopApp, {width : 800, height : 700}, function(dialog){
				dialog.ready(function(dialogApp){
					dialog.initValue = {
						"grid" : grid,
						"index" : vnIndex
					}
					
					dialog.addEventListener("close", function(e){
						cpr.core.Platform.INSTANCE.unregister(voPopApp);
					});
				});
			});
		}
	}
}


function _createApp () {
	
	var newApp = new cpr.core.App(msAppId, {
		onPrepare: function(loader){
		},
		onCreate: function(/* cpr.core.AppInstance */ app, exports){
			var linker = {};
			
			function onBodyLoad (e) {

				var initValue = app.getHostProperty("initValue");
				if(initValue) {
					
					/** @type cpr.controls.Grid */
					var vcGrid = initValue["grid"];
					var vnRowIndex = initValue["index"];
					var vcGroup = app.lookup("grp1");
					
					var vcNbe = app.lookup("nbe1");
					vcNbe.putValue(vnRowIndex + 1);
					vcNbe.max = vcGrid.getRowCount();
					vcNbe.focus();
					
					var vaRows = [];
					var vcDataset = vcGrid.dataSet;
					var vnColCount = Math.ceil(_getVisibleColumns(vcGrid).length / 2);
					for(var idx = 0; idx < vnColCount; idx++){
						vaRows.push("30px");
					}
					
					var voLayout = vcGroup.getLayout();
					voLayout.setRows(vaRows);
					vaRows.forEach(function(each, idx){
						voLayout.setRowAutoSizing(idx, true);
					});
					
					// 문맥 바인딩
					vcGroup.setBindContext(new cpr.bind.GridSelectionContext(vcGrid));
					
					// 컨트롤 추가
					_addControl(vcGroup, vcGrid);
				}
			}
			
			function fn_nbe_value_change (e) {
				
				var index = e.newValue;
				var initValue = app.getHostProperty("initValue");
				
				/** @type cpr.controls.Grid */
				var vcGrid = initValue["grid"];
				vcGrid.selectRows(Number(index) - 1);
			}

			var container = app.getContainer();
			var voVerticalLayout = new cpr.controls.layouts.VerticalLayout();
			voVerticalLayout.spacing = 10;
			voVerticalLayout.leftMargin = 20;
			voVerticalLayout.rightMargin = 20;
			voVerticalLayout.topMargin = 20;
			voVerticalLayout.bottomMargin = 20;
			container.setLayout(voVerticalLayout);
			
			// 행 번호 폼레이아웃
			var form = new cpr.controls.Container();
			form.style.addClass(msFormCls);
			var voFormlayout = new cpr.controls.layouts.FormLayout();
			voFormlayout.topMargin = "5px";
			voFormlayout.rightMargin = "5px";
			voFormlayout.bottomMargin = "5px";
			voFormlayout.leftMargin = "5px";
			voFormlayout.horizontalSpacing = "10px";
			voFormlayout.verticalSpacing = "10px";
			voFormlayout.horizontalSeparatorWidth = 1;
			voFormlayout.verticalSeparatorWidth = 1;
			voFormlayout.setColumns(["100px", "1fr"]);
			voFormlayout.setRows(["30px"]);
			voFormlayout.setColumnAutoSizing(0, true);
			voFormlayout.setUseColumnShade(0, true);
			form.setLayout(voFormlayout);
			
			container.addChild(form, {
				"autoSize" : "both",
				"width": "400px",
				"height": "30px"
			});
			
			var output = new cpr.controls.Output();
			output.value = "그리드 행 번호";
			output.style.addClass(msFormLabelCls);
			form.addChild(output, {
				"colIndex" : 0,
				"rowIndex" : 0
			});
			
			// numberediotr
			var vcNbe = new cpr.controls.NumberEditor("nbe1");
			vcNbe.min = 1;
			if(typeof fn_nbe_value_change == "function"){
				vcNbe.addEventListener("value-change", fn_nbe_value_change);
			}
			form.addChild(vcNbe, {
				"colIndex" : 1,
				"rowIndex" : 0,
				"horizontalAlign": "left",
				"width" : 200
			});
			
			// formLayout 생성
			var vcGroup = new cpr.controls.Container("grp1");
			vcGroup.style.addClass(msFormCls);
			var voFormlayout2 = new cpr.controls.layouts.FormLayout();
			voFormlayout2.topMargin = "5px";
			voFormlayout2.rightMargin = "5px";
			voFormlayout2.bottomMargin = "5px";
			voFormlayout2.leftMargin = "5px";
			voFormlayout2.horizontalSpacing = "10px";
			voFormlayout2.verticalSpacing = "10px";
			voFormlayout2.horizontalSeparatorWidth = 1;
			voFormlayout2.verticalSeparatorWidth = 1;
			voFormlayout2.setColumns(["100px", "1fr", "100px", "1fr"]);
			voFormlayout2.setColumnAutoSizing(0, true);
			voFormlayout2.setColumnAutoSizing(2, true);
			voFormlayout2.setUseColumnShade(0, true);
			voFormlayout2.setUseColumnShade(2, true);
			vcGroup.setLayout(voFormlayout2);
			
			container.addChild(vcGroup, {
				"autoSize" : "height",
				"width": "400px",
				"height": "200px"
			});
			
			if(typeof onBodyLoad == "function"){
				app.addEventListener("load", onBodyLoad);
			}
		}
	});
	newApp.title = "데이터 확인";
	cpr.core.Platform.INSTANCE.register(newApp);
	
	return newApp;
}


/**
 * 
 * @param {cpr.controls.Container} pcGrp
 * @param {cpr.controls.Grid} pcGrid
 */
function _addControl (pcGrp, pcGrid) {
	
	/** @type cpr.controls.layouts.FormLayout */
	var voLayout = pcGrp.getLayout();
	var vaRows = voLayout.getRows();
	
	var voHeader = pcGrid.header;
	var voDetail = pcGrid.detail;
	
	var vnIndex = 0;
	var vnHeaderCellCnt = voHeader.cellCount;
	var vnDetailCellCnt = voDetail.cellCount;
	
	var vaVisibleCols = _getVisibleColumns(pcGrid);
	for(var idx = 0; idx < vaVisibleCols.length; idx++){
		var vcLabel = new cpr.controls.Output("optLabel"+idx);
		vcLabel.style.addClass(msFormLabelCls);
		vcLabel.value = _getColumnText(pcGrid, vaVisibleCols[idx]);
		pcGrp.addChild(vcLabel, {
			"colIndex": idx % 2 == 0 ? 0 : 2,
			"rowIndex": parseInt(idx / 2)
		});
		
		var vcLabel2 = new cpr.controls.Output("optData"+idx);
		vcLabel2.bind("value").toDataColumn(vaVisibleCols[idx]);
		pcGrp.addChild(vcLabel2, {
			"colIndex": idx % 2 ==0 ? 1 : 3,
			"rowIndex": parseInt(idx / 2)
		});
	}
}

/**
 * 그리드 헤더 텍스트 반환
 * 멀티헤더의 경우 "-" 로 연결되어 반환
 * @param {cpr.controls.Grid} pcGrid
 * @param {String} psColNm
 */
function _getColumnText(pcGrid, psColNm) {
		
	var vaDetailCol = pcGrid.detail.getColumnByName(psColNm)[0];
	var detailCell = vaDetailCol.cellProp.constraint.cellIndex;
	var headerCell = pcGrid.getHeaderCellIndices(detailCell);
	
	var vsResult = "";
	if (headerCell.length > 0) {
		headerCell.forEach(function(each) {
			var colNm = pcGrid.header.getColumn(each);
			vsResult += colNm.text + "-";
		});
		
		if (vsResult != "") {
			vsResult = vsResult.substr(0, vsResult.length - 1);
		}
	}
	return vsResult;
}

/**
 * 그리드에서 실제로 보여지는 컬럼들의 이름들을 반환 
 * 헤더의 targetColumnName 기준
 * @param {cpr.controls.Grid} pcGrid
 */
function _getVisibleColumns(pcGrid) {
	
	var vnCellCnt = pcGrid.detail.cellCount;
	var vaResult = [];
	
	for (var idx = 0; idx < vnCellCnt; idx++) {
		var voColumn = pcGrid.detail.getColumn(idx);
		var vaHeaderCellIdxs = pcGrid.getHeaderCellIndices(idx);
		
		if (vaHeaderCellIdxs.length > 0) {
			vaHeaderCellIdxs.forEach(function(each) {
				var voHeaderCell = pcGrid.header.getColumn(each);
				
				if (voHeaderCell.targetColumnName != "" && voHeaderCell.visible) {
					var vsTargetColNm = voHeaderCell.targetColumnName;
					if( vsTargetColNm ) {
						vaResult.push(vsTargetColNm);
					}
				}
			});
		}
	}
	
	return vaResult;
}


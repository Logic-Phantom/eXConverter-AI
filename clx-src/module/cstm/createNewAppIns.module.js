/************************************************
 * createNewAppIns.module.js
 * Created at 2019. 11. 15. 오전 9:46:36.
 *
 * Version 1.1
 * Updated Date : 2021-12-07
 * 
 * @author daye
 ************** 소스 수정 이력 ****************
*  date          	Modifier            Description
 ************************************************
 * 2023.12.07		서다예		현재 로드된 앱만 디버깅 가능한 단축키 생성
										모달리스로 변경 및 새로고침 버튼 추가
										escKeySupport 추가
 ************************************************/

/*
 * 런타임 시 테스트 관정을 지원하기 위하여 현재의 dataSet 및 dataMap의 값 및 상태를 조회할 수 있는 기능을 제공하는 공통모듈입니다.
 * 화면 로드시 단축키(기본 ctrl+alt+a/z) 를 누르면 팝업을 통해 확인 할 수 있습니다.
 * 
 * ※ 주의사항
 * 해당 모듈은 테스트를 위한 모듈입니다.
 * 운영서버 배포시에는 이를 포함하여 서버에 배포하시면 안됩니다. (보안상의 문제 발생 소지가 있습니다.)
 */

/************************************************
 * 전역 변수 (변경 가능)
 ************************************************/
/**
 * 모듈 사용 여부
 * true일 경우에만 데이터 컴포넌트를 확인할 수 있는 앱 생성 및 단축키를 지원합니다.
 * @type {Boolean}
 */
var mbCreateApp = true;

/**
 * 컨트롤 height
 * @type {String}
 */
var msRowHeight = "28px";

/**
 * 디버깅 다이얼로그 내부 마진
 * @type {Number}
 */
var mnMargin = 20;

/**
 * 디버깅 다이얼로그 내부 간격
 * @type {Number}
 */
var mnSpacing = 10;

/**
 * 마지막 단축키
 * default : Ctrl+Alt+A
 * @type {cpr.events.KeyCode}
 */
var msDynamicKey = cpr.events.KeyCode.A;

/**
 * 마지막 단축키2 (현재화면만 디버깅)
 * default : Ctrl+Alt+Z
 * @type {cpr.events.KeyCode}
 */
var msDynamicKey2 = cpr.events.KeyCode.Z;

/**
 * 팝업에서 데이터맵을 보여줄 때 생성되는 그룹의 클래스명
 * @type {String}
 */
var msFormCls = "cl-form-group";

/**
 * 팝업에서 데이터맵을 보여줄 때 생성되는 아웃풋의 클래스명
 * @type {String}
 */
var msOptCls = "text-center";


/************************************************
 * 전역 변수 (변경 불가능)
 ************************************************/
/**
 * 앱인스턴스
 * @type {cpr.core.AppInstance}
 */
var moAppInstance = null;

/**
 * 그리드 (데이터셋) || 그룹 (데이터맵)
 * @type {cpr.controls.Container|cpr.controls.Grid}
 */
var mcControl = null;

/**
 * 동적으로 생성한 다이얼로그 앱 ID
 * @type {String}
 */
var msAppId = null;

/**
 * 임베디드 앱인스턴스 객체
 * @type {cpr.core.AppInstance}
 */
var moEmbedded = null;

/**
 * 다이얼로그가 띄워졌는지 여부
 * @type {Boolean}
 */
var mbPopup = false;

/**
 * 다이얼로그 앱
 * @type {cpr.core.AppInstance}
 */
var moDialogApp = null;

/**
 * 
 * @type {Array}
 */
var maAppInstance = []; 

/**
 * 
 * @type {Array}
 */
var maDatasetId = [];

/************************************************
 * 이벤트 리스너
 ************************************************/
if(mbCreateApp) cpr.events.EventBus.INSTANCE.addFilter("load", fn_load);

function fn_load (e) {
	
	var control = e.control;
	if (control instanceof cpr.core.AppInstance) {
		if (control.id.indexOf(msAppId) == -1) {
			
			if(control.isRootAppInstance()) {
					
				var voChild = control.getContainer().getAllRecursiveChildren().map(function(each){
					if(each.type == "embeddedapp" || each.type == "mdifolder") return each;
				});
				if(!voChild || voChild.length == 0) return;
			}
				
			var voEmbAppInstance = control;
			
			// 앱인스턴스 저장
			if(control.getHost() && control.id.indexOf("udc") == -1) {
				
				if(control.getHost().type == "dialog" && control.id.indexOf("udc") == -1) {
					
					// MSG Dialog 제외
					if (control.app.id.toUpperCase().indexOf("MSGDIALOG") != -1) return;
					
					// Dialog 띄웠을 경우 rootAppInstance 저장
					var voMainApp = voEmbAppInstance.getHostAppInstance();
					if(!voMainApp) return;
					
					/** @type cpr.controls.EmbeddedApp */
					var emb = voMainApp.getContainer().getAllRecursiveChildren().filter(function(each){
						if(each.type == "embeddedapp") return each;
					})[0];
					
					if(emb) moEmbedded = emb.getEmbeddedAppInstance();
					
				} else if(control.id.indexOf("udc") != -1) {
					
					// 다일로그에서 조회할 경우
					if(control.getHost().type == "dialog") return;
					
					var voMainApp = voEmbAppInstance.getRootAppInstance();
					if(!voMainApp) return;
					
					/** @type cpr.controls.EmbeddedApp */
					var emb = voMainApp.getContainer().getAllRecursiveChildren().filter(function(each){
						if(each.type == "embeddedapp") return each;
					})[0];
					
					if(emb) voEmbAppInstance = emb.getEmbeddedAppInstance();
				}
			} else if (control.id.indexOf("udc") != -1) {
				// 반환된 control이 udc(loadmask)일 경우
				if (control.id.toUpperCase().indexOf("LOADMASK") != -1) {
					return;
				}
			}
			
			if (!ValueUtil.isNull(control.getHost()) && control.getHost().modal != undefined && control.getHost().type == "dialog") {
				control.getHost().addEventListenerOnce("close", function(e) {
					/** @type cpr.controls.Dialog */
					var dialog = e.control;
					moAppInstance = dialog.getParent().getAppInstance();
					maAppInstance.splice(maAppInstance.indexOf(dialog.getEmbeddedAppInstance()), 1);
				})
			}
			
			maAppInstance.push(voEmbAppInstance);
			moAppInstance = voEmbAppInstance;
			
			// 단축키 사용
			_setAccessKey();
		}
	}
}

/**
 * 팝업을 띄웁니다.
 */
function _openDialog(pbCurApp) {
	
	var vbCurApp = !ValueUtil.isNull(pbCurApp) ? pbCurApp : false;
	
	if (moDialogApp == null) {
		// DataSource를 확인 할 앱 생성
		_createApp(vbCurApp);
	}
	
	mbPopup = true;
	
	// 특정 다일로그를 닫았을 경우, rootAppInstance를 앱인스턴스로 저장합니다.
	if (moAppInstance.disposed) moAppInstance = moEmbedded;
	if (ValueUtil.isNull(moAppInstance)) {
		var voMainPlatform = cpr.core.Platform.INSTANCE.lookup(AppProperties.MAIN_APP_ID);
		moAppInstance = voMainPlatform.getInstances()[0];
	}
	
	var vsHeaderTitle = "데이터 셋/맵 확인 (모든 화면에 대한 데이터 확인 가능)";
	if (vbCurApp) {
		vsHeaderTitle = "데이터 셋/맵 확인 (현재 화면만 확인, 팝업에서 팝업을 띄운 경우는 확인 불가)";
	}
	
	moAppInstance.getRootAppInstance().openDialog(moDialogApp, {
		width: 800,
		height: 600,
		headerMovable: true,
		resizable: true,
		modal: false,
		escKeySupport: true
	}, function(dialog) {
		dialog.ready(function(dialogApp) {
			// 필요한 경우, 다이얼로그의 앱이 초기화 된 후, 앱 속성을 전달하십시오.
			dialog.headerTitle = vsHeaderTitle;
			dialog.addEventListener("close", function() {
				
				maDatasetId = [];
				moDialogApp = null;
				
				mbPopup = false;
			})
		});
	}).then(function(returnValue){

	});
}


/**
 * 팝업을 열기위한 단축키를 지정합니다.<br>
 * 단축키 : Ctrl + Alt + A/Z (default)
 */

function _setAccessKey() {
	
	if(moAppInstance) {
		
		var container = moAppInstance.getContainer();
		
		if(container) {	
			window.addEventListener("keydown", function (e) {
				if (e.ctrlKey && e.altKey && (e.keyCode == msDynamicKey || e.keyCode == msDynamicKey2)) {
					
					if (!mbPopup) {
						var vbCurApp = (e.keyCode == msDynamicKey2);
						_openDialog(vbCurApp);
					}
					
				}
			});
		}
	}
}

/**
 * 새로운 앱을 생성합니다.
 * @param {Boolean} pbCurApp
 */
function _createApp(pbCurApp) {

	if(moAppInstance) {

		msAppId = moAppInstance.id + "Dialog" + (Math.floor(Math.random()*100)+1);

		var voAppInstance = moAppInstance;
		
		var newApp = new cpr.core.App(msAppId, {
			onPrepare: function(loader){
			},
			onCreate: function(/* cpr.core.AppInstance */ newApp, exports){
				var container = newApp.getContainer();
				var vcCombo = new cpr.controls.ComboBox();
				var vcDataset = new cpr.data.DataSet();
				vcCombo.setItemSet(vcDataset, {
					label: "label",
					value: "value" 
				});
				
				// script start
				newApp.addEventListener("load", function(e){
					// 특정 다이얼로그를 닫았을 경우, rootAppInstance를 앱인스턴스로 저장합니다.
					
					if (voAppInstance.disposed) voAppInstance = moEmbedded;
					
					var vaLoadAppInstance = maAppInstance;
					var vaCurLoadAppInstance = [];
					if (pbCurApp) {
						var rootAppIns = e.control.getRootAppInstance();
						var vcMdiCn = rootAppIns.lookup(AppProperties.MAIN_EMB_CONTROL_ID);
						var selectAppId = "";
						if (vcMdiCn) {
							if (vcMdiCn instanceof cpr.controls.EmbeddedApp) {
								selectAppId = vcMdiCn.getEmbeddedAppInstance().app.id;
							} else if (vcMdiCn instanceof cpr.controls.MDIFolder) {
								var voSelectedItem = vcMdiCn.getSelectedTabItem();
								if (!ValueUtil.isNull(voSelectedItem)) {
									selectAppId = voSelectedItem.content.app.id;
								}
							}
							
							if (selectAppId != "") {
								
								/**
								 * 
								 * @param {cpr.core.AppInstance} poAppInstance
								 * @return {Boolean}
								 */
								function getFinalHost(poAppInstance) {
									
									var voHost = poAppInstance.getHost();
									var voHostIns = poAppInstance.getHostAppInstance();
									if (poAppInstance.app.id == selectAppId) {
										return true;
									} else if (voHostIns) {
										if (voHostIns.app.id == selectAppId) {
											return true;
										} else {
											if (voHost instanceof cpr.controls.Dialog) {
												var vsHostApp = getOpenerApp(poAppInstance);
												
												// 다이얼로그를 띄운 앱인스턴스가 임베디드앱 안에서 띄웠을 경우
												// 임베디드앱을 포함하고 있는 최상위 화면이 selectAppId와 동일한지 확인
												if (vsHostApp) {
													var voFinalParentApp = getFinalParentApp(vsHostApp);
													if (voFinalParentApp == selectAppId) {
														return true;
													}
												}
											} else {
												var voParentHost = voHostIns.getHostAppInstance();
												if (voParentHost) {
													if (voParentHost.app.id == selectAppId) {
														return true;
													} else {
														return getFinalHost(voHostIns);
													}
												}
											}
										}
									}
								}
								
								function getFinalParentApp( /* cpr.core.AppInstance */ poAppInstance) {
									var voHost = poAppInstance.getHostAppInstance();
									if (voHost) {
										if (voHost.app.id == AppProperties.MAIN_APP_ID) {
											return poAppInstance.app.id;
										} else {
											return getFinalParentApp(voHost);
										}
									}
								}
								
								function getOpenerApp( /* cpr.core.AppInstance */ poAppInstance) {
									var voApp = null;
									
									if (!ValueUtil.isNull(poAppInstance.getHost()) && poAppInstance.app.isPopup === true) {
										voApp = poAppInstance.openApp;
									}
									
									return voApp;
								}
								
								vaLoadAppInstance.forEach(function( /*cpr.core.AppInstance*/ each) {
									if (!each.disposed) {
										var voFindApp = getFinalHost(each);
										if (voFindApp === true) {
											vaCurLoadAppInstance.push(each);
										}
									}
								});
							}
						}
					}
					
					if (vaCurLoadAppInstance.length > 0) vaLoadAppInstance = vaCurLoadAppInstance;
					
					var vaAppId = [];
					vaLoadAppInstance.map(function( /* cpr.core.AppInstance */ appInstance) {
						if (!appInstance.disposed) {
							
							// 콤보박스 생성 및 데이터셋을 바인딩 합니다.
							appInstance.getAllDataControls().map(function(each){
								if(each.type.indexOf("submission") == -1) {
									vaAppId.push(each.getAppInstance().id);
									maDatasetId.push(each.id);
								}
							});
							
							appInstance.getContainer().getAllRecursiveChildren().forEach(function(each){
								if(each.type == "embeddedapp" && each.getEmbeddedAppInstance()) {
									each.getEmbeddedAppInstance().getAllDataControls().map(function(args) {
										if(args.type.indexOf("submission") == -1) {
											vaAppId.push(args.getAppInstance().id);
											maDatasetId.push(args.id);
										}
									})
								}
							});
						}
					});

					vcDataset.parseData({
						"columns" : [
							{dataType:"string", name:"label"},
							{dataType:"string", name:"value"}
						],
						"rows" : _setComboData(maDatasetId, vaAppId)
					});
					
					container.addChild(vcCombo, {
						top: mnMargin + "px",
						left: mnMargin + "px",
						right: (mnMargin + parseInt(msRowHeight) + mnSpacing / 2) + "px",
						height: msRowHeight
					});
					vcCombo.selectItem(0);
				});
				
				// refresh button 추가
				var vcBtnRefresh = new cpr.controls.Button();
				vcBtnRefresh.value = "↺";
				vcBtnRefresh.tooltip = "새로고침";
				vcBtnRefresh.style.setClasses("btn-outline-primary", "fs-lg", "text-center", "p-0");
				vcBtnRefresh.addEventListener("click", function(e) {
					vcCombo.dispatchEvent(new cpr.events.CEvent("selection-change"));
				});
				container.addChild(vcBtnRefresh, {
					top: mnMargin + "px",
					right: mnMargin + "px",
					width: msRowHeight,
					height: msRowHeight
				});
				
				// 콤보박스 selection-change 발생 시, 그리드(dataset) or 폼레이아웃(datamap) 생성
				vcCombo.addEventListener("selection-change", function(e) {
					// 1. 기존 그리드 또는 폼레이아웃이 그려져 있는 경우 삭제합니다.
					var grid = container.getChildren().filter(function(each) {
						if (each.type == "grid" || each.type == "container") return each;
					})[0];
					if(grid) container.removeChild(grid);
					
					// 2. 콤보박스에서 선택한 데이터 컨트롤의 정보를 호출합니다.
					/** @type cpr.data.DataSet */
					var dataControl = null;
					maAppInstance.map(function(/* cpr.core.AppInstance */ appInstance) {
						if(dataControl || appInstance.disposed) return;
						
						dataControl = appInstance.getAllDataControls().filter(function(each){
							if((appInstance.id + "_" + each.id) == vcCombo.value) return each;
						})[0];
					});

					if(dataControl == null || dataControl == "" || dataControl == undefined) {
						maAppInstance.forEach(function(appInstance) {
							appInstance.getContainer().getAllRecursiveChildren().map(function(each){
								if(dataControl) return;
							
								if(each.type == "embeddedapp" && each.getEmbeddedAppInstance()) {
									dataControl = each.getEmbeddedAppInstance().getAllDataControls().filter(function(args) {
										if(each.getEmbeddedAppInstance().id + "_" + args.id == vcCombo.value) return args;
									})[0];
								}
							});
						});
					}

					if(dataControl.type == "dataset" || dataControl.type == "dataview") {
						// 데이터셋일 경우
						// 데이터셋의 status 컬럼을 추가합니다.
						var voColumns = dataControl.getColumnNames();
						voColumns.splice(0, 0, AppProperties.GRID_STATE_COL_HEADER_TEXT);
						var data = _setDatasetData(voColumns, dataControl);
	
						var newDataset = new cpr.data.DataSet();
						newDataset.parseData({
							columns : data["column"],
							rows : data["row"]
						});
						
						// 그리드 생성
						_createGrid(newDataset);
					} else if(dataControl.type == "datamap"){

						// 데이터맵일 경우
						// 폼레이아웃 생성

						_createFormLayout(dataControl);
					}
					
					// 컨테이너에 생성한 그리드를 추가합니다.
					container.addChild(mcControl, {
						top: (parseInt(msRowHeight) + mnMargin + mnSpacing) + "px",
						left: mnMargin + "px",
						right: mnMargin + "px",
						bottom: mnMargin + "px"
					});
				});
			}
		});
		cpr.core.Platform.INSTANCE.register(newApp);
		moDialogApp = newApp;
	}
}


/**
 * 그리드를 생성하고 초기정보를 설정합니다.
 * @param {cpr.data.DataSet} pcDataset
 */
function _createGrid(pcDataset) {

	mcControl = new cpr.controls.Grid();
	
	var vaAutoFit = [];
	var cellCount = pcDataset.getColumnCount();
	for (var idx = 2; idx <= cellCount; idx++) {
		vaAutoFit.push(idx);
	}
	mcControl.init({
		"dataSet": pcDataset,
		"autoFit": vaAutoFit.join(","), // NO, F 컬럼은 autoFit 제외
		"columnMovable": true,
		"resizableColumns": "all",
		"selectionMulti": "multi",
		"selectionUnit": "cell",
		"columns": _getColumns(pcDataset),
		"header": {
			"rows": [{"height": msRowHeight}],
			"cells": _getCells(pcDataset),
		},
		"detail": {
			"rows": [{"height": msRowHeight}],
			"cells": _getCells(pcDataset)
		}
	});
}


/**
 * 폼레이아웃을 생성합니다.
 * @param {cpr.data.DataMap} pcDataControl
 */
function _createFormLayout(pcDatamap) {
	mcControl = new cpr.controls.Container();
	var verticalLayout = new cpr.controls.layouts.VerticalLayout();
	verticalLayout.scrollable = true;
	mcControl.setLayout(verticalLayout);
	mcControl.style.addClass(msFormCls);

	var form = new cpr.controls.Container();
	var formLayout = new cpr.controls.layouts.FormLayout;
	formLayout.horizontalSeparatorWidth = 1;
	formLayout.verticalSeparatorWidth = 1;
	formLayout.setColumns(["1fr", "1fr"]);
	formLayout.setRows(_setFormRows(pcDatamap));
	formLayout.setUseRowShade(0, true);
	form.setLayout(formLayout);
	
	mcControl.addChild(form, {
		autoSize : "height"
	});
	
	_setControlToForm(form, pcDatamap);
}

/**
 * 데이터셋의 row 정보를 반환합니다.
 * @param {String[]} poColumns 데이터셋 아이디 배열
 * @param {String[]} paAppId 앱아이디 배열
 */
function _setComboData(poColumns, paAppId) {
	var voRows = [];
	
	poColumns.forEach(function( /* String */ each, index) {
		if(each) {
			var eachRow = {};
			var rowValue = paAppId[index] + "_" + each;
			var vbDuplicate = false;
			
			voRows.map(function(each){
				if(each.value == rowValue) {
					vbDuplicate = true;
					return;
				}
			})
			
			if(!vbDuplicate) {
				eachRow["label"] = each + " - "+ paAppId[index] +"" ;
				eachRow["value"] = rowValue;
				voRows.push(eachRow);
			}
		}
	});
	
	return voRows;
}


/**
 * 폼레이아웃의 row를 설정합니다.
 * @param {cpr.data.DataMap} pcDatamap
 */
function _setFormRows(pcDatamap) {
	var voRows = [];
	for(var idx = 0; idx < pcDatamap.getColumnCount()+1; idx++){
		voRows.push(msRowHeight);
	}
	return voRows;
}


/**
 * 데이터맵의 컬럼 수 만큼 폼레이아웃에 자식컨트롤을 추가합니다.
 * @param {cpr.controls.Container} pcContainer
 * @param {cpr.data.DataMap} pcDatamap
 */
function _setControlToForm(pcContainer, pcDatamap) {
	_addFormChild(pcContainer, "KEY", 0, 0);
	_addFormChild(pcContainer, "VALUE", 1, 0);
	
	for(var idx = 0; idx < pcDatamap.getColumnCount(); idx++){
		var vsKey = pcDatamap.getColumnNames()[idx];
		_addFormChild(pcContainer, vsKey, 0, idx+1);
		_addFormChild(pcContainer, pcDatamap.getValue(vsKey), 1, idx+1);
	}
}


/**
 * 폼레이아웃 안에 아웃풋을 추가합니다.
 * @param {cpr.controls.Container} pcContainer
 * @param {String} psValue
 * @param {Number} colIndex
 * @param {Number} rowIndex
 */
function _addFormChild(pcContainer, psValue, colIndex, rowIndex) {
	var vcOutput = new cpr.controls.Output();
	vcOutput.value = psValue;
	vcOutput.tooltip = psValue;
	 
	// 스타일 클래스 추가
	vcOutput.style.addClass(msOptCls);
	
	pcContainer.addChild(vcOutput, {
		"colIndex" : colIndex, 
		"rowIndex" : rowIndex
	});
	
	pcContainer.redraw();
}


/**
 * 그리드 헤더의 컬럼 수를 저장합니다.
 * @param {cpr.data.DataSet} pcDataset
 */
function _getColumns(pcDataset) {
	var vaColumns = [];
	vaColumns.push({"width": "30px"}); // rowindex column 너비
	
	for(var idx = 0; idx < pcDataset.getHeaders().length; idx++){
		if(idx == 0) {
			vaColumns.push({"width": "50px"}); // status column 너비
		} else {
			vaColumns.push({"width": "100px"});
		}
	}
	return vaColumns;
}


/**
 * 그리드 header, detail의 cells에 들어갈 데이터를 저장합니다.
 * @param {cpr.data.DataSet} pcDataset
 */
function _getCells(pcDataset) {
	var vaHeaderCell = [];
	
	// rowindex 추가 
	vaHeaderCell.push(_setGridConfigurator(0, AppProperties.GRID_INDEX_COL_HEADER_TEXT));
	
	for(var idx = 0; idx < pcDataset.getHeaders().length; idx++){
		vaHeaderCell.push(_setGridConfigurator(idx+1, pcDataset.getColumnNames()[idx]));
	}

	return vaHeaderCell;
}


/**
 * cell의 configurator를 반환합니다.
 * @param {Number} colIndex
 * @param {String} psColumn 컬럼명
 */
function _setGridConfigurator(colIndex, psColumn) {
	
	var configurator = {
		"constraint" : {
			"rowIndex" : 0,
			"colIndex" : colIndex
		},
		"configurator": function(cell) {
			cell.targetColumnName = psColumn == AppProperties.GRID_INDEX_COL_HEADER_TEXT ? null : psColumn; // header
			cell.text = psColumn; // header
			cell.filterable = true;
			cell.sortable = true;
			cell.columnName = psColumn == AppProperties.GRID_INDEX_COL_HEADER_TEXT ? null : psColumn; // detail
			cell.columnType = psColumn == AppProperties.GRID_INDEX_COL_HEADER_TEXT ? "rowindex" : "normal"; // detail
			cell.bind("tooltip").toExpression("getString('" + psColumn + "')")
		}
	}
	
	
	return configurator;
}


/**
 * 데이터셋의 row 정보를 반환합니다.
 * @param {String[]} poColumns 데이터셋 컬럼명 배열
 * @param {cpr.data.DataSet} pcDataset
 */
function _setDatasetData(poColumns, pcDataset) {
	var voColumns = [];
	var voRows = [];

	// column
	poColumns.forEach(function( /* String */ each) {
		var eachColumn = {dataType: "string"};
		eachColumn["name"] = each;
		voColumns.push(eachColumn);
	});
	
	// row ( 필터되지 않은 전체 데이터 확인 )
	pcDataset.forEachOfUnfilteredRows(function(dataRow, idx) {
		var eachRow = {};
		poColumns.forEach(function( /* String */ each) {
			if (each == AppProperties.GRID_STATE_COL_HEADER_TEXT) {
				eachRow[each] = dataRow.getStateString();
			} else {
				eachRow[each] = dataRow.getValue(each);
			}
		});
		voRows.push(eachRow);
	});
	
	return {
		"column" : voColumns,
		"row" : voRows
	};
}

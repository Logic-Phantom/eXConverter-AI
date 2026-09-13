/************************************************
 * mobileCalendar.module.js
 * Created at 2021. 5. 10. 오전 11:53:57.
 *
 * Version 1.1
 * Updated Date : 2021-12-03
 * 
 * @author daye
 ************************************************/

/*
 * 모바일에서 볼 수 있는 캘린더 모듈
 * mbUse = true 일 때 사용 가능 하며, 
 * 데이트 인풋의 사용자 속성이 mobile-calendar=true 로 설정되고 모바일 화면일 때 팝업형태로 제공됩니다.
 * 
 * [모바일 캘린더 형태]
 * 1. 캘린더 형태(Android datePicker 형태)
 * 2. 스핀 형태 - mbSpinDatePicker=true 로 설정하여 사용 가능
 * 
 * 스크린구성이 mobile 이 포함되어 있을 때 사용 하는 것을 권장합니다.
 * 스크린 구성에 모바일 사이즈가 없을 경우 mnMblScrnSz 의 값을 설정하여 사용 할 수 있습니다.
 */


/************************************************
 * 변경 가능 변수
 ************************************************/
/**
 * 모듈 사용 여부
 * @type {Boolean}
 */
var mbUse = true;

/**
 * 모바일 캘린더 형태
 * default : false (캘린더 형태)
 * true 일 경우에는 스핀형태로 제공합니다.
 * @type {Boolean}
 */
var mbSpinDatePicker = false;

/**
 * 사용자 속성
 * 모바일 캘린더를 사용하기 위한 데이트인풋에 작성합니다.
 * true 일 때 사용 가능
 * @type {String}
 */
var ATTR_MOBILE_CALENDAR = "mobile-calendar";

/**
 * 사용자 속성
 * 모바일 캘린더를 사용 시, 캘린더가 위치할 타겟 컨테이너를 설정합니다.
 * 현재 앱인스턴스일 경우 "app" 으로 작성하며, 그 외는 그룹ID 를 작성합니다.
 * default 는 루트 컨테이너에 설정됩니다.
 * @type {String}
 */
var ATTR_TARGET_CALENDAR_GROUP_ID  = "target-calendar-group-id";

/**
 * 다이얼로그 overlay 스타일 클래스
 * @type {String}
 */
var msDialogOverlayCls = "cl-overlay";

/**
 * 다이얼로그 스타일 클래스
 * @type {String}
 */
var msDialogCls = "rounded-0";

/**
 * [취소] 버튼 스타일 클래스
 * @type {String}
 */
var msCancelBtnCls = "btn-primary rounded-0";

/**
 * [확인] 버튼 스타일 클래스
 * @type {String}
 */
var msConfirmBtnCls = "btn-primary rounded-0";

/**
 * 버튼 높이
 * @type {Number}
 */
var mnBtnHeight = 50;

/**
 * 커스텀 스크롤 사용 여부
 * @type {Boolean}
 */
var mbCustomScroll = false;

/**
 * 스크린 사이즈 너비
 * 스크린 구성에 모바일 사이즈가 정의 되지 않았을 경우에 사용
 * @type {Number}
 */
var mnMblScrnSz = 450;

/* ******************************
 *  캘린더형 다이얼로그
 ********************************/
/**
 * 다이얼로그 headerTitle 을 선택날짜로 변경 여부
 * @type {Boolean}
 */
var mbDateTitle = false;

/**
 * root 컨테이너 스타일 클래스
 * @type {String}
 */
var msRootCtnCls = "";

/**
 * 캘린더 스타일 클래스
 * @type {String}
 */
var msCalendarCls = "mobile-cal";

/* ******************************
 * 스핀형 다이얼로그
 * *******************************/
/**
 * 다이얼로그 내부 그룹 스타일 클래스	
 * @type {String}
 */
var msFormCls = "calendar-box border-0";

/**
 * 다이얼로그 내부 그리드 스타일 클래스
 * @type {String}
 */
var msGrdCls = "border-0";

/**
 * 그리드 행 높이
 * @type {Number}
 */
var mnRowHeight = 50;

/**
 * 
 * @type {String}
 */
var msLangYear = cpr.I18N.INSTANCE.message("year") || "년";

/**
 * 
 * @type {String}
 */
var msLangMonth = cpr.I18N.INSTANCE.message("month") || "월";

/**
 * 
 * @type {String}
 */
var msLangDate = cpr.I18N.INSTANCE.message("date") || "일";

/**
 * 
 * @type {String}
 */
var msLangCancel = cpr.I18N.INSTANCE.message("cancel") || "취소";

/**
 * 
 * @type {String}
 */
var msLangConfirm = cpr.I18N.INSTANCE.message("confirm") || "확인";


/************************************************
 * 내부 변수
 ************************************************/

/**
 * 다이얼로그 뜨는 위치
 */
var maProp = {
	left : 0,
	right : 0,
	bottom : 0,
	height : 0
}

/**
 * 다이얼로그 name
 */
var msDialogNm = "mobileCalendarDialog";

/**
 * 언어코드
 */
var msLocale = "ko";

/************************************************
 * 이벤트 버스
 ************************************************/
if(mbUse) {
	cpr.events.EventBus.INSTANCE.addFilter("click", fn_click);
	cpr.events.EventBus.INSTANCE.addFilter("touchend", fn_click); // 모바일 이벤트 버스 (최초 preventInput=false 일 경우)
}

/**
 * 클릭 이벤트 버스
 * @param {cpr.events.CMouseEvent} e
 */
function fn_click (e) {
	/** @type cpr.controls.DateInput */
	var control = e.control;
	
	if(control.type == "dateinput" && control.userAttr(ATTR_MOBILE_CALENDAR) == "true") {
		
		if(control.readOnly) return;
		
		/** @type cpr.core.AppInstance */
		var voAppInstance = control.getAppInstance();
		var vsTargetScreen = voAppInstance.targetScreen.name;
		
		// 스크린 구성에 mobile 이 없는 경우 (2022.01.24 추가)
		var vbTgtScrnMbl = _checkTargetScreen(voAppInstance);
		
		if(vbTgtScrnMbl) {
			// 모바일 화면일 경우에만 팝업형태 datePicker 제공
			
			// 0. locale 설정
			msLocale = _.clone(cpr.I18N.INSTANCE.currentLanguage);
			cpr.I18N.INSTANCE.currentLanguage = control.locale;
			
			if(!control.preventInput && e.type == "touchend" && e.target.classList.contains("cl-dateinput-button")) {
				/*
				 * 모바일 (touchend event 발생)
				 * 최초 다이얼로그 캘린더 컨트롤 포커스 시, 데이트 인풋 click 이벤트 전파 
				 * -> open 후 click event 에서 close 되도록 수정
				 */
				// 1.0.3738(2022-04) 버전의 경우 아래 open API 주석 해제 후 사용
//				control.open();
			} else {
				/*
				 * 데스크탑 (click event 발생)
				 * click 과 동시에 calendar 가 오픈되므로 항상 close 처리 필요
				 */
				control.close();
			}
			
			// 1) 키보드, 캘린더 오픈 방지
			control.preventInput = true;
			
			// 1-1) preventInput 속성 즉시 적용
			cpr.core.DeferredUpdateManager.INSTANCE.update();

			// 2) 기본 캘린더 오픈 방지
			e.preventDefault();
			
			// 3) 팝업생성
			var voApp = null;
			if(mbSpinDatePicker) {
				voApp = _createSpinApp(control);
			} else {
				voApp = _createBasicApp(control);	
			}

			_openDialog(voAppInstance, voApp, control);
		}
	}
} 

/**
 * 
 * @param {cpr.core.AppInstance} poApp
 * @return {Boolean}
 */
function _checkTargetScreen (poApp) {

	if(!(poApp instanceof cpr.core.AppInstance)) return;
	
	var vsTargetScrn = poApp.targetScreen.name;
	var isMobile = vsTargetScrn == "mobile";
	
	if(!isMobile) {
		
		// 스크린 구성에 mobile 이 없을 경우
		var vaSupportedMediaNms = poApp.allSupportedMediaNames;
		if(!(vaSupportedMediaNms instanceof Array)) return;
		
		if(vaSupportedMediaNms.indexOf("mobile") == -1) {
			
			var voHost = poApp.getHost();
			if(voHost) {
				var vnHostWid = voHost.getActualRect().width;
				if(vnHostWid <= mnMblScrnSz) {
					isMobile = true;
				}
			}
		}
	}
		
	return isMobile;
}


/**
 * TYPE2 - 스핀형태
 * 다이얼로그로 띄우기 위한 앱을 생성합니다.
 * @param {cpr.controls.DateInput} pcDateInput
 */
function _createSpinApp (pcDateInput) {

	var vsAppId = "Mobile_Spin_Calendar_$" + (Math.floor(Math.random()*100)+1);
	var newApp = new cpr.core.App(vsAppId, {
		onPrepare: function(loader){
		},
		onCreate: function(/* cpr.core.AppInstance */ app, exports){
			var linker = {};
			// Start - User Script
			var voAppConf = cpr.core.AppConfig.INSTANCE;
			var voI18Conf = voAppConf.getEnvConfig();
			voI18Conf.setValue("useCustomScrollbar", mbCustomScroll);
			
			function onBodyLoad (/*  cpr.events.CEvent */ e) {
				
				/** @type cpr.controls.Grid */
				var grdYear = app.lookup("grdYear");
				/** @type cpr.controls.Grid */
				var grdMonth = app.lookup("grdMonth");
				/** @type cpr.controls.Grid */
				var grdDate = app.lookup("grdDate");
				
				/** @type cpr.data.DataSet */
				var dsYear = app.lookup("dsYear");
				/** @type cpr.data.DataSet */
				var dsMonth = app.lookup("dsMonth");
				/** @type cpr.data.DataSet */
				var dsDate = app.lookup("dsDate");
				
				/* 1. 각 년/월/일 데이터 추가 */ 
				var initValue = app.getHostProperty("initValue");
				var minDate = pcDateInput.minDate;
				var maxDate = pcDateInput.maxDate;
				
				// 1-1) 년도 데이터
				var vsMinYear = minDate.getFullYear();
				var vsMaxYear = maxDate.getFullYear();
				for(var idx = vsMinYear; idx <= vsMaxYear; idx++){
					dsYear.addRowData({
						"label" : idx + msLangYear,
						"value" : idx
					})
				}
				
				// 1-2) 월 데이터
				for(var idx = 1; idx <= 12; idx++){
					dsMonth.addRowData({
						"label" : idx + msLangMonth,
						"value" : idx
					})
				}
				
				// 1-3) 일 데이터
				for(var idx = 1; idx <= 31; idx++){
					dsDate.addRowData({
						"label" : idx + msLangDate,
						"value" : idx
					})
				}

				/* 2. setState unchanged */
				dsYear.commit();
				dsMonth.commit();
				dsDate.commit();
				
				/* 3. dialog Animation */
				var dialog = app.getHost();
				if (dialog && dialog instanceof cpr.controls.Dialog) {
					var vnHeight = dialog.getAppInstance().getActualRect().height * 0.4;
					
					dialog.style.animateTo({
						"transform": "translateY(" + maProp.bottom + "px)",
						"max-height": vnHeight + "px",
					}, 0.3, cpr.animation.TimingFunction.EASE_IN_OUT_CUBIC);
					
					cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function() {
						
						// 다이얼로그 animateTo 가 완료되었을 때 constraint 변경
						var dialogManager = dialog.getAppInstance().dialogManager;
						var oldConstraint = dialogManager.getConstraintByName(msDialogNm);
						var newConstraint = oldConstraint;
						newConstraint.height = vnHeight;
						dialogManager.replaceConstraintByName(msDialogNm, newConstraint);
						
						/* 4. Selection */
						grdDate.addEventListenerOnce("measure-size", function() {
							
							// 그리드가 아래에서 위로 모두 올라온 후 focusCell
							cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function() {
								/* Selection Focus */
								var vsYear = initValue ? moment(initValue).format("YYYY") : new Date().getFullYear();
								var vnYearIndex = dsYear.getColumnData("value").indexOf(vsYear + "");
								grdYear.focusCell(vnYearIndex, 0);
								
								var vsMonth = initValue ? Number(moment(initValue).format("MM")) : new Date().getMonth() + 1;
								var vnMonthIndex = dsMonth.getColumnData("value").indexOf(vsMonth + "");
								grdMonth.focusCell(vnMonthIndex, 0);
								
								var vsDate = initValue ? Number(moment(initValue).format("DD")) : new Date().getDate();
								var vnDateIndex = dsDate.getColumnData("value").indexOf(vsDate + "");
								grdDate.focusCell(vnDateIndex, 0);
							})
						})
					})
				}
			};
				
			/**
			 * 선택 날짜에 따른 날짜 enable 처리
			 */
			function _setEnableCalendar () {
				/** @type cpr.controls.Grid */
				var grdYear = app.lookup("grdYear");
				/** @type cpr.controls.Grid */
				var grdMonth = app.lookup("grdMonth");
				/** @type cpr.controls.Grid */
				var grdDate = app.lookup("grdDate");
				
				// Date filter
				var minDate = pcDateInput.minDate;
				var maxDate = pcDateInput.maxDate;
				
				var voYearRow =  grdYear.getSelectedRow();
				var voMonthRow =  grdMonth.getSelectedRow();
				
				// 1-1) 선택 년도에 따른 월 enabled
				if(voYearRow) {
					var vsYearSelection = voYearRow.getRowData()["value"];
					if(vsYearSelection == minDate.getFullYear()) {
						grdMonth.setFilter("value >= " + (minDate.getMonth()+1));
					}
					else if(vsYearSelection == maxDate.getFullYear()) {
						grdMonth.setFilter("value <= " + (maxDate.getMonth()+1));
					} else {
						grdMonth.clearFilter();
					}
				}
				
				// 1-2) 선택 년도, 월 에 따른 일 enabled
				if(voYearRow && voMonthRow) {
					var vsMonthSelection = voMonthRow.getRowData()["value"];
					if(vsYearSelection == minDate.getFullYear() && vsMonthSelection == minDate.getMonth()+1) {
						grdDate.setFilter("value >= " + minDate.getDate());
					}
					else if(vsYearSelection == maxDate.getFullYear() && vsMonthSelection == maxDate.getMonth()+1) {
						grdDate.setFilter("value <= " + maxDate.getDate());
					}
					else {
						var lastDate = new Date(Number(vsYearSelection), Number(vsMonthSelection), 0);
						grdDate.setFilter("value <= " + lastDate.getDate());
					}
				}
			}
			
			function onGrdSelectionChange(/* cpr.events.CSelectionEvent */ e){
				_setEnableCalendar();
			};
			
			function onBtnCancelClick (/*cpr.events.CMouseEvent*/ e) {
				app.close();
			}
			
			function onBtnConfirmClick (/*cpr.events.CMouseEvent*/ e) {
				var year = app.lookup("grdYear").getSelectedRow().getRowData()["value"] + "";
				var month = ("0" + app.lookup("grdMonth").getSelectedRow().getRowData()["value"]).slice(-2);
				var date = ("0" + app.lookup("grdDate").getSelectedRow().getRowData()["value"]).slice(-2);
				
				var vsSelectedDate = year+month+date;
				
				// enabledDateExp 로 비활성 날짜 제어
				var vsValidDate = year+"-"+month+"-"+date;
				var enabledExp = pcDateInput.enabledDateExp;
				var vsExp = "new Date(vsValidDate)."+ enabledExp;
				if(!(eval(vsExp))) {
					alert("선택 불가능한 날짜 입니다.");
					return false;
				}
				
				app.close(vsSelectedDate);
			}
			// End - User Script
			
			// Header
			var dataSet_1 = new cpr.data.DataSet("dsYear");
			dataSet_1.parseData({
				"columns" : [
					{"name": "label"},
					{"name": "value"}
				]
			});
			app.register(dataSet_1);
			
			var dataSet_2 = new cpr.data.DataSet("dsMonth");
			dataSet_2.parseData({
				"columns" : [
					{"name": "label"},
					{"name": "value"}
				]
			});
			app.register(dataSet_2);
			
			var dataSet_3 = new cpr.data.DataSet("dsDate");
			dataSet_3.parseData({
				"columns" : [
					{"name": "label"},
					{"name": "value"}
				]
			});
			app.register(dataSet_3);
			
			app.supportMedia("all and (min-width: 1024px)", "default");
			app.supportMedia("all and (min-width: 500px) and (max-width: 1023px)", "tablet");
			app.supportMedia("all and (max-width: 499px)", "mobile");
			
			// Configure root container
			var container = app.getContainer();
			container.style.css({
				"width" : "100%",
				"top" : "0px",
				"height" : "100%",
				"left" : "0px"
			});
			
			var vaRows = (function(pnHeight){
				var rows = [];
				rows.push("1fr");
				rows.push(pnHeight + "px");
				return rows;
			})(mnBtnHeight)
			
			// Layout
			var formlayout_1 = new cpr.controls.layouts.FormLayout();
			formlayout_1.setRows(vaRows);
			formlayout_1.setColumns(["1fr", "1fr"]);
			formlayout_1.horizontalSpacing = "0px";
			formlayout_1.verticalSpacing = "0px";
			formlayout_1.verticalSeparatorClass = "class";
			formlayout_1.verticalSeparatorWidth = 1;
			container.setLayout(formlayout_1);
			
			// UI Configuration
			var vcGroup = new cpr.controls.Container("grpForm");
			vcGroup.style.addClass(msFormCls);
			container.addChild(vcGroup, {
				rowIndex : 0,
				colIndex : 0,
				colSpan : 2
			});
			
			var formlayout_2 = new cpr.controls.layouts.FormLayout();
			formlayout_2.setRows(["1fr"]);
			formlayout_2.setColumns(["1fr", "1fr", "1fr"]);
			formlayout_2.horizontalSpacing = "0px";
			formlayout_2.scrollable = false;
			vcGroup.setLayout(formlayout_2);
			
			
			var grid_1 = new cpr.controls.Grid("grdYear");
			grid_1.autoFit = "all";
			grid_1.style.addClass(msGrdCls);
			grid_1.init({
				"dataSet": app.lookup("dsYear"),
				"columns": [{"width": "10px"}],
				"detail": {
					"rows": [{"height": "" + mnRowHeight+ "px"}],
					"cells": [{
						"constraint": {"rowIndex": 0, "colIndex": 0},
						"configurator": function(cell){
							cell.columnName = "label";
							cell.control = (function() {
								var output = new cpr.controls.Output();
								output.bind("value").toDataColumn("label");
								return output;
							})();
						}
					}]
				}
			});
			if(typeof onGrdSelectionChange == "function"){
				grid_1.addEventListener("selection-change", onGrdSelectionChange);
			}
			vcGroup.addChild(grid_1, {
				rowIndex : 0,
				colIndex : 0
			});
			
			var grid_2 = new cpr.controls.Grid("grdMonth");
			grid_2.autoFit = "all";
			grid_2.style.addClass(msGrdCls);
			grid_2.init({
				"dataSet": app.lookup("dsMonth"),
				"columns": [{"width": "10px"}],
				"detail": {
					"rows": [{"height": "" + mnRowHeight+ "px"}],
					"cells": [{
						"constraint": {"rowIndex": 0, "colIndex": 0},
						"configurator": function(cell){
							cell.columnName = "label";
							cell.control = (function() {
								var output = new cpr.controls.Output();
								output.bind("value").toDataColumn("label");
								return output;
							})();
						}
					}]
				}
			});
			if(typeof onGrdSelectionChange == "function"){
				grid_2.addEventListener("selection-change", onGrdSelectionChange);
			}
			vcGroup.addChild(grid_2, {
				rowIndex : 0,
				colIndex : 1
			});
			
			var grid_3 = new cpr.controls.Grid("grdDate");
			grid_3.autoFit = "all";
			grid_3.style.addClass(msGrdCls);
			grid_3.init({
				"dataSet": app.lookup("dsDate"),
				"columns": [{"width": "10px"}],
				"detail": {
					"rows": [{"height": "" + mnRowHeight+ "px"}],
					"cells": [{
						"constraint": {"rowIndex": 0, "colIndex": 0},
						"configurator": function(cell){
							cell.columnName = "label";
							cell.control = (function() {
								var output = new cpr.controls.Output();
								output.bind("value").toDataColumn("label");
								return output;
							})();
						}
					}]
				}
			});
			vcGroup.addChild(grid_3, {
				rowIndex : 0,
				colIndex : 2
			});
			
			var vcCancelBtn = new cpr.controls.Button("btnCancel");
			vcCancelBtn.value = msLangCancel;
			vcCancelBtn.style.addClass(msCancelBtnCls);
			if(typeof onBtnCancelClick == "function"){
				vcCancelBtn.addEventListener("click", onBtnCancelClick);
			}
			container.addChild(vcCancelBtn, {
				rowIndex : 1,
				colIndex : 0
			});
			
			var vcConfirmBtn = new cpr.controls.Button("btnConfirm");
			vcConfirmBtn.value = msLangConfirm;
			vcConfirmBtn.style.addClass(msConfirmBtnCls);
			if(typeof onBtnConfirmClick == "function"){
				vcConfirmBtn.addEventListener("click", onBtnConfirmClick);
			}
			container.addChild(vcConfirmBtn, {
				rowIndex : 1,
				colIndex : 1
			});
			
			if(typeof onBodyLoad == "function"){
				app.addEventListener("load", onBodyLoad);
			}
		}
	});
	newApp.title = vsAppId;
	cpr.core.Platform.INSTANCE.register(newApp);
	
	return newApp;
}

/**
 * TYPE1 - 캘린더형태
 * 다이얼로그로 띄우기 위한 앱을 생성합니다.
 * @param {cpr.controls.DateInput} pcDateInput
 */
function _createBasicApp (pcDateInput) {
	
	var vsAppId = "Mobile_Calendar_$" + (Math.floor(Math.random()*100)+1);
	var newApp = new cpr.core.App(vsAppId, {
		onPrepare: function(loader){
		},
		onCreate: function(/* cpr.core.AppInstance */ app, exports){
			var linker = {};
			// Start - User Script
			var voAppConf = cpr.core.AppConfig.INSTANCE;
			var voI18Conf = voAppConf.getEnvConfig();
			voI18Conf.setValue("useCustomScrollbar", mbCustomScroll);
			
			function onBodyLoad (/* cpr.events.CEvent */ e) {
				/** @type cpr.controls.Calendar */
				var vcCalendar = app.lookup("cal1");
				
				// 캘린더 기본 속성 설정
				vcCalendar.defaultDate = pcDateInput.defaultDate;
				vcCalendar.locale = pcDateInput.locale;
				vcCalendar.enabledDateExp = pcDateInput.enabledDateExp;
				vcCalendar.minDate = pcDateInput.minDate;
				vcCalendar.maxDate = pcDateInput.maxDate;
				
				// initValue 설정
				var initValue = app.getHostProperty("initValue");
				if(initValue) vcCalendar.value = initValue;
				
				var dialog = app.getHost();
				if (dialog && dialog instanceof cpr.controls.Dialog) {
					// dialog Height 설정
					var vnHeight = dialog.getAppInstance().getActualRect().height * 0.8;
					
					dialog.style.animateTo({
						"transform": "translateY(-" + maProp.bottom + "px)",
						"max-height": vnHeight + "px",
					}, 0.3, cpr.animation.TimingFunction.EASE_IN_OUT_CUBIC);
					
					cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function() {
						
						// 다이얼로그 animateTo 가 완료되었을 때 constraint 변경
						var dialogManager = dialog.getAppInstance().dialogManager;
						var oldConstraint = dialogManager.getConstraintByName(msDialogNm);
						var newConstraint = oldConstraint;
						newConstraint.height = vnHeight;
						dialogManager.replaceConstraintByName(msDialogNm, newConstraint);
					})
				}
			}
			
			function onCalendarValueChange (/* cpr.events.CSelectionEvent */ e) {
				
				/** @type cpr.controls.Calendar */
				var calendar = e.control;
				
				// 달력 선택 시 선택날짜 headerTitle 로 설정
				var dialog = app.getHost();
				if (dialog && dialog instanceof cpr.controls.Dialog) {
					if(mbDateTitle) {
						var vaDayNames = ["일", "월", "화",  "수", "목", "금", "토"];
						dialog.headerTitle = cpr.utils.Util.template("${year}년 ${month}월 ${date}일 (${day})", {
							year : moment(calendar.value).format("YYYY"),
							month : moment(calendar.value).format("MM"),
							date : moment(calendar.value).format("DD"),
							day : vaDayNames[moment(calendar.value).days()]
						})
					}
				}
			}
			
			function onBtnCancelClick (/* cpr.events.CMouseEvent */ e) {
				app.close();
			}
			
			function onBtnConfirmClick ( /* cpr.events.CMouseEvent */ e) {
				/** @type cpr.controls.Calendar */
				var vcCalendar = app.lookup("cal1");
				app.close(vcCalendar.value);
			}
			
			// End - User Script
			
			// Header
			
			app.supportMedia("all and (min-width: 1024px)", "default");
			app.supportMedia("all and (min-width: 500px) and (max-width: 1023px)", "tablet");
			app.supportMedia("all and (max-width: 499px)", "mobile");
			
			// Configure root container
			var container = app.getContainer();
			container.style.addClass(msRootCtnCls);
			container.style.css({
				"width" : "100%",
				"top" : "0px",
				"height" : "100%",
				"left" : "0px"
			});
			
			var vaRows = (function(pnHeight){
				var rows = [];
				rows.push("1fr");
				rows.push(pnHeight + "px");
				return rows;
			})(mnBtnHeight)
			
			// Layout
			var formlayout_1 = new cpr.controls.layouts.FormLayout();
			formlayout_1.setRows(vaRows);
			formlayout_1.setColumns(["1fr", "1fr"]);
			formlayout_1.horizontalSpacing = "0px";
			formlayout_1.verticalSpacing = "0px";
			formlayout_1.verticalSeparatorWidth = 1;
			container.setLayout(formlayout_1);
			
			// UI Configuration
			var calendar_1 = new cpr.controls.Calendar("cal1");
			calendar_1.footerVisible = false;
			calendar_1.style.addClass(msCalendarCls);
			if(typeof onCalendarValueChange == "function"){
				calendar_1.addEventListener("value-change", onCalendarValueChange); //  변경
			}
			container.addChild(calendar_1, {
				rowIndex : 0,
				colIndex : 0,
				colSpan : 2
			});
			
			var vcCancelBtn = new cpr.controls.Button("btnCancel");
			vcCancelBtn.value = msLangCancel;
			vcCancelBtn.style.addClass(msCancelBtnCls);
			if(typeof onBtnCancelClick == "function"){
				vcCancelBtn.addEventListener("click", onBtnCancelClick);
			}
			container.addChild(vcCancelBtn, {
				rowIndex : 1,
				colIndex : 0
			});
			
			var vcConfirmBtn = new cpr.controls.Button("btnConfirm");
			vcConfirmBtn.value = msLangConfirm;
			vcConfirmBtn.style.addClass(msConfirmBtnCls);
			if(typeof onBtnConfirmClick == "function"){
				vcConfirmBtn.addEventListener("click", onBtnConfirmClick);
			}
			container.addChild(vcConfirmBtn, {
				rowIndex : 1,
				colIndex : 1
			});
			
			if(typeof onBodyLoad == "function"){
				app.addEventListener("load", onBodyLoad);
			}
		}
	});
	newApp.title = vsAppId;
	cpr.core.Platform.INSTANCE.register(newApp);
	
	return newApp;
}

/**
 * 다이얼로그를 띄웁니다.
 * @param {cpr.core.AppInstance} poAppIns
 * @param {cpr.core.App} poDialogApp
 * @param {cpr.controls.DateInput} pcDateInput
 */
function _openDialog (poAppIns, poDialogApp, pcDateInput) {
	
	if(!(poAppIns instanceof cpr.core.AppInstance)) return;
	if(!(poDialogApp instanceof cpr.core.App)) return;
	
	var vsHeaderTitle = pcDateInput.fieldLabel;
	var vcTargetCtrl = poAppIns.lookup(vsHeaderTitle);
	if(vcTargetCtrl) {
		vsHeaderTitle = vcTargetCtrl.value;
	}
	
	// 타겟 컨테이너 지정 추가 (dyseo, 20211203 추가)
	var voTargetInstance = poAppIns.getRootAppInstance();
	if(pcDateInput.userAttr(ATTR_TARGET_CALENDAR_GROUP_ID) != "") {
		var vsAttrValue = pcDateInput.userAttr(ATTR_TARGET_CALENDAR_GROUP_ID);
		
		voTargetInstance = poAppIns.lookup(vsAttrValue);
		
		if(voTargetInstance == null) {
			voTargetInstance = vsAttrValue == "app" ? poAppIns : poAppIns.getRootAppInstance();
		}	
	}
	
	voTargetInstance.dialogManager.openDialog(poDialogApp, msDialogNm, maProp, function(dialog) {
		
		dialog.headerTitle = vsHeaderTitle || "Selected Date";
		dialog.resizable = false;
		dialog.headerMovable = false;
		dialog.headerClose = false;
		
		var date = pcDateInput.dateValue || pcDateInput.defaultDate;
		dialog.initValue = moment(date).format("YYYYMMDD");
		
		// 다이얼로그 스타일
		dialog.style.addClass(msDialogCls);
		dialog.style.overlay.addClass(msDialogOverlayCls);
		dialog.style.css("min-height", "0px");
		
		dialog.addEventListener("init", function(e){
			dialog.getEmbeddedAppInstance().getContainer().getLayout().scrollable = false;
		});
		
		dialog.addEventListener("transitionend", function(e){
			dialog.getEmbeddedAppInstance().getContainer().getLayout().scrollable = true;
			dialog.redraw();
		});
		
		dialog.addEventListener("overlay-click", function(e){
			dialog.close();
		});
		
		dialog.addEventListener("close", function(e){
			var returnValue = dialog.returnValue;
			if(returnValue) {
				pcDateInput.putValue(returnValue);
			}
			
			// locale 원복
			cpr.I18N.INSTANCE.currentLanguage = msLocale;
			
			// 앱 unregister
			cpr.core.Platform.INSTANCE.unregister(poDialogApp);
		});
	})
}

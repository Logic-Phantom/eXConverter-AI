/************************************************
 * autoComplate.module.js
 * Created at 2020. 4. 28. 오전 9:53:28.
 * 
 * Version 1.3
 * Updated Date : 2021-11-24
 * 
 * @author daye
 ************************************************/

/*
 * 본 모듈은 인풋계열 컨트롤(인풋박스, 서치인풋, 마스크에디터, 텍스트에리어, 넘버에디터,  데이트인풋, 트리셀) 에서 텍스트를 작성했을 때 어시스트를 제공하는 모듈입니다.
 * 사용자 속성(showAssist)의 값이 Y인 컨트롤만 대상으로 모듈에서 제공하는 기능을 확인 할 수 있습니다.
 * 서브미션을 통해 데이터를 호출할 경우에는 해당 컨트롤에 사용자속성(submit-action)을  추가하여 action 경로를 설정하십시오.
 * 
 * setRank 함수를 통해 리스트박스에 보여줄 수 있는 최상위 개수를 지정 할 수 있습니다.
 */


/************************************************
 * 전역 변수 (변경 가능)
 ************************************************/
/**
 * 모듈 사용 여부
 * @type {Boolean}
 */
var mbAssist = true;

/**
 * 어시스트 정렬
 * @type {String}
 */
var msSort = "label ASC";

/**
 * 자연어 사용 여부
 * @type {Boolean}
 */
var mbUseNatureLan = true;

/**
 * 자연어 검색을 위한 delay 시간 (단위 : ms)
 * @type {Number}
 */
var mnWait = 500;

/**
 * 사용자 속성 (모듈 적용 컨트롤)
 * @type {String}
 */
var ATTR_USE_ASSIST = "showAssist";

/**
 * 사용자 속성 (서브미션 action 경로)
 * @type {String}
 */
var ATTR_SUBMIT_ACTION = "submit-action";

/**
 * 메뉴 컨트롤의 리스트 스타일 클래스
 * @type {String}
 */
var msClPopCls = "cl-popup";

/**
 * 메뉴가 컨트롤의 위쪽에 띄워질 때의 스타일 클래스
 * @type {String}
 */
var msClTopCls = "cl-top";

/**
 * 메뉴가 컨트롤의 아래쪽에 띄워질 때의 스타일 클래스
 * @type {String}
 */
var msClBottomCls = "cl-bottom";

/**
 * 메뉴 아이템의 말줄임 스타일 클래스
 * @type {String}
 */
var msEllipsisCls = "ellipsis";

/**
 * 메뉴 스타일 클래스
 * @type {String}
 */
var msQuickSrchCls = "auto-complete";


/************************************************
 * 전역 변수 (변경 불가능)
 ************************************************/
/**
 * 어시스트를 제공하기 위한 메뉴컨트롤
 * @type {cpr.controls.Menu}
 */
var mcMenu = null;

/**
 * mcMenu에 바인딩 할 데이터셋
 * @type {cpr.data.DataSet}
 */
var mcDataset = null;

var msDataSetLabel = null ;  //dataSet label Column name 
var msDataSetValue = null ;  //dataSet value Column name
var msDataSetTooltip = null ;  //dataSet tooltip column name 
 

/**
 * 최상위 개수
 * @type {Number}
 */
var mnRank = 0;

/**
 * 변경 전 value 
 * @type {String}
 */
var msBeforeValue = "";


/************************************************
 * 이벤트 버스 (keyup)
 ************************************************/
if(mbAssist) cpr.events.EventBus.INSTANCE.addFilter("keyup", fn_keyup);

cpr.events.EventBus.INSTANCE.addFilter("keydown", function(/* cpr.events.CKeyboardEvent */ e){
	var control = e.control;
	
	if("displayText" in control == false) return;
	
	// 그리드에서 어시스트를 사용 할 경우, 기본동작(행이동) 방지
	if(e.keyCode == cpr.events.KeyCode.DOWN || e.keyCode == cpr.events.KeyCode.UP || e.keyCode == cpr.events.KeyCode.ESC || e.keyCode == cpr.events.KeyCode.ENTER) {
		if(control.getParent().type == "grid" && mcMenu) {
			if(mcMenu.isFloated()) {
				if(mcMenu.getItemCount() == 0) return;
				e.stopPropagation();
			}
		}
	}
});

/**
 * 
 * @param {cpr.events.CKeyboardEvent} e
 */
function fn_keyup(e) {
	var control = e.control;
	
	if("displayText" in control == false) return; // 인풋계열 컨트롤만 가능
	
	if(control.userAttr(ATTR_USE_ASSIST) == "Y") {
		/** @type cpr.core.AppInstance */
		var _app = control.getAppInstance();
		var vsText = control.displayText;
		if(control.type == "maskeditor") vsText = vsText.replace(/\_/gi, "");
		
		// 자연어 사용을 위해 wait 시간 설정
		if(!mbUseNatureLan) mnWait = 0;
		
		/**
		 * 입력값에 따라 서브미션/필터 분기
		 */
		function getItemData () {
			/*  검색 디바운스 */
			_.debounce(function(){
				var vsText = control.displayText;
				if(control.type == "maskeditor") vsText = vsText.replace(/\_/gi, "");
				var vnDefIndex = _getDefIndex(msBeforeValue, vsText);
				var vsSameText = vsText.slice(0, vnDefIndex);
				
				// 아무 텍스트도 입력하지 않은 경우 리턴
				if(msBeforeValue == vsText) return;
				
				// 지웠을 때 앞의 글자가 같으면 필터링 / 다르면 서브미션
				if(vsSameText == "") {
					_send(_app, control, vsText, msSort);
				} else {
					_setFilter(vsText);
				}
				
				// 입력 후 이전 입력값 수정될 수 있도록 수정
				msBeforeValue = vsText;
   			}, mnWait)();
		}

		// 리스트박스, 데이터셋 생성
		_createAssist(_app);
		
		if(mcMenu == null || mcDataset == null) return;

		// keyCode 설정 START *************************************************************************************************
		if(e.keyCode == cpr.events.KeyCode.SHIFT || e.keyCode == cpr.events.KeyCode.TAB  || e.keyCode == cpr.events.KeyCode.ENTER) {
			_removeListBox();
			return;
		}
		
		if(e.keyCode == cpr.events.KeyCode.LEFT || e.keyCode == cpr.events.KeyCode.RIGHT) {
			return;
		}
		
		if(e.keyCode == cpr.events.KeyCode.BACKSPACE || e.keyCode == cpr.events.KeyCode.DELETE) {
			if(vsText.trim() == "" || vsText.trim() == null) {
				_removeListBox();
			} else {
				getItemData();
				_floatList(_app, control, e);
			} 
			return;
		}
		
		if(e.keyCode == cpr.events.KeyCode.ESC) {
			control.value = "";
			_removeListBox();
			return;
		}
		
		if(e.keyCode == cpr.events.KeyCode.DOWN) {
			if(mcMenu.isFloated()) {
				if(mcMenu.style.list.hasClass(msClBottomCls)) {
					mcMenu.focus();
				}
				return;
			}
		}
		
		if(e.keyCode == cpr.events.KeyCode.UP) {
			if(mcMenu.isFloated()) {
				if(mcMenu.style.list.hasClass(msClTopCls)) {
					mcMenu.focus();
				}
			}
			return;
		}
		
		// END **********************************************************************************************************************
		
		if(vsText.trim() == "" || vsText.trim() == null || msBeforeValue == vsText) {
			if(e.keyCode != cpr.events.KeyCode.DOWN) {
				 return; 
			}
		}

		getItemData();

		/*
		 * TODO 서브미션을 연동 할 경우에 아래의 _floatList 를 주석한 뒤 사용하시기 바랍니다.
		 * 리스트박스 플로팅
		 */
		_floatList(_app, control, e);
		
		/* 이벤트 리스너 */
		if(mcMenu) {
			mcMenu.addEventListener("selection-change", function(e){
				control.value = e.newSelection[0].label;
				_removeListBox();
				control.focus();
				e.stopImmediatePropagation();
			});
			
			mcMenu.addEventListener("click", function(e){
				e.stopPropagation();
			});
		}
		
		_app.getRootAppInstance().getContainer().addEventListener("click", function(e){
			_removeListBox();
		});
	}
}

/**
 * 리스트박스에 보여줄 최상위 개수를 지정합니다.
 * @param {Number} pnRank
 */
globals.setRank = function(pnRank) {
	if(!isNaN(pnRank)) {
		mnRank = pnRank;
	}
}

/**
 * 메뉴, 데이터셋 생성
 * @param {cpr.core.AppInstance} poApp
 */
function _createAssist (poApp) {
	
	//지정 dataSet이 없을 경우 
	if( mcDataset == null){
		
		mcDataset = new cpr.data.DataSet("dsQuickSearch");
		mcDataset.parseData({
			"columns": [
				{"name": "label"},
				{"name": "value"}
			],
			// FIXME 서브미션 연동 시 row 삭제
			"rows": [ 
					{"label" : "Greece" , "value" : "Greece"},
					{"label" : "Philippines" , "value" : "Philippines"},
					{"label" : "United States" , "value" : "United"},
					{"label" : "China" , "value" : "China"},
					{"label" : "Moldova" , "value" : "Moldova"},
					{"label" : "Brazil" , "value" : "Brazil"},
					{"label" : "France" , "value" : "France"},
					{"label" : "Canada" , "value" : "Canada"},
					{"label" : "Colombia" , "value" : "Colombia"},
					{"label" : "Chile" , "value" : "Chile"},
					{"label" : "UI사업본부" , "value" : "1"},
					{"label" : "UI개발도구팀" , "value" : "2"},
					{"label" : "기술지원팀" , "value" : "3"},
					{"label" : "영업팀" , "value" : "4"},
					{"label" : "경영지원팀" , "value" : "5"},
					{"label" : "label1" , "value" : "value16"},
					{"label" : "label2" , "value" : "value17"},
					{"label" : "label3" , "value" : "value18"},
					{"label" : "label4" , "value" : "value19"},
					{"label" : "label5" , "value" : "value20"},
					{"label": "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s,", "value": "value100"}
				]
		});
		poApp.register(mcDataset);
	}
	
	var vsLocalLabel  = "label";
	var vsLocalValue  = "value" ;
	var vsLocalTooltip = "label" ;
	
	if( msDataSetLabel != null ){
		vsLocalLabel = msDataSetLabel ;
	}
	if( msDataSetValue != null ){
		vsLocalValue = msDataSetValue ;
	}
	if( msDataSetTooltip != null ){
		vsLocalTooltip = msDataSetTooltip ;
	} 
	
	if(mcMenu == null) {
		mcMenu = new cpr.controls.Menu();
		mcMenu.style.list.setClasses([msClPopCls , msClBottomCls]);
		mcMenu.style.item.addClass(msEllipsisCls); // 말줄임 스타일
		mcMenu.style.addClass(msQuickSrchCls); // TODO 리스트박스의 클래스명을 작성하십시오.
		 
		 
		mcMenu.setItemSet(mcDataset, {
			label: vsLocalLabel,
			value: vsLocalValue,
			tooltip : vsLocalTooltip
		});
		
		mcMenu.addEventListener("keyup", function(e){
			if(e.keyCode == cpr.events.KeyCode.ESC) {
				_removeListBox();
			}
		});
	}
}

/**
 * 변경된 텍스트의 인덱스 반환
 * @param {String} psBefore
 * @param {String} psAfter
 */
function _getDefIndex (psBefore, psAfter) {
	var vaBefore = psBefore.split("");
	var vaAfter = psAfter.split("");
	var vaStandard = vaBefore.length > vaAfter.length ? vaBefore : vaAfter;
	
	var vnIndex = 0;
	for(var idx = 0; idx < vaStandard.length; idx++){
		if(vaBefore[idx] != vaAfter[idx]) {
			vnIndex = idx;
			break;
		}
	}
	
	return vnIndex;
}

/**
 * 리스트박스 삭제
 */
function _removeListBox () {
	if(mcMenu && mcMenu.isFloated()) {
		mcMenu.getParent().removeChild(mcMenu, true);
		mcMenu = null;
		mcDataset = null;
		
		// 모두 삭제 시 전역변수 초기화 추가
		msBeforeValue = ""; 
	}
}

/**
 * 리스트박스 플로팅
 * @param {cpr.core.AppInstance} poApp
 * @param {cpr.controls.UIControl} pcControl
 * @param {cpr.events.CKeyboardEvent} e
 */
function _floatList(poApp, pcControl, e) { 
	
	_.debounce(function(){
  
		var voConstraint = poApp.getContainer().getConstraint(pcControl);
		var voActualRect = pcControl.getActualRect();
		var voOffsetRect = pcControl.getOffsetRect();
		var voAppRect = poApp.getContainer().getActualRect();
		var voRootRect = poApp.getRootAppInstance().getContainer().getActualRect();
		
		var voAnchor = {
			right : false,
			bottom : false
		}
		
		if(voConstraint) {
			if(voConstraint.right) voAnchor.right =true;
			if(voConstraint.bottom) voAnchor.bottom = true;
		}
		
		var vcContainer = pcControl.getParent();
		if(vcContainer.type != "container") vcContainer = vcContainer.getParent();
		var voParentRect = vcContainer.getActualRect();
		var voRealRect = _getRealRect(poApp, pcControl); // 메뉴의 실제 크기
		if(voRealRect) {
			
			var voRect = {
				top : (voActualRect.bottom + voRootRect.top + e.view.scrollY) + "px",
				left : voActualRect.left + voRootRect.left + "px",
				width : voRealRect.width  + "px",
				height :  voRealRect.height + "px",
				zIndex : 100
			}
			
			// 리스트가 아래에 플로팅 되었을 때 스타일 설정
			mcMenu.style.list.removeClass(msClTopCls);
			mcMenu.style.list.addClass(msClBottomCls);
		
			// 그리드 셀에 포함되어있는 경우 위치설정
			if(pcControl.getParent().type == "grid") {
				voRect.top = (voActualRect.bottom + e.view.scrollY) + "px"; 
				voRect.left = voActualRect.left + "px";
			}
			
			// left, width 설정
			if(voAppRect.width < parseInt(voRect.left) + voRealRect.width) {
				
				if(voAnchor.right) {
					// 오른쪽 기준
					var vnLeft = voActualRect.right - voRealRect.width - voRootRect.left;
					voRect.left = vnLeft + "px";
				} else {
					// 왼쪽 기준
					voRect.width = voRootRect.width - parseInt(voRect.left) - 2 + "px";
				}
				
			}
			
			var vnMaxHeight = (innerHeight - parseInt(voRect.top)) * 0.8; // 메뉴 최대 높이
			
			// top, height 설정
			if(innerHeight*0.8 < parseInt(voRect.top) + parseInt(voRect.height) - e.view.scrollY) {
				if(voActualRect.top > (innerHeight - parseInt(voRect.top))) { // 컨트롤 기준 위 아래 너비 비교 - 위쪽 공간이 더 넓을 때 위쪽으로 띄움
					vnMaxHeight =  (voActualRect.top - voRootRect.top) * 0.8;
					var vnHeight = voRealRect.height > vnMaxHeight ? vnMaxHeight : voRealRect.height;
					
					if(voAnchor.bottom) {
						// 리스트가 위에 플로팅 되었을 때 스타일 설정
						mcMenu.style.list.removeClass(msClBottomCls);
						mcMenu.style.list.addClass(msClTopCls);
						
						var vnTop =voActualRect.top + e.view.scrollY - vnHeight;
						voRect.top = vnTop + "px"; 
					} else {
						if(voParentRect.height < parseInt(voRect.top) + parseInt(voRect.height)) {
							voRect.top = voActualRect.top + e.view.scrollY - vnHeight + "px";
							mcMenu.style.list.removeClass(msClBottomCls);
							mcMenu.style.list.addClass(msClTopCls);
						}
					}
				}
			}

			if(mcMenu.getItemCount() > 0) {
				// 메뉴 최소, 최대 크기 설정
				mcMenu.style.list.css("min-width",voActualRect.width +"px");
				mcMenu.style.list.css("max-width", (voParentRect.width*0.8)+"px");
				mcMenu.style.list.css("max-height", vnMaxHeight+"px");
				
				if(parseInt(voRect.width) > (voParentRect.width*0.8)) voRect.width = voParentRect.width*0.8 + "px";
				if(parseInt(voRect.height) > vnMaxHeight) voRect.height = vnMaxHeight + "px";
				
				poApp.getRootAppInstance().getContainer().floatControl(mcMenu, voRect);
			} else {
				_removeListBox();
			}
		}
	
	}, mnWait)();
}


/**
 * 실제 리스트박스의 크기 반환
 * @param {cpr.core.AppInstance} poApp
 * @param {cpr.controls.UIControl} pcControl
 */
function _getRealRect (poApp, pcControl) {
	
	if(mcMenu == null || mcDataset == null) return;
	
	var voActualRect = pcControl.getActualRect();
	var voRootRect = poApp.getRootAppInstance().getContainer().getActualRect();
	var voParentRect = pcControl.getParent().getActualRect();
	var vnMaxHeight = (innerHeight - (voActualRect.bottom + voRootRect.top)) * 0.8;
	
	var vcTempMenu = new cpr.controls.Menu("tempMenu");
	vcTempMenu.style.list.css("min-width",voActualRect.width +"px");
	vcTempMenu.style.list.css("max-width", (voParentRect.width*0.8)+"px");
	vcTempMenu.style.list.css("max-height", (innerHeight*0.8)+"px");
	
	vcTempMenu.style.addClass(msQuickSrchCls);
	
	vcTempMenu.setItemSet(mcDataset, {
		label : "label",
		value : "value"
	});
	
	vcTempMenu.setFilter(mcMenu.getFilter());
	poApp.getContainer().addChild(vcTempMenu, {
		top : "-10000px",
		left : "-10000px"
	});
	cpr.core.DeferredUpdateManager.INSTANCE.update();

	var width = vcTempMenu.getActualRect().width;
	var height = vcTempMenu.getActualRect().height;
	poApp.getContainer().removeChild(vcTempMenu);
	
	return {
		"width" : width,
		"height" : height
	};
}


/**
 * 서브미션 생성 및  설정
 * @param {cpr.core.AppInstance} poApp
 * @param {cpr.controls.UIControl} pcCtrl
 * @param {String} psParam? 필터조건
 * @param {String} psSort? 정렬조건
 */
function _send (poApp, pcCtrl, psParam, psSort) {
	
	if(mcMenu == null || mcDataset == null) return; 
	
	var submission = new cpr.protocols.Submission();
	// TODO 서브미션의 경로를 설정하십시오.
	submission.action = pcCtrl.userAttr(ATTR_SUBMIT_ACTION);
	submission.mediaType 	= "application/x-www-form-urlencoded";
	submission.method = "post";
	submission.responseType = "text";
	submission.addResponseData(mcDataset, false);
	poApp.register(submission);
	
	if(psParam) {
		psParam = psParam.replace(/\\/gi, "");

		// TODO 서브미션을 연결할 경우 아래의 setFilter 구문은 삭제하십시오.
		mcMenu.setFilter("label.toUpperCase() *= '" + psParam.toUpperCase() + "'");

		submission.setParameters("filter", psParam);
	}
	
	if(psSort) {
		// TODO 서브미션을 연결 할 경우 아래의 setSort 구문은 삭제하십시오.
		mcDataset.setSort(msSort);
		
		submission.setParameters("sort", psSort);
	}
	
	// TODO 서브미션을 연결 할 경우 아래의 코드를 주석처리 하십시오.
	if(mnRank > 0) {
		var vnDsCnt = mcMenu.getItemCount();
		for(var idx = mnRank; idx <vnDsCnt ; idx++){
			mcMenu.deleteItem(mnRank);
		}
	}
		
	// TODO 서브미션을 보내기 위해서 아래의 주석을 해제하십시오.
//	submission.addEventListener("submit-done", function(e){	
//		
//		if(mnRank > 0) {
//			var vnDsCnt = mcMenu.getItemCount();
//			for(var idx = mnRank; idx <vnDsCnt ; idx++){
//				mcMenu.deleteItem(mnRank);
//			}
//		}
//		
//		_floatList(poApp, pcCtrl);
//		mcMenu.redraw();
//	});
//	submission.send();
}


/**
 * 메뉴 데이터 필터링
 * @param {String} psText
 */
function _setFilter(psText) {
	
	if(mcMenu == null || mcDataset == null) return; 
	
	// 대소문자 구분하지 않고 모든 값에 대해 필터링
	psText = psText.replace(/\\/gi, "");
	mcMenu.setFilter("label.toUpperCase() *= '" + psText.toUpperCase() + "'");
	mcDataset.setSort(msSort);
	
	if(mnRank > 0) {
		var vnDsCnt = mcMenu.getItemCount();
		for(var idx = mnRank; idx <vnDsCnt ; idx++){
			mcMenu.deleteItem(mnRank);
		}
	}

	mcMenu.redraw();
}

/**
 * 브라우저 사이즈가 변경될 때마다 퀵서치를 삭제합니다.
 */
window.addEventListener("resize", function(e){
	_removeListBox();
});

/**
 * 스크롤 시 퀵서치를 삭제합니다.
 */
cpr.events.EventBus.INSTANCE.addFilter("scroll", function(e){
	var control = e.control;
	if(mcMenu && mcMenu.focused) return;
	
//	_removeListBox();
});
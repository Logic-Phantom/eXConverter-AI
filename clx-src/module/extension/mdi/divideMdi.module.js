/************************************************
 * DivideMdi.module.js
 * Created at 2020. 2. 11. 오후 5:46:24.
 *
 * Version 1.2
 * Updated Date : 2021-07-06
 * 
 * @author daye
 ************************************************/

/*
 * 본 모듈은 MDI폴더에 포함되어있는 임베디드 앱을 분할해서 띄울 수 있는 모듈입니다.
 * 분할영역은 총 기본(전체화면), 2분할, 4분할, 계단형 입니다.
 * 2분할과 4분할은 폼레이아웃에 배치되는 형태이며, resize가 가능합니다.
 * 계단형은 다이얼로그 형태로 제공 됩니다.
 * 분할되어있는 상태에서는 탭헤더가 보이지 않습니다.
 * 
 * [주의] 
 * 1. MDI에 추가되어 있는 탭아이템은 모두 임베디드앱을 포함해야 합니다.
 * 2. MDI폴더가 로드되었을 때, 항상 기본분할로 선택되어 있어야 합니다.
 * 
 * [사용방법]
 * 본 모듈을 사용하기 위해, 프로젝트 내에 배치하신 다음, 스크립트에서 comDivideScr(app)을 선언한 뒤에
 * 아래의 [호출 가능한 메서드]를 호출하여 사용할 수 있습니다.
 * 
 * [호출 가능한 메서드]
 *  1. divide : MDI에 추가되어있는 임베디드앱을 분할하는 메서드입니다.
 *  2. removeAllFloat : 플로팅되어있는 모든 컨트롤을 삭제합니다.
 * 							모듈에서 플로팅한 컨트롤 외에 플로팅 되어있는 컨트롤까지 삭제할 수 있습니다.
 *  3. updateFloatConstraint : 메인의 메뉴(left, right)가 열릴 때 분할영역의 위치상태를 변경합니다.
 *  4. selectMenu : 메뉴를 선택했을 때, MDI폴더 또는 분할영역에 임베디드앱을 추가합니다.
 *  5. closeMenu : 열려있는 메뉴를 닫을 때 사용합니다. 
 * 		- 선택닫기 : 선택되어있는 탭을 닫습니다. 단, 분할되어있는 경우에는 선택닫기는 불가합니다.
 * 						계단형으로 분할되어있을 때는 각각의 다이얼로그를 직접 닫을 수 있습니다.
 * 		- 모두닫기 : [홈] 화면을 제외한 나머지 화면을 닫습니다.
 *  6. getDivGroup : 현재 플로팅 되어있는 영역의 그룹을 반환합니다. (단, 2분할 또는 4분할되어 있는 폼레이아웃만 해당됩니다.)
 */


/************************************************
 * 전역 변수 (변경 가능)
 ************************************************/
/**
 * 계단형(다이얼로그) 으로 분할 할 때, 각 다이얼로그 간 거리
 * @type {Number}
 */
var mnHierarchyDistance = 40;

/**
 * 탭폴더의 첫번째 탭아이템 고정여부
 * @type {Boolean}
 */
var mbFixFirst = false;

/**
 * 고정 탭아이템 앱ID 
 * 단, mbFixFirst가 true 일 경우에만 사용 가능
 * @type {String}
 */
var msFixAppId = ""; 

/**
 * 분할 - 전체화면
 * @type {String}
 */
var msDefault = "default";

/**
 * 분할 - 가로분할
 * @type {String}
 */
var msHorizontal = "horizontal";

/**
 * 분할 - 세로분할
 * @type {String}
 */
var msVertical = "vertical";

/**
 * 분할 - 4분할
 * @type {String}
 */
var msDivision = "division";

/**
 * 분할 - 계단형 (팝업)
 * @type {String}
 */
var msCascading = "window";

/**
 * 폼레이아웃 separator 너비
 * @type {Number}
 */
var mnFormWidth = 1;

/**
 * 폼레이아웃 separator 색상
 * @type {String}
 */
var msFormColor = "#000";

/**
 * 폼레이아웃 separator 클래스명
 * @type {String}
 */
var msFormClass = "Class";

/**
 * 사용자 속성
 * fixed-first-item
 * @type {String}
 */
var ATTR_FIXED_ITEM = "fixed-first-item";

/**
 * 사용자 속성
 * fixed-id
 * @type {String}
 */
var ATTR_FIXED_ID = "fixed-id"

/**
 * horizontal, vertical 분할 시 각 앱인스턴스 높이
 * @type {Number}
 */
var mnDivHeight = 500;

/**
 * 플로팅 그룹 배경 색상 클래스
 * horizontal, vertical, division 일 때 적용
 * @type {String}
 */
var msFloatGrpBgCls = "bg-white";

/**
 * 다이얼로그 스타일 클래스
 * window 일 때 적용
 * @type {String}
 */
var msDialogCls = "cl-dialog";

/**
 * 다이얼로그 최소화 시 생성되는 버튼 스타일 클래스
 * window 일 때 적용
 * @type {String}
 */
var msDialogMinBtnCls = "btn-primary";
 
/**
 * 다이얼로그  최소화 버튼 생성 여부
 * @type {Boolean}
 */
var mbDialogMin = true;

/**
 * 다이얼로그 분할 시 생성되는 최소화 영역 그룹 스타일
 * window 일 때 적용
 * @type {String}
 */
var msDialogMinGrpCls = "";


/************************************************
 * 전역 변수 (변경 불가능)
 ************************************************/
/**
 * 루트 앱인스턴스
 * @type {cpr.core.AppInstance}
 */
var moRootAppIns = null;

/** 
 * 메인MDI 컨트롤
 * @type {cpr.controls.MDIFolder}
 */
var mcMainTab = null;


/**
 * 계단형으로 띄울 때, 탭아이템 배열
 * @type {cpr.controls.EmbeddedApp[]}
 */
var moDialogContent = []; 

/**
 * 분할 시 Float 되는 그룹 컨트롤
 * @type {cpr.controls.Container}
 */
var mcFloatGrp = null; 

/**
 * 알림컨트롤
 * @type {cpr.controls.Notifier}
 */
var mcNotifier = null;

/**
 * 현재 포커스된 임베디드앱
 * @type {cpr.controls.EmbeddedApp}
 */
var mcFocusEmb = null;

/**
 * 분할 한 화면을 최대화할 경우, 최대화 한 앱인스턴스
 * @type {cpr.core.AppInstance}
 */
var moMaximize = null;

/**
 * 계단형 분할에서 최소화 했을 때 생성되는 영역
 * @type {cpr.controls.Container}
 */
var mcGrpBoundary = null;


/************************************************
 * 이벤트 버스
 ************************************************/

cpr.events.EventBus.INSTANCE.addFilter("focus", function(e){
	
	var control = e.control;
	
	var vcFocusEmb = control.getAppInstance().getHost();
	if(vcFocusEmb instanceof cpr.controls.UDCBase && vcFocusEmb.getAppInstance()) {
		vcFocusEmb = vcFocusEmb.getAppInstance().getHost();
	}
	if(vcFocusEmb) {
		if(mcFocusEmb != vcFocusEmb) {
			mcFocusEmb = vcFocusEmb;
			if(mcFloatGrp || moDialogContent.length > 0) {
				cpr.core.NotificationCenter.INSTANCE.post("check-menu-auth", {
					vcEmb : vcFocusEmb
				});
			}
		}
	}
});


/**
 * 계단형으로 보여줄 때 띄울 다이얼로그 앱 생성
 * @param {Number} pnIndex
 */
function _createDialog (pnIndex) {

	var newApp = new cpr.core.App("ComDialog"+pnIndex, {
			onPrepare: function(loader){
			},
			onCreate: function(/* cpr.core.AppInstance */ newApp, exports){
				var container = newApp.getContainer();
				
				// script start
				newApp.addEventListener("load", function(e){
					/** @type cpr.controls.EmbeddedApp */
					var initValue = newApp.getHostProperty("initValue");
					
					if(initValue) {
						newApp.app.title = initValue.app.title;
						container.addChild(initValue, {
							top : "0px",
							left : "0px",
							right : "0px",
							bottom : "0px"
						});
					}
				});
			}
		});
		cpr.core.Platform.INSTANCE.register(newApp);
		
		return newApp;
}


/************************************************
 * 프로토타입 선언
 ************************************************/
/**
 * 
 * @param {cpr.core.AppInstance} app
 * @param {cpr.controls.TabFolder} tabfolder
 */
var comDivideScr = function (app, tabfolder) {
	this._app = app;

	if(tabfolder != null) {
		mcMainTab = tabfolder;	
	}
}

/**
 * 분할하기 위한 MDI폴더(탭폴더) 객체를 설정합니다.
 * @param {cpr.controls.MDIFolder} pcMdiFolder
 */
comDivideScr.prototype.setMdiFolder = function(pcMdiFolder) {
	if(pcMdiFolder == null) return;

	mcMainTab = pcMdiFolder;
}

/**
 * 분할하기 위한 MDI폴더(탭폴더) 객체를 반환합니다.
 * @return {cpr.controls.MDIFolder}
 */
comDivideScr.prototype.getMdiFolder = function() {
	return mcMainTab;
}

/**
 * 현재 활성화 되어있는 앱인스턴스 반환
 * @returns {cpr.core.AppInstance} 활성화되어있는 앱인스턴스
 */
comDivideScr.prototype.getActiveApp = function () {
	var voActiveAppIns = null;
	
	if(mcFloatGrp || moDialogContent.length > 0) {
		voActiveAppIns = mcFocusEmb.getEmbeddedAppInstance();
	}

	return voActiveAppIns;
}


/**
 * 플로팅 컨트롤 모두 삭제
 */
comDivideScr.prototype.removeAllFloat = function () {
	
	if(moRootAppIns) {
		
		/* 고정탭이 있는경우 첫번째 아이템 저장 */
		if(mbFixFirst) {
			if(mcFloatGrp && mcFloatGrp.getChildrenCount() > 0) {
				mcMainTab.getTabItems()[0].content = mcFloatGrp.getChildren()[0];
			} else if(moDialogContent.length > 0){
				var voItem = new cpr.controls.TabItem();
				voItem.content  = moDialogContent.map(function(each){
					if(each.app.id == msFixAppId) return each;
				})[0];
				voItem.text = "Dashboard";
				voItem.visible = false;
				mcMainTab.addTabItem(voItem);
			}
		}
		
		mcMainTab.getAppInstance().dialogManager.closeAll();
		
		// container에 추가해서 삭제로 변경
		if(moRootAppIns.getContainer().getChild("grpFloat")) {
			moRootAppIns.getContainer().removeChild(mcFloatGrp,true);
		}
		
		moDialogContent = []; // 다이얼로그로 띄웠던 항목 삭제
		mcFloatGrp = null; // 2 또는 4분할 삭제
		mcNotifier = null; // 알림컨트롤 삭제
		
		mcMainTab.getAppInstance().removeFloatingControl(mcGrpBoundary);
		mcGrpBoundary = null;
		
	}
		
	cpr.core.DeferredUpdateManager.INSTANCE.update();
}


/**
 * 화면을 분할합니다.
 * @param {String} psLayout 분할하고자 하는 구성(기본 : default, 2분할 : vertical, 4분할 : division, 계단형 : window)
 * @param {#notifier} psNotifier 알림컨트롤 ID (분할영역이 있을 경우 알림컨트롤도 분할영역 상단으로 함께 플로팅됩니다.)
 * @param {cpr.controls.TabItem[]|cpr.controls.Item[]} poSelection?
 */
comDivideScr.prototype.divide = function (psLayout, psNotifier, poSelection) {
	
	if(mcMainTab == null) return;
	
	// 1. 앱의 루트앱인스턴스
	moRootAppIns = this._app;
	
	// 2. 메인 MDI 폴더
	var voMdiConst = mcMainTab.getOffsetRect();
	var voMdiActulRect = mcMainTab.getActualRect();
	var voRootConst = moRootAppIns.getActualRect();
	
	// TODO 플로팅 위치를 변경하기 위해서 아래의 Constraint를 변경하십시오.
	var vnTabHeight = mcMainTab.getHeaderControls()[0].getActualRect().height;
	mcMainTab.getHeaderControls().forEach(function(each){
		if(each.getActualRect().height > vnTabHeight) vnTabHeight = each.getActualRect().height;
	});
		
	// 3. 알림컨트롤
	var vcNotifier = moRootAppIns.lookup(psNotifier);
	if(vcNotifier && vcNotifier.isFloated()) {
		// 다시 기본화면으로 돌아갈 때, 플로팅 되어있던 알림컨트롤 추가
		var vnTabHeight = mcMainTab.getHeaderControls()[0].getActualRect().height;
		mcMainTab.getHeaderControls().forEach(function(each){
			if(each.getActualRect().height > vnTabHeight) vnTabHeight = each.getActualRect().height;
		});
		this._app.getContainer().addChild(vcNotifier, {
			left : voMdiConst.left + "px",
			bottom : voMdiConst.bottom + vnTabHeight + "px",
			right : voMdiConst.right,
			height : vcNotifier.getActualRect().height + "px"
		});
	}
	
	var vnDiv = 1; // 화면분할 개수
	switch(psLayout){
		case msHorizontal : case msVertical : {
			vnDiv = 2;
			break;
		}
		case msDivision : {
			vnDiv = 4;
			break;
		}
		case msCascading : {
			vnDiv = psLayout;
			break;
		}
	}
	
	// 레이아웃을 변경할 때마다, 임베디드앱의 변경사항을 메인 탭에 저장한다.
	if(moDialogContent.length == 0) {
		
		/* 2 or 4분할의 앱인스턴스 저장 */
		var vcFloatGrp = moRootAppIns.lookup("grpFloat");
		
		if(vcFloatGrp) {
			// 분할 변경 시, 기존의 포틀릿(드래그,드롭 객체) 삭제
			removeDragManager(mcFloatGrp);

			var voChildren = vcFloatGrp.getChildren();
			voChildren.forEach(function(each, idx) {
				var vnIndex = null;
				mcMainTab.getTabItems().map(function(item, index){
					if(each.userAttr("tabId") == item.name) vnIndex = index;
					
					if(vnIndex != null) {
						mcMainTab.getTabItems()[vnIndex].content = each;
						return;
					}
				});
			});
			
			if(mcMainTab.userAttr(ATTR_FIXED_ITEM) === "Y" && mcMainTab.userAttr(ATTR_FIXED_ID) && mcMainTab.userAttr(ATTR_FIXED_ID) !== "") {
				mcMainTab.getTabItems()[0].visible = false;
			}
		}
		
	} else {
		/* 계단형의 앱인스턴스 저장 */
		for(var idx = 0; idx < moDialogContent.length; idx++){
			var voTabItem = new cpr.controls.TabItem();
			voTabItem.content = moDialogContent[idx];
			voTabItem.text = moDialogContent[idx].userAttr("appId");
			voTabItem.closable = moDialogContent[idx].userAttr("closable")=="true" ? true : false;
			mcMainTab.addTabItem(voTabItem);
			
			if(idx == 0 && mcMainTab.userAttr(ATTR_FIXED_ITEM) === "Y" && mcMainTab.userAttr(ATTR_FIXED_ID) && mcMainTab.userAttr(ATTR_FIXED_ID) !== "") {
				voTabItem.visible = false;
			}
		}
	}

	var voTabItems = mcMainTab.getTabItems();
	voTabItems.forEach(function(each){
		// tabItem.name 설정 (content 가 null 일 경우 탭아이템 구분가능)
		if(each.name == null || each.name == "") {
			each.name = each.content.uuid;
		}
		
		// 포커스 되어있던 아이템 선택
		if(each.content == mcFocusEmb) {
			mcMainTab.setSelectedTabItem(each);
		}
	})
	
	// 선택한 아이템
	var voSelectedTabItem = [];
	if(poSelection) {
		poSelection.forEach(function(each){
			if(each instanceof cpr.controls.TabItem) {
				voSelectedTabItem.push(each);
			} else {
				// 동일한 앱아이디 화면이 2개 이상일 경우, 각 content 식별을 itemIndex로 설정
				var vnItemIndex = each.row.getValue("value");
				var tabItem = null;
				if(isNaN(vnItemIndex)) {
					// window에서 다른 분할형태로 바뀔 경우, embeddedappId 
					tabItem = voTabItems.filter(function(each){
						if(each.content.id == vnItemIndex) return each;
					})[0];
				} else {
					tabItem = voTabItems[vnItemIndex];
				}
				if(tabItem) {
					voSelectedTabItem.push(tabItem);
				}
			}
		});
	}
	
	// 플로팅 컨트롤 모두 삭제
	this.removeAllFloat();

	if(psLayout == msDefault) {
		/* 전체화면 */
		
		// 탭아이템 헤더 visible하도록 설정
		voTabItems.forEach(function (each, index) {
			if(mcMainTab.userAttr(ATTR_FIXED_ITEM) === "Y" && mcMainTab.userAttr(ATTR_FIXED_ID) && mcMainTab.userAttr(ATTR_FIXED_ID) !== "" 
			&& index == 0) {
				each.visible = false;
			} else {
				each.visible = true;
			}
		});
		
		if(voSelectedTabItem.length > 0) {
			mcMainTab.setSelectedTabItem(voSelectedTabItem[0]);
//			// 마지막 아이템 선택하도록 수정 (2021.07.27 수정)
//			mcMainTab.setSelectedTabItem(voSelectedTabItem[voSelectedTabItem.length-1]);
		} else {
			var vnCtrlId = mcMainTab.userAttr(ATTR_FIXED_ID);
			var vcFixItem = moRootAppIns.lookup(vnCtrlId).getChild("btnDfItem");
			vcFixItem.click();
		}
		
		// (2021.07.27 추가)
//		if (voTabItems.length > 1) {
//			mcMainTab.setSelectedTabItem(voTabItems[voTabItems.length-1]);
//		} else {
//			var vnCtrlId = mcMainTab.userAttr(ATTR_FIXED_ID);
//			var vcFixItem = moRootAppIns.lookup(vnCtrlId).getChild("btnDfItem");
//			vcFixItem.click();
//		}
		
		// 분할 --> 최대화일 경우 선택
		if(moMaximize) {
			voTabItems.forEach(function(each){
				if(each.content == moMaximize.getHost()) {
					mcMainTab.setSelectedTabItem(each);
				}
			});
			moMaximize = null;
			cpr.core.DeferredUpdateManager.INSTANCE.update();
		}
		
		if(mcMainTab.userAttr(ATTR_FIXED_ITEM) === "Y" && mcMainTab.userAttr(ATTR_FIXED_ID) && mcMainTab.userAttr(ATTR_FIXED_ID) !== "") {
//			var vnCtrlId = mcMainTab.userAttr(ATTR_FIXED_ID);
//			var vcFixItem = moRootAppIns.lookup(vnCtrlId);
//			
//			if(vcFixItem) {
//				vcFixItem = mcMainTab.getTabItems()[vnCtrlId];
//			}
//			
//			vcFixItem.visible = true;
			// (2021.07.27 추가)
			mcMainTab.getTabItems()[0].visible = false;
		}
		
		return;
		
	} else if(psLayout == msCascading){
		/* 계단분할 */

		moDialogContent = [];
		
		// 선택한 아이템만 계단형으로 분할
		if(voSelectedTabItem.length > 0) {
			voTabItems = voSelectedTabItem;
		}
		
		voTabItems.forEach(function(each, index) {
			_openDialog(each, index);
		});

	} else {
		// vertical, horizontal, division
		
		/* 2분할 or 4분할 */

		// 분할해서 보여줄 컨트롤 동적생성 (폼레이아웃)
		mcFloatGrp = moRootAppIns.lookup("grpFloat");
		if(mcFloatGrp == null) mcFloatGrp = new cpr.controls.Container("grpFloat");
		mcFloatGrp.style.addClass(msFloatGrpBgCls);
		
		// 분할그룹의 포틀릿 설정
		mcFloatGrp.userAttr("portlet", "Y");
		mcFloatGrp.userAttr("dataType","t");
		
		var voFormLayout = _createFormLayout(psLayout, voSelectedTabItem);
		mcFloatGrp.setLayout(voFormLayout);
		
		var voTabList = [];
		if(voSelectedTabItem.length > 0) {
			voTabList = voSelectedTabItem;
		} else {
			var vnLen = voTabItems.length;
			var vnStartIndex = vnLen-vnDiv > 0 ? vnLen-vnDiv : 0;
			
			// 보여줄 화면 개수만큼 헤더타이틀 뒤에서부터 가져온다
			voTabList =  voTabItems.slice(vnStartIndex, vnLen);
		}
		
		voTabList.forEach(function(each, index) {
			var vnRowIndex = 0;
			var vnColIndex = 0;
			
			if(psLayout == msHorizontal) vnRowIndex = index;
			if(psLayout == msVertical) vnColIndex = index;
			if(psLayout == msDivision) {
				vnRowIndex = parseInt(index / 2);
				vnColIndex = index % 2;
			} 
			
			var vcInsertContent = each.content;
			vcInsertContent.userAttr("tabId", each.name);
			voTabItems.map(function(arg){
				if(arg.content == vcInsertContent) {
					arg.content = null;
					return;
				}
			});
			
			mcFloatGrp.addChild(vcInsertContent, {
				rowIndex : vnRowIndex,
				colIndex : vnColIndex
			})
		});
		
		if(mnDivHeight < voMdiConst.height) mnDivHeight = voMdiConst.height;
		moRootAppIns.getContainer().floatControl(mcFloatGrp, {
			top : voMdiConst.top + vnTabHeight + "px",
			left : voMdiConst.left + "px",
			right : (voRootConst.right - voMdiActulRect.right) + "px",
			bottom : (voRootConst.bottom - voMdiActulRect.bottom) + "px",
		});
		
		
		cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function(){
			// 폼레이아웃 column 구획 변경
//			_setColsWidPx(psLayout);
			// 포틀릿 이동 시작
			createDragManager(moRootAppIns);
		});
	}
	
	// 탭아이템 헤더 보이지 않도록 설정
	voTabItems.forEach(function (each) {
		each.visible = false;
	}); 
	 
	// 고정아이템이 있을 경우 보이지 않도록 설정
	if(mcMainTab.userAttr(ATTR_FIXED_ID)) {
//		var vnCtrlId = mcMainTab.userAttr(ATTR_FIXED_ID);
//		var vcFixItem = moRootAppIns.lookup(vnCtrlId);
//		
//		if(vcFixItem) {
//			vcFixItem = mcMainTab.getTabItems()[vnCtrlId];
//		}
//		
//		vcFixItem.visible = false;
		// (2021.07.27 추가)
		mcMainTab.getTabItems()[0].visible = false;
	}
	
	// 분할 시 알림 컨트롤을 최상위로 플로팅
	// 알림컨트롤 최하단으로 배치해서 플로팅 삭제
	if(vcNotifier) {
		mcNotifier = vcNotifier;
		var voNotiConstraint = moRootAppIns.getContainer().getConstraint(mcNotifier);
		if(vnDiv == msCascading) {
			this._app.getContainer().addChild(mcNotifier, voNotiConstraint);			
		} else {
			moRootAppIns.getContainer().floatControl(mcNotifier, voNotiConstraint);	
		}
	}
}
 
 /**
  * 폼레이아웃 생성
  * horizontal, vertical, division 분할 시 띄우는 그룹에 적용
  * @param {String} psLayout horizontal, vertical, division 중 택1
  * @param {cpr.controls.TabItem[]|cpr.controls.Item[]} poSelection
  */
function _createFormLayout (psLayout, poSelection) {
	
	// TODO 폼레이아웃 관련 속성을 설정하기 위해서 아래의 코드에서 작성하십시오.
	var voFormLayout = new cpr.controls.layouts.FormLayout();
	voFormLayout.userResizingMode = "standard"; // resize모드 (none, standard, lightweight)
	
	/* 폼레이아웃 스타일 설정 */
	voFormLayout.horizontalSeparatorWidth = mnFormWidth;
	voFormLayout.horizontalSeparatorColor = msFormColor;
	voFormLayout.horizontalSeparatorClass = msFormClass
	voFormLayout.verticalSeparatorWidth = mnFormWidth;
	voFormLayout.verticalSeparatorColor = msFormColor;
	voFormLayout.verticalSeparatorClass = msFormClass;
			
	if(psLayout == msDivision) {
		var voConfig = _getFormConfig(2);
		voFormLayout.setRows(voConfig);
		voFormLayout.setColumns(voConfig);
	} else {
		var vnLeast = 2;
		if(poSelection && poSelection.length >= 2) {
			vnLeast = poSelection.length;
		}
		var vnRow = psLayout == msVertical ? 1 : vnLeast; 
		var vnCol = psLayout == msVertical ? vnLeast : 1;
		voFormLayout.setRows(_getFormConfig(vnRow));
		voFormLayout.setColumns(_getFormConfig(vnCol));
	}
	
	return voFormLayout;
}

/**
 * 플로팅 하는 그룹(폼레이아웃) 의 구성 반환
 * @param {Number} pnCnt
 */
function _getFormConfig (pnCnt) {
	
	var vaConfig = [];
	
	for(var idx = 0; idx < pnCnt; idx++){
		vaConfig.push("1fr");
	}

	return vaConfig;
}


/**
 * 분할 형태가 Vertical 또는 Division 일 경우
 * 분할영역의 폼레이아웃 Columns 구획을 fr -> px 로 변경합니다.
 * @param {String} psLayout
 */
function _setColsWidPx (psLayout) {
	
	if(!mcFloatGrp || !mcFloatGrp.isFloated()) return;
	
	/** @type cpr.controls.layouts.FormLayout */
	var voLayout = mcFloatGrp.getLayout();
	var vnColumnCnt = voLayout.getColumns().length;
	var vnRowCnt = voLayout.getRows().length;

	var vnHorizontalSpacing = parseInt(voLayout.horizontalSpacing);
	var vnSideMargin = parseInt(voLayout.leftMargin) + parseInt(voLayout.rightMargin);
	
	// 앱 개수만큼 균등 간격 px 계산
	var voFlotActlRct = mcFloatGrp.getActualRect();
	var vnRealAppWidth = voFlotActlRct.width - vnSideMargin - (vnHorizontalSpacing * (vnColumnCnt -1)); // margin, spacing 을 제외한 나머지 width
	var vnMinWidth = vnRealAppWidth / vnColumnCnt; 
	var vnMinHeight = voFlotActlRct.height / vnRowCnt;
	
	// 세로분할 or 4분할 일 경우 column 을 fr -> px 로 변경
	if(psLayout == msVertical || psLayout == msDivision) {
		var vaCols = [];
		for(var idx = 0; idx < vnColumnCnt; idx++){
			vaCols.push(vnMinWidth + "px");
		}
	
		voLayout.setColumns(vaCols);
	}
}


/**
 * 분할되어 있을 때 left or right 메뉴에 따른 Constraint 변경
 * @param {cpr.controls.UIControl} pcGrpWrap left 또는 right 메뉴를 포함한 그룹 컨트롤 또는 메뉴 컨트롤
 * @param {String} psDirection left 또는 right(소문자로 작성)
 */
comDivideScr.prototype.updateFloatConstraint = function (pcGrpWrap, psDirection) {
	
	if(moRootAppIns == null) return;
	if(mcMainTab == null) return;
	
	if(psDirection == null) {
		psDirection = "left";
	}
	
	var voMdiRect = mcMainTab.getOffsetRect();
	
	var vnTabHeight = mcMainTab.getHeaderControls()[0].getActualRect().height;
	var vnTabWidth= mcMainTab.getHeaderControls()[0].getActualRect().width;
	mcMainTab.getHeaderControls().forEach(function(each){
		if(each.getActualRect().height > vnTabHeight) vnTabHeight = each.getActualRect().height;
	});
		
	if(mcFloatGrp) {
		// 2 or 4분할일 경우 분할영역 플로팅 위치 변경
		// TODO 플로팅 위치를 변경하기 위해서 아래의 Constraint를 변경하십시오.
		moRootAppIns.getContainer().floatControl(mcFloatGrp, {
			top : voMdiRect.top + vnTabHeight + "px",
			left : voMdiRect.left + "px",
			right : (innerWidth-voMdiRect.right) + "px",
			bottom : (innerHeight-voMdiRect.bottom) + "px"
		});
	}
	
	if(mcNotifier) {
		// 알림컨트롤 플로팅 위치 변경
		var voNotiRect = mcNotifier.getActualRect();
		var voFloatCont = {
			left : voMdiRect.left + "px",
			right : voMdiRect.right + "px",
			bottom : voMdiRect.bottom + vnTabHeight + "px",
			height : voNotiRect.height + "px"
		};
		
		// 알림컨트롤 최하단으로 배치해서 플로팅 삭제
		if(moDialogContent.length > 0) {
			this._app.getContainer().addChild(mcNotifier, voFloatCont);
		} else {
			moRootAppIns.getContainer().floatControl(mcNotifier, voFloatCont);
		}
	}
}


/**
 * 메뉴 선택
 * @param {String} psAppId 앱ID
 * @param {any} poSelectedMenu
 * @param {
 *   text : String, <!-- tabItem 텍스트 -->
 *   tooltip : String, <!--  tabItem 툴팁 -->
 *   closable : Boolean <!-- tabItems 닫기여부 -->
 * } paProp tabItem 설정
 * @param {Function} poFuncCallBack
 */
comDivideScr.prototype.selectMenu = function (psAppId, poSelectedMenu, paProp, poFuncCallBack) {
	
	if(mcMainTab == null) return;
	
	moRootAppIns= mcMainTab.getAppInstance().getRootAppInstance();
	var _this = this;
				
	var vcNewEc = new cpr.controls.EmbeddedApp("ea"+psAppId + "_"+ Math.random()*10);
	cpr.core.App.load(psAppId, function(loadedApp){
		if(loadedApp) {		
			vcNewEc.app = loadedApp;	
			vcNewEc.ready( function(inEm){
			vcNewEc.userAttr("tabId", vcNewEc.uuid);
//				inEm.getEmbeddedAppInstance()._menu_id = poSelectedMenu.menu_id;
//				inEm.getEmbeddedAppInstance().app 	= loadedApp;
//				inEm.getEmbeddedAppInstance()._menu_id = psAppId;
			});

            if(mcFloatGrp) {
				
				/* 2, 4분할 */
				var voLayout = mcFloatGrp.getLayout();
				var vnRows = voLayout.getRows().length;
				var vnCols = voLayout.getColumns().length;
				
				var voLastConstraint = mcFloatGrp.getConstraint(mcFloatGrp.getLastChild());
				var vnRowIndex = 0;
				var vnColIndex = 0;
				
				if(vnRows == 2 && vnCols == 2) {
					// division
					vnRowIndex = voLastConstraint? voLastConstraint.rowIndex : 0;
					vnColIndex = voLastConstraint? voLastConstraint.colIndex : 0;
					
					if(voLastConstraint) {
						if(voLastConstraint.rowIndex == voLayout.getRows().length-1 && voLastConstraint.colIndex == 1) {
							// 폼레이아웃이 모두 임베디드앱으로 가득차있는 경우 하나씩 밀어서 보여준다.
							var vnRow = 0;
							var vnCol = 0;
							
							mcFloatGrp.getLayout().getChildrenByLayoutOrder().forEach(function(each, index) {
								if(index == 0) {
									mcMainTab.getTabItems().forEach(function(item, idx){
										if(item.name == each.userAttr("tabId")) {
											mcMainTab.getTabItems()[idx].content = each;
										}
									});
									mcFloatGrp.removeChild(each); 
								} else {
									cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function(){
										mcFloatGrp.replaceConstraint(each, {
											rowIndex : parseInt((index-1) / 2), 
											colIndex : Math.abs((index % 2) - 1)
										});
									});
								}
							})
						} else {
							// 비어있는 공간에 추가한다.
							if(voLastConstraint.colIndex == 1) vnRowIndex++;
							vnColIndex = (vnColIndex + 1) % 2;
						}
					}
				}  else {
					 if (vnRows == 1) { // vertical 
					 	
						vnColIndex = mcFloatGrp.getChildrenCount();
						
						if(vnCols == mcFloatGrp.getChildrenCount()) {
							// 폼레이아웃 구획 추가
							voLayout.setColumns(_getFormConfig(vnCols+1));							
						 	mcFloatGrp.setLayout(voLayout);
						}else{
							if(vnCols == 2){// 최초 분할 지정시 메뉴 오픈이 안되어있는 상태에서 드래그앤드롭 이후 인덱스 예외 처리
								vnColIndex = voLastConstraint.colIndex == 1 ? 0 : 1;
							}
						}
					} else if (vnCols == 1) { // horizontal
					
						vnRowIndex = mcFloatGrp.getChildrenCount();
						if(vnRows == mcFloatGrp.getChildrenCount()) {
							// 폼레이아웃 구획 추가
							voLayout.setRows(_getFormConfig(vnRows+1));							
						 	mcFloatGrp.setLayout(voLayout);
						}else{
							if(vnRows == 2){// 최초 분할 지정시 메뉴 오픈이 안되어있는 상태에서 드래그앤드롭 이후 인덱스 예외 처리
								vnRowIndex = voLastConstraint.rowIndex == 1 ? 0 : 1;
							}
						}
					}
				}
				
				// 다른 컨텐츠의 위치가 모두 변경 된 후 추가
				cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function(){ 
					mcFloatGrp.addChild(vcNewEc, {
						rowIndex : vnRowIndex, 
						colIndex : vnColIndex
					});
					
//					if(vnCols > 1) {
//						_setColsWidPx(msVertical);
//					}
					
					createDragManager(moRootAppIns);
				});
				
			} else if (moDialogContent.length > 0)  {
				/* 계단형 */
				
				var vnIndex = mcMainTab.getAppInstance().dialogManager.getDialogNames().length;
				_openDialog(vcNewEc, vnIndex);		
				if(paProp) vcNewEc.userAttr("text", paProp.text);
				
				return;
			}
			
			var tabItem = (function(tabFolder) {
				var tabItem_1 = new cpr.controls.TabItem();
				tabItem_1.text = paProp && paProp.text ? paProp.text : vcNewEc.app.title;
				tabItem_1.tooltip = paProp && paProp.tooltip ? paProp.tooltip : vcNewEc.app.title;
				tabItem_1.closable = paProp && paProp.closable != null ? paProp.closable : false;

				tabItem_1.content = null;
				tabItem_1.name = vcNewEc.uuid;
				if(poSelectedMenu){
					tabItem_1.userAttr("__menuInfo", JSON.stringify(poSelectedMenu.getRowData()));	
				}
				 // TODO 탭아이템에 관련된 설정을 작성하십시오.
				if(mcFloatGrp) {
					tabItem_1.visible = false;
				}
				
				return tabItem_1;				
			})(mcMainTab);
			
			if(mcFloatGrp == null && moDialogContent.length == 0) {
				// default 
				tabItem.content = vcNewEc;
			}
			
			mcMainTab.addTabItem(tabItem);
			mcMainTab.setSelectedTabItem(tabItem);
			
			if (poFuncCallBack != null && (typeof poFuncCallBack == "function")) {
				poFuncCallBack(vcNewEc);
			} 			
		}
	});
}
var voDialogManager = null;
/**
 * 다이얼로그 오픈
 * @param {cpr.controls.TabItem|cpr.controls.EmbeddedApp} poTabItem
 * @param {Number} pnIndex
 */
function _openDialog (poTabItem, pnIndex) {
	
	var voDialogApp = _createDialog(pnIndex);
	
	var voTabRect = mcMainTab.getOffsetRect();
	var vnTabHeight = mcMainTab.getHeaderControls()[0].getActualRect().height;
	
	/** @type cpr.controls.EmbeddedApp */
	var vcEmb = null;
	var vsEmbTitle = null;
	if(poTabItem.type == "embeddedapp") {
		vcEmb = poTabItem;
		vsEmbTitle = poTabItem.userAttr("text") ? poTabItem.userAttr("text") : poTabItem.app.title;
	} else {
		vcEmb = poTabItem.content;
		vsEmbTitle = poTabItem.text;
	}
	
	// 202107.06 최소화 버튼 존재 시, 최소화 영역 생성
	if(mcGrpBoundary == null && mbDialogMin) {
		mcGrpBoundary = new cpr.controls.Container();
		mcGrpBoundary.style.addClass(msDialogMinGrpCls);
		mcGrpBoundary.userAttr("minBoundary", "true");
		mcGrpBoundary.style.css("border", "1px solid lightgray");
	
		var flowlayout = new cpr.controls.layouts.FlowLayout();
		flowlayout.bottomMargin = 0;
		flowlayout.topMargin = 0;
		flowlayout.leftMargin = 0;
		flowlayout.rightMargin = 0;
		flowlayout.scrollable = false;
		mcGrpBoundary.setLayout(flowlayout);
		
		var container = mcMainTab.getAppInstance().getContainer();
		var vnHeight = 30;
		mcMainTab.getAppInstance().floatControl(mcGrpBoundary, {
			top : (voTabRect.top +  voTabRect.height - vnHeight) + "px",
			left : voTabRect.left + "px",
			width : voTabRect.width + "px",
			height : vnHeight + "px"
		});
	}
			
	var voDialogManager = mcMainTab.getAppInstance().dialogManager;
	voDialogManager.openDialog(voDialogApp, vcEmb.id, {}, function(dialog) {
		dialog.ready(function(dialogApp){
			// 필요한 경우, 다이얼로그의 앱이 초기화 된 후, 앱 속성을 전달하십시오.
			dialog.modal = false; 
			dialog.initValue = vcEmb;
			dialog.headerTitle = vsEmbTitle;
			dialog.headerMax = true;
			dialog.headerMin = mbDialogMin; 
			
			if(mbFixFirst) {
				if(poTabItem.content && (poTabItem.content.app.id == msFixAppId)) {
					dialog.headerClose = false;
				} else {
					dialog.headerClose = true;
				}
			} else {	
				dialog.headerClose = true;
			}
			
			// TODO 다이얼로그 스타일을 변경하고자 할 경우엔 아래의 클래스를 수정하십시오.
			dialog.style.addClass(msDialogCls);
			
			// 계단형 분할 시 다이얼로그 소팅(위치설정)
			voDialogManager.sort(cpr.core.DialogSortType.cascade, {
				horizontalMargin : voTabRect.left,
				horizontalSpacing : mnHierarchyDistance, 
				verticalMargin : voTabRect.top + vnTabHeight, 
				verticalSpacing : mnHierarchyDistance,
				width : 600,
				height : 500
			});
			
			dialog.addEventListener("load", function(e){
				mcMainTab.removeTabItem(poTabItem);
				var vbClosable = poTabItem.closable != null ? poTabItem.closable.toString() : "true";
				
				vcEmb.userAttr("appId", vsEmbTitle);
				vcEmb.userAttr("closable", vbClosable);
				moDialogContent.push(vcEmb);     
			});
			
			// 2021.07.06 추가
			dialog.addEventListener("minimize", function(e){
				// 최소화 한 경우 위치 변경
				/*
				 * - 다이얼로그 일때 최초 한번 그룹 생성
				 * - 분할유형 변경될 때 그룹 삭제
				 */
				
				if(mcGrpBoundary != null && mbDialogMin) {
					var vcDialogBtn = new cpr.controls.Button();
					vcDialogBtn.value = dialog.headerTitle;
					vcDialogBtn.style.addClass(msDialogMinBtnCls);
					vcDialogBtn.addEventListenerOnce("click", function(e){
						/** @type cpr.controls.Button */
						var control = e.control;
						
						// 클릭 시 최소화 되어있던 다이얼로그 복구
						mcGrpBoundary.removeChild(control);
						var vsDialogName = voDialogManager.getDialogName(dialog);
						voDialogManager.getDialogByName(vsDialogName).restore();
					})

					mcGrpBoundary.addChild(vcDialogBtn, {
						autoSize : "width",
						height : "30px"
					});
				}				
			});
			
			dialog.addEventListener("close", function(e){
				moDialogContent.splice(moDialogContent.indexOf(poTabItem.content), 1);

				cpr.core.Platform.INSTANCE.unregister(voDialogApp);
			});
			
		});
	});
}



/**
 * 선택/모두 닫기
 * @param {cpr.controls.ComboBox} pcCombobox
 * @param {String} psUnit 선택닫기 : "select" / 모두닫기 : "all" / 고정탭제외 닫기 : "fixClose"
 * @param {cpr.controls.TabItem} pcCloseItem? 닫을 탭아이템
 */
comDivideScr.prototype.closeMenu = function (pcCombobox, psUnit, pcCloseItem) {
	
	if(mcMainTab == null) return;
	
	if(psUnit == "all") {
		/* 모두닫기 */
		this.removeAllFloat();
		mcMainTab.closeAll();
	} else if(psUnit == "fixClose") {
		/* 고정 탭 제외 닫기 */
		var voApp = mcMainTab.getAppInstance();
		var vcFixedId = mcMainTab.userAttr(ATTR_FIXED_ID);
		voApp.lookup(vcFixedId).visible = true;
		this.removeAllFloat();
		
		/* 디폴트 탭 아이템을 제외한 나머지 탭 아이템을 모두 닫음 */
		var lockItems = mcMainTab.getCheckedTabItems();
		if(lockItems.length == 0 ){		
			mcMainTab.closeOthers(mcMainTab.getTabItems()[0]);
		}else {
			var items =  mcMainTab.getTabItems();
			for(var i = 1; i < items.length ; i++){
				if(lockItems.indexOf(items[i]) < 0  ) {
					mcMainTab.close(items[i]);
				}
			}
		}

	} else {
		/* 선택닫기 */
		if(pcCloseItem) {
			mcMainTab.close(pcCloseItem);	
			mcMainTab.setSelectedTabItem(mcMainTab.getTabItems()[0]);
		} else {
			cpr.core.NotificationCenter.INSTANCE.post("app-msg", {
				msg : "닫을 화면을 설정하세요."
			});
			return;
		}
		
		if(mcFloatGrp) {
			// 2분할 or 4분할 초기화
			this.divide(msDefault, mcNotifier); 
		}
	}
	
	if(pcCombobox) {
		pcCombobox.selectItemByValue("default", true);
	}
}


/**
 * 플로팅 되어있는 분할 영역 반환
 */
comDivideScr.prototype.getDivGroup = function() {
	return mcFloatGrp;
}


/**
 * 분할 시, 최대화 할 화면을 선택
 * @param {cpr.core.AppInstance} poAppIns
 */
comDivideScr.prototype.maximize = function (poAppIns) {
	if(mcFloatGrp || moDialogContent.length > 0) {
		moMaximize = poAppIns;
	}
}

/**
 * 
 * @param {cpr.core.AppInstance} app
 * @param {cpr.controls.TabFolder} tabfolder
 */
exports.comDivideScr = function(app, tabfolder) {
	return new comDivideScr(app, tabfolder);
}
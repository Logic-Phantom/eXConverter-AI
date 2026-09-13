/************************************************
 * mdiTabClose.module.js
 * Created at 2020. 3. 30. 오후 2:47:55.
 *
 * Version 1.1
 * Updated Date : 2021-04-21
 *
 * @author daye
 ************************************************/

/*
 * 본 모듈은 MDI폴더에서 열려있는 텝 아이템을 가져옵니다.
 * 불러온 탭아이텝 리스트를 통해 특정, 또는 모든 아이템을 닫을 수 있습니다.
 * 일부를 닫을 경우에는, 현재 탭폴더에 열려있는 탭아이템을 체크박스 그룹으로 확인해 닫을 수 있습니다.
 * [닫기] 또는 빈 공간을 누르면 체크박스그룹은 사라집니다.
 * [분할] 을 누르면 선택한 아이템을 분할해서 볼 수 있습니다. 단, [분할]하기 위해서 DivideMdi.module.js 모듈과 함께 사용해야합니다.
 * DivideMdi.module.js 는 [게시판 > eXbuilder6자료 > MDI폴더 분할 공통모듈] 에서 다운로드 받을 수 있습니다.
 * 
 * [사용가능한 메서드]
 * 1. getTabList : 열려있는 텝 아이템을 호출한 뒤, [분할] or [닫기]를 할 수 있습니다.
 * 2. closeTabAll : 열려있는 모든 텝아이템을 닫습니다.
 */


/************************************************
 * 전역변수 (변경 가능)
 ************************************************/
/**
 * 탭폴더의 고정 탭아이템 여부
 * @type {Boolean}
 */
var mbFixed = false;

/**
 * 분할 - 전체화면
 * @type {String}
 */
var msDefault = "default";

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
 * 
 */
var msCascading = "window";

/**
 * 이전 분할 레이아웃
 * default : 전체화면
 * @type {String}
 */
var msBeforeLayout = msDefault;

/**
 * 그룹 스타일 클래스
 * @type {String}
 */
var msPopGrpWrapCls = "dropdown-menu";

/**
 * 그룹 내 버튼 스타일 클래스
 * @type {String}
 */
var msBtnClosCls = "btn-primary";

/**
 * 체크박스그룹 스타일 클래스
 * @type {String}
 */
var msCheckBoxCls = "cl-checkbox";

/**
 * 사용자속성
 * 분할할 때 사용하는 콤보박스에 설정하는 속성명
 * @type {String}
 */
var ATTR_DIVIDE_LAYOUT = "divide-layout";

/************************************************
 * 전역 변수 (변경 불가능)
 ************************************************/
/**
 * 분할/닫기 선택 콤보박스
 * @type {cpr.controls.ComboBox}
 */
var mcCmbLayout = null;

/**
 * 계단형 분할 여부
 * @type {Boolean}
 */
var mbFlatCascading = false;

/**
 * 계단형 분할일 경우, 분할된 앱인스턴스 정보 저장
 * @type {JSON[]}
 */
var maCascading = [];


/************************************************
 * 프로토타입 선언
 ************************************************/
/**
 * 
 * @param {cpr.core.AppInstance} app
 * @param {any} comDiv
 */
var mdiTabClose = function (app, comDiv) {
	this._app = app;
	this._divide = comDiv;
}

/**
 * 첫번째 아이템을 고정합니다.
 */
mdiTabClose.prototype.setFixedItem = function() {
	mbFixed = true;
}

/**
 * 계단형 객체 저장
 * @param {any} paWindow
 */
mdiTabClose.prototype.getWindow = function(paWindow) {
	maCascading = paWindow;
}


/**
 * 열려있는 탭아이텝 중 특정 아이템을 닫습니다.
 * @param {cpr.controls.UIControl} pcCtrl (분할/닫기)버튼
 * @param {String} psCls 분할:divide / 닫기:close
 */
mdiTabClose.prototype.getTabList = function (pcCtrl, psCls) {
	if(this._divide == null) return;
	var comDiv = this._divide;
	
	var vcMDIFolder = comDiv.getMdiFolder();
	if(vcMDIFolder == null) return;
	
	var voTabItems = vcMDIFolder.getTabItems();
	voTabItems.forEach(function(each, index) {
		if(each.text == "tempItem") voTabItems.splice(index, 1);
	})
	
	if(voTabItems.length == 0 && this._app.dialogManager.getDialogNames().length == 0) {
		alert("분할 할 탭 아이템이 없습니다.");
		_setCmbDefault(pcCtrl);
		return;
	}
	
	if(pcCtrl.type == "combobox") mcCmbLayout = pcCtrl;
	
	/** @type cpr.core.AppInstance */
	var voRootAppIns = this._app.getRootAppInstance();
		
	var vcItemGrp = _createGroup(vcMDIFolder, psCls, comDiv);
	if(vcItemGrp) {
		voRootAppIns.getContainer().addEventListener("click", function(e){
			var voActualRect =	vcItemGrp.getActualRect();
			if(voActualRect.width == 0 && voActualRect.height == 0) return;
			
			var vaFolatedCtrls = [];
			var vcGrpPopWrap = voRootAppIns.lookup("grpPopWrap");
			if(vcGrpPopWrap) {
				if(vcGrpPopWrap.userAttr("floating")) vaFolatedCtrls.push(vcGrpPopWrap);
			} else {
				vaFolatedCtrls = voRootAppIns.getContainer().getAllRecursiveChildren().filter(function(each){
					return each.userAttr("floating") == "true";
				});
			}
	
			vaFolatedCtrls.forEach(function(each){
				if(each.userAttr("divide") != "true") _setCmbDefault(pcCtrl);
				voRootAppIns.getContainer().removeChild(each, true);
			});
		});
		
		// 그룹 안에 탭아이템 추가 후 플로팅
		_insertOpenItems(this._app, vcMDIFolder, vcItemGrp, comDiv);
		vcItemGrp.userAttr("floating", "true");
		
		var vnTabItems = voTabItems.length;
		if(maCascading.length > 0) vnTabItems += maCascading.length;
		voRootAppIns.floatControl(vcItemGrp, {
			top : pcCtrl.getActualRect().bottom + "px",
			right : pcCtrl.getParent().getOffsetRect().width - pcCtrl.getOffsetRect().right + 3 + "px", // margin 5px - border 1px*2 = 3
			width : (250 * Math.ceil(vnTabItems/4)) + "px",
			height : "225px"
		});
	}
}



/**
 * 열려있는 탭아이템을 모두 닫습니다.
 * @param {#combobox} psCmbId? 분할 콤보박스 ID
 */
mdiTabClose.prototype.closeTabAll = function (psCmbId) {
	if(this._divide == null) return;
	
	var comDiv = this._divide;
	
	/** @type cpr.controls.MDIFolder */
	var vcMDIFolder = comDiv.getMdiFolder();
	if(vcMDIFolder == null) return;
	
	var vcCombobox = this._app.lookup(psCmbId);
	
	var voTabItems = vcMDIFolder.getTabItems();
	// TODO confirm 이외의 팝업으로 확인창을 띄우기 위해서 아래의 코드를 수정하십시오.
	if(confirm("오픈된 전체 화면을 닫으시겠습니까?")) {
		if (mbFixed){
			comDiv.closeMenu(vcCombobox, "fixClose");
		} else {
			comDiv.closeMenu(vcCombobox, "all");
		}
		
		maCascading = [];
		mbFlatCascading = false;
	}
}


/************************************************
 * 내부 API
 ************************************************/
cpr.events.EventBus.INSTANCE.addFilter("before-selection-change", function(e){
	var control = e.control;
	if(control.type == "combobox" && control.userAttr(ATTR_DIVIDE_LAYOUT) == "true")	{
		msBeforeLayout = e.oldSelection[0].value;
	}
});

/**
 * 레이아웃 콤보박스 초기화
 * @param {cpr.controls.ComboBox} pcCmb
 */
function _setCmbDefault (pcCmb) {
	if(pcCmb.type == "combobox") {
		pcCmb.style.removeClass(pcCmb.value);
		pcCmb.style.addClass(msBeforeLayout);
		pcCmb.value = msBeforeLayout;
	}
}


/**
 * 탭아이템을 보여줄 그룹을 생성합니다.
 * @param {cpr.controls.TabFolder | cpr.controls.MDIFolder} pcMDIFolder 탭폴더
 * @param {String} psCls 구분(분할:divide, 닫기:close, 둘다:all)
 */
function _createGroup (pcMDIFolder, psCls, comDiv) {
	
	var voRootAppIns = pcMDIFolder.getAppInstance().getRootAppInstance();
	var dialogManager = voRootAppIns.dialogManager;
	
	// 그룹추가
	var vcGroup = new cpr.controls.Container("grpPopWrap");
	vcGroup.style.css("padding", "5px");
	vcGroup.style.addClass(msPopGrpWrapCls);
	vcGroup.addEventListener("click", function(e){
		vcGroup.style.css("z-index", "1");
		e.stopPropagation();
	});
	
	// 버티컬레이아웃 추가
	var vcItemListGrp = new cpr.controls.Container("grpList");
	var verticalLayout = new cpr.controls.layouts.VerticalLayout();
	vcItemListGrp.setLayout(verticalLayout);
	vcGroup.addChild(vcItemListGrp, {
		top : "0px",
		left : "0px",
		right : "0px",
		bottom : "50px",
	});
	
	// TODO [닫기]버튼에 대한 속성 및 스타일을 수정하십시오.
	var vnEabledDialog = 0;
	dialogManager.getDialogNames().forEach(function(each){
		if(each.indexOf("ea") != -1) vnEabledDialog++;
	}); 
	var vcCloseBtn = new cpr.controls.Button("btnClose");
	vcCloseBtn.value = "닫기";
	vcCloseBtn.enabled = vnEabledDialog == 0 ? true : false;
	vcCloseBtn.style.addClass(msBtnClosCls);
	vcCloseBtn.addEventListener("click", function(e){	
		var control = e.control;
		_closeGroup(control, pcMDIFolder, comDiv);
	});
	
	// TODO [분할]버튼에 대한 속성 및 스타일을 수정하십시오. 
	var vcDivBtn = new cpr.controls.Button("btnDivide");
	vcDivBtn.value = "분할";
	vcDivBtn.style.addClass(msBtnClosCls);
	vcDivBtn.addEventListener("click", function(e){	
		var control = e.control;
		var voRootAppIns = control.getAppInstance().getRootAppInstance();
		control.getParent().userAttr("divide", "true");
		_divideGroup(pcMDIFolder.getAppInstance(), control, pcMDIFolder, comDiv);
	});
	
	// [닫기]버튼 추가
	if(psCls.toUpperCase() == "CLOSE") {
		vcGroup.addChild(vcCloseBtn, {
			left : "calc(50% - 35px)",
			bottom : "10px",
			width : "70px",
			height : "30px",
		});
	}
	
	// [분할]버튼 추가
	if(psCls.toUpperCase() == "DIVIDE") {
		vcGroup.addChild(vcDivBtn, {
			left : "calc(50% - 35px)",
			bottom : "10px",
			width : "70px",
			height : "30px",
		});
	}
	
	// [닫기], [분할] 모두 추가
	if(psCls.toUpperCase() == "ALL") {
		vcGroup.addChild(vcCloseBtn, {
			left : "calc(50% - 75px)",
			bottom : "10px",
			width : "70px",
			height : "30px",
		});
		vcGroup.addChild(vcDivBtn, {
			left : "50%",
			bottom : "10px",
			width : "70px",
			height : "30px",
		});
	}
	
	return vcGroup;
}


/**
 * 열려있는 탭아이템 리스트를 추가합니다. (체크박스그룹)
 * @param {cpr.core.AppInstance} poApp
 * @param {cpr.controls.TabFolder | cpr.controls.MDIFolder} pcMDIFolder
 * @param {cpr.controls.Container} pcParent 리스트를 추가한 부모그룹
 */
function _insertOpenItems (poApp, pcMDIFolder, pcParent, comDiv) {
	
	var vcDataSet = poApp.lookup("dsOpenItems");
	if(vcDataSet == undefined || vcDataSet == null) { // 생성한 데이터셋은 최초한번만 register 하도록 수정
		vcDataSet = new cpr.data.DataSet("dsOpenItems");
		vcDataSet.parseData({
			columns : [
				{dataType: "string", name: "label"},
				{dataType: "string", name: "value"},
				{dataType: "string", name: "appId"},
			]
		});
		poApp.register(vcDataSet);
	}
	
	if(pcMDIFolder) {
		var voTabItems = pcMDIFolder.getTabItems();
		maCascading = [];
		
		// 계단형에서 다른형태로 분할 시 삭제된 아이템을 누락할 수 있도록 수정
		var vaDialogNms = poApp.dialogManager.getDialogNames().filter(function(each){
			return each.indexOf("ea") != -1;
		});
		if(vaDialogNms.length > 0) {
			// 계단형일 경우
			var voLoadApps = cpr.core.Platform.INSTANCE.getAllLoadedApps();
			vaDialogNms.forEach(function(each, index){
				maCascading.push({
					label :  poApp.dialogManager.getDialogByName(each).headerTitle,
					value : each,
					appId : each.slice(2, each.lastIndexOf("_"))
				});
			});
		}
		
		if(maCascading.length > 0) {
			maCascading.forEach(function(each){
				voTabItems.push(each)
			});
		}
		
		vcDataSet.clear();
		for(var idx = 0; idx < voTabItems.length; idx++){
			
			if(voTabItems[idx].text != "tempItem") {
				var vsLabel = "";
				var vsValue = "";
				var vsAppId = "";
				
				if(voTabItems[idx] instanceof cpr.controls.TabItem) {
					vsLabel = voTabItems[idx].text;
					vsValue = voTabItems[idx].itemIndex;
				} else if( voTabItems[idx] instanceof cpr.controls.Item){
					vsLabel = voTabItems[idx].row.getValue("label");
					vsValue = voTabItems[idx].row.getValue("value");
					vsAppId = voTabItems[idx].row.getValue("appId");
				} else {
					vsLabel = voTabItems[idx].label;
					vsValue = voTabItems[idx].value;
					vsAppId = voTabItems[idx].appId;
				}
				
				if(voTabItems[idx] instanceof cpr.controls.TabItem && pcMDIFolder.type == "mdifolder") {
					if(voTabItems[idx].content && voTabItems[idx].content.app) {
						vsAppId = voTabItems[idx].content.app.id;						
					} else {
						// 분할 된 상태에서 새로 추가한 메뉴에 대한 appId 설정
						/** @type cpr.controls.Container */
						var vcGrpFloat = comDiv.getDivGroup();
						if(vcGrpFloat) {
							var vcEmb = vcGrpFloat.getChildren().filter(function(each){
								return each.uuid == voTabItems[idx].name;
							})[0];
							vsAppId = vcEmb.app.id;		
						} else {
							var vsTempId = voTabItems[idx].content.id;
							vsAppId = vsTempId.slice(2, vsTempId.lastIndexOf("_"));
						}
					}
				}
				
				vcDataSet.addRowData({
					label : vsLabel,
					value : vsValue,
					appId : vsAppId
				})
			}
		}
	}
	
	// 체크박스를 추가할 버티컬레이아웃
	/** @type cpr.controls.layouts.VerticalLayout */
	var voVerticalLayout = pcParent.getAllRecursiveChildren().filter(function(each) {
		if(each.id == "grpList") {
			return each;
		}
	})[0];
	
	// 체크박스 추가(전체선택)
	var vcCheckBox = new cpr.controls.CheckBox();
	vcCheckBox.text = "전체선택";
	vcCheckBox.style.addClass(msCheckBoxCls);
	vcCheckBox.addEventListener("value-change", _onCbxValueChange);
	voVerticalLayout.addChild(vcCheckBox, {
		"autoSize": "height",
		"width": "200px",
		"height": "30px"
	});
	
	if(mcCmbLayout) {
		var vnItemCnt = pcMDIFolder.getTabItems().length + maCascading.length;
		if(mcCmbLayout.value == "default" || mcCmbLayout.value == "division") {
			vcCheckBox.enabled = false;
		}
	}
	
	// 체크박스 그룹 추가 (현재 열려있는 탭아이템 목록)
	// TODO 체크박스그룹의 속성 및 스타일을 설정하십시오.
	var vcOpenItemCbg = new cpr.controls.CheckBoxGroup();
	vcOpenItemCbg.colCount = Math.ceil(vcDataSet.getRowCount()/4);
	vcOpenItemCbg.addEventListener("selection-change", _onOpenItemSelectionChange);
	vcOpenItemCbg.setItemSet(vcDataSet, {
		"label": "label",
		"value": "value"
	});
	vcOpenItemCbg.verticalSpacing = 5;
	voVerticalLayout.addChild(vcOpenItemCbg, {
		"autoSize": "height",
		"width": "200px",
		"height": "30px"
	})
	
	// 고정탭아이템 있을 때 해당 체크박스 아이템 disable 처리
	if(mbFixed) {
		var vsExp = "";
		vcOpenItemCbg.enabledItemExp = vsExp;
	}
}


/**
 * 선택한 아이템을 분할합니다.
 * 해당 함수를 사용하기 위해서 DivideMdi.module.js 와 함께 사용하십시오.
 * @param {cpr.core.AppInstance} poApp
 * @param {cpr.controls.UIControl} pcControl
 * @param {cpr.controls.MDIFolder | cpr.controls.TabFolder} pcTabFolder
 */
function _divideGroup (poApp, pcControl, pcMDIFolder, comDiv) {
	
	var vcParent = pcControl.getParent();
	if(vcParent) {
		/** @type cpr.controls.CheckBox */
		var vcCheckAll = null;
		/** @type cpr.controls.CheckBoxGroup */
		var vcCheckList = null;
		
		vcParent.getAllRecursiveChildren().forEach(function(each){
			if(each.type == "checkboxgroup") {
				vcCheckList = each;
			} else if( each.type == "checkbox") {
				vcCheckAll = each;
			}
		});		
		
		if(vcCheckAll && vcCheckList) {
			maCascading = [];
			var voSelection = vcCheckList.getSelection();
			
			if(voSelection.length == 0) {
				alert("분할 할 아이템을 선택해주세요.");
				return;
			}
			
			var vsLayout = msDefault;
			if(mcCmbLayout) {
				vsLayout = mcCmbLayout.value;
			} else {
				// 분할모드를 선택하지 않은 경우 선택 개수에 따라 자동으로 분할모드 설정
				if(voSelection.length == 2) {
					vsLayout = msVertical;	
				} else if(voSelection.length ==3 || voSelection.length == 4){
					vsLayout = msDivision;	
				} else if(voSelection.length > 4) {
					vsLayout = msCascading;
					if(mbFlatCascading) { // 이미 계단형일 경우 다시 계단형분할 방지
						alert("4개 이하의 탭 아이템만 분할 할 수 있습니다.");
						return;
					}
				}
			}
			
			// 계단형일 경우, 아이템 저장
			if(vsLayout == msCascading) maCascading = voSelection;

			// 선택한 아이템을 분할합니다.
			comDiv.divide(vsLayout, null, voSelection);
		
			// 그룹 삭제
			if(pcControl.getParent()) {
				_removeFloating(pcControl.getParent(), comDiv);
			}
			
			if(vsLayout == msCascading) {
				mbFlatCascading = true;
			} else {
				mbFlatCascading = false;
			}
		}
	}
}


/**
 * 선택한 탭아이템 닫기
 * @param {cpr.controls.UIControl} pcControl
 * @param {cpr.controls.TabFolder | cpr.controls.MDIFolder} pcMDIFolder
 */
function _closeGroup (pcControl, pcMDIFolder, comDiv) {

	var vcParent = pcControl.getParent();

	if(vcParent) {
		/** @type cpr.controls.CheckBox */
		var vcCheckAll = null;
		/** @type cpr.controls.CheckBoxGroup */
		var vcCheckList = null;
		
		vcParent.getAllRecursiveChildren().forEach(function(each){
			if(each.type == "checkboxgroup") {
				vcCheckList = each;
			} else if( each.type == "checkbox") {
				vcCheckAll = each;
			}
		});		
		
		if(vcCheckAll && vcCheckList) {
			var voSelection = vcCheckList.getSelection();
			voSelection.forEach(function(each){
				var vsValue = each.row.getValue("value");
				var vsAppId = each.row.getValue("appId");
				var vcClosableItem = null;
				
				if(pcMDIFolder.type == "tabfolder") {
					vcClosableItem = pcMDIFolder.getTabItemByID(vsValue);
				} else {
					vcClosableItem = pcMDIFolder.findItemWithAppID(vsAppId);
				}
				
				var voRootAppIns = pcControl.getAppInstance().getRootAppInstance();
				if(voRootAppIns.lookup("grpFloat")) {
					comDiv.closeMenu(mcCmbLayout, "select", vcClosableItem);
				}
				
				pcMDIFolder.close(vcClosableItem);
			});
			
			// 그룹 삭제
			_removeFloating(pcControl.getParent(), comDiv);
		}
	}
}


/**
 * 플로팅 되어있던 그룹을 모두 삭제합니다.
 * @param {cpr.controls.Container} pcFloatGroup
 */
function _removeFloating(pcFloatGroup, comDiv) {
	var voRootAppIns = pcFloatGroup.getAppInstance().getRootAppInstance();
	
	if(pcFloatGroup.isFloated()) {
		voRootAppIns.getContainer().removeChild(pcFloatGroup, true);
	}

	if(mbFlatCascading && voRootAppIns.dialogManager.getDialogNames().length != 0) {
		comDiv.removeAllFloat();
	}
}


/**
 * 체크박스 그룹의 selection-change 이벤트리스너
 * @param {cpr.events.CUIEvent} e
 */
function _onOpenItemSelectionChange (e) {
	
	/** @type cpr.controls.CheckBoxGroup */
	var control = e.control
	var vcParent = control.getParent();

	/** @type cpr.controls.CheckBox */
	var vcCbxAll = vcParent.getChildren().filter(function(each) {
		if(each.type == "checkbox"){
			return each;
		}
	})[0];
	
	/* 체크박스그룹을 모두 체크하면 모두 선택도 체크 */
	if (control.getSelection().length == control.getItemCount()){
		vcCbxAll.putValue("true");
	} else {
		vcCbxAll.putValue("");
	}
	
	if(mcCmbLayout) {
		if(mcCmbLayout.value == "default") {
			_enabledCbg(control, 1);
		}
		if(mcCmbLayout.value == "division") {
			_enabledCbg(control, 4);
		}
	}
}

/**
 * 체크박스그룹 아이템 enabled 설정
 * @param {cpr.controls.CheckBoxGroup} pcCbg
 * @param {Number} vnSelection 최대 선택 개수
 */
function _enabledCbg (pcCbg, vnSelection) {
	var voSelection = pcCbg.getSelection();
	var voEnable = [];
	voSelection.forEach(function(each){
		voEnable.push("value == '" + each.value + "'");
	});

	if(voSelection.length == vnSelection) {
		var vsExp = voEnable.join(" || ");
		pcCbg.enabledItemExp = vsExp;
	} else {
		pcCbg.enabledItemExp = "";
	}
}

/**
 * 체크박스의 value-change 이벤트리스너
 * @param {cpr.events.CUIEvent} e
 */
function _onCbxValueChange(e){
	
	/** @type cpr.controls.CheckBox */
	var control = e.control;
	var vcParent = control.getParent();
	
	/** @type cpr.controls.CheckBoxGroup */	
	var vcCbgItems = vcParent.getChildren().filter(function(each) {
		if(each.type == "checkboxgroup"){
			return each;
		}
	})[0];
	
	/* 전체 선택의 체크 상태에 따라 체크박스그룹의 체크를 전체 선택하거나 전체 선택 해제 */
	if (control.checked == true) {
		vcCbgItems.selectAllItems();
	} else {
		vcCbgItems.clearSelection();
	}
}

/**
 * 
 * @param {cpr.core.AppInstance} app
 */
globals.mdiTabClose = function(app, comDiv) {
	return new  mdiTabClose(app, comDiv);
}
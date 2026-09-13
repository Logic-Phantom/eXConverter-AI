/************************************************
 * ComboBoxListPopup.module.js
 * Created at 2020. 1. 23. 오전 10:27:59.
 *
 * Version 1.4
 * Updated Date : 2022-01-24
 * 
 * @author daye
 ************************************************/

/*
 * 본 모듈은 콤보박스 리스트가 특정 개수 이상일 경우 팝업으로 열어 확인 및 선택 할 수 있는 모듈입니다.
 * 그룹을 제외한 컨트롤에 대해 클릭할 경우 팝업을 띄울 수 있습니다. 대상콤보박스는 fieldLabel에 작성합니다.
 *  
 * [fieldLabel 작성법]
 * - 콤보박스의 fieldLabel을 팝업창의 헤더타이틀로 사용됩니다.
 * - 콤보박스 이외의 다른 컨트롤의 fieldLabel은 타겟 콤보박스 id 를 작성합니다.
 * 
 * [확인사항]
 * 콤보박스에 바인딩 되어있는 데이터셋의 컬럼은 label, value로 작성
 * 그리드의 콤보박스는 선택행이 있는 경우에만 확인 가능
 * 
 * 스크린구성이 mobile 이 포함되어 있을 때 사용 하는 것을 권장합니다.
 * 스크린 구성에 모바일 사이즈가 없을 경우 mnMblScrnSz 의 값을 설정하여 사용 할 수 있습니다.
 */

/************************************************
 * 사용가능 API
 ************************************************/
/**
 * 모듈 사용 여부
 * 값이 true일 경우에만 모듈을 사용한다.
 * @type {Boolean}
 */
var mbCreateApp = true; 

/**
 * 모바일 전용 여부
 *	true 일경우에 팝업이 화면 아래에 위치합니다.
 * @type {Boolean}
 */
var mbMobile = true;

/**
 * 라디오버튼 (or 체크박스그룹) 의 아이템 고정너비
 * 특정 너비를 설정하기 위해서는 넘버값을 설정하세요.
 * 
 * @type {Boolean | Number}
 */
var mnFixedWidth = false;

/**
 * 셀렉션 계열 컨트롤 [선택] 아이템 추가여부
 * @type {Boolean}
 */
var mbInsertBlank = true; 

/**
 * 사용자 속성
 * @type {String}
 */
var ATTR_COMBO_POP = "combo-pop";

/**
 * 사용자 속성
 * 모바일 콤보박스 사용 시, 콤보박스가 위치 할 타겟 컨테이너를 설정합니다.
 * 현재 앱인스턴스일 경우 "app" 으로 작성하며, 그 외는 그룹ID 를 작성합니다.
 * default는 루트 컨테이너에 설정됩니다.
 * @type {String}
 */
var ATTR_TARGET_COMBO_GROUP_ID = "target-combo-group-id";

/**
 * 사용자 속성
 * @type {String}
 */
var ATTR_MOBILE_ONLY = "mobile-only";

/**
 * 다이얼로그 배경 스타일 클래스
 * @type {String}
 */
var msDialogOverlayCls = "cl-overlay";

/**
 * 다이얼로그 스타일
 * @type {String}
 */
var msDialogCls = "rounded-0";

/**
 * 라디오버튼 (or 체크박스그룹) 의 스타일 클래스
 * @type {String}
 */
var msSelectCls = "";

/**
 * 라디오버튼 (or 체크박스그룹) 아이템의 스타일 클래스
 * @type {String}
 */
var msSelectItemCls = "align-text-top";

/**
 * 다이얼로그의 [확인] 버튼 스타일 클래스
 * @type {String}
 */
var msBtnConfirmCls = "btn-primary rounded-0";

/**
 * 폼레이아웃 spacing
 * @type {Number}
 */
var mnFormSpacing = 0;

/**
 * [확인] 버튼 높이
 * @type {Number}
 */
var mnConfirmBtnHgt = 50;

/**
 * 모바일 전용 콤보박스 팝업에서 보여지는 최대 아이템 개수
 * 적용화면사이즈 : tablet, mobile
 * @type {Number}
 */
var mnMobileList = 6;

/**
 * 팝업을 띄울 콤보박스아이템 개수
 * 적용화면사이즈 : default
 * @type {Number}
 */
var mnDftItemList = 7; 

/**
 * 라디오버튼(or 체크박스그룹) 이 한 줄에 보여질 아이템 수
 * 적용화면사이즈 : default
 * @type {Number}
 */
var mnDftColCount = 6;

/**
 * 팝업 constraint 
 * 적용화면사이즈 : default
 */
var moDftPopSize = {
	width: 900,
	height: 600
};

/**
 * 팝업을 띄울 콤보박스아이템 개수
 * 적용화면사이즈 : tablet, mobile
 * @type {Number}
 */
var mnMblItemList = 0;

/**
 * 라디오버튼(or 체크박스그룹) 이 한 줄에 보여질 아이템 수
 * 적용화면사이즈 : tablet, mobile
 * @type {Number}
 */
var mnMblColCount = 1;

/**
 * 팝업 constraint 
 * 적용화면사이즈 : tablet, mobile
 */
var moMblPopSize= {
	left : 0,
	right : 0,
	bottom : 0,
	height : 0
};

/**
 * 팝업 이름
 * @type {String}
 */
var msDialogName = "dialogName";

/**
 * 다이얼로그 헤더 타이틀
 * @type {String}
 */
var msTempHeaderTitle = "다이얼로그 팝업";

/**
 * box-shadow 스타일
 */
var moBoxShadow = {
	top : "inset 0px -11px 20px -1px rgba(0,0,0,0.16)",
	bottom : "inset 11px 0px 20px -1px rgba(0,0,0,0.16)",
	middle : "inset 0px -11px 20px -1px rgba(0,0,0,0.16),  inset 11px 0px 20px -1px rgba(0,0,0,0.16)"
}

/**
 * up, down 버튼 클래스
 * @type {String}
 */
var msFloatBtnCls = "rounded-circle";

/**
 * 스크롤 버튼 표시 여부 
 * 적용화면사이즈 : tablet, mobile
 * 
 * @type {Boolean}
 */
var mbScrollButton = false;

/**
 * 스크롤 스타일(box-shadow) 표시 여부 
 * 적용화면사이즈 : tablet, mobile
 * @type {Boolean}
 */
var mbScrollStyle = false;

/**
 * 스크린 사이즈 너비
 * 스크린 구성에 모바일 사이즈가 정의 되지 않았을 경우에 사용
 * @type {Number}
 */
var mnMblScrnSz = 350;

/************************************************
 * 내부 시스템 멤버변수 (변경X)
 ************************************************/
/**
 * 앱 ID
 * @type {String}
 */
var msAppId = null; 

/**
 * 앱 인스턴스
 * @type {cpr.core.AppInstance}
 */
var moAppIns = null;

/**
 * 타겟 콤보박스
 * @type {cpr.controls.ComboBox}
 */
var mcComboBox = null;

/**
 * 팝업이 띄워졌는지 여부
 * @type {Boolean}
 */
var mbPop = false;

/**
 * 팝업을 띄울 콤보박스아이템 개수
 * @type {Number}
 */
var mnList;

/**
 * 라디오버튼(or 체크박스그룹) 이 한 줄에 보여질 아이템 수
 * @type {Number}
 */
var mnColCount;

/**
 * 팝업 constraint 
 */
var moPopSize;


/************************************************
 * 이벤트 버스 (load)
 ************************************************/

if(mbCreateApp) {
	cpr.events.EventBus.INSTANCE.addFilter("init", fn_load);
	cpr.events.EventBus.INSTANCE.addFilter("click", fn_click);
}
if(mbMobile) cpr.events.EventBus.INSTANCE.addFilter("screen-change", fn_screen_change);

function fn_load (e) {
	var control = e.control;

	if(control instanceof cpr.core.AppInstance) {
	
		var container = control.getContainer();
		container.getAllRecursiveChildren().forEach(function(/*cpr.controls.ComboBox*/ each){
			if(each.type == "combobox" && each.userAttr(ATTR_COMBO_POP) == "true") {
				each.preventInput = true;
			}
		});
	}
}

function fn_click (e) {
	var control = e.control;
	moAppIns = control.getAppInstance();

	// 그룹 제외
	if (control.type == "container" || moAppIns.app == null) {
		return;
	}
	
	// 팝업이 띄워져 있지 않은경우에만 팝업을 띄움
	if(mbPop == false) {
		
		// 그리드 click 시, 선택행이 없을 경우 팝업을 띄우지 않음
		if(control.type == "grid") {
			if(control.getSelectedRowIndex() == -1) {
				return;
			}
		}
		
		_setMobile(mbMobile, mbScrollButton, mbScrollStyle);
		
		/** @type cpr.controls.ComboBox */
		var vcTargetCombo = null;
		if(control.type == "combobox") {
			vcTargetCombo = control;
		} else {
			var vsTargetCmbId = _getTargetComboId(control);
			vcTargetCombo = moAppIns.lookup(vsTargetCmbId);
		}
		
		if((vcTargetCombo != null && vcTargetCombo.type == "combobox")) {
			if(vcTargetCombo.userAttr(ATTR_COMBO_POP) == "true") {
				
				/*
				 * 모바일에서만 해당 기능을 사용 확인(mobile-only = true)
				 * default : 기본 콤보박스 사용
				 * tablet, mobile : 콤보팝업 사용
				 */
				var vsTargetScreen = moAppIns.targetScreen.name;
				if(vsTargetScreen == "default" && vcTargetCombo.userAttr(ATTR_MOBILE_ONLY) == "true") {
					return;
				}
				
				// 콤보박스 아이템 개수보다 mnCmbItem이 많으면 팝업 띄우지 않음
				var vnItemCnt = vcTargetCombo.getItemCount();
				 if(!mbMobile && vnItemCnt <= mnList) {
					// 그리드 안의 콤보박스는 편집행일 경우에만 open 할 수 있음
					if(vcTargetCombo.getParent().type == "grid") {

						/** @type cpr.controls.Grid */
						var vcGrid = vcTargetCombo.getParent();
						var vnSelectedRowIndex = vcGrid.getSelectedRowIndex();
						vcGrid.setEditRowIndex(vnSelectedRowIndex);
					}
					
					// FIXME 그리드안의 콤보박스가 팝업이 아닌 open 될경우 아래 코드 주석을 해제하십시오.
//					cpr.core.DeferredUpdateManager.INSTANCE.update();
					control.preventInput = false;
					vcTargetCombo.open();
					vcTargetCombo.focus();
					return;
				}
				
				cpr.core.DeferredUpdateManager.INSTANCE.update();
				_floatPop(control);
			}
			
		}
	}
}

/**
 * 
 * @param {cpr.events.CScreenChangeEvent} e 화면변경이벤트
 */
function fn_screen_change (e) {
	
	var voApp = e.control;
	
	if(voApp instanceof cpr.core.AppInstance) {
		
		var vaMblCmb = voApp.getContainer().getAllRecursiveChildren().filter(function(each){
			return each.type == "combobox" && each.userAttr(ATTR_COMBO_POP) == "true";
		});
		if(vaMblCmb.length == 0) return;
	
		var isMobile = e.screen.name == "mobile";
		if(!isMobile) {
			var vaSupportedMediaNms = voApp.allSupportedMediaNames;
			if(!(vaSupportedMediaNms instanceof Array)) return;
	
			if(vaSupportedMediaNms.indexOf("mobile") == -1) {  
				// 스크린 구성에 mobile 이 없는 경우 (2022.01.24 추가)
				
				var voHost = voApp.getHost();
				if(voHost) {
					var vnHostWid = voHost.getActualRect().width;
					if(vnHostWid <= mnMblScrnSz) {
						isMobile = true;
					}
				}
			}
		}
		
		_setMobile(isMobile, mbScrollButton, mbScrollStyle);
	}
}


/**
 * 새로운 앱인스턴스 생성
 */
function _createApp() {
	
	if(moAppIns == null) {
		return;
	}

	msAppId = moAppIns.app.id + "ListPop";
	var newApp = new cpr.core.App(msAppId, {
		
		onPrepare: function(loader){
		},
		
		onCreate: function(/* cpr.core.AppInstance */ newApp, exports){
			var vaRows = (function(pnHeight){
				var rows = [];
				rows.push("1fr");
				rows.push(pnHeight + "px");
				return rows;
			})(mnConfirmBtnHgt)
			
			// 루트 컨테이너 레이아웃 설정 (폼레이아웃)
			var container = newApp.getContainer();
			var voFormlayout = new cpr.controls.layouts.FormLayout();
			voFormlayout.setRows(vaRows);
			voFormlayout.setColumns(["1fr"]);
			voFormlayout.verticalSpacing = mnFormSpacing + "px";
			container.setLayout(voFormlayout);
			
			// 루트 앱인스턴스 로드 이벤트 리스너
			newApp.addEventListener("load", function(e) {	
				
				var vcCtrl = newApp.getHostProperty("initValue");
				var voSelected = []; // 이전에 선택한 값
				moAppIns = vcCtrl.getAppInstance();
				
				// vsInitValue에 해당하는 타겟 콤보박스 저장
				mcComboBox = moAppIns.getContainer().getAllRecursiveChildren().map(function(each){
					var vcCombo = null;
					if(vcCtrl.type == "combobox" && each == vcCtrl) {
						vcCombo = each;
						voSelected = each.values;
					} else {
						var vsTargetId = vcCtrl.fieldLabel;
						if(each.id == vsTargetId && each.type == "combobox") {
							vcCombo = each;
							voSelected = each.values;
						}
					}
					
					// 그리드에 포함되어있는 콤보박스일 경우
					if(vcCombo && vcCombo.getParent().type == "grid") {
						/** @type cpr.controls.Grid */
						var vcGrid = each.getParent();
						var vnSelectedIndex = vcGrid.getSelectedRowIndex();
						
						for(var idx = 0; idx < vcGrid.detail.cellCount; idx++) {
							if(vcGrid.detail.getControl(idx) == each) {
								voSelected = [vcGrid.getCellValue(vnSelectedIndex, idx)];
							}
						}
					}
					
					return vcCombo;
				}).filter(function(each){
					if(each) return each;
				})[0];
				
				if(mcComboBox == null) return;
				
				var vbMultiple = mcComboBox.multiple; // 콤보박스의 multiple 속성값

				/*
				 * ---------------------------- start ----------------------------
				 * 드롭다운 리스트 아이템을 보여주기 위함 컨트롤 배치
				 */
				// 1. 셀렉션 계열 컨트롤을 감싸는 그룹 생성(버티컬 레이아웃)
				var vcGroup = new cpr.controls.Container();
				var voVerticalLayout = new cpr.controls.layouts.VerticalLayout();
				vcGroup.setLayout(voVerticalLayout);
				
				// 2. 셀렉션 계열 컨트롤 생성 (라디오, 체크박스그룹)
				var vcSelection = null;
				if(vbMultiple == true) {
					vcSelection = new cpr.controls.CheckBoxGroup(); // 다중선택
				} else {
					vcSelection = new cpr.controls.RadioButton(); // 단일선택
				}
				
				// 3. 셀렉션 계열 컨트롤 속성 및 스타일 설정
				/*
				 * 아래 기능은 2021-01-29 릴리즈 버전 이후부터 사용 가능합니다
				 * 		- 라디오버튼(or 체크박스그룹) 아이템의 너비를 고정너비로 설정합니다.
				 * 		- 각 아이템의 텍스트에 말줄임 스타일을 적용하기 위해서 아이템을 반드시 고정너비로 설정해야 합니다.
				 */
				vcSelection.fixedWidth = mnFixedWidth;
				
				// TODO 한 행에 보여줄 아이템 개수
				vcSelection.colCount = mnColCount;

				// TODO 컨트롤의 스타일 변경
				// 1) 컨트롤 스타일
				vcSelection.style.addClass(msSelectCls);

				// 2) 컨트롤 아이템 스타일
				vcSelection.style.item.addClass(msSelectItemCls);
				
				// 4. 데이터셋 생성
				var vcComboDataSet = new cpr.data.DataSet();
				var voRow = [];
				mcComboBox.getItems().forEach(function(each){
					voRow.push({
						"label": each.label,
						"value": each.value
					});
				});
				vcComboDataSet.parseData({
					"columns" : [
						{"name": "label"},
						{"name": "value"}
					],
					"rows" : voRow
				});
				
				// 5. 라디오버튼일 때, 공백 아이템 추가
				if(mbInsertBlank && vcSelection.type == "radiobutton" && mcComboBox.getItemCount() > 0) { 
					vcComboDataSet.insertRowData(0, false, {
						"label" : "선택취소",
						"value" : ""
					})
				}				
				
				// 6. 셀렉션 컨트롤에 데이터셋 바인딩
				vcSelection.setItemSet(vcComboDataSet, {
					label : "label",
					value : "value",
					tooltip : "label"
				});
					
				// 7. 기존의 선택했던 값이 존재할 경우 값 설정
				if(voSelected.length != 0) {
					vcSelection.values = voSelected;
				}
				
				// 8. 컨트롤 추가
				vcGroup.addChild(vcSelection, {
					autoSize : "height"
				});
				container.addChild(vcGroup, {
					rowIndex : 0,
					colIndex : 0
				});
				/*
				 * 드롭다운 리스트 아이템을 보여주기 위함 컨트롤 배치
				 * ---------------------------- end ----------------------------
				 */
				
				// [확인] 버튼 컨트롤
				var vcButton = new cpr.controls.Button();
				vcButton.value = "확인";
				vcButton.style.addClass(msBtnConfirmCls); // 버튼 style 적용
				vcButton.addEventListener("click", function(e){
					// 콤보박스 아이템 선택 및 팝업닫힘
					newApp.close(vcSelection.values);
				});
				container.addChild(vcButton, {
					rowIndex : 1,
					colIndex : 0
				})
				
				cpr.core.DeferredUpdateManager.INSTANCE.update();
				
				/*
				 * 팝업이 열린 후 팝업 사이즈 재설정
				 * (모바일 전용 한정) 
				 */
				var dialog = newApp.getHost();
				if(dialog && dialog instanceof cpr.controls.Dialog) {
					if(mbMobile) {
						var elDialog = document.getElementById("uuid-"+dialog.uuid).querySelector(".cl-dialog-header");
						var dialogHeaderHgt = getComputedStyle(elDialog).height; // 다이얼로그 헤더 높이
						
						var vnViewItemCount = vcSelection.getItemCount();
						var vnItemCnt = vnViewItemCount <= mnMobileList ? vnViewItemCount : mnMobileList; // 다이얼로그에 최대 보여줄 아이템 개수
						var vnItemBorders = vnViewItemCount <= mnMobileList ? vnViewItemCount : 0; // 스크롤이 없는 상태에서 각 아이템 border 사이즈 추가
						
						var elSelectionItem = document.getElementById("uuid-"+vcSelection.uuid);
						var vnSelectionItemHgt = 0; // 셀력션 아이템의 높이
						if(vnViewItemCount > 0) {
							if(vbMultiple) {
								// 멀티셀렉션
								vnSelectionItemHgt = getComputedStyle(elSelectionItem.querySelector(".cl-checkbox")).height;
							} else {
								// 단일셀렉션
								vnSelectionItemHgt = getComputedStyle(elSelectionItem.querySelector(".cl-radiobutton-item")).height;
							}
						}
						
						/*
						 * 최종 다이얼로그 높이
						 * (보여지는 아이템 개수 * 각 아이템 높이) + 다이얼로그 헤더 높이 + [확인버튼]높이 + 보여지는 아이템 보더개수 + 폼레이아웃 스페이싱
						 */
						var vnTotalDialogHgt = (vnItemCnt * parseInt(vnSelectionItemHgt)) + parseInt(dialogHeaderHgt) + mnConfirmBtnHgt + vnItemBorders + mnFormSpacing;
						
						// 다이얼로그 최대 높이 = 화면높이*0.8
						var mnMaxHeight = dialog.getAppInstance().getActualRect().height * 0.8 ;
						if(mnMaxHeight  <= vnTotalDialogHgt || mnMobileList == -1) {
							vnTotalDialogHgt = mnMaxHeight ;
						}
						
						// 스크롤이 있는 경우 버튼 생성
						var vnRealSelectionHeight = vcSelection.getActualRect().height; // 실제 전체  selection컨트롤의 rect
						var vnSelectionViewHeight = vnTotalDialogHgt - (parseInt(dialogHeaderHgt) + mnConfirmBtnHgt); //  selection컨트롤의 viewPort
						if(vnRealSelectionHeight > vnSelectionViewHeight) {
							// 다이얼로그 최소 높이 
							var vnMin = (parseInt(dialogHeaderHgt) + mnConfirmBtnHgt) + 90;
							if(vnMin >= vnTotalDialogHgt) {
								var maxHeight = (parseInt(vnSelectionItemHgt) * vcSelection.getItemCount()) + parseInt(dialogHeaderHgt) + mnConfirmBtnHgt + vnItemBorders + mnFormSpacing;
								vnTotalDialogHgt = vnMin > maxHeight? maxHeight : vnMin;
							}
						}
												
						var vnSelectionViewHeight2 = vnTotalDialogHgt - (parseInt(dialogHeaderHgt) + mnConfirmBtnHgt); // 변경된 vnTotalDialogHgt 로 다시 계산한 selection컨트롤의 viewPort
						if(mbScrollButton && vnRealSelectionHeight > vnSelectionViewHeight2) { // 스크롤이 있는 경우에만
							// 1) 최초 box-shadow 설정
							vcGroup.style.css({
								"box-shadow" : moBoxShadow.top
							})
							
							// 2) 버튼 추가 
							// TODO 디자인 수정
							var vcUpBtn = new cpr.controls.Button("btnUp");
							vcUpBtn.value = "▲";
							vcUpBtn.style.addClass(msFloatBtnCls);
							vcUpBtn.enabled = false;
							vcUpBtn.addEventListener("click", function(e){
								vcGroup.scrollTo(0, 0, 0.3, cpr.animation.TimingFunction.EASE_IN_OUT_CUBIC);
							});
							dialog.getEmbeddedAppInstance().floatControl(vcUpBtn, {
								top : "10px",
								right : "20px",
								width : "30px",
								height : "30px",
							});
							
							var vcDownBtn = new cpr.controls.Button("btnDown");
							vcDownBtn.value = "▼";
							vcDownBtn.style.addClass(msFloatBtnCls);
							vcDownBtn.addEventListener("click", function(e){
								vcGroup.scrollTo(0, vnRealSelectionHeight, 0.3, cpr.animation.TimingFunction.EASE_IN_OUT_CUBIC);
							});
							
							dialog.getEmbeddedAppInstance().floatControl(vcDownBtn, {
								top : (vnSelectionViewHeight2- 40) + "px",
								right : "20px",
								width : "30px",
								height : "30px",
							});
						}
						
						vcGroup.addEventListener("scroll", function(e){
							var voViewportRect = e.control.getViewPortRect();
							var top = voViewportRect.top;
							var bottom = voViewportRect.bottom;
							
							if(mbScrollButton) {
								if(top == 0) {
									// 가장 위
									vcUpBtn.enabled = false;
									vcDownBtn.enabled = true;
								} else if(bottom == vnRealSelectionHeight) {
									// 가장 아래
									vcUpBtn.enabled = true;
									vcDownBtn.enabled = false;
								} else {
									// 중간
									vcUpBtn.enabled = true;
									vcDownBtn.enabled = true;
								}
							}
							
							if(mbScrollStyle) {
								if(top == 0) {
									// 가장 위
									vcGroup.style.css({
										"box-shadow" : moBoxShadow.top
									})
								} else if(bottom == vnRealSelectionHeight) {
									// 가장 아래
									vcGroup.style.css({
										"box-shadow" : moBoxShadow.bottom
									})
								} else {
									// 중간
									vcGroup.style.css({
										"box-shadow" : moBoxShadow.middle
									})
								}
							}
						});
						
						dialog.style.animateTo({
							"transform":"translateY("+moMblPopSize.bottom+"px)",
							"max-height" : vnTotalDialogHgt + "px",
						}, 0.3, cpr.animation.TimingFunction.EASE_IN_OUT_CUBIC);
						
						cpr.core.DeferredUpdateManager.INSTANCE.asyncExec(function() {
							var dialogManager = dialog.getAppInstance().dialogManager;
							var oldConstraint = dialogManager.getConstraintByName(msDialogName);
							var newConstraint = oldConstraint;
							newConstraint.height = vnTotalDialogHgt;
							dialogManager.replaceConstraintByName(msDialogName, newConstraint);
						});
					}
				}
			});
		}
	});
	
	// 앱 생성
	cpr.core.Platform.INSTANCE.register(newApp);
	
	return newApp;
}


/**
 * 콤보박스 리스트가 open되었을 경우 방지
 * 아이템 개수가 mnCmbItem보다 많은 경우에만 팝업으로 띄운다.
 * @param {Event} e
 */
cpr.events.EventBus.INSTANCE.addFilter("open", function(e){
	var control = e.control;
	
	if(control.type == "combobox" && control.userAttr(ATTR_COMBO_POP) == "true") {
		
		/*
		 * 모바일에서만 해당 기능을 사용 확인(mobile-only = true)
		 * default : 기본 콤보박스 사용
		 * tablet, mobile : 콤보팝업 사용
		 */
		var voAppInstance = control.getAppInstance();
		if(voAppInstance && voAppInstance instanceof cpr.core.AppInstance) {
			var vsTargetScreen = voAppInstance.targetScreen.name;
	 		if(vsTargetScreen == "default" && control.userAttr(ATTR_MOBILE_ONLY) == "true") return;
		}
		
		var vnItemCnt = control.getItemCount();
		if(vnItemCnt > mnList) {
			e.preventDefault();
		}
	}
});


/**
 * 타겟 콤보박스 확인
 *  fieldLabel이 있는 경우 fieldLabel 반환
 *  fieldLabel이 없는 경우 컨트롤 id 반환
 * @param {cpr.controls.UIControl} pcControl 타겟 콤보박스
 */
function _getTargetComboId (pcControl) {
	
	var vsLabel = null;
	
	if(pcControl.fieldLabel != null && pcControl.fieldLabel != "") {
		vsLabel = pcControl.fieldLabel;
	} else {
		vsLabel = pcControl.id;
	}
	
	return vsLabel;
}


/**
 * 팝업 띄우기
 * @param {cpr.controls.UIControl} pcControl
 */
function _floatPop (pcControl) {
	
	mbPop = true;
	
	var voDialogApp = _createApp();
	
	/** @type cpr.core.AppInstance */
	var voRootAppIns = moAppIns.getRootAppInstance();
	
	var vcTargetCtrl = null;
	var vsHeaderTitle = null;
	
	if(pcControl.type == "combobox") {
		vcTargetCtrl = pcControl;
		var control = pcControl.getAppInstance().lookup(pcControl.fieldLabel);
		if(control) {
			vsHeaderTitle = control.value;
		} else {
			vsHeaderTitle = pcControl.fieldLabel;
		}
	} else {
		vcTargetCtrl = moAppIns.lookup(_getTargetComboId(pcControl));
		var control = pcControl.getAppInstance().lookup(vcTargetCtrl.fieldLabel);
		if(control) {
			vsHeaderTitle = control.value;
		} else {
			vsHeaderTitle = vcTargetCtrl.fieldLabel;
		}
	}
	
	if(vsHeaderTitle == null) {
		vsHeaderTitle = msTempHeaderTitle;
	}
	
	// 타겟 컨테이너 지정 추가 (dyseo, 20211203 추가)
	if(vcTargetCtrl.userAttr(ATTR_TARGET_COMBO_GROUP_ID) != "") {
		var vsAttrValue = vcTargetCtrl.userAttr(ATTR_TARGET_COMBO_GROUP_ID);
		
		voRootAppIns = moAppIns.lookup(vsAttrValue);
		
		if(voRootAppIns == null) {
			voRootAppIns = vsAttrValue == "app" ? moAppIns : moAppIns.getRootAppInstance();
		}	
	}
	
	// TODO 다이얼로그 관련 설정 변경
	// 다이얼로그 사이즈 width, height 변경
	voRootAppIns.dialogManager.openDialog(voDialogApp, msDialogName, moPopSize, function(/* cpr.controls.Dialog */ dialog){
		dialog.headerTitle = vsHeaderTitle;
		dialog.initValue = pcControl;
		dialog.resizable = false;
		dialog.headerMovable = false;
		dialog.headerClose = false;
		
		// 다이얼로그 스타일
		dialog.style.addClass(msDialogCls);
		dialog.style.overlay.addClass(msDialogOverlayCls);
		dialog.style.css("min-height", "0px");
		
		dialog.addEventListener("overlay-click", function(e){
			dialog.close();
		});
		
		dialog.addEventListener("init", function(e){
			dialog.getEmbeddedAppInstance().getContainer().getLayout().scrollable = false;
		});
		
		dialog.addEventListener("transitionend", function(e){
			dialog.getEmbeddedAppInstance().getContainer().getLayout().scrollable = true;
			dialog.redraw();
		});
		
		// TODO 다이얼로그가 닫힐 때 발생하는 이벤트
		dialog.addEventListenerOnce("close", function(e){
			var returnValue = e.control.returnValue ;
			
			// TODO 팝업에서 선택한 값(returnValue) 저장
			if (returnValue) {
				
				// 콤보박스의 상위컨트롤이 그리드인 경우, 그리드 내 콤보박스 셀에 returnValue 저장
				if(vcTargetCtrl.getParent().type == "grid") {
					
					/** @type cpr.controls.Grid */
					var vcGrid = vcTargetCtrl.getParent();
					var vnSelectedRowIndex = vcGrid.getSelectedRowIndex();
		
					var voDetail = vcGrid.detail;
					for(var idx = 0; idx < voDetail.cellCount; idx++) {
						if(voDetail.getControl(idx) ==vcTargetCtrl) {
							vcGrid.setCellValue(vnSelectedRowIndex, idx, returnValue);
						}		
					}
				} else {
					// 콤보박스의 상위컨트롤이 그리드가 아닌경우
					vcTargetCtrl.clearSelection();

					for(var idx = 0; idx < returnValue.length; idx++) {
						vcTargetCtrl.selectItemByValue(returnValue[idx]);
					}
				}
			}
			
			mbPop = false;
			cpr.core.Platform.INSTANCE.unregister(dialog.app);
		});
	});
}

/**
 * 모바일 버전의 콤보박스 사용 여부
 * @param {Boolean} pbMobile 모바일 여부(true:모바일/false:데스크탑)
 * @param {Boolean} pbScrollButton? 모바일버전-스크롤 버튼 사용 여부 (default:false)
 * @param {Boolean} pbScrollStyle? 모바일버전-스크롤 스타일(box-shadow)사용여부 (default:false)
 */
globals.setComboPopMobile = function(pbMobile, pbScrollButton, pbScrollStyle) {
	_setMobile(pbMobile, pbScrollButton, pbScrollStyle);
}


/**
 * 모바일/데스크탑 기준 size,colcount 설정
 * @param {Boolean} pbMobile 모바일 여부(true:모바일/false:데스크탑)
 * @param {Boolean} pbScrollButton? 모바일버전-스크롤 버튼 사용 여부 (default:false)
 * @param {Boolean} pbScrollStyle? 모바일버전-스크롤 스타일(box-shadow)사용여부 (default:false)
 */
function _setMobile (pbMobile, pbScrollButton, pbScrollStyle) {
	mbMobile = pbMobile;
	
	if(pbMobile) {
		// tablet, mobile 화면일 경우
		mnColCount = mnMblColCount;
		moPopSize = moMblPopSize;
		mnList = mnMblItemList;
		
		if(pbScrollButton != null) {
			mbScrollButton = pbScrollButton;
		}
		
		if(pbScrollStyle != null) {
			mbScrollStyle = pbScrollStyle
		}
	} else {
		// default 화면일 경우
		mnColCount = mnDftColCount;
		moPopSize = moDftPopSize;
		mnList = mnDftItemList;
	}
}

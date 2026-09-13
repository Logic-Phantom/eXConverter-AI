/************************************************
 * event.module.js
 * Created at 2021. 10. 15 오후 4:56:54.
 *
 * @author
 ************************************************/

/**
 * 앱 init시 처리로직 담당 변수
 * - 반응형 작업
 */
var AppInitTask = {
	vaCtl : null, //대상컨트롤
	
	init : function(){
		var that = this;
		
		cpr.events.EventBus.INSTANCE.addFilter("init", function(e){
			if(e.control instanceof cpr.core.AppInstance){
				
				/** @type cpr.core.AppInstance */
				var appInstance = e.control;			
				that.vaCtl = appInstance.getContainer().getAllRecursiveChildren(true);
				
				/* 커스텀 옵션 : 전체 화면에 대한 기능버튼 그룹이 하단에 배치하여 플로팅 할 경우*/
				//that.FloatFooter.run(e);
				
				/* 커스텀 옵션 : 반응형 모듈 적용*/
				that.Responsive.run(e);
			}
		});
	},
	
	FloatFooter : {
		constants : {},
		run : function(e){
			if(!(e.control instanceof cpr.core.AppInstance)) return;
			
			var targetApp = e.control;
			var footer = targetApp.lookup("grpFooter");
			if(footer){
				targetApp.floatControl(footer, {
					bottom : 0,
					left : 0,
					right : 0,
					height : "40px" // 그룹의 height		
				});
			}
		}
	},
	
	Responsive : {
				
		run : function(e){
			if(!(e.control instanceof cpr.core.AppInstance)) return;
			
			/** @type cpr.core.AppInstance */
			var appInstance = e.control;
			var that = this;
			var vaCtl = AppInitTask.vaCtl;
			vaCtl.some(function(each){
				
				/* 폼 레이아웃,버티컬 레이아웃 반응형 처리*/
				if (each instanceof cpr.controls.Container) {
					if (each.getLayout() instanceof cpr.controls.layouts.FormLayout && (each.userAttr("mobile-column-count") != "" || each.userAttr("tablet-column-count") != "")) {
						var rForm = makeResponsive(each);
						
						each["_RForm"] = rForm;
						rForm.setColumnSettings(rForm._screenNms.mobile, parseInt(each.userAttr(rForm.ATTR_NM.ATTR_MOBILE_COLUMN_COUNT) || "0"));
						rForm.setColumnSettings(rForm._screenNms.tablet, parseInt(each.userAttr(rForm.ATTR_NM.ATTR_TABLET_COLUMN_COUNT) || "0"));
						rForm.start();
					} else if(each.getLayout() instanceof cpr.controls.layouts.VerticalLayout && (each.userAttr("mobile-fit") || each.userAttr("tablet-fit"))){
						var rVertical = makeVResponsive(each);
						each["_RVertical"] = rVertical;
						rVertical.start();
					}
				}
				
				/* 그리드, 탭 반응형 처리*/
				if(each instanceof cpr.controls.Grid && each.userAttr("transform-on-mobile") != ""){
					var rGrid = makeResponsiveGrid(each);
					each["_RGrid"] = rGrid;
				} else if(each instanceof cpr.controls.TabFolder && each.userAttr("transform-on-mobile") != ""){
					var rTab = makeResponsiveTab(each);
					each["_RTab"] = rTab;
				}
			});
		}
	}
}

/**
 * 인풋박스 공통 이벤트처리 담당 변수
 */
var InputBoxInitTask = {
	init : function(){
		var that = this;
		cpr.events.EventBus.INSTANCE.addFilter("before-value-change", function(e){
			that.CaseTransform.run(e);
		});
	},
	
	CaseTransform : {
		run : function(e){
			// 이벤트를 발생 시킨 컨트롤
		    var control = e.control;
		    
		    // 이벤트 발송자가 인풋박스이면.
		    if (control.type === "inputbox") {
		    	var inputLetter = control.userAttr("inputLetter");
				if (inputLetter == "uppercase") {
					if (/[a-z]/g.test(e.newValue)) {
						var newValue = e.newValue.toUpperCase();
						control.value = newValue;
						e.preventDefault();
						e.stopPropagation();
					}
				} else if (inputLetter == "lowercase") {
					if (/[A-Z]/g.test(e.newValue)) {
						var newValue = e.newValue.toLowerCase();
						control.value = newValue;
						e.preventDefault();
						e.stopPropagation();
					}
				}
		    }
		}
	}
}

/**
 * 그리드 기능별 ui처리 담당변수
 */
var GridInitTask = {
	
	init : function(){
		var that = this;
		
		// 모든 selection-change 이벤트시 그리드에 대한  필터 추가(for. 그리드의 선택된 로우가 없을 경우 이벤트 전파 차단)
		cpr.events.EventBus.INSTANCE.addFilter("selection-change", function(e){
			that.ValidateSelection.run(e);
		});
		
		// 모든 before-selection-change 이벤트에시 그리드에 대한  필터만 추가.(for. 그리드의 선택된 로우가 없을 경우 이벤트 전파 차단)
		cpr.events.EventBus.INSTANCE.addFilter("before-selection-change", function(e){
			that.ValidateBeforeSelection.run(e);
		});
	},
	ValidateSelection : {
		run : function(e){
			 // 이벤트를 발생 시킨 컨트롤
		    var control = e.control;
		    /** @type cpr.core.AppInstance */
		    var _app = control.getAppInstance();
		    
		    // 이벤트 발송자가 그리드 이고.
		    if (control instanceof cpr.controls.Grid) {
		    	/** @type cpr.controls.Grid */
		    	var grid = control;
		    	if(grid.selectionUnit == "cell" && grid.getSelectedIndices()[0] == null){
		    		 e.stopPropagation();
		    	}else{
		    		var rowIndex = grid.selectionUnit != "cell" ? grid.getSelectedRowIndex() : grid.getSelectedIndices()[0]["rowIndex"];
			        // 그리드 선택 ROW가 -1이라면...
			        if (rowIndex < 0) {
			            // 이벤트 전파를 차단시킵니다.
			            e.stopPropagation();
			        }
		    	}
		    }
		}
	},
	ValidateBeforeSelection : {
		run : function(e){
			// 이벤트를 발생 시킨 컨트롤
		    var control = e.control;
		    /** @type cpr.core.AppInstance */
		    var _app = control.getAppInstance();
		    
		    // 이벤트 발송자가 그리드 이고.
		    if (control instanceof cpr.controls.Grid) {
		    	// 테스트 화면의 경우 이벤트 적용 안함
		    	if(e.newSelection[0] == null || e.newSelection[0] == undefined){
		    		// 이벤트 전파를 차단시킵니다.
		            e.stopPropagation();
				}
		    }
		}
	}
}

/**
 * Tab Key를 사용하여 tabIndex를 포커스로 명확히 표시하는 기능 
 */
var KeyFocusEventTask = {
	init : function(){
		
		cpr.events.EventBus.INSTANCE.addFilter("keydown", function( /* cpr.events.CKeyboardEvent*/ e) {
			// 탭 키가 눌리면 키보드 포커스 스타일 시트를 활성화 함.
			if (e.key == "Tab") {
				var keyBoardCssLink = document.querySelector("head link[href*=\"focus.keyboard.css\"]");
				if(keyBoardCssLink){
					keyBoardCssLink.removeAttribute("disabled");	
				}
			}
		});
	
		cpr.events.EventBus.INSTANCE.addFilter("mousedown", function(e) {
			// 마우스가 클릭디면 키보드 포커스 스타일 시트를 비활성화 함.
			var keyBoardCssLink = document.querySelector("head link[href*=\"focus.keyboard.css\"]");
			if(keyBoardCssLink){
				keyBoardCssLink.setAttribute("disabled", true);	
			}
		});
	}
}

AppInitTask.init();
InputBoxInitTask.init();
GridInitTask.init();
//KeyFocusEventTask.init();
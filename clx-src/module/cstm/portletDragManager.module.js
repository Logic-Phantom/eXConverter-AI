/************************************************
 * hansCustom.module.js
 * Created at 2020. 2. 19. 오전 10:25:50.
 * 
 * Version 1.2
 * Updated Date : 2021-07-06
 * 
 * @author HANS
 ************************************************/

/*
 * 본 모듈은 폼 레이아웃 내에서 사용자가 구획을 드래그 앤 드랍하여 포틀릿의 특성을 구현하기 위해서 만들어진 공통 모듈입니다.
 * 포틀릿을 구현한 뒤 개인화를 위해 쿠키에 저장하여 관리할 수 있습니다.
 * 
 * [사용법]
 * 로드되는 모든 화면에 대해서 이벤트 캐치를 하지 않습니다.
 * 따라서 각 화면의 BodyLoad시점에서 글로벌 함수 출판된 createDragManager를 사용하고 사용자속성을 정의합니다.
 * 개인화를 하기위해서는 글로벌 함수로 출판된 portletIndividual을 사용합니다. 
 * 개인화와 관련된 함수는 글로벌 함수인 portletIndividual의 하위에 속해있습니다.
 * 
 * 1. 포틀릿을 적용할 그룹(폼레이아웃일때만 가능)을 선택한 뒤, 선택한 그룹의 사용자 속성으로 portlet 을 정의하고 값은 Y로 지정합니다.
 * 2. 해당 포틀릿이 한 화면에서 하나의 폼 레이아웃에서만 사용하는게 아닐 경우가 있을 수 있기 때문에, dataType이라는 사용자 속성을 사용하여 드래그소스,
 * 	   드랍타겟에 대한 범위를 제한할 수 있습니다. (단, dataType속성에 대한 값은 unique해야 합니다.)
 * 3. 화면이 로딩되었을 때, onBodyLoad이벤트리스너에서 출판된 메서드 createDragManager를 호출합니다.
 * 4. 드래그앤드랍을 빈공간에 할 경우, 타겟컨트롤이 없는경우에는 드랍이 불가능합니다.
 *     따라서 해당 구획에는 빈 그룹을 배치해야 가능합니다.
 * 
 * [사용가능한 메서드]
 * 1. createDragManager : 드래그앤드롭을 시작합니다.
 * 2. removeDragManager : 드래그앤드롭 객체를 삭제합니다.
 * 3. setDragManagerStop : 전체 포틀릿 적용을 해제합니다.
 * 4. setResizePortlet : 포틀릿을 확대/축소합니다. (마우스가 눌린 시점부터 발생하기 때문에 mouseDown 이벤트리스너에서 호출하여 사용합니다.)
 * 5. setCookie : 쿠키를 생성합니다.
 * 6. getCookie : 쿠키를 반환합니다. 반환되는 쿠키는 포틀릿의 constraint 형식으로 반환됩니다.
 * 7. deketeCookie : 쿠키를 삭제합니다.
 */


/************************************************
 * 사용자 설정가능 멤버변수
 ************************************************/
/**
 * 포틀릿 적용 여부
 * @type {Boolean}
 */
var mbDraggable = true;

/**
 *  소스컨트롤 확대 및 축소 여부
 * @type {Boolean}
 */
var mbResize = false;

/**
 * 포틀릿 위치 고정
 * 컨트롤의 우측 상단에서만 포틀릿이 가능합니다.
 * @type {Boolean}
 */
var mbPosFix = false;

/**
 * 중복컨트롤에 대해 포틀릿 이동 및 확대/축소 적용여부
 * true 일 경우에 컨트롤 중복을 피합니다.
 * @type {Boolean}
 */
var mbPermitDupl = true; 

/**
 * 드래그 시 row증가 여부
 * @type {Boolean}
 */
var mbIncreaseRow = false;

/**
 * 드래그앤드롭 시, 소스컨트롤 크기유지 여부 
 * @type {Boolean}
 */
var mbDropOrginSize = true; 

/**
 * 타겟 컨트롤 스타일
 */
var maTargetStyle = {
	"box-shadow" : "0 3px 12px 1px rgba(44,55,130,0.15)",
}

/**
 * 사용자 속성 (portlet)
 * 포틀릿 사용 여부
 * @type {String}
 */
var ATTR_USE_PORTLET = "portlet"; 

/**
 * 사용자 속성 (dataType) 
 * 포틀릿 영역 지정 시 사용
 * @type {String}
 */
var ATTR_DATA_TYPE = "dataType";

/**
 * 피드백(드래그 시 플로팅 되는 컨트롤) 인라인 스타일
 */
var maFeedbackStyle = {
	"opacity" : "0.8",
	"border": "solid 1px red",
	"text-align" : "center",
	"color" : "black",
	"border-radius": "10px",
	"background": "white",
	"box-shadow": "0px 2px 10px #ddd",
	"transition" : "all 0s ease-in-out",
	"cursor": "se-resize"
};

/**
 * 피드백(드래그 시 플로팅 되는 컨트롤) 스타일 클래스
 * @type {String}
 */
var msFeedbackCls = "feedback";

/**
 * mbPosFix 가 true 일 때 
 * portlet 이 가능한 영역 사이즈 (컨트롤 우측 위)
 * @type {Number}
 */
var mnFixArrange = 20;

/**
 * mbPosFix 가 true 일 때
 * portlet이 가능한 영역을 보이기 위한 스타일 클래스
 * @type {String}
 */
var msFixCls = "ctrl-span";

/************************************************
 * 내부 시스템 멤버변수 (변경X)
 ************************************************/
/**
 * 드래그 할 때 플로팅되는 컨트롤
 * @type {cpr.controls.Output}
 */
var mcFeedback;

/**
 * 드래그 소스 배열
 * @type {cpr.controls.DragSource[]}
 */
var maDragSource = []; 

/**
 * 드롭타겟 배열
 * @type {cpr.controls.DropTarget[]}
 */
var maDropTarget =[]; 

/**
 * 드래그의 이동량
 * @type {cpr.geometry.Dimension}
 */
var maDragDelta = null;


/************************************************
 * API
 ************************************************/
/**
 * 드래그 시작하는 메서드
 * @param {cpr.core.AppInstance} app 앱인스턴스
 * @param {Boolean} pbPermitDupl? 드래그앤드롭 시 아이템간 중복 시 드롭여부(true:중복된 아이템과 위치 스위칭, false : 드롭방지), default true
 * @param {Boolean} pbIncRow? 드래그 시 마지막 행 기준 한 행 추가여부(true/false), default false
 * @param {Boolean} pbDrpOrgSz? 드래그앤드롭 시 소스컨트롤 크기유지 여부(true/false) default true
 */
function createDragManager(app, pbPermitDupl, pbIncRow, pbDrpOrgSz){
	
	/* 드래그앤드롭시 중복허용 */
	if(pbPermitDupl != null) {
		mbPermitDupl = pbPermitDupl;
	}
	
	/*. 드래그 시 한 행씩 추가 */
	if(pbIncRow != null) {
		mbIncreaseRow = pbIncRow;
	}
	
	/* 드래그앤드롭시 소스컨트롤 크기유지 */
	if(pbDrpOrgSz != null) {
		mbDropOrginSize = pbDrpOrgSz;
	}
	
	var voApp = app;
	var voContainer = voApp.getContainer();
	
	var vaRecursiveCtrls = voContainer.getAllRecursiveChildren();
	var vaDraggableContainers = vaRecursiveCtrls.filter(function(each){
		if (each.userAttr(ATTR_USE_PORTLET)== "Y") {
			return each;
		}
	});

	vaDraggableContainers.forEach(function(/** cpr.controls.Container*/each){
			var vsDataType = each.userAttr(ATTR_DATA_TYPE);
			each.getChildren().forEach(function(eachs){
				if(eachs.userAttr("isAlready") == "") {
					eachs.userAttr("isAlready","Y");
					_createDragSource(voApp, eachs, vsDataType);
				}
		});
		_createDropTarget(each, vsDataType);
	});

}

/**
 * 특정 그룹의 드래그앤드롭 속성을 삭제합니다.
 * @param {cpr.controls.Container} pcContainer
 */
function removeDragManager(pcContainer) {

	if(pcContainer) {
		var vaRecursiveCtrls = pcContainer.getChildren();
		vaRecursiveCtrls.forEach(function(each){
			each.removeUserAttr("isAlready");
		});
		
		var vsDataType = pcContainer.userAttr(ATTR_DATA_TYPE);
		maDragSource.forEach(function(each,idx){
			if(each.dataType == vsDataType) {
				maDragSource[idx].dispose();
			}
		});
		
		maDropTarget.forEach(function(each, idx){
			var vcCtrl = each.control;
			if(vcCtrl && vcCtrl.userAttr(ATTR_DATA_TYPE) == vsDataType) {
				maDropTarget[idx].dispose();
			}
		});
	}

}

/**
 * 전체화면의 포틀릿 적용 여부를 저장합니다.
 * @param {Boolean} pbDrag
 */
function setDragManagerStop(pbDrag){
	mbDraggable = pbDrag;
}

/**
 * 포틀릿 특성이 적용되어 있을 때, 선택한 컨트롤의 확대/축소 여부를 저장합니다.
 * @param {Boolean} pbResize
 */
function setResizePortlet(pbResize) {
	mbResize = pbResize;
}

/**
 * 포틀릿을 드래그 앤 드롭할 위치를 고정합니다.
 * @param {Boolean} pbFix
 */
function setPotletPosFix (pbFix) {
	mbPosFix = pbFix;
	
	if(mbPosFix) {
		// 드래그 가능한 영역 생성
		if(maDragSource.length > 0) {
			maDragSource.forEach(function(each){
				var control = each.control
				if(control) control.style.addClass(msFixCls);
			});
		}
	} else {
		// 드래그 영역 삭제
		if(maDragSource.length > 0) {
			maDragSource.forEach(function(each){
				var control = each.control
				if(control) control.style.removeClass(msFixCls);
			});
		}
	}
}


/************************************************
 * 내부 함수
 ************************************************/
/**
 * 드래그소스를 만들어주는 함수
 * @param {cpr.core.AppInstance} app
 * @param {cpr.controls.UIControl} pcDragCtrl
 * @param {String} psDataType
 */
function _createDragSource(app, pcDragCtrl, psDataType) {
	
	var voRootApp = app.getRootAppInstance();
	var vnIncreateIndex = true;
	
	var dragSource = new cpr.controls.DragSource(pcDragCtrl, {
		options: {
			dataType: psDataType,
			threadhold: 10, // 10px만큼 이동해야 드래그시작으로 인식
		},
		
		onBeforeDragStart: function(context){
			if(mbPosFix && !mbResize) {
				var voActualRect = context.source.control.getActualRect();
				var voStartLoc = context.dragStartLocation;
				if(voStartLoc.x <= (voActualRect.right - mnFixArrange) || voStartLoc.y >= (voActualRect.top + mnFixArrange)) {
					context.cancel();
				}
			}	
		},
		
		onDragStart: function(context) {
			
			if (mbDraggable) {
				if(context.source.control.type == "container" && context.source.control.getChildrenCount() == 0) {
					context.cancel();
				} else {
					var actualRect = pcDragCtrl.getActualRect();
					pcDragCtrl.style.css("opacity", " 0.5");
	
					if (mbResize == true) {
						// Span
						context.cursor = "se-resize";
						mcFeedback = _createDragSourceFeedback(actualRect, pcDragCtrl.getParent());
						voRootApp.floatControl(mcFeedback, actualRect);
					} else {
						// Drag
						context.cursor = "grabbing";
						mcFeedback = _createDragSourceFeedback(actualRect, pcDragCtrl.getParent());
						var newActualRect = actualRect.getTranslated(context.dragDelta);
						voRootApp.floatControl(mcFeedback, cpr.controls.layouts.XYLayout.createConstraintWithRect(newActualRect));
					}
				}

			} else {
				context.cancel();
			}
		},
		onDragMove: function(context) {
			
			var actualRect = context.source.control.getActualRect();

			if (mbResize == true) {
				// Span
				context.cursor = "se-resize";
				maDragDelta = context.dragDelta;

				var voFloatConstraint = _getDragDirection(actualRect, pcDragCtrl);
				voRootApp.floatControl(mcFeedback, voFloatConstraint);
			} else {
				// Drag
				context.cursor = "grabbing";
				var newRect = actualRect.getTranslated(context.dragDelta);
				voRootApp.floatControl(mcFeedback, cpr.controls.layouts.XYLayout.createConstraintWithRect(newRect));
				
				if(mbIncreaseRow== true) {
					var vcParent = pcDragCtrl.getParent();
					var voLayout = vcParent.getLayout();
					var voRow = voLayout.getRows();
					var voColumn = voLayout.getColumns();
				
					if(context.target == null) {
						var vnChildCount = vcParent.getChildrenCount();
						var voLastChildRect = voLayout.getChildrenByLayoutOrder()[vnChildCount-1].getActualRect();
						var voFeedbackRect= mcFeedback.getActualRect();
						
						/* 아래로 드래그시 새로운 행 추가 */
						if(voFeedbackRect.bottom > voLastChildRect.bottom && context.dragDelta.height > 0) {
							if(vnIncreateIndex == true) {
								voRow.push("1fr");
								voLayout.setRows(voRow);
								vcParent.setLayout(voLayout);
								
								vnIncreateIndex = false;
							}
						}
						createDragManager(app, mbPermitDupl);
					}
				}
			}
		},
		onDragEnd: function(context) {
			
			if (mbResize == true && context.target) { // Span
				_setFormSpan(pcDragCtrl);
			}
			
			// 마지막 row에 아무런 아이템이 없을경우 삭제
			if(mbIncreaseRow) {
				_removeBlankRow(pcDragCtrl);
			}

			context.cursor = "";
			mcFeedback.dispose();
			mcFeedback = null;
			pcDragCtrl.style.removeStyle("opacity");
			
			mbResize = false;
			vnIncreateIndex = true;
		}
	});

	maDragSource.push(dragSource);
}


/**
 * 드래그소스의 부모객체를받아와서 부모객체에 드랍타겟을 만들어주는 함수
 * @param {cpr.controls.Container} pcCtrlDrop
 * @param {String} psDataType
 */
function _createDropTarget(pcCtrlDrop, psDataType) {

	var vcContainer = pcCtrlDrop;
	var voParentLayout = vcContainer.getLayout();
	
	var vcDropFeedback = null;
	function getDropFeedback () {
		if(vcDropFeedback == null) {
			vcDropFeedback = new cpr.controls.Output();
			vcDropFeedback.style.css("box-shadow", maTargetStyle["box-shadow"]);
		}
		return vcDropFeedback;
	}
	
	function hideDropFeedback () {
		if (vcDropFeedback) {
			vcDropFeedback.dispose();
			vcDropFeedback = null;
		}
	}
	
	/* 드래그 시 컨트롤의 rowIndex 위치 */
	var vnDragRowIndex = null;
	
	/* 드래그 시 컨트롤의 colIndex 위치 */
	var vnDragColIndex = null;
	
	var dropTarget = new cpr.controls.DropTarget(vcContainer, {
		isImportant: function(source) {
			return source.dataType == psDataType;
		},
		onDragMove: function(context) {
			var reference = voParentLayout.getInsertionReference(context.pointerLocation);

			var voSourceCtrlRect = vcContainer.getConstraint(context.source.control);
			reference.rowSpan = voSourceCtrlRect.rowSpan ?  voSourceCtrlRect.rowSpan : 1;
			reference.colSpan = voSourceCtrlRect.colSpan ?  voSourceCtrlRect.colSpan : 1;
			
			if(vnDragRowIndex == null) {
				vnDragRowIndex = reference.rowIndex - voSourceCtrlRect.rowIndex;
			}
			if(vnDragColIndex == null) {
				vnDragColIndex = reference.colIndex - voSourceCtrlRect.colIndex;
			}
			reference.rowIndex -= vnDragRowIndex;
			reference.colIndex -= vnDragColIndex;
			
			if (mbResize == false && reference) {
				vcContainer.addChild(getDropFeedback(), reference);
			} else {
				hideDropFeedback();
			}
		},
		onDragLeave: function(context) {
			hideDropFeedback();
		},
		onDrop: function(context) {
			
			if (mbResize == false) { 
				
				// 타겟 스타일 변경
				hideDropFeedback();
				
				// Drag 일 경우에만 변경되 위치로 드롭
				var voSourceCtrlRect = vcContainer.getConstraint(context.source.control);
				var insertionReference = voParentLayout.getInsertionReference(context.pointerLocation);
				insertionReference.rowSpan = voSourceCtrlRect.rowSpan ?  voSourceCtrlRect.rowSpan : 1;
				insertionReference.colSpan = voSourceCtrlRect.colSpan ?  voSourceCtrlRect.colSpan : 1;
			
				//2020-06-15 추가
				insertionReference.rowIndex -= vnDragRowIndex;
				insertionReference.colIndex -= vnDragColIndex;
			
				var vcTargetCtrl = voParentLayout.findControls(insertionReference).filter(function(each) {
					// 자기자신은 타겟에서 제외
					return each != context.source.control;
				})
				var voTargetCtrlRect = vcTargetCtrl.length > 0 ? vcContainer.getConstraint(vcTargetCtrl[0]) : insertionReference;
				
				voSourceCtrlRect.rowSpan = voSourceCtrlRect.rowSpan? voSourceCtrlRect.rowSpan : 1;
				voSourceCtrlRect.colSpan = voSourceCtrlRect.colSpan? voSourceCtrlRect.colSpan : 1;
				voTargetCtrlRect.rowSpan = voTargetCtrlRect.rowSpan? voTargetCtrlRect.rowSpan : 1;
				voTargetCtrlRect.colSpan = voTargetCtrlRect.colSpan? voTargetCtrlRect.colSpan : 1;
				
				if(mbPermitDupl == true) {
					
					/* 중복허용 - 위치 스위칭 */
					if(mbDropOrginSize == true) {
						// 소스 크기만큼 이동
						
						// TODO 영역이동 시, 겹치는 아이템의 위치를 이동하십시오.
						
						// 소스컨트롤을 이동한 위치가 이동영역 안 일경우에만 constraint 변경
						if( insertionReference.rowIndex + insertionReference.rowSpan  <= voParentLayout.getRows().length && 
							insertionReference.colIndex + insertionReference.colSpan  <= voParentLayout.getColumns().length) {
							
							// 넓힌 영역에 겹치는 아이템 유무 확인(소스컨트롤 제외)
							var targetConst = {
								rowIndex : voTargetCtrlRect.rowIndex,
								colIndex : voTargetCtrlRect.colIndex,
								rowSpan : voSourceCtrlRect.rowSpan,
								colSpan : voSourceCtrlRect.colSpan
							}
							
							var voDuplCtrl = vcTargetCtrl.filter(function(each){
								if(each != context.source.control &&
									 (voSourceCtrlRect.rowSpan != voTargetCtrlRect.rowSpan ||  voSourceCtrlRect.colSpan != voTargetCtrlRect.colSpan)) { // 크기가 다를경우엔 드래그앤드롭방지
									if(each.type == "container" && each.getChildrenCount() == 0) {
										return;
									}
									return each;
								}
							});
							
							if(voDuplCtrl.length == 0) {
								if(vcTargetCtrl.length > 0) {
									// source 위치 이동
									vcContainer.updateConstraint(context.source.control, targetConst);
	
									// target 위치 이동
									vcContainer.updateConstraint(vcTargetCtrl[0],{
										rowIndex : voSourceCtrlRect.rowIndex,
										colIndex : voSourceCtrlRect.colIndex,
										rowSpan : voTargetCtrlRect.rowSpan,
										colSpan : voTargetCtrlRect.colSpan
									});
								} else {
									vcContainer.updateConstraint(context.source.control, targetConst);
								}
								
							} else {	
								alert("컨트롤 간 크기가 다르면 이동이 불가능합니다.")
							}
						}
						
					} else {
						// 타겟 크기만큼 이동
						vcContainer.updateConstraint(context.source.control,_checkConstraint(voTargetCtrlRect));
						vcContainer.updateConstraint(vcTargetCtrl[0],_checkConstraint(voSourceCtrlRect));
					}
				} else {
					
					/* 중복미허용 - 드롭방지 */
					if(vcTargetCtrl.length == 0) {
						var voUpdateConstraint = {
							rowIndex : voTargetCtrlRect.rowIndex,
							colIndex : voTargetCtrlRect.colIndex,
							rowSpan : voSourceCtrlRect.rowSpan? voSourceCtrlRect.rowSpan : 1,
							colSpan : voSourceCtrlRect.colSpan? voSourceCtrlRect.colSpan : 1
						};
						
						// 넓힌 영역에 겹치는 아이템 유무 확인(소스컨트롤 제외)
						var voDuplCtrl = vcContainer.getLayout().findControls(voUpdateConstraint).filter(function(each){
							if(each.type != "container" && each != context.source.control) {
								return each;
							}
						});
						
						if(voDuplCtrl.length == 0 && 
							voUpdateConstraint.rowIndex + voSourceCtrlRect.rowSpan  <= vcContainer.getLayout().getRows().length &&  
							voUpdateConstraint.colIndex + voSourceCtrlRect.colSpan  <= vcContainer.getLayout().getColumns().length) {
								// 드롭간능 영역 중, 중복되는 아이템이 없을 경우에만 드롭
								vcContainer.updateConstraint(context.source.control, voUpdateConstraint); 
								vcContainer.updateConstraint(vcTargetCtrl[0], _checkConstraint(voSourceCtrlRect)); 
						}
					} else {
						alert("컨트롤 간 위치변경이 불가능 합니다.");
					}
				}
			}
			
			vnDragRowIndex = null;
			vnDragColIndex = null;
		}
	});
	
	maDropTarget.push(dropTarget);
}


/**
 * 이동하고자하는 영역을 잡고 마우스를 드래그할 때 구획에 대한 피드백을 제공하는 함수입니다.
 * @param {cpr.geometry.Rectangle} voRect
 * @param {cpr.controls.Container} pcParent
 * @returns {cpr.controls.UIControl} feedbacks
 */
function _createDragSourceFeedback(voRect, pcParent){
	
	var voParentRect = pcParent.getActualRect();
	var voRow = pcParent.getLayout().getRows();
	var vnColLen = pcParent.getLayout().getColumns().length;
	
	var feedback = new cpr.controls.Output("feedback");
	feedback.style.css(maFeedbackStyle);
	
	// TODO 플로팅 되는 스타일을 클래스로 지정하기 위해서 아래의 코드를 사용하십시오.
	feedback.style.addClass(msFeedbackCls);

	return feedback;
}


/**
 * 전달받은 Constraint에서 rowSpan과 colSpan에 기본값을 넣어주기 위한 함수입니다.
 * @param {cpr.controls.layouts.FormConstraint} poConstraint
 * @returns {cpr.controls.layouts.FormConstraint} constraint
 */
function _checkConstraint(poConstraint){
	
	var constraint = {
		"rowIndex" : poConstraint.rowIndex,
		"colIndex" : poConstraint.colIndex,
		"rowSpan" : poConstraint.rowSpan ? poConstraint.rowSpan : 1,
		"colSpan" : poConstraint.colSpan ? poConstraint.colSpan : 1
	}

	return constraint;
}


/**
 * 이동이 끝났을 때 마지막 행이 모두 비어있을 경우 삭제합니다.
 * @param {cpr.controls.UIControl} pcDragCtrl
 */
function _removeBlankRow (pcDragCtrl) {
	
	/** @type cpr.controls.layouts.FormLayout */
	var voLayout = pcDragCtrl.getParent().getLayout();
	var voRows = voLayout.getRows();
	var voColumns = voLayout.getColumns();

	var vaPortletCtrl = pcDragCtrl.getParent().getChildren().filter(function(each) {
	    if (!(each.type == "container" && each.getChildrenCount() == 0)) {
	        return each;
	    }
	});
	
	var voFindCtrls = [];
	for(var i = 0; i < voColumns.length; i++){
		var vcCtrl = voLayout.findControls({
			rowIndex : voRows.length-1,
			colIndex : i
		});
		if(vcCtrl.length == 1) {
			if(vcCtrl[0].type == "container" && vcCtrl[0].getChildrenCount() == 0) {
				voFindCtrls.push(vcCtrl);
			}
		}
	}

	if(voFindCtrls.length == voColumns.length) {
		voRows.splice(voRows.length-1, 1);
		voFindCtrls.forEach(function(each){
			pcDragCtrl.getParent().removeChild(each[0], true);
		});
	}
	
	/* 변경된 레이아웃 설정*/
	voLayout.setRows(voRows);
	pcDragCtrl.getParent().setLayout(voLayout);
}


/**
 * 드래그 플로팅 constraint
 * @param {cpr.geometry.Rectangle} poSourceRect
 * @param {cpr.controls.UIControl} pcDragCtrl
 * @return {cpr.controls.layouts.Constraint} constraint
 */
function _getDragDirection (poSourceRect, pcDragCtrl) {
	
	var vcParent = pcDragCtrl.getParent();
	var voConstraint = vcParent.getConstraint(pcDragCtrl);
	
	var vsTop = poSourceRect.top + "px";
	var vsLeft = poSourceRect.left + "px";
	var vsWidth = (poSourceRect.width + maDragDelta.width) + "px";
	var vsHeight = (poSourceRect.height + maDragDelta.height) + "px";
	
	if(voConstraint.rowSpan > 1 || voConstraint.colSpan > 1) {
		// 확장된 영역에서 피드백 크기 감소
		vsTop = poSourceRect.top + "px";			
		vsLeft = poSourceRect.left + "px";			
		vsWidth = (poSourceRect.width + maDragDelta.width) + "px";
		vsHeight = (poSourceRect.height + maDragDelta.height) + "px";
	}

	/* 포틀릿 위치 벗어나지 않도록 영역 제한 */
	if(vsTop.split("px")[0] < vcParent.getActualRect().top) { // 위
		vsTop = vcParent.getActualRect().top + "px";
		vsHeight = mcFeedback.getActualRect().height + "px";
	}
	
	if(vsLeft.split("px")[0] < vcParent.getActualRect().left) { // 왼쪽
		vsLeft = vcParent.getActualRect().left + "px";
		vsWidth = mcFeedback.getActualRect().width + "px";
	} 
	
	if((parseInt(vsWidth.split("px")[0])+parseInt(vsLeft.split("px")[0])) > vcParent.getActualRect().right) { // 오른쪽
		vsWidth = (vcParent.getActualRect().right - vsLeft.split("px")[0]) + "px";
	}
	
	if((parseInt(vsHeight.split("px")[0])+parseInt(vsTop.split("px")[0])) > vcParent.getActualRect().bottom) { // 아래
		vsHeight = (vcParent.getActualRect().bottom - vsTop.split("px")[0]) + "px";
	}

	return {
		top : vsTop, 
		left : vsLeft,
		width : vsWidth,
		height : vsHeight
	};
}


/**
 * 폼레이아웃 확대/축소(span)
 * 타겟 영역의 절반 이상일 때만 확대/축소합니다.
 * 폼레이아웃의 row와 column은 모두 같은 크기로만 구성되어있어야 합니다.
 * @param {cpr.controls.Container} pcDragCtrl
 */
function _setFormSpan (pcDragCtrl) {
	
	var vcParent = pcDragCtrl.getParent();
	var voConstraint = vcParent.getConstraint(pcDragCtrl);
	var voLayout = vcParent.getLayout();

	var vnRowLen = voLayout.getRows().length;
	var vnColLen = voLayout.getColumns().length;
	var vnOneWidth = voLayout.getColumns()[0].indexOf("fr") > 0 ? vcParent.getActualRect().width / vnColLen : voLayout.getColumns()[0].split("px")[0];
	var vnOneHeight = voLayout.getRows()[0].indexOf("fr") > 0 ? vcParent.getActualRect().height / vnRowLen : voLayout.getRows()[0].split("px")[0];
	
	/* span 영역 */
	var voActualRect = pcDragCtrl.getActualRect();
	var voFeedbackRect = mcFeedback.getActualRect();
	
	// 1. rowSpan
	var vnRowSpan = parseInt(Math.round(voFeedbackRect.height / vnOneHeight));
	if(vnRowSpan == 0) vnRowSpan =1 ; 
	
	// 2. colSpan
	var vnColSpan = parseInt(Math.round(voFeedbackRect.width / vnOneWidth));
	if(vnColSpan == 0) vnColSpan =1 ; 

	// 3. rowIndex
	var vnRowIndex = voConstraint.rowIndex;
	if(voConstraint.rowSpan != vnRowSpan) {
		var vnRowDiff = voConstraint.rowSpan - vnRowSpan;
		if(maDragDelta.height < 0 && vnRowSpan > voConstraint.rowSpan) {
			vnRowIndex = vnRowIndex + vnRowDiff;
		}
	}

	// 4. colIndex
	var vnColIndex = voConstraint.colIndex;
	if(voConstraint.colSpan != vnColSpan) {
		var vnColDiff = voConstraint.colSpan - vnColSpan;
		if(maDragDelta.width < 0 && vnColSpan > voConstraint.colSpan) {
			vnColIndex = vnColIndex + vnColDiff;
		}
	}
	
	var vcDuplCtrl = voLayout.findControls({
		rowIndex: vnRowIndex,
		colIndex: vnColIndex,
		rowSpan: vnRowSpan,
		colSpan: vnColSpan
	}).filter(function(each){
		if(each.type != "container" && each != pcDragCtrl) {
			return each;
		}
	});
	
	if(vcDuplCtrl.length > 0) {
		alert("컨트롤 간 겹칠 수 없습니다.");
		return;
	}
	
	// 차트가 새로 그려질 수 있도록 삭제 후 추가
	vcParent.removeChild(pcDragCtrl);
	vcParent.addChild(pcDragCtrl, {
		rowIndex : vnRowIndex,
		colIndex : vnColIndex,
		rowSpan : vnRowSpan,
		colSpan :  vnColSpan
	});
}

/************************************************
 * 쿠키 관련 함수 (개인화)
 ************************************************/
/**
 * 개인화를 위한 쿠키설정
 */
var portletIndvdl = function () {}

/**
 * 개인화를 위한 constraint 쿠키에 저장
 * @param {cpr.core.AppInstance} app
 * @param {#container} psFormId 포틀릿 그룹 ID
 * @param {String} psExpireDate 유효기간
 */
portletIndvdl.prototype.setCookie = function(app, psFormId, psExpireDate){
	
	/** @type cpr.controls.Container */
	var vcGrpPortlet = app.lookup(psFormId);
	if(vcGrpPortlet && vcGrpPortlet.type == "container") {
		
		var voLayout = vcGrpPortlet.getLayout();
		
		var today = new Date();
		today.setDate(today.getDate() + parseInt(psExpireDate));
		
		// 1. form config
		var vsFormlayoutConfig = voLayout.getRows().length + "," + voLayout.getColumns().length;
		document.cookie = "formlayout=" + escape(vsFormlayoutConfig) + ";path=/;expires=" + today.toGMTString() + ";";
		
		// 2. constraint
		var vaConstraint = [];
		var vnIndex = 0;
		vcGrpPortlet.getChildren().forEach(function(each){
			var voEachContraint = vcGrpPortlet.getConstraint(each);
			var rowSpan = voEachContraint.rowSpan? voEachContraint.rowSpan : 1;
			var colSpan = voEachContraint.colSpan? voEachContraint.colSpan : 1;
			var vsCtrlConstraint = voEachContraint.rowIndex + "," + voEachContraint.colIndex + "," + rowSpan + "," + colSpan;
			
	
			if(each.type != "container" || (each.type == "container" && each.getChildren().length > 0)) {
				vaConstraint.splice(vnIndex, 1, vsCtrlConstraint);
			} else {
				vaConstraint.push(vsCtrlConstraint);	
			}
			vnIndex++;
		});
		
		var vaContent = "";
		for (var key in vaConstraint) {
			if(vaContent != "") {
				vaContent += ",";	
			}
			vaContent += "::" + vaConstraint[key];
		}
		document.cookie = "constraint=" + escape(vaContent) + ";path=/;expires=" + today.toGMTString() + ";";
		
		alert("포틀릿 정보가 성공적으로 저장되었습니다.");
	} else {
		alert("포틀릿이 적용된 컨트롤이 아닙니다.");
	}
}


/**
 * 쿠키확인 및 리턴
 * @param {String} psName
 * @return {Array} constraint
 */
portletIndvdl.prototype.getCookie = function(psName){

	var vsCookieArr = _getCookieByNm(psName);
	return vsCookieArr;
}


/**
 * 쿠키확인
 * @param {String} psName
 */
function _getCookieByNm(psName) {
	var cookie = document.cookie + ";";

	var voItems = cookie.split(";");
	var vnItemLen = voItems.length;
	var item = null;
	var voItemInfo = null;
	for (var i = 0; i < vnItemLen; i++) {
		item = voItems[i];
		voItemInfo = item.split("=");
		if (psName == voItemInfo[0].trim()) {
			return unescape(voItemInfo[1]);
		}
	}
}


/**
 * 쿠키에 저장된 개인화 정보를 폼레이아웃에 세팅합니다.
 * @param {cpr.core.AppInstance} app
 * @param {#container} psFormId
 */
portletIndvdl.prototype.updateConstraintByCookie = function (app, psFormId) {
	
	var vsFormlayout = this.getCookie("formlayout");
	var vsConstraint = this.getCookie("constraint");

	if(vsFormlayout == "" || vsFormlayout == null || vsConstraint == "" || vsConstraint == null) {
		alert("저장된 포틀릿 데이터가 없습니다.");
		return;
	}
	
	function setFormConfig (pnConfig) {
		
		var vaArr = [];
		for(var idx = 0; idx < pnConfig; idx++){
			vaArr.push("1fr");
		}
		return vaArr;
	}
	
	/** @type cpr.controls.Container */
	var vcGrpPortlet = app.lookup(psFormId);
	var vaChildren = vcGrpPortlet.getChildren();
	vcGrpPortlet.removeAllChildren();
	
	// 1. 폼레이아웃 구성
	var voFormLayout = vcGrpPortlet.getLayout();
	voFormLayout.setRows(setFormConfig(vsFormlayout.split(",")[0]));
	voFormLayout.setColumns(setFormConfig(vsFormlayout.split(",")[1]));
	vcGrpPortlet.setLayout(voFormLayout);
	
	// 2. 컨트롤 위치
	var vaConstraint = _getRealConstraint("constraint");
	for(var idx = 0; idx < vaConstraint.length; idx++){
		vcGrpPortlet.addChild(vaChildren[idx], vaConstraint[idx]);		
	}

	createDragManager(app, mbPermitDupl, mbIncreaseRow, mbDropOrginSize);
	
	alert("설정이 완료되었습니다.");
}

function _getRealConstraint (psName) {
	var vsCookieArr = _getCookieByNm(psName);
	var vaData = [];
	
	if(vsCookieArr) {
		var vaNames = vsCookieArr.split("::");
	
		for (var idx in vaNames) {
			if(idx != 0) {
				if(vaNames[idx].indexOf("function") != -1) break;
				vaData.push(vaNames[idx]);
			}
		}
	}
	
	var vaRealData = [];
	for(var idx = 0; idx < vaData.length; idx++){
		var voEachConstraint = vaData[idx].split(",");
		vaRealData.push({
			rowIndex : parseInt(voEachConstraint[0]),
			colIndex : parseInt(voEachConstraint[1]),
			rowSpan : parseInt(voEachConstraint[2]) ? parseInt(voEachConstraint[2]) : 1,
			colSpan : parseInt(voEachConstraint[3]) ? parseInt(voEachConstraint[3]) : 1 
		})		
	}
	
	return vaRealData;
}


/**
 * 포틀릿 정보와 관련된 쿠키를 삭제합니다.
 * 특정 쿠키만 삭제 하고싶을 경우, 삭제 할 쿠키이름을 매개변수로 전달하십시오.
 * @param {String} psName?
 */
portletIndvdl.prototype.deleteCookie = function(psName){
	var voExpireDate = new Date();
	voExpireDate.setDate(voExpireDate.getDate() - 1);
	
	if(psName) {
		var cookie = _getCookieByNm(psName);
		if(cookie) {
			document.cookie = psName + "= " + "; expires=" + voExpireDate.toGMTString() + "; path=/";
			alert("삭제되었습니다.");
		} else {
			alert("삭제 할 쿠키정보가 없습니다. (" + psName + ")" );
		}
	} else {
		document.cookie = "formlayout= " + "; expires=" + voExpireDate.toGMTString() + "; path=/";
		document.cookie = "constraint= " + "; expires=" + voExpireDate.toGMTString() + "; path=/";
		alert("포틀릿 정보가 삭제되었습니다.");
	}
}


/************************************************
 * 글로벌 출판
 ************************************************/
/* 포틀릿 */
globals.createDragManager = createDragManager;
globals.removeDragManager = removeDragManager;
globals.setDragManagerStop = setDragManagerStop;
globals.setResizePortlet = setResizePortlet;
globals.setPotletPosFix = setPotletPosFix;

/* 개인화 */
globals.portletIndividual = function() {
	return new portletIndvdl();
}

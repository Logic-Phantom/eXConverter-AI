/************************************************
 * tabToAccordion.module.js
 * Created at 2020. 8. 31. 오전 11:24:11.
 *
 * Version 1.1
 * Updated Date : 2021-04-21
 * 
 * @author daye
 ************************************************/

/*
 * 본 모듈은 탭 아이템을 아코디언의 형태로 전체 펼쳐볼 수 있는 모듈입니다.
 * 탭의 content를 한번에 볼 수 있으며, 탭아이템의 text가 Title 로 표시됩니다.
 * Title 을 클릭하면 각 content를 토글해서 볼 수 있으므로 원하는 내용만 펼쳐서 볼 수 있습니다.
 * 
 * 또한 탭폴더를 펼친 뒤, 드래그 앤 드롭으로 위치를 변경하여 볼 수 있습니다.
 * 드래그로 위치를 변경하였을 경우, 다시 탭폴더로 원복시킬때 변경된 위치대로 탭이 구성됩니다.
 * 
 * <사용방법>
 * 1. 모듈에서 제공하는 기능은 openTabFolder라는 글로벌 함수를 스크립트에서 호출해주면 사용 할 수 있습니다.
 * 글로벌 함수 호출 시 작성해야할 파라미터는 함수에 작성되어 있는 API주석을 참고해주십시오.
 * 
 * 2. 탭폴더를 펼친 후 다시 원복시키기 위해서는 revertTabfolder 라는 글로벌 함수를 호출해주시면 사용할 수 있습니다.
 * 
 */

/************************************************
 * 전역변수
 ************************************************/
/**
 * 펼치기 전 선택되어 있던 탭 아이템 인덱스
 * @type {Number}
 */
var mnSelectedIdx = 0;

/**
 * 각 그룹의 드래그 소스를 저장하는 배열
 * @type {cpr.controls.DragSource[]}
 */
var maDragSource = [];

/**
 * 각 그룹의 드롭 타겟을 저장하는 배열
 * @type {cpr.controls.DropTarget[]}
 */
var maDropTarget = [];

/**
 * 드롭타겟에서 onDragIdle에서 스크롤하는 양
 * @type {Number}
 */
var mnScrollAmount = 200;

/**
 * 드롭타겟에서 onDragIdle에서 스크롤이 이뤄질 edge 너비
 * @type {Number}
 */
var mnEdgeWidth = 60;

/**
 * 전체 그룹 스타일 클래스
 * @type {String}
 */
var msGrpBorderCls = "border-gray";

/**
 * 폼레이아웃 스타일 클래스
 * @type {String}
 */
var msGrpFormCls = "cl-form-group";

/**
 * 탭아이템 텍스트(아웃풋) 스타일 클래스 
 * @type {String}
 */
var msTitleCls = "cursor-pointer";

/**
 * 드래그 영영 스타일 클래스  
 * @type {String}
 */
var msFeedbackCls = "border border-danger";



/************************************************
 * 글로벌 함수
 ************************************************/
/**
 * 탭폴더의 content를 한번에 볼 수 있도록 펼칩니다.
 * 펼친 뒤, 각 content 끼리 드래그 앤 드롭이 가능합니다.
 * 
 * @param {cpr.controls.TabFolder} pcTabfolder 탭폴더 객체
 * @param {Boolean} pbAutosize? autoSize 여부, default : true
 * @param {Number} pnMinHeight? pbAutosize가 false일 때 높이설정, default : 탭폴더 높이
 */
globals.openTabFolder = function (pcTabfolder, pbAutosize, pnMinHeight) {
	
	/** @type cpr.controls.TabFolder */
	var vcTabfolder = pcTabfolder;
	if(!vcTabfolder.visible) return;
	
	// content height 설정
	var vnMineHeight = (!pbAutosize && pnMinHeight) ? pnMinHeight : (pcTabfolder.getActualRect().height - 12); // top,bottom Margin + border
	var vsTabHeight = vnMineHeight + "px"; 

	// AutoSizing 여부
	var vbAutosize = true;
	if(pbAutosize != null) {
		vbAutosize = pbAutosize;
	}

	var voTabItems = vcTabfolder.getTabItems();
	var vnTabLen = voTabItems.length;
	var vnFormRows = vnTabLen * 2;
	
	/* 그룹 생성 */
	var vcGrpTab = new cpr.controls.Container("grpTab_" + pcTabfolder.id);
	vcGrpTab.style.addClass(msGrpBorderCls);
	vcGrpTab.userAttr("grpTab", "true");
	
	/* 버티컬레이아웃 생성 */
	var voVerticalLayout = new cpr.controls.layouts.VerticalLayout();
	voVerticalLayout.spacing = 5;
	voVerticalLayout.topMargin = 5;
	voVerticalLayout.bottomMargin = 5;
	vcGrpTab.setLayout(voVerticalLayout);
	
	/* 컨트롤 추가 */
	var voRows = ["30px", vsTabHeight];
	voTabItems.forEach(function(each, idx){
		
		if(each.name == null || each.name == "") {
			each.name = each.content.uuid;
		}
		
		var vcGrpWrap = new cpr.controls.Container("grpWrap_" + pcTabfolder.id +idx);
		vcGrpWrap.style.addClass(msGrpFormCls);

		// 폼레이아웃 생성 
		var voFormLayoutWrap = new cpr.controls.layouts.FormLayout();
		voFormLayoutWrap.setRows(["30px", vsTabHeight]);
		voFormLayoutWrap.setColumns(["1fr"]);
		voFormLayoutWrap.horizontalSeparatorClass = "Class";
		voFormLayoutWrap.horizontalSeparatorWidth = 1;
		voFormLayoutWrap.verticalSeparatorClass = "Class";
		voFormLayoutWrap.verticalSeparatorWidth = 1;
		voFormLayoutWrap.setUseRowShade(0, true);
		voFormLayoutWrap.setRowAutoSizing(0, true); // title autoSize
		if(vbAutosize) voFormLayoutWrap.setRowAutoSizing(1, true); // content autoSize
		vcGrpWrap.setLayout(voFormLayoutWrap);
		
		// 1. title
		var vcOptTitle = new cpr.controls.Output();
		vcOptTitle.value = each.text;
		vcOptTitle.style.addClass(msTitleCls);
		vcOptTitle.tooltip = "클릭하면 콘텐츠가 토글됩니다.";
		vcOptTitle.addEventListener("click", function(e) {
			var vbRowVisible = voFormLayoutWrap.isRowVisible(1);
			voFormLayoutWrap.setRowVisible(1, !vbRowVisible); // 타이틀에 해당하는 콘텐츠 토글
			
			if(voFormLayoutWrap.isRowAutoSizing(1) == false) {
				var vsAutosizeHeight = !vbRowVisible ? vsTabHeight : "32px";
				vcGrpTab.updateConstraint(vcGrpWrap, {
					"height" : vsAutosizeHeight,
				});
			} 
		});
		vcGrpWrap.addChild(vcOptTitle, {
			"rowIndex" : 0,
			"colIndex" : 0
		});
		
		// 2. content
		var vcInsertContent = each.content;
		voTabItems.map(function(arg){
			if(arg.content == vcInsertContent) {
				arg.content = null;
				return;
			}
		});
		vcGrpWrap.addChild(vcInsertContent, {
			"rowIndex" : 1,
			"colIndex" : 0
		});
		
		vcGrpTab.addChild(vcGrpWrap, {
			"autoSize": "height",
			"height" : vsTabHeight
		})
		
		// 탭폴더 전체보기 후, 드래그로 탭아이템 순서변경 추가
		var vsDataType = vcGrpTab.uuid;
		_setDragSource(vcGrpWrap, vsDataType);
		_setDropTarget(vcGrpTab, vsDataType, vbAutosize, vsTabHeight);
	});
	
	var vcParent = vcTabfolder.getParent();
	var voConstraint = JSON.parse(JSON.stringify(vcParent.getConstraint(vcTabfolder)));
	if (voConstraint["height"]) {
		voConstraint["height"] = parseInt(voConstraint["height"]) + (vnTabLen - 1) * 76 + "px";
	}
	
	var tabFolderIndex = vcParent.getChildren().indexOf(vcTabfolder);
	vcParent.insertChild(tabFolderIndex, vcGrpTab, voConstraint);
	vcTabfolder.visible = false;
}



/**
 * 펼쳐진 탭폴더를 원복시킵니다.
 * @param {cpr.controls.TabFolder} pcTabfolder 탭폴더 객체
 */
globals.revertTabfolder = function(pcTabfolder) {
	
	/** @type cpr.controls.TabFolder */
	var vcTabfolder = pcTabfolder;
	if(vcTabfolder.visible) return;
	
	var vcParent = vcTabfolder.getParent();
	var vaContent = [];
	var vaGrpTab = vcParent.getAllRecursiveChildren().filter(function(each){
		return each.userAttr("grpTab") == "true";
	}).forEach(function(each){
		/** @type cpr.controls.Container */
		var vcGrp = each;
		vcGrp.getChildren().forEach(function(arg, idx){
			vaContent.push({
				"title" : arg.getFirstChild().value,
				"content" : arg.getLastChild()
			});
		});

		vcParent.removeChild(vcGrp);
	});
	
	/* tabfolder 의 content 복구 */
	
	// 1. 변경된 순서대로 탭아이템 추가
	var vaTabItems = vcTabfolder.getTabItems();
	vaContent.forEach(function(each, idx) {
		vaTabItems.forEach(function(item){
			if(item.name == each["content"].uuid){
				item.content = each["content"];
				vcTabfolder.reorderTabItem(item, idx);
			}
		});
	});
	
	// 2. 이전에 선택되어 있던 탭아이템 선택
	vcTabfolder.setSelectedTabItem(vaTabItems[mnSelectedIdx]);
	
	// 3. 탭폴더 visible= true 설정
	vcTabfolder.visible = true;
	
	// 드래그 객체 초기화
	maDragSource = [];
	maDropTarget = [];
}


/**
 * 드래그 소스
 * @param {cpr.controls.Container} pcDrag
 * @param {String} psDataType
 */
function _setDragSource (pcDrag, psDataType) {
	
	var voDragSource = new cpr.controls.DragSource(pcDrag, {
		options : {
			dataType: psDataType
		},
		onDragStart: function(context) {
			context.cursor = "grabbing"
		}
	});
	
	maDragSource.push(voDragSource);
}


/**
 * 드롭 타겟
 * @param {cpr.controls.Container} pcTarget
 * @param {String} psDataType
 * @param {Boolean} pbAutoSize
 * @param {String} psHeight
 */
function _setDropTarget (pcTarget, psDataType, pbAutoSize, psHeight) {
	
	var vcGrpTab = pcTarget;
	var voLayout = vcGrpTab.getLayout();
	var feedback = null;
	
	/**
	 * 피드백을 생성합니다.
	 */
	function createFeedback () {
		feedback = new cpr.controls.Output();
		feedback.style.addClass(msFeedbackCls);
	}
	
	var voDropTarget = new cpr.controls.DropTarget(vcGrpTab, {
		isImportant: function(source){
			return source.dataType == psDataType;
		},
		onDragEnter: function(context){
			createFeedback();	
		},
		onDragMove: function(context) {
			/*
			 * reference를 사용하기 위해서 eXbuilder6를 최소 1.0.2616 버전 이상을 사용해야 합니다.
			 * 1.0.2616 버전 이하에서 발생하는 오류는 기술지원 보증 범위에 포함되지 않습니다.
			 */
			var reference = voLayout.getInsertionReference(context.pointerLocation);
			if (reference) {
				var feedbackBounds = null;
			
				if (reference.previousSibiling) {
					feedbackBounds = reference.previousSibiling.getOffsetRect();
					feedbackBounds.y = feedbackBounds.bottom;
					feedbackBounds.height = 0;
					feedbackBounds.translate(0, voLayout.spacing / 2 - 1);
				}
				// 다음 컨트롤을 참조할 수 있는 경우.
				else if (reference.nextSibiling) {
					feedbackBounds = reference.nextSibiling.getOffsetRect();
					feedbackBounds.height = 0;
					feedbackBounds.translate(0, -voLayout.spacing / 2 - 1);
				} else {
					feedbackBounds = vcGrpTab.getViewPortRect();
					feedbackBounds.shrink(voLayout.leftMargin + voLayout.rightMargin, 0);
					feedbackBounds.y = voLayout.topMargin;
					feedbackBounds.height = 0;
				}
				
				vcGrpTab.floatControl(feedback, feedbackBounds);
				
			} else {
				feedback.dispose();
				feedback = null;
			}
		},
		onDragLeave: function(context) {
			feedback.dispose();
			feedback = null;
		},
		onDragIdle: function(constraint, repeat) {
			var actualRect = vcGrpTab.getActualRect();
			var animationDuration = voDropTarget.idleRepeatTime;
			if (repeat) {
				animationDuration = voDropTarget.idleRepeatTime;
			}
			
			if (Math.abs(actualRect.top - constraint.pointerLocation.y) < mnEdgeWidth) {
				vcGrpTab.adjustScroll(0, -mnScrollAmount, animationDuration);
			} else if (Math.abs(actualRect.bottom - constraint.pointerLocation.y) < mnEdgeWidth) {
				vcGrpTab.adjustScroll(0, mnScrollAmount, animationDuration);
			}
		},
		onDrop: function(context) {
			var reference = voLayout.getInsertionReference(context.pointerLocation);
			var vcGrpSrc = context.source.control;
			var vnSourceIndex = vcGrpTab.getChildren().indexOf(vcGrpSrc);
			vcGrpTab.removeChild(vcGrpSrc);
			
			var vnDefIdx = reference.index - vnSourceIndex;
			var vnMovedIndex = vnDefIdx > 0 ? reference.index-1 : reference.index;
			vcGrpTab.insertChild(vnMovedIndex, vcGrpSrc, {
				"autoSize" : "height",
				"height" : psHeight,
			});
			
			feedback.dispose();
			feedback = null;
		}
	});
	
	maDropTarget.push(voDropTarget);
}

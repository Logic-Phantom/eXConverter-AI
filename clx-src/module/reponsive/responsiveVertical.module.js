/************************************************
 * ResponsiveVertical.module.js
 *
 * @author tomatosystem
 ************************************************/

/*************************************************************************
 * 확인사항
 * 1. RForm.prototype.ATTR_NM에 구성된 속성중 필요한 기능을 확인하고
 *    프로젝트 표준으로 그룹(버티컬 레이아웃)에 해당 속성명과 동일하게 사용자 속성을 구성하여 적용합니다.
 *    (eXBuilder6 > 프로젝트 표준 > 사용자 속성 정의)
 * 
 * 2. 반응형 모듈 적용은 event.module.js내 init EventBus에서 처리되며
 * 	    사용자 속성 "mobile-fit" or "tablet-fit" 값 존재여부에 따라 적용여부를 판단 합니다.
 *    적용된 반응형 객체는 그룹의 "_RVertical"(ex. grpForm["_RVertical"]) 속성으로 반환받을 수 있습니다.  
 * 
 * 3. 반응형 버티컬 모듈은  스크린에 따라 버티컬 레이아웃으로 구성된 그룹의 visible, margin, spacing 등을 적용된 값으로 변경합니다.
 *    (모바일 등 스크린 사이즈가 작은경우 여백을 줄이고 컨텐츠 영역을 확장시켜서 표시하기 위함)
 *************************************************************************/

/**
 * 반응형 버티컬 레이아웃 유틸리티
 * @param {cpr.controls.Container} container
 */
function RVertical(container) {
	this._container = container;
	this._appInstance = container.getAppInstance();
	this._started = false;
	this._onScreenChange = this._onScreenChange.bind(this);
	this._screenNms = this._setScreenNm();
}

/**
 * 반응형 버티컬 레이아웃 옵션 속성명<br>
 * (사용자 속성값의 기본타입은 String이며 valueType은 데이터 입력형식 확인을 위해 작성되었습니다.)
 */
RVertical.prototype.ATTR_NM = {
	/** <필수>모바일 : 반응형 버티컬 레이아웃 사용여부 <br>(valueType : Boolean, ex. true)*/
	ATTR_MOBILE_FIT : "mobile-fit",
	/** <필수>태블릿 : 반응형 버티컬 레이아웃 사용여부<br>(valueType : Boolean, ex. true)*/
	ATTR_TABLET_FIT : "tablet-fit",
	
	/** 모바일 : 버티컬 레이아웃 top margin<br>(valueType : Number, ex. 5)*/
	ATTR_MOBILE_T_MARGIN : "mobile-top-margin",
	/** 모바일 : 버티컬 레이아웃 right margin<br>(valueType : Number, ex. 5)*/
	ATTR_MOBILE_R_MARGIN : "mobile-right-margin",
	/** 태블릿 : 버티컬 레이아웃 bottom margin<br>(valueType : Number, ex. 5)*/
	ATTR_MOBILE_B_MARGIN : "mobile-bottom-margin",
	/** 태블릿 : 버티컬 레이아웃 left margin<br>(valueType : Number, ex. 5)*/
	ATTR_MOBILE_L_MARGIN : "mobile-left-margin",
	/** 태블릿 : 버티컬 레이아웃 spacing<br>(valueType : Number, ex. 10)*/
	ATTR_MOBILE_SPACING : "mobile-spacing",
	
	/** 태블릿 : 버티컬 레이아웃 top margin<br>(valueType : Number, ex. 5)*/
	ATTR_TABLET_T_MARGIN : "tablet-top-margin",
	/** 태블릿 : 버티컬 레이아웃 right margin<br>(valueType : Number, ex. 5)*/
	ATTR_TABLET_R_MARGIN : "tablet-right-margin",
	/** 태블릿 : 버티컬 레이아웃 bottom margin<br>(valueType : Number, ex. 5)*/
	ATTR_TABLET_B_MARGIN : "tablet-bottom-margin",
	/** 태블릿 : 버티컬 레이아웃 left margin<br>(valueType : Number, ex. 5)*/
	ATTR_TABLET_L_MARGIN : "tablet-left-margin",	
	/** 태블릿 : 버티컬 레이아웃 spacing<br>(valueType : Number, ex. 10)*/
	ATTR_TABLET_SPACING : "tablet-spacing",
	
	/** 모바일 : 버티컬 레이아웃 숨김여부<br>(valueType : Boolean, true or false)*/	
	ATTR_HIDE_ON_MOBILE : "hide-on-mobile",
	/** 태블릿 : 버티컬 레이아웃 숨김여부<br>(valueType : Boolean, true or false)*/	
	ATTR_HIDE_ON_TABLET : "hide-on-tablet"	
}

/**
 * 타입에 따른 스크린 명칭 구성
 */
RVertical.prototype._setScreenNm = function(){
	var voScreenNms = {
		"default" : "default",
		"tablet" : "tablet",
		"mobile" : "mobile"
	};
	
	var vaScreens = this._container.getAppInstance().allSupportedScreens;
	if(typeof AppProperties !== 'undefined'){
		voScreenNms["default"] = ValueUtil.isHaveStr(AppProperties.SCREEN_DEFAULT_NM, vaScreens[0].name)? vaScreens[0].name: "default";
		voScreenNms["tablet"]  = ValueUtil.isHaveStr(AppProperties.SCREEN_TABLET_NM, vaScreens[1].name)? vaScreens[1].name: "tablet";
		voScreenNms["mobile"]  = ValueUtil.isHaveStr(AppProperties.SCREEN_MOBILE_NM, vaScreens[2].name)? vaScreens[2].name: "mobile";
	}
	
	return voScreenNms;
}

RVertical.prototype._backup = function() {
	this._originalLayout = this._container.getLayout();
}

/** @type cpr.controls.layouts.VerticalLayout */
RVertical.prototype._originalLayout = null;

RVertical.prototype._transform = function() {
	var originalLayout = this._originalLayout;
	var layout = new cpr.controls.layouts.VerticalLayout();
	this._container.setLayout(layout);
	
	layout.topMargin = originalLayout.topMargin;
	layout.rightMargin = originalLayout.rightMargin;
	layout.bottomMargin = originalLayout.bottomMargin;
	layout.leftMargin = originalLayout.leftMargin;
	layout.spacing = originalLayout.spacing;
	layout.scrollable = originalLayout.scrollable;
	
	/** @type String */
	var tMargin;
	
	/** @type String */
	var rMargin;
	
	/** @type String */
	var bMargin;
	
	/** @type String */
	var lMargin;
	
	/** @type String */
	var spacing;
	
	switch (this._container.getAppInstance().targetScreen.name) {
		case this._screenNms["mobile"]: {
			tMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_T_MARGIN) || layout.topMargin);
			rMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_R_MARGIN) || layout.rightMargin);
			bMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_B_MARGIN) || layout.bottomMargin);
			lMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_L_MARGIN) || layout.leftMargin);
			spacing = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_SPACING) || layout.spacing);
			layout.distribution = "fill";
			
			/* 사용자 속성 "hide-on-mobile"의 값이 true면 visible false 처리 */
			if (this._container.userAttr(this.ATTR_NM.ATTR_HIDE_ON_MOBILE) == "true") {
				this._container.visible = false;
			} else {
				this._container.visible = true;
			}
			
			break;
		}
		
		case this._screenNms["tablet"]: {
			tMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_TABLET_T_MARGIN) || layout.topMargin);
			rMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_TABLET_R_MARGIN) || layout.rightMargin);
			bMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_TABLET_B_MARGIN) || layout.bottomMargin);
			lMargin = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_TABLET_L_MARGIN) || layout.leftMargin);
			spacing = parseInt(this._container.userAttr(this.ATTR_NM.ATTR_TABLET_SPACING) || layout.spacing);
			layout.distribution = "fill";
			
			/* 사용자 속성 "hide-on-tablet"의 값이 true면 visible false 처리 */
			if (this._container.userAttr(this.ATTR_NM.ATTR_HIDE_ON_TABLET) == "true") {
				this._container.visible = false;
			} else {
				this._container.visible = true;
			}
			
			break;
		}
	}
	
	layout.topMargin = tMargin;
	layout.rightMargin = rMargin;
	layout.bottomMargin = bMargin;
	layout.leftMargin = lMargin;
	layout.spacing = spacing;
};

RVertical.prototype._restore = function() {
	this._container.setLayout(this._originalLayout);
	
	if(!this._container.disposed) {
		this._container.visible = true;
	}
};

RVertical.prototype.start = function() {
	if (this._started) {
		return;
	}
	this._backup();
	
	this._appInstance.addEventListener("screen-change", this._onScreenChange);
};

/**
 * @param {cpr.events.CScreenChangeEvent} e
 */
RVertical.prototype._onScreenChange = function(e) {
	var screenName = e.screen.name;
	switch (screenName) {
		case this._screenNms["default"]: {			
			if (this._container.userAttr(this.ATTR_NM.ATTR_HIDE_ON_MOBILE) == "false" || this._container.userAttr(this.ATTR_NM.ATTR_HIDE_ON_TABLET) == "false") {
				this._container.visible = false;
			} else {
				this._restore();
			}
			
			break;
		}
		
		case this._screenNms["mobile"]: {
			if (this._container.userAttr(this.ATTR_NM.ATTR_MOBILE_FIT) == "true") {
				this._transform();
			} else {
				this._restore();
			}
			
			break;
		}
		
		case this._screenNms["tablet"]: {
			if (this._container.userAttr(this.ATTR_NM.ATTR_TABLET_FIT) == "true") {
				this._transform();
			} else {
				this._restore();
			}
			
			break;
		}
	}
};

/**
 * 반응형 버티컬 레이아웃 적용
 * @param {cpr.controls.Container} container
 */
globals.makeVResponsive = function(container) {
	return new RVertical(container);
};
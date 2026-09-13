/************************************************
 * formCalendar.module.js
 * Created at 2023. 6. 7. 오후 2:24:34.
 *
 * @author park
 ************************************************/

/*
 * 달력의 웹 접근성 문제를 해결하기 위해 사용됩니다.
 * 
 * [주의] 
 * getCalendarDate()선언 >>> prototype의 옵션 설정 >>> drawStart() 순서를 지켜야 합니다.
 * 
 * [사용방법]
 * 모듈을 사용하기 위해 디자인 탭에 그룹을 배치하신 다음 스크립트에서 getCalendarData()을 선언한 뒤 options의 세부 사항들을 설정 후 아래의 주요 기능 함수를 호출하여 사용할 수 있습니다.
 * -일정 데이터셋의 형식-
 * [id:이벤트 인덱스, label:표기될 일정 텍스트, creater:작성자, beginDt:시작일자, endDt:종료일자, memo:내용, allDay:종일설정, class:일정구분, isHoliday:공휴일구분값(Y/N)]
 * 각 options는 기본값이 있으며, 일정은 각 칸의 높이를 정규표현식으로 치환 후 계산해 영역에 맞춰 표기됩니다.
 * 달력이 표기되는 현재시간의 기본값은 moment()함수로 측정되어 사용자 시스템의 시간을 기준으로 표시되므로 이를 serverTime옵션으로 서버 시간으로 변경할 수 있습니다.
 * 공휴일은 데이터셋에 넣어서 사용합니다.
 * isHoliday컬럼을 Y로 설정 시 일 표기 숫자 아웃풋 컨트롤에 options로 지정된 _holidayTextColorClass 클래스를 추가합니다.
 * 각 레이아웃의 Constraint의 길이, 높이에는 [rem, em, %, px, 숫자] 사용이 가능합니다.
 * 
 * [호출 가능한 메서드]
 *  1. drawStart : 그룹에 캘린더를 그려줍니다.
 *  2. createEvnt : 데이터셋에 일정을 추가 후 달력 표기를 갱신합니다. 샘플 페이지에서는 사용자의 시스템 시간을 기준으로 일정이 추가됩니다.
 *  3. updateEvnt : 데이터셋의 일정을 수정 후 달력 표기를 갱신합니다.
 *  4. deleteEvnt : 데이터셋의 일정을 삭제 후 달력 표기를 갱신합니다.
 */

/** 
 * 캘린더를 그릴 때 필요한 요소를 받아옵니다.
 * @app {#app} app 해당 앱
 * @param {String} grpId 캘린더를 그릴 그룹Id
 * @param {String} dsCalId 달력에 사용될 데이터셋 이름
 * @param {
 *   createEventMethod : Object = `각 요일의 이벤트 설정`,
 *   editScheduleEvntMethod : Object = `일정의 이벤트 설정`,
 *   viewDetailEvntMethod : Object = `+더보기(일정 더보기) 클릭 이벤트 설정`
 * } options
 */
function CalendarKit(app, grpId, dsCalId, options) {
	if (app) {
		/** @type cpr.core.AppInstance */
		this._app = app;
	}
	if (grpId) {
		/** @type cpr.controls.Container */
		this._drawCalendarGrp = app.lookup(grpId);
	}
	if (dsCalId) {
		this._dsCalId = dsCalId;
	}
	if (options) {
		//event
		if (options.createEventMethod)
			CalendarKit.prototype._createEventMethod = options.createEventMethod;
		if (options.editScheduleEvntMethod)
			CalendarKit.prototype._editScheduleEvntMethod = options.editScheduleEvntMethod;
		if (options.viewDetailEvntMethod)
			CalendarKit.prototype._viewDetailEvntMethod = options.viewDetailEvntMethod;
	}
};

/************************************************
 * 전역 변수 (변경 가능)
 ************************************************/
/**
 * 휴일의 텍스트 클래스 설정
 * @type {String}
 */
CalendarKit.prototype._holidayTextColorClass = "text-red";

/**
 * 이전달/다음달 표기 텍스트 클래스 설정
 * @type {String}
 */
CalendarKit.prototype._notThisMonthOptClass = "text-light";

/**
 * 달력에 표시할 기준 시간 설정
 * @type {String} 
 */
CalendarKit.prototype._serverTime = moment().subtract(0, "months");

/**
 * header영역 Constraint 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._headerConstraint = {};

/**
 * header영역 HorizontalSpacing 기본값 설정
 * @type {String}
 */
CalendarKit.prototype._headerHorizontalSpacing = "5px";

/**
 * header영역 cmb 표기시 연/월 컬럼의 길이 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._ymLayoutColumns = ["81px", "65px"];

/**
 * body영역 Constraint 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._bodyConstraint = {};

/**
 * body영역의 헤더부분 HorizontalSpacing 기본값 설정
 * @type {String} 
 */
CalendarKit.prototype._bodyHeaderHorizontalSpacing = "0px";

/**
 * body영역의 바디부분 HorizontalSpacing 기본값 설정
 * @type {String} 
 */
CalendarKit.prototype._bodyBodyHorizontalSpacing = "0px";

/**
 * body영역의 바디부분 VerticalSpacing 기본값 설정
 * @type {String} 
 */
CalendarKit.prototype._bodyBodyVerticalSpacing = "0px";

/**
 * body영역 각 칸 레이아웃의 Spacing 기본값 설정
 * @type {Number} 
 */
CalendarKit.prototype._eachVerticalLayoutSpacing = 3;

/**
 * body영역 헤더부분 Constraint 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._bodyHeaderConstraint = {};

/**
 * body영역 바디부분 Constraint 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._bodyBodyConstraint = {};

/**
 * body영역 eachSpace영역 Constraint 기본값 설정 n열/n행은 자동으로 추가됩니다.
 * @type {Object} 
 */
CalendarKit.prototype._eachSpaceConstraint = {};

/**
 * body영역 eachSpace영역 날짜 표기의 Constraint 기본값 설정
 * @type {Object} 
 */
CalendarKit.prototype._eachOutputConstraint = {};

/**
 * 달력이 그려질 그룹의 TopMargin 지정
 * @type {Number} 
 */
CalendarKit.prototype._topContainerTopMargin = 5;

/**
 * 달력이 그려질 그룹의 BottomMargin 지정
 * @type {Number} 
 */
CalendarKit.prototype._topContainerBottomMargin = 5;

/**
 * 달력이 그려질 그룹의 Spacing 지정
 * @type {Number} 
 */
CalendarKit.prototype._topContainerSpacing = 5;

/**
 * 헤더영역 표시 설정
 * @type {Boolean} true-표기/false-미표기
 */
CalendarKit.prototype.headerOnOff = true;

/**
 * 일정 표시 설정
 * @type {Boolean} true-표기/false-미표기
 */
CalendarKit.prototype.evntOnOff = true;

/**
 * 이전달 표시 설정
 * @type {Boolean} true-표기/false-미표기
 */
CalendarKit.prototype.pvBtnOnOff = true;

/**
 * 다음달버튼 표시 설정
 * @type {Boolean} true-표기/false-미표기
 */
CalendarKit.prototype.nxtBtnOnOff = true;

/**
 * 오늘버튼 표시 설정
 * @type {Boolean} true-표기/false-미표기
 */
CalendarKit.prototype.todayBtnOnOff = true;

/**
 * 헤더영역 YYYY.MM구간 길이
 * @type {String}
 */
CalendarKit.prototype.ymWidth = "165px";

/**
 * 헤더영역 이전달버튼 길이
 * @type {String}
 */
CalendarKit.prototype.prvBtnWidth = "30px";

/**
 * 헤더영역 다음달버튼 길이
 * @type {String}
 */
CalendarKit.prototype.nxtBtnWidth = "30px";

/**
 * 헤더영역 오늘버튼 길이
 * @type {String}
 */
CalendarKit.prototype.tdyBtnWidth = "50px";

/**
 * 좌상단 YYYY.MM의 표기 방식 지정 (opt / cmb)
 * @type {String}
 */
CalendarKit.prototype.yearMonthOptType = "opt";

/**
 * 좌상단 YYYY.MM이 cmb 형식으로 표기될 때 표시할 최소 년도
 * @type {Number}
 */
CalendarKit.prototype.cmbYearMin = 1900;

/**
 * 좌상단 YYYY.MM이 cmb 형식으로 표기될 때 표시할 최대 년도
 * @type {Number}
 */
CalendarKit.prototype.cmbYearMax = 2099;

/************************************************
 * 함수 등록
 ************************************************/
/**
 * 길이 치환 계산식
 * @param {Object} expression 길이를 구할 영역의 값
 * @param {Number} containerHeight 길이(width, height)를 구할 영역을 포함하는 그릅의 길이로 n%연산에 사용됩니다.
 */
function calculateConstraint(expression, containerHeight) {
	// 각 constraint영역의 높이 계산
	var rootFontSize = window.getComputedStyle(document.documentElement).getPropertyValue('font-size');
	
	// expression을 문자열로 변환
	expression = String(expression);
	expression = expression.replace(/rem/g, function() {
			if (!rootFontSize) return 'rem'; // 값이 없으면 기존의 'rem' 반환
			return '*' + rootFontSize;
		})
		.replace(/(\d+(\.\d+)?)%/g, function(match, p1) {
			if (!containerHeight) return match; // 값이 없으면 기존의 match 그대로 반환
			return containerHeight * (parseFloat(p1) / 100);
		})
		.replace(/(\d+(\.\d+)?)px/g, function(match, p1) {
			if (!parseFloat(p1)) return match; // 값이 없으면 기존의 match 그대로 반환
			return parseFloat(p1);
		})
		.replace(/(\d+(\.\d+)?)em/g, function(match, p1) {
			if (!rootFontSize) return match; // 값이 없으면 기존의 match 그대로 반환
			return rootFontSize * parseFloat(p1);
		});
	
	if (!expression.trim()) return ''; // 값이 없으면 빈 문자열 반환
	expression  = "return " + expression;
	
	var result = new Function(expression)();
	return result;
}

/** 
 * 캘린더를 그려줍니다
 * @param {String} vsDayOfWeekFom 요일 표기 방식 지정("min" -> MN, "short" -> MON, default -> MONDAY)
 * @param {String} type (미구현)Month, Week, Day 월간/주간/일간 달력 중 선택해서 입력
 */
CalendarKit.prototype.drawStart = function(vsDayOfWeekFom, type) {
	// 지정값 사용
	var _app = this._app;
	var _dsCalId = this._dsCalId;
	var _yearMonthOptType = this.yearMonthOptType;
	var cmbYearMin = this.cmbYearMin;
	var cmbYearMax = this.cmbYearMax;
	if (this._editScheduleEvntMethod != '' && this._editScheduleEvntMethod != undefined && this._editScheduleEvntMethod != null) {
		var _editScheduleEvntMethod = this._editScheduleEvntMethod;
	}
	if (this._viewDetailEvntMethod != '' && this._viewDetailEvntMethod != undefined && this._viewDetailEvntMethod != null) {
		var _viewDetailEvntMethod = this._viewDetailEvntMethod;
	}
	
	/** @type cpr.controls.Container */
	var topContainer = this._drawCalendarGrp;
	var headerOnOff = this.headerOnOff;
	var ymWidth = this.ymWidth;
	var prvBtnWidth = this.prvBtnWidth;
	var nxtBtnWidth = this.nxtBtnWidth;
	var tdyBtnWidth = this.tdyBtnWidth;
	var evntOnOff = this.evntOnOff;
	var pvBtnOnOff = this.pvBtnOnOff;
	var nxtBtnOnOff = this.nxtBtnOnOff;
	var todayBtnOnOff = this.todayBtnOnOff;
	var _holidayTextColorClass = this._holidayTextColorClass;
	var _notThisMonthOptClass = this._notThisMonthOptClass;
	var _serverTime = this._serverTime;
	
	// moment()함수를 기준으로 현재 달력 월 계산할 때 사용, 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
	var mnMFarFromNow = 0;
	
	// 년월 계산을 위한 시간값
	var voStdDate = moment(_serverTime).subtract(mnMFarFromNow, "months");
	var momentYear = moment(voStdDate).format("YYYY");
	var momentMonth = moment(voStdDate).format("MM");
	
	// 년월 선택박스 사용시 년월 파악을 위한 변수이며 초기값 년/월 입력
	var selectedYearValue = momentYear;
	var selectedMonthValue = momentMonth;
	
	// 캘린더가 그려질 최상단 컨테이너 그룹을 찾아 변수에 저장하고 calendar 클래스를 부여, vertical레이아웃으로 변경
	topContainer.style.addClass("calendar");
	var calContainer = new cpr.controls.layouts.VerticalLayout();
	calContainer.topMargin = this._topContainerTopMargin;
	calContainer.bottomMargin = this._topContainerBottomMargin;
	calContainer.spacing = this._topContainerSpacing;
	calContainer.scrollable = false;
	topContainer.setLayout(calContainer);
	
	// 달력이 그려질 그룹의 높이를 통해 계산 후 일정을 표시하기위해 변수에 저장
	var topContainerHeight = topContainer.getOffsetRect().height;
	
	//constraint 설정 - _headerConstraint
	if (headerOnOff == true) {
		//option이 없으면 기본값 사용
		if (Object.keys(this._headerConstraint).length > 0) {
			this._headerConstraint;
		} else {
			this._headerConstraint = {
				"height": "30px",
				"width": "100%",
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			};
		}
	}
	//constraint 설정 - _bodyConstraint
	if (Object.keys(this._bodyConstraint).length == 0) {
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				var bodyHeight = topContainerHeight - calContainer.spacing - calContainer.topMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - this._topContainerBottomMargin;
			} else {
				var bodyHeight = topContainerHeight - calContainer.spacing - calContainer.topMargin - this._topContainerBottomMargin;
			}
			this._bodyConstraint = {
				"top": "40px",
				"height": bodyHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		} else {
			this._bodyConstraint = {
				"height": topContainerHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		}
	}
	//constraint 설정 - _bodyHeaderConstraint
	if (Object.keys(this._bodyHeaderConstraint).length == 0) {
		this._bodyHeaderConstraint = {
			"height": "30px",
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	//constraint 설정 - _bodyBodyConstraint
	if (Object.keys(this._bodyBodyConstraint).length == 0) {
		if (this._bodyHeaderConstraint.height && this._bodyConstraint.height) {
			var bodyHeaderHeight = calculateConstraint(this._bodyHeaderConstraint.height, this._bodyConstraint.height);
		}
		var bodyBodyHeight = 0;
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				bodyBodyHeight = topContainerHeight - calContainer.spacing - calContainer.topMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - bodyHeaderHeight - this._topContainerBottomMargin;
			}
		} else {
			bodyBodyHeight = topContainerHeight - calContainer.spacing - calContainer.topMargin - bodyHeaderHeight - this._topContainerBottomMargin;
		}
		this._bodyBodyConstraint = {
			"top": "30px",
			"height": bodyBodyHeight,
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	// 요일 칸의 width, height 계산식
	var bodyContainerWidth = calculateConstraint(this._bodyConstraint.width, topContainer.getOffsetRect().width);
	var bodyBodyContainerHeight = calculateConstraint(this._bodyBodyConstraint.height, topContainerHeight);
	var bodyBodyHeight = calculateConstraint(this._bodyBodyConstraint.height, this._bodyConstraint.height);
	var eachSpaceWidth = Math.floor(bodyContainerWidth / 7);
	var eachSpaceHeight = Math.floor(bodyBodyHeight / 6);
	
	// 바디내부 개별 영역 추가
	if (headerOnOff == true) {
		// 헤더영역(폼) 추가
		var header = new cpr.controls.Container();
		header.style.addClass("calendar-header");
		var headerLayout = new cpr.controls.layouts.FormLayout();
		//option이 없으면 기본값 사용
		headerLayout.horizontalSpacing = this._headerHorizontalSpacing;
		headerLayout.setColumns([ymWidth, prvBtnWidth, nxtBtnWidth, tdyBtnWidth]);
		header.setLayout(headerLayout);
		topContainer.addChild(header, this._headerConstraint);
		
		// 헤더영역의 YYYY.MM 아웃풋(아웃풋/콤보박스 구분)
		if (_yearMonthOptType == "opt") {
			//[추후수정필요] 문서 시작지점 어딘가를 "이미지", 문서종료지점 "링크" 라고 읽음 -> 아무것도 없는 clx파일 만들어도 이미지, 링크 읽음 -> ?
			var mmYMOpt = new cpr.controls.Output();
			mmYMOpt.style.addClass("calendar-header-title");
			setCalendarHeaderDates(this._app, mmYMOpt, mnMFarFromNow, _serverTime);
			
			mmYMOpt.addEventListener("value-change", function(e) {
				/*
				 * 달력 데이터 갱신하기
				 * [추후수정필요] 다국어 지역 설정 (works globally)
				 * var vsLocale = _app.lookup("dmRes").getValue("locale");
				 * cpr.I18N.INSTANCE.currentLanguage = vsLocale;
				 */
				//년월값을 기준으로 1년전 = +12, 1년후 = -12, 1개월전 = +1, 1개월후 = -1
				selectedYearValue = mmYMOpt.value.slice(0, 4);
				selectedMonthValue = mmYMOpt.value.slice(5);
				var diffYear = selectedYearValue - momentYear;
				var diffMonth = selectedMonthValue - momentMonth;
				if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
					mnMFarFromNow = -(diffYear * 12 + diffMonth);
				}
				//요일표시
				setCalendarDates(bodyBody, mnMFarFromNow, _dsCalId, _holidayTextColorClass, _notThisMonthOptClass, _serverTime);
				//일정표시
				if (evntOnOff == true) {
					createScheduleEvents(_app, mnMFarFromNow, _dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, _serverTime);
				}
			});
			
			header.insertChild(0, mmYMOpt, {
				"rowIndex": 0,
				"colIndex": 0
			});
		} else {
			//YYYY.MM 콤보박스 표기 선택시
			var mmYearCmb = new cpr.controls.ComboBox();
			mmYearCmb.style.addClass("mmYearCmb");
			mmYearCmb.fieldLabel = "년콤보박스";
			for (var i = cmbYearMin; i <= cmbYearMax; i++) {
				mmYearCmb.addItem(new cpr.controls.Item(i, i));
			}
			mmYearCmb.selectItemByValue(selectedYearValue);
			mmYearCmb.addEventListener("value-change", function(e) {
				selectedYearValue = mmYearCmb.value;
				selectedMonthValue = mmMonthCmb.value;
				var diffYear = selectedYearValue - momentYear;
				var diffMonth = selectedMonthValue - momentMonth;
				if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
					mnMFarFromNow = -(diffYear * 12 + diffMonth);
				}
				//요일표시
				setCalendarDates(bodyBody, mnMFarFromNow, _dsCalId, _holidayTextColorClass, _notThisMonthOptClass, _serverTime);
				//일정표시
				if (evntOnOff == true) {
					createScheduleEvents(_app, mnMFarFromNow, _dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, _serverTime);
				}
			});
			var mmMonthCmb = new cpr.controls.ComboBox();
			mmMonthCmb.style.addClass("mmMonthCmb");
			mmMonthCmb.fieldLabel = "월콤보박스";
			for (var i = 1; i < 13; i++) {
				if (i < 10) {
					mmMonthCmb.value = "0" + i;
					mmMonthCmb.addItem(new cpr.controls.Item(mmMonthCmb.value, mmMonthCmb.value));
				} else {
					mmMonthCmb.value = i;
					mmMonthCmb.addItem(new cpr.controls.Item(i, i));
				}
			}
			mmMonthCmb.selectItemByValue(selectedMonthValue);
			mmMonthCmb.addEventListener("value-change", function(e) {
				selectedYearValue = mmYearCmb.value;
				selectedMonthValue = mmMonthCmb.value;
				var diffYear = selectedYearValue - momentYear;
				var diffMonth = selectedMonthValue - momentMonth;
				if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
					mnMFarFromNow = -(diffYear * 12 + diffMonth);
				}
				//요일표시
				setCalendarDates(bodyBody, mnMFarFromNow, _dsCalId, _holidayTextColorClass, _notThisMonthOptClass, _serverTime);
				//일정표시
				if (evntOnOff == true) {
					createScheduleEvents(_app, mnMFarFromNow, _dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, _serverTime);
				}
			});
			setCalendarHeaderDatesCmb(this._app, mmYearCmb, mmMonthCmb, mnMFarFromNow, _serverTime);
			
			var ymContainer = new cpr.controls.Container();
			ymContainer.style.addClass("ymContainer");
			var ymLayout = new cpr.controls.layouts.FormLayout();
			ymLayout.setColumns(this._ymLayoutColumns);
			ymContainer.setLayout(ymLayout);
			ymContainer.addChild(mmYearCmb, {
				"rowIndex": 0,
				"colIndex": 0,
			});
			ymContainer.addChild(mmMonthCmb, {
				"rowIndex": 0,
				"colIndex": 1,
			});
			header.addChild(ymContainer, {
				"rowIndex": 0,
				"colIndex": 0,
			});
		}
		
		if (pvBtnOnOff == true) {
			// 헤더영역의 <(이전달)버튼
			var pvBtn = new cpr.controls.Button();
			pvBtn.style.addClass("pvBtn");
			pvBtn.fieldLabel = "이전달";
			pvBtn.addEventListener("click", function() {
				
				mnMFarFromNow++;
				
				//요일갱신
				if (_yearMonthOptType == "opt") {
					setCalendarHeaderDates(this._app, mmYMOpt, mnMFarFromNow, _serverTime);
				} else {
					setCalendarHeaderDatesCmb(this._app, mmYearCmb, mmMonthCmb, mnMFarFromNow, _serverTime);
				}
			});
			header.insertChild(1, pvBtn, {
				"rowIndex": 0,
				"colIndex": 1
			});
		}
		
		if (nxtBtnOnOff == true) {
			// 헤더영역의 >(다음달)버튼
			var nxtBtn = new cpr.controls.Button();
			nxtBtn.style.addClass("nxtBtn");
			nxtBtn.fieldLabel = "다음달";
			nxtBtn.addEventListener("click", function() {
				
				mnMFarFromNow--;
				
				//요일갱신
				if (_yearMonthOptType == "opt") {
					setCalendarHeaderDates(this._app, mmYMOpt, mnMFarFromNow, _serverTime);
				} else {
					setCalendarHeaderDatesCmb(this._app, mmYearCmb, mmMonthCmb, mnMFarFromNow, _serverTime);
				}
			});
			header.insertChild(2, nxtBtn, {
				"rowIndex": 0,
				"colIndex": 2
			});
		}
		
		if (todayBtnOnOff == true) {
			// 헤더영역의 오늘버튼
			var todayBtn = new cpr.controls.Button();
			todayBtn.style.addClass("todayBtn");
			// /* [추후수정필요] 다국어 지역 설정 (works globally) */
			todayBtn.value = "오늘";
			todayBtn.addEventListener("click", function() {
				
				mnMFarFromNow = 0;
				
				//요일갱신
				if (_yearMonthOptType == "opt") {
					setCalendarHeaderDates(this._app, mmYMOpt, mnMFarFromNow, _serverTime);
				} else {
					setCalendarHeaderDatesCmb(this._app, mmYearCmb, mmMonthCmb, mnMFarFromNow, _serverTime);
				}
			});
			header.insertChild(3, todayBtn, {
				"rowIndex": 0,
				"colIndex": 3
			});
		}
	}
	
	// 바디영역(XY) 추가 - 클래스calendar-body
	var body = new cpr.controls.Container();
	body.style.addClass("calendar-body");
	var bodyLayout = new cpr.controls.layouts.XYLayout();
	body.setLayout(bodyLayout);
	topContainer.addChild(body, this._bodyConstraint);
	
	// 바디 영역 내부 추가
	// 바디내부(헤더=요일-폼)영역 추가
	var bodyHeader = new cpr.controls.Container();
	bodyHeader.style.addClass("calendar-month-dayname");
	var bodyHeaderLayout = new cpr.controls.layouts.FormLayout();
	bodyHeaderLayout.horizontalSpacing = this._bodyHeaderHorizontalSpacing;
	bodyHeaderLayout.setColumns(["1fr", "1fr", "1fr", "1fr", "1fr", "1fr", "1fr"]);
	bodyHeader.setLayout(bodyHeaderLayout);
	for (var i = 0; i < 7; i++) {
		var dayTitle = new cpr.controls.Output();
		dayTitle.style.addClass("calendar-month-dayname-item");
		if (i === 0) {
			dayTitle.style.addClass(_holidayTextColorClass);
		}
		bodyHeader.addChild(dayTitle, {
			"rowIndex": 0,
			"colIndex": i
		});
	}
	
	body.addChild(bodyHeader, this._bodyHeaderConstraint);
	// 바디내부(바디=숫자-폼)영역 추가
	var bodyBody = new cpr.controls.Container();
	bodyBody.style.addClass("calendar-month");
	var bodyBodyLayout = new cpr.controls.layouts.FormLayout();
	bodyBodyLayout.horizontalSpacing = this._bodyBodyHorizontalSpacing;
	bodyBodyLayout.verticalSpacing = this._bodyBodyVerticalSpacing;
	bodyBodyLayout.horizontalSeparatorWidth = "1";
	bodyBodyLayout.verticalSeparatorWidth = "1";
	bodyBodyLayout.setRows(["1fr", "1fr", "1fr", "1fr", "1fr", "1fr"]);
	bodyBodyLayout.setColumns(["1fr", "1fr", "1fr", "1fr", "1fr", "1fr", "1fr"]);
	bodyBody.setLayout(bodyBodyLayout);
	body.addChild(bodyBody, this._bodyBodyConstraint);
	
	for (var i = 0; i < 6; i++) {
		for (var j = 0; j < 7; j++) {
			var eachSpace = new cpr.controls.Container();
			eachSpace.style.addClass("calendar-month-day");
			var _eachSpaceWidth = "";
			// bodyBody컨테이너 높이 320기준 플로우, 버티컬
			if (bodyBodyContainerHeight < 320) {
				var eachLayout = new cpr.controls.layouts.FlowLayout();
				eachLayout.scrollable = false;
				eachSpace.setLayout(eachLayout);
				_eachSpaceWidth = eachSpaceWidth + "px";

			} else {
				var eachVerticalLayout = new cpr.controls.layouts.VerticalLayout();
				eachVerticalLayout.spacing = this._eachVerticalLayoutSpacing;
				eachVerticalLayout.scrollable = false;
				eachVerticalLayout.distribution = "leading";
				eachSpace.setLayout(eachVerticalLayout);
				_eachSpaceWidth = "100%";
			}
			
			if (Object.keys(this._eachSpaceConstraint).length == 0) {
				var _eachSpaceConstraint = {
					"width": _eachSpaceWidth,
					"rowIndex": i,
					"colIndex": j,
					"margin-left": "0px",
					"margin-right": "0px",
					"margin-top": "3px",
					"margin-bottom": "3px",
				}
			} else {
				var _eachSpaceConstraint = Object.assign({}, this._eachSpaceConstraint, {
					"rowIndex": i,
					"colIndex": j,
				});
			}
			
			//각 일자마다 클릭이벤트 추가
			if (this._createEventMethod != '' && this._createEventMethod != undefined && this._createEventMethod != null) {
				eachSpace.addEventListener("click", this._createEventMethod);
			}
			// 바디내부 숫자가 표시될 영역 아웃풋 ()16*16 / dataType date / format D) 추가
			var eachOutput = new cpr.controls.Output();
			eachOutput.style.addClass("calendar-monthly-date");
			eachOutput.dataType = "date";
			eachOutput.format = "D";
			if (Object.keys(this._eachOutputConstraint).length == 0) {
				var eachOutputConstraint = {
					"height": "16px",
					"width": "16px",
				}
			} else {
				var eachOutputConstraint = this._eachOutputConstraint;
			}
			eachSpace.addChild(eachOutput, eachOutputConstraint);
			bodyBody.addChild(eachSpace, _eachSpaceConstraint);
		}
	}
	
	/*
	 * 달력 데이터 표시하기
	 * [추후수정필요] 다국어 지역 설정 (works globally)
	 * var vsLocale = _app.lookup("dmRes").getValue("locale");
	 * cpr.I18N.INSTANCE.currentLanguage = vsLocale;
	 */
	moment.locale("ko-kr");
	// 일월화수목금토 표기
	setCalendarDayNames(bodyHeader, vsDayOfWeekFom);
	// 요일 표기
	setCalendarDates(bodyBody, mnMFarFromNow, _dsCalId, _holidayTextColorClass, _notThisMonthOptClass, _serverTime);
	
	// 기념일 목록에 넣기
	if (evntOnOff == true) {
		createScheduleEvents(this._app, mnMFarFromNow, this._dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, _serverTime);
	}
	
};

/** 
 * 달력에 그려질 이전달의 말일부터 필요한 date값(ex 이전달의 31,30,29일....)을 리턴하기 위한 함수
 * 
 * @param {Number} mnMFarFromNow 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
 * @param {Number} i 말일부터 for문을 돌려 필요한만큼 값을 리턴하기 위한 변수
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 *  */
function getLastDayOfPrevMonth(mnMFarFromNow, i, _serverTime) {
	return moment(_serverTime).subtract(mnMFarFromNow + 1, 'months').endOf('month').subtract(i, 'days').format('YYYYMMDD')
}

/** 
 * 달력에 그려질 다음달의 1일부터 필요한 date값(ex 다음달의 1,2,3일....)을 리턴하기 위한 함수
 * 
 * @param {Number} mnMFarFromNow 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
 * @param {Number} i 말일부터 for문을 돌려 필요한만큼 값을 리턴하기 위한 변수
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 *  */
function getFirstDayOfNextMonth(mnMFarFromNow, i, _serverTime) {
	return moment(_serverTime).subtract(mnMFarFromNow - 1, 'months').startOf('month').subtract(-i, 'days').format('YYYYMMDD')
}

/**
 * 캘린더 헤더 아웃풋 컨트롤에 날짜 정보를 표시합니다. ex) 2023.04
 * 
 * @_app {#app} app 대상 app
 * @param {cpr.controls.Output} ctl Date 정보가 표시될 아웃풋 컨트롤
 * @param {Number} mnMFarFromNow 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 * @param {Date} poStdDate 기준 날짜 (주 또는 일에서 화면 전환 시 사용되는 파라미터로 미사용)
 */
function setCalendarHeaderDates(app, ctl, mnMFarFromNow, _serverTime, poStdDate) {
	//TODO 기준 날짜를 기준으로 해서 표시될 날짜 정하기
	var voStdDate = moment(_serverTime).subtract(mnMFarFromNow, "months");
	ctl.value = moment(voStdDate).format("YYYY.MM");
	ctl.redraw();
}

/**
 * 캘린더 헤더 콤보박스 컨트롤에 날짜 정보를 표시합니다. ex) 2023 04
 * 
 * @_app {#app} app 대상 app
 * @param {cpr.controls.ComboBox} yCtl Date 정보가 표시될 Year 콤보박스 컨트롤
 * @param {cpr.controls.ComboBox} mCtl Date 정보가 표시될 Month 콤보박스 컨트롤
 * @param {Number} mnMFarFromNow 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 * @param {Date} poStdDate 기준 날짜 (주 또는 일에서 화면 전환 시 사용되는 파라미터로 미사용)
 */
function setCalendarHeaderDatesCmb(app, yCtl, mCtl, mnMFarFromNow, _serverTime, poStdDate) {
	//TODO 기준 날짜를 기준으로 해서 표시될 날짜 정하기
	var voStdDate = moment(_serverTime).subtract(mnMFarFromNow, "months");
	yCtl.value = moment(voStdDate).format("YYYY");
	mCtl.value = moment(voStdDate).format("MM");
	yCtl.redraw();
	mCtl.redraw();
}

/**
 * 캘린더의 요일에 대한 정보를 표시합니다.
 * 
 * @param {cpr.controls.Container} bodyHeader 일월화수목금토가 표기될 헤더 그룹
 * @param {String} vsDayOfWeekFom 일월화수목금토 표기 방식 지정("min" -> MN, "short" -> MON, default -> MONDAY)
 */
function setCalendarDayNames(bodyHeader, vsDayOfWeekFom) {
	var vcGrpDayNm = bodyHeader;
	
	vcGrpDayNm.getChildren().forEach(function( /* cpr.controls.Output */ each, index) {
		/** @type String */
		var vsDayOfWeek = "";
		
		/* 요일 표시 형식 처리 */
		switch (vsDayOfWeekFom) {
			case "min":
				vsDayOfWeek = moment.weekdaysMin(index); // MN
				break;
				
			case "short":
				vsDayOfWeek = moment.weekdaysShort(index); // MON
				break;
				
			default:
				vsDayOfWeek = moment.weekdays(index); // MONDAY
				break;
		}
		
		each.value = vsDayOfWeek.toUpperCase();
	});
}

/**
 * 표시되었던 날짜 정보를 지웁니다.
 * 
 * @param {cpr.controls.Container} bodyBody 날짜 정보를 지울 대상 그룹
 */
function eraseCalendarDates(bodyBody) {
	bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	}).forEach(function( /* cpr.controls.Output */ each) {
		each.value = null;
		
		if (each.style.hasClass("calendar-today")) {
			each.style.removeClass("calendar-today");
		}
	});
}

/**
 * 캘린더의 날짜 정보를 표시합니다.
 * 
 * @param {cpr.controls.Container} bodyBody 날짜 정보를 조정할 대상 그룹
 * @param {Number} mnMFarFromNow 음수는 미래, 양수는 과거 (오늘 날짜 기준, 달)
 * @param {String} _dsCalId 데이터셋id
 * @param {String} _holidayTextColorClass 휴일 text 지정 클래스
 * @param {String} _notThisMonthOptClass 이전달/다음달 text 지정 클래스
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 */
function setCalendarDates(bodyBody, mnMFarFromNow, _dsCalId, _holidayTextColorClass, _notThisMonthOptClass, _serverTime) {
	/* 날짜 정보 초기화 */
	eraseCalendarDates(bodyBody);
	
	var voStdDate = moment(_serverTime).subtract(mnMFarFromNow, "months");
	var voFirstDayOfMonth = moment(voStdDate).startOf("month");
	var vnLastDayOfMonth = moment(voStdDate).daysInMonth();
	var vnStartIdx = voFirstDayOfMonth.weekday();
	
	// 일 표시
	/** @type cpr.controls.Output[] */
	var vaCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	}).slice(vnStartIdx, vnStartIdx + vnLastDayOfMonth);
	
	vaCldrDates.forEach(function( /* cpr.controls.Output */ each, index) {
		var vsEachDate = moment(_serverTime).subtract(mnMFarFromNow, "months")
			.startOf("month").add(index, "days").format("YYYYMMDD");
		each.value = vsEachDate;
		
		// 일요일 구분해서 _holidayTextColorClass 클래스 추가
		var Year = vsEachDate.slice(0, 4);
		var Month = vsEachDate.slice(4, 6) - 1;
		var Day = vsEachDate.slice(6);
		var eachDate = new Date(Year, Month, Day);
		//이전월, 다음월 추가에 추가했던 클래스 제거
		if (each.style.hasClass(_notThisMonthOptClass)) {
			each.style.removeClass(_notThisMonthOptClass);
		}
		if (each.style.hasClass(_holidayTextColorClass)) {
			each.style.removeClass(_holidayTextColorClass);
		}
		if (eachDate.getDay() == 0)
			each.style.addClass(_holidayTextColorClass);
		// 오늘 날짜에 뱃지 추가
		if (moment(_serverTime).format("YYYYMMDD") == vsEachDate) {
			each.style.addClass("calendar-today");
		}
	});
	
	//이전달 말일 부분/다음달 초기 부분 회색으로 표기
	//전월의 데이터를 받아오고 가공해서 전월의 말일 값을 구하고 달력의 1일 시작되는 인덱스를 받아 그 앞부터 역순으로 값 넣어주고 이전월, 다음월의 일 표시
	//이전월
	/** @type cpr.controls.Output[] */
	var vaPrevCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	}).slice(0, vnStartIdx);
	
	var vsPrevEachDate = [];
	for (var i = 0; i < vaPrevCldrDates.length; i++) {
		vsPrevEachDate.push(getLastDayOfPrevMonth(mnMFarFromNow, i, _serverTime));
	}
	vaPrevCldrDates.forEach(function( /* cpr.controls.Output */ each, index) {
		each.value = vsPrevEachDate[vsPrevEachDate.length - index - 1];
		// text 클래스 추가 이전월 추가에 red를 추가했던 것이 있으면 제거
		if (each.style.hasClass(_holidayTextColorClass)) {
			each.style.removeClass(_holidayTextColorClass);
		}
		each.style.addClass(_notThisMonthOptClass);
	});
	
	//다음달 표시 6주차까지 아웃풋을 표시
	var varToCheckCalendarLength = vnStartIdx + vnLastDayOfMonth;
	/** @type cpr.controls.Output[] */
	var vaNextCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	}).slice(varToCheckCalendarLength, 42);
	
	if (vaNextCldrDates.length != 0) {
		var vsNextEachDate = [];
		for (var i = 0; i < vaNextCldrDates.length; i++) {
			vsNextEachDate.push(getFirstDayOfNextMonth(mnMFarFromNow, i, _serverTime));
			vaNextCldrDates.forEach(function( /* cpr.controls.Output */ each, index) {
				each.value = vsNextEachDate[index];
				// text 클래스 추가 다음월 추가에 red를 추가했던 것이 있으면 제거
				if (each.style.hasClass(_holidayTextColorClass)) {
					each.style.removeClass(_holidayTextColorClass);
				}
				each.style.addClass(_notThisMonthOptClass);
			});
		}
	}
	
	//데이터셋에서 휴일 찾아서 배열에 넣고 해당 일자와 일치하는 날이 있다면 빨간색 스타일 추가
	var checkHoliArr = [];
	/** @type cpr.data.DataSet */
	var dsCal = bodyBody.getAppInstance().lookup(_dsCalId);
	var holidayArr = dsCal.findAllRow("isHoliday == 'Y'");
	if (holidayArr) {
		for (var i = 0; i < holidayArr.length; i++) {
			checkHoliArr.push(holidayArr[0].getRowData().beginDt.slice(0, 8));
		}
	}
	vaCldrDates.forEach(function(each) {
		for (var i = 0; i < checkHoliArr.length; i++) {
			if (checkHoliArr[i] == each.value) {
				each.style.addClass(_holidayTextColorClass);
			}
		}
	});
}

/**
 * 캘린더에 일정 정보를 생성하여 표시합니다.
 * @app {#app} app
 * @param {Number} mnMFarFromNow
 * @param {String} dsCalId 데이터셋id
 * @param {cpr.controls.Container} bodyBody 바디영역 컨테이너
 * @param {Object} _editScheduleEvntMethod 생성된 일정의 클릭 이벤트에 사용될 함수
 * @param {Object} viewDetailEvntMethod 일정보기 클릭시 실행할 함수 
 * @param {String} _serverTime 서버 시간 사용을 위한 변수
 */
function createScheduleEvents(app, mnMFarFromNow, dsCalId, bodyBody, _editScheduleEvntMethod, viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, _serverTime) {
	//top컨테이너의 크기에 따라 표기방식 변경
	var moreWidth;
	var moreWidthOver = 50;
	var detailValueOver = "+ 더보기";
	if (eachSpaceWidth >= 50) {
		moreWidth = 45;
		detailValueOver = "+ 더보기";
	} else {
		moreWidth = 10;
		detailValueOver = "+";
	}
	
	//각 일자에 일정이 1개 들어있을 때 추가로 들어갈 수 있는 일정 아웃풋의 숫자
	var canInsertOptCount = Math.floor((eachSpaceHeight - 41) / 24);
	//해당 일자의 일정 수 카운트
	var duplicatedCount = 0;
	
	/* 일정 정보 초기화 */
	if (bodyBodyContainerHeight < 320) {
		removeScheduleEventsUnder(bodyBody);
	} else {
		removeScheduleEvents(bodyBody);
	}
	
	var voStdDate = moment(_serverTime).subtract(mnMFarFromNow, "months");
	var checkYearAniv = moment(voStdDate).startOf("month").format("YYYY");
	var vsStdBgnDt = moment(voStdDate).startOf("month").format("YYYYMM");
	var vsStdEndDt = moment(voStdDate).endOf("month").format("YYYYMM");
	var vsEvntCond = "beginDt ^= " + vsStdBgnDt + " || endDt ^= " + vsStdEndDt;
	
	// 이전월, 다음월의 일 표시 이전달의첫날/다음달의말날 구해서 begintDt/endDt수정하기
	var voFirstDayOfMonth = moment(voStdDate).startOf("month");
	var vnLastDayOfMonth = moment(voStdDate).daysInMonth();
	var vnStartIdx = voFirstDayOfMonth.weekday();
	
	/** @type cpr.controls.Output[] */
	var vaPrevCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	}).slice(0, vnStartIdx);
	
	var vsPrevEachDate = [];
	if (vaPrevCldrDates.length != 0) {
		for (var i = 0; i < vaPrevCldrDates.length; i++)
			vsPrevEachDate.push(getLastDayOfPrevMonth(mnMFarFromNow, i, _serverTime));
		for (var i = 0; i < vsPrevEachDate.length; i++)
			vsEvntCond += " || beginDt ^= " + vsPrevEachDate[i];
	}
	
	/** @type cpr.controls.Output[] */
	var vaNextCldrDates = [];
	var varToCheckCalendarLength = vnStartIdx + vnLastDayOfMonth;
	if (28 <= varToCheckCalendarLength && varToCheckCalendarLength <= 35) {
		vaNextCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
			return each.style.hasClass("calendar-monthly-date");
		}).slice(varToCheckCalendarLength, 35);
		
	} else if (36 <= varToCheckCalendarLength) {
		vaNextCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
			return each.style.hasClass("calendar-monthly-date");
		}).slice(varToCheckCalendarLength, 42);
	}
	
	var vsNextEachDate = [];
	if (vaNextCldrDates.length != 0) {
		for (var i = 0; i < vaNextCldrDates.length; i++) {
			vsNextEachDate.push(getFirstDayOfNextMonth(mnMFarFromNow, i, _serverTime));
		}
		for (var i = 0; i < vsNextEachDate.length; i++)
			vsEvntCond += " || beginDt ^= " + vsNextEachDate[i];
	}
	
	/** @type cpr.data.DataRow[] */
	var vaThisMonthEvents = app.lookup(dsCalId).findAllRow(vsEvntCond);
	if (vaThisMonthEvents.length == 0) {
		return;
	}
	
	//이벤트 시간순 정렬
	vaThisMonthEvents.sort(function(a, b) {
		a.getRowData().beginDt.localeCompare(b.getRowData().beginDt);
	})
	
	// 시작일자부터 종료일자까지 배열에 넣기
	var vcCldrDateArr = [];
	vaThisMonthEvents.forEach(function(each) {
		var voEvntData = each.getRowData();
		var vcCldrDate = getCalendarDate(voEvntData.beginDt, voEvntData.endDt, bodyBody);
		
		for (var j = 0; j < vcCldrDate.length; j++) {
			vcCldrDateArr.push(vcCldrDate[j].value);
		}
	})
	
	// 기념일 이전달/다음달도 표시되게
	vaThisMonthEvents.forEach(function(each) {
		/** @type {{id:Number, label:String, creater:String, beginDt:String, endDt:String, memo:String, allDay:String, class:String, isHoliday:String}} */
		var voEvntData = each.getRowData();
		
		// 시작일자부터 종료일자까지의 아웃풋
		var vcCldrDate = getCalendarDate(voEvntData.beginDt, voEvntData.endDt, bodyBody);
		
		// 각 일정의 시작일부터 종료일까지 포문으로 아웃풋 생성
		for (var i = 0; i < vcCldrDate.length; i++) {
			//해당 일자의 일정 수 카운트
			duplicatedCount = 0;
			for (var j = 0; j < vcCldrDateArr.length; j++) {
				if (vcCldrDateArr[j] === vcCldrDate[i].value) {
					duplicatedCount++;
				}
			}
			
			var vcEvnt = new cpr.controls.Output(voEvntData.id);
			//이전달,다음달 스타일 처리
			if (!voEvntData.beginDt.includes(vsStdBgnDt)) {
				vcEvnt.style.addClass("notThisMonthOpt");
			}
			
			vcEvnt.ellipsis = true;
			vcEvnt.value = voEvntData.label;
			vcEvnt.tooltip = voEvntData.label;
			if (voEvntData.beginDt.substring(0, 8) != voEvntData.endDt.substring(0, 8)) {
				voEvntData.allDay = "true";
			}
			vcEvnt.style.setClasses("monthly-schedule-event-title", voEvntData.class);
			
			//캘린더의 일정 클릭 이벤트
			if (_editScheduleEvntMethod != '' && _editScheduleEvntMethod != undefined && _editScheduleEvntMethod != null){
				vcEvnt.addEventListener("click", _editScheduleEvntMethod);
			}
			
			if (voEvntData.allDay == "true") {
				vcEvnt.style.addClass("full-time");
			} else {
				vcEvnt.value = moment(voEvntData.beginDt, "YYYYMMDDhhmm").format("hh:mm") + " " + vcEvnt.value;
				vcEvnt.style.addClass("not-full-time");
			}
			
			//카운트와 컨테이너높이로 일정 추가 조건
			if (bodyBodyContainerHeight < 320) {
				if (vcCldrDate[i].getParent().getChildren().length == 1) {
					// 일정1개 n일목록시작개수n개 / +더보기 표시 / n일목록끝
					var listStartOpt = new cpr.controls.Output;
					listStartOpt.style.setClasses("evntlist", "cl-sound-only");
					if (vcCldrDate[i].value.slice(-2, -1) == "0") {
						listStartOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록시작 일정개수" + duplicatedCount + "개";
					} else {
						listStartOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록시작 일정개수" + duplicatedCount + "개";
					}
					vcCldrDate[i].getParent().addChild(listStartOpt, {
						width: 0,
						height: 0
					})
					
					var viewDetail = new cpr.controls.Output();
					viewDetail.style.setClasses("viewDetailOpt");
					if (!voEvntData.beginDt.includes(vsStdBgnDt)) viewDetail.style.addClass("notThisMonthOpt");
					viewDetail.ellipsis = true;
					viewDetail.style.css("font-size", "12px");
					viewDetail.style.addClass("not-full-time");
					viewDetail.value = detailValueOver;
					if (viewDetailEvntMethod != '' && viewDetailEvntMethod != undefined && viewDetailEvntMethod != null) {
						viewDetail.addEventListener("click", viewDetailEvntMethod);
					}
					vcCldrDate[i].getParent().addChild(viewDetail, {
						height: "20px",
						width: moreWidth + "px"
					});
					
					var listEndOpt = new cpr.controls.Output;
					listEndOpt.style.setClasses("evntlist", "cl-sound-only");
					if (vcCldrDate[i].value.slice(-2, -1) == "0") {
						listEndOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록끝";
					} else {
						listEndOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록끝";
					}
					vcCldrDate[i].getParent().addChild(listEndOpt, {
						width: 0,
						height: 0
					});
				}
				
			//크기 320이상
			} else if (bodyBodyContainerHeight >= 320) {
				if (duplicatedCount > 1) {
					//처음 일정시작목록 넣음
					if (vcCldrDate[i].getParent().getChildren().length == 1) {
						//일정1개 n일목록시작개수n개/일정1/n일목록끝
						var listStartOpt = new cpr.controls.Output;
						listStartOpt.style.setClasses("evntlist", "cl-sound-only");
						if (vcCldrDate[i].value.slice(-2, -1) == "0") {
							listStartOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록시작 일정개수" + duplicatedCount + "개";
						} else {
							listStartOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록시작 일정개수" + duplicatedCount + "개";
						}
						vcCldrDate[i].getParent().addChild(listStartOpt, {
							width: 0,
							height: 0
						});
					}
					
					//각 일정컨테이너에 표기할 수 있는 수 제한을 넘었을 때 더보기 표시
					if (canInsertOptCount - vcCldrDate[i].getParent().getChildren().length + 2 == 0 && duplicatedCount > canInsertOptCount + 1) {
						var viewDetailContainer = new cpr.controls.Container();
						viewDetailContainer.style.setClasses("viewDetailContainer");
						var viewDetailContainerLayout = new cpr.controls.layouts.FlowLayout();
						viewDetailContainerLayout.leftMargin = "0px";
						viewDetailContainerLayout.rightMargin = "0px",
						viewDetailContainerLayout.topMargin = "0px";
						viewDetailContainerLayout.bottomMargin = "0px";
						viewDetailContainerLayout.horizontalSpacing = "0px",
						viewDetailContainerLayout.verticalSpacing = "0px";
						viewDetailContainerLayout.scrollable = false;
						viewDetailContainer.setLayout(viewDetailContainerLayout);
						
						var viewDetail = new cpr.controls.Output();
						viewDetail.style.setClasses("viewDetailOpt");
						viewDetail.ellipsis = true;
						viewDetail.style.css("font-size", "12px");
						viewDetail.style.addClass("not-full-time");
						viewDetail.value = detailValueOver;
						if (!voEvntData.beginDt.includes(vsStdBgnDt)) viewDetail.style.addClass("notThisMonthOpt");
						if (viewDetailEvntMethod != '' && viewDetailEvntMethod != undefined && viewDetailEvntMethod != null) {
							viewDetail.addEventListener("click", viewDetailEvntMethod);
						}
						viewDetailContainer.addChild(viewDetail, {
							height: "20px",
							width: moreWidthOver
						});
						vcCldrDate[i].getParent().addChild(viewDetailContainer, {
							height: "20px",
							width: moreWidthOver
						});
					}
					
					//각 일정컨테이너에 표기할 수 있는 일정만큼 표시([각 칸의 자식 갯수] < [현재 컨테이너에 일정이 하나 들어있을 때 추가할 수 있는 수 + {날짜+목록시작+일정1}])
					if (vcCldrDate[i].getParent().getChildren().length < canInsertOptCount + 3) {
						if (!voEvntData.beginDt.includes(vsStdBgnDt)) vcEvnt.style.addClass("notThisMonthOpt");
						vcCldrDate[i].getParent().addChild(vcEvnt, {
							height: "20px",
							width: "100%"
						});
					}
					
					//목록끝추가부분
					if (vcCldrDate[i].getParent().getChildren().length == duplicatedCount + 2 && duplicatedCount <= canInsertOptCount + 1) {
						var listEndOpt = new cpr.controls.Output;
						listEndOpt.style.setClasses("evntlist", "cl-sound-only");
						if (vcCldrDate[i].value.slice(-2, -1) == "0") {
							listEndOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록끝";
						} else {
							listEndOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록끝";
						}
						vcCldrDate[i].getParent().addChild(listEndOpt, {
							width: 0,
							height: 0
						});
					}
					
					//일정표기해야할것이 표기해야하는것보다 많을 때
					if (duplicatedCount > canInsertOptCount && canInsertOptCount + 3 == vcCldrDate[i].getParent().getChildren().length) {
						var listEndOpt = new cpr.controls.Output;
						listEndOpt.style.setClasses("evntlist", "cl-sound-only");
						if (vcCldrDate[i].value.slice(-2, -1) == "0") {
							listEndOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록끝";
						} else {
							listEndOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록끝";
						}
						vcCldrDate[i].getParent().addChild(listEndOpt, {
							width: 0,
							height: 0
						});
					}
					//일정1개
				} else {
					//일정목록시작
					var listStartOpt = new cpr.controls.Output;
					listStartOpt.style.setClasses("evntlist", "cl-sound-only");
					if (vcCldrDate[i].value.slice(-2, -1) == "0") {
						listStartOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록시작 일정개수" + duplicatedCount + "개";
					} else {
						listStartOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록시작 일정개수" + duplicatedCount + "개";
					}
					vcCldrDate[i].getParent().addChild(listStartOpt, {
						width: 0,
						height: 0
					});
					
					//일정
					if (canInsertOptCount > -1) {
						if (!voEvntData.beginDt.includes(vsStdBgnDt)) vcEvnt.style.addClass("notThisMonthOpt");
						vcCldrDate[i].getParent().addChild(vcEvnt, {
							height: "20px",
							width: "100%"
						});
					}
					
					//일정목록끝
					var listEndOpt = new cpr.controls.Output;
					listEndOpt.style.setClasses("evntlist", "cl-sound-only");
					if (vcCldrDate[i].value.slice(-2, -1) == "0") {
						listEndOpt.value = vcCldrDate[i].value.slice(-1) + "일 목록끝";
					} else {
						listEndOpt.value = vcCldrDate[i].value.slice(-2) + "일 목록끝";
					}
					vcCldrDate[i].getParent().addChild(listEndOpt, {
						width: 0,
						height: 0
					});
				}
			}
		}
	});
}

/**
 * 캘린더에 그려졌던 일정 정보를 제거합니다.
 * @param {cpr.controls.Container} bodyBody 바디영역 컨테이너
 */
function removeScheduleEvents(bodyBody) {
	bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("monthly-schedule-event-title") || each.style.hasClass("evntlist") || each.style.hasClass("viewDetailContainer");
	}).forEach(function( /* cpr.controls.Output */ each) {
		each.getParent().removeChild(each, true);
	});
}

/**
 * 캘린더에 그려졌던 일정 정보를 제거합니다.
 * @param {cpr.controls.Container} bodyBody 바디영역 컨테이너
 */
function removeScheduleEventsUnder(bodyBody) {
	bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("monthly-schedule-event-title") || each.style.hasClass("evntlist") || each.style.hasClass("viewDetailOpt");
	}).forEach(function( /* cpr.controls.Output */ each) {
		each.getParent().removeChild(each, true);
	});
}

/**
 * 일치하는 날짜 컨트롤을 반환합니다.
 * @param {String} psValue 시작일자
 * @param {String} psValue2 종료일자
 * @param {cpr.controls.Container} bodyBody 바디영역 컨테이너
 * @return {cpr.controls.Output}
 * 
 * @alt 모든 날짜 컨트롤을 반환합니다.
 * @return {cpr.controls.Output[]}
 */
function getCalendarDate(psValue, psValue2, bodyBody) {
	/** @type cpr.controls.Output[] */
	var vaCldrDates = bodyBody.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-monthly-date");
	});
	
	if (!_.isString(psValue)) {
		psValue = psValue.toString();
	}
	
	if (moment(psValue, "YYYYMMDDhhmm").isValid()) {
		return vaCldrDates.filter(function( /* cpr.controls.Output */ each) {
			return each.value >= psValue.substring(0, 8) && each.value <= psValue2.substring(0, 8);
		});
	}
	
	return vaCldrDates;
}

/** 
 * 이벤트를 추가해서 표시해줍니다.
 * 인덱스id
 * 제목label
 * 작성자creater
 * 일정구분class->색상설정
 * 종일설정allDay
 * 시작일자beginDt
 * 종료일자endDt
 * 내용memo
 * 휴일구분isHoliday
 * @param {Object} data 추가할 데이터
 */
CalendarKit.prototype.createEvnt = function(data) {
	/** @type cpr.controls.Container */
	var topContainer = this._drawCalendarGrp;
	var headerOnOff = this.headerOnOff;
	// 달력이 그려질 그룹의 높이를 통해 계산 후 일정을 표시하기위해 변수에 저장
	var topContainerHeight = topContainer.getOffsetRect().height;
	
	//constraint 설정 - _headerConstraint
	if (headerOnOff == true) {
		//option이 없으면 기본값 사용
		if (Object.keys(this._headerConstraint).length > 0) {
			this._headerConstraint;
		} else {
			this._headerConstraint = {
				"height": "30px",
				"width": "100%",
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			};
		}
	}
	//constraint 설정 - _bodyConstraint
	if (Object.keys(this._bodyConstraint).length == 0) {
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - this._topContainerBottomMargin;
			} else {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - this._topContainerBottomMargin;
			}
			this._bodyConstraint = {
				"top": "40px",
				"height": bodyHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		} else {
			this._bodyConstraint = {
				"height": topContainerHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		}
	}
	//constraint 설정 - _bodyHeaderConstraint
	if (Object.keys(this._bodyHeaderConstraint).length == 0) {
		this._bodyHeaderConstraint = {
			"height": "30px",
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	//constraint 설정 - _bodyBodyConstraint
	if (Object.keys(this._bodyBodyConstraint).length == 0) {
		if (this._bodyHeaderConstraint.height && this._bodyConstraint.height) {
			var bodyHeaderHeight = calculateConstraint(this._bodyHeaderConstraint.height, this._bodyConstraint.height);
		}
		
		var bodyBodyHeight = 0;
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - bodyHeaderHeight - this._topContainerBottomMargin;
			}
		} else {
			bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - bodyHeaderHeight - this._topContainerBottomMargin;
		}
		this._bodyBodyConstraint = {
			"top": "30px",
			"height": bodyBodyHeight,
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	// 요일 칸의 width, height 계산식
	var bodyContainerWidth = calculateConstraint(this._bodyConstraint.width, topContainer.getOffsetRect().width);
	var bodyBodyContainerHeight = calculateConstraint(this._bodyBodyConstraint.height, topContainerHeight);
	var bodyBodyHeight = calculateConstraint(this._bodyBodyConstraint.height, this._bodyConstraint.height);
	var eachSpaceWidth = Math.floor(bodyContainerWidth / 7);
	var eachSpaceHeight = Math.floor(bodyBodyHeight / 6);
	
	/** @type cpr.data.DataSet */
	var dsCal = this._app.lookup(this._dsCalId);
	dsCal.addRowData(data);
	var topContainerHeight = this._drawCalendarGrp.getOffsetRect().height;
	var _yearMonthOptType = this.yearMonthOptType;
	var bodyBody = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-month");
	})[0];
	var mnMFarFromNow = 0;
	var voStdDate = moment(this._serverTime).subtract(mnMFarFromNow, "months");
	var momentYear = moment(voStdDate).format("YYYY");
	var momentMonth = moment(voStdDate).format("MM");
	if (this.headerOnOff == true) {
		var selectedYearValue = "";
		var selectedMonthValue = "";
		if (this.yearMonthOptType == "cmb") {
			/** @type cpr.controls.ComboBox */
			var mmYearCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmYearCmb");
			})[0];
			/** @type cpr.controls.ComboBox */
			var mmMonthCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmMonthCmb");
			})[0];
			selectedYearValue = mmYearCmb.value;
			selectedMonthValue = mmMonthCmb.value;
			
		} else {
			/** @type cpr.controls.Output */
			var mmYMOpt = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("calendar-header-title");
			})[0];
			selectedYearValue = mmYMOpt.value.slice(0, 4);
			selectedMonthValue = mmYMOpt.value.slice(5);
		}
		var diffYear = selectedYearValue - momentYear;
		var diffMonth = selectedMonthValue - momentMonth;
		if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
			mnMFarFromNow = -(diffYear * 12 + diffMonth);
		}
	}
	
	//일정표기
	if (this._editScheduleEvntMethod != '' && this._editScheduleEvntMethod != undefined && this._editScheduleEvntMethod != null) {
		var _editScheduleEvntMethod = this._editScheduleEvntMethod;
	}
	if (this._viewDetailEvntMethod != '' && this._viewDetailEvntMethod != undefined && this._viewDetailEvntMethod != null) {
		var _viewDetailEvntMethod = this._viewDetailEvntMethod;
	}
	if (this.evntOnOff == true) {
		createScheduleEvents(this._app, mnMFarFromNow, this._dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, this._serverTime);
	}
	
};

/** 
 * 이벤트를 삭제 후 표시해줍니다.
 * @param {String} data 삭제할 데이터를 검색 할 조건식
 */
CalendarKit.prototype.deleteEvnt = function(data) {
	/** @type cpr.controls.Container */
	var topContainer = this._drawCalendarGrp;
	var headerOnOff = this.headerOnOff;
	// 달력이 그려질 그룹의 높이를 통해 계산 후 일정을 표시하기위해 변수에 저장
	var topContainerHeight = topContainer.getOffsetRect().height;
	
	//constraint 설정 - _headerConstraint
	if (headerOnOff == true) {
		//option이 없으면 기본값 사용
		if (Object.keys(this._headerConstraint).length > 0) {
			this._headerConstraint;
		} else {
			this._headerConstraint = {
				"height": "30px",
				"width": "100%",
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			};
		}
	}
	//constraint 설정 - _bodyConstraint
	if (Object.keys(this._bodyConstraint).length == 0) {
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - this._topContainerBottomMargin;
			} else {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - this._topContainerBottomMargin;
			}
			this._bodyConstraint = {
				"top": "40px",
				"height": bodyHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		} else {
			this._bodyConstraint = {
				"height": topContainerHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		}
	}
	//constraint 설정 - _bodyHeaderConstraint
	if (Object.keys(this._bodyHeaderConstraint).length == 0) {
		this._bodyHeaderConstraint = {
			"height": "30px",
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	//constraint 설정 - _bodyBodyConstraint
	if (Object.keys(this._bodyBodyConstraint).length == 0) {
		if (this._bodyHeaderConstraint.height && this._bodyConstraint.height) {
			var bodyHeaderHeight = calculateConstraint(this._bodyHeaderConstraint.height, this._bodyConstraint.height);
		}
		
		var bodyBodyHeight = 0;
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - bodyHeaderHeight - this._topContainerBottomMargin;
			}
		} else {
			bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - bodyHeaderHeight - this._topContainerBottomMargin;
		}
		this._bodyBodyConstraint = {
			"top": "30px",
			"height": bodyBodyHeight,
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	// 요일 칸의 width, height 계산식
	var bodyContainerWidth = calculateConstraint(this._bodyConstraint.width, topContainer.getOffsetRect().width);
	var bodyBodyContainerHeight = calculateConstraint(this._bodyBodyConstraint.height, topContainerHeight);
	var bodyBodyHeight = calculateConstraint(this._bodyBodyConstraint.height, this._bodyConstraint.height);
	var eachSpaceWidth = Math.floor(bodyContainerWidth / 7);
	var eachSpaceHeight = Math.floor(bodyBodyHeight / 6);
	
	/** @type cpr.data.DataSet */
	var dsCal = this._app.lookup(this._dsCalId);
	var allRow = dsCal.findAllRow(data);
	if (allRow) {
		for (var i = 0; i < allRow.length; i++) {
			dsCal.realDeleteRow(allRow[i].getIndex());
		}
	}
	var topContainerHeight = this._drawCalendarGrp.getOffsetRect().height;
	var _yearMonthOptType = this.yearMonthOptType;
	var bodyBody = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-month");
	})[0];
	var mnMFarFromNow = 0;
	var voStdDate = moment(this._serverTime).subtract(mnMFarFromNow, "months");
	var momentYear = moment(voStdDate).format("YYYY");
	var momentMonth = moment(voStdDate).format("MM");
	if (this.headerOnOff == true) {
		var selectedYearValue = "";
		var selectedMonthValue = "";
		if (this.yearMonthOptType == "cmb") {
			/** @type cpr.controls.ComboBox */
			var mmYearCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmYearCmb");
			})[0];
			/** @type cpr.controls.ComboBox */
			var mmMonthCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmMonthCmb");
			})[0];
			selectedYearValue = mmYearCmb.value;
			selectedMonthValue = mmMonthCmb.value;
			
		} else {
			/** @type cpr.controls.Output */
			var mmYMOpt = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("calendar-header-title");
			})[0];
			selectedYearValue = mmYMOpt.value.slice(0, 4);
			selectedMonthValue = mmYMOpt.value.slice(5);
		}
		var diffYear = selectedYearValue - momentYear;
		var diffMonth = selectedMonthValue - momentMonth;
		if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
			mnMFarFromNow = -(diffYear * 12 + diffMonth);
		}
	}
	
	//일정표기
	if (this._editScheduleEvntMethod != '' && this._editScheduleEvntMethod != undefined && this._editScheduleEvntMethod != null) {
		var _editScheduleEvntMethod = this._editScheduleEvntMethod;
	}
	if (this._viewDetailEvntMethod != '' && this._viewDetailEvntMethod != undefined && this._viewDetailEvntMethod != null) {
		var _viewDetailEvntMethod = this._viewDetailEvntMethod;
	}
	if (this.evntOnOff == true)
		createScheduleEvents(this._app, mnMFarFromNow, this._dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, this._serverTime);
};

/** 
 * 이벤트를 수정 후 표시해줍니다.
 * 인덱스id
 * 제목label
 * 작성자creater
 * 일정구분class->색상설정
 * 종일설정allDay
 * 시작일자beginDt
 * 종료일자endDt
 * 내용memo
 * 휴일구분isHoliday
 * @param {String} data 수정할 데이터를 검색 할 조건식
 * @param {Object} updateData 수정할 데이터
 */
CalendarKit.prototype.updateEvnt = function(data, updateData) {
	/** @type cpr.controls.Container */
	var topContainer = this._drawCalendarGrp;
	var headerOnOff = this.headerOnOff;
	// 달력이 그려질 그룹의 높이를 통해 계산 후 일정을 표시하기위해 변수에 저장
	var topContainerHeight = topContainer.getOffsetRect().height;
	
	//constraint 설정 - _headerConstraint
	if (headerOnOff == true) {
		//option이 없으면 기본값 사용
		if (Object.keys(this._headerConstraint).length > 0) {
			this._headerConstraint;
		} else {
			this._headerConstraint = {
				"height": "30px",
				"width": "100%",
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			};
		}
	}
	//constraint 설정 - _bodyConstraint
	if (Object.keys(this._bodyConstraint).length == 0) {
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - this._topContainerBottomMargin;
			} else {
				var bodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - this._topContainerBottomMargin;
			}
			this._bodyConstraint = {
				"top": "40px",
				"height": bodyHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		} else {
			this._bodyConstraint = {
				"height": topContainerHeight,
				"width": "100%",
				"rowIndex": 0,
				"colIndex": 0,
				"rowSpan": 1,
				"colSpan": 2,
				"margin-left": "0px",
				"margin-right": "0px",
				"margin-top": "0px",
				"margin-bottom": "0px",
			}
		}
	}
	//constraint 설정 - _bodyHeaderConstraint
	if (Object.keys(this._bodyHeaderConstraint).length == 0) {
		this._bodyHeaderConstraint = {
			"height": "30px",
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	//constraint 설정 - _bodyBodyConstraint
	if (Object.keys(this._bodyBodyConstraint).length == 0) {
		if (this._bodyHeaderConstraint.height && this._bodyConstraint.height) {
			var bodyHeaderHeight = calculateConstraint(this._bodyHeaderConstraint.height, this._bodyConstraint.height);
		}
		
		var bodyBodyHeight = 0;
		if (headerOnOff == true) {
			if (this._headerConstraint.height) {
				bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - calculateConstraint(this._headerConstraint.height, topContainerHeight) - bodyHeaderHeight - this._topContainerBottomMargin;
			}
		} else {
			bodyBodyHeight = topContainerHeight - this._topContainerSpacing - this._topContainerTopMargin - bodyHeaderHeight - this._topContainerBottomMargin;
		}
		this._bodyBodyConstraint = {
			"top": "30px",
			"height": bodyBodyHeight,
			"width": "100%",
			"rowIndex": 0,
			"colIndex": 0,
			"rowSpan": 1,
			"colSpan": 2,
			"margin-left": "0px",
			"margin-right": "0px",
			"margin-top": "0px",
			"margin-bottom": "0px",
		}
	}
	
	// 요일 칸의 width, height 계산식
	var bodyContainerWidth = calculateConstraint(this._bodyConstraint.width, topContainer.getOffsetRect().width);
	var bodyBodyContainerHeight = calculateConstraint(this._bodyBodyConstraint.height, topContainerHeight);
	var bodyBodyHeight = calculateConstraint(this._bodyBodyConstraint.height, this._bodyConstraint.height);
	var eachSpaceWidth = Math.floor(bodyContainerWidth / 7);
	var eachSpaceHeight = Math.floor(bodyBodyHeight / 6);
	
	/** @type cpr.data.DataSet */
	var dsCal = this._app.lookup(this._dsCalId);
	var allRow = dsCal.findAllRow(data);
	if (allRow) {
		for (var i = 0; i < allRow.length; i++)
			dsCal.updateRow(allRow[i].getIndex(), updateData);
	}
	var topContainerHeight = this._drawCalendarGrp.getOffsetRect().height;
	var _yearMonthOptType = this.yearMonthOptType;
	var bodyBody = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
		return each.style.hasClass("calendar-month");
	})[0];
	var mnMFarFromNow = 0;
	var voStdDate = moment(this._serverTime).subtract(mnMFarFromNow, "months");
	var momentYear = moment(voStdDate).format("YYYY");
	var momentMonth = moment(voStdDate).format("MM");
	if (this.headerOnOff == true) {
		var selectedYearValue = "";
		var selectedMonthValue = "";
		if (this.yearMonthOptType == "cmb") {
			/** @type cpr.controls.ComboBox */
			var mmYearCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmYearCmb");
			})[0];
			/** @type cpr.controls.ComboBox */
			var mmMonthCmb = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("mmMonthCmb");
			})[0];
			selectedYearValue = mmYearCmb.value;
			selectedMonthValue = mmMonthCmb.value;
			
		} else {
			/** @type cpr.controls.Output */
			var mmYMOpt = this._drawCalendarGrp.getAllRecursiveChildren(false).filter(function(each) {
				return each.style.hasClass("calendar-header-title");
			})[0];
			selectedYearValue = mmYMOpt.value.slice(0, 4);
			selectedMonthValue = mmYMOpt.value.slice(5);
		}
		var diffYear = selectedYearValue - momentYear;
		var diffMonth = selectedMonthValue - momentMonth;
		if (-(diffYear * 12 + diffMonth) != mnMFarFromNow) {
			mnMFarFromNow = -(diffYear * 12 + diffMonth);
		}
	}
	
	//일정표기
	if (this._editScheduleEvntMethod != '' && this._editScheduleEvntMethod != undefined && this._editScheduleEvntMethod != null) {
		var _editScheduleEvntMethod = this._editScheduleEvntMethod;
	}
	if (this._viewDetailEvntMethod != '' && this._viewDetailEvntMethod != undefined && this._viewDetailEvntMethod != null) {
		var _viewDetailEvntMethod = this._viewDetailEvntMethod;
	}
	if (this.evntOnOff == true) {
		createScheduleEvents(this._app, mnMFarFromNow, this._dsCalId, bodyBody, _editScheduleEvntMethod, _viewDetailEvntMethod, eachSpaceWidth, eachSpaceHeight, bodyBodyContainerHeight, this._serverTime);
	}
};

function hasKey(arr, key) {
	for (var i = 0; i < arr.length; i++) {
		if (key in arr[i]) {
			return true;
		}
	}
	return false;
}

/** 
 * 캘린더를 그려줍니다
 * @app {#app} app 해당 앱
 * @param {String} grpId 캘린더를 그릴 그룹Id
 * @param {String} dsCalId 달력에 사용될 데이터셋 이름
 * @param {
 *   createEventMethod : Object = `각 요일의 이벤트 설정`,
 *   editScheduleEvntMethod : Object = `일정의 이벤트 설정`,
 *   viewDetailEvntMethod : Object = `+더보기(일정 더보기) 클릭 이벤트 설정`
 * } options
 */
exports.getCalendarData = function(app, grpId, dsCalId, options) {
	return new CalendarKit(app, grpId, dsCalId, options);
};
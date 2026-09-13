/************************************************
 * properties.module.js
 * Created at 2021. 12. 20. 오후 3:36:06.
 *
 * @author 
 ************************************************/

function AppProperties(){
};

/* 스크린 */
AppProperties.prototype.SCREEN_DEFAULT_NM  = ["default", "EXB-FULL"];	// 기본(pc) 스크린 명
AppProperties.prototype.SCREEN_TABLET_NM   = ["tablet", "EXB-DIV"];	// 태블릿 스크린 명
AppProperties.prototype.SCREEN_MOBILE_NM   = ["mobile", "EXB-PART"];	// 모바일 스크린 명

/* 메인 */
AppProperties.prototype.MAIN_APP_ID  = "app/com/Main";	// 메인 app id
AppProperties.prototype.MSG_TOPIC_ID = "app-msg";		// NotificationCenter 메시지 구독 ID (메인에서 subscribe)
AppProperties.prototype.MAIN_EMB_CONTROL_ID = "mdiCn"; // 메인화면 내 콘텐츠(임베디드) 영역 컨트롤 id (MDI폴더 or 임베디드앱)
AppProperties.prototype.MAIN_MENU_INFO = "__menuInfo"; // 선택된 메뉴의 메뉴 정보를 담는 사용자속성명, (MDI폴더의 경우, TabItem.userAttr() 로 설정됨)

/* 조회조건 */
AppProperties.prototype.SEARCH_BTN_ID = "btnSearch";	// 공통 조회 버튼 ID (조회조건 초기화에서 사용)

/* 그리드 */
AppProperties.prototype.GRID_INDEX_COL_HEADER_TEXT = "No";	// 그리드 columnType이 rowindex인 컬럼의 헤더 텍스트
AppProperties.prototype.GRID_STATE_COL_HEADER_TEXT = "F";	// 그리드 로우의 CRUD를 표시하는 컬럼의 헤더 텍스트

/* 다이얼로그 */
AppProperties.prototype.DIALOG_MAX_HEIGHT = 760; // 자동높이 사용시(height : -1) 다이얼로그 최대 높이

/* 유효성 체크 */
AppProperties.prototype.VALID_REQUIRED_CLASS = "required" ;	// 필수 style class명  ","(콤마) 구분자로 다중 class 적용.

/* 그리드 타이틀 */
AppProperties.prototype.USE_CLIENT_EXCEL_DOWLOAD = true; // client excel 다운로드 기능을 사용할지 여부

globals.AppProperties = new AppProperties();

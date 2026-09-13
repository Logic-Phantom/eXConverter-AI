/************************************************
 * appStack.module.js
 * Created at 2022. 7. 5. 오후 6:54:45.
 *
 * @author skyha
 ************************************************/

/* 앱스택 변수 *******************************************************************/

var _LAST_KNOWN_STATE_ID = 0;
/**
 * 현재 앱 스택. 화면이 열린 후 열렸던 화면에 대한 스택을 쌓습니다.
 * @type StackInfo[]
 */
var _stack = [];

/**
 * 앞으로 가기 앱 스택.
 * @type StackInfo[]
 */
var _redoStack = [];
var appStackInfo = null;
/* **************************************************************************************************/

/**
 * AppStack(앱스택) 유틸
 * @constructor
 * @param {common.module} appKit
 */
function AppStackKit(appKit){
	this._appKit = appKit;

};

/**
 * 메시지 ID에 해당되는 메시지를 반환한다.
 * @param {function} PopStateEvent 이벤트 후 콜백 메소드
 */
AppStackKit.prototype.start = function(fnCallBack) {
	
	//앱스택 정보를 저장
	appStackInfo = (function(fnCallBack){
		var voFnCallBack = fnCallBack;
		return {
			getFnCallBack : function(){
				return voFnCallBack;
			}
		}
	})(fnCallBack);
	
	window.addEventListener("popstate", handlePoppedState);
    
};

AppStackKit.prototype.stop = function(){
	appStackInfo = null;
	window.removeEventListener("popstate", handlePoppedState);
} 

/**
 * @param {String} appId 스택을 쌓을 appId
 */
AppStackKit.prototype.push = function(appId){
//	var type = appStackInfo.getType();
	var newInfo = new StackInfo(appId);
	_stack.push(newInfo);
	if (_stack.length === 1) {
		history.replaceState(newInfo.state, appId);
	} else {
		history.pushState(newInfo.state, appId);
	}
}

/**
 * 브라우저의 popstate 이벤트를 처리하는 핸들러.
 * @param {PopStateEvent} e
 */
function handlePoppedState(e) {
	var state = e.state;
	if (!state) {
		return;
	}
	var prevAppInfo = _stack.filter(function( /* StackInfo */ each) {
		return each.state.id == state["id"];
	})[0];
	
	// 이후 기록에서 일치하는 항목 검색.
	var nextAppInfo = _redoStack.filter(function( /* StackInfo */ each) {
		return each.state.id == state["id"];
	})[0];
	
	var current;
	
	// 이전 항목 일치 처리.
	if (prevAppInfo) {
		while (getActiveStackInfo() != prevAppInfo) {
			if (_stack.length === 0) {
				return;
			}
			var current = _stack.pop();
			_redoStack.push(current);
		}
		current = getActiveStackInfo();
	}
	
	// 이후 항목 일치 처리.
	else if (nextAppInfo) {
		do {
			current = _redoStack.pop();
			_stack.push(current);
		} while (current !== nextAppInfo)
	}
	if(!current)	return ;
	var appId = current.state.appId;
	var voFnCallBack = appStackInfo.getFnCallBack();
	voFnCallBack(appId, false);
}

/**
 * 
 */

/**
 * 현재 화면에 표시중인 앱 정보를 얻습니다.
 */
function getActiveStackInfo() {
	if (_stack.length > 0) {
		return _stack[_stack.length - 1];
	} else {
		return null;
	}
}

/**
 * 각 앱의 정보를 담은 스택 엘리먼트 객체.
 * @param {String} appId 앱 아이디
 * @constructor
 */
function StackInfo(appId) {
	this.state = {
		"appId": appId,
		"id": _LAST_KNOWN_STATE_ID++, 
	};
}

exports.getAppStack = function(app) {
	return new AppStackKit(app);
}

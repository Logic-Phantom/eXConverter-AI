/************************************************
 * datasetSessionStorage.module.js
 * Created at 2020. 7. 16. 오전 11:07:57.
 *
 * Version 1.0
 * Updated Date : 2021-04-08
 * 
 * @author daye
 ************************************************/

/*
 * ※ 해당 모듈은 글로벌 데이터셋과 같은 기능을 제공합니다.
 *    단, 해당 모듈 사용은 사용이 권장되지 않으며, 특히 운영 시 사용을 하면 안됩니다.
 *    개인환경에서 테스트를 목적으로 사용해야 하며, 이외의 경우에는 사용하지 않는것을 권장드립니다.
 * 
 * 본 모듈에서 제공하는 기능에 대한 제약 사항 및 보증범위는 다음과 같습니다.
 * 1. localStorage
 * 		- HTML5에서 제공하는 기능으로, 브라우저에 반영구적으로 데이터를 저장 할 수 있습니다.
 * 		- 단, 도메인이 다를 경우에는 접근이 불가능합니다.
 * 		- 5MB~10MB 정도의 데이터를 저장 할 수 있습니다.
 * 		- 공통데이터셋으로 사용할 데이터를 저장합니다. 단, 노출의 위험을 위해 timeStamp를 지정할 수 있는 API를 제공합니다.
 * 		
 * 2. sessionStorage
 * 		- HTML5에서 제공하는 기능으로, 브라우저의 세션 별 저장된다. 
 * 		- 새로운 탭을 열었을 경우엔 저장된 데이터가 보이지 않습니다. 단, 해당 브라우저에서 window.open을 하게되면 세션이 유지가 되어 해당 탭에서도 데이터를 확인 할 수 있습니다.
 * 		- 5MB~10MB 정도의 데이터를 저장 할 수 있습니다.
 * 		- 로그인 시 로그인정보나 권한 등을 해당 세션이 유지되는 동안 저장하는 용도로 사용하는 것이 좋습니다. 
 * 		  로컬스토리지와 마찬가지로 timeStamp를 지정할 수 있는 API를 제공합니다.
 * 
 * 3. indexedDB
 * 		- 색인이 포함된 JSON 객체가 모여있는 트랜잭셔널 로컬 데이터베이스를 제공합니다.
 * 		- 용량제한은 특별히 없으나, HDD 저장소 상태나 브라우저 상태에 따라 달라 질 수 있습니다.
 * 		- 보다 많은 데이터를 빠르게 조회할 경우엔 웹스토리지보다 편리하게 사용 할 수 있습니다.
 * 		- 공통으로 사용할 코드데이터를 저장하는 용도로 사용하는 것이 좋습니다. 
 * 		  단, 브라우저상태나 HDD용량에 비해 데이터가 클 경우에는 보장 할 수 없습니다.
 */

/************************************************
 * 전역변수
 ************************************************/
/**
 * 타임스탬프 key 값
 * @type {String}
 */
var msTimestamp = "TIMESTAMP";

/**
 * 스토리지 유효시간(로컬, 세션)
 * 유효시간이 지나면 해당 key값은 삭제됩니다.
 * @type {Number}
 */
var mnValidTime = 24*60*60*1000;


function globalDataset (){}

/************************************************
 * sessionStorage
 ************************************************/
/**
 * 데이터 컴포넌트를 sessionStorage에 저장합니다.
 * @param {cpr.core.AppInstance} app
 * @param {
 *   dataset : Array <!-- 데이터셋이 있는 경우 -->,
 *   data : JSON <!-- 데이터셋이 없는 경우 데이터  -->
 * } paData,
 */
globalDataset.prototype.setSessionStorage = function (app, paData) {
	
	if(paData == null) return;

	/* 데이터셋 또는 데이터맵 */ 
	if(paData.dataset) {
		
	 	if(!(paData.dataset instanceof Array)) {
			paData.dataset = [paData.dataset];
		}
		
		paData.dataset.forEach(function(each) {
			var voDsJson = {};
			
			var ctrl = app.lookup(each);
			if(ctrl.type == "dataset") {

				/** @type cpr.data.DataSet */
				var vcDataset = ctrl;
				
				/* Dataset Column */
				var vaHeaders = JSON.stringify(vcDataset.getHeaders());
				vaHeaders = vaHeaders.replace(/_name/gi, "name");
				vaHeaders = vaHeaders.replace(/_datatype/gi, "dataType");
				vaHeaders = vaHeaders.replace(/_columntype/gi, "columnType");
				voDsJson.column = vaHeaders;
				
				/* Dataset Row */
				var vaDatas = JSON.stringify(vcDataset.getRowDataRanged());
				voDsJson.row = vaDatas;
				
				/* Dataset Options */
				voDsJson.etc = {
					"alterColumnLayout" :  vcDataset.alterColumnLayout,
					"stateRestore" :  vcDataset.stateRestore,
					"info" :  vcDataset.info,
					"filter" :  vcDataset.getFilter(),
					"sort" :  vcDataset.getSort(),
					"userAttr" :  vcDataset.userAttr(),
				};
				
			} else if (ctrl.type == "datamap") {
				
				/** @type cpr.data.DataMap */
				var vcDatamap = ctrl;
				
				/* Datamap Column */
				var vaHeaders = JSON.stringify(vcDatamap.getHeaders());
				vaHeaders = vaHeaders.replace(/_name/gi, "name");
				vaHeaders = vaHeaders.replace(/_datatype/gi, "dataType");
				vaHeaders = vaHeaders.replace(/_columntype/gi, "columnType");
				voDsJson.column = vaHeaders;
				
				/* Datamap Row */
				var vaDatas = JSON.stringify(vcDatamap.getDatas());
				voDsJson.row = vaDatas;
				
				/* Datamap Options */
				voDsJson.etc = {
					"alterColumnLayout" :  vcDatamap.alterColumnLayout,
					"info" :  vcDatamap.info,
					"userAttr" :  vcDatamap.userAttr(),
				};
			}
			
			sessionStorage.setItem(ctrl.id, JSON.stringify(voDsJson));
		});

	} 
	
	/* 실체화되지 않은 데이터 */
	if (paData.data) {
		
		var voData = JSON.parse(paData.data);
		var vaDataId = Object.keys(voData);
		
		var vaKeys = [];
		vaDataId.forEach(function(each){
			if(isNaN(parseInt(each))) {
				vaKeys.push(each);
			}
		});

		var vsRowData = "";
		if(vaKeys.length > 0) {
			vaKeys.forEach(function(each){
				vsRowData = JSON.stringify(voData[each]);
				var voConfig = {
					row : vsRowData
				}
				
				sessionStorage.setItem(each, JSON.stringify(voConfig));
			});
		} else {
			vsRowData = JSON.stringify(voData);
			var voConfig = {
				row : vsRowData
			}
			
			sessionStorage.setItem("dsCode", JSON.stringify(voConfig));
		}
	}
	
	alert("[" + paData.dataset.toString() + "] 이 sessionStorage 에 저장되었습니다.");
}


/**
 * sessionStorage의 아이템을 삭제합니다.
 * @param {String|String[]} paDataId 데이터컨트롤id 배열
 */
globalDataset.prototype.removeStorage = function (paDataId) {
	
	if(!(paDataId instanceof Array)) {
		paDataId = [paDataId];
	}
	
	paDataId.forEach(function(each) {
		sessionStorage.removeItem(each);
	})
	
	alert("[" + paDataId.toString() + "] 이 삭제되었습니다.");
}


/**
 * sessionStorage를 모두 삭제합니다.
 */
globalDataset.prototype.clearStorage = function () {
	
	sessionStorage.clear();
	
	alert("sessionStorage 의 모든 데이터가 삭제되었습니다.");
}


/**
 * sessionStorage 의 row 반환 / 비교할 데이터셋이 있는경우 비교 반영
 * @param {#dataset|#datamap} psDataId
 * @param {cpr.data.DataSet} pcDataSet? 
 */
globalDataset.prototype.getData = function (psDataId, pcDataSet) {

	var data = sessionStorage.getItem(psDataId);
	if(data) {
		var voStorage = _getDataConfig(data);
		
		if(pcDataSet) {
			var vaRowData = pcDataSet.getRowDataRanged();
			
			if(JSON.stringify(voStorage.row) == JSON.stringify(vaRowData)) {
				alert("변경된 사항이 없습니다.");
				return;
			} else {
				/* 실체 데이터에 변경사항이 존재 */
				voStorage.row = vaRowData;
				_updateStorage(psDataId, voStorage);
			}
		}
		
		return voStorage.row;
	}
}


/**
 * sessionStorage 에서 조건에 맞는 값을 반환합니다.
 * @param {#dataset|#datamap} psDataId
 * @param {String} psCondition 조건식
 */
globalDataset.prototype.getConditionalData = function (psDataId, psCondition) {
	
	var data = sessionStorage.getItem(psDataId);
	if(data) {
		var voStorage = _getDataConfig(data);	
	
		var vcDataset = new cpr.data.DataSet();
		// 데이터셋에 컬럼 정보가 설정되지 않아 server 로 설정함.
		vcDataset.alterColumnLayout = "server";
		vcDataset.parseData({
			columns : voStorage.column,
			rows : voStorage.row
		});

		vcDataset.setFilter(psCondition);
		return vcDataset.getRowDataRanged();
	}
}


/**
 * sessionStorage 의 timestamp 를 설정합니다.
 * timestamp로 설정한 시간이 지나면 해당 key는 삭제됩니다.
 * @param {String} psKey
 */
globalDataset.prototype.sessionTimestamp = function (psKey) {
	
	
	var now = new Date().getTime();
	var timestamp = sessionStorage.getItem(msTimestamp);
	
	if(timestamp) {
		if (now-timestamp > mnValidTime) { // 하루
	    	if(psKey) {
		        sessionStorage.removeItem(psKey);
		        sessionStorage.removeItem(msTimestamp);
	    	} else {
	    		sessionStorage.clear();
	    	}
	    	alert("TIMESTAMP 가 만료되어 데이터가 삭제되었습니다.");
		}
	} else {
		sessionStorage.setItem(msTimestamp, now);
		alert("TIMESTAMP 가 저장되었습니다.");
	}
}


/************************************************
 * localStorage
 ************************************************/
/**
 * 데이터 컴포넌트를 localStorage 에 저장합니다.
 * @param {cpr.core.AppInstance} app
 * @param {
 *   dataset : Array <!-- 데이터셋이 있는 경우 -->,
 *   data : JSON <!-- 데이터셋이 없는 경우 데이터  -->,
 * } paData
 */
globalDataset.prototype.setLocalStorage = function (app, paData) {
	
	if(paData == null) return;
	
	/* 데이터셋 또는 데이터맵 */ 
	if(paData.dataset) {
		
	 	if(!(paData.dataset instanceof Array)) {
			paData.dataset = [paData.dataset];
		}
		
		paData.dataset.forEach(function(each) {
			var voDsJson = {};
			
			var ctrl = app.lookup(each);
			if(ctrl.type == "dataset") {

				/** @type cpr.data.DataSet */
				var vcDataset = ctrl;
				
				/* Dataset Column */
				var vaHeaders = JSON.stringify(vcDataset.getHeaders());
				vaHeaders = vaHeaders.replace(/_name/gi, "name");
				vaHeaders = vaHeaders.replace(/_datatype/gi, "dataType");
				vaHeaders = vaHeaders.replace(/_columntype/gi, "columnType");
				voDsJson.column = vaHeaders;
				
				/* Dataset Row */
				var vaDatas = JSON.stringify(vcDataset.getRowDataRanged());
				voDsJson.row = vaDatas;
				
				/* Dataset Options */
				voDsJson.etc = {
					"alterColumnLayout" :  vcDataset.alterColumnLayout,
					"stateRestore" :  vcDataset.stateRestore,
					"info" :  vcDataset.info,
					"filter" :  vcDataset.getFilter(),
					"sort" :  vcDataset.getSort(),
					"userAttr" :  vcDataset.userAttr(),
				};
				
			} else if (ctrl.type == "datamap") {
				
				/** @type cpr.data.DataMap */
				var vcDatamap = ctrl;
				
				/* Datamap Column */
				var vaHeaders = JSON.stringify(vcDatamap.getHeaders());
				vaHeaders = vaHeaders.replace(/_name/gi, "name");
				vaHeaders = vaHeaders.replace(/_datatype/gi, "dataType");
				vaHeaders = vaHeaders.replace(/_columntype/gi, "columnType");
				voDsJson.column = vaHeaders;
				
				/* Datamap Row */
				var vaDatas = JSON.stringify(vcDatamap.getDatas());
				voDsJson.row = vaDatas;
				
				/* Datamap Options */
				voDsJson.etc = {
					"alterColumnLayout" :  vcDatamap.alterColumnLayout,
					"info" :  vcDatamap.info,
					"userAttr" :  vcDatamap.userAttr(),
				};
			}
			
			localStorage.setItem(ctrl.id, JSON.stringify(voDsJson));
		});

	} 
	
	/* 실체화되지 않은 데이터 */
	if (paData.data) {
		
		var voData = JSON.parse(paData.data);
		var vaDataId = Object.keys(voData);
		
		var vaKeys = [];
		vaDataId.forEach(function(each){
			if(isNaN(parseInt(each))) {
				vaKeys.push(each);
			}
		});

		var vsRowData = "";
		if(vaKeys.length > 0) {
			vaKeys.forEach(function(each){
				vsRowData = JSON.stringify(voData[each]);
				var voConfig = {
					row : vsRowData
				}
				
				localStorage.setItem(each, JSON.stringify(voConfig));
			});
		} else {
			vsRowData = JSON.stringify(voData);
			var voConfig = {
				row : vsRowData
			}
			
			localStorage.setItem("dsCode", JSON.stringify(voConfig));
		}
	}
	
	alert("[" + paData.dataset.toString() + "] 이 localStorage 에 저장되었습니다.");
}


/**
 * localStorage 의 아이템을 삭제합니다.
 * @param {String[]} paDataId 데이터id 배열
 */
globalDataset.prototype.removeLocalStorage = function (paDataId) {
	if(!(paDataId instanceof Array)) {
		paDataId = [paDataId];
	}
	
	paDataId.forEach(function(each) {
		localStorage.removeItem(each);
	});
	
	alert("[" + paDataId.toString() + "] 이 삭제되었습니다.");
}


/**
 * localStorage 를 모두 삭제합니다.
 */
globalDataset.prototype.clearLocalStorage = function () {
	localStorage.clear();
	
	alert("localStorage 의 모든 데이터가 삭제되었습니다.");
}


/**
 * localStorage 의 특정 아이템을 반환합니다.
 * @param {String|String[]} psDataId 데이터id 배열
 * @param {cpr.data.DataSet} pcDataSet?
 */
globalDataset.prototype.getLocalStorage = function (psDataId, pcDataSet) {
	var data = localStorage.getItem(psDataId);
	if(data) {
		var voStorage = _getDataConfig(data);
		
		if(pcDataSet) {
			var vaRowData = pcDataSet.getRowDataRanged();
			
			if(JSON.stringify(voStorage.row) == JSON.stringify(vaRowData)) {
				alert("변경된 사항이 없습니다.");
				return;
			} else {
				/* 실체 데이터에 변경사항이 존재 */
				voStorage.row = vaRowData;
				_updateStorage(psDataId, voStorage);
			}
		}
	
		return voStorage.row;
	}
}


/**
 * TIMESTAMP 를 설정합니다.
 * 기존에 저장되어있던 TIMESTAMP가 만료되었으면 localstorage 를 clear 합니다.
 * 특정 아이템만 삭제할 경우 매개변수로 아이템의 KEY를 전달하십시오.
 * 기본 만료시간은 하루 입니다.
 * @param {String} psKey?
 */
globalDataset.prototype.localTimestamp = function (psKey) {
	
	var now = new Date().getTime();
	var timestamp = localStorage.getItem(msTimestamp);
	
	if(timestamp) {
		if (now-timestamp > mnValidTime) { // 하루
	    	if(psKey) {
		        localStorage.removeItem(psKey);
		        localStorage.removeItem(msTimestamp);
	    	} else {
	    		localStorage.clear();
	    	}
			alert("TIMESTAMP 가 만료되어 데이터가 삭제되었습니다.");
		}
	} else {
		localStorage.setItem(msTimestamp, now);
		alert("TIMESTAMP 가 저장되었습니다.");
	}
}



/************************************************
 * indexedDB
 ************************************************/
/**
 * indexedDB를 생성합니다.
 * @param {
		database : String <!-- 데이터베이스명 -->,
		version : Number <!-- 데이터베이스버전 -->,
		tableNm : String <!-- 테이블명 -->,
		data : any <!-- 데이터 -->
	} poDatabase
 */
globalDataset.prototype.createIndexedDB = function (poDatabase) {
	
	if (!window.indexedDB) {
	    alert("indexedDB를 지원하지 않는 브라우저입니다.");
	    return;
	}
	
	// indexedDB 열기
	var request = indexedDB.open(poDatabase.database, poDatabase.version);

	// DB 마이그레이션
	request.onupgradeneeded = function(e) {
		var store = e.currentTarget.result.createObjectStore(poDatabase.tableNm, {
			keyPath: 'value',
			autoIncrement: false
		});
		// name keyPath option?
		store.createIndex('label', 'label', {
			unique: false
		});
	}

	// DB 생성 성공
	request.onsuccess = function(e) {
		var db = e.target.result;
		var transaction = db.transaction(poDatabase.tableNm, "readwrite");
		var store = transaction.objectStore(poDatabase.tableNm);

		poDatabase.data.forEach(function(each) {
			store.put(each);
		});
		
		alert("[" + poDatabase.database + "] indexedDB가 생성되었습니다.");
	}

	// DB 생성 오류
	request.onerror = function(e) {
		console.error("indexedDB : ", e.target.errorCode);
	}
}


/**
 * indexedDB에 데이터셋의 데이터를 세팅합니다.
 * @param {
		database : String <!-- 데이터베이스명 -->,
		version : Number <!-- 데이터베이스 버전 -->,
		tableNm : String <!-- 테이블명 -->
	} poDatabase
 * @param {cpr.data.DataSet} pcDataset
 */
globalDataset.prototype.setIdbRowData = function (poDatabase, pcDataset){

	if (!window.indexedDB) {
	    alert("indexedDB를 지원하지 않는 브라우저입니다.");
	    return;
	}

	var voData = [];
	var request = indexedDB.open(poDatabase.database, poDatabase.version);
	request.onsuccess = function(e) {
		var db = e.target.result;

		if(db.objectStoreNames.length == 0) {
			alert("[" + poDatabase.database + "] 데이터베이스가 생성되지 않았습니다.");
			indexedDB.deleteDatabase(poDatabase.database);
			return;
		}
		
		var store = db.transaction(poDatabase.tableNm, "readonly").objectStore(poDatabase.tableNm);
		var cursor = store.openCursor();

		cursor.onsuccess = function(event) {
			var cursor = event.target.result;
			if(cursor) {
				voData.push(cursor.value);
				cursor["continue"]();
			}
			
			// 데이터셋 정보 세팅
			if(pcDataset) {
				pcDataset.parseData({
					rows : voData
				})
			}
		}
	}
	
	if(pcDataset) {
		pcDataset.addEventListener("load", function(e){
			var _app = pcDataset.getAppInstance();
			_app.getContainer().redraw();
		});
	}
}


/**
 * indexedDB를 삭제합니다.
 * @param {any} psDatabase
 */
globalDataset.prototype.deleteIndexedDB = function (psDatabase) {
	indexedDB.deleteDatabase(psDatabase);
	alert("[" + psDatabase + "] indexedDB 가 삭제되었습니다.");
}


/************************************************
 * 내장함수
 ************************************************/
/**
 * sessionStorage의 value를 JSON데이터로 반환합니다.
 * @param {any} storage
 */
function _getDataConfig (storage) {

	var voConfig = JSON.parse(storage);
	
	return {
		column : JSON.parse(voConfig.column),
		row : JSON.parse(voConfig.row),
		etc : voConfig.etc
	}
}


/**
 * 
 * @param {String} psKey
 * @param {any} paValue
 */
function _updateStorage (psKey, paValue) {
	var voNewConfig = {};
	voNewConfig = {
		column : JSON.stringify(paValue.column),
		row : JSON.stringify(paValue.row),
		etc : paValue.etc
	}
	sessionStorage.setItem(psKey, JSON.stringify(voNewConfig));
}


/************************************************
 * 글로벌
 ************************************************/
/**
 * 데이터컴포넌트를 sessionStorage에 저장하여 다룹니다.
 */
globals.globalDataset = function() {
	
	return new globalDataset()
}
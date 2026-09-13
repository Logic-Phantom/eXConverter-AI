/************************************************
 * htmlCapture.module.js
 * Created at 2020. 7. 24. 오후 4:30:45.
 *
 * Version 1.1
 * Updated Date : 2021-04-21
 * 
 * @author daye
 ************************************************/

/*
 * 본 모듈은 MDI에 띄워진 임베디드앱을 캡쳐하는 모듈입니다.
 * MDI에 선택된 탭이 없을 경우에는 모듈에서 제공하는 기능을 확인 할 수 없습니다.
 * 
 * ※ 사용방법 ※
 * 아래의 작성된 단축키(ALT + C)를 누르면 새로운 창을 통해서 캡쳐된 화면을 확인 할 수 있으며, 본 모듈에서 단축키를 변경 하여 사용이 가능합니다.
 * 캡쳐 시 띄워지는 화면은 연결되어있는 web프로젝트의 WebContent 하위에 배치되어 있는 jsp 파일을 호출합니다.
 * jsp파일의 경로를 변경하고자 할 경우엔 작성된 actionUrl을 수정하십시오.
 * 
 * ※ 주의사항 ※
 * - 현재 선택된 임베디드앱을 캡쳐할 경우, 다이얼로그가 메인(root)에 띄워져있을 경우 캡쳐가 되지 않습니다.
 * - 캡쳐 영역은 전역변수 mbEmbCt가 true면 선택 된 임베디드 앱, false이면 메인(root)를 캡처합니다.
 */

/************************************************
 * 전역 변수
 ************************************************/
/**
 * 캡쳐영역 설정
 * true : 포커스된 임베디드 앱 인스턴스 / false : 루트 앱 인스턴스
 * @type {Boolean}
 */
var mbEmbCt = false;

/**
 * 단축키의 마지막 키
 * default : Alt + C
 * @type {cpr.events.KeyCode}
 */
var msDynamicKey = cpr.events.KeyCode.C;

/**
 * html2canvas 라이브러리 사용 여부
 */
var mbCanvas = false;


/************************************************
 * 전역 변수 (변경 불가능)
 ************************************************/
/**
 * 
 * @type {cpr.controls.TabFolder|cpr.controls.MDIFolder}
 */
var mcTabfolder = null;


/************************************************
 * 이벤트 리스너 (keydown)
 ************************************************/

function _getHtmlBound  () {
	
	/* head innerHTML */
	var vsHead = "";
	var head = document.head.cloneNode(true);
	
	// base tag
	var baseTags = head.getElementsByTagName("base");
	var voBase = Object.keys(baseTags).map(function(idx) {	
		return baseTags[idx];
	});
	voBase.forEach(function(each) {
		vsHead += each.outerHTML;
	})
	
	// meta tag
	var metaTags = head.getElementsByTagName("meta");
	var voMeta = Object.keys(metaTags).map(function(idx) {
		return metaTags[idx];
	});
	voMeta.forEach(function(each) {
		vsHead += each.outerHTML;
	})
	
	// link tag
	var linkTags = head.getElementsByTagName("link");
	var voLink = Object.keys(linkTags).map(function(idx) {
		return linkTags[idx];
	});
	voLink.forEach(function(each) {
		vsHead += each.outerHTML;
	})
	
	/* body innerHTML */
	var vsBody = ""; 
	
	if(mbEmbCt) {
		// 현재 최상위 MDI폴더에 열린 화면만 캡쳐 할 경우
		if(mcTabfolder) {
			var elTabfolder = document.getElementById("uuid-"+mcTabfolder.uuid);
			var vaTabNodes = elTabfolder.querySelector(".cl-selected.cl-tabfolder-item.cl-unselectable");
			var vnSelectedIndex = vaTabNodes.getAttribute("data-itemidx");
			
			var voSelectedContent = mcTabfolder.getTabItems()[vnSelectedIndex-1].content;
			var elContent = document.querySelector("#uuid-"+ voSelectedContent.uuid);
			if(elContent) {
				vsBody = mbCanvas ? elContent :  elContent.cloneNode(true);
			}
		} else {
			/*
			 * 탭폴더를 설정하지 않으면 해당 화면의 가장 첫번쨰 탭폴더를 타겟으로 합니다.
			 * 타겟을 정확하게 설정하기 위해서는 captrueTabfolder() 를 통해 탭폴더를 설정하십시오.
			 */
			var vaTabNodes = document.querySelectorAll(".cl-selected.cl-tabfolder-item.cl-unselectable");
			var vnSelectedIndex = vaTabNodes.item(0).getAttribute("data-itemidx");
			
			var vaTabBodyNodes = document.querySelectorAll(".cl-tabfolder-body");
			var elContent = vaTabBodyNodes.item(0).childNodes[vnSelectedIndex-1];
			vsBody = mbCanvas ? elContent :  elContent.cloneNode(true);
		}
		
	} else {
		
		// 메인의 전체 화면을 캡쳐 할 경우
		if(mbCanvas) {
			// 클론하지 않은 document 저장
			vsBody = document.body;				
		} else {
			vsBody = document.body.cloneNode(true);
			vsBody.querySelector(".cl-control.cl-container").style.position = "absolute";
		}
		
	}
	
	/* input tag value setting */
	var inputTags = vsBody.getElementsByTagName("input");
	var voInput = Object.keys(inputTags).map(function(idx) {
		return inputTags[idx];
	});
	voInput.forEach(function (each) {
		each.setAttribute("value", each.value);
	});
	
	/* textarea tag value setting */
	var textAreaTags =vsBody.getElementsByTagName("textarea");
	var voTextarea = Object.keys(textAreaTags).map(function(idx) {
		return textAreaTags[idx];
	});
	voTextarea.forEach(function (each) {
		each.innerText = each.value;
	});
	
	/* canvas tag */
	var clonCanvasTag = vsBody.getElementsByTagName("canvas");
	if(clonCanvasTag.length > 0) {
		var canvasTags = document.getElementsByTagName("canvas");
		var voCanvas = Object.keys(canvasTags).map(function(idx) {
			return canvasTags[idx];
		});
		voCanvas.forEach(function(/*HTMLCanvasElement*/each){
			// 이미 그려진 canvas를 복사
			var context = each.getContext("2d");
			var img = new Image(each.width, each.height);
			img.src = each.toDataURL("image/png");
			
			var id = each.parentElement.parentElement.id;
			var voCloneCanvas = Object.keys(clonCanvasTag).map(function(idx) {
				return clonCanvasTag[idx];
			});
			voCloneCanvas.map(function(tags) {
				if(id == tags.parentElement.parentElement.id) {
					tags.parentElement.appendChild(img);
					return;
				}
			})
		});
	}

	return {
		"HEAD" : vsHead,
		"BODY" : vsBody
	}
}

window.addEventListener("keydown", function(e) {
	
	// TODO 단축키변경을 하기위해서 아래의 코드를 수정하십시오. (기본 : ALT+C)
	if(e.altKey && e.keyCode == msDynamicKey) {
		
		var voHtml = _getHtmlBound();
		var vsHead = voHtml["HEAD"];
		var vsBody = voHtml["BODY"];
		
		var popWindow = null;
		if(mbCanvas) {
			// html2canvas 캡쳐
			
			html2canvas(vsBody, {
				// Capture Option
			}).then(function(/* HTMLCanvasElement */ canvas) {
				var context = canvas.getContext("2d");
				sessionStorage.setItem("canvas-width", canvas.width);
				sessionStorage.setItem("canvas-height", canvas.height);
				sessionStorage.setItem("canvas-url", canvas.toDataURL("image/png"));
				
				popWindow = window.open("app/cmn/resources/capture.html", "_blank");
			});
			
		} else {
			// html 캡쳐
			
			/* create cover */
			var cover = document.createElement("div");
			cover.style.position = "absolute";
			cover.style.top = "0";
			cover.style.left = "0";
			cover.style.width = "100%";
			cover.style.height = "100%";
			cover.style.zIndex = "100";
			vsBody.querySelector(".cl-control.cl-container").appendChild(cover);
			
			// TODO 호출 jsp파일의 경로가 변경되었을 경우 아래의 url을 수정하십시오.
			sessionStorage.setItem("capture-head", vsHead);
			sessionStorage.setItem("capture-body", vsBody.innerHTML);
			popWindow = window.open("app/cmn/resources/capture.html", "_blank");
		}
		
		setTimeout(function(){
			sessionStorage.removeItem("capture-head");
			sessionStorage.removeItem("capture-body");
					
			sessionStorage.removeItem("canvas-width");
			sessionStorage.removeItem("canvas-height");
			sessionStorage.removeItem("canvas-url");
		}, 1000)
			
		return true;
	}
});

/**
 * [현재 메뉴 화면 캡쳐] 시 캡쳐할 탭폴더를 설정합니다.
 * 설정하지 않으면 현재 화면의 마지막 탭폴더를 기준으로 캡쳐됩니다.
 * @param {cpr.controls.TabFolder|cpr.controls.MDIFolder} pcTabfolder
 */
globals.captureTabfolder = function (pcTabfolder) {
	if(pcTabfolder) {
		mcTabfolder = pcTabfolder;
	}
}

/**
 * 화면 캡쳐의 영역을 설정합니다.
 * true : 탭폴더 안의 영역만 캡쳐
 * false : 화면 전체 캡쳐 
 * @param {Boolean} pbRange
 */
globals.setCaptureRange = function(pbRange) {
	mbEmbCt = pbRange;
}


/**
 * html2canvas 라이브러리를 사용하여 화면을 캡쳐합니다.
 * 해당 라이브러리를 사용하여 캡쳐할 경우, 캡쳐된 이미지를 다운로드 받습니다.
 * @param {Boolean} pbUse
 */
globals.userHtml2Canvas = function(pbUse) {
	mbCanvas = pbUse;
}


/**
 * 캡쳐영역을 이미지 파일로 다운로드 받습니다.
 * 다운로드는 html2canvas 라이브러리를 사용하여 설정된 영역을 저장합니다.
 */
globals.downloadCapture = function () {
	var vbBeforeCanvas = mbCanvas;
	mbCanvas = true;
	
	var voHtml = _getHtmlBound();
	var vsBody = voHtml["BODY"];

	html2canvas(vsBody, {
		// Capture Option
	}).then(function(/* HTMLCanvasElement */ canvas) {
		
		if (canvas.msToBlob){ // Only Works in IE
			var blob = canvas.msToBlob();
			window.navigator.msSaveBlob(blob, "capture.png");
		} else {
			var link = document.createElement("a");
			link.href = canvas.toDataURL("image/png");
			link.download = "capture.png";
			link.click();
		}
		
		mbCanvas = vbBeforeCanvas;
	});
}


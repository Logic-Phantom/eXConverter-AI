/************************************************
 * convertTest.js
 * Created at 2026. 9. 13. 오후 3:18:31.
 *
 * @author 서현
 ************************************************/

/*
 * "전송" 버튼에서 click 이벤트 발생 시 호출.
 * 사용자가 컨트롤을 클릭할 때 발생하는 이벤트.
 */
function onButtonClick(e) {
	var button = e.control;
	app.lookup("subSend").send().then(function(input){
		app.lookup("subSend").removeAllFileParameters();
	});
}

/*
 * 파일 업로드에서 add-file 이벤트 발생 시 호출.
 * 파일 추가 후 발생하는 이벤트입니다.
 */
function onFud1AddFile(e) {
	var fud1 = e.control;
	e.files.forEach(function(each){
		// eXBuilder6 sends the original filename as the multipart field name.
		app.lookup("subSend").setFileParameters(each.name, each);
	});
}

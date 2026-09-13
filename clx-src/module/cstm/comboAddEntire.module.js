/************************************************
 * event.module.js
 * Created at 2023. 6. 5 오후 4:56:54.
 *
 * @author aaajd
 ************************************************/

var isAllSelected = false;

/**	
 * 콤보박스 공통 이벤트처리 담당 변수
 * 
 * 제약조건
 *  - 콤보박스 multiple = true
 *  - 콤보박스 preventInput = true
 *  - less파일 설정필요
 * 		- comboboxModuleEx.less 참고
 */
var ComboBoxInitTask = {
	init : function(){
		var that = this;
		cpr.events.EventBus.INSTANCE.addFilter("open", function(e){
			if (that.checkCombo.run(e)) {
				that.addEntrie.run(e);
			}
		});
		
		cpr.events.EventBus.INSTANCE.addFilter("selection-change", function(e){
			if (that.checkCombo.run(e)) {
				that.setClass.run(e);		
			}
		});
	},
	
	checkCombo : {
		run : function(e){
			// 이벤트를 발생 시킨 컨트롤
			/** @type cpr.controls.ComboBox */
		    var vcCombo = e.control;
		    
		    // 이벤트 발송자가 콤보박스이면.
		    if (vcCombo.type === "combobox") {
		    	if (vcCombo.userAttr("addEntire") == "Y") {
		    		vcCombo.multiple = true;
		    		vcCombo.preventInput = true;
		    		
		    		return true;
		    	}
		    }
		}
	},
	
	addEntrie : {
		run : function(e){
			/** @type cpr.controls.ComboBox */
		    var vcCombo = e.control;
		    
		    // 콤보박스로 [전체] 아이템 추가
			var voItem = vcCombo.getItemByValue("all");
			if(ValueUtil.fixNull(voItem) == "" ){
				vcCombo.addItem(new cpr.controls.Item("전체", "all"), vcCombo.getItem(0));
			}
		}
	},
	
	setClass : {
		run : function(e){
			
			/** @type cpr.controls.ComboBox */
		    var vcCombo = e.control;
		    
		    var vsItemVal = "";
		    
		    if (e.oldSelection.length == 0) {
			    vsItemVal = e.newSelection[0].value;		    	
		    } else {
		    	var voItem = e.newSelection[e.newSelection.length-1];
		    	if(voItem) {
			    	vsItemVal = e.newSelection[e.newSelection.length-1].value;
		    	}
		    }
		    
			//아이템 value가 all이고 체크되어있지 않는 경우
			if(vsItemVal == "all" && !isAllSelected) {
				for(var idx = 0; idx < vcCombo.getItemCount(); idx++){
					if (vcCombo.getItem(idx).value == "all") {
						vcCombo.style.item.bindClass().toExpression("value == 'all'? 'all-checked':''");
						isAllSelected = true;
					} else {
						vcCombo.selectItem(idx, false);
					}
				}
				vcCombo.removeSelectionByValue("all", false);
				vcCombo.style.addClass("addEntire");
				
			//아이템 value가 all이고 체크되어있는 경우
			} else if (vsItemVal == "all" && isAllSelected) {
				for(var idx = 0; idx < vcCombo.getItemCount(); idx++){
					if (vcCombo.getItem(idx).value == "all") {
						vcCombo.style.item.unbindClass();
						isAllSelected = false;
					} else {
						vcCombo.removeSelection(idx, false);						
					}
				}
				vcCombo.removeSelectionByValue("all", false);
				vcCombo.style.removeClass("addEntire");
			}
			
			// 모든 아이템 및 [전체] 아이템 선택한 상태에서 다른 아이템 체크를 해제했을 경우
			if (isAllSelected && vcCombo.getSelectedIndices().length == vcCombo.getItemCount() - 2 && vsItemVal != "all") {
				vcCombo.removeSelectionByValue("all", false);
				vcCombo.style.removeClass("addEntire");
				vcCombo.style.item.unbindClass();
				isAllSelected = false;
			}
			
			// [전체] 아이템 선택하지 않은 상태에서 다른 모든 아이템이 선택됐을 경우
			if (!isAllSelected && vcCombo.getSelectedIndices().length == vcCombo.getItemCount() - 1) {
				vcCombo.style.addClass("addEntire");
				vcCombo.style.item.bindClass().toExpression("value == 'all'? 'all-checked':''");
				isAllSelected = true;
			}
		}
	}
}


ComboBoxInitTask.init();

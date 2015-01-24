var game_id = null;
var this_player = null;
var map_cells_h = 10;
var map_cells_v = 6;
var action;
var lastInstanceTurn = -1;

$.ajaxSetup({
   contentType: "application/json",
   dataType: "json"
});

function showMessage(text, type) {
  if ('undefined' === typeof type) type = 'error';
  $('#message').removeClass('info success warn error').addClass(type).text(text);
}

function hideMessage() {
  $('#message').removeClass('info success warn error').empty();
}

function drawMapGrid(width, height){
  var mapHtml = "";
  for(var v=0; v<height; v++){
    mapHtml += '<div class="map_row">';
    for(var h=0; h<width; h++){
      mapHtml += '<span class="map_cell" id="map_cell_' + h + "_" + v + '"/>';
    }
    mapHtml += '</div>';
  }
  $('#map_panel').append(mapHtml);
}

function clearMap(){
  $(".map_cell").empty();
}

function clearInventory(){
  $(".player_inventory").empty();
}

function drawMapEntities(response){
  for(var v=0; v<map_cells_v; v++){
    for(var h=0; h<map_cells_h; h++){
      if(response.map[v][h] != response.dataset.empty){
        $("#map_cell_" + h + "_" + v).append('<img src="objects/' + response.map[v][h] + '.png" class="map_object"/>');
      }
    }
  }
}

function drawPlayers(players){
  for(var i=0; i<players.length; i++){
    $("#map_cell_" + players[i].h + "_" + players[i].v).append('<img src="objects/' + players[i].sprite + '.png" class="map_object player_icon"/>');
  }
}

function drawInventory(players){
  for(var i=0; i<players.length; i++){
    drawInventoryForPlayer(i, players[i].inventory);
  }
}

function getNeighboringEmptyCells(h, v){
  return $('#map_cell_' + (h-1) + "_" + v + ':empty,' +
    '#map_cell_' + (h+1) + "_" + v + ':empty,' +
    '#map_cell_' + h + "_" + (v-1) + ':empty,' +
    '#map_cell_' + h + "_" + (v+1) + ':empty');
}

function getNeighboringObjectsCells(h, v){
  return $('#map_cell_' + (h-1) + "_" + v + ' ,' +
    '#map_cell_' + (h+1) + "_" + v + ' ,' +
    '#map_cell_' + h + "_" + (v-1) + ' ,' +
    '#map_cell_' + h + "_" + (v+1) + ' ');
}


function actionInteractClick(){
  var cells = getNeighboringObjectsCells(this_player.h, this_player.v).addClass('cell_choosable');
  /*cells.each(function(){
    object = this.src;
  });*/
  action = 'interact';
}

function actionMoveClick(){
  getNeighboringEmptyCells(this_player.h, this_player.v).addClass('cell_choosable');
  action = 'move';
}

function actionDropClick(){
  getNeighboringEmptyCells(this_player.h, this_player.v).addClass('cell_choosable');
  action = 'drop';
}

function actionSkipClick(){
  action = 'skip';
  submitAction();
}

function drawInventoryForPlayer(player, item){
  if(item != 0){
    var itemHtml = '<img src="objects/' + item + '.png" class="inventory_object"/>';
    $('#player_' + player + '_inventory').append(itemHtml);
  }
}

function handleRefresh(data){
  // Yeah, just go with it.
  var player_id = this_player.id;
  this_player = data.players[this_player.id];
  this_player.id = player_id;

  clearMap();
  drawMapEntities(data);
  clearInventory();
  drawInventory(data.players);
  drawPlayers(data.players);
}

function createGame(){
  game_id = $('#secret').val();
  $.get('/api/start/'+game_id, function(res){
    if (!res.result && res.error) {
      showMessage(res.error);
      return;
    }
    if (!res.instance || res.instance.id != game_id){
      $.ajax({
        type: 'POST',
        url: '/api/start',
        data: JSON.stringify({id:game_id}),
        success: function(res){
          initializeOnce(res);
          if (!res.instance || res.instance.id != game_id){
            console.log(res);
            return;
          }
          handleRefresh(res);
          showMessage('New game started - waiting for team to join','success');
          bindUnload();
          setTimeout(function(){
            $('.player_icon').fadeOut('slow');
          },1000);
          return;
        }
      });
      return;
    }
    initializeOnce(res);
    handleRefresh(res);
    $('.player_icon').hide();
    showMessage('Welcome player '+(++res.profile) + ' - waiting for team to join','info');
    bindUnload();
  });
}

function submitAction(){
    $.ajax({
    type: 'PUT',
    url: '/api/game/'+game_id,
    data: JSON.stringify({action:action, player_id: this_player.id}),
    success: function(res){
      console.log(res);
      $('.cell_choosable').removeClass('cell_choosable');
      showMessage('your action: '+action,'info');
    }
  });
}

function initializeOnce(data){
  game_id = data.instance.id;
  this_player = data.players[data.profile];
  this_player.id = data.profile;
  pollForNewTurns();
  $('#createGame').hide();
  $('#game').fadeIn();
  $('#action_move').attr('disabled', 'disabled');
  $('#action_skip').attr('disabled', 'disabled');
  $('#action_drop').attr('disabled', 'disabled');
}

function chooseCell(){
  var hv = /\d+_\d+/.exec(this.id);
  action += '_' + hv[0];
  submitAction();
}

function reloadGameCreate(res) {
  showMessage(res.error);
  $('#createGame').fadeIn();
  $('#game').fadeOut();
  $('#secret').val(game_id);
  $('#action_move').attr('disabled', 'disabled');
  $('#action_skip').attr('disabled', 'disabled');
  $('#action_drop').attr('disabled', 'disabled');
  game_id = null;
  this_player = null;
  action;
  lastInstanceTurn = -1;
  clearTimeout(window.pollTurnPointer);
}

function pollForNewTurns(){
  $.ajax({
    type: 'GET',
    url: '/api/game/'+game_id,
    success: function(res) {
      if (!res.result && res.error) {
        reloadGameCreate(res);
        return;
      }
      if (lastInstanceTurn === -1 && res.profile !== 3) return;
      if (lastInstanceTurn === -1 && res.profile === 3) {
        $('.player_icon').fadeIn('slow');
        $('#action_move').attr('disabled', false);
        $('#action_skip').attr('disabled', false);
        if ($('#player_'+this_player.id+'_inventory').has('.inventory_object').length === 1)
          $('#action_drop').attr('disabled',false);
        showMessage('Started', 'info');
        lastInstanceTurn = 0;
      }
      if(res.instance && res.instance.turn > lastInstanceTurn) {
        lastInstanceTurn = res.instance.turn;
        handleRefresh(res);
        hideMessage();
      } else if (Object.keys(res.pendingActions).length < 4) {
        var actionsLeft = 4 - Object.keys(res.pendingActions).length;
        showMessage('Started - ' + actionsLeft + ' players deciding', 'info');
      }

    },
    complete: function(){
      if (game_id !== null)
        window.pollTurnPointer = window.setTimeout(pollForNewTurns, 1000);
    }
  });
}

$(document).ready(function(){
  drawMapGrid(map_cells_h,map_cells_v);
  $(document).on('click', '#start', createGame);
  $(document).on('click', '#action_move', actionMoveClick);
  $(document).on('click', '#action_drop', actionDropClick);
  $(document).on('click', '#action_skip', actionSkipClick);
  $(document).on('click', '#action_interact', actionInteractClick);
  $(document).on('click', '.cell_choosable', chooseCell);
});

function bindUnload() {
  $(window).bind('beforeunload', function(){
    if(/Firefox[\/\s](\d+)/.test(navigator.userAgent) && new Number(RegExp.$1) >= 4) {
       var data={async:false};
       leaveGame(data);
      return;//'Do you really want to abandon the game?';
    } else {
      var data={async:true};
      leaveGame(data);
      return;//'Do you really want to abandon the game?';
    }
  });
}

function leaveGame(data) {
  clearTimeout(window.pollTurnPointer);
  $.ajax({
    type: 'PUT',
    url: '/api/leave/'+game_id,
    data: JSON.stringify({profile:this_player}),
    success: function(res){
      console.log(res);
    }
  });
}

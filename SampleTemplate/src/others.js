// others.js

function getPlayerInfo() {
  if (window.UnityWebGLApp?.myGameInstance?.SendMessage)
    window.UnityWebGLApp.myGameInstance.SendMessage("JSManager", "GetPlayerInfo");
}

function setPlayerInfo(info) {
  const json = JSON.parse(info);
  window.unity_player_info = json;
}
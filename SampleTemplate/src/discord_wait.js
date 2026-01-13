// not using now

const channel = new BroadcastChannel('app-data');
const code = getCode();
channel.postMessage(code);
window.close();

function getCode(){
	const params = new URLSearchParams(window.location.search);
	if (params.has("code")){
		return params.get("code");
	}
	return null;
}
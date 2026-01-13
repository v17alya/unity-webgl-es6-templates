// not using now

const channel = new BroadcastChannel('app-data');

function signWithDiscord(redirectUri, callback){
	channel.onmessage = (eventMessage) => {
		console.log('signWithDiscord onmessage: ' + eventMessage.data);
		callback(eventMessage.data);
	}

	const uri = "https://discord.com/api/oauth2/authorize?client_id=1092513317169414235&redirect_uri=" + redirectUri + "&response_type=code&scope=identify%20guilds%20email";
	const disc_window = window.open(uri);
}
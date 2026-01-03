(async () => {
	const { Storage } = await import(chrome.runtime.getURL("./storage.js"));
	
	const constants = document.createElement("template");
	constants.id = "ycc-constants";
	constants.textContent = `{
			"icon_hide": "${chrome.runtime.getURL("icon_show.svg")}",
			"icon_hide_bulk": "${chrome.runtime.getURL("icon_hide_bulk.svg")}",
			"icon_show": "${chrome.runtime.getURL("icon_hide.svg")}",
			"icon_show_bulk": "${chrome.runtime.getURL("icon_show_bulk.svg")}"
	}`
	document.documentElement.appendChild(constants);
	
	const script = document.createElement("script");
	script.src = chrome.runtime.getURL("page.js");
	document.documentElement.appendChild(script);
	
	let hidden = new Map();
	let hiddenPromise = Storage.get().then(newHidden => hidden = newHidden);
	
	const sendHiddenList = async () => {
		hiddenPromise.then(() => {
			window.postMessage({ type: "ycc-hidden-list", hidden: [...hidden.keys()] }, "*")
		});
	}
	
	/** Events from page.js */
	window.addEventListener("message", (event) => {
		if (event.source !== window) return;
		switch (event.data.type) {
			case "ycc-hide": {
				hiddenPromise.then(() => {
					hidden.set(event.data.id, [ Date.now(), true ]);
					Storage.set(hidden).then(() => chrome.runtime.sendMessage({ type: "update-count" }));
				});
				break;
			}
			case "ycc-show": {
				hiddenPromise.then(() => {
					// TODO: Eventually if I care about conflict resolution, this should update the key with "false" instead of deleting it.
					hidden.delete(event.data.id);
					Storage.set(hidden).then(() => chrome.runtime.sendMessage({ type: "update-count" }));
				});
				break;
			}
			case "ycc-ready": {
				sendHiddenList();
				break;
			}
		}
	});
	
	/** Events from popup.js */
	chrome.runtime.onMessage.addListener((event) => {
		switch (event.type) {
			case "ycc-refresh-storage": {
				hiddenPromise = Storage.get().then(newHidden => {
					hidden = newHidden
					sendHiddenList();
				});
				break;
			}
		}
	});
})();

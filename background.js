import { Storage } from "./storage.js";

const updateBadge = async () => {
	const num = (await Storage.get()).size;
	if (num === 0) chrome.action.setBadgeText({ text: "" });
	else {
		chrome.action.setBadgeBackgroundColor({ color: "#ef2e2e" });
		chrome.action.setBadgeTextColor({ color: "#ffffff"});
		chrome.action.setBadgeText({ text: num.toString() });
	}
}

updateBadge();

chrome.runtime.onMessage.addListener((message) => {
	if (message.type !== "update-count") return;
	updateBadge();
})

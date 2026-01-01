const now = Date.now();
const hidden = new Map();

const updateCounts = () => {
	const [ mostRecent, mostRecentTime ] = [...hidden.entries()].sort(([,a], [,b]) => b - a)[0] ?? [ null, null ];
	if (mostRecent) {
		const button = document.getElementById("restore-last");
		button.removeAttribute("disabled");
		const sub = button.querySelector(".sub");
		sub.innerText = `Hidden ${new Date(mostRecentTime).toLocaleString("en-US", {
			month: "short",
			day: "2-digit",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		})}`;
	}
	else {
		const button = document.getElementById("restore-last");
		button.setAttribute("disabled", null);
		button.querySelector(".sub").innerText = "";
	}

	const setTimed = (time, button) => {
		const num = [...hidden.values()].filter(v => v >= now - time).length;
		document.getElementById(button + "-count").innerText = `(${num})`;
		document.getElementById(button).toggleAttribute("disabled", num === 0);
	}

	setTimed(1000 * 60 * 60 * 24, "restore-day");
	setTimed(1000 * 60 * 60 * 24 * 7, "restore-week");
	setTimed(1000 * 60 * 60 * 24 * 30, "restore-month");
	setTimed(1000 * 60 * 60 * 24 * 365, "restore-year");
	setTimed(Infinity, "restore-all");
}

let hiddenPromise = chrome.storage.local.get("hidden")
	.then(({ hidden: h }) => h?.forEach(h => hidden.set(h[0], h[1])))
	.then(() => updateCounts());

const confirm = (text) => {
	document.body.classList.add("popup");
	document.getElementById("popup-text").innerText = text;
	return new Promise((res) => {
		const abort = new AbortController();
		setTimeout(() => {
			document.body.addEventListener("click", () => {
				res(false);
				abort.abort();
				document.body.classList.remove("popup");
			}, { signal: abort.signal });
			document.getElementById("confirm-popup").addEventListener("click", (e) => {
				e.stopPropagation();
			}, { signal: abort.signal });
		}, 100);
		document.getElementById("popup-yes").addEventListener("click", () => {
			res(true);
			abort.abort();
			document.body.classList.remove("popup");
		}, { signal: abort.signal });
		document.getElementById("popup-no").addEventListener("click", () => {
			res(false);
			abort.abort();
			document.body.classList.remove("popup");
		}, { signal: abort.signal });
	});
}

const sendRefreshSignal = () => {
	chrome.runtime.sendMessage({ type: "update-count" });
	chrome.tabs.query({ url: "https://studio.youtube.com/*" }, (tabs) => {
		tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { type: "ycc-refresh-storage" }));
	});
}

const restoreLast = () => {
	const mostRecent = [...hidden.entries()].sort(([,a], [,b]) => b - a)[0]?.[0];
	hidden.delete(mostRecent);
	updateCounts();
	chrome.storage.local.set({ hidden: [...hidden.entries()] }).then(sendRefreshSignal);
}

const restoreTimed = async (label, time) => {
	const toDelete = [...hidden.entries()].filter(([ , t]) => t >= now - time).map(([ id ]) => id);
	if (await confirm(`This will restore ${toDelete.length} comments which you have Marked as Read over the past ${label}.`)) {
		toDelete.forEach(d => hidden.delete(d));
		updateCounts();
		chrome.storage.local.set({ hidden: [...hidden.entries()] }).then(sendRefreshSignal);
	}
}

const restoreAll = async () => {
	if (await confirm(`This will restore ALL ${hidden.size} COMMENTS that you have ever Marked as Read. Only do this if you wish to lose all of your marked comments!`)) {
		hidden.clear();
		updateCounts();
		chrome.storage.local.set({ hidden: [] }).then(sendRefreshSignal);
	}
}

document.getElementById("restore-dropdown").addEventListener("click", () => document.getElementById("restore-timed").classList.toggle("visible"));

document.getElementById("restore-last").addEventListener("click", () => restoreLast());
document.getElementById("restore-day").addEventListener("click", () => restoreTimed("day", 1000*60*60*24));
document.getElementById("restore-week").addEventListener("click", () => restoreTimed("week", 1000*60*60*24*7));
document.getElementById("restore-month").addEventListener("click", () => restoreTimed("month", 1000*60*60*24*7*30));
document.getElementById("restore-year").addEventListener("click", () => restoreTimed("year", 1000*60*60*24*7*365));
document.getElementById("restore-all").addEventListener("click", () => restoreAll());

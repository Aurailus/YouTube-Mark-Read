const CONSTANTS = JSON.parse(document.querySelector("#ycc-constants").innerText);

let commentsContainer = null;
let hiddenComments = null;
let numHiddenOnPage = 0;
let useDimmed = false;

const hideComment = (id) => {
	hiddenComments?.add(id);
	window.postMessage({ type: "ycc-hide", id }, "*");
	processComments();
}

const showComment = (id) => {
	hiddenComments?.delete(id);
	window.postMessage({ type: "ycc-show", id }, "*");
	processComments();
}

const bulkToggleHide = () => {
	const allComments = [...document.querySelectorAll("ytcp-comment:has(ytcp-checkbox-lit[checked])")];
	const isHide = allComments.some(c => !hiddenComments.has(c.data.commentId));
	allComments.forEach(c => {
		const id = c.data.commentId;
		window.postMessage({ type: isHide ? "ycc-hide" : "ycc-show", id }, "*");
		isHide ? hiddenComments?.add(id) : hiddenComments?.delete(id);
		c.querySelector("ytcp-checkbox-lit").click();
	})
	processComments();
}

const updateHiddenCount = () => {
	let elem = document.querySelector("#ycc-hidden-count p");
	if (!elem) {
		const parent = document.querySelector("ytcp-sticky-header");
		const ref = parent?.querySelector("ytcp-checkbox-lit[id=batch-select-all]");
		if (!parent || !ref) return;
		const wrapper = document.createElement("div");
		wrapper.id = "ycc-hidden-count";
		elem = document.createElement("p");
		wrapper.appendChild(elem);
		const button = document.createElement("button");
		button.innerText = useDimmed ? "Hide" : "Show";
		button.addEventListener("click", () => {
			useDimmed = !useDimmed;
			button.innerText = useDimmed ? "Hide" : "Show";
			processComments();
		});
		wrapper.appendChild(button);
		ref.after(wrapper);
	}
	elem.classList.toggle("hidden", numHiddenOnPage === 0);
	elem.innerText = `${numHiddenOnPage} Marked Read`
}

const addBulkHideButton = () => {
	const toolbar = document.querySelector("ytcp-comment-batch-action-bar #toolbar");
	if (!toolbar) return;
	if (!toolbar.querySelector(".ycc-bulk-hide-button")) {
		const button = document.createElement("ytcp-comment-button");
		button.setAttribute("as-icon", true);
		button.setAttribute("inverted", true);
		button.classList.add("style-scope", "ytcp-comment-batch-action-bar", "ycc-bulk-hide-button");
		toolbar.appendChild(button);
		requestAnimationFrame(() => {
			const icon = button.querySelector("yt-icon");
			const img = document.createElement("img");
			img.src = CONSTANTS.icon_hide_bulk;
			icon.appendChild(img);
			const selectAllButton = document.querySelector("ytcp-bulk-actions #header .selection-label + button");
			selectAllButton.addEventListener("click", () => {
				button.setAttribute("disabled", true);
				button.classList.add("hidden");
			});
		})
		button.addEventListener("click", () => bulkToggleHide());
	}
}

const handleComment = (comment) => {
	const id = comment.data?.commentId;
	const isHidden = (hiddenComments?.has(id) ?? false);
	if (hiddenComments) comment.setAttribute("data-ycc", isHidden ? (useDimmed ? "dimmed" : "hidden") : "visible");

	const toolbar = comment.querySelector("#comment-actions");
	let button = toolbar.querySelector(".ycc-hide-button"); 
	const iconUrl = isHidden ? CONSTANTS.icon_show : CONSTANTS.icon_hide;
	if (!button) {
		button = document.createElement("ytcp-icon-button");
		button.setAttribute("compact", "");
		button.classList.add("ycc-hide-button");
		const ref = toolbar.querySelector("ytcp-icon-button[icon=more-vert]");
		ref ? toolbar.insertBefore(button, ref) : toolbar.appendChild(button);
		const icon = button.querySelector("yt-icon");
		const img = document.createElement("img");
		img.src = iconUrl;
		icon.appendChild(img);
		button.addEventListener("click", () => hiddenComments?.has(id) ? showComment(id) : hideComment(id));
	}
	const icon = button.querySelector("yt-icon img");
	if (icon.src !== iconUrl) icon.src = iconUrl;
	
	return hiddenComments?.has(id) ?? false;
}

const processComments = () => {
	commentsContainer = document.querySelector("ytcp-comments-section #contents tp-yt-iron-list #items");
	// console.warn("Comments container", [...commentsContainer.querySelectorAll("ytcp-comment")].length);
	if (!commentsContainer) return;
	const comments = [...commentsContainer.querySelectorAll("ytcp-comment")];
	numHiddenOnPage = comments.map(handleComment).filter(Boolean).length;
	// Reflow comments container.
	commentsContainer.parentElement._boundNotifyResize?.();
	// Update hidden notification.
	updateHiddenCount();
}

window.addEventListener("message", (event) => {
	if (event.data.type !== "ycc-hidden-list" || event.source !== window) return;
	hiddenComments = new Set(event.data.hidden);
	processComments();
});

let observer = new MutationObserver((records) => {
	const queryTags = [ "ytcp-comment", "ytcp-comments-section", "ytcp-bulk-actions" ].map(v => v.toUpperCase());
	const found = new Set();
	outer:
	for (let record of records) {
		for (let node of record.addedNodes) {
			for (let i = 0; i < queryTags.length; i++) {
				if (node.tagName === queryTags[i]) {
					found.add(node.tagName.toLowerCase());
					queryTags.splice(i, 1);
					i--;
				}
			}
			if (queryTags.length === 0) break outer;
		}
	}

	if (found.has("ytcp-comment") || found.has("ytcp-comments-section")) {
		processComments();
		// Occasionally misses comments if this isn't delayed by a frame.
		requestAnimationFrame(processComments);
		// If messing with the bulk-select checkbox, the hidden count can be deleted.
	}
	if (found.has("ytcp-bulk-actions")) {
		addBulkHideButton();
	} 
	if (!document.getElementById("ycc-hidden-count")) updateHiddenCount();
});

observer.observe(document.body, { childList: true, subtree: true });
processComments();

window.postMessage({ type: "ycc-ready" }, "*");


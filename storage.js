const STORAGE_TYPE = chrome.storage.sync.get("sync").then(({ sync }) => sync?.active ? "sync" : "local");
STORAGE_TYPE.then((type) => console.log(`[YCC] - Using ${type} storage.`));

/** @param {Map<string, [number, boolean]>} data */ 
const serialize = (data) => [...data.entries()]
	.map(([id, [time, hidden]]) => [id, Math.floor(time/1000), hidden ? 1 : 0])
	.sort(([,a], [,b]) => a - b);

/** @param {Array<[string, number, number]>} data */
const deserialize = (data) => {
	// If in the old format, this will be just [string, number], and number will be in ms.
	const map = new Map();
	data.forEach(v => map.set(v[0], [ v[1] * (v.length === 3 ? 1000 : 1), v[2] ?? true ]));
	return map;
}

const STORAGE_LOCAL = {
	/** @param {Map<string, [number, boolean]>} hidden - Map of comment ID to [ time modified, whether hidden ] */
	set(hidden) { return chrome.storage.local.set({ hidden: serialize(hidden) }); },
	/** Returns the same thing that save stores. */
	get() { return chrome.storage.local.get("hidden").then(({ hidden }) => deserialize(hidden ?? [])); }
}

const SYNC_SAFE_ITEMS_PER_PAGE = 180;
const SYNC_MAX_PAGES = 12;

const STORAGE_SYNC = {
	async set(hidden) {
		const arr = serialize(hidden);
		const numPages = Math.ceil(arr.length / SYNC_SAFE_ITEMS_PER_PAGE);
		if (numPages > SYNC_MAX_PAGES) {
			alert("You have too many hidden comments for this storage type!");
			return;
		}
		const obj = {
			sync: { numPages, active: true },
			...Object.fromEntries(Array.from(Array(numPages).keys()).map(i => 
				[ "page_" + i, arr.slice(i * SYNC_SAFE_ITEMS_PER_PAGE, (i + 1) * SYNC_SAFE_ITEMS_PER_PAGE) ]))
		}
		return chrome.storage.sync.set(obj);
	},
	async get() {
		const obj = await chrome.storage.sync.get(["sync", ...Array.from(Array(SYNC_MAX_PAGES).keys()).map(i => "page_" + i)]);
		const arr = Array.from(Array(obj.sync?.numPages ?? 0).keys()).flatMap(i => obj["page_" + i] ?? []);
		return deserialize(arr);
	}
}

const STORAGES = {
	local: STORAGE_LOCAL,
	sync: STORAGE_SYNC
}

export const Storage = {
	type() { return STORAGE_TYPE; },
	get() { return STORAGE_TYPE.then(type => STORAGES[type].get()) },
	set(hidden) { return STORAGE_TYPE.then(type => STORAGES[type].set(hidden)) }
};

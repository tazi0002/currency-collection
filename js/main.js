const inventory = Array.isArray(window.collectionInventory) ? window.collectionInventory : [];
const PAGE_SIZE = 48;
const STORAGE_KEY = "currencyCollectionConfig";

let visibleCount = PAGE_SIZE;
let currentFilteredInventory = [];
let sortState = {
  key: "year",
  direction: "asc"
};
let overlayItem = null;
let overlaySide = "front";
let overlayTurnTimer = null;

const elements = {
  totalItems: document.querySelector("#totalItems"),
  coinCount: document.querySelector("#coinCount"),
  banknoteCount: document.querySelector("#banknoteCount"),
  resultCount: document.querySelector("#resultCount"),
  shownCount: document.querySelector("#shownCount"),
  grid: document.querySelector("#inventoryGrid"),
  emptyState: document.querySelector("#emptyState"),
  seeMoreButton: document.querySelector("#seeMoreButton"),
  searchFilter: document.querySelector("#searchFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  countryFilter: document.querySelector("#countryFilter"),
  valueFilter: document.querySelector("#valueFilter"),
  setFilter: document.querySelector("#setFilter"),
  yearFilter: document.querySelector("#yearFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  sortMenu: document.querySelector("#sortMenu"),
  resetFilters: document.querySelector("#resetFilters"),
  coinOverlay: document.querySelector("#coinOverlay"),
  overlayPanel: document.querySelector(".coin-overlay-panel"),
  overlayClose: document.querySelector("#overlayClose"),
  overlayDetails: document.querySelector("#overlayDetails"),
  overlayPrev: document.querySelector("#overlayPrev"),
  overlayNext: document.querySelector("#overlayNext"),
  overlayCoin: document.querySelector("#overlayCoin"),
  overlayCoinInner: document.querySelector("#overlayCoinInner")
};

function getPageConfig() {
  return {
    search: elements.searchFilter.value,
    type: elements.typeFilter.value,
    country: elements.countryFilter.value,
    value: elements.valueFilter.value,
    set: elements.setFilter.value,
    year: elements.yearFilter.value,
    sortKey: sortState.key,
    sortDirection: sortState.direction,
    visibleCount
  };
}

function savePageConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getPageConfig()));
  } catch (error) {
    // Ignore storage errors so filtering still works in private/restricted modes.
  }
}

function restorePageConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return;

    elements.searchFilter.value = saved.search || "";
    elements.typeFilter.value = saved.type || "all";
    elements.countryFilter.value = saved.country || "all";
    refreshValueOptions();
    refreshSetOptions();
    elements.valueFilter.value = [...elements.valueFilter.options].some((option) => option.value === saved.value) ? saved.value : "all";
    elements.setFilter.value = [...elements.setFilter.options].some((option) => option.value === saved.set) ? saved.set : "all";
    elements.yearFilter.value = [...elements.yearFilter.options].some((option) => option.value === saved.year) ? saved.year : "all";
    sortState = {
      key: ["year", "value"].includes(saved.sortKey) ? saved.sortKey : "year",
      direction: saved.sortDirection === "desc" ? "desc" : "asc"
    };
    visibleCount = Math.max(PAGE_SIZE, Number(saved.visibleCount) || PAGE_SIZE);
  } catch (error) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearPageConfig() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    // Ignore storage errors.
  }
}
function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function label(value) {
  return value || "Not listed";
}

function uniqueSorted(items, key, predicate = () => true) {
  return [...new Set(items.filter(predicate).map((item) => item[key]).filter(Boolean))]
    .sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function getYearParts(value) {
  return [...String(value ?? "").matchAll(/\d{4}/g)].map((match) => Number(match[0]));
}

function getSortYear(value, fallback = 0) {
  const years = getYearParts(value);
  return years.length ? years[years.length - 1] : fallback;
}


function getValueAmount(value) {
  const text = String(value ?? "").toLowerCase().replace(/,/g, "");
  const match = text.match(/\d+(?:\.\d+)?/);
  if (!match) return Number.MAX_SAFE_INTEGER;

  let amount = Number(match[0]);
  if (text.includes("cent")) amount /= 100;
  return amount;
}

function uniqueValuesByAmount(items) {
  return [...new Set(items.map((item) => item.value).filter(Boolean))]
    .sort((a, b) => getValueAmount(a) - getValueAmount(b)
      || String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function getDecadeLabel(value) {
  const sortYear = getSortYear(value);
  if (!sortYear) return "Unknown year";
  return `${Math.floor(sortYear / 10) * 10}s`;
}

function getCountryCode(country) {
  return {
    Canada: "ca",
    Iran: "ir"
  }[country] || "";
}

function titleCaseValue(value) {
  return label(value).toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function getDisplayValue(item) {
  const value = titleCaseValue(item.value);

  if (item.country === "Canada") {
    return value.replace(/Dollar\b/, "Canadian Dollar").replace(/Dollars\b/, "Canadian Dollars").replace(/Cent\b/, "Canadian Cent").replace(/Cents\b/, "Canadian Cents");
  }

  return value;
}

function getKeyCollectibles(item) {
  if (item.notes) return item.notes;
  if (item.collectionSet === "Special Collection") return item.name;
  return "None listed";
}
function getTypeName(item) {
  return item.type === "banknote" ? "Bank note" : "Coin";
}

function getItemTypeLabel(item) {
  return `${getTypeName(item)} ${label(item.value)}`;
}

function clearSelect(select, firstLabel) {
  select.innerHTML = "";
  const option = document.createElement("option");
  option.value = "all";
  option.textContent = firstLabel;
  select.appendChild(option);
}

function addSelectOptions(select, values) {
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    select.appendChild(option);
  });
}

function getItemsForCountryOptions() {
  const type = elements.typeFilter.value;
  const country = elements.countryFilter.value;

  if (country === "all") {
    return [];
  }

  return inventory.filter((item) => {
    return (type === "all" || item.type === type)
      && item.country === country;
  });
}

function refreshValueOptions() {
  const currentValue = elements.valueFilter.value;
  const values = uniqueValuesByAmount(getItemsForCountryOptions());

  clearSelect(elements.valueFilter, "All values");
  elements.valueFilter.disabled = elements.countryFilter.value === "all";
  addSelectOptions(elements.valueFilter, values);

  elements.valueFilter.value = values.includes(currentValue) ? currentValue : "all";
}

function refreshSetOptions() {
  const currentSet = elements.setFilter.value;
  const sets = uniqueSorted(getItemsForCountryOptions(), "collectionSet");

  clearSelect(elements.setFilter, "All sets");
  elements.setFilter.disabled = elements.countryFilter.value === "all";
  addSelectOptions(elements.setFilter, sets);

  elements.setFilter.value = sets.includes(currentSet) ? currentSet : "all";
}

function setupFilters() {
  addSelectOptions(elements.countryFilter, uniqueSorted(inventory, "country"));
  addSelectOptions(elements.yearFilter, uniqueSorted(inventory.map((item) => ({ decade: getDecadeLabel(item.year) })), "decade"));
  refreshValueOptions();
  refreshSetOptions();
}

function updateSummary() {
  elements.totalItems.textContent = inventory.length;
  elements.coinCount.textContent = inventory.filter((item) => item.type === "coin").length;
  elements.banknoteCount.textContent = inventory.filter((item) => item.type === "banknote").length;
}

function updateSortButtons() {
  const arrow = sortState.direction === "asc" ? "\u2193" : "\u2191";
  const activeLabel = sortState.key === "year" ? "Year" : "Value";

  elements.sortSelect.textContent = `${activeLabel} ${arrow}`;
  elements.sortMenu.querySelectorAll("[data-sort-key]").forEach((button) => {
    const label = button.dataset.sortKey === "year" ? "Year" : "Value";
    button.textContent = `${label} ${button.dataset.sortKey === sortState.key ? arrow : ""}`.trim();
    button.classList.toggle("is-active", button.dataset.sortKey === sortState.key);
  });
}

function handleSortAction(key) {
  sortState = {
    key,
    direction: sortState.key === key && sortState.direction === "asc" ? "desc" : "asc"
  };
  updateSortButtons();
  savePageConfig();
  renderInventory();
}


function updateCardView() {
  elements.grid.classList.remove("view-list", "view-images", "view-detailed");
  elements.grid.classList.add("view-detailed");
}

function getSortValue(item, key) {
  if (key === "year") return getSortYear(item.year, Number.MAX_SAFE_INTEGER);
  if (key === "value") return getValueAmount(item.value);
  return item.name;
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function getFilteredInventory() {
  const search = normalize(elements.searchFilter.value);
  const type = elements.typeFilter.value;
  const country = elements.countryFilter.value;
  const value = elements.valueFilter.value;
  const set = elements.setFilter.value;
  const decade = elements.yearFilter.value;

  return inventory.filter((item) => {
    const searchableText = normalize([
      item.name,
      item.country,
      item.year,
      item.collectionSet,
      item.value,
      item.material,
      item.condition,
      item.quantity,
      item.notes
    ].join(" "));

    return (!search || searchableText.includes(search))
      && (type === "all" || item.type === type)
      && (country === "all" || item.country === country)
      && (value === "all" || item.value === value)
      && (set === "all" || item.collectionSet === set)
      && (decade === "all" || getDecadeLabel(item.year) === decade);
  }).sort((a, b) => {
    const primary = compareValues(getSortValue(a, sortState.key), getSortValue(b, sortState.key));
    const ordered = sortState.direction === "asc" ? primary : -primary;

    return ordered
      || getSortYear(a.year, Number.MAX_SAFE_INTEGER) - getSortYear(b.year, Number.MAX_SAFE_INTEGER)
      || String(a.value).localeCompare(String(b.value), undefined, { numeric: true })
      || String(a.name).localeCompare(String(b.name));
  });
}

function getFaceMarkup(item, side) {
  const imageKey = side === "front" ? "frontImage" : "backImage";
  const fallbackImage = side === "front" ? item.image : "";
  const image = item[imageKey] || fallbackImage;
  const sideLabel = side === "front" ? "Front" : "Back";

  if (image) {
    return `<img src="${image}" alt="${sideLabel} of ${label(item.name)}">`;
  }

  return `<div class="image-placeholder" aria-hidden="true"><span>${sideLabel}</span></div>`;
}

function getImageMarkup(item) {
  return `
    <button class="coin-flip" type="button" aria-label="Flip ${label(item.name)} to the other side">
      <span class="coin-flip-inner">
        <span class="coin-face coin-front">${getFaceMarkup(item, "front")}</span>
        <span class="coin-face coin-back">${getFaceMarkup(item, "back")}</span>
      </span>
    </button>
  `;
}

function getItemById(id) {
  return inventory.find((item) => item.id === id);
}

function hasImage(item, side) {
  return Boolean(item[side === "front" ? "frontImage" : "backImage"] || (side === "front" && item.image));
}

function getCoinFaceDescription(item, side) {
  if (item.frontDescription && side === "front") return item.frontDescription;
  if (item.backDescription && side === "back") return item.backDescription;

  const sortYear = getSortYear(item.year);
  const value = normalize(item.value);

  if (side === "front") {
    if (sortYear && sortYear <= 1952) return "King George VI effigy";
    if (sortYear >= 2024) return "King Charles III effigy";
    if (sortYear === 2023) return "Transition monarch effigy, Queen Elizabeth II or King Charles III";
    return "Queen Elizabeth II effigy";
  }

  if (item.collectionSet === "Special Collection") {
    return item.name;
  }

  if (value === "1 cent") {
    if (String(item.year) === "1867-2017") return "Canada 150 commemorative design";
    if (String(item.year) === "1867-1967") return "Rock dove centennial design";
    return "Two maple leaves on one twig";
  }

  if (value === "5 cents") {
    if (String(item.year) === "1949") return "Newfoundland joining Confederation commemorative design";
    if (String(item.year) === "1867-1997") return "Canada 125 commemorative design";
    return "Beaver design";
  }

  if (value === "10 cents") {
    if (String(item.year) === "1867-1967") return "Mackerel centennial design";
    if (String(item.year) === "1921-2021") return "Bluenose 100th anniversary design";
    return "Bluenose schooner design";
  }

  if (value === "25 cents") {
    if (String(item.year) === "1952-2002") return "Queen Elizabeth II Golden Jubilee commemorative design";
    return "Caribou design";
  }

  if (value === "1 dollar") return "Common loon design";
  if (value === "2 dollars") return "Polar bear design";
  return "Reverse coin design";
}

function getWatchButton(item) {
  const buttonLabel = item.type === "banknote" ? "See banknote" : "See coin";
  return `<button class="watch-coin-button" type="button" data-coin-id="${item.id}">${buttonLabel}</button>`;
}

function renderListHeader() {
  const columns = [
    ["year", "Year"],
    ["value", "Face value"]
  ];

  return `
    <div class="list-header" role="row">
      ${columns.map(([key, title]) => `
        <button class="list-sort ${sortState.key === key ? "is-active" : ""}" type="button" data-sort-key="${key}">
          ${title}${sortState.key === key ? (sortState.direction === "asc" ? " \u2193" : " \u2191") : ""}
        </button>
      `).join("")}
      <span></span>
    </div>
  `;
}

function renderCard(item) {
  return `
    <article class="inventory-card ${item.type}" data-coin-id="${item.id}">
      <div class="list-row">
        <span class="list-year">${label(item.year)}</span>
        <span class="list-value">${label(item.value)}</span>
        <span class="list-type">${getTypeName(item)}</span>
        <span class="list-action">${getWatchButton(item)}</span>
      </div>
      <div class="item-image">
        ${getImageMarkup(item)}
      </div>
      <div class="item-quick">
        <span class="item-value">${label(item.value)}</span>
        <span class="item-year">${label(item.year)}</span>
      </div>
    </article>
  `;
}

function renderOverlayDetails(item) {
  const countryCode = getCountryCode(item.country);
  const flag = countryCode ? `<img class="country-flag" src="https://flagcdn.com/${countryCode}.svg" alt="${label(item.country)} flag">` : "";

  elements.overlayDetails.innerHTML = `
    <header class="overlay-country">
      ${flag}
      <span>${label(item.country)}</span>
    </header>
    <dl>
      <div><dt>Value</dt><dd>${getDisplayValue(item)}</dd></div>
      <div><dt>Year</dt><dd>${label(item.year)}</dd></div>
      <div><dt>Type</dt><dd>${getTypeName(item)}</dd></div>
      <div><dt>Set</dt><dd>${label(item.collectionSet)}</dd></div>
      <div><dt>Material</dt><dd>${label(item.material)}</dd></div>
      <div><dt>Condition</dt><dd>${label(item.condition)}</dd></div>
      <div><dt>Key Collectibles</dt><dd>${getKeyCollectibles(item)}</dd></div>
    </dl>
  `;
}
function renderOverlayBanknoteFace(item, side) {
  elements.overlayCoinInner.innerHTML = `<span class="coin-face coin-front">${getFaceMarkup(item, side)}</span>`;
}

function getOverlaySource() {
  return currentFilteredInventory.length ? currentFilteredInventory : getFilteredInventory();
}

function getOverlayIndex() {
  return getOverlaySource().findIndex((item) => item.id === overlayItem?.id);
}

function updateOverlayNavigation() {
  const source = getOverlaySource();
  const index = getOverlayIndex();
  const prevDisabled = index <= 0;
  const nextDisabled = index < 0 || index >= source.length - 1;

  elements.overlayPrev.disabled = prevDisabled;
  elements.overlayNext.disabled = nextDisabled;
  elements.overlayPrev.setAttribute("aria-disabled", String(prevDisabled));
  elements.overlayNext.setAttribute("aria-disabled", String(nextDisabled));
}

function openOverlayByOffset(offset) {
  const source = getOverlaySource();
  const index = getOverlayIndex();
  const nextItem = source[index + offset];

  if (nextItem) {
    openCoinOverlay(nextItem);
  }
}

function openCoinOverlay(item) {
  if (!item) return;

  overlayItem = item;
  overlaySide = "front";
  window.clearTimeout(overlayTurnTimer);
  renderOverlayDetails(item);
  elements.overlayCoin.classList.remove("is-flipped", "is-twisting-out", "is-twisting-in");
  elements.overlayCoin.classList.toggle("banknote", item.type === "banknote");
  elements.overlayPanel.classList.toggle("banknote", item.type === "banknote");

  if (item.type === "banknote") {
    renderOverlayBanknoteFace(item, "front");
  } else {
    elements.overlayCoinInner.innerHTML = `
      <span class="coin-face coin-front">${getFaceMarkup(item, "front")}</span>
      <span class="coin-face coin-back">${getFaceMarkup(item, "back")}</span>
    `;
  }

  elements.coinOverlay.hidden = false;
  document.body.classList.add("overlay-open");
  updateOverlayNavigation();
}

function closeCoinOverlay() {
  overlayItem = null;
  overlaySide = "front";
  window.clearTimeout(overlayTurnTimer);
  elements.overlayCoin.classList.remove("is-flipped", "is-twisting-out", "is-twisting-in", "banknote");
  elements.overlayPanel.classList.remove("banknote");
  elements.coinOverlay.hidden = true;
  document.body.classList.remove("overlay-open");
}

function renderInventory(resetVisible = true) {
  if (resetVisible) {
    visibleCount = PAGE_SIZE;
  }

  currentFilteredInventory = getFilteredInventory();
  const visibleItems = currentFilteredInventory.slice(0, visibleCount);
  const listHeader = "";

  elements.resultCount.textContent = currentFilteredInventory.length;
  elements.shownCount.textContent = visibleItems.length;
  elements.grid.innerHTML = listHeader + visibleItems.map(renderCard).join("");
  elements.emptyState.hidden = currentFilteredInventory.length > 0;
  elements.seeMoreButton.hidden = visibleItems.length >= currentFilteredInventory.length;
}

function resetAllFilters() {
  elements.searchFilter.value = "";
  elements.typeFilter.value = "all";
  elements.countryFilter.value = "all";
  elements.setFilter.value = "all";
  elements.yearFilter.value = "all";
  visibleCount = PAGE_SIZE;
  sortState = { key: "year", direction: "asc" };
  clearPageConfig();
  updateSortButtons();
  refreshValueOptions();
  refreshSetOptions();
  updateCardView();
  renderInventory();
}

function handleFilterChange(event) {
  if (event.target === elements.typeFilter || event.target === elements.countryFilter) {
    refreshValueOptions();
    refreshSetOptions();
  }

  visibleCount = PAGE_SIZE;
  updateSortButtons();
  savePageConfig();
  renderInventory();
}

[
  elements.searchFilter,
  elements.typeFilter,
  elements.countryFilter,
  elements.valueFilter,
  elements.setFilter,
  elements.yearFilter
].forEach((control) => {
  control.addEventListener("input", handleFilterChange);
});


elements.sortSelect.addEventListener("click", () => {
  const isOpen = elements.sortSelect.getAttribute("aria-expanded") === "true";
  elements.sortSelect.setAttribute("aria-expanded", String(!isOpen));
  elements.sortMenu.hidden = isOpen;
});

elements.sortMenu.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sort-key]");
  if (!button) return;

  handleSortAction(button.dataset.sortKey);
  elements.sortMenu.hidden = true;
  elements.sortSelect.setAttribute("aria-expanded", "false");
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".sort-label")) return;

  elements.sortMenu.hidden = true;
  elements.sortSelect.setAttribute("aria-expanded", "false");
});
elements.resetFilters.addEventListener("click", resetAllFilters);
elements.seeMoreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  savePageConfig();
  renderInventory(false);
});

elements.overlayCoin.addEventListener("click", () => {
  if (!overlayItem) return;

  if (overlayItem.type !== "banknote") {
    elements.overlayCoin.classList.toggle("is-flipped");
    return;
  }

  if (elements.overlayCoin.classList.contains("is-twisting-out") || elements.overlayCoin.classList.contains("is-twisting-in")) return;

  const nextSide = overlaySide === "front" ? "back" : "front";
  elements.overlayCoin.classList.add("is-twisting-out");
  window.clearTimeout(overlayTurnTimer);
  overlayTurnTimer = window.setTimeout(() => {
    overlaySide = nextSide;
    renderOverlayBanknoteFace(overlayItem, overlaySide);
    elements.overlayCoin.classList.remove("is-twisting-out");
    elements.overlayCoin.classList.add("is-twisting-in");
    window.setTimeout(() => {
      elements.overlayCoin.classList.remove("is-twisting-in");
    }, 230);
  }, 230);
});

elements.overlayPrev.addEventListener("click", () => openOverlayByOffset(-1));
elements.overlayNext.addEventListener("click", () => openOverlayByOffset(1));

elements.overlayClose.addEventListener("click", closeCoinOverlay);
elements.coinOverlay.addEventListener("click", (event) => {
  if (event.target === elements.coinOverlay) {
    closeCoinOverlay();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.coinOverlay.hidden) {
    closeCoinOverlay();
  }
});

elements.grid.addEventListener("click", (event) => {
  const sortButton = event.target.closest(".list-sort");
  if (sortButton) {
    const nextKey = sortButton.dataset.sortKey;
    sortState = {
      key: nextKey,
      direction: sortState.key === nextKey && sortState.direction === "asc" ? "desc" : "asc"
    };
    updateSortButtons();
    renderInventory();
    return;
  }

  const flipButton = event.target.closest(".coin-flip");
  if (flipButton) {
    const card = flipButton.closest(".inventory-card");
    if (card) {
      openCoinOverlay(getItemById(card.dataset.coinId));
    }
    return;
  }

  const watchButton = event.target.closest(".watch-coin-button");
  if (watchButton) {
    openCoinOverlay(getItemById(watchButton.dataset.coinId));
    return;
  }


});

setupFilters();
restorePageConfig();
updateSummary();
updateSortButtons();
updateCardView();
renderInventory(false);

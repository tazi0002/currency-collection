const inventory = Array.isArray(window.collectionInventory) ? window.collectionInventory : [];
const PAGE_SIZE = 48;

let visibleCount = PAGE_SIZE;
let currentFilteredInventory = [];
let sortState = {
  key: "year",
  direction: "asc"
};

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
  cardSizeFilter: document.querySelector("#cardSizeFilter"),
  sortYearButton: document.querySelector("#sortYearButton"),
  sortValueButton: document.querySelector("#sortValueButton"),
  resetFilters: document.querySelector("#resetFilters"),
  coinOverlay: document.querySelector("#coinOverlay"),
  overlayClose: document.querySelector("#overlayClose"),
  overlayTitle: document.querySelector("#overlayTitle"),
  overlayCoin: document.querySelector("#overlayCoin"),
  overlayCoinInner: document.querySelector("#overlayCoinInner")
};

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

function getDecadeLabel(value) {
  const sortYear = getSortYear(value);
  if (!sortYear) return "Unknown year";
  return `${Math.floor(sortYear / 10) * 10}s`;
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
  const values = uniqueSorted(getItemsForCountryOptions(), "value");

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
  const buttons = [elements.sortYearButton, elements.sortValueButton];

  buttons.forEach((button) => {
    const isActive = button.dataset.sortKey === sortState.key;
    button.classList.toggle("is-active", isActive);
    const label = button.dataset.sortKey === "year" ? "Sort by year" : "Sort by value";
    button.textContent = isActive ? `${label} ${sortState.direction === "asc" ? "↑" : "↓"}` : label;
  });
}

function handleSortAction(key) {
  sortState = {
    key,
    direction: sortState.key === key && sortState.direction === "asc" ? "desc" : "asc"
  };
  updateSortButtons();
  renderInventory();
}
function updateCardView() {
  elements.grid.classList.remove("view-list", "view-images", "view-detailed");
  elements.grid.classList.add(`view-${elements.cardSizeFilter.value}`);
}

function getSortValue(item, key) {
  if (key === "year") return getSortYear(item.year, Number.MAX_SAFE_INTEGER);
  if (key === "value") return item.value;
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
  return `<button class="watch-coin-button" type="button" data-coin-id="${item.id}">See coin</button>`;
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
          ${title}${sortState.key === key ? (sortState.direction === "asc" ? " ↑" : " ↓") : ""}
        </button>
      `).join("")}
      <span></span>
    </div>
  `;
}

function renderCard(item) {
  const detailsId = `details-${item.id}`;
  const quantity = item.quantity || 1;
  const itemTypeLabel = getItemTypeLabel(item);

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
        <p class="item-year">${label(item.year)}</p>
        <button class="details-toggle" type="button" aria-expanded="false" aria-controls="${detailsId}">More detail</button>
      </div>
      <div class="item-details" id="${detailsId}" hidden>
        <div class="card-topline">
          <span>${getTypeName(item)}</span>
          <span>${label(item.value)}</span>
        </div>
        <dl>
          <div><dt>Country</dt><dd>${label(item.country)}</dd></div>
          <div><dt>Set</dt><dd>${label(item.collectionSet)}</dd></div>
          <div><dt>Front</dt><dd>${getCoinFaceDescription(item, "front")}</dd></div>
          <div><dt>Back</dt><dd>${getCoinFaceDescription(item, "back")}</dd></div>
          <div><dt>Material</dt><dd>${label(item.material)}</dd></div>
          <div><dt>Condition</dt><dd>${label(item.condition)}</dd></div>
        </dl>
        ${item.notes ? `<p class="notes">${item.notes}</p>` : ""}
        <div class="detail-coin-action">${getWatchButton(item)}</div>
      </div>
    </article>
  `;
}

function openCoinOverlay(item) {
  if (!item) return;

  elements.overlayTitle.textContent = `${getItemTypeLabel(item)} - ${label(item.year)}`;
  elements.overlayCoin.classList.remove("is-flipped");
  elements.overlayCoinInner.innerHTML = `
    <span class="coin-face coin-front">${getFaceMarkup(item, "front")}</span>
    <span class="coin-face coin-back">${getFaceMarkup(item, "back")}</span>
  `;
  elements.coinOverlay.hidden = false;
  document.body.classList.add("overlay-open");
}

function closeCoinOverlay() {
  elements.coinOverlay.hidden = true;
  document.body.classList.remove("overlay-open");
}

function renderInventory(resetVisible = true) {
  if (resetVisible) {
    visibleCount = PAGE_SIZE;
  }

  currentFilteredInventory = getFilteredInventory();
  const visibleItems = currentFilteredInventory.slice(0, visibleCount);
  const listHeader = elements.cardSizeFilter.value === "list" && visibleItems.length ? renderListHeader() : "";

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
  elements.cardSizeFilter.value = "images";
  sortState = { key: "year", direction: "asc" };
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

  updateSortButtons();
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

elements.cardSizeFilter.addEventListener("input", () => {
  updateCardView();
  renderInventory(false);
});

elements.sortYearButton.addEventListener("click", () => handleSortAction("year"));
elements.sortValueButton.addEventListener("click", () => handleSortAction("value"));

elements.resetFilters.addEventListener("click", resetAllFilters);
elements.seeMoreButton.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderInventory(false);
});

elements.overlayCoin.addEventListener("click", () => {
  elements.overlayCoin.classList.toggle("is-flipped");
});

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
    if (elements.cardSizeFilter.value === "images" && card) {
      openCoinOverlay(getItemById(card.dataset.coinId));
    } else {
      flipButton.classList.toggle("is-flipped");
    }
    return;
  }

  const watchButton = event.target.closest(".watch-coin-button");
  if (watchButton) {
    openCoinOverlay(getItemById(watchButton.dataset.coinId));
    return;
  }

  const button = event.target.closest(".details-toggle");
  if (!button) return;

  const details = document.getElementById(button.getAttribute("aria-controls"));
  const isOpen = button.getAttribute("aria-expanded") === "true";

  button.setAttribute("aria-expanded", String(!isOpen));
  button.textContent = isOpen ? "More detail" : "Hide detail";
  details.hidden = isOpen;
});

setupFilters();
updateSummary();
updateSortButtons();
updateCardView();
renderInventory();






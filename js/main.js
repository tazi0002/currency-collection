const inventory = Array.isArray(window.collectionInventory) ? window.collectionInventory : [];
const missingCoins = Array.isArray(window.missingCoins) ? window.missingCoins : [];
const PAGE_SIZE = 48;
const STORAGE_KEY = "currencyCollectionConfig";
const NORMAL_SET_FILTER = "__normal_circulation";
const SPECIAL_SET_FILTER = "__all_special_coins";

let visibleCount = PAGE_SIZE;
let currentFilteredInventory = [];
let activeView = "inventory";
let cardView = "images";
let sortState = {
  key: "year",
  direction: "asc"
};
let overlayItem = null;
let overlaySide = "front";
let overlayTurnTimer = null;
let overlayNavAnimating = false;

const elements = {
  filters: document.querySelector("#filters"),
  inventoryTitle: document.querySelector("#inventory-title"),
  viewTabs: document.querySelectorAll("[data-view]"),
  cardViewButtons: document.querySelectorAll("[data-card-view]"),
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
  mobileFilterToggle: document.querySelector("#mobileFilterToggle"),
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
    activeView,
    cardView,
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


    activeView = saved.activeView === "missing" ? "missing" : "inventory";
    cardView = saved.cardView === "list" ? "list" : "images";
    updateViewTabs();
    updateInventoryTitle();
    updateCardView();
    elements.searchFilter.value = saved.search || "";
    elements.typeFilter.value = saved.type || "all";
    refreshCountryOptions(saved.country || "all");
    refreshYearOptions(saved.year || "all");
    refreshValueOptions();
    refreshSetOptions();
    elements.valueFilter.value = [...elements.valueFilter.options].some((option) => option.value === saved.value) ? saved.value : "all";
    elements.setFilter.value = [...elements.setFilter.options].some((option) => option.value === saved.set) ? saved.set : "all";
    elements.yearFilter.value = [...elements.yearFilter.options].some((option) => option.value === saved.year) ? saved.year : "all";
    sortState = {
      key: ["year", "value", "country"].includes(saved.sortKey) ? saved.sortKey : "year",
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
    Afghanistan: "af",
    Algeria: "dz",
    Argentina: "ar",
    Armenia: "am",
    Australia: "au",
    Azerbaijan: "az",
    Bangladesh: "bd",
    Belarus: "by",
    Bolivia: "bo",
    Brazil: "br",
    Bulgaria: "bg",
    Burundi: "bi",
    Cambodia: "kh",
    Canada: "ca",
    China: "cn",
    Croatia: "hr",
    Cuba: "cu",
    "Czech Republic": "cz",
    Denmark: "dk",
    "Dominican Republic": "do",
    Drcongo: "cd",
    Egypt: "eg",
    "European Union": "eu",
    Fiji: "fj",
    Georgia: "ge",
    Germany: "de",
    Ghana: "gh",
    Guinea: "gn",
    Honduras: "hn",
    Hongkong: "hk",
    India: "in",
    Indonesia: "id",
    Iran: "ir",
    Iraq: "iq",
    Italy: "it",
    Jamaica: "jm",
    Japan: "jp",
    Kenya: "ke",
    Kuwait: "kw",
    Laos: "la",
    Lebanon: "lb",
    Liberia: "lr",
    Madagascar: "mg",
    Malawi: "mw",
    Malaysia: "my",
    Mauritania: "mr",
    Mexico: "mx",
    Mozambique: "mz",
    Myanmar: "mm",
    Nepal: "np",
    Nigeria: "ng",
    "North Korea": "kp",
    Norway: "no",
    Oman: "om",
    Pakistan: "pk",
    Peru: "pe",
    Philippines: "ph",
    Qatar: "qa",
    Romania: "ro",
    Russia: "ru",
    Saudiarabia: "sa",
    Singapore: "sg",
    Somalia: "so",
    "South Africa": "za",
    "South Korea": "kr",
    Srilanka: "lk",
    Suriname: "sr",
    Sweden: "se",
    Switzerland: "ch",
    Syria: "sy",
    Tanzania: "tz",
    Thailand: "th",
    Transnistria: "md",
    "Trinidad and Tobago": "tt",
    Tunisia: "tn",
    Turkey: "tr",
    Turkmenistan: "tm",
    Uganda: "ug",
    Ukraine: "ua",
    "United Arab Emirates": "ae",
    "United Kingdom": "gb",
    Uruguay: "uy",
    Usa: "us",
    Ussr: "ru",
    Venezuela: "ve",
    Vietnam: "vn",
    Yemen: "ye",
    Yugoslavia: "rs",
    Zaire: "cd",
    Zambia: "zm",
    Zimbabwe: "zw"
  }[country] || "";
}

function titleCaseValue(value) {
  return label(value).toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatNumberGroups(value) {
  return String(value ?? "").replace(/\d{4,}/g, (match) => Number(match).toLocaleString("en-US"));
}

function formatValueLabel(value) {
  return titleCaseValue(formatNumberGroups(value));
}

function getDisplayValue(item) {
  const value = formatValueLabel(item.value);

  if (item.country === "Canada") {
    return value.replace(/Dollar\b/, "Canadian Dollar").replace(/Dollars\b/, "Canadian Dollars").replace(/Cent\b/, "Canadian Cent").replace(/Cents\b/, "Canadian Cents");
  }

  return value;
}

function getCoinMaterial(item) {
  const year = getSortYear(item.year);
  const value = normalize(item.value);

  if (item.status !== "missing" || item.material !== "Not listed") return label(item.material);
  if (value === "1 cent") {
    if (year >= 2000) return "Copper-plated steel";
    if (year >= 1997) return "Copper-plated zinc";
    if (year >= 1978) return "Copper-heavy alloy";
    return "Bronze";
  }
  if (value === "5 cents") {
    if (year <= 1921) return "Silver";
    if (year >= 2000) return "Multi-ply plated steel";
    if (year >= 1982) return "Cupro-nickel";
    if (year >= 1942 && year <= 1945) return "Wartime tombac or steel issue";
    return "Nickel";
  }
  if (value === "10 cents") {
    if (year <= 1967) return "Silver";
    if (year >= 2000) return "Nickel-plated steel";
    return "Nickel";
  }
  if (value === "25 cents") {
    if (year <= 1967) return "Silver";
    if (year >= 2000) return "Nickel-plated steel";
    return "Nickel";
  }
  if (value === "1 dollar") {
    if (year <= 1967) return "Silver";
    if (year <= 1986) return "Nickel";
    if (year >= 2012) return "Brass-plated steel";
    return "Bronze-plated nickel";
  }
  if (value === "2 dollars") {
    if (year >= 2012) return "Plated steel ring with brass-plated core";
    return "Bi-metallic nickel ring with aluminum-bronze core";
  }
  return label(item.material);
}

function getMissingCoinNotes(item) {
  const year = getSortYear(item.year);
  const value = normalize(item.value);
  const name = label(item.name);

  if (item.status !== "missing") return item.notes;
  if (item.collectionSet === "Special Collection") return name.replace(/^Canadian\s+/i, "");

  if (value === "1 cent") {
    if ([1923, 1925].includes(year)) return "Key rarity: very low mintage small cent.";
    if (year === 1936) return "Notable variant year: 1936 Dot is a major rarity.";
    if (year === 1955) return "Notable variant: No Shoulder Fold variety.";
    if (year === 2006) return "Notable variants: logo, no-logo, P, and rare non-magnetic no-logo/no-P error.";
    if (year === 1967) return "Centennial Rock Dove design.";
    if (year === 2012) return "Final production year for the Canadian penny.";
  }
  if (value === "5 cents") {
    if (year === 1921) return "Key rarity: 1921 silver 5-cent, most mintage melted.";
    if (year >= 1943 && year <= 1945) return "Victory V wartime design with Morse code rim message.";
    if (year === 1951) return "Nickel Refinery commemorative design.";
    if (year === 1953) return "Shoulder Fold and No Shoulder Fold varieties exist.";
    if (year === 1967) return "Centennial Hare design.";
  }
  if (value === "10 cents") {
    if (year === 1936) return "Key variant year: Dot or Bar dime varieties are rare.";
    if (year === 1967) return "Centennial Mackerel design.";
    if (year === 1968) return "Transition year: silver and nickel versions exist.";
    if (year === 2021) return "Bluenose 100th anniversary, including colourized version.";
  }
  if (value === "25 cents") {
    if (year === 1973) return "RCMP Centennial Mountie design.";
    if (year === 1992) return "Canada 125 provincial and territorial quarter series.";
    if (year === 1999 || year === 2000) return "Millennium quarter series year.";
    if (year >= 2007 && year <= 2010) return "Vancouver Olympics or Paralympics quarter era.";
  }
  if (value === "1 dollar") {
    if (year === 1948) return "Key rarity: 1948 silver dollar has very low mintage.";
    if (year === 1987) return "First modern Loonie year.";
    if (year === 2023) return "King Charles III transition year.";
  }
  if (value === "2 dollars") {
    if (year === 1996) return "First Toonie year; German planchet variety exists.";
    if (year === 2012) return "Security feature transition year.";
    if (year === 2017) return "Dance of the Spirits glow-in-the-dark commemorative year.";
    if (year === 2022) return "Black-ring Queen Elizabeth II memorial issue.";
  }

  return "Missing from collection.";
}

function getKeyCollectibles(item) {
  if (item.status === "missing") return getMissingCoinNotes(item);
  if (item.notes) return item.notes;
  if (item.type === "coin" && item.collectionSet !== "Canada Circulation") return item.name;
  return "None listed";
}
function getTypeName(item) {
  return item.type === "banknote" ? "Banknote" : "Coin";
}

function getItemTypeLabel(item) {
  return `${getTypeName(item)} ${formatValueLabel(item.value)}`;
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
    option.textContent = select === elements.valueFilter ? formatValueLabel(value) : String(value);
    select.appendChild(option);
  });
}

function addSetQuickOption(value, labelText) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = labelText;
  option.className = "priority-set-option";
  elements.setFilter.appendChild(option);
}

function getCountryContinent(country) {
  return {
    Afghanistan: "Asia",
    Algeria: "Africa",
    Argentina: "South America",
    Armenia: "Asia",
    Australia: "Oceania",
    Azerbaijan: "Asia",
    Bangladesh: "Asia",
    Belarus: "Europe",
    Bolivia: "South America",
    Brazil: "South America",
    Bulgaria: "Europe",
    Burundi: "Africa",
    Cambodia: "Asia",
    China: "Asia",
    Croatia: "Europe",
    Cuba: "North America",
    "Czech Republic": "Europe",
    Denmark: "Europe",
    "Dominican Republic": "North America",
    Drcongo: "Africa",
    Egypt: "Africa",
    "European Union": "Europe",
    Fiji: "Oceania",
    Georgia: "Asia",
    Germany: "Europe",
    Ghana: "Africa",
    Guinea: "Africa",
    Honduras: "North America",
    Hongkong: "Asia",
    India: "Asia",
    Indonesia: "Asia",
    Iraq: "Asia",
    Italy: "Europe",
    Jamaica: "North America",
    Japan: "Asia",
    Kenya: "Africa",
    Kuwait: "Asia",
    Laos: "Asia",
    Lebanon: "Asia",
    Liberia: "Africa",
    Madagascar: "Africa",
    Malawi: "Africa",
    Malaysia: "Asia",
    Mauritania: "Africa",
    Mexico: "North America",
    Mozambique: "Africa",
    Myanmar: "Asia",
    Nepal: "Asia",
    Nigeria: "Africa",
    "North Korea": "Asia",
    Norway: "Europe",
    Oman: "Asia",
    Pakistan: "Asia",
    Peru: "South America",
    Philippines: "Asia",
    Qatar: "Asia",
    Romania: "Europe",
    Russia: "Europe",
    Saudiarabia: "Asia",
    Singapore: "Asia",
    Somalia: "Africa",
    "South Africa": "Africa",
    "South Korea": "Asia",
    Srilanka: "Asia",
    Suriname: "South America",
    Sweden: "Europe",
    Switzerland: "Europe",
    Syria: "Asia",
    Tanzania: "Africa",
    Thailand: "Asia",
    Transnistria: "Europe",
    "Trinidad and Tobago": "North America",
    Tunisia: "Africa",
    Turkey: "Asia",
    Turkmenistan: "Asia",
    Uganda: "Africa",
    Ukraine: "Europe",
    "United Arab Emirates": "Asia",
    "United Kingdom": "Europe",
    Uruguay: "South America",
    Usa: "North America",
    Ussr: "Europe",
    Venezuela: "South America",
    Vietnam: "Asia",
    Yemen: "Asia",
    Yugoslavia: "Europe",
    Zaire: "Africa",
    Zambia: "Africa",
    Zimbabwe: "Africa"
  }[country] || "";
}

function getCountryGroup(item) {
  const countryContinent = getCountryContinent(item.country);
  if (countryContinent) return countryContinent;

  const match = String(item.collectionSet || "").match(/^(Europe|Asia|Africa|North America|South America|Oceania)\s+(Banknotes|Coins)$/);
  return match ? match[1] : "Other Countries";
}

function isContinentFilter(value) {
  return String(value).startsWith("continent:");
}

function matchesCountrySelection(item, selection) {
  if (selection === "all") return true;
  if (isContinentFilter(selection)) return getCountryGroup(item) === selection.replace("continent:", "");
  return item.country === selection;
}


function getActiveItems() {
  return activeView === "missing" ? missingCoins : inventory;
}

function updateInventoryTitle() {
  if (elements.inventoryTitle) {
    elements.inventoryTitle.textContent = activeView === "missing" ? "Missing" : "Inventory";
  }
}

function updateViewTabs() {
  elements.viewTabs.forEach((tab) => {
    const isActive = tab.dataset.view === activeView;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function refreshYearOptions(preferredValue = elements.yearFilter.value) {
  const years = uniqueSorted(getActiveItems().map((item) => ({ decade: getDecadeLabel(item.year) })), "decade");

  clearSelect(elements.yearFilter, "All years");
  addSelectOptions(elements.yearFilter, years);
  elements.yearFilter.value = years.includes(preferredValue) ? preferredValue : "all";
}

function canOpenOverlay(item) {
  return Boolean(item && (item.status === "missing" || item.type === "coin" || hasAnyImage(item)));
}
function getItemsForSelectedType() {
  const type = elements.typeFilter.value;
  return getActiveItems().filter((item) => type === "all" || item.type === type);
}

function refreshCountryOptions(preferredValue = elements.countryFilter.value) {
  const items = getItemsForSelectedType();
  const continentCounts = new Map();

  clearSelect(elements.countryFilter, "All countries");
    ["Iran", "Canada"].filter((country) => items.some((item) => item.country === country)).forEach((country) => {
    const option = document.createElement("option");
    option.value = country;
    option.textContent = country;
    option.className = "priority-country-option";
    elements.countryFilter.appendChild(option);
  });

  items.forEach((item) => {
    if (["Iran", "Canada"].includes(item.country)) return;
    const continent = getCountryGroup(item);
    if (!continent || continent === "Other Countries") return;
    continentCounts.set(continent, (continentCounts.get(continent) || 0) + 1);
  });

  [...continentCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .forEach(([continent]) => {
      const option = document.createElement("option");
      option.value = `continent:${continent}`;
      option.textContent = continent;
      elements.countryFilter.appendChild(option);
    });

  elements.countryFilter.value = [...elements.countryFilter.options].some((option) => option.value === preferredValue)
    ? preferredValue
    : "all";
}
function getItemsForCountryOptions(options = {}) {
  const { ignoreValue = false } = options;
  const type = elements.typeFilter.value;
  const country = elements.countryFilter.value;
  const value = ignoreValue ? "all" : elements.valueFilter.value;
  const decade = elements.yearFilter.value;

  if (country === "all") {
    return [];
  }

  return getActiveItems().filter((item) => {
    return (type === "all" || item.type === type)
      && matchesCountrySelection(item, country)
      && (value === "all" || item.value === value)
      && (decade === "all" || getDecadeLabel(item.year) === decade);
  });
}

function refreshValueOptions() {
  const currentValue = elements.valueFilter.value;
  const values = uniqueValuesByAmount(getItemsForCountryOptions({ ignoreValue: true }));

  clearSelect(elements.valueFilter, "All values");
  elements.valueFilter.disabled = elements.countryFilter.value === "all";
  addSelectOptions(elements.valueFilter, values);

  elements.valueFilter.value = values.includes(currentValue) ? currentValue : "all";
}

function getSetOptionItems() {
  const type = elements.typeFilter.value;
  const country = elements.countryFilter.value;

  if (activeView === "missing" && country === "Canada" && (type === "all" || type === "coin")) {
    return missingCoins.filter((item) => item.country === "Canada" && item.type === "coin");
  }

  return getItemsForCountryOptions();
}

function refreshSetOptions() {
  const currentSet = elements.setFilter.value;
  const optionItems = getSetOptionItems();
  const sets = uniqueSorted(optionItems, "collectionSet")
    .filter((set) => set !== "Special Collection");
  const showCoinQuickOptions = optionItems.some((item) => item.type === "coin");
  const quickValues = showCoinQuickOptions ? [NORMAL_SET_FILTER, SPECIAL_SET_FILTER] : [];
  const availableValues = ["all", ...quickValues, ...sets];

  clearSelect(elements.setFilter, "All sets");
  elements.setFilter.disabled = elements.countryFilter.value === "all";
  if (!elements.setFilter.disabled && showCoinQuickOptions) {
    addSetQuickOption(NORMAL_SET_FILTER, "All normal circulations");
    addSetQuickOption(SPECIAL_SET_FILTER, "All especials");
  }
  addSelectOptions(elements.setFilter, sets);

  elements.setFilter.value = availableValues.includes(currentSet) ? currentSet : "all";
}

function setupFilters() {
  refreshCountryOptions();
  refreshYearOptions();
  refreshValueOptions();
  refreshSetOptions();
}

function updateSummary() {
  const items = getActiveItems();
  elements.totalItems.textContent = items.length;
  elements.coinCount.textContent = items.filter((item) => item.type === "coin").length;
  elements.banknoteCount.textContent = items.filter((item) => item.type === "banknote").length;
}

function getSortLabel(key) {
  return {
    year: "Year",
    value: "Value",
    country: "Country"
  }[key] || "Year";
}

function updateSortButtons() {
  const arrow = sortState.direction === "asc" ? "\u2193" : "\u2191";
  const activeLabel = getSortLabel(sortState.key);

  elements.sortSelect.textContent = `${activeLabel} ${arrow}`;
  elements.sortMenu.querySelectorAll("[data-sort-key]").forEach((button) => {
    const label = getSortLabel(button.dataset.sortKey);
    button.textContent = `${label} ${button.dataset.sortKey === sortState.key ? arrow : ""}`.trim();
    button.classList.toggle("is-active", button.dataset.sortKey === sortState.key);
  });
}

function getActiveFilterCount() {
  return [
    elements.searchFilter.value.trim(),
    elements.typeFilter.value !== "all",
    elements.countryFilter.value !== "all",
    elements.valueFilter.value !== "all",
    elements.setFilter.value !== "all",
    elements.yearFilter.value !== "all"
  ].filter(Boolean).length;
}

function updateMobileFilterToggle() {
  const count = getActiveFilterCount();
  const suffix = count ? ` (${count})` : "";

  elements.mobileFilterToggle.textContent = `Filter${suffix}`;
}

function setMobileFiltersOpen(isOpen) {
  elements.filters.classList.toggle("is-mobile-open", isOpen);
  elements.mobileFilterToggle.setAttribute("aria-expanded", String(isOpen));
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
  elements.grid.classList.add(cardView === "list" ? "view-list" : "view-images");
  elements.cardViewButtons.forEach((button) => {
    const isActive = button.dataset.cardView === cardView;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getSortValue(item, key) {
  if (key === "year") return getSortYear(item.year, Number.MAX_SAFE_INTEGER);
  if (key === "value") return getValueAmount(item.value);
  if (key === "country") return item.country || "";
  return item.name;
}

function compareValues(a, b) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function matchesSetFilter(item, set) {
  if (set === "all") return true;
  if (set === NORMAL_SET_FILTER) return item.collectionSet === "Canada Circulation";
  if (set === SPECIAL_SET_FILTER) return item.type === "coin" && item.collectionSet !== "Canada Circulation";
  return item.collectionSet === set;
}

function getFilteredInventory() {
  const search = normalize(elements.searchFilter.value);
  const type = elements.typeFilter.value;
  const country = elements.countryFilter.value;
  const value = elements.valueFilter.value;
  const set = elements.setFilter.value;
  const decade = elements.yearFilter.value;

  return getActiveItems().filter((item) => {
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
      && matchesCountrySelection(item, country)
      && (value === "all" || item.value === value)
      && matchesSetFilter(item, set)
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

function hasAnyImage(item) {
  return hasImage(item, "front") || hasImage(item, "back");
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
  const firstSide = item.type === "coin" ? "back" : "front";
  const secondSide = item.type === "coin" ? "front" : "back";

  return `
    <button class="coin-flip" type="button" aria-label="Flip ${label(item.name)} to the other side">
      <span class="coin-flip-inner">
        <span class="coin-face coin-front">${getFaceMarkup(item, firstSide)}</span>
        <span class="coin-face coin-back">${getFaceMarkup(item, secondSide)}</span>
      </span>
    </button>
  `;
}

function getItemById(id) {
  return [...inventory, ...missingCoins].find((item) => item.id === id);
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
  if (!canOpenOverlay(item)) return "";
  const buttonLabel = item.status === "missing" ? "Details" : item.type === "banknote" ? "See banknote" : "See coin";
  return `<button class="watch-coin-button" type="button" data-coin-id="${item.id}">${buttonLabel}</button>`;
}


function getListActionMarkup(item) {
  if (item.status === "missing") return getWatchButton(item);

  return `
    <button class="list-thumb coin-flip" type="button" aria-label="Open ${label(item.name)}">
      <span class="coin-flip-inner">
        <span class="coin-face coin-front">${getFaceMarkup(item, item.type === "coin" ? "back" : "front")}</span>
        <span class="coin-face coin-back">${getFaceMarkup(item, item.type === "coin" ? "front" : "back")}</span>
      </span>
    </button>
  `;
}
function isCanadianSpecialCoin(item) {
  return item.type === "coin"
    && item.country === "Canada"
    && item.collectionSet
    && item.collectionSet !== "Canada Circulation";
}

function getCoinDisplayName(item) {
  if (!isCanadianSpecialCoin(item)) return "";
  const name = label(item.name)
    .replace(/^Canadian\s+/i, "")
    .replace(/\s+Coin$/i, "")
    .trim();
  return name && name !== "Not listed" ? name : "";
}

function isSpecialListItem(item) {
  return isCanadianSpecialCoin(item);
}

function getListYearLabel(item) {
  const baseYear = label(item.year);
  if (item.type === "banknote") {
    const languageMatch = String(item.name || "").match(/\((English|French)\)/i);
    const language = languageMatch ? ` (${languageMatch[1]})` : "";
    return `${formatValueLabel(item.value)}${language}`;
  }
  if (!isSpecialListItem(item)) return baseYear;

  const detail = label(item.name)
    .replace(/^Canadian\s+/i, "")
    .replace(/\s+Coin$/i, "")
    .trim();

  return detail && detail !== baseYear ? `${baseYear} (${detail})` : baseYear;
}

function getListPrimaryGroup(item) {
  if (item.type === "coin") {
    const selectedCountry = elements.countryFilter.value;
    return ["Canada", "Iran"].includes(selectedCountry) ? formatValueLabel(item.value) : "";
  }

  if (item.type === "banknote") {
    const setLabel = getSetLabel(item);
    if (setLabel && setLabel !== "Not listed") return setLabel;
    if (item.country) return label(item.country);
    return getCountryGroup(item);
  }

  return "";
}

function renderYearListGroup(items) {
  const decadeGroups = new Map();

  items.forEach((item) => {
    const decade = getDecadeLabel(item.year);
    if (!decadeGroups.has(decade)) decadeGroups.set(decade, []);
    decadeGroups.get(decade).push(item);
  });

  return [...decadeGroups.entries()].map(([, groupItems]) => `
    <div class="year-list-group">
      ${groupItems.map((item, index) => `
        ${index ? '<span class="year-separator">-</span>' : ''}
        <button class="year-list-item" type="button" data-coin-id="${item.id}">${getListYearLabel(item)}</button>
      `).join("")}
    </div>
  `).join("");
}

function renderYearList(items) {
  const primaryGroups = new Map();

  items.forEach((item) => {
    const primaryGroup = getListPrimaryGroup(item);
    if (!primaryGroups.has(primaryGroup)) primaryGroups.set(primaryGroup, []);
    primaryGroups.get(primaryGroup).push(item);
  });

  return [...primaryGroups.entries()].map(([groupName, groupItems]) => `
    <section class="year-list-section">
      ${groupName ? `<h2 class="year-list-title">${groupName}</h2>` : ""}
      ${renderYearListGroup(groupItems)}
    </section>
  `).join("");
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
      <span>Type</span>
      <span></span>
    </div>
  `;
}

function renderCard(item) {
  const coinDisplayName = getCoinDisplayName(item);
  return `
    <article class="inventory-card ${item.type} ${item.status === "missing" ? "missing" : ""}" data-coin-id="${item.id}">
      <div class="list-row">
        <span class="list-year">${label(item.year)}</span>
        <span class="list-value">${formatValueLabel(item.value)}</span>
        <span class="list-type">${getTypeName(item)}</span>
        <span class="list-action">${getListActionMarkup(item)}</span>
      </div>
      <div class="item-image">
        ${getImageMarkup(item)}
      </div>
      <div class="item-quick">
        <span class="item-value">${formatValueLabel(item.value)}</span>
        ${coinDisplayName ? `<span class="item-name">${coinDisplayName}</span>` : ""}
        <span class="item-year">${label(item.year)}</span>
      </div>
    </article>
  `;
}

function getSetLabel(item) {
  return label(String(item.collectionSet || "").replace(/\s+Banknotes?$/i, "").trim());
}

function renderOverlayDetails(item) {
  const coinDisplayName = getCoinDisplayName(item);
  const countryCode = getCountryCode(item.country);
  const flag = countryCode ? `<img class="country-flag" src="https://flagcdn.com/${countryCode}.svg" alt="${label(item.country)} flag">` : "";

  elements.overlayDetails.innerHTML = `
    <header class="overlay-country">
      ${flag}
      <span>${label(item.country)}</span>
    </header>
    <dl>
      <div><dt>Value</dt><dd>${getDisplayValue(item)}</dd></div>
      ${coinDisplayName ? `<div><dt>Coin</dt><dd>${coinDisplayName}</dd></div>` : ""}
      <div><dt>Year</dt><dd>${label(item.year)}</dd></div>
      <div><dt>Type</dt><dd>${getTypeName(item)}</dd></div>
      <div><dt>Set</dt><dd>${getSetLabel(item)}</dd></div>
      <div><dt>Material</dt><dd>${getCoinMaterial(item)}</dd></div>
      <div><dt>Condition</dt><dd>${label(item.condition)}</dd></div>
      <div><dt>Key Collectibles</dt><dd>${getKeyCollectibles(item)}</dd></div>
    </dl>
  `;
}
function renderOverlayBanknoteFace(item, side) {
  elements.overlayCoinInner.innerHTML = `<span class="coin-face coin-front">${getFaceMarkup(item, side)}</span>`;
}

function renderOverlayCoinFace(item, side) {
  elements.overlayCoinInner.innerHTML = `<span class="coin-face coin-front">${getFaceMarkup(item, side)}</span>`;
}

function getFaceImageSource(item, side) {
  const imageKey = side === "front" ? "frontImage" : "backImage";
  return item[imageKey] || (side === "front" ? item.image : "");
}

function preloadOverlayImages(item) {
  [getFaceImageSource(item, "front"), getFaceImageSource(item, "back")]
    .filter(Boolean)
    .forEach((src) => {
      const image = new Image();
      image.src = src;
      if (typeof image.decode === "function") {
        image.decode().catch(() => {});
      }
    });
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

function clearOverlayMotionClasses() {
  elements.overlayCoin.classList.remove(
    "is-flipped",
    "is-twisting-out",
    "is-twisting-in",
    "is-nav-out-left",
    "is-nav-in-left",
    "is-nav-out-right",
    "is-nav-in-right"
  );
}

function setOverlayItem(item) {
  overlayItem = item;
  overlaySide = "front";
  window.clearTimeout(overlayTurnTimer);
  preloadOverlayImages(item);
  renderOverlayDetails(item);
  elements.overlayCoin.classList.toggle("banknote", item.type === "banknote");
  elements.overlayPanel.classList.toggle("banknote", item.type === "banknote");

  if (item.type === "banknote") {
    renderOverlayBanknoteFace(item, "front");
  } else {
    renderOverlayCoinFace(item, "front");
  }

  updateOverlayNavigation();
}

function animateOverlayToItem(nextItem, direction) {
  if (overlayNavAnimating || !nextItem) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearOverlayMotionClasses();
    setOverlayItem(nextItem);
    return;
  }

  overlayNavAnimating = true;
  elements.overlayPrev.disabled = true;
  elements.overlayNext.disabled = true;
  clearOverlayMotionClasses();

  const outClass = direction === "left" ? "is-nav-out-left" : "is-nav-out-right";
  const inClass = direction === "left" ? "is-nav-in-left" : "is-nav-in-right";

  requestAnimationFrame(() => {
    elements.overlayCoin.classList.add(outClass);
  });

  elements.overlayCoin.addEventListener("animationend", function handleOut(event) {
    if (event.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains(outClass)) return;

    elements.overlayCoin.removeEventListener("animationend", handleOut);
    elements.overlayCoin.classList.remove(outClass);
    setOverlayItem(nextItem);

    requestAnimationFrame(() => {
      elements.overlayCoin.classList.add(inClass);
      elements.overlayCoin.addEventListener("animationend", function handleIn(innerEvent) {
        if (innerEvent.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains(inClass)) return;

        elements.overlayCoin.removeEventListener("animationend", handleIn);
        elements.overlayCoin.classList.remove(inClass);
        overlayNavAnimating = false;
        updateOverlayNavigation();
      });
    });
  });
}

function openOverlayByOffset(offset) {
  const source = getOverlaySource();
  const index = getOverlayIndex();
  const nextItem = source[index + offset];

  animateOverlayToItem(nextItem, offset < 0 ? "left" : "right");
}

function openCoinOverlay(item) {
  if (!item) return;

  overlayNavAnimating = false;
  clearOverlayMotionClasses();
  setOverlayItem(item);
  elements.coinOverlay.hidden = false;
  document.body.classList.add("overlay-open");
}

function closeCoinOverlay() {
  overlayItem = null;
  overlaySide = "front";
  window.clearTimeout(overlayTurnTimer);
  overlayNavAnimating = false;
  clearOverlayMotionClasses();
  elements.overlayCoin.classList.remove("banknote");
  elements.overlayPanel.classList.remove("banknote");
  elements.coinOverlay.hidden = true;
  document.body.classList.remove("overlay-open");
}

function renderInventory(resetVisible = true) {
  if (resetVisible) {
    visibleCount = PAGE_SIZE;
  }

  currentFilteredInventory = getFilteredInventory();
  const visibleItems = cardView === "list" ? currentFilteredInventory : currentFilteredInventory.slice(0, visibleCount);
  const renderedItems = cardView === "list" ? renderYearList(visibleItems) : visibleItems.map(renderCard).join("");

  updateInventoryTitle();
  updateViewTabs();
  updateSummary();
  updateCardView();
  const hasMoreItems = cardView !== "list" && visibleCount < currentFilteredInventory.length;
  if (!hasMoreItems) {
    visibleCount = currentFilteredInventory.length;
  }

  elements.resultCount.textContent = currentFilteredInventory.length;
  elements.shownCount.textContent = visibleItems.length;
  elements.grid.innerHTML = renderedItems;
  elements.emptyState.hidden = currentFilteredInventory.length > 0;
  elements.seeMoreButton.hidden = !hasMoreItems;
  elements.seeMoreButton.setAttribute("aria-hidden", String(!hasMoreItems));
  updateMobileFilterToggle();
}

function resetAllFilters() {
  elements.searchFilter.value = "";
  elements.typeFilter.value = "all";
  refreshCountryOptions("all");
  refreshYearOptions("all");
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
  if (event.target === elements.typeFilter) {
    refreshCountryOptions();
  }

  if (event.target === elements.typeFilter) {
    refreshYearOptions();
  }

  if (event.target === elements.typeFilter || event.target === elements.countryFilter || event.target === elements.valueFilter || event.target === elements.yearFilter) {
    if (event.target !== elements.valueFilter) refreshValueOptions();
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



elements.viewTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const nextView = tab.dataset.view === "missing" ? "missing" : "inventory";
    if (nextView === activeView) return;

    activeView = nextView;
    visibleCount = PAGE_SIZE;
    elements.typeFilter.value = "all";
    refreshCountryOptions("all");
    refreshYearOptions("all");
    refreshValueOptions();
    refreshSetOptions();
    updateSortButtons();
    updateSummary();
    updateCardView();
    savePageConfig();
    renderInventory();
  });
});


elements.cardViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    cardView = button.dataset.cardView === "list" ? "list" : "images";
    updateCardView();
    savePageConfig();
    renderInventory(false);
  });
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
elements.mobileFilterToggle.addEventListener("click", () => {
  setMobileFiltersOpen(!elements.filters.classList.contains("is-mobile-open"));
});
elements.seeMoreButton.addEventListener("click", () => {
  if (visibleCount >= currentFilteredInventory.length) {
    elements.seeMoreButton.hidden = true;
    elements.seeMoreButton.setAttribute("aria-hidden", "true");
    return;
  }

  visibleCount = Math.min(visibleCount + PAGE_SIZE, currentFilteredInventory.length);
  savePageConfig();
  renderInventory(false);
});

elements.overlayCoin.addEventListener("click", () => {
  if (!overlayItem) return;

  if (overlayItem.type !== "banknote") {
    if (elements.overlayCoin.classList.contains("is-twisting-out") || elements.overlayCoin.classList.contains("is-twisting-in")) return;

    const nextSide = overlaySide === "front" ? "back" : "front";

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      overlaySide = nextSide;
      renderOverlayCoinFace(overlayItem, overlaySide);
      return;
    }

    window.clearTimeout(overlayTurnTimer);
    elements.overlayCoin.classList.add("is-twisting-out");

    elements.overlayCoin.addEventListener("animationend", function handleCoinTwistOut(event) {
      if (event.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains("is-twisting-out")) return;

      elements.overlayCoin.removeEventListener("animationend", handleCoinTwistOut);
      overlaySide = nextSide;
      renderOverlayCoinFace(overlayItem, overlaySide);
      elements.overlayCoin.classList.remove("is-twisting-out");

      requestAnimationFrame(() => {
        elements.overlayCoin.classList.add("is-twisting-in");
        elements.overlayCoin.addEventListener("animationend", function handleCoinTwistIn(innerEvent) {
          if (innerEvent.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains("is-twisting-in")) return;

          elements.overlayCoin.removeEventListener("animationend", handleCoinTwistIn);
          elements.overlayCoin.classList.remove("is-twisting-in");
        });
      });
    });
    return;
  }

  if (elements.overlayCoin.classList.contains("is-twisting-out") || elements.overlayCoin.classList.contains("is-twisting-in")) return;

  const nextSide = overlaySide === "front" ? "back" : "front";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    overlaySide = nextSide;
    renderOverlayBanknoteFace(overlayItem, overlaySide);
    return;
  }

  window.clearTimeout(overlayTurnTimer);
  elements.overlayCoin.classList.add("is-twisting-out");

  elements.overlayCoin.addEventListener("animationend", function handleTwistOut(event) {
    if (event.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains("is-twisting-out")) return;

    elements.overlayCoin.removeEventListener("animationend", handleTwistOut);
    overlaySide = nextSide;
    renderOverlayBanknoteFace(overlayItem, overlaySide);
    elements.overlayCoin.classList.remove("is-twisting-out");

    requestAnimationFrame(() => {
      elements.overlayCoin.classList.add("is-twisting-in");
      elements.overlayCoin.addEventListener("animationend", function handleTwistIn(innerEvent) {
        if (innerEvent.target !== elements.overlayCoinInner || !elements.overlayCoin.classList.contains("is-twisting-in")) return;

        elements.overlayCoin.removeEventListener("animationend", handleTwistIn);
        elements.overlayCoin.classList.remove("is-twisting-in");
      });
    });
  });
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

  const yearButton = event.target.closest(".year-list-item");
  if (yearButton) {
    const item = getItemById(yearButton.dataset.coinId);
    if (canOpenOverlay(item)) openCoinOverlay(item);
    return;
  }

  const flipButton = event.target.closest(".coin-flip");
  if (flipButton) {
    const card = flipButton.closest(".inventory-card");
    if (card) {
      const item = getItemById(card.dataset.coinId);
      if (canOpenOverlay(item)) openCoinOverlay(item);
    }
    return;
  }

  const watchButton = event.target.closest(".watch-coin-button");
  if (watchButton) {
    const item = getItemById(watchButton.dataset.coinId);
    if (canOpenOverlay(item)) openCoinOverlay(item);
    return;
  }


});

setupFilters();
restorePageConfig();
refreshCountryOptions(elements.countryFilter.value);
refreshYearOptions(elements.yearFilter.value);
refreshValueOptions();
refreshSetOptions();
updateSummary();
updateSortButtons();
updateCardView();
renderInventory(false);


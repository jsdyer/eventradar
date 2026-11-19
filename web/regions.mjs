// City slugs and time zones come from the featured Canadian Has Things feeds.
// The fourth field marks entries with venue calendars only.
export const provinces = {
  "Alberta": [
    ["calgary", "Calgary", "America/Edmonton"],
    ["edmonton", "Edmonton", "America/Edmonton"],
    ["lethbridge", "Lethbridge", "America/Edmonton"],
    ["medicine-hat", "Medicine Hat", "America/Edmonton"],
    ["red-deer", "Red Deer", "America/Edmonton"],
  ],
  "British Columbia": [
    ["kamloops", "Kamloops", "America/Vancouver"],
    ["kelowna", "Kelowna", "America/Vancouver"],
    ["langley", "Langley", "America/Vancouver", false],
    ["vancouver", "Metro Vancouver", "America/Vancouver"],
    ["nanaimo", "Nanaimo", "America/Vancouver"],
    ["victoria", "Victoria", "America/Vancouver"],
  ],
  "Manitoba": [
    ["winnipeg", "Winnipeg", "America/Winnipeg"],
  ],
  "New Brunswick": [
    ["fredericton", "Fredericton", "America/Halifax"],
    ["moncton", "Moncton", "America/Halifax"],
  ],
  "Newfoundland and Labrador": [
    ["st-johns", "St. John's", "America/St_Johns"],
  ],
  "Northwest Territories": [
    ["yellowknife", "Yellowknife", "America/Yellowknife"],
  ],
  "Nova Scotia": [
    ["halifax", "Halifax", "America/Halifax"],
  ],
  "Nunavut": [
    ["iqaluit", "Iqaluit", "America/Iqaluit"],
  ],
  "Ontario": [
    ["barrie", "Barrie", "America/Toronto"],
    ["guelph", "Guelph", "America/Toronto"],
    ["hamilton", "Hamilton", "America/Toronto"],
    ["kingston", "Kingston", "America/Toronto"],
    ["kitchener-waterloo", "Kitchener-Waterloo", "America/Toronto"],
    ["london", "London", "America/Toronto"],
    ["niagara", "Niagara", "America/Toronto"],
    ["ottawa", "Ottawa", "America/Toronto"],
    ["peterborough", "Peterborough", "America/Toronto"],
    ["sudbury", "Sudbury", "America/Toronto"],
    ["thunder-bay", "Thunder Bay", "America/Toronto"],
    ["toronto", "Toronto", "America/Toronto"],
    ["windsor", "Windsor", "America/Toronto"],
  ],
  "Prince Edward Island": [
    ["charlottetown", "Charlottetown", "America/Halifax"],
  ],
  "Quebec": [
    ["montreal", "Montréal", "America/Toronto"],
    ["quebec", "Québec", "America/Toronto"],
    ["sherbrooke", "Sherbrooke", "America/Toronto"],
  ],
  "Saskatchewan": [
    ["regina", "Regina", "America/Regina"],
    ["saskatoon", "Saskatoon", "America/Regina"],
  ],
  "Yukon": [
    ["whitehorse", "Whitehorse", "America/Whitehorse"],
  ],
};

export const regions = Object.fromEntries(Object.values(provinces).flat().map(([key, name, zone, live = true]) => [
  key, { name, zone, url: live ? `https://${key}.hasthings.com/feeds/events.json` : null },
]));

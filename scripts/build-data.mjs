// Builds web/data/leonida.json, the one data file every app reads (web, iPhone, iPad, Mac).
// Run: node scripts/build-data.mjs
// Sources: Rockstar's official GTA VI site and trailers, cross-checked against gtamapped.com, timesaver.gg and
// gtaside.com (Nov 2026). Geography and many pin positions: GTA VI Map Tiles and Landmarks Data (CC BY 4.0),
// https://map.gtadb.org, traced into our own shapes by scripts/trace-coast.py (scripts/geo/leonida-geo.json). `tag` says how sure we are: confirmed (named by Rockstar), spotted (seen in official
// footage, named by signage), speculation (fan read).
import { readFileSync, writeFileSync } from "node:fs"

const W = 1000, H = 1200

// Map geometry in a 1000 x 1200 plane, traced from the GTADB tiles. Every renderer smooths shapes the same way (Catmull-Rom)
// and clips the region tints to the land.
const geo = JSON.parse(readFileSync(new URL("geo/leonida-geo.json", import.meta.url)))
const map = {
  land: geo.land,
  islands: geo.islands.map((pts, i) => ({ id: `island-${i + 1}`, pts })),
  lakes: geo.lakes.map((pts, i) => ({ id: i === 0 ? "lake-leonida" : `lake-${i + 1}`, pts })),
  towns: geo.towns, streets: geo.streets, keys: [], roads: [],
}

const regions = [
  { id: "mount-kalaga", name: "Mount Kalaga National Park", short: "Mount Kalaga", color: "#34c759", label: geo.labels["mount-kalaga"],
    blurb: "Forest, canyon and wilderness across the north of the state. Hunting grounds and off-road trails.",
    inspiration: "The forests and red-clay canyons of north Florida and Georgia" },
  { id: "port-gellhorn", name: "Port Gellhorn", short: "Port Gellhorn", color: "#5ac8fa", label: geo.labels["port-gellhorn"],
    blurb: "A run-down Gulf Coast port town in the north-west: motels, strip malls and the docks.",
    inspiration: "Panama City and the Florida Panhandle" },
  { id: "ambrosia", name: "Ambrosia", short: "Ambrosia", color: "#ffcc00", label: geo.labels["ambrosia"],
    blurb: "Inland farm county built around the Allied Crystal sugar refinery, on the south shore of Lake Leonida.",
    inspiration: "Lake Okeechobee and Clewiston" },
  { id: "grassrivers", name: "Grassrivers", short: "Grassrivers", color: "#00c7be", label: geo.labels["grassrivers"],
    blurb: "Sawgrass, mangroves and gator country in the south-west. Airboats, mud bogs and small Gulf towns.",
    inspiration: "The Everglades" },
  { id: "vice-city", name: "Vice City", short: "Vice City", color: "#ff3d8b", label: geo.labels["vice-city"],
    blurb: "Leonida's big city on the east coast: downtown towers, the port, and the beaches across the bay.",
    inspiration: "Miami and Miami Beach" },
  { id: "leonida-keys", name: "Leonida Keys", short: "The Keys", color: "#32ade6", label: geo.labels["leonida-keys"],
    blurb: "An island chain off the southern tip, tied together by one long causeway. Jason's home turf.",
    inspiration: "The Florida Keys" },
]
for (const r of regions) r.poly = geo.regions[r.id]

const categories = [
  { id: "district", name: "Neighbourhoods & towns", one: "Neighbourhood", color: "#8e8e93", symbol: "building.2.fill" },
  { id: "landmark", name: "Landmarks", one: "Landmark", color: "#ff9500", symbol: "star.fill" },
  { id: "safehouse", name: "Safehouses & garages", one: "Safehouse", color: "#34c759", symbol: "house.fill" },
  { id: "store", name: "Shops", one: "Shop", color: "#007aff", symbol: "bag.fill" },
  { id: "business", name: "Clubs & businesses", one: "Business", color: "#ff3d8b", symbol: "music.note" },
  { id: "activity", name: "Activities", one: "Activity", color: "#30b0c7", symbol: "figure.run" },
  { id: "race", name: "Race tracks", one: "Race track", color: "#ff3b30", symbol: "flag.checkered" },
  { id: "weapons", name: "Ammu-Nation & ranges", one: "Weapons", color: "#636366", symbol: "scope" },
  { id: "nature", name: "Nature", one: "Nature", color: "#28a745", symbol: "leaf.fill" },
  { id: "transport", name: "Ports, roads & airports", one: "Transport", color: "#32ade6", symbol: "airplane" },
  { id: "vehicle", name: "Vehicles", one: "Vehicle", color: "#e0a800", symbol: "car.fill" },
  { id: "waink", name: "WAiNK scans", one: "WAiNK scan", color: "#a2845e", symbol: "camera.viewfinder" },
  { id: "meditation", name: "Meditation spots", one: "Meditation spot", color: "#00c7be", symbol: "figure.mind.and.body" },
  { id: "people", name: "Characters", one: "Character", color: "#0a84ff", symbol: "person.fill" },
  { id: "mission", name: "Story missions", one: "Mission", color: "#ff3d8b", symbol: "flag.fill" },
  { id: "collectible", name: "Collectibles", one: "Collectible", color: "#ff9500", symbol: "sparkles" },
]

// [id, name, category, region, x, y, tag, note, at?]   at = the place it belongs to (vehicles, people)
const P = [
  // Vice City
  ["downtown-vice-city","Downtown Vice City","district","vice-city",704,675,"spotted","The skyscraper core on the bay, across the causeway from Vice Beach."],
  ["crosstown","Crosstown","district","vice-city",712,601,"spotted","North of downtown, where the two interstates meet. Named on official road signs."],
  ["little-cuba","Little Cuba","district","vice-city",670,670,"confirmed","Bakeries, cafes and the city's Cuban community."],
  ["stockyard","Stockyard","district","vice-city",726,545,"confirmed","Streetwear shops and tattoo parlours."],
  ["southside","Southside","district","vice-city",628,808,"confirmed","Gang-run blocks on the south side of the city. One crew's compound can be raided."],
  ["vice-beach","Vice Beach","district","vice-city",860,593,"spotted","The barrier island across the bay from downtown. Ocean Beach is its southern end."],
  ["ocean-beach","Ocean Beach","district","vice-city",868,620,"confirmed","White sand, palms and art deco hotels along Shore Drive. Chapter 4 opens here."],
  ["washington-beach","Washington Beach","nature","vice-city",865,519,"confirmed","The beach north of Ocean Beach, where the Shitzu Squalo is moored."],
  ["shore-drive","Shore Drive","landmark","vice-city",881,631,"confirmed","The beachfront strip of hotels, bars and supercars through Ocean Beach."],
  ["ocean-view-hotel","Ocean View Hotel","landmark","vice-city",882,624,"confirmed","Beachfront hotel shown with Jason and Lucia, a nod to the original Vice City."],
  ["hotel-dixon","Hotel Dixon","landmark","vice-city",883,618,"spotted","Ocean Beach hotel from the first trailer's opening shots."],
  ["the-boardwalk","The Boardwalk","landmark","vice-city",881,629,"spotted","Hotel with a neon tower on Shore Drive."],
  ["dominion-hotel","Dominion Hotel","landmark","vice-city",886,606,"spotted","Ocean Beach hotel seen in the second trailer."],
  ["shore-court-garage","Shore Court Garage","safehouse","vice-city",870,627,"confirmed","Garage off Shore Drive with a weapon locker. Fence stolen goods here."],
  ["venetian-islands","Venetian Islands","district","vice-city",797,630,"speculation","Small residential islands strung along the causeway. Fan name."],
  ["sahara-arena","Sahara Arena","landmark","vice-city",728,637,"spotted","The arena on the downtown waterfront, beside the causeway."],
  ["nine-1-nine","NINE 1 NINE","business","vice-city",704,636,"spotted","Downtown megaclub."],
  ["vc-port","Port of Vice City","transport","vice-city",798,703,"confirmed","The cruise ship capital of the world, says Rockstar."],
  ["vci-airport","Vice City International","transport","vice-city",593,716,"spotted","VCI airport, signposted from the freeway in the first trailer."],
  ["tisha-wocka","Tisha-Wocka Flea Market","business","vice-city",560,619,"confirmed","Bootleg brands by the stall."],
  ["jack-of-hearts","Jack of Hearts","business","vice-city",703,586,"confirmed","Boobie Ike's strip club."],
  ["only-raw-records","Only Raw Records","business","vice-city",645,723,"confirmed","Boobie Ike's label and studio, run day to day by Dre'Quan Priest."],
  ["rideout-customs","Rideout Customs","store","vice-city",690,601,"confirmed","Classic cars, big rims and donk builds."],
  ["saras-salon","Sara's Unisex Salon","store","grassrivers",576,900,"confirmed","Hair and beauty, with signature looks for Jason and Lucia."],
  ["electric-fang","Electric Fang Tattoo","store","vice-city",724,543,"confirmed","Tattoo parlour in Stockyard, with designs by the artist duo FAILE."],
  ["stock-305","Stock 305","store","vice-city",727,548,"confirmed","Streetwear store in Stockyard."],
  ["ptt-hideout","PTT Youngin$ Hideout","activity","vice-city",633,792,"confirmed","A loud crew's base in Southside. Raid it for contraband."],
  ["vercetti-estate","Vercetti Estate","landmark","vice-city",811,623,"confirmed","Tommy Vercetti's old mansion on Starfish Island."],
  ["shitzu-squalo","Shitzu Squalo","vehicle","vice-city",867,544,"confirmed","Speedboat built for fishing trips out to Gambit Bay.","washington-beach"],
  ["vapid-stanier-55","'55 Vapid Stanier","vehicle","vice-city",857,632,"confirmed","1950s car kept at Shore Court Garage.","shore-court-garage"],
  // Leonida Keys
  ["jasons-house","Jason's House, Key Lento","safehouse","leonida-keys",589,1044,"confirmed","Jason's place in the Keys, rent-free from Brian Heder in exchange for work."],
  ["brians-boat-yard","Brian's Boat Yard","business","leonida-keys",577,1066,"confirmed","Brian Heder's boat yard, a front for running drugs by water."],
  ["keys-causeway","Keys Causeway","transport","leonida-keys",624,1033,"spotted","The island-hopping road, named on a sign in the second trailer."],
  ["keys-billboard","Welcome to the Keys billboard","landmark","leonida-keys",605,1020,"confirmed","The roadside billboard that opens the launch trailer."],
  ["corsair-key-dolphin","Triangular Sculpture","waink","leonida-keys",448,1130,"confirmed","A dolphin sculpture on Corsair Key."],
  ["dinka-enduro","Dinka Enduro","vehicle","leonida-keys",578,1056,"confirmed","Dual-sport motorcycle parked at Jason's.","jasons-house"],
  ["crest-kayak","Crest Kayak","vehicle","leonida-keys",568,1069,"confirmed","For the shallows around the Keys.","jasons-house"],
  ["key-lento","Key Lento","district","leonida-keys",578,1070,"confirmed","The Keys' main island, home to Jason's house and Brian's boat yard."],
  ["rusty-anchor","The Rusty Anchor","business","leonida-keys",595,1025,"confirmed","Beachfront bar on Key Lento, seen in Rockstar's screenshots with Jason and Cal."],
  ["wonder-whale","Wonder Whale","landmark","leonida-keys",550,1104,"spotted","A Key Lento spot named in a Rockstar street screenshot."],
  ["key-lento-pd","Key Lento Police Department","landmark","leonida-keys",582,1065,"spotted","Key Lento's police station, named in a Rockstar screenshot."],
  // Grassrivers
  ["watson-bay","Watson Bay","district","grassrivers",412,888,"confirmed","A small Gulf town on stilts and docks, home of Paradise Garage."],
  ["paradise-garage","Paradise Garage","safehouse","grassrivers",471,832,"confirmed","Garage in Watson Bay with a weapon locker."],
  ["the-bite-house","The Bite House","business","grassrivers",414,866,"spotted","Waterfront restaurant in Watson Bay."],
  ["dominator-buggy","'67 Vapid Dominator Buggy","vehicle","grassrivers",470,853,"confirmed","Off-road buggy made for the Mount Kalaga trails.","paradise-garage"],
  ["gambit-bay","Gambit Bay","nature","leonida-keys",560,1024,"confirmed","The first named fishing spot, a boat ride from Washington Beach."],
  ["hamlet","Hamlet","district","grassrivers",566,885,"confirmed","Small town named in the first trailer."],
  ["boone-speedway","Boone Speedway","race","grassrivers",539,897,"confirmed","Oval track in Hamlet."],
  ["airboat-trails","Grassrivers airboat trails","activity","grassrivers",664,976,"confirmed","Airboat runs through sawgrass and mangroves, gators in the water."],
  ["mud-bog","Grassrivers mud bog","activity","grassrivers",493,841,"spotted","The muddy off-road party from the first trailer."],
  ["airgator-airboats","Airgator Airboats","store","grassrivers",549,977,"spotted","Airboat outfitter for getting across the wetlands."],
  ["hamlet-water-tower","Hamlet Water Tower","landmark","grassrivers",547,877,"spotted","Water tower over the Hamlet area."],
  // Port Gellhorn
  ["port-gellhorn","Port Gellhorn","district","port-gellhorn",302,410,"confirmed","Working port town on the Gulf. Chapter 2 starts here."],
  ["gellhorn-docks","Port Gellhorn Docks","transport","port-gellhorn",293,409,"spotted","The working seaport on the town's bay."],
  ["starlet-motel","Starlet Motel","safehouse","port-gellhorn",385,431,"spotted","Roadside motel from both trailers. A safehouse."],
  ["gellhorn-station","Port Gellhorn Station","transport","port-gellhorn",300,423,"confirmed","Named in the Port Gellhorn section of Rockstar's site."],
  ["hanks-waffles","Hank's Waffles","business","port-gellhorn",329,360,"spotted","Diner sign from the trailers."],
  ["gellhorn-roadhouse","Gellhorn Roadhouse","business","port-gellhorn",324,403,"spotted","Roadhouse sign from the trailers."],
  ["schlott-construction","Schlott Construction","business","port-gellhorn",328,365,"spotted","Construction firm sign from the trailers."],
  ["burnout-scooters","Burnout Scooters","store","port-gellhorn",311,442,"spotted","Scooter shop sign from the trailers."],
  ["happy-nails","Happy Nails","store","port-gellhorn",317,405,"spotted","Nail salon sign from the trailers."],
  ["watkins-auto-parts","Watkins Auto Parts","store","port-gellhorn",311,445,"spotted","Auto parts store sign from the trailers."],
  ["we-have-shoes","We Have Shoes","store","port-gellhorn",317,403,"spotted","Shoe store sign from the trailers."],
  ["uncle-jacks","Uncle Jack's Liquor","store","port-gellhorn",317,405,"spotted","Liquor store on the motel strip."],
  ["pawn-gun","Port Gellhorn Pawn & Gun","store","port-gellhorn",318,439,"spotted","Pawn and gun shop where the first trailer's robbery ends."],
  ["delights-cabaret","Delights Cabaret","business","port-gellhorn",316,425,"spotted","Strip club."],
  ["crossroad-minimall","Crossroad Park Minimall","store","port-gellhorn",319,401,"spotted","Strip mall on Interstate 404."],
  ["interstate-404","Interstate 404","transport","port-gellhorn",417,364,"spotted","The interstate east out of town, signposted in the second trailer."],
  ["bocamar-bridge","Bocamar Bridge","transport","port-gellhorn",292,358,"speculation","Tall suspension bridge in the trailer backgrounds."],
  ["abandoned-motel","Abandoned beach motel","landmark","port-gellhorn",239,353,"spotted","A storm-wrecked motel on the beach."],
  ["gellhorn-raceway","Gellhorn International Raceway","race","port-gellhorn",292,510,"confirmed","Race track outside town."],
  ["gellhorn-outfitters","Gellhorn Outfitters","weapons","port-gellhorn",291,394,"confirmed","Ammu-Nation in Port Gellhorn."],
  ["gellhorn-fun-fair","Gellhorn Fun Fair","waink","port-gellhorn",304,389,"confirmed","A WAiNK scan at the fairground."],
  ["rodgers-ranch","Rodgers Ranch & Shooting Range","weapons","port-gellhorn",421,320,"confirmed","North-east of Port Gellhorn, in Kelly County."],
  ["thrillbilly-mud-club","Thrillbilly Mud Club","race","port-gellhorn",477,344,"confirmed","Mud racing off Route 32, Kelly County."],
  // Ambrosia
  ["ambrosia-town","Ambrosia","district","ambrosia",551,394,"confirmed","Company town under the refinery's smoke."],
  ["allied-crystal","Allied Crystal Sugar Refinery","landmark","ambrosia",553,421,"confirmed","The giant refinery that employs most of Ambrosia."],
  ["lake-leonida","Lake Leonida","nature","ambrosia",615,346,"confirmed","The biggest lake in the state, between Ambrosia and Mount Kalaga."],
  ["one-eyed-willies","One-Eyed Willie's","store","ambrosia",624,284,"confirmed","Off-road mod shop on the lake."],
  ["leonida-penitentiary","Leonida Penitentiary","landmark","port-gellhorn",406,543,"confirmed","The state prison where Lucia served time."],
  ["final-chapter-mc","Final Chapter MC clubhouse","landmark","ambrosia",620,458,"speculation","Expected home of the Final Chapter biker club."],
  ["ambrosia-water-tower","Ambrosia water tower","landmark","ambrosia",549,379,"spotted","Stands over the town in a night aerial shot."],
  ["cane-fields","Sugar cane fields","nature","ambrosia",614,434,"spotted","Cane fields that feed the refinery, shown burning."],
  // Mount Kalaga
  ["kalaga-trails","Mount Kalaga off-road trails","activity","mount-kalaga",501,242,"confirmed","Hill trails for trucks and buggies."],
  ["kalaga-hunting","Hunting in Mount Kalaga","activity","mount-kalaga",697,194,"confirmed","Hunting grounds in the state's wildest corner."],
  ["kalaga-canyon","Mount Kalaga canyon","nature","mount-kalaga",418,213,"spotted","A red-clay canyon."],
  ["kalaga-rail-bridge","Mount Kalaga rail bridge","transport","mount-kalaga",594,243,"spotted","Rail bridge over the river through the park."],
  ["old-mining-depot","Old mining depot","landmark","mount-kalaga",697,194,"spotted","Abandoned mine buildings deep in the park."],
  ["kalaga-lookout","Kalaga Lookout","waink","mount-kalaga",656,156,"confirmed","A WAiNK scan on a peak."],
  ["spanish-ruins","Imperial Spanish Ruins","waink","mount-kalaga",427,262,"confirmed","A WAiNK scan on the south-west peak."],
  ["kalaga-reservoir","Kalaga Reservoir","nature","mount-kalaga",552,211,"confirmed","Reservoir in the park."],
  ["jutting-cliff","Jutting Cliff","meditation","mount-kalaga",550,175,"confirmed","Meditation spot just north of Kalaga Reservoir."],
  ["lawton-paper-mill","Lawton Co. Paper Mill","waink","mount-kalaga",350,244,"confirmed","A WAiNK scan in Moreau."],
  ["gas-west-kalaga","247 Gas, West Kalaga","store","mount-kalaga",362,260,"confirmed","Gas station near the paper mill."],
  // named, but where they sit is not known yet
  ["vinewood-beach","Vinewood Beach","meditation",null,null,null,"confirmed","Seaside meditation spot in Waning Sands."],
  ["leaf-links","Leaf Links Golf Club","activity",null,null,null,"confirmed","Mini golf here counts toward 100%. Full courses don't."],
]

// characters, pinned where the story ties them
const people = [
  ["lucia-caminos","Lucia Caminos","Lead. Fresh out of Leonida Penitentiary.","leonida-penitentiary"],
  ["jason-duval","Jason Duval","Lead. Works for Brian Heder in the Keys.","jasons-house"],
  ["cal-hampton","Cal Hampton","Jason's friend. Listens in on the coast guard.","jasons-house"],
  ["boobie-ike","Boobie Ike","Vice City businessman: strip club, studio, real estate.","jack-of-hearts"],
  ["drequan-priest","Dre'Quan Priest","Runs Only Raw Records.","only-raw-records"],
  ["real-dimez","Real Dimez","Rap duo Bae-Luxe and Roxy, signed to Only Raw.","only-raw-records"],
  ["raul-bautista","Raul Bautista","Veteran bank robber.",null],
  ["brian-heder","Brian Heder","Runs drugs through the Keys from his boat yard.","brians-boat-yard"],
]

// story missions, in order. `at` only where a source places the start.
const chapters = [
  ["Just Like Paradise", ["Prologue|L","Gone Fishing|J","Gear Up|J","Just a Scratch|J","Lab Fees|J","Unwanted Attention|J","Pipework|J","Hey Arnold!|J","Island Dreams|J","Feng Shui|J","Coming Home|JL","Buck Me|JL","Clean Up After Donnie|J","Down to Earth|JL","Clear Skies|J","Day Release|","Swamped|J","|","Recalibration|JL","Tourist Trap|JL","Home Sweet Home|L","Discharge Time|JL"]],
  ["Paradise Lost", ["What's in the Bag?||port-gellhorn","Ambulance Chaser|L","Just Moved In|L","Girls' Trip|L","Moses|L","Daily Driver|L","Slam Dunk|L","Breakfast Run|JL","Coffee Break|JL","Afternoon Delight|JL","Checking Out|JL"]],
  ["Tits Ass Drug Money", ["Welcome to Vice City|JL","Dealer's Choice|J","Meet the Heders|","Dubious Provenance|JL","Mami Knows Best|L","South Leonida Real Estate|L","Tyrone|J","Here, Kitty Kitty|J","Car Service|L","Top Billing|","Boobie Time|J","First Impressions|JL","Caught Slipping|JL","Crosstown Traffic|L","Credit Check|","Steal the Zorrusso for Randy|","Sinfrontera National Bank|JL|heist","Security Expert|JL","Ride or Die|J","Company Property|JL","The Missing Link|L","Safe Word|L","Cooties|L","Bricked Up|JL","Hidden Charges|","The Cartel Heist|JL|heist"]],
  ["Vice City, Baby", ["Ocean Beach|JL|ocean-beach","Another Life|L","Company Cars|","Lawyer Up|JL","Party Hard|","Heavy Lifting|JL","Photo/Shoot|","Making Gainz|L","Watch It|J","Cash Injections|L","Amateur Hour|L","Dirty Work|JL","Too Much Baggage|J","Adventures in Babysitting|J","Fresh Evidence|J","Power Play|J","Child's Play|JL","Headliners|","Close Surveillance|J","Delivery Method|J","Team Building|L","Fully Catered|JL","VCIA Takedown||heist","Sunset|JL","|"]],
  ["Top of the World, Ma", ["Bird in the Hand|JL","Taking Liberties|","VC Baby|","Doggie Bag|","Operation Savage Glory||heist","Protective Custody|JL","|"]],
]

const collectibles = [
  ["cocaine-flamingos","Cocaine flamingos",125,"Pink lawn flamingos stashed across the state."],
  ["stunt-jumps","Stunt jumps",397,"Ramps, rooftops and broken bridges."],
  ["basketball-hoops","Basketball hoops",100,"Driveway and court hoops. Sink a shot at each."],
  ["luxury-watches","Luxury watches",34,"Watches to find and wear."],
  ["shipwrecks","Shipwrecks",33,"Wrecks on the sea floor around the coast."],
  ["collectible-cards","Collectible cards",18,"A card set hidden around Leonida."],
  ["waink-scans","WAiNK scans",5,"Photo scans of named sights."],
  ["meditation-spots","Meditation spots",2,"Quiet places to sit."],
]

const places = P.map(([id, name, cat, region, x, y, tag, note, at]) => ({ id, name, cat, region, x, y, tag, note, ...(at ? { at } : {}) }))
const byId = Object.fromEntries(places.map(p => [p.id, p]))
for (const [id, name, note, at] of people) {
  const home = at && byId[at]
  places.push({ id, name, cat: "people", region: home?.region ?? null, x: home ? home.x - 8 : null, y: home ? home.y - 10 : null, tag: "confirmed", note, ...(at ? { at } : {}) })
}
const missions = []
chapters.forEach(([title, list], ci) => list.forEach((s, mi) => {
  const [name, who, extra] = s.split("|")
  const heist = extra === "heist", at = extra && !heist ? extra : null
  missions.push({ id: `m${ci + 1}-${String(mi + 1).padStart(2, "0")}`, chapter: ci + 1, chapterTitle: title, n: mi + 1,
    name: name || null, who: who ? [...who].map(c => c === "J" ? "Jason" : "Lucia") : [], heist, ...(at ? { at } : {}) })
}))

const data = {
  version: 2, updated: "2026-11-27", size: [W, H],
  disclaimer: "Unofficial fan map. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Pins are approximate.",
  metresPerUnit: +(1 / geo.transform.ax).toFixed(2),   // game metres per map unit, for route lengths
  credits: "Map and landmark positions: GTA VI Map Tiles and Landmarks Data (CC BY 4.0), map.gtadb.org. Traced and simplified.",
  map,
  regions, categories, places, missions,
  collectibles: collectibles.map(([id, name, total, note]) => ({ id, name, total, note })),
}
writeFileSync(new URL("../web/data/leonida.json", import.meta.url), JSON.stringify(data))
console.log(`places ${places.length} (${places.filter(p => p.x != null).length} pinned), missions ${missions.length}, collectibles ${collectibles.length}`)

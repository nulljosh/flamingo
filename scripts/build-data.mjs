// Builds web/data/leonida.json, the one data file every app reads (web, iPhone, iPad, Mac).
// Run: node scripts/build-data.mjs
// Sources: Rockstar's official GTA VI site and trailers, cross-checked against gtamapped.com, timesaver.gg and
// gtaside.com (Nov 2026). Pins are approximate: Rockstar has not published a map, so the
// geography here is drawn by hand. `tag` says how sure we are: confirmed (named by Rockstar), spotted (seen in official
// footage, named by signage), speculation (fan read).
import { writeFileSync } from "node:fs"

const W = 1000, H = 1200

// Map geometry, in a 1000 x 1200 plane. Shapes are polygons; every renderer smooths them the same way (Catmull-Rom).
const land = [[150,110],[230,96],[300,90],[390,104],[480,100],[565,88],[650,85],[740,98],[820,110],[870,124],[905,150],[912,196],[900,240],[888,290],[885,340],[893,392],[890,440],[880,492],[872,540],[868,590],[860,640],[852,682],[845,720],[842,760],[835,800],[826,842],[815,880],[800,918],[785,950],[760,978],[730,1000],[700,1012],[670,1015],[640,1006],[610,990],[575,975],[540,960],[505,948],[470,930],[435,906],[400,880],[362,852],[330,820],[306,782],[290,740],[272,696],[260,650],[254,604],[250,560],[238,522],[220,490],[196,462],[170,440],[140,420],[110,400],[86,376],[70,350],[60,316],[60,280],[72,240],[90,200],[104,166],[120,140]]
const islands = [
  { id: "vice-beach", pts: [[896,690],[908,716],[917,760],[916,808],[908,858],[894,906],[878,936],[868,930],[880,890],[892,844],[898,800],[899,756],[892,716]] },
  { id: "starfish", pts: [[866,872],[880,866],[888,878],[878,890],[864,886]] },
  { id: "venetian", pts: [[858,808],[876,804],[880,814],[862,818]] },
]
// the Keys: ellipses [cx, cy, rx, ry, rotation degrees]
const keys = [[702,1046,22,8,-28],[662,1070,24,8,-22],[612,1090,28,9,-16],[556,1105,26,9,-10],[498,1116,28,8,-6],[440,1122,24,8,-2],[384,1122,22,7,4],[330,1114,20,7,10],[284,1102,14,6,16]]
const lakes = [{ id: "lake-leonida", cx: 560, cy: 432, rx: 72, ry: 50 }]
const roads = [
  { id: "i-404", name: "Interstate 404", pts: [[160,380],[260,340],[380,330],[470,360],[560,386],[640,400],[740,420],[860,430]] },
  { id: "i-95", name: "Interstate (east coast)", pts: [[880,170],[860,300],[858,440],[840,600],[812,720],[800,820],[790,920]] },
  { id: "tamiami", name: "Grassrivers crossing", pts: [[310,760],[420,770],[540,780],[660,780],[760,790],[830,800]] },
  { id: "causeway", name: "Vice Beach causeway", pts: [[835,812],[858,812],[880,810],[904,808]] },
  { id: "keys-causeway", name: "Keys Causeway", pts: [[730,1000],[702,1046],[662,1070],[612,1090],[556,1105],[498,1116],[440,1122],[384,1122],[330,1114],[284,1102]] },
  { id: "kalaga-road", name: "Kalaga parkway", pts: [[640,400],[620,320],[560,240],[470,190],[340,170]] },
]

const regions = [
  { id: "mount-kalaga", name: "Mount Kalaga National Park", short: "Mount Kalaga", color: "#34c759", label: [520, 236],
    blurb: "Forest, canyon and wilderness across the north of the state. Hunting grounds and off-road trails.",
    inspiration: "The forests and red-clay canyons of north Florida and Georgia",
    poly: [[0,0],[1000,0],[1000,330],[700,360],[560,384],[420,360],[300,300],[0,280]] },
  { id: "port-gellhorn", name: "Port Gellhorn", short: "Port Gellhorn", color: "#5ac8fa", label: [200, 470],
    blurb: "A run-down Gulf Coast port town in the north-west: motels, strip malls and the docks.",
    inspiration: "Panama City and the Florida Panhandle",
    poly: [[0,280],[300,300],[380,420],[360,620],[0,620]] },
  { id: "ambrosia", name: "Ambrosia", short: "Ambrosia", color: "#ffcc00", label: [660, 520],
    blurb: "Inland farm county built around the Allied Crystal sugar refinery, on the south shore of Lake Leonida.",
    inspiration: "Lake Okeechobee and Clewiston",
    poly: [[300,300],[420,360],[560,384],[700,360],[1000,330],[1000,680],[780,700],[620,660],[360,620],[380,420]] },
  { id: "grassrivers", name: "Grassrivers", short: "Grassrivers", color: "#00c7be", label: [450, 850],
    blurb: "Sawgrass, mangroves and gator country in the south-west. Airboats, mud bogs and small Gulf towns.",
    inspiration: "The Everglades",
    poly: [[0,620],[360,620],[620,660],[700,760],[690,1000],[0,1000]] },
  { id: "vice-city", name: "Vice City", short: "Vice City", color: "#ff2d55", label: [770, 740],
    blurb: "Leonida's big city on the east coast: downtown towers, the port, and the beaches across the bay.",
    inspiration: "Miami and Miami Beach",
    poly: [[620,660],[780,700],[1000,680],[1000,1000],[690,1000],[700,760]] },
  { id: "leonida-keys", name: "Leonida Keys", short: "The Keys", color: "#32ade6", label: [470, 1160],
    blurb: "An island chain off the southern tip, tied together by one long causeway. Jason's home turf.",
    inspiration: "The Florida Keys",
    poly: [[0,1000],[1000,1000],[1000,1200],[0,1200]] },
]

const categories = [
  { id: "district", name: "Neighbourhoods & towns", one: "Neighbourhood", color: "#8e8e93", symbol: "building.2.fill" },
  { id: "landmark", name: "Landmarks", one: "Landmark", color: "#ff9500", symbol: "star.fill" },
  { id: "safehouse", name: "Safehouses & garages", one: "Safehouse", color: "#34c759", symbol: "house.fill" },
  { id: "store", name: "Shops", one: "Shop", color: "#007aff", symbol: "bag.fill" },
  { id: "business", name: "Clubs & businesses", one: "Business", color: "#ff2d55", symbol: "music.note" },
  { id: "activity", name: "Activities", one: "Activity", color: "#30b0c7", symbol: "figure.run" },
  { id: "race", name: "Race tracks", one: "Race track", color: "#ff3b30", symbol: "flag.checkered" },
  { id: "weapons", name: "Ammu-Nation & ranges", one: "Weapons", color: "#636366", symbol: "scope" },
  { id: "nature", name: "Nature", one: "Nature", color: "#28a745", symbol: "leaf.fill" },
  { id: "transport", name: "Ports, roads & airports", one: "Transport", color: "#32ade6", symbol: "airplane" },
  { id: "vehicle", name: "Vehicles", one: "Vehicle", color: "#e0a800", symbol: "car.fill" },
  { id: "waink", name: "WAiNK scans", one: "WAiNK scan", color: "#a2845e", symbol: "camera.viewfinder" },
  { id: "meditation", name: "Meditation spots", one: "Meditation spot", color: "#00c7be", symbol: "figure.mind.and.body" },
  { id: "people", name: "Characters", one: "Character", color: "#0a84ff", symbol: "person.fill" },
  { id: "mission", name: "Story missions", one: "Mission", color: "#ff2d55", symbol: "flag.fill" },
  { id: "collectible", name: "Collectibles", one: "Collectible", color: "#ff9500", symbol: "sparkles" },
]

// [id, name, category, region, x, y, tag, note, at?]   at = the place it belongs to (vehicles, people)
const P = [
  // Vice City
  ["downtown-vice-city","Downtown Vice City","district","vice-city",832,822,"spotted","The skyscraper core on the bay, across the causeway from Vice Beach."],
  ["crosstown","Crosstown","district","vice-city",806,758,"spotted","North of downtown, where the two interstates meet. Named on official road signs."],
  ["little-cuba","Little Cuba","district","vice-city",796,850,"confirmed","Bakeries, cafes and the city's Cuban community."],
  ["stockyard","Stockyard","district","vice-city",770,796,"confirmed","Streetwear shops and tattoo parlours."],
  ["southside","Southside","district","vice-city",776,906,"confirmed","Gang-run blocks on the south side of the city. One crew's compound can be raided."],
  ["vice-beach","Vice Beach","district","vice-city",904,780,"spotted","The barrier island across the bay from downtown. Ocean Beach is its southern end."],
  ["ocean-beach","Ocean Beach","district","vice-city",902,836,"confirmed","White sand, palms and art deco hotels along Shore Drive. Chapter 4 opens here."],
  ["washington-beach","Washington Beach","nature","vice-city",908,744,"confirmed","The beach north of Ocean Beach, where the Shitzu Squalo is moored."],
  ["shore-drive","Shore Drive","landmark","vice-city",907,852,"confirmed","The beachfront strip of hotels, bars and supercars through Ocean Beach."],
  ["ocean-view-hotel","Ocean View Hotel","landmark","vice-city",909,822,"confirmed","Beachfront hotel shown with Jason and Lucia, a nod to the original Vice City."],
  ["hotel-dixon","Hotel Dixon","landmark","vice-city",905,842,"spotted","Ocean Beach hotel from the first trailer's opening shots."],
  ["the-boardwalk","The Boardwalk","landmark","vice-city",910,862,"spotted","Hotel with a neon tower on Shore Drive."],
  ["dominion-hotel","Dominion Hotel","landmark","vice-city",906,806,"spotted","Ocean Beach hotel seen in the second trailer."],
  ["shore-court-garage","Shore Court Garage","safehouse","vice-city",897,848,"confirmed","Garage off Shore Drive with a weapon locker. Fence stolen goods here."],
  ["venetian-islands","Venetian Islands","district","vice-city",868,811,"speculation","Small residential islands strung along the causeway. Fan name."],
  ["sahara-arena","Sahara Arena","landmark","vice-city",848,806,"spotted","The arena on the downtown waterfront, beside the causeway."],
  ["nine-1-nine","NINE 1 NINE","business","vice-city",838,832,"spotted","Downtown megaclub."],
  ["vc-port","Port of Vice City","transport","vice-city",856,862,"confirmed","The cruise ship capital of the world, says Rockstar."],
  ["vci-airport","Vice City International","transport","vice-city",728,770,"spotted","VCI airport, signposted from the freeway in the first trailer."],
  ["tisha-wocka","Tisha-Wocka Flea Market","business","vice-city",752,862,"confirmed","Bootleg brands by the stall."],
  ["jack-of-hearts","Jack of Hearts","business","vice-city",814,842,"confirmed","Boobie Ike's strip club."],
  ["only-raw-records","Only Raw Records","business","vice-city",792,826,"confirmed","Boobie Ike's label and studio, run day to day by Dre'Quan Priest."],
  ["rideout-customs","Rideout Customs","store","vice-city",746,884,"confirmed","Classic cars, big rims and donk builds."],
  ["saras-salon","Sara's Unisex Salon","store","vice-city",780,838,"confirmed","Hair and beauty, with signature looks for Jason and Lucia."],
  ["electric-fang","Electric Fang Tattoo","store","vice-city",764,792,"confirmed","Tattoo parlour in Stockyard, with designs by the artist duo FAILE."],
  ["stock-305","Stock 305","store","vice-city",760,806,"confirmed","Streetwear store in Stockyard."],
  ["ptt-hideout","PTT Youngin$ Hideout","activity","vice-city",784,918,"confirmed","A loud crew's base in Southside. Raid it for contraband."],
  ["vercetti-estate","Vercetti Estate","landmark","vice-city",876,878,"confirmed","Tommy Vercetti's old mansion on Starfish Island."],
  ["shitzu-squalo","Shitzu Squalo","vehicle","vice-city",914,734,"confirmed","Speedboat built for fishing trips out to Gambit Bay.","washington-beach"],
  ["vapid-stanier-55","'55 Vapid Stanier","vehicle","vice-city",892,854,"confirmed","1950s car kept at Shore Court Garage.","shore-court-garage"],
  // Leonida Keys
  ["jasons-house","Jason's House, Key Lento","safehouse","leonida-keys",556,1105,"confirmed","Jason's place in the Keys, rent-free from Brian Heder in exchange for work."],
  ["brians-boat-yard","Brian's Boat Yard","business","leonida-keys",612,1090,"confirmed","Brian Heder's boat yard, a front for running drugs by water."],
  ["keys-causeway","Keys Causeway","transport","leonida-keys",662,1070,"spotted","The island-hopping road, named on a sign in the second trailer."],
  ["keys-billboard","Welcome to the Keys billboard","landmark","leonida-keys",704,1040,"confirmed","The roadside billboard that opens the launch trailer."],
  ["corsair-key-dolphin","Triangular Sculpture","waink","leonida-keys",440,1122,"confirmed","A dolphin sculpture on Corsair Key."],
  ["dinka-enduro","Dinka Enduro","vehicle","leonida-keys",562,1097,"confirmed","Dual-sport motorcycle parked at Jason's.","jasons-house"],
  ["crest-kayak","Crest Kayak","vehicle","leonida-keys",548,1114,"confirmed","For the shallows around the Keys.","jasons-house"],
  // Grassrivers
  ["watson-bay","Watson Bay","district","grassrivers",312,770,"confirmed","A small Gulf town on stilts and docks, home of Paradise Garage."],
  ["paradise-garage","Paradise Garage","safehouse","grassrivers",322,778,"confirmed","Garage in Watson Bay with a weapon locker."],
  ["the-bite-house","The Bite House","business","grassrivers",304,760,"spotted","Waterfront restaurant in Watson Bay."],
  ["dominator-buggy","'67 Vapid Dominator Buggy","vehicle","grassrivers",330,786,"confirmed","Off-road buggy made for the Mount Kalaga trails.","paradise-garage"],
  ["gambit-bay","Gambit Bay","nature","grassrivers",470,952,"confirmed","The first named fishing spot, a boat ride from Washington Beach."],
  ["hamlet","Hamlet","district","grassrivers",478,698,"confirmed","Small town named in the first trailer."],
  ["boone-speedway","Boone Speedway","race","grassrivers",492,712,"confirmed","Oval track in Hamlet."],
  ["airboat-trails","Grassrivers airboat trails","activity","grassrivers",540,830,"confirmed","Airboat runs through sawgrass and mangroves, gators in the water."],
  ["mud-bog","Grassrivers mud bog","activity","grassrivers",410,676,"spotted","The muddy off-road party from the first trailer."],
  // Port Gellhorn
  ["port-gellhorn","Port Gellhorn","district","port-gellhorn",152,384,"confirmed","Working port town on the Gulf. Chapter 2 starts here."],
  ["gellhorn-docks","Port Gellhorn Docks","transport","port-gellhorn",118,398,"spotted","The working seaport on the town's bay."],
  ["starlet-motel","Starlet Motel","safehouse","port-gellhorn",184,362,"spotted","Roadside motel from both trailers. A safehouse."],
  ["uncle-jacks","Uncle Jack's Liquor","store","port-gellhorn",196,372,"spotted","Liquor store on the motel strip."],
  ["pawn-gun","Port Gellhorn Pawn & Gun","store","port-gellhorn",166,414,"spotted","Pawn and gun shop where the first trailer's robbery ends."],
  ["delights-cabaret","Delights Cabaret","business","port-gellhorn",178,398,"spotted","Strip club."],
  ["crossroad-minimall","Crossroad Park Minimall","store","port-gellhorn",252,348,"spotted","Strip mall on Interstate 404."],
  ["interstate-404","Interstate 404","transport","port-gellhorn",300,330,"spotted","The interstate east out of town, signposted in the second trailer."],
  ["bocamar-bridge","Bocamar Bridge","transport","port-gellhorn",96,452,"speculation","Tall suspension bridge in the trailer backgrounds."],
  ["abandoned-motel","Abandoned beach motel","landmark","port-gellhorn",72,322,"spotted","A storm-wrecked motel on the beach."],
  ["gellhorn-raceway","Gellhorn International Raceway","race","port-gellhorn",236,444,"confirmed","Race track outside town."],
  ["gellhorn-outfitters","Gellhorn Outfitters","weapons","port-gellhorn",206,424,"confirmed","Ammu-Nation in Port Gellhorn."],
  ["gellhorn-fun-fair","Gellhorn Fun Fair","waink","port-gellhorn",136,350,"confirmed","A WAiNK scan at the fairground."],
  ["rodgers-ranch","Rodgers Ranch & Shooting Range","weapons","port-gellhorn",300,286,"confirmed","North-east of Port Gellhorn, in Kelly County."],
  ["thrillbilly-mud-club","Thrillbilly Mud Club","race","port-gellhorn",340,328,"confirmed","Mud racing off Route 32, Kelly County."],
  // Ambrosia
  ["ambrosia-town","Ambrosia","district","ambrosia",648,560,"confirmed","Company town under the refinery's smoke."],
  ["allied-crystal","Allied Crystal Sugar Refinery","landmark","ambrosia",688,584,"confirmed","The giant refinery that employs most of Ambrosia."],
  ["lake-leonida","Lake Leonida","nature","ambrosia",560,432,"confirmed","The biggest lake in the state, between Ambrosia and Mount Kalaga."],
  ["one-eyed-willies","One-Eyed Willie's","store","ambrosia",606,476,"confirmed","Off-road mod shop on the lake."],
  ["leonida-penitentiary","Leonida Penitentiary","landmark","ambrosia",772,514,"confirmed","The state prison where Lucia served time."],
  ["final-chapter-mc","Final Chapter MC clubhouse","landmark","ambrosia",712,626,"speculation","Expected home of the Final Chapter biker club."],
  ["ambrosia-water-tower","Ambrosia water tower","landmark","ambrosia",660,544,"spotted","Stands over the town in a night aerial shot."],
  ["cane-fields","Sugar cane fields","nature","ambrosia",540,560,"spotted","Cane fields that feed the refinery, shown burning."],
  // Mount Kalaga
  ["kalaga-trails","Mount Kalaga off-road trails","activity","mount-kalaga",404,206,"confirmed","Hill trails for trucks and buggies."],
  ["kalaga-hunting","Hunting in Mount Kalaga","activity","mount-kalaga",660,178,"confirmed","Hunting grounds in the state's wildest corner."],
  ["kalaga-canyon","Mount Kalaga canyon","nature","mount-kalaga",300,172,"spotted","A red-clay canyon."],
  ["kalaga-rail-bridge","Mount Kalaga rail bridge","transport","mount-kalaga",524,262,"spotted","Rail bridge over the river through the park."],
  ["old-mining-depot","Old mining depot","landmark","mount-kalaga",766,204,"spotted","Abandoned mine buildings deep in the park."],
  ["kalaga-lookout","Kalaga Lookout","waink","mount-kalaga",586,140,"confirmed","A WAiNK scan on a peak."],
  ["spanish-ruins","Imperial Spanish Ruins","waink","mount-kalaga",336,250,"confirmed","A WAiNK scan on the south-west peak."],
  ["kalaga-reservoir","Kalaga Reservoir","nature","mount-kalaga",480,172,"confirmed","Reservoir in the park."],
  ["jutting-cliff","Jutting Cliff","meditation","mount-kalaga",476,138,"confirmed","Meditation spot just north of Kalaga Reservoir."],
  ["lawton-paper-mill","Lawton Co. Paper Mill","waink","mount-kalaga",214,196,"confirmed","A WAiNK scan in Moreau."],
  ["gas-west-kalaga","247 Gas, West Kalaga","store","mount-kalaga",226,214,"confirmed","Gas station near the paper mill."],
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

// a natural coast: split each edge twice and nudge the new points sideways, seeded so every build is identical
function roughen(pts, iters = 2, amp = 9, seed = 7) {
  let r = seed
  const rand = () => (r = (r * 16807) % 2147483647) / 2147483647 - .5
  for (let k = 0; k < iters; k++, amp *= .5) {
    const out = []
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1, j = rand() * amp
      out.push(p, [Math.round((p[0] + q[0]) / 2 - dy / len * j), Math.round((p[1] + q[1]) / 2 + dx / len * j)])
    })
    pts = out
  }
  return pts
}
const data = {
  version: 1, updated: "2026-11-24", size: [W, H],
  disclaimer: "Unofficial fan map. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Pins are approximate.",
  map: { land: roughen(land), islands: islands.map((i, n) => ({ ...i, pts: i.pts.length > 8 ? roughen(i.pts, 1, 4, 11 + n) : i.pts })), keys, lakes, roads },
  regions, categories, places, missions,
  collectibles: collectibles.map(([id, name, total, note]) => ({ id, name, total, note })),
}
writeFileSync(new URL("../web/data/leonida.json", import.meta.url), JSON.stringify(data))
console.log(`places ${places.length} (${places.filter(p => p.x != null).length} pinned), missions ${missions.length}, collectibles ${collectibles.length}`)

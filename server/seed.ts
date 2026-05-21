import { existsSync, readFileSync, writeFileSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { exec } from "child_process";
import { Pool } from "pg";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, "data");
const dryRun = process.argv.includes("--dry-run");
const noDownload = process.argv.includes("--no-download");

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE } = process.env;

function log(msg: string, type: "info" | "success" | "warn" | "error" = "info") {
  const prefix = type === "error" ? "✗" : type === "warn" ? "⚠" : type === "success" ? "✓" : "→";
  console.log(`  ${prefix} ${msg}`);
}

function section(num: number, total: number, msg: string) {
  console.log(`\n[${num}/${total}] ${msg}...`);
  console.log("=".repeat(60));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const COMMON_VERBS = [
  "accept", "add", "admire", "admit", "adopt", "agree", "allow", "alter", "arrange", "ask",
  "assist", "assume", "attach", "attack", "avoid", "bear", "beat", "become", "beg", "behave",
  "believe", "belong", "blame", "bless", "blind", "block", "boil", "bomb", "book", "bother",
  "bounce", "branch", "break", "breed", "bring", "broadcast", "brush", "build", "burn", "buy",
  "calculate", "call", "camp", "care", "carry", "carve", "catch", "cause", "chain", "change",
  "charge", "chase", "cheat", "check", "cheer", "chew", "chip", "chop", "claim", "clap",
  "claw", "clean", "clear", "climb", "clock", "close", "coach", "coil", "collect", "colour",
  "comb", "command", "compare", "compete", "complain", "complicate", "concentrate", "concern", "confuse", "connect",
  "consider", "consist", "contact", "contain", "control", "cook", "cool", "copy", "correct", "cough",
  "count", "cover", "crack", "crash", "crawl", "create", "creep", "cross", "crowd", "cry",
  "cut", "dance", "die", "dig", "dip", "direct", "disagree", "discover", "discuss", "divide",
  "do", "donate", "draw", "dress", "drink", "drive", "drop", "dry", "dump", "eat",
  "enjoy", "enter", "exist", "explode", "extend", "face", "fail", "faint", "fall", "farm",
  "fasten", "fear", "feast", "feed", "feel", "fight", "fill", "find", "fit", "fix",
  "flap", "flash", "flee", "fling", "float", "flood", "flop", "flow", "fly", "fold",
  "follow", "fool", "force", "forget", "forgive", "form", "fracture", "frame", "frighten", "fry",
  "gather", "gaze", "get", "give", "glow", "glue", "go", "grab", "grate", "grease",
  "greet", "grill", "grind", "grip", "groan", "grow", "guard", "guess", "guide", "hammer",
  "hand", "handle", "hang", "happen", "harass", "harm", "hasten", "hatch", "hate", "have",
  "head", "heal", "hear", "heat", "help", "hide", "hit", "hold", "hop", "hope",
  "horn", "horrify", "hug", "hum", "hunt", "hurry", "hurt", "identify", "ignore", "illuminate",
  "imagine", "impress", "improve", "include", "indicate", "infect", "influence", "inform", "injure", "insult",
  "intend", "interrupt", "introduce", "invest", "invite", "irritate", "itch", "jail", "jam", "jog",
  "join", "joke", "judge", "juice", "jump", "keep", "kick", "kill", "kiss", "kneel",
  "knit", "knock", "knot", "know", "labour", "land", "laugh", "lay", "lead", "leak",
  "lean", "leap", "learn", "leave", "lecture", "led", "lend", "let", "lick", "lie",
  "lift", "light", "like", "listen", "live", "load", "loan", "lock", "long", "look",
  "lose", "love", "lubricate", "match", "mate", "matter", "mean", "measure", "meet", "melt",
  "memorise", "menace", "mention", "mess", "militate", "milk", "mind", "miss", "mix", "moan",
  "model", "moisten", "mould", "mourn", "move", "muddle", "multiply", "murder", "nail", "name",
  "need", "nest", "nod", "normalize", "notice", "number", "obey", "object", "observe", "obstruct",
  "occur", "offer", "oil", "open", "operate", "oppose", "order", "organize", "orient", "originate",
  "overflow", "owe", "own", "pack", "paddle", "paint", "park", "part", "pass", "paste",
  "pat", "patch", "pause", "peck", "pedal", "peel", "peep", "perform", "permit", "pester",
  "pet", "phone", "pick", "pierce", "pilot", "pin", "pinch", "pine", "place", "plan",
  "play", "plead", "please", "pledge", "plug", "plunge", "point", "poke", "polish", "pop",
  "possess", "post", "pour", "praise", "pray", "preach", "prefer", "prepare", "present", "preserve",
  "press", "pretend", "prick", "print", "process", "produce", "profit", "program", "project", "promise",
  "prosecute", "protect", "protest", "provide", "publish", "pull", "punch", "punish", "push", "put",
  "qualify", "quarrel", "question", "race", "rain", "raise", "rank", "rate", "reach", "read",
  "realize", "rear", "rebel", "receive", "recite", "recognize", "recommend", "record", "reduce", "reflect",
  "reform", "refuse", "regret", "reign", "reinforce", "reject", "rejoice", "relate", "relax", "release",
  "relieve", "rely", "remain", "remember", "remind", "remove", "render", "repair", "repeat", "replace",
  "reply", "report", "reproduce", "rescue", "resemble", "resist", "respect", "rest", "result", "resume",
  "retain", "retire", "return", "reveal", "revolt", "reward", "rid", "ride", "ring", "rise",
  "risk", "rob", "rock", "roll", "rot", "rub", "ruin", "rule", "rush", "sack",
  "sail", "satisfy", "save", "saw", "say", "scare", "scatter", "scold", "scorch", "scratch",
  "scream", "screw", "seal", "search", "season", "seat", "second", "secrete", "see", "seed",
  "seek", "seem", "seize", "select", "self", "sell", "send", "sense", "serve", "set",
  "settle", "sew", "shade", "shaft", "shake", "shall", "shame", "shape", "share", "shave",
  "shear", "shed", "shine", "shiver", "shock", "shoe", "shoot", "shop", "shorten", "shout",
  "show", "shred", "shrink", "shut", "sigh", "sign", "signal", "silence", "sill", "simplify",
  "sin", "sing", "sink", "sip", "sit", "skin", "skip", "slap", "slay", "sleep",
  "slice", "slide", "slip", "slit", "slope", "slow", "smash", "smell", "smile", "smoke",
  "snatch", "sneeze", "sniff", "snore", "snow", "soak", "soar", "sob", "sock", "soften",
  "soil", "solar", "soldier", "sole", "solve", "sore", "sort", "sought", "sound", "sow",
  "spare", "spark", "speak", "spear", "specify", "spell", "spend", "spill", "spin", "spit",
  "split", "spoil", "spot", "spray", "spread", "spring", "sprout", "squeeze", "stack", "staff",
  "stage", "stain", "stake", "stamp", "stand", "stare", "start", "starve", "stay", "steal",
  "steam", "steel", "steep", "steer", "stem", "step", "stew", "stick", "stiffen", "still",
  "stimulate", "sting", "stink", "stir", "stitch", "stop", "store", "storm", "story", "strain",
  "strangle", "strap", "straw", "stray", "strip", "strive", "stroke", "strong", "struggle", "stub",
  "study", "stuff", "stumble", "stun", "subtract", "succeed", "suck", "suffer", "suggest", "suit",
  "summon", "sun", "supply", "support", "suppose", "surprise", "surround", "suspect", "suspend", "swallow",
  "swear", "sweat", "sweep", "sweeten", "swell", "sweat", "swim", "swing", "switch", "sword",
  "symbolize", "sympathize", "system", "table", "tack", "tag", "take", "talk", "tame", "tap",
  "taste", "teach", "tear", "tee", "tell", "tempt", "tend", "tense", "term", "terrify", "test",
  "thank", "theorize", "think", "thirst", "thrash", "thread", "threaten", "thrill", "thrive", "throb",
  "throw", "thrust", "thumb", "thunder", "tidy", "tie", "tighten", "till", "time", "tip",
  "tire", "toast", "tolerate", "tooth", "top", "torment", "toss", "total", "touch", "tough",
  "tour", "towel", "trace", "track", "trade", "train", "trample", "transform", "translate", "trap",
  "travel", "tread", "treat", "tremble", "trick", "trigger", "trim", "trip", "troop", "trouble",
  "truck", "trump", "trunk", "trust", "try", "tub", "tube", "tuck", "tune", "turn",
  "tutor", "twist", "type", "uglify", "uncover", "undergo", "understand", "undress", "unfasten", "unite",
  "unlock", "update", "upgrade", "uphold", "urge", "use", "utilize", "utter", "value", "vanish",
  "vary", "verify", "vex", "victimize", "view", "violate", "visit", "voice", "volunteer", "vote",
  "wade", "wail", "wait", "wake", "walk", "wall", "wander", "want", "warm", "warn",
  "wash", "waste", "watch", "water", "wave", "wax", "waylay", "wear", "weave", "wed",
  "weep", "weigh", "welcome", "wend", "wet", "whistle", "widen", "wield", "wince", "wind",
  "wing", "wink", "wipe", "wire", "wish", "withdraw", "withstand", "wobble", "wonder", "work",
  "worry", "worship", "wrap", "wreck", "wrestle", "wring", "write", "wrong", "xerox", "yell",
  "yield", "yodel", "zip", "zoom",
];

const COMMON_NOUNS = [
  "ability", "absence", "accident", "account", "action", "activity", "actor", "actress", "addition", "address",
  "adventure", "advertisement", "advice", "affair", "age", "agency", "agent", "agreement", "air", "airplane",
  "airport", "alarm", "album", "alcohol", "alien", "allowance", "ally", "alphabet", "ambition", "amount",
  "animal", "ankle", "answer", "ant", "antique", "anxiety", "anybody", "anyone", "anything", "apartment",
  "appetite", "apple", "application", "appointment", "apron", "arch", "architect", "area", "argument", "arm",
  "armchair", "army", "arrow", "art", "artist", "ash", "ashtray", "assembly", "asset", "assistant",
  "association", "atom", "attack", "attention", "attic", "attitude", "attorney", "audience", "author", "authority",
  "auto", "automobile", "autumn", "baby", "back", "background", "backpack", "bacon", "bacterium", "badge",
  "badminton", "bag", "baggage", "bait", "bakery", "balance", "ball", "balloon", "bamboo", "banana",
  "band", "bandage", "bank", "bar", "barbecue", "barber", "bargain", "bark", "barn", "barrel",
  "base", "baseball", "basement", "basket", "basketball", "bat", "bath", "bathroom", "battery", "battle",
  "bay", "beach", "bead", "beam", "bean", "bear", "beard", "beast", "beat", "beauty",
  "bed", "bedroom", "bee", "beef", "beer", "beetle", "beggar", "beginner", "behavior", "belief",
  "bell", "belt", "bench", "bend", "benefit", "berry", "bet", "bible", "bicycle", "bid",
  "bike", "bill", "bin", "bird", "birth", "birthday", "bit", "bite", "blackbird", "blackboard",
  "blade", "blame", "blanket", "blast", "blazer", "bless", "blind", "blood", "bloom", "blossom",
  "blouse", "blow", "blue", "board", "boat", "body", "boil", "bomb", "bond", "bone",
  "book", "bookcase", "boot", "border", "bore", "born", "borough", "borrow", "boss", "bottom",
  "bough", "boulder", "bouquet", "bowl", "box", "boy", "brain", "brake", "branch", "brand",
  "brass", "bread", "breakfast", "breast", "breath", "breeze", "brick", "bride", "bridge", "brief",
  "briefcase", "brightness", "brilliant", "brim", "broom", "brother", "brow", "brown", "brush", "bubble",
  "budget", "buffalo", "bug", "bugle", "build", "bulb", "bull", "bullet", "bunch", "bundle",
  "burglar", "burn", "burst", "bus", "bush", "business", "butcher", "butter", "butterfly", "button",
  "buy", "buzz", "cabbage", "cabin", "cable", "cactus", "cake", "calendar", "calf", "call",
  "calm", "camera", "camp", "campaign", "campus", "can", "cancer", "candle", "cannon", "canvas",
  "canyon", "cap", "capital", "captain", "car", "caravan", "carburetor", "card", "care", "cargo",
  "carpenter", "carriage", "carrier", "carrot", "cart", "case", "cash", "cassette", "castle", "cat",
  "catalog", "catch", "category", "cattle", "cave", "ceiling", "cell", "cellar", "cement", "cent",
  "center", "centimeter", "century", "cereal", "chain", "chair", "chalk", "champion", "chance", "change",
  "chapel", "chapter", "character", "charge", "chase", "chat", "cheap", "check", "cheek", "cheer",
  "cheese", "cherry", "chest", "chew", "chick", "chicken", "chief", "child", "childhood", "chill",
  "chin", "chip", "chocolate", "choice", "choir", "choke", "chop", "chord", "church", "cigar",
  "cigarette", "cinema", "circle", "circumstance", "circus", "citizen", "city", "claim", "clap", "clarify",
  "clash", "class", "classic", "classroom", "clause", "claw", "clay", "cleaner", "cleat", "clerk",
  "click", "client", "cliff", "climb", "clinic", "clip", "cloak", "clock", "clone", "close",
  "cloth", "clothes", "cloud", "clown", "club", "clue", "coach", "coal", "coast", "coat",
  "cock", "cockpit", "cockroach", "code", "coffee", "coffin", "coin", "cold", "collar", "college",
  "colon", "colony", "color", "colt", "column", "comb", "combat", "combination", "comfort", "comic",
  "comma", "command", "comment", "committee", "common", "companion", "company", "concert", "conclusion", "condition",
  "conductor", "confection", "conference", "confidence", "conflict", "confusion", "congress", "conjunction", "connection", "consent",
  "consequence", "conservation", "conservative", "consideration", "consist", "console", "conspiracy", "constant", "construction", "contact",
  "container", "content", "contest", "context", "continent", "contraband", "contract", "contrast", "contribution", "control",
  "controller", "controversy", "convenience", "conversation", "convert", "conviction", "cook", "cooking", "cool", "cooper",
  "copper", "copy", "copyright", "cord", "core", "cork", "corn", "corner", "corporation", "correct",
  "corridor", "cost", "costume", "cotton", "couch", "cough", "council", "counsel", "counter", "country",
  "couple", "course", "court", "cousin", "cover", "cow", "coward", "crack", "craft", "crane",
  "crash", "crater", "crawl", "crazy", "cream", "creation", "creature", "credit", "creek", "crew",
  "crime", "criminal", "crisis", "critic", "criticism", "crop", "cross", "crowd", "crown", "crucial",
  "cruelty", "cruise", "crush", "cry", "crystal", "cube", "cubic", "cucumber", "culture", "cup",
  "cupboard", "curiosity", "curl", "curriculum", "curtain", "curve", "cushion", "custody", "custom", "customer",
  "cut", "cycle", "dad", "dagger", "damage", "dance", "danger", "dare", "dark", "darkness",
  "dash", "data", "database", "date", "daughter", "dawn", "day", "daylight", "dead", "deadline",
  "deaf", "deal", "dealer", "dear", "death", "debate", "debt", "debut", "decade", "decay",
  "deceive", "December", "decide", "decision", "deck", "declare", "decline", "decorate", "decrease", "dedicate",
  "deep", "deer", "defeat", "defect", "defend", "defendant", "defense", "deficit", "define", "definite",
  "degree", "delay", "delegate", "delete", "deliberate", "delight", "delivery", "demand", "democracy", "demonstrate",
  "denial", "density", "dentist", "deny", "department", "departure", "dependent", "deposit", "depression", "depth",
  "deputy", "derail", "descend", "describe", "desert", "deserve", "design", "designer", "desire", "desk",
  "desktop", "despair", "despite", "dessert", "destination", "destiny", "destroy", "detail", "detective", "device",
  "devil", "devote", "dew", "diagnose", "diagram", "dial", "dialogue", "diameter", "diamond", "diary",
  "dice", "dinosaur", "diplomat", "direction", "director", "dirt", "dirty", "disability", "disagree", "disappear",
  "disappoint", "disaster", "disc", "discard", "discharge", "discipline", "disclose", "discount", "discover", "discovery",
  "discrete", "discuss", "disease", "disguise", "disgust", "dish", "disk", "dismiss", "disorder", "display",
  "dispose", "dispute", "disrupt", "distance", "distant", "distinct", "distinguish", "distort", "distract", "distress",
  "distribute", "district", "disturb", "ditch", "dive", "diverge", "divide", "divine", "division", "divorce",
  "dizzy", "doctor", "document", "dodge", "doll", "dollar", "dolphin", "domain", "domestic", "dominant",
  "donate", "door", "dose", "double", "doubt", "dough", "down", "download", "draft", "drag",
  "dragon", "drain", "drama", "drank", "draw", "drawer", "drawing", "dream", "dress", "dried",
  "drift", "drill", "drink", "drip", "drive", "driver", "drop", "drove", "drown", "drug",
  "drum", "drunk", "dry", "duck", "dude", "due", "duel", "duke", "dull", "dumb",
  "dump", "dune", "dung", "dungeon", "dusk", "dust", "duty", "dwarf", "dwell", "dying",
  "dynamite", "each", "eager", "eagle", "ear", "early", "earn", "earth", "ease", "east",
  "Easter", "easy", "eat", "echo", "edge", "edit", "edition", "editor", "educate", "education",
  "effect", "effort", "egg", "eight", "either", "elbow", "elder", "elect", "election", "electricity",
  "elegant", "element", "elephant", "elevator", "eleven", "eligible", "elite", "else", "embark", "embassy",
  "embrace", "emerge", "emergency", "emit", "emotion", "emphasis", "employ", "employee", "employer", "empty",
  "enable", "enchant", "encounter", "encourage", "end", "enemy", "energy", "engage", "engine", "engineer",
  "enhance", "enjoy", "enormous", "enough", "enrich", "enroll", "ensure", "enter", "enterprise", "entertain",
  "enthusiasm", "entire", "entity", "entrance", "entry", "envelope", "environment", "envy", "episode", "equal",
  "equation", "equip", "equipment", "equivalent", "era", "erase", "erect", "erosion", "error", "escape",
  "escort", "especially", "essay", "essence", "essential", "establish", "estate", "estimate", "eternal", "ethics",
  "ethnicity", "evacuate", "evaluate", "even", "evening", "event", "ever", "every", "everybody", "everyone",
  "everything", "evidence", "evil", "evolution", "exaggerate", "exam", "examination", "examine", "example", "exceed",
  "excel", "except", "exception", "excess", "exchange", "excite", "exclude", "excuse", "execute", "exercise",
  "exhaust", "exhibit", "exile", "exist", "exit", "exotic", "expand", "expect", "expedition", "expel",
  "experience", "experiment", "expert", "explain", "explode", "exploit", "explore", "export", "expose", "express",
  "extend", "extension", "extent", "external", "extinct", "extra", "extract", "extraordinary", "extreme", "eye",
  "eyebrow", "fabric", "face", "facility", "fact", "factory", "faculty", "fade", "fail", "failure",
  "faint", "fair", "faith", "fake", "fall", "false", "fame", "family", "famous", "fan", "fantasy",
  "far", "fare", "farm", "farmer", "fashion", "fast", "fat", "fate", "father", "fatigue", "fault",
  "favor", "favorite", "fear", "feast", "feather", "feature", "February", "federal", "fee", "feed",
  "feel", "feeling", "fell", "fellow", "female", "fence", "festival", "fever", "few", "fiction",
  "field", "fierce", "fight", "figure", "file", "fill", "film", "filter", "filth", "final",
  "finance", "find", "fine", "finger", "finish", "fire", "firm", "first", "fish", "fisherman",
  "fist", "fit", "fix", "fixture", "flag", "flame", "flash", "flask", "flat", "flavor",
  "fled", "flesh", "flew", "flight", "float", "flock", "flood", "floor", "flour", "flow",
  "flower", "flu", "fluent", "fluff", "focus", "fog", "fold", "folk", "follow", "food",
  "fool", "foot", "football", "for", "force", "forehead", "foreign", "forest", "forget", "fork",
  "form", "formal", "format", "formation", "former", "formula", "fort", "forth", "fortune", "forum",
  "fossil", "foster", "foul", "foundation", "fountain", "four", "fox", "fragile", "frame", "frank",
  "fraud", "free", "freedom", "freeze", "freight", "French", "fresh", "friend", "friendship", "fright",
  "frog", "from", "front", "frost", "frown", "froze", "fruit", "fry", "fuel", "full",
  "fun", "function", "fund", "fundamental", "funeral", "funny", "fur", "furious", "furnace", "furniture",
  "further", "fury", "future", "gadget", "gain", "galaxy", "gallery", "game", "gang", "gap",
  "garage", "garbage", "garden", "garlic", "gas", "gate", "gather", "gauge", "gave", "gaze",
  "gear", "geek", "gem", "gene", "general", "generation", "generator", "genius", "genre", "gentle",
  "gentleman", "genuine", "germ", "German", "gesture", "ghost", "giant", "gift", "giggle", "ginger",
  "girl", "give", "glad", "glamour", "glance", "gland", "glare", "glass", "gleam", "glimpse",
  "globe", "gloom", "glory", "glove", "glow", "glue", "goal", "goat", "god", "gold",
  "golden", "golf", "gone", "good", "goodness", "goose", "gore", "gorge", "gossip", "got",
  "govern", "government", "gown", "grab", "grace", "grade", "grain", "gram", "grammar", "grand",
  "grandmother", "grant", "grape", "graph", "grasp", "grass", "gravity", "gray", "great", "greed",
  "Greek", "green", "greet", "grief", "grill", "grim", "grin", "grind", "grip", "groan",
  "grocery", "groove", "gross", "ground", "group", "grove", "grow", "growth", "guarantee", "guard",
  "guess", "guest", "guidance", "guide", "guild", "guilt", "guitar", "gun", "guru", "gust",
  "gut", "gutter", "guy", "gym", "gymnast", "habit", "hair", "hairy", "half", "hall",
  "halo", "ham", "hammer", "hand", "handle", "handy", "hang", "happen", "happy", "harbor",
  "hard", "hardship", "hardware", "hare", "harm", "harmony", "harp", "harvest", "hash", "haste",
  "hat", "hatch", "hate", "haul", "have", "hawk", "hay", "hazard", "haze", "hazel",
  "head", "headache", "heal", "health", "heap", "hear", "heart", "heat", "heath", "heaven",
  "heavy", "hedge", "heel", "heifer", "height", "heir", "helicopter", "hell", "hello", "helmet",
  "help", "hem", "hen", "herb", "herd", "here", "heritage", "hero", "heroin", "heron",
  "hers", "hesitate", "hex", "hey", "hiatus", "hiccup", "hide", "high", "highlight", "highway",
  "hill", "him", "himself", "hint", "hip", "hire", "his", "hiss", "history", "hit",
  "hitch", "hive", "hoard", "hoist", "hold", "hole", "holiday", "hollow", "holy", "home",
  "honest", "honey", "honor", "hood", "hoof", "hook", "hope", "horizon", "hormone", "horn",
  "horrible", "horror", "horse", "hospital", "host", "hostile", "hot", "hotel", "hound", "hour",
  "house", "household", "hover", "how", "however", "howl", "huddle", "hug", "huge", "hull",
  "human", "humanity", "humble", "humor", "hump", "humus", "hunch", "hunger", "hunt", "hurdle",
  "hurl", "hurricane", "hurry", "hurt", "husband", "hut", "hybrid", "hydro", "hymn", "hype",
];

const COMMON_ADJECTIVES = [
  "able", "acid", "acrid", "active", "actual", "adaptable", "additional", "adept", "adhesive", "adjacent",
  "adventurous", "afraid", "aggressive", "agile", "agreeable", "alarmed", "alert", "alien", "alive", "allergic",
  "aloof", "amazing", "ambitious", "amused", "ancient", "angry", "annoyed", "annoying", "anxious", "appalling",
  "appealing", "appetizing", "appreciative", "apprehensive", "approachable", "appropriate", "apt", "arctic", "ardent", "arrogant",
  "ashamed", "aspiring", "astonished", "astounding", "astute", "attentive", "attractive", "auspicious", "authentic", "authoritative",
  "autonomous", "available", "average", "avid", "awake", "aware", "awesome", "awful", "awkward", "bad",
  "bad", "balanced", "bare", "barren", "base", "basic", "basil", "bath", "battered", "battle",
  "beaten", "beautiful", "belated", "beloved", "beneficial", "best", "better", "bewildered", "biased", "big",
  "bilingual", "bizarre", "black", "blameless", "bleak", "blind", "blissful", "blonde", "blotchy", "blue",
  "blushing", "boastful", "bold", "bored", "boring", "bossy", "both", "bothered", "bouncy", "boundless",
  "brave", "breakable", "breathtaking", "breezy", "brief", "bright", "brilliant", "brisk", "broken", "bronze",
  "brown", "bruised", "brutal", "bubbly", "budget", "buff", "bulky", "bumpy", "buoyant", "burdensome",
  "busy", "cackling", "caged", "calm", "candid", "capable", "capital", "careful", "careless", "caring",
  "cautious", "ceaseless", "central", "certain", "chagrined", "chalky", "champion", "chance", "changeable", "chaotic",
  "charming", "chastened", "cheap", "cheerful", "cheery", "chic", "childish", "chilly", "charming", "chaste",
  "chatty", "cheap", "cheerful", "cheery", "chief", "childish", "childlike", "chilly", "chiral", "choppy",
  "chronic", "chubby", "chuckling", "circular", "clammy", "clamped", "clandestine", "clumsy", "cluttered", "coarse",
  "coastal", "cocky", "coiled", "cold", "colorful", "colossal", "combative", "comfortable", "comical", "committed",
  "compassionate", "competent", "competitive", "complacent", "composed", "conceited", "condescending", "confident", "confused", "congenial",
  "congruent", "conscious", "conservative", "considerate", "content", "contestable", "contradictory", "contrary", "controversial", "convincing",
  "cookable", "cool", "cooperative", "coordinated", "corrupt", "costly", "courageous", "courteous", "cowardly", "crabby",
  "crackable", "cramped", "cranky", "crazy", "creamy", "creative", "credulous", "creepy", "criminal", "crisp",
  "criticizable", "crooked", "cruel", "crummy", "crushable", "crusty", "cuddly", "culpable", "cultured", "cumbersome",
  "curious", "curly", "curt", "curved", "cute", "cuttable", "damp", "daring", "dark", "dashing",
  "dead", "deadly", "deafening", "dear", "deathless", "debonair", "decayed", "decaying", "deceitful", "deceptive",
  "dedicated", "defeated", "defenseless", "defiant", "deficient", "definite", "delayed", "delectable", "delicate", "delicious",
  "delighted", "delightful", "demanding", "demonic", "demure", "deniable", "dense", "dependable", "depressed", "deranged",
  "desirable", "desirous", "desolate", "desperate", "despicable", "destroyed", "destructive", "detached", "detectable", "determined",
  "devastated", "devilish", "devoted", "diamond", "diatonic", "diligent", "diminutive", "dimpled", "direful", "dirty",
  "disabling", "disadvantaged", "disagreeable", "disappointed", "disappointing", "disastrous", "disbelieving", "discerning", "discontented", "discordant",
  "discouraged", "discrete", "disdainful", "disgraceful", "disgusted", "disgusting", "disheartened", "dishonest", "disillusioned", "disinclined",
  "disjointed", "disordered", "displeased", "disproportionate", "disputable", "disregarded", "disruptive", "dissatisfied", "distorted", "distracted",
  "distraught", "distressed", "disturbing", "divalent", "dizzy", "dodgy", "doomed", "doubtful", "doughty", "downhearted",
  "downright", "drab", "dramatic", "dreary", "droopy", "drowned", "drowsy", "drunk", "dry", "dual",
  "dull", "dumb", "dusty", "duteous", "dwarf", "dwindling", "dynamic", "eager", "earnest", "earthshaking",
  "easeful", "easily", "east", "easy", "ecstatic", "edible", "educated", "eerie", "eery", "effective",
  "effervescent", "efficient", "effortless", "elated", "elegant", "elfin", "elite", "elliptical", "embarrassed", "embarrassing",
  "embittered", "emboldened", "emotional", "empathic", "empty", "enamored", "enchanting", "encouraged", "encouraging", "endearing",
  "endless", "energetic", "energized", "engaged", "engaging", "enjoyable", "enormous", "enraptured", "entertaining", "enthusiastic",
  "envious", "equable", "equal", "equitable", "equivalent", "erratic", "erroneous", "eruptive", "escaped", "essential",
  "establish", "ethereal", "evanescent", "eventful", "eventual", "everlasting", "evil", "exacting", "exasperated", "excellent",
  "excited", "exciting", "excluded", "exclusive", "excused", "exemplary", "exhausted", "exhilarated", "exhilarating", "exigent",
  "exonerated", "exotic", "expansive", "expectant", "expeditionary", "expensive", "expert", "expired", "expiring", "explanatory",
  "explicit", "exploited", "explosive", "exposed", "express", "expressive", "exquisite", "extemporaneous", "extensive", "exuberant",
  "exultant", "fabulous", "faded", "faint", "fair", "faithful", "fake", "fallacious", "fallow", "false",
  "famed", "familiar", "famished", "fancy", "fantastic", "far", "faraway", "fascinating", "fashionable", "fast",
  "fast-moving", "fatal", "fatigue", "fatigued", "faultless", "favorable", "favorite", "fearful", "fearless", "feckless",
  "feeble", "feeling", "feigned", "felonious", "ferocious", "fervent", "festive", "fiable", "fickle", "fictitious",
  "fidgety", "fierce", "fiendish", "fifty", "fightable", "filthy", "final", "financially", "fine", "finer",
  "finished", "finite", "fireproof", "firm", "first", "fit", "fitness", "fitting", "five", "flaky",
  "flamboyant", "flaming", "flawed", "flawless", "fledgling", "fleet", "fleeting", "flexible", "flighty", "flimsy",
  "flirtatious", "floppy", "florid", "flourishing", "flowing", "fluent", "flustered", "flying", "foamy", "focused",
  "foggy", "follower", "fond", "foolhardy", "foolish", "foolscap", "forbidding", "forceful", "foreboding", "foreign",
  "foreseeable", "forgetful", "forgivable", "forgiving", "forgotten", "fortunate", "foul", "four", "fourth", "fractious",
  "fragile", "fragrant", "frail", "frank", "frantic", "fraudulent", "freakish", "free", "freezing", "fresh",
  "fretful", "fried", "friendly", "frightened", "frightening", "frisky", "frizzly", "frizzly", "frolicsome", "front",
  "frosty", "frozen", "frugal", "fruitful", "frumpy", "frustrated", "frustrating", "fulfilling", "full", "fully",
  "fumbling", "functional", "fundamental", "funny", "furious", "furiously", "furry", "fusty", "futuristic", "fuzzy",
  "gabby", "gainful", "gallant", "game", "gaudy", "gauge", "gave", "gawky", "geeky", "gem",
  "generous", "genial", "gentle", "genuine", "ghastly", "giddy", "gifted", "gigantic", "giggling", "ginger",
  "girth", "glad", "glamorous", "glamourous", "gleaming", "gleeful", "gloomy", "glorious", "glossy", "glove",
  "glued", "god", "gold", "golden", "good", "goodly", "graceful", "gracious", "gradual", "grand",
  "grateful", "grave", "gray", "greasy", "great", "greedy", "green", "greedy", "gregarious", "grief",
  "grilled", "grim", "grimy", "grinding", "gritty", "gripping", "gritty", "groggy", "grouchy", "grounded",
  "group", "grove", "growling", "grubby", "grueling", "gruesome", "grumpy", "guilty", "gullible", "gummy",
  "gusty", "gutsy", "habitual", "hacked", "hallowed", "halting", "handsome", "handy", "happy", "hard",
  "hardy", "harlot", "harmful", "harmless", "harried", "harsh", "hasty", "hateful", "haughty", "haunted",
  "haunting", "havoc", "healthy", "heartbreaking", "heartfelt", "heartless", "heartwarming", "heated", "heavenly", "heavy",
  "hectic", "heedless", "hefty", "heinous", "helpless", "her", "here", "heretical", "heroic", "hesitant",
  "hideous", "high", "high-level", "high-minded", "high-pitched", "hilarious", "hilly", "hinged", "hip", "hissing",
  "hoary", "homesick", "honest", "honorable", "hopeful", "horde", "horizon", "horizontal", "horrible", "horrid",
  "horrified", "horrifying", "hostile", "hot", "hotdog", "hound", "hour", "house", "howling", "huffy",
  "huge", "hueless", "human", "humble", "humdrum", "humid", "humorous", "hundred", "hungry", "hurried",
  "hurt", "hurtful", "hushed", "husky", "hypnotic", "hysterical", "icky", "icy", "ideal", "idiotic",
  "ignorant", "ill", "illegal", "illiterate", "illustrious", "imaginative", "imbecilic", "immaculate", "immaterial", "immature",
  "immortal", "immutable", "imp", "impair", "impartial", "impassioned", "impeccable", "impending", "imperative", "imperfect",
  "imperial", "impersonal", "impertinent", "impetuous", "impish", "implausible", "implicit", "impolite", "important", "impossible",
  "impractical", "imprecise", "imprisoned", "improper", "improve", "imprudent", "impudent", "impulsive", "inappropriate", "incapable",
  "incompetent", "inconsequential", "inconsistent", "indecent", "indecisive", "indeed", "independent", "indifferent", "indignant", "indigo",
  "indiscreet", "indistinct", "individual", "ineffective", "inefficient", "inelegant", "inevitable", "inexpensive", "infamous", "infantile",
  "infected", "inferior", "infirm", "inflamed", "influential", "informal", "ingenious", "ingenuous", "inhibited", "injured",
  "injurious", "ink", "inky", "innocent", "innovative", "insane", "inscribed", "inscrutable", "insecure", "insensible",
  "insensitive", "insignificant", "insincere", "insolvent", "insomniac", "insouciant", "inspiring", "instructive", "insufferable", "insufficient",
  "intact", "integrated", "intellectual", "intelligent", "intense", "intent", "intention", "intermediate", "internal", "international",
  "interstellar", "intimate", "intimidated", "intimidating", "intricate", "introverted", "intruding", "intuitive", "invalid", "invaluable",
  "invincible", "invisible", "invited", "involved", "irate", "iron", "ironic", "irrational", "irregular", "irresponsible",
  "irreversible", "irritated", "irritating", "itchy", "its", "jaded", "jagged", "jailed", "jaunty", "jazzy",
  "jealous", "jeopardized", "jerk", "jest", "jittery", "joint", "jolly", "jovial", "joyful", "joyless",
  "joyous", "judicious", "juicy", "jumbo", "jumpy", "junior", "just", "keen", "kicky", "kill",
  "killing", "kind", "kindhearted", "kinds", "king", "kinky", "kiss", "kite", "kitten", "knightly",
  "knobby", "knotty", "knowing", "knowledge", "known", "kooky", "kosher", "labored", "lack", "lackadaisical",
  "lacking", "lame", "lamentable", "languid", "lanky", "large", "last", "late", "lately", "latent",
  "later", "lateral", "laughable", "laughing", "lavish", "lazy", "lead", "leader", "leading", "leafy",
  "leaky", "lean", "learned", "least", "leather", "leave", "leaves", "left", "left-handed", "legal",
  "legendary", "lemon", "lethal", "level", "lewd", "light", "light-hearted", "like", "likeable", "limid",
  "limited", "lit", "lively", "livid", "lopsided", "lost", "loud", "lousy", "loving", "low", "loyal",
  "lucid", "lucky", "ludicrous", "lumpy", "lush", "lustful", "luxuriant", "lying", "lyrical", "macabre",
  "macho", "mad", "maddening", "made-up", "magenta", "magical", "magnificent", "maiden", "main", "majestic",
  "major", "makeshift", "male", "malicious", "mammoth", "man", "manageable", "mandatory", "mangy", "maniacal",
  "manly", "mannered", "manners", "manual", "many", "marbled", "marginal", "marked", "married", "marvelous",
  "masculine", "massive", "master", "matched", "material", "materialistic", "maternal", "mathematical", "mature", "maverick",
  "max", "maximum", "meager", "mean", "meandering", "meaningful", "meaningless", "measly", "meaty", "medical",
  "mediocre", "meditative", "meek", "meeting", "melancholy", "mellow", "melodic", "memorable", "menacing", "mercurial",
  "merry", "messy", "metallic", "meteoric", "methodical", "meticulous", "mid", "mighty", "mild", "mindless",
  "mini", "minimal", "minimum", "minor", "mirthful", "miry", "mischief", "mischievous", "miserable", "miserly",
  "misleading", "missing", "mistaken", "misty", "mixed", "moaning", "mobile", "mocking", "modern", "modest",
  "moldy", "momentous", "monetary", "monopolizing", "moody", "moral", "moronic", "murky", "mushy", "mute",
  "muted", "mysterious", "naive", "narrow", "nasty", "national", "native", "natural", "naughty", "negative",
  "neglected", "negligent", "neighborly", "neither", "nervous", "neurotic", "neutral", "new", "next", "nice",
  "nifty", "nimble", "nine", "nippy", "no", "noble", "nocturnal", "noisy", "nominal", "nonchalant",
  "nondescript", "nonstop", "noose", "normal", "nostalgic", "nosy", "notable", "noted", "novel", "noxious",
  "null", "numb", "nutritious", "nutty", "oafish", "obese", "objectionable", "obliging", "obnoxious", "obscene",
  "obsequious", "observant", "obsessed", "obsolete", "obstinate", "odd", "offensive", "offhand", "officious", "offline",
  "ok", "okay", "old", "ominous", "once", "one", "onerous", "ongoing", "online", "only", "open",
  "openhanded", "opinionated", "opposite", "oppressed", "optimistic", "optional", "opulent", "orange", "orbits", "orderly",
  "ordinary", "organic", "original", "ornery", "ornate", "out", "outgoing", "outing", "outlandish", "outrageous",
  "outstanding", "over", "overcast", "overjoyed", "overlooked", "overwhelmed", "overwhelming", "overwrought", "own", "pain",
  "pained", "painful", "painless", "painstaking", "pale", "palpable", "panicky", "panoramic", "parched", "partial",
  "particular", "partner", "party", "passive", "past", "paste", "pastoral", "paternal", "pathetic", "patient",
  "patriotic", "patterned", "pavilion", "peaceful", "peak", "peckish", "peculiar", "pedantic", "pedestrian", "peevish",
  "penitent", "pensive", "peppery", "perceived", "perfect", "perfumed", "perilous", "periodical", "peripheral", "perishable",
  "perky", "permissible", "perpetual", "perplexed", "persevering", "persistant", "personal", "persuasive", "pertinent", "pesky",
  "pessimistic", "petite", "phobic", "physically", "picturesque", "piercing", "pink", "pious", "pitched", "pitiful",
  "pitying", "placid", "plaid", "plain", "plan", "plane", "plausible", "playful", "pleasant", "pleased", "pleasing",
  "pledge", "plenty", "pliable", "plodding", "plopped", "plot", "plucky", "plug", "plump", "plush", "pointed",
  "pointless", "poised", "poisonous", "political", "pompous", "ponderous", "poor", "pop", "popular", "positive",
  "possessive", "possible", "post", "pot", "potty", "powdered", "powerful", "powerless", "practical", "precious",
  "precise", "precocious", "predatory", "predictable", "prejudiced", "preliminary", "premier", "prepared", "preposterous", "present",
  "presidential", "pretty", "prevent", "prickly", "primary", "prime", "prince", "principled", "prior", "prissy",
  "private", "prized", "pro", "problematic", "procrastinating", "productive", "profane", "proficient", "profitable", "profound",
  "program", "progressive", "prohibitive", "prolific", "prominent", "promising", "prompt", "proper", "prophetic", "proponent",
  "proportional", "proposed", "prosperous", "protective", "protest", "proud", "provocative", "prudent", "psychedelic", "psychotic",
  "public", "punchy", "punctual", "pungent", "puny", "pure", "purple", "purposeful", "puzzled", "puzzling",
  "quack", "quaint", "qualified", "quarrelsome", "queasy", "questionable", "quick", "quickest", "quiet", "quirky",
  "quota", "quotable", "rabid", "racial", "racist", "radiant", "radical", "rage", "rainy", "rambunctious",
  "rampant", "random", "rank", "rapid", "rapt", "rapture", "rapturous", "rare", "raspy", "ratty",
  "ravenous", "ray", "razor-edged", "reactive", "ready", "real", "realistic", "reasonable", "rebel", "rebellious",
  "receptive", "recessive", "rechargeable", "recent", "receptive", "recluse", "red", "reddish", "refined", "reflective",
  "refreshing", "regal", "regressive", "regretful", "regular", "relatable", "relaxed", "relentless", "relevant", "reliable",
  "relieved", "religious", "reluctant", "remarkable", "remorseful", "remote", "removable", "renegotiable", "renewed", "repentant",
  "replicated", "representative", "repressive", "reproachful", "repulsive", "reputed", "rescinded", "resolute", "resonant", "respectable",
  "respectful", "responsible", "responsive", "restful", "restless", "restored", "restrictive", "resurgent", "retentive", "reticent",
  "retired", "retreat", "revengeful", "reverent", "reverse", "revival", "revulsive", "rewarding", "rhetorical", "rich",
  "ridiculous", "right", "righteous", "rightful", "rigid", "rigorous", "rim", "ring", "riot", "rippled",
  "risky", "ritual", "roaring", "robotic", "robust", "rodeo", "romantic", "roomy", "rooted", "rotary",
  "rotten", "rotund", "rough", "round", "rowdy", "royal", "ruddy", "rude", "ruined", "ruling",
  "rumpled", "rumbling", "rupture", "rural", "rustic", "rusty", "ruthless", "sabotaged", "sad", "sadden",
  "saddle", "sadistic", "sadly", "safe", "safeguarded", "sage", "saintly", "salient", "sallow", "sandy",
  "sane", "sanguine", "sanitary", "sappy", "sarcastic", "sardonic", "satisfied", "satisfying", "saucy", "savable",
  "savage", "savvy", "scalding", "scant", "scary", "scattered", "scenic", "scented", "school", "scientific",
  "scintillating", "scold", "scooted", "scornful", "scrawled", "screaming", "screwed", "screwy", "scruffy", "scrumptious",
  "scrutinized", "sealed", "seamless", "searching", "searing", "second", "secondary", "secret", "secretive", "sectional",
  "secure", "sedate", "seductive", "seedy", "seeming", "seemly", "seized", "selective", "self-absorbed", "self-assured",
  "self-centered", "self-confident", "self-conscious", "self-controlled", "self-deluded", "self-indulgent", "self-reliant", "selfish", "selfless", "self-possessed",
  "semiconscious", "semipermanent", "senile", "sensational", "senseless", "sensible", "sensitive", "sentimental", "separate", "serene",
  "sergeant", "serious", "servile", "sexist", "sexual", "sexy", "shabby", "shaded", "shadowed", "shady", "shaft",
  "shaky", "shallow", "shameful", "shameless", "shaped", "shareable", "sharp", "shattered", "sheepish", "sheer",
  "sheet", "sheltered", "sherbet", "shielded", "shiftless", "shimmering", "shiny", "shivered", "shocking", "shoddy",
  "short", "shortsighted", "showy", "shrill", "shrunken", "shut", "shy", "sick", "sickly", "sideways",
  "sighted", "sightly", "signficant", "silky", "silly", "sincere", "sinful", "singular", "sinister", "sinuous",
  "sizable", "skeptic", "sketchy", "skilled", "skinny", "slack", "slanderous", "slanted", "slanting", "sleek", "sleepy",
  "sleepless", "sleet", "slept", "sliced", "slick", "slick", "slippery", "sloppy", "slothful", "slow", "sluggish",
  "slushy", "sly", "smack", "small", "smarmy", "smart", "smash", "smeary", "smelly", "smile", "smiling",
  "smoggy", "snap", "snappish", "snappy", "snare", "snarling", "sneaky", "snippy", "snobbish", "snoopy", "snored",
  "snoring", "snotty", "snowy", "snug", "soapy", "sober", "solemn", "solicitous", "solid", "solitary", "solo",
  "some", "somber", "sonorous", "soot", "soothing", "sophisticated", "sordid", "sore", "sorrowful", "soulful", "soulless",
  "sound", "sour", "soured", "space", "spacious", "spade", "spare", "sparkling", "spartan", "spasmodic", "spastic",
  "spear", "special", "specific", "speckled", "spectacular", "speculative", "spicy", "spider", "spiky", "spineless", "spiteful",
  "splash", "splattered", "splendid", "spontaneous", "spooky", "spoon", "sporting", "spotless", "spotted", "spotty", "sprawling",
  "spry", "spurious", "squalid", "squandered", "square", "squashy", "squat", "squiggly", "squirmy", "squirrel", "stable",
  "stagnant", "stained", "stale", "stalled", "stammering", "stand", "standard", "stark", "stars", "startled", "startling",
  "starved", "static", "statuesque", "steadfast", "steady", "stealth", "steamy", "steel", "steep", "steerable", "stellar",
  "step", "stereotyped", "stew", "sticky", "stiff", "still", "stilled", "stingy", "stinking", "stinky", "stirred",
  "stock", "stole", "stolen", "stolid", "stone", "stoned", "stop", "stopped", "storm", "stormy", "stout", "straight",
  "straightforward", "strained", "strange", "strangled", "strategic", "streak", "streaky", "streamlined", "street", "stressed", "stressful",
  "stretched", "strict", "stride", "strident", "striking", "stringy", "strip", "stripped", "strive", "stroke", "strong", "strove",
  "struck", "structural", "stuck", "studied", "studious", "stuffy", "stunning", "stupid", "sturdy", "stylish", "suave",
  "subject", "submissive", "subordinate", "subsequent", "subsidiary", "substance", "substantial", "substantiate", "subversive", "success", "successful",
  "succinct", "sudden", "suffer", "suffering", "sufficient", "sugary", "suicidal", "suitable", "sulky", "sullen", "sun",
  "sunny", "super", "superb", "superficial", "superior", "supernatural", "supple", "supportive", "suppose", "supposed", "supposedly",
  "suppressive", "supreme", "sure", "surly", "surmised", "surprised", "surprising", "surprisingly", "surrender", "surreptitious", "survived",
  "susceptible", "suspect", "suspicious", "sustainable", "swamp", "swarm", "swarthy", "sweaty", "sweeping", "sweet", "swift",
  "swindle", "swiss", "sword", "symbolic", "sympathetic", "symptom", "synonymous", "systematic", "taboo", "tacit", "tacky",
  "tactful", "tactical", "tail", "taken", "talent", "talented", "talkative", "tall", "tame", "tangible", "tangled",
  "tanned", "tantalizing", "tardy", "tasteful", "tasteless", "tasty", "taunting", "taut", "tawdry", "teary", "teasing",
  "technical", "teensy", "teeth", "telegraphed", "tender", "tense", "tentative", "tenth", "tepid", "terrible", "terrific",
  "terrified", "terrify", "terrifying", "territorial", "tested", "testy", "thankful", "thankless", "theoretical", "thirsty", "thorny",
  "thorough", "thoughtful", "thoughtless", "threadbare", "threatened", "threatening", "thrilled", "thrilling", "throbbing", "thronged",
  "thrown", "thrusting", "thumb", "thunder", "thundering", "thus", "ticklish", "tidy", "tied", "tiger", "tight",
  "tightfisted", "timid", "timorous", "tired", "tiresome", "titanic", "title", "toasted", "today", "toed", "toilet",
  "told", "tolerant", "toothsome", "toothy", "top", "topical", "tops", "torn", "torpid", "torrential", "torrid",
  "tortured", "torturous", "total", "totally", "touch", "touching", "tough", "tour", "towering", "toxic", "trace",
  "traced", "tragic", "trailed", "train", "trained", "trait", "tranquil", "transcribed", "transfer", "transformed", "transient",
  "transitional", "translucent", "transparent", "trapped", "trapped", "trashy", "traumatic", "travel", "traveled", "treason", "treason",
  "treasure", "trembling", "tremendous", "trendy", "trial", "triangle", "tribal", "tricked", "tricky", "triggered", "trite",
  "triumphant", "trivial", "trod", "tropical", "troubled", "troublesome", "troubling", "truant", "truce", "true", "trusting",
  "trustworthy", "trusty", "trying", "tubby", "tumbling", "tun", "tuneful", "turbulent", "turf", "turn", "twice",
  "twisted", "two", "typical", "tyrannical", "ubiquitous", "ugly", "ulterior", "ultimate", "ultramodern", "unable", "unacceptable",
  "unaccounted", "unarmed", "unaware", "unbalanced", "unbearable", "unbeatable", "unbiased", "unblemished", "unbound", "unbroken",
  "uncanny", "uncaring", "uncertain", "unchanged", "unclear", "unclothed", "uncomfortable", "unconcerned", "unconfirmed", "unconvinced",
  "uncredited", "undecided", "under", "understood", "undeserving", "undesirable", "uneasy", "unemployed", "unequal", "unequaled",
  "uneven", "unfair", "unfamiliar", "unfashioned", "unfastened", "unfavorable", "unfinished", "unfit", "unforgiving", "unfortunate",
  "unfriendly", "unfulfilled", "unguarded", "unhappy", "unhealthy", "unified", "uniform", "unilateral", "unimaginable", "unimpressed",
  "unintelligent", "united", "unjust", "unkind", "unknown", "unlawful", "unleashed", "unlimited", "unlit", "unloved", "unlucky",
  "unmanageable", "unnatural", "unnecessary", "unneeded", "unnerve", "unnerved", "unnerving", "unnoticeable", "unobserved", "unobtainable",
  "unoccupied", "unoffensive", "unparalleled", "unprepared", "unproductive", "unprofessional", "unquestionable", "unquestioned", "unreliable", "unremarkable",
  "unrepeatable", "unreserved", "unresponsive", "unruly", "unsafe", "unsatisfied", "unsavory", "unscathed", "unscrupulous", "unseemly",
  "unseen", "unsuitable", "unsure", "unsuspecting", "untarnished", "untidy", "untied", "untrained", "untrue", "untrustworthy",
  "unturned", "unusual", "unwanted", "unwelcome", "unwell", "unwilling", "unwitting", "unwritten", "upbeat", "upright", "upset",
  "uptight", "urban", "urchin", "urgent", "usable", "used", "useful", "useless", "usual", "utter", "uttermost",
  "vague", "vain", "valid", "valuable", "vanished", "vanity", "variable", "varied", "various", "varying", "vast",
  "vegetable", "vengeful", "venomous", "venturous", "verdant", "verifiable", "versed", "very", "viable", "vibrant", "vicious",
  "victorious", "vigilant", "vigorous", "vile", "villainous", "vindictive", "violated", "violent", "violet", "viper",
  "viral", "virtuous", "virulent", "visionary", "vital", "vitriolic", "vivacious", "vivid", "vocal", "vocational", "vogue",
  "voice", "voiceless", "volatile", "voluntary", "vomitive", "vulgar", "vulnerable", "wacky", "wailing", "warm",
  "warmhearted", "warped", "wary", "wasteful", "wavering", "wax", "weak", "wealthy", "weary", "wee",
  "weedy", "weekly", "weepy", "weighty", "weird", "welcome", "welcoming", "well", "well-groomed", "well-informed",
  "well-mannered", "well-off", "well-to-do", "welsh", "went", "wept", "were", "western", "wet", "whimsical",
  "whispering", "whistling", "white", "whole", "wholesale", "wicked", "wide", "wide-eyed", "widespread", "wild",
  "willful", "willing", "wilted", "wily", "wimpy", "winding", "windy", "winged", "winking", "winning",
  "winsome", "winter", "wiry", "wise", "wishful", "wispy", "wistful", "witty", "wobbly", "woebegone",
  "woeful", "womanly", "wonderful", "wondrous", "woozy", "wordy", "workable", "worldly", "worn", "worried",
  "worrisome", "worrying", "worse", "worsen", "worshiped", "worst", "worth", "worthless", "worthwhile", "worthy",
  "wound", "wrathful", "wreck", "wrench", "wrestled", "wretched", "wriggling", "wriggly", "wrinkled", "writ",
  "written", "wrong", "wronged", "yawning", "yearning", "yeasty", "yelled", "yellow", "yelp", "young",
  "youthful", "yummy", "zany", "zealous", "zesty", "zippy", "zonal", "zoom",
];

const FREQUENCY_LIST = [
  ...COMMON_VERBS.slice(0, 1500).map(w => ({ word: w, pos: "verb" })),
  ...COMMON_NOUNS.slice(0, 1500).map(w => ({ word: w, pos: "noun" })),
  ...COMMON_ADJECTIVES.slice(0, 1500).map(w => ({ word: w, pos: "adjective" })),
];

function getTranslation() {
  return [{ pending: true, note: "Translation pending" }];
}

interface SentenceCache {
  index: Record<string, number[]>;
  sentences: Record<string, string>;
}

function buildVocabulary(): any[] {
  log("Using embedded frequency list as vocabulary source");

  const allWords = [...FREQUENCY_LIST];
  
  const vocabulary: any[] = [];
  let id = 0;

  for (let i = 0; i < allWords.length; i++) {
    const level = i < 300 ? "A2" : i < 1800 ? "B1" : "B2";
    if (level === "A2") continue;
    const w = allWords[i];
    
    vocabulary.push({
      id: `seed-${String(id++).padStart(5, "0")}`,
      word: w.word,
      level: level,
      part_of_speech: w.pos,
      translations: getTranslation(),
      phonetic: "",
      frequency: i,
      example_sentences: [],
      collocations: [],
    });
  }

  const b1Count = vocabulary.filter(w => w.level === "B1").length;
  const b2Count = vocabulary.filter(w => w.level === "B2").length;
  log(`B1 words: ${b1Count}, B2 words: ${b2Count}`);

  const outPath = join(DATA_DIR, "vocabulary-generated.json");
  writeFileSync(outPath, JSON.stringify(vocabulary, null, 2));
  log(`Generated ${vocabulary.length} vocabulary words to ${outPath}`);

  return vocabulary;
}

async function downloadAndIndexSentences(vocabulary: any[]): Promise<SentenceCache> {
  const cachePath = join(DATA_DIR, "sentence-cache.json");

  if (existsSync(cachePath) && !dryRun) {
    const raw = readFileSync(cachePath, "utf-8");
    log(`Sentence cache loaded: ${Object.keys(JSON.parse(raw).index || {}).length} words indexed`);
    return JSON.parse(raw) as SentenceCache;
  }

  const tatoebaUrl = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_CC0.tsv.bz2";
  const tatoebaBz2Path = join(DATA_DIR, "eng_sentences_CC0.tsv.bz2");
  const tatoebaTsvPath = join(DATA_DIR, "eng_sentences_CC0.tsv");

  if (!noDownload) {
    await fetchFile(tatoebaUrl, tatoebaBz2Path, "Tatoeba CC0");
    await new Promise<void>((resolve, reject) => {
      exec(`/usr/bin/bunzip2 -f "${tatoebaBz2Path}"`, (err: any) => {
        if (err && !existsSync(tatoebaTsvPath.replace(".bz2", ""))) {
          reject(err);
        } else {
          log("Tatoeba: decompressed");
          resolve();
        }
      });
    });
  }

  if (!existsSync(tatoebaTsvPath)) {
    log(`Tatoeba TSV not found. Run without --no-download first.`, "error");
    process.exit(1);
  }

  const vocabularyWords = new Set(vocabulary.map((v) => v.word.toLowerCase()));
  const index: Record<string, number[]> = {};
  const sentences: Record<string, string> = {};
  let matchCount = 0;

  log("Building sentence index...");
  const content = readFileSync(tatoebaTsvPath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines.slice(0, 50000)) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const id = parts[0];
    const text = parts[2];
    if (!text) continue;

    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    for (const w of words) {
      if (vocabularyWords.has(w)) {
        if (!index[w]) index[w] = [];
        if (index[w].length < 5) {
          index[w].push(parseInt(id));
          sentences[id] = text;
          matchCount++;
        }
      }
    }
  }

  const cache: SentenceCache = { index, sentences };
  writeFileSync(cachePath, JSON.stringify(cache));
  log(`Sentence index built: ${matchCount} sentences for ${Object.keys(index).length} words`);

  return cache;
}

function matchSentencesToVocabulary(vocabulary: any[], cache: SentenceCache): any[] {
  log("Matching sentences to vocabulary...");

  return vocabulary.map((word) => {
    const wordLower = word.word.toLowerCase();
    const sentenceIds = cache.index[wordLower] || [];

    if (sentenceIds.length === 0) return word;

    const sentences = sentenceIds
      .map((id) => {
        const text = cache.sentences[String(id)];
        if (!text) return null;
        return { text, translation: null, sourceId: id };
      })
      .filter(Boolean);

    return { ...word, example_sentences: sentences };
  });
}

function generateLessons(vocabulary: any[]): any[] {
  log("Generating lessons...");

  const b1Words = vocabulary.filter((w) => w.level === "B1");
  const b2Words = vocabulary.filter((w) => w.level === "B2");

  const lessons: any[] = [];
  const chunkSize = 50;

  const b1Chunks = [];
  for (let i = 0; i < b1Words.length; i += chunkSize) {
    b1Chunks.push(b1Words.slice(i, i + chunkSize));
  }

  const b2Chunks = [];
  for (let i = 0; i < b2Words.length; i += chunkSize) {
    b2Chunks.push(b2Words.slice(i, i + chunkSize));
  }

  let lessonId = 1;
  const b1Titles = ["Essential Words", "Common Actions", "Everyday Life", "Describing Things", "Communication", "Daily Routines"];
  const b2Titles = ["Advanced Concepts", "Complex Actions", "Abstract Ideas", "Professional Context", "Nuanced Expression", "Academic Vocabulary"];

  b1Chunks.forEach((group, i) => {
    lessons.push({
      id: `lesson-${String(lessonId).padStart(3, "0")}`,
      title: `B1 Vocabulary – ${b1Titles[i] || `Part ${i + 1}`}`,
      description: `Learn ${group.length} common B1 vocabulary words with example sentences`,
      level: "B1",
      type: "vocabulary",
      content: { type: "vocabulary", words: group.map((w) => w.word) },
      vocabulary_ids: group.map((w) => w.id),
      difficulty: 1,
    });
    lessonId++;
  });

  b2Chunks.forEach((group, i) => {
    lessons.push({
      id: `lesson-${String(lessonId).padStart(3, "0")}`,
      title: `B2 Vocabulary – ${b2Titles[i] || `Part ${i + 1}`}`,
      description: `Learn ${group.length} advanced B2 vocabulary words`,
      level: "B2",
      type: "vocabulary",
      content: { type: "vocabulary", words: group.map((w) => w.word) },
      vocabulary_ids: group.map((w) => w.id),
      difficulty: 2,
    });
    lessonId++;
  });

  log(`Created ${lessons.length} lessons`);
  return lessons;
}

interface VerbForm {
  infinitive: string;
  past_simple: string;
  past_participle: string;
  third_person: string;
  present_participle: string;
}

const IRREGULAR_VERBS: VerbForm[] = [
  { infinitive: "be", past_simple: "was", past_participle: "been", third_person: "is", present_participle: "being" },
  { infinitive: "have", past_simple: "had", past_participle: "had", third_person: "has", present_participle: "having" },
  { infinitive: "do", past_simple: "did", past_participle: "done", third_person: "does", present_participle: "doing" },
  { infinitive: "go", past_simple: "went", past_participle: "gone", third_person: "goes", present_participle: "going" },
  { infinitive: "make", past_simple: "made", past_participle: "made", third_person: "makes", present_participle: "making" },
  { infinitive: "say", past_simple: "said", past_participle: "said", third_person: "says", present_participle: "saying" },
  { infinitive: "get", past_simple: "got", past_participle: "got", third_person: "gets", present_participle: "getting" },
  { infinitive: "take", past_simple: "took", past_participle: "taken", third_person: "takes", present_participle: "taking" },
  { infinitive: "come", past_simple: "came", past_participle: "come", third_person: "comes", present_participle: "coming" },
  { infinitive: "see", past_simple: "saw", past_participle: "seen", third_person: "sees", present_participle: "seeing" },
  { infinitive: "know", past_simple: "knew", past_participle: "known", third_person: "knows", present_participle: "knowing" },
  { infinitive: "think", past_simple: "thought", past_participle: "thought", third_person: "thinks", present_participle: "thinking" },
  { infinitive: "give", past_simple: "gave", past_participle: "given", third_person: "gives", present_participle: "giving" },
  { infinitive: "find", past_simple: "found", past_participle: "found", third_person: "finds", present_participle: "finding" },
  { infinitive: "tell", past_simple: "told", past_participle: "told", third_person: "tells", present_participle: "telling" },
  { infinitive: "become", past_simple: "became", past_participle: "become", third_person: "becomes", present_participle: "becoming" },
  { infinitive: "leave", past_simple: "left", past_participle: "left", third_person: "leaves", present_participle: "leaving" },
  { infinitive: "put", past_simple: "put", past_participle: "put", third_person: "puts", present_participle: "putting" },
  { infinitive: "keep", past_simple: "kept", past_participle: "kept", third_person: "keeps", present_participle: "keeping" },
  { infinitive: "let", past_simple: "let", past_participle: "let", third_person: "lets", present_participle: "letting" },
  { infinitive: "begin", past_simple: "began", past_participle: "begun", third_person: "begins", present_participle: "beginning" },
  { infinitive: "seem", past_simple: "seemed", past_participle: "seemed", third_person: "seems", present_participle: "seeming" },
  { infinitive: "help", past_simple: "helped", past_participle: "helped", third_person: "helps", present_participle: "helping" },
  { infinitive: "show", past_simple: "showed", past_participle: "shown", third_person: "shows", present_participle: "showing" },
  { infinitive: "hear", past_simple: "heard", past_participle: "heard", third_person: "hears", present_participle: "hearing" },
  { infinitive: "play", past_simple: "played", past_participle: "played", third_person: "plays", present_participle: "playing" },
  { infinitive: "run", past_simple: "ran", past_participle: "run", third_person: "runs", present_participle: "running" },
  { infinitive: "move", past_simple: "moved", past_participle: "moved", third_person: "moves", present_participle: "moving" },
  { infinitive: "live", past_simple: "lived", past_participle: "lived", third_person: "lives", present_participle: "living" },
  { infinitive: "believe", past_simple: "believed", past_participle: "believed", third_person: "believes", present_participle: "believing" },
  { infinitive: "bring", past_simple: "brought", past_participle: "brought", third_person: "brings", present_participle: "bringing" },
  { infinitive: "happen", past_simple: "happened", past_participle: "happened", third_person: "happens", present_participle: "happening" },
  { infinitive: "write", past_simple: "wrote", past_participle: "written", third_person: "writes", present_participle: "writing" },
  { infinitive: "provide", past_simple: "provided", past_participle: "provided", third_person: "provides", present_participle: "providing" },
  { infinitive: "sit", past_simple: "sat", past_participle: "sat", third_person: "sits", present_participle: "sitting" },
  { infinitive: "stand", past_simple: "stood", past_participle: "stood", third_person: "stands", present_participle: "standing" },
  { infinitive: "lose", past_simple: "lost", past_participle: "lost", third_person: "loses", present_participle: "losing" },
  { infinitive: "pay", past_simple: "paid", past_participle: "paid", third_person: "pays", present_participle: "paying" },
  { infinitive: "meet", past_simple: "met", past_participle: "met", third_person: "meets", present_participle: "meeting" },
  { infinitive: "include", past_simple: "included", past_participle: "included", third_person: "includes", present_participle: "including" },
  { infinitive: "continue", past_simple: "continued", past_participle: "continued", third_person: "continues", present_participle: "continuing" },
  { infinitive: "set", past_simple: "set", past_participle: "set", third_person: "sets", present_participle: "setting" },
  { infinitive: "learn", past_simple: "learned", past_participle: "learned", third_person: "learns", present_participle: "learning" },
  { infinitive: "change", past_simple: "changed", past_participle: "changed", third_person: "changes", present_participle: "changing" },
  { infinitive: "lead", past_simple: "led", past_participle: "led", third_person: "leads", present_participle: "leading" },
  { infinitive: "understand", past_simple: "understood", past_participle: "understood", third_person: "understands", present_participle: "understanding" },
  { infinitive: "watch", past_simple: "watched", past_participle: "watched", third_person: "watches", present_participle: "watching" },
  { infinitive: "follow", past_simple: "followed", past_participle: "followed", third_person: "follows", present_participle: "following" },
  { infinitive: "stop", past_simple: "stopped", past_participle: "stopped", third_person: "stops", present_participle: "stopping" },
  { infinitive: "create", past_simple: "created", past_participle: "created", third_person: "creates", present_participle: "creating" },
  { infinitive: "speak", past_simple: "spoke", past_participle: "spoken", third_person: "speaks", present_participle: "speaking" },
  { infinitive: "read", past_simple: "read", past_participle: "read", third_person: "reads", present_participle: "reading" },
  { infinitive: "allow", past_simple: "allowed", past_participle: "allowed", third_person: "allows", present_participle: "allowing" },
  { infinitive: "add", past_simple: "added", past_participle: "added", third_person: "adds", present_participle: "adding" },
  { infinitive: "spend", past_simple: "spent", past_participle: "spent", third_person: "spends", present_participle: "spending" },
  { infinitive: "grow", past_simple: "grew", past_participle: "grown", third_person: "grows", present_participle: "growing" },
  { infinitive: "open", past_simple: "opened", past_participle: "opened", third_person: "opens", present_participle: "opening" },
  { infinitive: "walk", past_simple: "walked", past_participle: "walked", third_person: "walks", present_participle: "walking" },
  { infinitive: "win", past_simple: "won", past_participle: "won", third_person: "wins", present_participle: "winning" },
  { infinitive: "offer", past_simple: "offered", past_participle: "offered", third_person: "offers", present_participle: "offering" },
  { infinitive: "remember", past_simple: "remembered", past_participle: "remembered", third_person: "remembers", present_participle: "remembering" },
  { infinitive: "love", past_simple: "loved", past_participle: "loved", third_person: "loves", present_participle: "loving" },
  { infinitive: "consider", past_simple: "considered", past_participle: "considered", third_person: "considers", present_participle: "considering" },
  { infinitive: "appear", past_simple: "appeared", past_participle: "appeared", third_person: "appears", present_participle: "appearing" },
  { infinitive: "buy", past_simple: "bought", past_participle: "bought", third_person: "buys", present_participle: "buying" },
  { infinitive: "wait", past_simple: "waited", past_participle: "waited", third_person: "waits", present_participle: "waiting" },
  { infinitive: "serve", past_simple: "served", past_participle: "served", third_person: "serves", present_participle: "serving" },
  { infinitive: "die", past_simple: "died", past_participle: "died", third_person: "dies", present_participle: "dying" },
  { infinitive: "send", past_simple: "sent", past_participle: "sent", third_person: "sends", present_participle: "sending" },
  { infinitive: "expect", past_simple: "expected", past_participle: "expected", third_person: "expects", present_participle: "expecting" },
  { infinitive: "build", past_simple: "built", past_participle: "built", third_word: "builds", present_participle: "building" },
  { infinitive: "stay", past_simple: "stayed", past_participle: "stayed", third_person: "stays", present_participle: "staying" },
  { infinitive: "fall", past_simple: "fell", past_participle: "fallen", third_person: "falls", present_participle: "falling" },
  { infinitive: "cut", past_simple: "cut", past_participle: "cut", third_person: "cuts", present_participle: "cutting" },
  { infinitive: "reach", past_simple: "reached", past_participle: "reached", third_person: "reaches", present_participle: "reaching" },
  { infinitive: "kill", past_simple: "killed", past_participle: "killed", third_person: "kills", present_participle: "killing" },
  { infinitive: "remain", past_simple: "remained", past_participle: "remained", third_person: "remains", present_participle: "remaining" },
];

const TENSES = [
  "present_simple", "past_simple", "future_simple", "present_continuous", "past_continuous",
  "present_perfect", "past_perfect", "future_perfect", "present_perfect_continuous",
  "past_perfect_continuous", "passive_present", "passive_past", "passive_future",
  "conditional", "imperative", "gerund"
];

function generateTenses(verb: string, type: "regular" | "irregular", forms?: VerbForm): Record<string, string> {
  const base = verb.toLowerCase();

  if (type === "irregular" && forms) {
    return {
      present_simple: `I ${forms.third_person}`,
      past_simple: `I ${forms.past_simple}`,
      future_simple: `I will ${base}`,
      present_continuous: `I am ${forms.present_participle}`,
      past_continuous: `I was ${forms.present_participle}`,
      present_perfect: `I have ${forms.past_participle}`,
      past_perfect: `I had ${forms.past_participle}`,
      future_perfect: `I will have ${forms.past_participle}`,
      present_perfect_continuous: `I have been ${forms.present_participle}`,
      past_perfect_continuous: `I had been ${forms.present_participle}`,
      passive_present: `${base} is performed`,
      passive_past: `${base} was performed`,
      passive_future: `${base} will be performed`,
      conditional: `I would ${base}`,
      imperative: `${base.charAt(0).toUpperCase() + base.slice(1)}!`,
      gerund: `${forms.present_participle}`,
    };
  }

  const stem = base.endsWith("e") ? base.slice(0, -1) : base;
  const doubled = stem + stem.slice(-1);

  return {
    present_simple: `I ${base + (base.endsWith("s") || base.endsWith("x") || base.endsWith("z") || base.endsWith("ch") || base.endsWith("sh") ? "es" : "s")}`,
    past_simple: `I ${stem}ed`,
    future_simple: `I will ${base}`,
    present_continuous: `I am ${stem}ing`,
    past_continuous: `I was ${stem}ing`,
    present_perfect: `I have ${stem}ed`,
    past_perfect: `I had ${stem}ed`,
    future_perfect: `I will have ${stem}ed`,
    present_perfect_continuous: `I have been ${stem}ing`,
    past_perfect_continuous: `I had been ${stem}ing`,
    passive_present: `${base} is done`,
    passive_past: `${base} was done`,
    passive_future: `${base} will be done`,
    conditional: `I would ${base}`,
    imperative: `${base.charAt(0).toUpperCase() + base.slice(1)}!`,
    gerund: `${stem}ing`,
  };
}

function buildConjugations(): any[] {
  log("Building conjugation tables...");

  const verbArray: any[] = [];
  let id = 0;

  for (const v of IRREGULAR_VERBS) {
    verbArray.push({
      id: `verb-${String(id++).padStart(5, "0")}`,
      verb: v.infinitive,
      type: "irregular",
      translations: getTranslation(),
      tenses: generateTenses(v.infinitive, "irregular", v),
      frequency: id,
    });
  }

  const regularVerbs = [
    "work", "play", "study", "help", "talk", "walk", "look", "live", "call", "try",
    "ask", "need", "want", "use", "find", "give", "tell", "feel", "become", "leave",
    "put", "keep", "let", "begin", "seem", "help", "show", "hear", "play", "run",
    "move", "believe", "bring", "happen", "write", "provide", "sit", "stand", "lose",
    "pay", "meet", "include", "continue", "set", "learn", "change", "lead", "understand",
    "watch", "follow", "stop", "create", "speak", "read", "allow", "add", "spend", "grow",
    "open", "walk", "win", "offer", "remember", "love", "consider", "appear", "buy", "wait",
    "serve", "die", "send", "expect", "build", "stay", "fall", "cut", "reach", "kill",
    "remain", "agree", "support", "hit", "produce", "eat", "cover", "catch", "draw", "choose",
  ];

  for (const v of regularVerbs) {
    if (verbArray.length >= 2000) break;
    verbArray.push({
      id: `verb-${String(id++).padStart(5, "0")}`,
      verb: v,
      type: "regular",
      translations: getTranslation(),
      tenses: generateTenses(v, "regular"),
      frequency: id,
    });
  }

  log(`Built conjugation tables for ${verbArray.length} verbs`);
  return verbArray;
}

let pgPool: Pool | null = null;

async function getPgPool(): Promise<Pool> {
  if (!pgPool) {
    pgPool = new Pool({
      host: PG_HOST,
      port: parseInt(PG_PORT || "5432"),
      database: PG_DATABASE,
      user: PG_USER,
      password: PG_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pgPool;
}

async function insertToSupabase(table: string, rows: any[]): Promise<{ inserted: number; skipped: number; errors: number }> {
  if (dryRun) {
    log(`[DRY RUN] Would insert ${rows.length} rows into ${table}`);
    return { inserted: rows.length, skipped: 0, errors: 0 };
  }

  const pool = await getPgPool();
  const jsonbColumns = table === "vocabulary"
    ? new Set(["translations", "example_sentences", "collocations"])
    : table === "conjugations"
    ? new Set(["translations", "tenses"])
    : table === "lessons"
    ? new Set(["content"])
    : new Set<string>();

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const columns = Object.keys(row);
    const values = Object.values(row).map((v, idx) => {
      const colName = columns[idx];
      if (v !== null && typeof v === "object" && !Array.isArray(v)) return JSON.stringify(v);
      if (Array.isArray(v)) {
        if (jsonbColumns.has(colName)) return JSON.stringify(v);
        return v;
      }
      return v;
    });
    const placeholders = columns.map((_, idx) => `$${idx + 1}`).join(", ");
    const colNames = columns.map((c) => `"${c}"`).join(", ");

    try {
      await pool.query(
        `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        values
      );
      inserted++;
    } catch (err: any) {
      if (err.code === "23505") {
        skipped++;
      } else {
        log(`Insert error for ${row.id || i}: ${err.message.substring(0, 80)}`, "warn");
        errors++;
      }
    }

    if (i % 100 === 0) {
      process.stdout.write(`\r  Inserting ${table}: ${i + 1}/${rows.length} `);
    }
  }
  console.log();

  return { inserted, skipped, errors };
}

async function main() {
  console.log("============================================================");
  console.log("KotoLift Data Seeding Script");
  console.log("============================================================");

  section(1, 5, "Building vocabulary");
  const vocabulary = buildVocabulary();

  section(2, 5, "Downloading & indexing sentences");
  const sentenceCache = await downloadAndIndexSentences(vocabulary);

  section(3, 5, "Matching sentences to vocabulary");
  const vocabularyWithSentences = matchSentencesToVocabulary(vocabulary, sentenceCache);

  section(4, 5, "Generating lessons");
  const lessons = generateLessons(vocabularyWithSentences);

  section(5, 5, "Building conjugations");
  const conjugations = buildConjugations();

  console.log("\n[6/6] Inserting data into Supabase...");

  const vResult = await insertToSupabase("vocabulary", vocabularyWithSentences);
  log(`Vocabulary: Inserted ${vResult.inserted}, Skipped ${vResult.skipped}, Errors ${vResult.errors}`, vResult.errors > 0 ? "error" : "success");

  const lResult = await insertToSupabase("lessons", lessons);
  log(`Lessons: Inserted ${lResult.inserted}, Skipped ${lResult.skipped}, Errors ${lResult.errors}`, lResult.errors > 0 ? "error" : "success");

  const cResult = await insertToSupabase("conjugations", conjugations);
  log(`Conjugations: Inserted ${cResult.inserted}, Skipped ${cResult.skipped}, Errors ${cResult.errors}`, cResult.errors > 0 ? "error" : "success");

  console.log("\n============================================================");
  console.log("✓ Seed complete!");
  console.log("============================================================");
  console.log(`     Vocabulary:    ${vResult.inserted} words`);
  console.log(`     Lessons:       ${lResult.inserted} lessons`);
  console.log(`     Conjugations:  ${cResult.inserted} verbs`);
  console.log("");

  if (pgPool) await pgPool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
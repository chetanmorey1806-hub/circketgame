// Spoken commentary lines in English, Hindi and Marathi.
// Placeholders: {b} batter, {bw} bowler, {f} fielder, {n} runs, {z} field zone, {t} team, {s} score, {need} runs needed.

export const LANGS = {
  en: { label: 'English', voice: ['en-IN', 'en-GB', 'en-AU', 'en'] },
  hi: { label: 'हिंदी', voice: ['hi-IN', 'hi'] },
  mr: { label: 'मराठी', voice: ['mr-IN', 'mr', 'hi-IN', 'hi'] },
}

const LINES = {
  dot: {
    en: ['Good ball, no run.', 'Dot ball. Tight from {bw}.', 'Defended solidly by {b}.', 'Beaten! Nothing doing there.'],
    hi: ['बढ़िया गेंद, कोई रन नहीं।', 'डॉट बॉल! {bw} की कसी हुई गेंदबाज़ी।', '{b} ने अच्छे से रोका।', 'बीट! बल्ले का किनारा नहीं लगा।'],
    mr: ['छान चेंडू, एकही धाव नाही.', 'निर्धाव चेंडू! {bw} ची अचूक गोलंदाजी.', '{b} ने सुरेख बचाव केला.', 'चकवलं! बॅटला लागलाच नाही.'],
  },
  single: {
    en: ['Pushed into the gap, they take one.', 'Quick single.', 'Worked away for a run.'],
    hi: ['गैप में खेलकर एक रन।', 'तेज़ सिंगल!', 'एक रन और जुड़ा।'],
    mr: ['गॅपमध्ये ढकलून एक धाव.', 'चपळ एकेरी धाव!', 'आणखी एक धाव जमा.'],
  },
  runs: {
    en: ['Good running, {n} runs.', 'They come back for {n}.', 'Placed into {z}, {n} runs.'],
    hi: ['बढ़िया दौड़, {n} रन।', 'दौड़कर {n} रन पूरे किए।', '{z} की तरफ़ खेला, {n} रन।'],
    mr: ['छान धावले, {n} धावा.', 'पळून {n} धावा पूर्ण.', '{z} कडे मारला, {n} धावा.'],
  },
  four: {
    en: ['That is a glorious shot! Four runs!', 'Cracked through {z}, that races away for four!', 'No need to run for that one. Four!', 'Beautiful timing from {b}. Boundary!'],
    hi: ['क्या शानदार शॉट! चार रन!', '{z} से चौका! गेंद सीमा रेखा के पार!', 'दौड़ने की ज़रूरत नहीं, चौका!', '{b} की बेहतरीन टाइमिंग, चौका!'],
    mr: ['काय अप्रतिम फटका! चौकार!', '{z} मधून सुसाट चौकार!', 'धावायची गरजच नाही, चौकार!', '{b} चं अफलातून टायमिंग, चौकार!'],
  },
  six: {
    en: ['That is huge! Six runs!', 'Into the stands! What a hit from {b}!', 'Massive! That has gone all the way. Six!', 'Up, up and away! Maximum!'],
    hi: ['क्या गगनचुंबी छक्का!', 'गेंद सीधी स्टैंड्स में! {b} का ज़बरदस्त शॉट!', 'बहुत बड़ा छक्का!', 'ऊंचा और लंबा, छक्का!'],
    mr: ['काय उत्तुंग षटकार!', 'चेंडू थेट प्रेक्षकांत! {b} चा जबरदस्त फटका!', 'खूप मोठा षटकार!', 'उंच आणि लांब, षटकार!'],
  },
  bowled: {
    en: ['Bowled him! The stumps are shattered!', 'Timber! {bw} knocks him over!', 'Clean bowled! {b} has to go.'],
    hi: ['बोल्ड! स्टंप्स बिखर गए!', 'क्लीन बोल्ड! {bw} ने उड़ा दिए स्टंप्स!', 'बोल्ड! {b} को लौटना होगा।'],
    mr: ['त्रिफळाचीत! यष्टी उडाल्या!', 'क्लीन बोल्ड! {bw} ने दांडी गुल केली!', 'त्रिफळाचीत! {b} ला परतावं लागणार.'],
  },
  caught: {
    en: ['In the air... and taken! {f} takes the catch!', 'Caught! {b} has to walk back.', 'Straight to {f}. Gone!'],
    hi: ['हवा में... और कैच! {f} ने लपक लिया!', 'कैच आउट! {b} को पवेलियन लौटना होगा।', 'सीधा {f} के हाथों में। आउट!'],
    mr: ['हवेत... आणि झेल! {f} ने झेल घेतला!', 'झेलबाद! {b} ला तंबूत परतावं लागणार.', 'थेट {f} च्या हातात. बाद!'],
  },
  caughtBehind: {
    en: ['Edged and taken behind! {bw} gets his man.', 'Thin nick, the keeper does the rest. Out!'],
    hi: ['बल्ले का किनारा और विकेटकीपर का कैच! आउट!', 'हल्का सा किनारा, कीपर ने कोई गलती नहीं की।'],
    mr: ['बॅटची कड आणि यष्टीरक्षकाचा झेल! बाद!', 'हलकीशी कड, यष्टीरक्षकाने चूक केली नाही.'],
  },
  lbw: {
    en: ['Huge appeal... and the finger goes up! LBW!', 'Trapped in front! {b} is out leg before wicket.'],
    hi: ['ज़ोरदार अपील... और अंपायर की उंगली उठी! एलबीडब्ल्यू!', 'पैड पर लगी, {b} एलबीडब्ल्यू आउट!'],
    mr: ['जोरदार अपील... आणि पंचांचं बोट वर! पायचीत!', 'पॅडवर लागला, {b} पायचीत!'],
  },
  stumped: {
    en: ['Down the track, missed it, stumped! Brilliant work by the keeper.'],
    hi: ['क्रीज़ से बाहर निकले, गेंद छूटी, स्टंप आउट!'],
    mr: ['क्रीजबाहेर आला, चेंडू चुकला, यष्टीचीत!'],
  },
  wide: {
    en: ['That is a wide.', 'Strays down the leg side, wide called.'],
    hi: ['वाइड बॉल।', 'लेग साइड से बाहर, वाइड!'],
    mr: ['वाइड चेंडू.', 'लेग साइडला बाहेर, वाइड!'],
  },
  noball: {
    en: ['No ball! Free hit coming up.'],
    hi: ['नो बॉल! अगली गेंद फ्री हिट।'],
    mr: ['नो बॉल! पुढचा चेंडू फ्री हिट.'],
  },
  newBatter: {
    en: ['{b} walks out to the middle.'],
    hi: ['{b} बल्लेबाज़ी के लिए मैदान पर आ रहे हैं।'],
    mr: ['{b} फलंदाजीसाठी मैदानात येत आहे.'],
  },
  overEnd: {
    en: ['End of the over. {t} are {s}.'],
    hi: ['ओवर खत्म। {t} का स्कोर {s}।'],
    mr: ['षटक संपलं. {t} च्या {s} धावा.'],
  },
  fifty: {
    en: ['Fifty for {b}! Raises the bat to a standing ovation.'],
    hi: ['{b} का अर्धशतक! बल्ला उठाकर अभिवादन।'],
    mr: ['{b} चं अर्धशतक! बॅट उंचावून अभिवादन.'],
  },
  hundred: {
    en: ['A magnificent hundred for {b}!'],
    hi: ['{b} का शानदार शतक!'],
    mr: ['{b} चं दिमाखदार शतक!'],
  },
  intro: {
    en: ['Welcome to {z}. A packed house, and we are ready to go!'],
    hi: ['{z} से आप सभी का स्वागत है। स्टेडियम खचाखच भरा है!'],
    mr: ['{z} मधून सर्वांचं स्वागत. स्टेडियम खचाखच भरलं आहे!'],
  },
  review: {
    en: ['They have gone for the review!'],
    hi: ['रिव्यू लिया गया है!'],
    mr: ['रिव्ह्यू घेतला आहे!'],
  },
  overturned: {
    en: ['The decision is overturned!'],
    hi: ['फैसला पलट गया!'],
    mr: ['निर्णय बदलला!'],
  },
  upheld: {
    en: ["The on-field decision stays."],
    hi: ['मैदानी अंपायर का फैसला बरकरार।'],
    mr: ['मैदानावरील पंचांचा निर्णय कायम.'],
  },
  appeal: {
    en: ['Big appeal, but not given.'],
    hi: ['ज़ोरदार अपील, लेकिन नॉट आउट।'],
    mr: ['जोरदार अपील, पण नाबाद.'],
  },
  win: {
    en: ['And that is it! {t} win the match!'],
    hi: ['और ये रहा! {t} ने मैच जीत लिया!'],
    mr: ['आणि हा सामना {t} ने जिंकला!'],
  },
}

// Field-zone names in each language.
const ZONES = {
  hi: { 'Fine leg': 'फाइन लेग', 'Square leg': 'स्क्वेयर लेग', 'Mid-wicket': 'मिड विकेट', 'Mid-on': 'मिड ऑन', Straight: 'सीधा', 'Mid-off': 'मिड ऑफ', Cover: 'कवर', Point: 'पॉइंट', 'Third man': 'थर्ड मैन' },
  mr: { 'Fine leg': 'फाइन लेग', 'Square leg': 'स्क्वेअर लेग', 'Mid-wicket': 'मिड विकेट', 'Mid-on': 'मिड ऑन', Straight: 'सरळ', 'Mid-off': 'मिड ऑफ', Cover: 'कव्हर', Point: 'पॉइंट', 'Third man': 'थर्ड मॅन' },
}

/** A commentary line for an event, in the chosen language. */
export function call(event, ctx = {}, lang = 'en') {
  const set = LINES[event]?.[lang] ?? LINES[event]?.en
  if (!set) return ''
  const line = set[Math.floor(Math.random() * set.length)]
  const z = ctx.z ? (ZONES[lang]?.[ctx.z] ?? ctx.z).toString() : ''
  return line
    .replaceAll('{b}', ctx.b ?? '')
    .replaceAll('{bw}', ctx.bw ?? '')
    .replaceAll('{f}', ctx.f ?? '')
    .replaceAll('{n}', ctx.n ?? '')
    .replaceAll('{z}', z)
    .replaceAll('{t}', ctx.t ?? '')
    .replaceAll('{s}', ctx.s ?? '')
}

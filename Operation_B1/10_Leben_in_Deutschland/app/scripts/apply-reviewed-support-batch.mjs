import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const supportRoot = path.join(appRoot, "public", "data", "exams", "leben-in-deutschland", "support");

const REVIEWED_SUPPORT = {
  en: {
    "general-5": {
      translation: "Elections in Germany are free. What does that mean?",
      correctAnswerTranslation: "The voter may not be influenced, forced to vote in a certain way, or disadvantaged because of the election.",
      simpleExplanation: "Free elections mean voters can decide without pressure, threats, or disadvantages."
    },
    "general-6": {
      translation: "What is the German constitution called?",
      correctAnswerTranslation: "Basic Law",
      simpleExplanation: "Germany's constitution is called the Basic Law, or Grundgesetz in German."
    },
    "general-7": {
      translation: "Which right is one of the fundamental rights guaranteed by the German constitution? The right to ...",
      correctAnswerTranslation: "freedom of belief and conscience",
      simpleExplanation: "Freedom of belief and conscience is protected as a fundamental right."
    },
    "general-8": {
      translation: "What is not written in Germany's Basic Law?",
      correctAnswerTranslation: "Everyone should have the same amount of money.",
      simpleExplanation: "The Basic Law protects rights and state principles; it does not say everyone must have the same amount of money."
    },
    "general-9": {
      translation: "Which fundamental right applies in Germany only to foreigners? The fundamental right to ...",
      correctAnswerTranslation: "asylum",
      simpleExplanation: "The right to asylum is specifically for people from other countries seeking protection."
    },
    "general-10": {
      translation: "What is compatible with the German Basic Law?",
      correctAnswerTranslation: "a fine",
      simpleExplanation: "A fine is a lawful punishment and is compatible with the Basic Law."
    },
    "general-11": {
      translation: "What is the constitution of the Federal Republic of Germany called?",
      correctAnswerTranslation: "Basic Law",
      simpleExplanation: "The constitution of the Federal Republic of Germany is called the Basic Law."
    },
    "general-12": {
      translation: "A party in the German Bundestag wants to abolish freedom of the press. Is that possible?",
      correctAnswerTranslation: "No, because freedom of the press is a fundamental right. It cannot be abolished.",
      simpleExplanation: "Freedom of the press is protected by the Basic Law and cannot simply be abolished by a party."
    },
    "general-13": {
      translation: "In parliament, the term \"opposition\" means ...",
      correctAnswerTranslation: "all members of parliament who do not belong to the governing party or parties",
      simpleExplanation: "The opposition consists of representatives who are not part of the governing parties."
    },
    "general-14": {
      translation: "Freedom of expression in Germany means that I ...",
      correctAnswerTranslation: "can express my opinion on the internet",
      simpleExplanation: "Freedom of expression protects the right to state opinions, including online."
    },
    "general-15": {
      translation: "What does the German Basic Law prohibit?",
      correctAnswerTranslation: "forced labor",
      simpleExplanation: "Forced labor is prohibited by the Basic Law."
    },
    "general-16": {
      translation: "When is freedom of expression restricted in Germany?",
      correctAnswerTranslation: "when false claims about individual people are spread publicly",
      simpleExplanation: "Freedom of expression does not protect public false statements that harm specific people."
    },
    "general-17": {
      translation: "German laws prohibit ...",
      correctAnswerTranslation: "unequal treatment of citizens by the state",
      simpleExplanation: "The state must treat citizens equally under the law."
    },
    "general-18": {
      translation: "Which fundamental right is guaranteed in Article 1 of the Basic Law of the Federal Republic of Germany?",
      correctAnswerTranslation: "the inviolability of human dignity",
      simpleExplanation: "Article 1 begins with the protection of human dignity."
    },
    "general-19": {
      translation: "What is meant by the right of \"freedom of movement\" in Germany?",
      correctAnswerTranslation: "You may choose your place of residence yourself.",
      simpleExplanation: "Freedom of movement means people may decide where they want to live within Germany."
    },
    "general-20": {
      translation: "A party in Germany pursues the goal of establishing a dictatorship. It is then ...",
      correctAnswerTranslation: "unconstitutional",
      simpleExplanation: "A party that wants to establish a dictatorship acts against the constitution."
    }
  },
  ar: {
    "general-5": {
      translation: "الانتخابات في ألمانيا حرة. ماذا يعني ذلك؟",
      correctAnswerTranslation: "لا يجوز التأثير على الناخبة أو الناخب، ولا إجباره على التصويت بطريقة معينة، ولا إلحاق ضرر به بسبب الانتخابات.",
      simpleExplanation: "الانتخابات الحرة تعني أن الناخبين يقررون دون ضغط أو إجبار أو ضرر."
    },
    "general-6": {
      translation: "ماذا يسمى الدستور الألماني؟",
      correctAnswerTranslation: "القانون الأساسي",
      simpleExplanation: "يسمى دستور ألمانيا القانون الأساسي، وبالألمانية Grundgesetz."
    },
    "general-7": {
      translation: "أي حق ينتمي إلى الحقوق الأساسية التي يضمنها الدستور الألماني؟ الحق في ...",
      correctAnswerTranslation: "حرية المعتقد والضمير",
      simpleExplanation: "حرية المعتقد والضمير محمية كحق أساسي."
    },
    "general-8": {
      translation: "ما الذي لا يرد في القانون الأساسي لألمانيا؟",
      correctAnswerTranslation: "يجب أن يكون لدى الجميع نفس القدر من المال.",
      simpleExplanation: "القانون الأساسي يحمي الحقوق ومبادئ الدولة، لكنه لا ينص على أن يكون لدى الجميع نفس القدر من المال."
    },
    "general-9": {
      translation: "أي حق أساسي ينطبق في ألمانيا فقط على الأجنبيات والأجانب؟ الحق الأساسي في ...",
      correctAnswerTranslation: "اللجوء",
      simpleExplanation: "حق اللجوء مخصص للأشخاص القادمين من دول أخرى والذين يطلبون الحماية."
    },
    "general-10": {
      translation: "ما الذي يتوافق مع القانون الأساسي الألماني؟",
      correctAnswerTranslation: "الغرامة المالية",
      simpleExplanation: "الغرامة المالية عقوبة قانونية وتتوافق مع القانون الأساسي."
    },
    "general-11": {
      translation: "ماذا يسمى دستور جمهورية ألمانيا الاتحادية؟",
      correctAnswerTranslation: "القانون الأساسي",
      simpleExplanation: "يسمى دستور جمهورية ألمانيا الاتحادية القانون الأساسي."
    },
    "general-12": {
      translation: "يريد حزب في البوندستاغ الألماني إلغاء حرية الصحافة. هل هذا ممكن؟",
      correctAnswerTranslation: "لا، لأن حرية الصحافة حق أساسي. لا يمكن إلغاؤها.",
      simpleExplanation: "حرية الصحافة محمية في القانون الأساسي ولا يمكن لحزب أن يلغيها ببساطة."
    },
    "general-13": {
      translation: "في البرلمان، يشير مصطلح \"المعارضة\" إلى ...",
      correctAnswerTranslation: "جميع النواب الذين لا ينتمون إلى الحزب الحاكم أو الأحزاب الحاكمة",
      simpleExplanation: "المعارضة تتكون من النواب الذين لا ينتمون إلى الأحزاب الحاكمة."
    },
    "general-14": {
      translation: "حرية التعبير في ألمانيا تعني أنني ...",
      correctAnswerTranslation: "أستطيع التعبير عن رأيي على الإنترنت",
      simpleExplanation: "حرية التعبير تحمي حق الشخص في إبداء رأيه، بما في ذلك على الإنترنت."
    },
    "general-15": {
      translation: "ما الذي يحظره القانون الأساسي الألماني؟",
      correctAnswerTranslation: "العمل القسري",
      simpleExplanation: "العمل القسري محظور بموجب القانون الأساسي."
    },
    "general-16": {
      translation: "متى تكون حرية التعبير مقيدة في ألمانيا؟",
      correctAnswerTranslation: "عند نشر ادعاءات كاذبة علناً عن أشخاص محددين",
      simpleExplanation: "حرية التعبير لا تحمي نشر ادعاءات كاذبة تضر بأشخاص محددين."
    },
    "general-17": {
      translation: "تحظر القوانين الألمانية ...",
      correctAnswerTranslation: "المعاملة غير المتساوية للمواطنات والمواطنين من قبل الدولة",
      simpleExplanation: "يجب على الدولة أن تعامل المواطنات والمواطنين بالمساواة أمام القانون."
    },
    "general-18": {
      translation: "أي حق أساسي مضمون في المادة 1 من القانون الأساسي لجمهورية ألمانيا الاتحادية؟",
      correctAnswerTranslation: "عدم المساس بكرامة الإنسان",
      simpleExplanation: "تبدأ المادة 1 بحماية كرامة الإنسان."
    },
    "general-19": {
      translation: "ما المقصود بحق \"حرية التنقل\" في ألمانيا؟",
      correctAnswerTranslation: "يجوز للشخص أن يختار مكان سكنه بنفسه.",
      simpleExplanation: "حرية التنقل تعني أن الناس يستطيعون اختيار المكان الذي يريدون العيش فيه داخل ألمانيا."
    },
    "general-20": {
      translation: "حزب في ألمانيا يسعى إلى إقامة دكتاتورية. عندئذ يكون ...",
      correctAnswerTranslation: "غير دستوري",
      simpleExplanation: "الحزب الذي يريد إقامة دكتاتورية يعمل ضد الدستور."
    }
  }
};

for (const [locale, updates] of Object.entries(REVIEWED_SUPPORT)) {
  const supportPath = path.join(supportRoot, `${locale}.json`);
  const support = JSON.parse(fs.readFileSync(supportPath, "utf8"));
  const updated = support.map((item) => {
    const update = updates[item.questionId];
    return update ? { ...item, ...update } : item;
  });
  fs.writeFileSync(supportPath, `${JSON.stringify(updated, null, 2)}\n`);
  console.log(`Applied ${Object.keys(updates).length} reviewed ${locale} support entries`);
}

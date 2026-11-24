import type {
  DemoState,
  GeneratePoemRequest,
  Generation,
  Mood,
  WalletTransaction,
} from "./types";

const verses: Record<Mood, string[]> = {
  neutral: [
    "Над тихим городом встаёт рассвет,\nИ новый день рисует очертанья.\nВ привычных окнах загорается свет,\nХраня тепло негромкого признанья.",
  ],
  romantic: [
    "В твоих ладонях прячется весна,\nИ свет звезды становится теплее.\nПока над нами тишина ясна,\nЯ с каждым вздохом становлюсь смелее.",
  ],
  cheerful: [
    "Пускай сегодня дождик озорной\nТанцует по раскрытым тротуарам.\nМы солнце заберём с собой домой,\nИ день не пропадёт сегодня даром!",
  ],
  sad: [
    "На подоконник опустилась тень,\nОстывший чай хранит тепло прощанья.\nТак незаметно растворился день,\nОставив нам негромкое молчанье.",
  ],
  philosophical: [
    "Мы ищем смысл в движении воды,\nВ неспешном свете утреннего неба.\nИ время заметает все следы,\nНо оставляет вкус простого хлеба.",
  ],
  dark: [
    "Над чёрным лесом замерла луна,\nИ ветер счёт ведёт пустым дорогам.\nЗа каждой дверью дышит тишина,\nИ ночь стоит у самого порога.",
  ],
};
const endings = [
  "И где-то начинается маршрут,\nКоторый мы ещё не проходили.\nПускай часы немного подождут,\nЧтоб мы мгновенье это сохранили.",
];
export function makePoem(request: GeneratePoemRequest): string {
  const extra =
    "За горизонтом дремлет новый день,\nИ облака плывут неторопливо.\nНа землю мягко опускает тень\nДерево у притихшего залива.";
  const last =
    "Пусть эта строчка обретёт свой дом,\nПусть этот миг останется со мною.\nМы дальше по дороге побредём,\nУкрытой незнакомой тишиною.";
  return [verses[request.mood][0], endings[0], extra, last]
    .slice(0, request.stanzaCount)
    .join("\n\n");
}

export function createDemoData(): DemoState {
  const state: DemoState = {
    version: 2,
    users: [],
    credentials: {},
    wallets: [],
    transactions: [],
    generations: [],
    session: null,
    demo: { failNext: false },
  };
  const daysAgo = (days: number) =>
    new Date(Date.now() - days * 86400000).toISOString();
  const accounts = [
    {
      email: "user@example.com",
      name: "Анна",
      credit: 150,
      topics: [
        "Утро в большом городе",
        "Тёплые воспоминания",
        "Разговор с осенью",
      ],
    },
    {
      email: "user2@example.com",
      name: "Михаил",
      credit: 20,
      topics: ["Дорога домой"],
    },
  ];
  for (const account of accounts) {
    const user = {
      id: crypto.randomUUID(),
      email: account.email,
      displayName: account.name,
      createdAt: daysAgo(5),
    };
    const wallet = { id: crypto.randomUUID(), userId: user.id, balance: 0 };
    state.users.push(user);
    state.credentials[user.id] = "demo1234";
    state.wallets.push(wallet);
    const addSampleTransaction = (
      type: WalletTransaction["type"],
      amount: number,
      description: string,
      createdAt: string,
      generationId?: string,
    ) => {
      wallet.balance += amount;
      state.transactions.push({
        id: crypto.randomUUID(),
        walletId: wallet.id,
        userId: user.id,
        type,
        amount,
        balanceAfter: wallet.balance,
        description,
        createdAt,
        generationId,
      });
    };
    addSampleTransaction(
      "CREDIT",
      account.credit,
      "Приветственные единицы",
      daysAgo(5),
    );
    account.topics.forEach((topic, index) => {
      const date = daysAgo(account.topics.length - index);
      const failed = index === 2;
      const generation: Generation = {
        id: crypto.randomUUID(),
        requestId: crypto.randomUUID(),
        userId: user.id,
        topic,
        instructions: "",
        mood: index === 1 ? "romantic" : "neutral",
        stanzaCount: 2,
        result: null,
        status: failed ? "FAILED" : "COMPLETED",
        cost: 10,
        errorMessage: failed
          ? "Демонстрационный сбой AI. Единицы возвращены."
          : null,
        createdAt: date,
        startedAt: date,
        completedAt: date,
      };
      if (!failed) generation.result = makePoem(generation);
      state.generations.push(generation);
      addSampleTransaction(
        "DEBIT",
        -10,
        `Стихотворение «${topic}»`,
        date,
        generation.id,
      );
      if (failed)
        addSampleTransaction(
          "REFUND",
          10,
          "Возврат за неуспешную генерацию",
          date,
          generation.id,
        );
    });
  }
  return state;
}

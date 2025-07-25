// 実行は npx prisma db seed　(package.jsonの prisma にコマンド追加)
// 上記コマンドで実行する範囲は相対パスを基準にする必要があるので注意
import { v4 as uuid } from "uuid";
import { PrismaClient, Role, Region } from "@prisma/client";
import { UserSeed, userSeedSchema } from "../src/app/_types/UserSeed";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // テスト用のユーザ情報の「種」となる userSeeds を作成
  const userSeeds: UserSeed[] = [
    {
      name: "高負荷 耐子",
      password: "password1111",
      email: "admin01@example.com",
      role: Role.ADMIN,
    },
    {
      name: "不具合 直志",
      password: "password2222",
      email: "admin02@example.com",
      role: Role.ADMIN,
    },
    {
      name: "構文 誤次郎",
      password: "password1111",
      email: "user01@example.com",
      role: Role.USER,
      aboutSlug: "gojiro",
      aboutContent: "構文誤次郎です。<br>よろしくお願いします。",
    },
    {
      name: "仕様 曖昧子",
      password: "password2222",
      email: "user02@example.com",
      role: Role.USER,
      aboutSlug: "aimaiko",
      aboutContent: "仕様曖昧子と申します。仲良くしてください。",
    },
    {
      name: "RN MT",
      password: "password3333",
      email: "TTTTTTTTTTTTTTTTTTTT@gmail.com",
      role: Role.USER,
      aboutSlug: "rnmt",
      aboutContent: "RN MTです。<br>React NativeのMT（マスター）です。",
    },
  ];

  // userSeedSchema を使って UserSeeds のバリデーション
  try {
    await Promise.all(
      userSeeds.map(async (userSeed, index) => {
        const result = userSeedSchema.safeParse(userSeed);
        if (result.success) return;
        console.error(
          `Validation error in record ${index}:\n${JSON.stringify(userSeed, null, 2)}`,
        );
        console.error("▲▲▲ Validation errors ▲▲▲");
        console.error(
          JSON.stringify(result.error.flatten().fieldErrors, null, 2),
        );
        throw new Error(`Validation failed at record ${index}`);
      }),
    );
  } catch (error) {
    throw error;
  }

  // 各テーブルの全レコードを削除
  await prisma.user.deleteMany();
  await prisma.session.deleteMany();
  await prisma.stolenContent.deleteMany();
  await prisma.newsItem.deleteMany();
  await prisma.cartSession.deleteMany();
  await prisma.product.deleteMany();
  await prisma.cartItem.deleteMany();

  // ユーザ（user）テーブルにテストデータを挿入
  await prisma.user.createMany({
    data: userSeeds.map((userSeed) => ({
      id: uuid(),
      name: userSeed.name,
      password: userSeed.password,
      role: userSeed.role,
      email: userSeed.email,
      aboutSlug: userSeed.aboutSlug || null,
      aboutContent: userSeed.aboutContent || "",
    })),
  });

  // 商品（product）テーブルにテストデータを挿入
  await prisma.product.createMany({
    data: [
      {
        id: "A-001",
        name: "副業で人生逆転！AI自動コード生成マニュアル",
        price: 10000,
      },
      {
        id: "A-002",
        name: "月収7桁を叩き出すCSS講座【完全無料】",
        price: 50000,
      },
      {
        id: "A-003",
        name: "資格不要！ゼロから始める非正規暗号通貨運用術",
        price: 30000,
      },
      {
        id: "A-004",
        name: "	パワポで月収100万：架空案件で学ぶ「営業芸」完全読本",
        price: 15000,
      },
    ],
  });

  // NewsItemテーブルにダミーデータを挿入
  await prisma.newsItem.createMany({
    data: [
      {
        title: "生成AIがバグって「知らんがな」しか返さん事件",
        region: Region.OSAKA,
        publishedAt: new Date("2025-05-17"),
      },
      {
        title: "駅前のたこ焼き屋のWi-Fiが研究棟より速い問題",
        region: Region.OSAKA,
        publishedAt: new Date("2025-05-18"),
      },
      {
        title: "「一時的なスクリプト」が2年間も本番環境で動いていた件",
        region: Region.TOKYO,
        publishedAt: new Date("2025-05-18"),
      },
      {
        title: "MacOSでしか動作しないレポート提出システムが爆誕",
        region: Region.TOKYO,
        publishedAt: new Date("2025-05-19"),
      },
      {
        title: "サトウキビ畑から発見された謎の Raspberry Pi クラスタ",
        region: Region.OKINAWA,
        publishedAt: new Date("2025-05-19"),
      },
      {
        title: "深夜に現れる謎のコメットメッセージ「ほんまごめん」",
        region: Region.OSAKA,
        publishedAt: new Date("2025-05-20"),
      },
      {
        title:
          "秋葉原の裏路地にしか売ってない謎のWi-Fiモジュールが研究室で大活躍",
        region: Region.TOKYO,
        publishedAt: new Date("2025-05-21"),
      },
      {
        title:
          "リアルタイムOSが「うちなータイム」に感化されてスケジューラが瞑想状態に",
        region: Region.OKINAWA,
        publishedAt: new Date("2025-05-22"),
      },
    ],
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => console.error(e.message))
  .finally(async () => {
    await prisma.$disconnect();
  });

# 👑 INCASH — Telegram Mini App (мини-казино с виртуальной валютой)

Демо-приложение в Telegram: мини-игры (слоты, кости, крэш, монетка, рулетка) на
**внутренние игровые монеты 🪙**, на которые в магазине покупается недвижимость и
машины. Недвижимость приносит пассивный доход в монетах/час, машины дают бонус к
доходу. Реальных денег нет — только виртуальная валюта, развлекательный формат.

## Технологии
- Чистый HTML/CSS/JS (без сборки) — статика для Vercel
- `api/state.js` — Serverless-функция Vercel (Node), которая хранит данные в **Vercel Postgres (Neon)**
- `window.Telegram.WebApp` — интеграция с Telegram Mini Apps (ID, имя, username)
- Сохранение: `localStorage` (локальный кеш) + Vercel Postgres (сервер, по Telegram ID)

Структура:
```
index.html      — разметка всех экранов
css/style.css   — тёмная тема, адаптив под телефон
js/shop.js      — каталог недвижимости и машин
js/games.js     — логика 5 мини-игр
js/app.js       — состояние, серверное сохранение, навигация, магазин, уровни, доход
api/state.js    — Vercel API (GET/POST к Vercel Postgres, таблица players)
img/logo.jpg    — логотип приложения
vercel.json     — конфиг деплоя (static + api)
package.json    — зависимости (@vercel/postgres)
```

## Как задеплоить на Vercel

```bash
npm i -g vercel
vercel                    # первый раз — авторизация
vercel link               # привязать к Vercel проекту
vercel env add POSTGRES_URL  # укажи URL из Storage → Vercel Postgres
vercel --prod             # деплой
```

### Настройка Vercel Postgres (Neon)
1. В [vercel.com](https://vercel.com) → Storage → **Vercel Postgres** → Create.
2. После создания Vercel сам прокидывает переменную `POSTGRES_URL` в окружение.
3. Если делаешь `vercel env add POSTGRES_URL` — скопируй из панели Storage.

### Настройка Telegram Bot
- BotFather: `/newbot` → `/mybots` → Bot Settings → Mini App → укажи URL с Vercel.

## Как задеплоить на Vercel

**Вариант А — Vercel CLI:**
```bash
npm i -g vercel
vercel        # первый раз — залогиниться и подтвердить настройки
vercel --prod # прод-деплой
```

**Вариант Б — GitHub + Vercel:**
1. Залей репозиторий на GitHub.
2. На [vercel.com](https://vercel.com) → `Add New Project` → импортируй репозиторий.
3. Framework Preset: `Other` (это статика, сборка не нужна).
4. Deploy. Получишь ссылку вида `https://lucky-city.vercel.app`.

## Как подключить к Telegram BotFather
1. В BotFather: `/newbot` → создай бота.
2. `/newapp` (или `/setmenubutton`) → привяжи Mini App к боту, укажи URL с Vercel
   (обязательно `https://`).
3. Запусти бота и открой меню — откроется приложение; имя юзера подхватится автоматически.

Для локальной проверки: `npx serve .` (или любой статик-сервер) и открой `http://localhost:3000`.

## Игровые механики
- **Монеты 🪙**: стартовый бонус 1 000, выигрыши в играх, пассивный доход с недвижимости.
- **Игры**: слоты (x50 → x1.5), кости (сумма 7 / больше-меньше / чёт-нечёт / дубль),
  крэш (комиссия 2%), монетка (x1.9), рулетка (числа x36, цвет/чёт/дюжины x2–x3).
- **Имущество**: 7 объектов недвижимости (гараж → остров) и 7 машин (Лада → Bugatti).
- **Уровни**: 10 уровней (Новичок → Вершина), растут от ставок (XP = ставка/5).

> Развлекательное демо с виртуальной валютой: ставки на реальные деньги, вывод и
> азартные игры на деньги не поддерживаются.
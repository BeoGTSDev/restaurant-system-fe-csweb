# Restaurant Customer Ordering Web

Customer-facing ordering website built with standard Next.js, React/JSX and
plain CSS.

## Source code

- `app/page.tsx`: UI state, cart logic and REST API integration.
- `app/globals.css`: all layout, responsive design and visual styling.
- `app/layout.tsx`: page metadata and root HTML layout.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/?table=1`. The default backend API is
`http://localhost:5000/api`.

To use another backend:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api.example.com/api npm run dev
```

The customer website reads products, categories and tables from the backend,
then posts orders to `/api/orders/customer`. Orders are stored in the same
backend used by the POS.

import { app, origins } from './app.js';

// Separato da app.ts
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`api in ascolto su http://localhost:${port}`);
  console.log(`origini CORS ammesse: ${origins.join(', ')}`);
});

import { app, origins } from './app.js';
import { avviaJob } from './job.js';

// Separato da app.ts
const port = Number(process.env.PORT ?? 3000);
app.listen(port, (errore) => {
  if (errore) throw errore;
  console.log(`api in ascolto su http://localhost:${port}`);
  console.log(`origini CORS ammesse: ${origins.join(', ')}`);
  avviaJob();
});

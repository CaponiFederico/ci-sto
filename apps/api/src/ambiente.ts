import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Il .env sta nella radice del monorepo, non nella cartella da cui parte il processo.
config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

export const radiceMonorepo = fileURLToPath(new URL('../../../', import.meta.url));

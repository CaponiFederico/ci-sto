import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });

export const radiceMonorepo = fileURLToPath(new URL('../../../', import.meta.url));

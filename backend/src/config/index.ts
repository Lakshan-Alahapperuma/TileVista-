import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from local and root .env files
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET || 'tilevista_jwt_development_secret_key_change_me_in_production',
    expiresIn: process.env.JWT_EXPIRATION || '24h',
  },
  lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10),
  mail: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.GMAIL_USER || process.env.SMTP_USER || '',
    pass: process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'TileVista Support <nadunsawumya88@gmail.com>',
  },
};

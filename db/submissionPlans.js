import { getDb } from './connection.js';

export const collection = () => getDb().collection('submissionPlans');

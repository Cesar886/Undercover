import { createSessionValue, verifySessionValue } from './lib/session';

async function main() {
  const token = await createSessionValue({ id: '1', username: 'test' });
  console.log('Token:', token);
  const verify = await verifySessionValue(token);
  console.log('Verify:', verify);
}
main();
import {
  serialize
} from 'cookie';

export async function POST() {
  const cookie = serialize('session', '', {
    path: '/',
    expires: new Date(0)
  });

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: {
      'Set-Cookie': cookie
    }
  });
}
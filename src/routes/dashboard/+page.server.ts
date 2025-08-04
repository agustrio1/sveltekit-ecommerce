import type {
  PageServerLoad
} from './$types';
import {
  redirect
} from '@sveltejs/kit';

export const load: PageServerLoad = async ({
  locals
}) => {
  if (!locals.user || locals.user.role !== 'admin') {
    throw redirect(302, '/login');
  }

  // Bisa ambil data dari DB di sini nanti
  return {};
};
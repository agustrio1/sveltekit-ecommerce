import type {
  LayoutServerLoad
} from './$types';
import {
  redirect
} from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({
  locals
}) => {
  if (!locals.user || locals.user.role !== 'admin') {
    throw redirect(302, '/unauthorized');
  }

  return {
    user: locals.user
  };
};
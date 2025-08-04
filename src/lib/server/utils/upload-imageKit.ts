import {
  imagekit
} from '$lib/server/imagekit-client';
import 'dotenv/config';

export async function uploadImageKit(
  file: File,
  folder: 'categories' | 'products' = 'uploads'
): Promise < string > {
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const uploaded = await imagekit.upload({
    file: `data:${file.type};base64,${base64}`,
    fileName: file.name,
    folder
  });

  return uploaded.url;
}
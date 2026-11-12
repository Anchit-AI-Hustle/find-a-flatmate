import { session,service } from '@/lib/db';
import { uuid } from '@/lib/validate';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const id=uuid.safeParse((await params).id);
 const auth=await session(), backend=service();
 if(!id.success||!auth||!backend) return new Response(null,{status:404});
 const {data}=await auth.db.from('listing_images').select('path').eq('id',id.data).maybeSingle();
 if(!data) return new Response(null,{status:404});
 const {data:file}=await backend.storage.from('room-photos').download(data.path);
 return file ? new Response(file,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}}) : new Response(null,{status:404});
}

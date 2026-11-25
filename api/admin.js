import {createClient} from "@supabase/supabase-js";
import {adapt} from "../lib/vercel-adapter.js";
export async function admin(req,res){
 res.set("Cache-Control","private, no-store, max-age=0");
 res.set("X-Content-Type-Options","nosniff");
 const allowed=new Set((process.env.ADMIN_USER_IDS||"").split(",").map(s=>s.trim()).filter(Boolean));
 if(!allowed.size||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY||!process.env.SUPABASE_PUBLISHABLE_KEY) return res.status(503).json({error:"Panel pendiente de configuración de acceso."});
 const origin=req.get("origin");
 if(origin&&origin!=="https://www.nutricionpura.cl"&&origin!=="https://nutricionpura.cl")return res.status(403).json({error:"Origen no autorizado"});
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}};
 const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,options);
 try{
 if(req.method==="POST"){
  const email=req.body?.email,password=req.body?.password;
  if(typeof email!=="string"||typeof password!=="string"||email.length>254||password.length>512)return res.status(400).json({error:"Datos inválidos"});
  const {data,error}=await auth.auth.signInWithPassword({email,password});
  if(error||!data.user||!allowed.has(data.user.id))return res.status(401).json({error:"Acceso no autorizado"});
  return res.status(200).json({token:data.session.access_token});
 }
 if(req.method!=="GET")return res.status(405).json({error:"Método no permitido"});
 const token=(req.get("authorization")||"").match(/^Bearer (\S+)$/)?.[1];
 if(!token)return res.status(401).json({error:"Inicia sesión"});
 const {data,error}=await auth.auth.getUser(token);
 if(error||!data.user||!allowed.has(data.user.id))return res.status(401).json({error:"Acceso no autorizado"});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
 const url=new URL(req.originalUrl,"https://www.nutricionpura.cl");
 const days=Number(url.searchParams.get("days")||30);
 if(![7,30,90].includes(days))return res.status(400).json({error:"Periodo inválido"});
 const since=new Date(Date.now()-days*86400000).toISOString();
 const fields="id,email,customer,items,subtotal,discount,amount,status,created_at,updated_at";
 const sources=await Promise.all(["flow_orders","mercadopago_orders"].map(async table=>{
  let rows=[],partial=false;
  for(let start=0;start<5000;start+=500){
   const r=await db.from(table).select(fields).gte("created_at",since).order("created_at",{ascending:false}).order("id").range(start,start+499);
   if(r.error)return {provider:table==="flow_orders"?"Flow":"Mercado Pago",error:true,rows:[]};
   rows.push(...r.data);if(r.data.length<500)break;if(start===4500)partial=true;
  }
  return {provider:table==="flow_orders"?"Flow":"Mercado Pago",partial,rows:rows.map(r=>({...r,provider:table==="flow_orders"?"Flow":"Mercado Pago"}))};
 }));
 const orders=sources.flatMap(s=>s.rows).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 return res.status(200).json({orders,coverage:sources.map(({rows,...s})=>s),since,days});
 }catch(e){console.error("Admin request failed",e.name);return res.status(502).json({error:"No se pudo consultar el panel."});}
}
export default adapt(admin);
